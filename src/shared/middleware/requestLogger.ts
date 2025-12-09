/**
 * Request Logging Middleware
 * 
 * Implements comprehensive request/response logging with Winston
 * as per Requirements 17.3 and 17.4
 */

import { FastifyReply, FastifyRequest } from 'fastify';

import { logger } from '../utils/logger.js';

/**
 * Request context for logging
 */
interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  userId?: string;
  query?: unknown;
  params?: unknown;
  body?: unknown;
}

/**
 * Response context for logging
 */
interface ResponseContext extends RequestContext {
  statusCode: number;
  responseTime: number;
}

/**
 * Sanitize request body for logging
 * Removes sensitive fields
 * 
 * @param body - Request body
 * @returns Sanitized body
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'creditCard',
    'cvv',
    'ssn',
  ];

  const sanitized = { ...body } as Record<string, unknown>;

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Build request context for logging
 * 
 * @param request - Fastify request
 * @returns Request context
 */
function buildRequestContext(request: FastifyRequest): RequestContext {
  const context: RequestContext = {
    requestId: request.id,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  };

  // Add user ID if authenticated
  const user = request.user as { id?: string } | undefined;
  if (user?.id) {
    context.userId = user.id;
  }

  // Add query params if present
  if (request.query && Object.keys(request.query as object).length > 0) {
    context.query = request.query;
  }

  // Add route params if present
  if (request.params && Object.keys(request.params as object).length > 0) {
    context.params = request.params;
  }

  // Add sanitized body for POST/PUT/PATCH requests
  if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
    context.body = sanitizeBody(request.body);
  }

  return context;
}

/**
 * Build response context for logging
 * 
 * @param request - Fastify request
 * @param reply - Fastify reply
 * @returns Response context
 */
function buildResponseContext(
  request: FastifyRequest,
  reply: FastifyReply
): ResponseContext {
  const requestContext = buildRequestContext(request);
  
  return {
    ...requestContext,
    statusCode: reply.statusCode,
    responseTime: reply.elapsedTime,
  };
}

/**
 * Determine log level based on status code
 * 
 * @param statusCode - HTTP status code
 * @returns Log level
 */
function getLogLevel(statusCode: number): string {
  if (statusCode >= 500) {
    return 'error';
  } else if (statusCode >= 400) {
    return 'warn';
  } else if (statusCode >= 300) {
    return 'info';
  } else {
    return 'http';
  }
}

/**
 * Request logging hook for Fastify
 * Logs incoming requests with context
 * 
 * @param request - Fastify request
 */
export async function logRequest(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const context = buildRequestContext(request);
  
  logger.http('Incoming request', context);
}

/**
 * Response logging hook for Fastify
 * Logs completed requests with response details
 * 
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export async function logResponse(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const context = buildResponseContext(request, reply);
  const level = getLogLevel(reply.statusCode);
  
  logger.log(level, 'Request completed', context);
}

/**
 * Error logging function
 * Logs errors with full context
 * 
 * @param request - Fastify request
 * @param error - Error that occurred
 */
export function logError(
  request: FastifyRequest,
  error: Error
): void {
  const context = {
    ...buildRequestContext(request),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };
  
  logger.error('Request error', context);
}

