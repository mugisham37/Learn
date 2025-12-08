/**
 * Application Entry Point
 * 
 * This file initializes and starts the Fastify server with all required plugins,
 * middleware, and module registrations.
 */

import { FastifyInstance } from 'fastify';

import { config, validateConfig } from './config/index.js';
import { createServer, startServer, stopServer } from './server.js';

// Global server instance for graceful shutdown
let server: FastifyInstance | null = null;

/**
 * Bootstrap the application
 */
async function bootstrap(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log('Starting Learning Platform Backend...');
    // eslint-disable-next-line no-console
    console.log(`Environment: ${config.nodeEnv}`);
    // eslint-disable-next-line no-console
    console.log(`Port: ${config.port}`);
    
    // Validate configuration
    validateConfig();
    
    // Create and configure Fastify server
    server = await createServer();
    
    // TODO: Register module routes
    // TODO: Initialize database connection
    // TODO: Initialize Redis connection
    // TODO: Register GraphQL server
    
    // Start the server
    await startServer(server);
    
    // eslint-disable-next-line no-console
    console.log('Server initialization complete');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Gracefully shutdown the application
 */
async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`${signal} signal received: closing HTTP server`);
  
  if (server) {
    try {
      await stopServer(server);
      // eslint-disable-next-line no-console
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  } else {
    process.exit(0);
  }
}

// Handle graceful shutdown signals
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught Exception:', error);
  void shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  void shutdown('UNHANDLED_REJECTION');
});

// Start the application
void bootstrap();
