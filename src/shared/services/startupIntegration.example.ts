/**
 * Analytics Scheduler Integration Example
 * 
 * This file shows how to integrate the analytics scheduler into the main application
 * startup process. Add this code to your main application initialization.
 * 
 * Requirements:
 * - 12.5: Scheduled analytics aggregation
 * - 14.3: Analytics aggregation queue setup
 */

import { logger } from '../utils/logger.js';
import { initializeAnalytics, getDefaultSchedulerConfig } from './initializeAnalytics.js';
import { shutdownAnalyticsScheduler } from './AnalyticsScheduler.js';

/**
 * Example: Add this to your application startup (e.g., in src/index.ts)
 */
export async function initializeAnalyticsInApp(): Promise<void> {
  try {
    // Get environment-specific configuration
    const environment = (process.env['NODE_ENV'] as 'development' | 'staging' | 'production') || 'development';
    const schedulerConfig = getDefaultSchedulerConfig(environment);

    // Initialize analytics services and scheduler
    await initializeAnalytics(schedulerConfig);

    logger.info('Analytics scheduler integrated successfully', {
      environment,
      config: schedulerConfig,
    });
  } catch (error) {
    logger.error('Failed to initialize analytics scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Example: Add this to your application shutdown (e.g., in src/index.ts shutdown function)
 */
export async function shutdownAnalyticsInApp(): Promise<void> {
  try {
    await shutdownAnalyticsScheduler();
    logger.info('Analytics scheduler shutdown completed');
  } catch (error) {
    logger.error('Failed to shutdown analytics scheduler', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw during shutdown - log and continue
  }
}

/**
 * Example integration in src/index.ts:
 * 
 * ```typescript
 * // In the bootstrap function, after server creation:
 * 
 * // Create and configure Fastify server
 * server = await createServer();
 * 
 * // Register module routes
 * const { registerModules } = await import('./modules/index.js');
 * await registerModules(server);
 * 
 * // Initialize database connection
 * // ... existing database initialization
 * 
 * // Initialize Redis connection
 * // ... existing Redis initialization
 * 
 * // Initialize analytics scheduler (ADD THIS)
 * await initializeAnalyticsInApp();
 * 
 * // Register GraphQL server
 * // ... existing GraphQL initialization
 * 
 * // Start the server
 * await startServer(server);
 * ```
 * 
 * ```typescript
 * // In the shutdown function, before server shutdown:
 * 
 * async function shutdown(signal: string): Promise<void> {
 *   logger.info(`${signal} signal received: closing HTTP server`, { signal });
 *   
 *   if (server) {
 *     try {
 *       // Shutdown analytics scheduler (ADD THIS)
 *       await shutdownAnalyticsInApp();
 *       
 *       // Shutdown server
 *       await stopServer(server);
 *       
 *       logger.info('Graceful shutdown completed');
 *       process.exit(0);
 *     } catch (error) {
 *       // ... existing error handling
 *     }
 *   }
 * }
 * ```
 */