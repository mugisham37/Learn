/**
 * Server Startup Script
 * 
 * This script demonstrates starting the Fastify server and handling graceful shutdown.
 * Useful for testing and development purposes.
 */

import { FastifyInstance } from 'fastify';
import { config, validateConfig } from '../src/config/index.js';
import { createServer, startServer, stopServer } from '../src/server.js';

let server: FastifyInstance | null = null;

async function main(): Promise<void> {
  try {
    console.log('='.repeat(60));
    console.log('Starting Learning Platform Backend Server');
    console.log('='.repeat(60));
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Host: ${config.host}`);
    console.log(`Port: ${config.port}`);
    console.log('='.repeat(60));

    // Validate configuration
    validateConfig();
    console.log('✓ Configuration validated');

    // Create server
    server = await createServer();
    console.log('✓ Server instance created');

    // Start server
    await startServer(server);
    console.log('✓ Server started successfully');
    console.log('='.repeat(60));
    console.log(`Server is running at http://${config.host}:${config.port}`);
    console.log('Available endpoints:');
    console.log(`  - GET  http://${config.host}:${config.port}/`);
    console.log(`  - GET  http://${config.host}:${config.port}/health`);
    console.log(`  - GET  http://${config.host}:${config.port}/health/deep`);
    console.log('='.repeat(60));
    console.log('Press Ctrl+C to stop the server');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  if (server) {
    try {
      await stopServer(server);
      console.log('Server stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  } else {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Start the server
void main();
