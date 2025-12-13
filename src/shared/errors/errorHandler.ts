/**
 * Global Error Handler for Fastify
 *
 * Implements comprehensive error handling with logging and sanitization
 * as per Requirements 13.1 and 17.2
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import { logger } from '../utils/logger.js';

import {
  AppError,
  RateLimitError,
  formatErrorResponse,
  getStatusCode,
  sanitizeError,
} from './index.js';

/**
 * Error context for logging
 */
interface ErrorContext {
  requestId: string;
  userId?: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  body?: unknown;
  query?: unknown;
  params?: unknown;
  error: {
    name: string;
    message: string;
    code?: string;
    statusCode?: number;
    stack?: string;
    isOperational?: boolean;
  };
}

/**
 * Sanitize request body for logging
 * Removes sensitive fields like passwords, tokens, etc.
 *
 * @param body - Request body to sanitize
 * @returns Sanitized body
 */
function sanitizeRequestBody(body: unknown): unknown {
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
 * Build error context for logging
 *
 * @param request - Fastify request
 * @param error - Error that occurred
 * @returns Error context object
 */
function buildErrorContext(request: FastifyRequest, error: Error | FastifyError): ErrorContext {
  const context: ErrorContext = {
    requestId: request.id,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };

  // Add user ID if authenticated
  const user = request.user as { id?: string } | undefined;
  if (user?.id) {
    context.userId = user.id;
  }

  // Add sanitized request data
  if (request.body) {
    context.body = sanitizeRequestBody(request.body);
  }

  if (Object.keys(request.query as object).length > 0) {
    context.query = request.query;
  }

  if (Object.keys(request.params as object).length > 0) {
    context.params = request.params;
  }

  // Add error-specific details
  if (error instanceof AppError) {
    context.error.code = error.code;
    context.error.statusCode = error.statusCode;
    context.error.isOperational = error.isOperational;
  } else if ('statusCode' in error) {
    context.error.statusCode = error.statusCode;
  }

  if ('code' in error && typeof error.code === 'string') {
    context.error.code = error.code;
  }

  return context;
}

/**
 * Determine if error should trigger an alert
 * Critical errors like database failures and payment errors should alert on-call
 *
 * @param error - Error to check
 * @returns True if error should trigger alert
 */
function shouldAlert(error: Error): boolean {
  if (!(error instanceof AppError)) {
    // Unknown errors should alert
    return true;
  }

  // Alert on non-operational errors
  if (!error.isOperational) {
    return true;
  }

  // Alert on specific error types
  const alertCodes = [
    'DATABASE_ERROR',
    'EXTERNAL_SERVICE_ERROR', // For payment processing
  ];

  return alertCodes.includes(error.code);
}

/**
 * Global error handler for Fastify
 * Handles all errors with proper logging, sanitization, and response formatting
 *
 * @param error - Error that occurred
 * @param request - Fastify request
 * @param reply - Fastify reply
 */
export async function errorHandler(
  error: Error | FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Build error context for logging
  const context = buildErrorContext(request, error);

  // Determine log level based on error severity
  const statusCode = getStatusCode(error);
  const isClientError = statusCode >= 400 && statusCode < 500;
  const isServerError = statusCode >= 500;

  // Log error with appropriate level using Winston
  if (isServerError) {
    logger.error('Server error occurred', context);

    // Trigger alert for critical errors
    if (shouldAlert(error)) {
      // TODO: Integrate with alerting system (PagerDuty, Slack, etc.)
      logger.error('CRITICAL ERROR - Alert triggered', { ...context, critical: true });
    }
  } else if (isClientError) {
    logger.warn('Client error occurred', context);
  } else {
    logger.info('Request error occurred', context);
  }

  // Determine if we're in development mode
  const isDevelopment = process.env['NODE_ENV'] === 'development';

  // Sanitize error for production
  const errorToFormat = isDevelopment ? error : sanitizeError(error);

  // Format error response
  const errorResponse = formatErrorResponse(errorToFormat, request.id, isDevelopment);

  // Add rate limit headers if this is a RateLimitError (Requirement 13.6)
  if (error instanceof RateLimitError) {
    const headers = error.getHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      void reply.header(key, value);
    });
  }

  // Send error response
  await reply.code(getStatusCode(error)).send(errorResponse);
}

/**
 * Handle uncaught exceptions
 * Logs the error and exits the process gracefully
 *
 * @param error - Uncaught exception
 */
export function handleUncaughtException(error: Error): void {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    critical: true,
  });

  // Give time for logging before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

/**
 * Handle unhandled promise rejections
 * Logs the error and exits the process gracefully
 *
 * @param reason - Rejection reason
 * @param promise - Promise that was rejected
 */
export function handleUnhandledRejection(reason: unknown, promise: Promise<unknown>): void {
  logger.error('UNHANDLED REJECTION! Shutting down...', {
    promise: String(promise),
    reason:
      reason instanceof Error
        ? {
            name: reason.name,
            message: reason.message,
            stack: reason.stack,
          }
        : String(reason),
    critical: true,
  });

  // Give time for logging before exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}
