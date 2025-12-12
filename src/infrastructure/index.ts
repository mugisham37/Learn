/**
 * Infrastructure Initialization
 * 
 * Centralized initialization of all infrastructure components including
 * database, Redis, Elasticsearch, and BullMQ queues with proper error handling and retry logic.
 * 
 * Requirements: 15.7, 16.3, 8.1, 14.1
 */

import { logger } from '../shared/utils/logger.js';

/**
 * Initialize all infrastructure components
 * This should be called during application startup
 */
export async function initializeInfrastructure(): Promise<void> {
  logger.info('Initializing infrastructure components...');

  try {
    // Initialize database connection pools
    logger.info('Initializing database connection pools...');
    const { initializeDatabasePools } = await import('./database/index.js');
    await initializeDatabasePools();
    logger.info('✓ Database connection pools initialized');

    // Test Redis connections
    logger.info('Testing Redis connections...');
    const { checkRedisHealth, checkSessionRedisHealth } = await import('./cache/index.js');
    
    const redisHealth = await checkRedisHealth();
    if (!redisHealth.healthy) {
      throw new Error(`Redis connection failed: ${redisHealth.error}`);
    }
    logger.info('✓ Redis connection established');

    const sessionRedisHealth = await checkSessionRedisHealth();
    if (!sessionRedisHealth.healthy) {
      throw new Error(`Session Redis connection failed: ${sessionRedisHealth.error}`);
    }
    logger.info('✓ Session Redis connection established');

    // Initialize Elasticsearch indices
    logger.info('Initializing Elasticsearch indices...');
    const { initializeElasticsearchIndices, checkElasticsearchHealth } = await import('./search/index.js');
    
    // First check if Elasticsearch is available
    const elasticsearchHealth = await checkElasticsearchHealth();
    if (!elasticsearchHealth.healthy) {
      logger.warn(`Elasticsearch connection failed: ${elasticsearchHealth.error}`);
      logger.warn('Continuing without Elasticsearch - search functionality will be limited');
    } else {
      await initializeElasticsearchIndices();
      logger.info('✓ Elasticsearch indices initialized');
    }

    // Initialize BullMQ queue infrastructure
    logger.info('Initializing BullMQ queue infrastructure...');
    const { QueueManager } = await import('./queue/index.js');
    const queueManager = QueueManager.getInstance();
    await queueManager.initialize();
    logger.info('✓ BullMQ queue infrastructure initialized');

    logger.info('All infrastructure components initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize infrastructure', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    });
    throw error;
  }
}

/**
 * Gracefully shutdown all infrastructure components
 * This should be called during application shutdown
 */
export async function shutdownInfrastructure(): Promise<void> {
  logger.info('Shutting down infrastructure components...');

  const shutdownPromises: Promise<void>[] = [];

  // Close database connections
  try {
    const { closeDatabaseConnection } = await import('./database/index.js');
    shutdownPromises.push(
      closeDatabaseConnection().then(() => {
        logger.info('✓ Database connections closed');
      }).catch((error) => {
        logger.error('Error closing database connections', { error });
      })
    );
  } catch (error) {
    logger.error('Error importing database module for shutdown', { error });
  }

  // Close Redis connections
  try {
    const { closeRedisConnections } = await import('./cache/index.js');
    shutdownPromises.push(
      closeRedisConnections().then(() => {
        logger.info('✓ Redis connections closed');
      }).catch((error) => {
        logger.error('Error closing Redis connections', { error });
      })
    );
  } catch (error) {
    logger.error('Error importing cache module for shutdown', { error });
  }

  // Close Elasticsearch connection
  try {
    const { closeElasticsearchConnection } = await import('./search/index.js');
    shutdownPromises.push(
      closeElasticsearchConnection().then(() => {
        logger.info('✓ Elasticsearch connection closed');
      }).catch((error) => {
        logger.error('Error closing Elasticsearch connection', { error });
      })
    );
  } catch (error) {
    logger.error('Error importing search module for shutdown', { error });
  }

  // Shutdown BullMQ queue infrastructure
  try {
    const { QueueManager } = await import('./queue/index.js');
    const queueManager = QueueManager.getInstance();
    shutdownPromises.push(
      queueManager.shutdown().then(() => {
        logger.info('✓ BullMQ queue infrastructure shutdown');
      }).catch((error) => {
        logger.error('Error shutting down queue infrastructure', { error });
      })
    );
  } catch (error) {
    logger.error('Error importing queue module for shutdown', { error });
  }

  // Wait for all shutdown operations to complete
  await Promise.allSettled(shutdownPromises);
  logger.info('Infrastructure shutdown completed');
}

/**
 * Perform infrastructure health checks
 * Returns overall health status and individual component status
 */
export async function checkInfrastructureHealth(): Promise<{
  healthy: boolean;
  components: {
    database: boolean;
    redis: boolean;
    sessionRedis: boolean;
    elasticsearch: boolean;
    queues: boolean;
  };
  errors: string[];
}> {
  const errors: string[] = [];
  const components = {
    database: false,
    redis: false,
    sessionRedis: false,
    elasticsearch: false,
    queues: false,
  };

  // Check database health
  try {
    const { checkDatabaseHealth } = await import('./database/index.js');
    const dbHealth = await checkDatabaseHealth();
    components.database = dbHealth.healthy;
    if (!dbHealth.healthy && dbHealth.error) {
      errors.push(`Database: ${dbHealth.error}`);
    }
  } catch (error) {
    errors.push(`Database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check Redis health
  try {
    const { checkRedisHealth } = await import('./cache/index.js');
    const redisHealth = await checkRedisHealth();
    components.redis = redisHealth.healthy;
    if (!redisHealth.healthy && redisHealth.error) {
      errors.push(`Redis: ${redisHealth.error}`);
    }
  } catch (error) {
    errors.push(`Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check session Redis health
  try {
    const { checkSessionRedisHealth } = await import('./cache/index.js');
    const sessionRedisHealth = await checkSessionRedisHealth();
    components.sessionRedis = sessionRedisHealth.healthy;
    if (!sessionRedisHealth.healthy && sessionRedisHealth.error) {
      errors.push(`Session Redis: ${sessionRedisHealth.error}`);
    }
  } catch (error) {
    errors.push(`Session Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check Elasticsearch health
  try {
    const { checkElasticsearchHealth } = await import('./search/index.js');
    const elasticsearchHealth = await checkElasticsearchHealth();
    components.elasticsearch = elasticsearchHealth.healthy;
    if (!elasticsearchHealth.healthy && elasticsearchHealth.error) {
      errors.push(`Elasticsearch: ${elasticsearchHealth.error}`);
    }
  } catch (error) {
    errors.push(`Elasticsearch: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check BullMQ queue health
  try {
    const { QueueManager } = await import('./queue/index.js');
    const queueManager = QueueManager.getInstance();
    const queueHealth = await queueManager.getHealthStatus();
    components.queues = queueHealth.healthy;
    if (!queueHealth.healthy) {
      errors.push(`Queues: ${queueHealth.alerts.map(a => a.message).join(', ')}`);
    }
  } catch (error) {
    errors.push(`Queues: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Overall health is true if critical components (database, redis, queues) are healthy
  // Elasticsearch is not critical for basic functionality
  const healthy = components.database && components.redis && components.queues;

  return {
    healthy,
    components,
    errors,
  };
}