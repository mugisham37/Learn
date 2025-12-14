/**
 * Sentry Middleware for Fastify
 *
 * Integrates Sentry error tracking with Fastify request/response cycle.
 * Captures errors, sets request context, and tracks performance.
 *
 * Requirements: 17.2
 */

import * as Sentry from '@sentry/node';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { sentryService } from '../services/SentryService.js';
import { FastifyRequestWithSentry, isAuthenticatedRequest } from '../types/fastify.js';
import { logger } from '../utils/logger.js';

/**
 * Register Sentry middleware with Fastify
 */
export function registerSentryMiddleware(server: FastifyInstance): void {
  if (!sentryService.isEnabled()) {
    logger.info('Sentry middleware not registered (Sentry disabled)');
    return;
  }

  // Request handler to set up Sentry context
  server.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Start transaction for performance monitoring
    const transaction = sentryService.startTransaction(
      `${request.method} ${getRouteName(request.url)}`,
      'http.server'
    );

    // Store transaction in request context
    (request as FastifyRequestWithSentry).sentryTransaction = transaction as Sentry.Transaction;

    // Set request context
    sentryService.setRequestContext(request);

    // Add breadcrumb for request
    sentryService.addBreadcrumb(`${request.method} ${request.url}`, 'http', 'info', {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
  });

  // Response handler to finish transaction
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const transaction = (request as FastifyRequestWithSentry).sentryTransaction;

    if (transaction) {
      // Set response context
      transaction.setTag('http.status_code', reply.statusCode.toString());
      transaction.setTag('http.method', request.method);

      // Set status based on response code
      transaction.setTag('http.response.status_code', reply.statusCode.toString());

      // Finish transaction
      transaction.finish();
    }

    // Add response breadcrumb
    sentryService.addBreadcrumb(
      `Response ${reply.statusCode}`,
      'http',
      reply.statusCode >= 400 ? 'error' : 'info',
      {
        statusCode: reply.statusCode,
        responseTime: reply.getResponseTime(),
      }
    );
  });

  // Error handler to capture exceptions
  server.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const transaction = (request as FastifyRequestWithSentry).sentryTransaction;

    if (transaction) {
      transaction.setTag('error', 'true');
    }

    // Capture exception with context
    const eventId = sentryService.captureException(error, {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });

    // Add error breadcrumb
    sentryService.addBreadcrumb(`Error: ${error.message}`, 'error', 'error', {
      errorName: error.name,
      errorMessage: error.message,
      eventId,
    });

    logger.debug('Error captured by Sentry', { eventId, error: error.message });
  });

  logger.info('Sentry middleware registered successfully');
}

/**
 * Sentry error handler for uncaught exceptions
 */
export function setupSentryErrorHandlers(): void {
  if (!sentryService.isEnabled()) {
    return;
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    sentryService.captureException(error, {
      level: 'fatal',
      source: 'uncaughtException',
    });

    logger.error('Uncaught exception captured by Sentry', { error });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    sentryService.captureException(error, {
      level: 'error',
      source: 'unhandledRejection',
      promise: '[Promise object]',
    });

    logger.error('Unhandled rejection captured by Sentry', { reason });
  });

  logger.info('Sentry error handlers configured');
}

/**
 * Sentry context middleware for authenticated requests
 */
export function setSentryUserContext(request: FastifyRequest): void {
  if (!sentryService.isEnabled()) {
    return;
  }

  // Set user context if request is authenticated
  if (isAuthenticatedRequest(request)) {
    const user = request.user;

    sentryService.setUserContext({
      id: user.id,
      email: user.email,
      ip_address: request.ip,
    });

    // Add user breadcrumb
    sentryService.addBreadcrumb('User authenticated', 'auth', 'info', {
      userId: user.id,
      role: user.role,
    });
  }
}

/**
 * Capture business logic errors with context
 */
export function captureSentryError(
  error: Error,
  context: {
    operation?: string;
    module?: string;
    userId?: string;
    requestId?: string;
    [key: string]: unknown;
  }
): string {
  if (!sentryService.isEnabled()) {
    return '';
  }

  return Sentry.withScope((scope) => {
    // Set operation and module tags
    if (context.operation) {
      scope.setTag('operation', context.operation);
    }

    if (context.module) {
      scope.setTag('module', context.module);
    }

    // Set user context if available
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }

    // Add all context as extra data
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    // Set fingerprint for better error grouping
    scope.setFingerprint([error.name, context.operation || 'unknown', context.module || 'unknown']);

    return sentryService.captureException(error);
  });
}

/**
 * Track performance with Sentry
 */
export function trackSentryPerformance<T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  if (!sentryService.isEnabled()) {
    return operation();
  }

  const transaction = Sentry.startTransaction({ name: operationName, op: 'task' });

  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      transaction.setTag(key, String(value));
    });
  }

  return operation()
    .then((result) => {
      transaction.setTag('status', 'success');
      return result;
    })
    .catch((error: unknown) => {
      transaction.setTag('status', 'error');
      const errorToCapture = error instanceof Error ? error : new Error(String(error));
      sentryService.captureException(errorToCapture, { operation: operationName, ...context });
      throw error;
    })
    .finally(() => {
      transaction.finish();
    });
}

/**
 * Get route name for transaction naming
 */
function getRouteName(url: string): string {
  // Remove query parameters
  const path = url.split('?')[0] || url;

  // Replace dynamic segments with placeholders
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
    .replace(/\/\d+/g, '/:id') // Numeric IDs
    .replace(/\/[a-zA-Z0-9-_]+\.(jpg|jpeg|png|gif|pdf|mp4|webm)/gi, '/:file') || // Files
    '/';
}

/**
 * Sentry breadcrumb helpers
 */
export const sentryBreadcrumbs = {
  /**
   * Add database operation breadcrumb
   */
  database: (operation: string, table: string, duration?: number): void => {
    sentryService.addBreadcrumb(`Database ${operation}`, 'database', 'info', {
      operation,
      table,
      duration,
    });
  },

  /**
   * Add cache operation breadcrumb
   */
  cache: (operation: 'hit' | 'miss' | 'set' | 'delete', key: string, cacheType?: string): void => {
    sentryService.addBreadcrumb(`Cache ${operation}`, 'cache', 'info', {
      operation,
      key,
      cacheType,
    });
  },

  /**
   * Add external service call breadcrumb
   */
  externalService: (service: string, operation: string, duration?: number, success?: boolean): void => {
    sentryService.addBreadcrumb(
      `External service: ${service}`,
      'http',
      success === false ? 'error' : 'info',
      { service, operation, duration, success }
    );
  },

  /**
   * Add business logic breadcrumb
   */
  business: (action: string, module: string, data?: Record<string, unknown>): void => {
    sentryService.addBreadcrumb(action, 'business', 'info', { module, ...(data || {}) });
  },
};
