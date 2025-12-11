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
    
    // Validate configuration
    validateConfig();
    
    // Create and configure Fastify server
    server = await createServer();
    
    // Register module routes
    const { registerModules } = await import('./modules/index.js');
    await registerModules(server);
    
    // TODO: Initialize database connection
    // TODO: Initialize Redis connection
    // TODO: Register GraphQL server
    
    // Start the server
    await startServer(server);
    
    logger.info('Server initialization complete');
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
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
      await stopServer(server);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : String(error),
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
