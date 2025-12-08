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

/**
 * Creates and configures a Fastify server instance
 */
export async function createServer(): Promise<FastifyInstance> {
  // Fastify server options
  const serverOptions: FastifyServerOptions = {
    logger: {
      level: config.logLevel,
      transport: config.nodeEnv === 'development' 
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              colorize: true,
            },
          }
        : undefined,
    },
    // Generate unique request ID for each request
    genReqId: () => randomUUID(),
    // Disable request logging by default (we'll add custom logging)
    disableRequestLogging: false,
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

  // Add request logging hook
  server.addHook('onRequest', async (request, _reply) => {
    request.log.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }, 'Incoming request');
  });

  // Add response logging hook
  server.addHook('onResponse', async (request, reply) => {
    request.log.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, 'Request completed');
  });

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
  server.setErrorHandler((error, request, reply) => {
    request.log.error({
      requestId: request.id,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
    }, 'Request error');

    // Don't leak error details in production
    const isDevelopment = config.nodeEnv === 'development';

    void reply.code(error.statusCode || 500).send({
      statusCode: error.statusCode || 500,
      error: error.name || 'Internal Server Error',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      requestId: request.id,
      ...(isDevelopment && { stack: error.stack }),
    });
  });

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

    server.log.info(
      `Server listening on ${config.host}:${config.port} in ${config.nodeEnv} mode`
    );
  } catch (error) {
    server.log.error(error, 'Failed to start server');
    throw error;
  }
}

/**
 * Gracefully shuts down the Fastify server
 */
export async function stopServer(server: FastifyInstance): Promise<void> {
  try {
    server.log.info('Shutting down server gracefully...');
    
    // Close the server (stops accepting new connections)
    await server.close();
    
    server.log.info('Server shut down successfully');
  } catch (error) {
    server.log.error(error, 'Error during server shutdown');
    throw error;
  }
}
