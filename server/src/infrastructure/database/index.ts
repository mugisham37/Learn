/**
 * Database Connection and Configuration
 *
 * Manages PostgreSQL connection using Drizzle ORM with connection pooling,
 * retry logic, separate read/write pools, transaction management, and PgBouncer support.
 *
 * Requirements: 15.7, 16.3
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient, PoolConfig } from 'pg';

import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';

import { connectionMonitor, ConnectionMonitor } from './ConnectionMonitor.js';

/**
 * Connection retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * Creates a PostgreSQL connection pool with retry logic
 */
async function createPoolWithRetry(poolConfig: PoolConfig, poolName: string): Promise<Pool> {
  const pool = new Pool(poolConfig);

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      logger.info(`${poolName} connection pool established successfully`);
      return pool;
    } catch (error) {
      const isLastAttempt = attempt === RETRY_CONFIG.maxRetries - 1;

      if (isLastAttempt) {
        logger.error(
          `${poolName} connection failed after ${RETRY_CONFIG.maxRetries} attempts:`,
          { error: error instanceof Error ? error.message : 'Unknown error' }
        );
        await pool.end();
        throw new Error(
          `Failed to establish ${poolName} connection: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      const delay = calculateBackoffDelay(attempt);
      logger.warn(
        `${poolName} connection attempt ${attempt + 1} failed. Retrying in ${delay}ms...`,
        { error: error instanceof Error ? error.message : error }
      );

      await sleep(delay);
    }
  }

  throw new Error(`Failed to establish ${poolName} connection`);
}

/**
 * Get the appropriate database URL based on PgBouncer configuration
 */
function getDatabaseUrl(): string {
  if (config.database.usePgBouncer && config.database.pgBouncerUrl) {
    logger.info('Using PgBouncer connection URL');
    return config.database.pgBouncerUrl;
  }
  return config.database.url;
}

/**
 * Base pool configuration with enhanced timeout handling
 */
const basePoolConfig: PoolConfig = {
  connectionString: getDatabaseUrl(),
  min: config.database.poolMin,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.idleTimeoutMs,
  connectionTimeoutMillis: config.database.connectionTimeoutMs,
  // Query timeout for individual queries
  query_timeout: config.database.queryTimeoutMs,
  // Enable keep-alive for long-running connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Statement timeout to prevent runaway queries
  statement_timeout: config.database.queryTimeoutMs,
  // Application name for connection tracking
  application_name: `learning-platform-${config.nodeEnv}`,
};

/**
 * Write pool - for INSERT, UPDATE, DELETE operations
 * Higher priority, connects to primary database
 */
let writePool: Pool | null = null;

/**
 * Read pool - for SELECT operations
 * Can be configured to use read replicas in production
 */
let readPool: Pool | null = null;

/**
 * Initialize database connection pools with monitoring
 */
export async function initializeDatabasePools(): Promise<void> {
  logger.info('Initializing database connection pools...');

  // Determine pool sizes based on PgBouncer usage
  const writePoolSize = config.database.usePgBouncer
    ? Math.ceil(config.database.poolMax * 0.5) // Smaller pools when using PgBouncer
    : Math.ceil(config.database.poolMax * 0.6);

  const readPoolSize = config.database.usePgBouncer
    ? Math.floor(config.database.poolMax * 0.3)
    : Math.floor(config.database.poolMax * 0.4);

  // Create write pool
  writePool = await createPoolWithRetry(
    {
      ...basePoolConfig,
      max: writePoolSize,
      // Write pool configuration
      application_name: `learning-platform-${config.nodeEnv}-write`,
    },
    'Write pool'
  );

  // Create read pool
  // In production, this could point to a read replica
  const readPoolConfig = {
    ...basePoolConfig,
    max: readPoolSize,
    // Read operations can have slightly longer timeout
    connectionTimeoutMillis: config.database.connectionTimeoutMs + 5000,
    application_name: `learning-platform-${config.nodeEnv}-read`,
  };

  readPool = await createPoolWithRetry(readPoolConfig, 'Read pool');

  // Set up enhanced error handlers with monitoring
  writePool.on('error', (err) => {
    logger.error('Unexpected error on write pool idle client', { error: err.message });
    connectionMonitor.emit('poolError', { pool: 'write', error: err });
  });

  readPool.on('error', (err) => {
    logger.error('Unexpected error on read pool idle client', { error: err.message });
    connectionMonitor.emit('poolError', { pool: 'read', error: err });
  });

  // Set up connection event monitoring
  writePool.on('connect', (client) => {
    logger.debug('New client connected to write pool');
    connectionMonitor.emit('clientConnect', { pool: 'write', client });
  });

  readPool.on('connect', (client) => {
    logger.debug('New client connected to read pool');
    connectionMonitor.emit('clientConnect', { pool: 'read', client });
  });

  // Initialize connection monitoring
  if (config.database.enableConnectionMonitoring) {
    connectionMonitor.initialize(writePool, readPool);
    connectionMonitor.startMonitoring();

    // Set up alert handling
    connectionMonitor.on('alert', (alert: { type: string; message: string }) => {
      logger.warn(`[DB Connection Alert] ${alert.type}: ${alert.message}`);
      // In production, this could send alerts to monitoring systems
    });

    logger.info('Connection monitoring enabled');
  }

  logger.info(
    `Database connection pools initialized successfully (PgBouncer: ${config.database.usePgBouncer ? 'enabled' : 'disabled'})`
  );
}

/**
 * Get the write pool (for mutations)
 */
export function getWritePool(): Pool {
  if (!writePool) {
    throw new Error('Write pool not initialized. Call initializeDatabasePools() first.');
  }
  return writePool;
}

/**
 * Get the read pool (for queries)
 */
export function getReadPool(): Pool {
  if (!readPool) {
    throw new Error('Read pool not initialized. Call initializeDatabasePools() first.');
  }
  return readPool;
}

/**
 * Drizzle ORM database instance for write operations
 */
export function getWriteDb(): NodePgDatabase {
  return drizzle(getWritePool());
}

/**
 * Drizzle ORM database instance for read operations
 */
export function getReadDb(): NodePgDatabase {
  return drizzle(getReadPool());
}

/**
 * Default database instance (uses write pool)
 * Maintained for backward compatibility
 */
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop): unknown {
    return getWriteDb()[prop as keyof NodePgDatabase];
  },
});

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

/**
 * Execute a database transaction with automatic rollback on error
 *
 * @param callback - Function to execute within the transaction
 * @returns Result of the transaction callback
 * @throws Error if transaction fails
 */
export async function withTransaction<T>(callback: TransactionCallback<T>): Promise<T> {
  const pool = getWritePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back due to error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a database transaction with Drizzle ORM
 *
 * @param callback - Function to execute within the transaction
 * @returns Result of the transaction callback
 */
export async function withDrizzleTransaction<T>(
  callback: (tx: NodePgDatabase) => Promise<T>
): Promise<T> {
  const pool = getWritePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const tx = drizzle(client);
    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Drizzle transaction rolled back due to error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check result interface
 */
export interface DatabaseHealthCheck {
  healthy: boolean;
  writePool: {
    connected: boolean;
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
  readPool: {
    connected: boolean;
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
  latencyMs?: number;
  error?: string;
}

/**
 * Comprehensive database health check
 * Tests connectivity and returns pool statistics
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
  const startTime = Date.now();
  const result: DatabaseHealthCheck = {
    healthy: false,
    writePool: {
      connected: false,
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    },
    readPool: {
      connected: false,
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
    },
  };

  try {
    // Check write pool
    if (writePool) {
      const writeClient = await writePool.connect();
      try {
        await writeClient.query('SELECT 1 as health_check');
        result.writePool.connected = true;
        result.writePool.totalConnections = writePool.totalCount;
        result.writePool.idleConnections = writePool.idleCount;
        result.writePool.waitingClients = writePool.waitingCount;
      } finally {
        writeClient.release();
      }
    }

    // Check read pool
    if (readPool) {
      const readClient = await readPool.connect();
      try {
        await readClient.query('SELECT 1 as health_check');
        result.readPool.connected = true;
        result.readPool.totalConnections = readPool.totalCount;
        result.readPool.idleConnections = readPool.idleCount;
        result.readPool.waitingClients = readPool.waitingCount;
      } finally {
        readClient.release();
      }
    }

    // Calculate latency
    result.latencyMs = Date.now() - startTime;

    // Overall health is true if both pools are connected
    result.healthy = result.writePool.connected && result.readPool.connected;

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.latencyMs = Date.now() - startTime;
    return result;
  }
}

/**
 * Tests database connectivity (legacy function for backward compatibility)
 */
export async function testDatabaseConnection(): Promise<boolean> {
  const health = await checkDatabaseHealth();
  if (health.healthy) {
    logger.info('Database connection successful');
  } else {
    logger.error('Database connection failed:', { error: health.error });
  }
  return health.healthy;
}

/**
 * Alias for testDatabaseConnection for consistency
 */
export const testConnection = testDatabaseConnection;

/**
 * Closes all database connection pools gracefully
 */
export async function closeDatabaseConnection(): Promise<void> {
  logger.info('Closing database connection pools...');

  // Stop connection monitoring
  if (config.database.enableConnectionMonitoring) {
    connectionMonitor.stopMonitoring();
    logger.info('Connection monitoring stopped');
  }

  const closePromises: Promise<void>[] = [];

  if (writePool) {
    closePromises.push(
      writePool.end().then(() => {
        logger.info('Write pool closed');
        writePool = null;
      })
    );
  }

  if (readPool) {
    closePromises.push(
      readPool.end().then(() => {
        logger.info('Read pool closed');
        readPool = null;
      })
    );
  }

  await Promise.all(closePromises);
  logger.info('All database connection pools closed');
}

/**
 * Alias for closeDatabaseConnection for consistency
 */
export const closeConnection = closeDatabaseConnection;

/**
 * Get connection monitor instance for external access
 */
export function getConnectionMonitor(): ConnectionMonitor {
  return connectionMonitor;
}
