/**
 * Application Entry Point
 *
 * This file initializes and starts the Fastify server with all required plugins,
 * middleware, and module registrations.
 */

import { FastifyInstance } from 'fastify';

import { config, validateConfig } from './config/index.js';
import { createServer, startServer, stopServer } from './server.js';
import { logger } from './shared/utils/logger.js';

// Global server instance for graceful shutdown
let server: FastifyInstance | null = null;

/**
 * Bootstrap the application
 */
async function bootstrap(): Promise<void> {
  try {
    logger.info('Starting Learning Platform Backend...', {
      environment: config.nodeEnv,
      port: config.port,
    });

    // Initialize Sentry error tracking (must be first)
    const { sentryService } = await import('./shared/services/SentryService.js');
    sentryService.initialize();

    // Set up Sentry error handlers
    const { setupSentryErrorHandlers } = await import('./shared/middleware/sentryMiddleware.js');
    setupSentryErrorHandlers();

    // Initialize startup service (includes secrets management, config validation, etc.)
    const { startupService } = await import('./shared/services/StartupService.js');
    await startupService.initialize();

    // Create and configure Fastify server
    server = await createServer();

    // Initialize infrastructure (database, Redis, Elasticsearch)
    const { initializeInfrastructure } = await import('./infrastructure/index.js');
    await initializeInfrastructure();

    // Initialize CloudWatch integration
    if (config.nodeEnv === 'production') {
      const { CloudWatchInitializer } = await import('./shared/services/CloudWatchInitializer.js');
      await CloudWatchInitializer.initialize();
      logger.info('CloudWatch integration initialized successfully');
    }

    // Initialize unified scheduler service (includes analytics, session cleanup, log pruning)
    const { initializeSchedulerService } = await import('./shared/services/SchedulerService.js');
    const schedulerService = initializeSchedulerService({
      enabled: config.nodeEnv === 'production',
      timezone: 'UTC',
    });
    await schedulerService.initialize();
    logger.info('Unified scheduler service initialized successfully');

    // Register module routes
    const { registerModules } = await import('./modules/index.js');
    await registerModules(server);

    // TODO: Register GraphQL server

    // Start the server
    await startServer(server);

    logger.info('Server initialization complete');
  } catch (error) {
    logger.error('Failed to start server', {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
    });
    process.exit(1);
  }
}

/**
 * Gracefully shutdown the application
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} signal received: closing HTTP server`, { signal });

  if (server) {
    try {
      // Stop the server first
      await stopServer(server);

      // Shutdown unified scheduler service
      const { shutdownSchedulerService } = await import('./shared/services/SchedulerService.js');
      await shutdownSchedulerService();

      // Then shutdown infrastructure
      const { shutdownInfrastructure } = await import('./infrastructure/index.js');
      await shutdownInfrastructure();

      // Finally shutdown startup service
      const { startupService } = await import('./shared/services/StartupService.js');
      await startupService.shutdown();

      // Close Sentry and flush pending events
      const { sentryService } = await import('./shared/services/SentryService.js');
      await sentryService.close(2000);

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : String(error),
      });
      process.exit(1);
    }
  } else {
    process.exit(0);
  }
}

// Handle graceful shutdown signals
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Handle uncaught errors with comprehensive error handlers
import { handleUncaughtException, handleUnhandledRejection } from './shared/errors/index.js';

process.on('uncaughtException', (error) => {
  handleUncaughtException(error);
  void shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  handleUnhandledRejection(reason, promise);
  void shutdown('UNHANDLED_REJECTION');
});

// Start the application
void bootstrap();
