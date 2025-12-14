/**
 * Request Tracing Middleware
 *
 * Integrates request tracing with Fastify request/response cycle.
 * Sets up trace context, generates request IDs, and tracks request flow.
 *
 * Requirements: 17.3
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { requestTracingService } from '../services/RequestTracingService.js';
import { FastifyRequestWithTracing } from '../types/fastify.js';
import { logger } from '../utils/logger.js';

/**
 * Register request tracing middleware
 */
export function registerRequestTracing(server: FastifyInstance): void {
  // Pre-handler to set up tracing context
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Create trace context
    const traceContext = requestTracingService.createTraceContext(request);

    // Set context in async local storage
    requestTracingService.setContext(traceContext);

    // Add trace headers to response
    const traceHeaders = requestTracingService.injectTraceHeaders(traceContext);
    Object.entries(traceHeaders).forEach(([key, value]) => {
      void reply.header(key, value);
    });

    // Store trace context in request for later use
    (request as FastifyRequestWithTracing).traceContext = traceContext;

    logger.debug('Request tracing context created', {
      requestId: traceContext.requestId,
      traceId: traceContext.traceId,
      spanId: traceContext.spanId,
      method: request.method,
      url: request.url,
    });
  });

  // Response handler to finish request span
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const traceContext = (request as FastifyRequestWithTracing).traceContext;
    if (!traceContext) return;

    // Finish the request span
    requestTracingService.addSpanTag(traceContext.spanId, 'http.status_code', reply.statusCode);
    requestTracingService.addSpanTag(
      traceContext.spanId,
      'http.response_size',
      reply.getResponseTime()
    );

    const status = reply.statusCode >= 400 ? 'error' : 'ok';
    requestTracingService.finishSpan(traceContext.spanId, status);

    // Finish the trace
    requestTracingService.finishTrace(traceContext.traceId);

    logger.debug('Request tracing completed', {
      requestId: traceContext.requestId,
      traceId: traceContext.traceId,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    });
  });

  // Error handler to mark span as error
  server.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    const traceContext = (request as FastifyRequestWithTracing).traceContext;
    if (!traceContext) return;

    // Add error information to span
    requestTracingService.addSpanTag(traceContext.spanId, 'error', true);
    requestTracingService.addSpanTag(traceContext.spanId, 'error.message', error.message);
    requestTracingService.addSpanTag(traceContext.spanId, 'error.name', error.name);

    requestTracingService.addSpanLog(
      traceContext.spanId,
      'error',
      `Request error: ${error.message}`,
      {
        errorName: error.name,
        errorStack: error.stack,
      }
    );
  });

  logger.info('Request tracing middleware registered');
}

/**
 * Get current request ID from trace context
 */
export function getCurrentRequestId(): string | undefined {
  const context = requestTracingService.getCurrentContext();
  return context?.requestId;
}

/**
 * Get current trace ID from trace context
 */
export function getCurrentTraceId(): string | undefined {
  const context = requestTracingService.getCurrentContext();
  return context?.traceId;
}

/**
 * Add metadata to current trace
 */
export function addTraceMetadata(key: string, value: unknown): void {
  const context = requestTracingService.getCurrentContext();
  if (context) {
    context.metadata[key] = value;
  }
}

/**
 * Create child span for operation tracking
 */
export function createChildSpan(operationName: string, tags?: Record<string, unknown>): {
  spanId: string;
  finish: (status?: 'ok' | 'error' | 'timeout', error?: Error) => void;
  addTag: (key: string, value: unknown) => void;
  addLog: (level: string, message: string, fields?: Record<string, unknown>) => void;
} {
  const span = requestTracingService.startSpan(operationName);

  if (tags) {
    Object.entries(tags).forEach(([key, value]) => {
      requestTracingService.addSpanTag(span.spanId, key, value);
    });
  }

  return {
    spanId: span.spanId,
    finish: (status?: 'ok' | 'error' | 'timeout', error?: Error): void => {
      requestTracingService.finishSpan(span.spanId, status, error);
    },
    addTag: (key: string, value: unknown): void => {
      requestTracingService.addSpanTag(span.spanId, key, value);
    },
    addLog: (level: string, message: string, fields?: Record<string, unknown>): void => {
      requestTracingService.addSpanLog(span.spanId, level, message, fields);
    },
  };
}

/**
 * Trace database operations
 */
export function traceDatabaseOperation<T>(
  operation: string,
  table: string,
  query: () => Promise<T>
): Promise<T> {
  const span = createChildSpan('database.query', {
    'db.operation': operation,
    'db.table': table,
  });

  return query()
    .then((result) => {
      span.addTag('db.rows_affected', Array.isArray(result) ? result.length : 1);
      span.finish('ok');
      return result;
    })
    .catch((error: unknown) => {
      span.addTag('error', true);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      span.addLog('error', `Database error: ${errorMessage}`, {
        errorName,
        operation,
        table,
      });
      span.finish('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    });
}

/**
 * Trace external service calls
 */
export function traceExternalService<T>(
  serviceName: string,
  operation: string,
  call: () => Promise<T>
): Promise<T> {
  const span = createChildSpan('external.service', {
    'service.name': serviceName,
    'service.operation': operation,
  });

  return call()
    .then((result) => {
      span.addTag('service.success', true);
      span.finish('ok');
      return result;
    })
    .catch((error: unknown) => {
      span.addTag('service.success', false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      span.addLog('error', `External service error: ${errorMessage}`, {
        errorName,
        serviceName,
        operation,
      });
      span.finish('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    });
}

/**
 * Trace cache operations
 */
export function traceCacheOperation<T>(
  operation: 'get' | 'set' | 'delete' | 'clear',
  key: string,
  cacheCall: () => Promise<T>
): Promise<T> {
  const span = createChildSpan('cache.operation', {
    'cache.operation': operation,
    'cache.key': key,
  });

  return cacheCall()
    .then((result) => {
      span.addTag('cache.hit', operation === 'get' && result !== null && result !== undefined);
      span.finish('ok');
      return result;
    })
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      span.addLog('error', `Cache error: ${errorMessage}`, {
        errorName,
        operation,
        key,
      });
      span.finish('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    });
}

/**
 * Enhanced logger that includes trace context
 */
export const tracedLogger = {
  debug: (message: string, meta?: Record<string, unknown>): void => {
    const context = requestTracingService.getCurrentContext();
    logger.debug(message, {
      ...meta,
      requestId: context?.requestId,
      traceId: context?.traceId,
    });
  },

  info: (message: string, meta?: Record<string, unknown>): void => {
    const context = requestTracingService.getCurrentContext();
    logger.info(message, {
      ...meta,
      requestId: context?.requestId,
      traceId: context?.traceId,
    });
  },

  warn: (message: string, meta?: Record<string, unknown>): void => {
    const context = requestTracingService.getCurrentContext();
    logger.warn(message, {
      ...meta,
      requestId: context?.requestId,
      traceId: context?.traceId,
    });
  },

  error: (message: string, meta?: Record<string, unknown>): void => {
    const context = requestTracingService.getCurrentContext();
    logger.error(message, {
      ...meta,
      requestId: context?.requestId,
      traceId: context?.traceId,
    });
  },
};
