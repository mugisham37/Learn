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
import { registerGlobalRateLimit, registerAdaptiveRateLimit } from './shared/middleware/rateLimiting.js';
import { registerCSRFProtection } from './shared/middleware/csrf.js';
import { createSocketServer, closeSocketServer } from './infrastructure/websocket/index.js';

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });

  // Register Helmet for security headers
  await server.register(helmet, {
    // Content Security Policy - comprehensive policy for production
    contentSecurityPolicy: config.nodeEnv === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    } : false,
    
    // HTTP Strict Transport Security - enforce HTTPS for 1 year
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    
    // X-Content-Type-Options - prevent MIME type sniffing
    noSniff: true,
    
    // X-Frame-Options - prevent clickjacking attacks
    frameguard: {
      action: 'deny',
    },
    
    // X-XSS-Protection - enable XSS filtering
    xssFilter: true,
    
    // Additional security headers
    crossOriginEmbedderPolicy: config.nodeEnv === 'production',
    crossOriginOpenerPolicy: config.nodeEnv === 'production',
    crossOriginResourcePolicy: config.nodeEnv === 'production',
    
    // Referrer Policy - control referrer information
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  });

  // Register rate limiting middleware (before other middleware)
  await registerGlobalRateLimit(server);
  await registerAdaptiveRateLimit(server);

  // Register CSRF protection middleware
  await registerCSRFProtection(server);

  // Register compression middleware
  const { registerCompression } = await import('./shared/middleware/compression.js');
  await registerCompression(server, {
    threshold: 1024, // 1KB minimum
    level: 6, // Balanced compression
    preferBrotli: true,
  });

  // Register HTTP caching middleware
  const { registerHttpCaching } = await import('./shared/middleware/httpCaching.js');
  await registerHttpCaching(server);

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
  server.get('/health/deep', async (request, reply) => {
    try {
      const { performSystemHealthCheck } = await import('./shared/utils/health.js');
      const health = await performSystemHealthCheck();
      
      // Set appropriate HTTP status based on health
      const statusCode = health.status === 'healthy' ? 200 
        : health.status === 'degraded' ? 200 
        : 503;
      
      return reply.code(statusCode).send(health);
    } catch (error) {
      logger.error('Health check failed', { error });
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check system failure',
      });
    }
  });

  // Readiness probe endpoint (for Kubernetes)
  server.get('/health/ready', async (request, reply) => {
    try {
      const { checkReadiness } = await import('./shared/utils/health.js');
      const readiness = await checkReadiness();
      
      const statusCode = readiness.ready ? 200 : 503;
      return reply.code(statusCode).send(readiness);
    } catch (error) {
      logger.error('Readiness check failed', { error });
      return reply.code(503).send({
        ready: false,
        error: 'Readiness check system failure',
      });
    }
  });

  // Liveness probe endpoint (for Kubernetes)
  server.get('/health/live', async (request, reply) => {
    try {
      const { checkLiveness } = await import('./shared/utils/health.js');
      const liveness = await checkLiveness();
      
      const statusCode = liveness.alive ? 200 : 503;
      return reply.code(statusCode).send(liveness);
    } catch (error) {
      logger.error('Liveness check failed', { error });
      return reply.code(503).send({
        alive: false,
        error: 'Liveness check system failure',
      });
    }
  });

  // Root endpoint
  server.get('/', () => {
    return {
      name: 'Learning Platform API',
      version: '1.0.0',
      environment: config.nodeEnv,
      documentation: config.features.enableApiDocs ? '/docs' : undefined,
      graphql: {
        endpoint: '/graphql',
        playground: config.nodeEnv !== 'production' ? '/graphql' : undefined,
        introspection: config.nodeEnv !== 'production',
      },
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

  // Initialize Socket.io server for real-time communication
  await createSocketServer(server);
  logger.info('Socket.io server initialized successfully');

  // Register authentication REST routes
  const { registerAuthRoutes } = await import('./modules/users/presentation/rest/authController.js');
  const { AuthService } = await import('./modules/users/application/services/AuthService.js');
  const { UserRepository } = await import('./modules/users/infrastructure/repositories/UserRepository.js');
  
  // Create auth service instance
  const userRepository = new UserRepository();
  const authService = new AuthService(userRepository);
  
  // Register auth routes
  await registerAuthRoutes(server, authService);
  logger.info('Authentication REST routes registered successfully');

  // Register Apollo Server GraphQL plugin
  const { apolloServerPlugin } = await import('./infrastructure/graphql/index.js');
  await server.register(apolloServerPlugin, {
    path: '/graphql',
    cors: true,
  });
  logger.info('Apollo Server GraphQL endpoint registered successfully at /graphql');

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
    
    // Close Socket.io server first
    await closeSocketServer();
    
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
