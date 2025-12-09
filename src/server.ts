/**
 * Fastify Server Configuration
 * 
 * This module creates and configures the Fastify server instance with all
 * required plugins, middleware, and security settings.
 */

import { randomUUID } from 'crypto';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';

import { config } from './config/index.js';
import { logger } from './shared/utils/logger.js';
import { logRequest, logResponse } from './shared/middleware/index.js';

/**
 * Creates and configures a Fastify server instance
 */
export async function createServer(): Promise<FastifyInstance> {
  // Fastify server options
  const serverOptions: FastifyServerOptions = {
    // Disable Pino logger - we'll use Winston instead
    logger: false,
    // Generate unique request ID for each request
    genReqId: () => randomUUID(),
    // Disable request logging by default (we'll add custom logging with Winston)
    disableRequestLogging: true,
    // Trust proxy for proper IP detection behind load balancers
    trustProxy: config.nodeEnv === 'production',
    // Request timeout
    requestTimeout: 30000,
    // Body size limits
    bodyLimit: config.fileUpload.maxFileSizeMb * 1024 * 1024,
  };

  const server = Fastify(serverOptions);

  // Register CORS plugin
  await server.register(cors, {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });

  // Register Helmet for security headers
  await server.register(helmet, {
    contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: config.nodeEnv === 'production',
    crossOriginOpenerPolicy: config.nodeEnv === 'production',
    crossOriginResourcePolicy: config.nodeEnv === 'production',
  });

  // Add request logging hook using Winston
  server.addHook('onRequest', logRequest);

  // Add response logging hook using Winston
  server.addHook('onResponse', logResponse);

  // Health check endpoint
  server.get('/health', () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    };
  });

  // Deep health check endpoint (checks dependencies)
  server.get('/health/deep', () => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      checks: {
        database: 'not_implemented',
        redis: 'not_implemented',
      },
    };

    // TODO: Add actual health checks for database and redis
    return health;
  });

  // Root endpoint
  server.get('/', () => {
    return {
      name: 'Learning Platform API',
      version: '1.0.0',
      environment: config.nodeEnv,
      documentation: config.features.enableApiDocs ? '/docs' : undefined,
      graphql: '/graphql',
    };
  });

  // 404 handler
  server.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      requestId: request.id,
    });
  });

  // Global error handler
  // Import the comprehensive error handler
  const { errorHandler } = await import('./shared/errors/errorHandler.js');
  server.setErrorHandler(errorHandler);

  return server;
}

/**
 * Starts the Fastify server
 */
export async function startServer(server: FastifyInstance): Promise<void> {
  try {
    await server.listen({
      port: config.port,
      host: config.host,
    });

    logger.info(
      `Server listening on ${config.host}:${config.port} in ${config.nodeEnv} mode`,
      {
        host: config.host,
        port: config.port,
        environment: config.nodeEnv,
      }
    );
  } catch (error) {
    logger.error('Failed to start server', {
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
 * Gracefully shuts down the Fastify server
 */
export async function stopServer(server: FastifyInstance): Promise<void> {
  try {
    logger.info('Shutting down server gracefully...');
    
    // Close the server (stops accepting new connections)
    await server.close();
    
    logger.info('Server shut down successfully');
  } catch (error) {
    logger.error('Error during server shutdown', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    });
    throw error;
  }
}
