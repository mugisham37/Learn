/**
 * Database Connection and Configuration
 * 
 * Manages PostgreSQL connection using Drizzle ORM with connection pooling,
 * retry logic, separate read/write pools, and transaction management.
 * 
 * Requirements: 15.7, 16.3
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient, PoolConfig } from 'pg';

import { config } from '../../config/index.js';

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
      
      console.log(`${poolName} connection pool established successfully`);
      return pool;
    } catch (error) {
      const isLastAttempt = attempt === RETRY_CONFIG.maxRetries - 1;
      
      if (isLastAttempt) {
        console.error(`${poolName} connection failed after ${RETRY_CONFIG.maxRetries} attempts:`, error);
        await pool.end();
        throw new Error(`Failed to establish ${poolName} connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      const delay = calculateBackoffDelay(attempt);
      console.warn(
        `${poolName} connection attempt ${attempt + 1} failed. Retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );
      
      await sleep(delay);
    }
  }

  throw new Error(`Failed to establish ${poolName} connection`);
}

/**
 * Base pool configuration
 */
const basePoolConfig: PoolConfig = {
  connectionString: config.database.url,
  min: config.database.poolMin,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Enable keep-alive for long-running connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
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
 * Initialize database connection pools
 */
export async function initializeDatabasePools(): Promise<void> {
  console.log('Initializing database connection pools...');

  // Create write pool
  writePool = await createPoolWithRetry(
    {
      ...basePoolConfig,
      // Write pool gets slightly higher max connections
      max: Math.ceil(config.database.poolMax * 0.6),
    },
    'Write pool'
  );

  // Create read pool
  // In production, this could point to a read replica
  const readPoolConfig = {
    ...basePoolConfig,
    // Read pool gets remaining connections
    max: Math.floor(config.database.poolMax * 0.4),
    // Read operations can have slightly longer timeout
    connectionTimeoutMillis: 15000,
  };

  readPool = await createPoolWithRetry(readPoolConfig, 'Read pool');

  // Set up error handlers
  writePool.on('error', (err) => {
    console.error('Unexpected error on write pool idle client', err);
  });

  readPool.on('error', (err) => {
    console.error('Unexpected error on read pool idle client', err);
  });

  console.log('Database connection pools initialized successfully');
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
  get(_target, prop) {
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
    console.error('Transaction rolled back due to error:', error);
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
    console.error('Drizzle transaction rolled back due to error:', error);
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
    console.log('Database connection successful');
  } else {
    console.error('Database connection failed:', health.error);
  }
  return health.healthy;
}

/**
 * Closes all database connection pools gracefully
 */
export async function closeDatabaseConnection(): Promise<void> {
  console.log('Closing database connection pools...');

  const closePromises: Promise<void>[] = [];

  if (writePool) {
    closePromises.push(
      writePool.end().then(() => {
        console.log('Write pool closed');
        writePool = null;
      })
    );
  }

  if (readPool) {
    closePromises.push(
      readPool.end().then(() => {
        console.log('Read pool closed');
        readPool = null;
      })
    );
  }

  await Promise.all(closePromises);
  console.log('All database connection pools closed');
}
