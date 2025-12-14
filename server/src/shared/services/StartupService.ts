/**
 * Startup Service
 *
 * Handles application startup sequence including:
 * - Secrets manager initialization
 * - Configuration validation
 * - Database connection
 * - Cache initialization
 * - Health checks
 *
 * Requirements: 13.7, 16.5, 17.1
 */

import { validateConfig } from '../../config/index.js';
import { logger } from '../utils/logger.js';

import { secretsManager } from './SecretsManager.js';

/**
 * Startup configuration options
 */
export interface StartupOptions {
  /** Skip secrets manager initialization (for testing) */
  skipSecretsManager?: boolean;
  /** Skip database connection (for testing) */
  skipDatabase?: boolean;
  /** Skip cache initialization (for testing) */
  skipCache?: boolean;
  /** Timeout for startup operations in milliseconds */
  timeout?: number;
}

/**
 * Startup Service
 */
export class StartupService {
  private static instance: StartupService;
  private isInitialized = false;
  private startupTime?: Date;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): StartupService {
    if (!StartupService.instance) {
      StartupService.instance = new StartupService();
    }
    return StartupService.instance;
  }

  /**
   * Initialize the application
   */
  public async initialize(options: StartupOptions = {}): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Application already initialized');
      return;
    }

    const startTime = Date.now();
    this.startupTime = new Date();

    logger.info('Starting application initialization', {
      nodeEnv: process.env['NODE_ENV'],
      timestamp: this.startupTime.toISOString(),
    });

    try {
      // Step 1: Basic configuration validation
      this.validateBasicConfig();

      // Step 2: Initialize secrets manager
      if (!options.skipSecretsManager) {
        await this.initializeSecretsManager();
      }

      // Step 3: Validate all secrets
      if (!options.skipSecretsManager) {
        this.validateSecrets();
      }

      // Step 4: Initialize database connection
      if (!options.skipDatabase) {
        await this.initializeDatabase();
      }

      // Step 5: Initialize cache
      if (!options.skipCache) {
        await this.initializeCache();
      }

      // Step 6: Run health checks
      await this.runHealthChecks(options);

      const duration = Date.now() - startTime;
      this.isInitialized = true;

      logger.info('Application initialization completed successfully', {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Application initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Validate basic configuration
   */
  private validateBasicConfig(): void {
    logger.info('Validating basic configuration');

    try {
      validateConfig();
      logger.info('Basic configuration validation completed');
    } catch (error) {
      logger.error('Basic configuration validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initialize secrets manager
   */
  private async initializeSecretsManager(): Promise<void> {
    logger.info('Initializing secrets manager');

    try {
      await secretsManager.initialize();
      logger.info('Secrets manager initialization completed');
    } catch (error) {
      logger.error('Secrets manager initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validate all secrets
   */
  private validateSecrets(): void {
    logger.info('Validating secrets');

    try {
      secretsManager.validateSecrets();
      logger.info('Secrets validation completed');
    } catch (error) {
      logger.error('Secrets validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    logger.info('Initializing database connection');

    try {
      // Import database module dynamically to avoid circular dependencies
      const { testConnection } = await import('../../infrastructure/database/index.js');
      const isHealthy = await testConnection();
      if (!isHealthy) {
        throw new Error('Database connection test failed');
      }
      logger.info('Database connection initialization completed');
    } catch (error) {
      logger.error('Database connection initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initialize cache
   */
  private async initializeCache(): Promise<void> {
    logger.info('Initializing cache connection');

    try {
      // Import cache module dynamically to avoid circular dependencies
      const { checkRedisHealth } = await import('../../infrastructure/cache/index.js');
      const health = await checkRedisHealth();

      if (!health.healthy) {
        throw new Error(`Cache health check failed: ${health.error}`);
      }

      logger.info('Cache connection initialization completed');

      // Initialize comprehensive caching with cache warming
      logger.info('Starting cache warming');
      try {
        const { initializeComprehensiveCaching } = await import('./ComprehensiveCacheService.js');
        await initializeComprehensiveCaching();
        logger.info('Cache warming completed successfully');
      } catch (error) {
        // Don't fail startup if cache warming fails
        logger.warn('Cache warming failed, continuing startup', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } catch (error) {
      logger.error('Cache connection initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(options: StartupOptions): Promise<void> {
    logger.info('Running startup health checks');

    const healthChecks: Array<{ name: string; check: () => Promise<boolean> }> = [];

    // Secrets manager health check
    if (!options.skipSecretsManager) {
      healthChecks.push({
        name: 'secrets-manager',
        check: () => secretsManager.healthCheck(),
      });
    }

    // Database health check
    if (!options.skipDatabase) {
      healthChecks.push({
        name: 'database',
        check: async () => {
          try {
            const { testConnection } = await import('../../infrastructure/database/index.js');
            return await testConnection();
          } catch {
            return false;
          }
        },
      });
    }

    // Cache health check
    if (!options.skipCache) {
      healthChecks.push({
        name: 'cache',
        check: async () => {
          try {
            const { testConnection } = await import('../../infrastructure/cache/index.js');
            return await testConnection();
          } catch {
            return false;
          }
        },
      });
    }

    // Analytics queue health check (if initialized)
    healthChecks.push({
      name: 'analytics-queue',
      check: async () => {
        try {
          const { getAnalyticsQueue } = await import('./AnalyticsQueue.js');
          const analyticsQueue = getAnalyticsQueue();
          return await analyticsQueue.healthCheck();
        } catch {
          // Analytics queue might not be initialized yet during startup
          return true;
        }
      },
    });

    // Run all health checks
    const results = await Promise.allSettled(
      healthChecks.map(async ({ name, check }) => {
        try {
          const result = await check();
          return { name, success: result };
        } catch (error) {
          return {
            name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Process results
    const failedChecks: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { name, success, error } = result.value;
        if (success) {
          logger.info(`Health check passed: ${name}`);
        } else {
          logger.error(`Health check failed: ${name}`, { error });
          failedChecks.push(name);
        }
      } else {
        const healthCheck = healthChecks[index];
        if (healthCheck) {
          const name = healthCheck.name;
          logger.error(`Health check error: ${name}`, {
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          });
          failedChecks.push(name);
        }
      }
    });

    if (failedChecks.length > 0) {
      throw new Error(`Health checks failed: ${failedChecks.join(', ')}`);
    }

    logger.info('All startup health checks passed');
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Application not initialized, skipping shutdown');
      return;
    }

    logger.info('Starting graceful shutdown');
    const startTime = Date.now();

    try {
      // Close database connections
      try {
        const { closeConnection } = await import('../../infrastructure/database/index.js');
        await closeConnection();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error('Error closing database connections', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Close cache connections
      try {
        const { closeConnection } = await import('../../infrastructure/cache/index.js');
        await closeConnection();
        logger.info('Cache connections closed');
      } catch (error) {
        logger.error('Error closing cache connections', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Shutdown analytics scheduler and queue
      try {
        const { shutdownAnalyticsScheduler } = await import('./AnalyticsScheduler.js');
        await shutdownAnalyticsScheduler();
        logger.info('Analytics scheduler and queue shutdown completed');
      } catch (error) {
        logger.error('Error shutting down analytics scheduler', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      const duration = Date.now() - startTime;
      this.isInitialized = false;

      logger.info('Graceful shutdown completed', {
        duration: `${duration}ms`,
      });
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get startup information
   */
  public getStartupInfo(): { initialized: boolean; startupTime?: Date } {
    return {
      initialized: this.isInitialized,
      startupTime: this.startupTime,
    };
  }

  /**
   * Check if application is ready
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

/**
 * Global startup service instance
 */
export const startupService = StartupService.getInstance();
