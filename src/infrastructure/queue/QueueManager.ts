/**
 * Queue Manager Implementation
 *
 * Central manager for all BullMQ queues providing initialization,
 * graceful shutdown, and lifecycle management.
 */

import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';
import { secureConfig } from '../../shared/utils/secureConfig.js';
import { QueueFactory } from './QueueFactory.js';
import { QueueMonitor } from './QueueMonitor.js';
import { QueueFactoryOptions, QueueStats } from './types.js';

/**
 * Queue Manager for centralized queue lifecycle management
 *
 * Handles initialization, monitoring, and graceful shutdown of all
 * BullMQ queues and workers in the application.
 */
export class QueueManager {
  private static instance: QueueManager;
  private queueFactory?: QueueFactory;
  private queueMonitor?: QueueMonitor;
  private isInitialized = false;
  private isShuttingDown = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Initialize queue infrastructure
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    try {
      logger.info('Initializing queue infrastructure...');

      // Create queue factory with configuration
      const factoryOptions: QueueFactoryOptions = {
        redis: {
          host: config.bullmq.redis.host,
          port: config.bullmq.redis.port,
          password: secureConfig.getBullMQRedisPassword(),
        },
        defaultOptions: {
          queue: {
            // Global queue defaults
          },
          worker: {
            // Global worker defaults
          },
          job: {
            // Global job defaults
          },
        },
      };

      this.queueFactory = QueueFactory.getInstance(factoryOptions);

      // Initialize queue monitor
      this.queueMonitor = new QueueMonitor(this.queueFactory, {
        maxWaitingJobs: 1000,
        maxFailedJobs: 100,
        maxStalledJobs: 10,
        maxProcessingTimeMs: 300000, // 5 minutes
        minSuccessRate: 0.95, // 95%
      });

      // Register event listeners for all queue types
      this.registerEventListeners();

      // Start monitoring
      this.queueMonitor.startMonitoring(60000); // Check every minute

      // Set up graceful shutdown handlers
      this.setupGracefulShutdown();

      this.isInitialized = true;
      logger.info('Queue infrastructure initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue infrastructure:', error);
      throw error;
    }
  }

  /**
   * Get queue factory instance
   */
  public getQueueFactory(): QueueFactory {
    if (!this.queueFactory) {
      throw new Error('Queue manager not initialized. Call initialize() first.');
    }
    return this.queueFactory;
  }

  /**
   * Get queue monitor instance
   */
  public getQueueMonitor(): QueueMonitor {
    if (!this.queueMonitor) {
      throw new Error('Queue manager not initialized. Call initialize() first.');
    }
    return this.queueMonitor;
  }

  /**
   * Get health status of all queues
   */
  public async getHealthStatus(): Promise<{
    healthy: boolean;
    queues: QueueStats[];
    alerts: any[];
    timestamp: Date;
  }> {
    if (!this.queueFactory || !this.queueMonitor) {
      return {
        healthy: false,
        queues: [],
        alerts: [{ message: 'Queue manager not initialized' }],
        timestamp: new Date(),
      };
    }

    try {
      const [queues, alerts] = await Promise.all([
        this.queueFactory.getAllQueueStats(),
        Promise.resolve(this.queueMonitor.getAlerts(10)),
      ]);

      // Determine overall health
      const healthy =
        alerts.filter((alert) => alert.severity === 'error' || alert.severity === 'critical')
          .length === 0;

      return {
        healthy,
        queues,
        alerts,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get queue health status:', error);
      return {
        healthy: false,
        queues: [],
        alerts: [
          {
            message: 'Health check failed',
            error: error instanceof Error ? error.message : String(error),
          },
        ],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Graceful shutdown of all queues and workers
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown of queue infrastructure...');

    try {
      // Stop monitoring first
      if (this.queueMonitor) {
        this.queueMonitor.stopMonitoring();
      }

      // Shutdown queue factory (closes all queues and workers)
      if (this.queueFactory) {
        await this.queueFactory.shutdown();
      }

      this.isInitialized = false;
      logger.info('Queue infrastructure shutdown completed');
    } catch (error) {
      logger.error('Error during queue infrastructure shutdown:', error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Register event listeners for monitoring
   */
  private registerEventListeners(): void {
    if (!this.queueFactory || !this.queueMonitor) {
      return;
    }

    // Register monitor as event listener for all queue types
    const queueTypes = [
      'videoProcessing',
      'emailSending',
      'certificateGeneration',
      'analyticsAggregation',
      'searchIndexing',
    ] as const;

    queueTypes.forEach((queueType) => {
      this.queueFactory!.registerEventListener(queueType, this.queueMonitor!);
    });

    logger.info('Registered event listeners for queue monitoring');
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);

      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });

    logger.info('Graceful shutdown handlers registered');
  }
}
