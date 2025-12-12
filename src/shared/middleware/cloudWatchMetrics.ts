/**
 * CloudWatch Metrics Middleware
 * 
 * Integrates CloudWatch metrics collection with Fastify request/response cycle.
 * Records response times, throughput, error rates, and other KPIs.
 * 
 * Requirements: 17.6
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { metrics } from '../services/CloudWatchService.js';
import { applicationMetricsService } from '../services/ApplicationMetricsService.js';
import { logger } from '../utils/logger.js';

/**
 * Request timing data stored in request context
 */
interface RequestTiming {
  startTime: number;
  endpoint: string;
  method: string;
}

/**
 * CloudWatch metrics middleware for Fastify
 */
export function registerCloudWatchMetrics(server: any): void {
  // Pre-handler hook to record request start time
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const timing: RequestTiming = {
      startTime: Date.now(),
      endpoint: getEndpointName(request.url),
      method: request.method,
    };
    
    // Store timing data in request context
    (request as any).cloudWatchTiming = timing;
    
    // Record throughput (incoming request)
    try {
      await metrics.throughput(timing.endpoint, timing.method, 1);
      applicationMetricsService.recordRequest(timing.endpoint, timing.method);
    } catch (error) {
      logger.debug('Failed to record throughput metric', { error });
    }
  });

  // On-response hook to record response metrics
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const timing = (request as any).cloudWatchTiming as RequestTiming;
    
    if (!timing) {
      return;
    }

    const responseTime = Date.now() - timing.startTime;
    const statusCode = reply.statusCode;

    try {
      // Record response time
      await metrics.responseTime(timing.endpoint, timing.method, responseTime);
      applicationMetricsService.recordResponseTime(timing.endpoint, timing.method, responseTime);

      // Record error rate if status code indicates error
      if (statusCode >= 400) {
        const errorType = getErrorType(statusCode);
        await metrics.error(timing.endpoint, timing.method, errorType);
        applicationMetricsService.recordError(timing.endpoint, timing.method, errorType);
      }
    } catch (error) {
      logger.debug('Failed to record response metrics', { error });
    }
  });

  // On-error hook to record error metrics
  server.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const timing = (request as any).cloudWatchTiming as RequestTiming;
    
    if (!timing) {
      return;
    }

    try {
      // Record error with error type
      const errorType = getErrorTypeFromError(error);
      await metrics.error(timing.endpoint, timing.method, errorType);
      applicationMetricsService.recordError(timing.endpoint, timing.method, errorType);
    } catch (metricError) {
      logger.debug('Failed to record error metric', { error: metricError });
    }
  });

  logger.info('CloudWatch metrics middleware registered');
}

/**
 * Extract endpoint name from URL for metrics grouping
 */
function getEndpointName(url: string): string {
  // Remove query parameters
  const path = url.split('?')[0];
  
  // Replace dynamic segments with placeholders for better grouping
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
    .replace(/\/\d+/g, '/:id') // Numeric IDs
    .replace(/\/[a-zA-Z0-9-_]+\.(jpg|jpeg|png|gif|pdf|mp4|webm)/gi, '/:file') // File extensions
    || '/';
}

/**
 * Get error type from HTTP status code
 */
function getErrorType(statusCode: number): string {
  if (statusCode >= 400 && statusCode < 500) {
    switch (statusCode) {
      case 400: return 'BadRequest';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'NotFound';
      case 409: return 'Conflict';
      case 422: return 'ValidationError';
      case 429: return 'RateLimited';
      default: return 'ClientError';
    }
  } else if (statusCode >= 500) {
    switch (statusCode) {
      case 500: return 'InternalServerError';
      case 502: return 'BadGateway';
      case 503: return 'ServiceUnavailable';
      case 504: return 'GatewayTimeout';
      default: return 'ServerError';
    }
  }
  
  return 'UnknownError';
}

/**
 * Get error type from Error object
 */
function getErrorTypeFromError(error: Error): string {
  // Map common error types to CloudWatch metric names
  const errorName = error.name || 'Error';
  
  switch (errorName) {
    case 'ValidationError':
      return 'ValidationError';
    case 'AuthenticationError':
      return 'AuthenticationError';
    case 'AuthorizationError':
      return 'AuthorizationError';
    case 'NotFoundError':
      return 'NotFoundError';
    case 'ConflictError':
      return 'ConflictError';
    case 'DatabaseError':
      return 'DatabaseError';
    case 'ExternalServiceError':
      return 'ExternalServiceError';
    case 'TimeoutError':
      return 'TimeoutError';
    default:
      return 'ApplicationError';
  }
}

/**
 * Database query metrics decorator
 * Use this to wrap database operations and record query performance
 */
export function recordDatabaseMetrics<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  table: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      // Record successful query time
      await metrics.dbQuery(operation, table, duration);
      applicationMetricsService.recordDatabaseQuery(operation, table, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed query time
      await metrics.dbQuery(`${operation}_failed`, table, duration);
      applicationMetricsService.recordDatabaseQuery(`${operation}_failed`, table, duration);
      
      throw error;
    }
  }) as T;
}

/**
 * Cache metrics helper
 * Use this to record cache hit/miss rates
 */
export async function recordCacheMetrics(
  cacheType: string,
  operation: 'hit' | 'miss' | 'set' | 'delete',
  key?: string
): Promise<void> {
  try {
    switch (operation) {
      case 'hit':
        await metrics.cache(cacheType, 1, 0);
        applicationMetricsService.recordCacheHit(cacheType);
        break;
      case 'miss':
        await metrics.cache(cacheType, 0, 1);
        applicationMetricsService.recordCacheMiss(cacheType);
        break;
      case 'set':
      case 'delete':
        // These operations don't affect hit/miss rates directly
        // but we can track them as separate metrics if needed
        break;
    }
  } catch (error) {
    logger.debug('Failed to record cache metrics', { error, cacheType, operation });
  }
}

/**
 * External service metrics helper
 * Use this to record external service call performance
 */
export async function recordExternalServiceMetrics(
  serviceName: string,
  operation: string,
  duration: number,
  success: boolean
): Promise<void> {
  try {
    const metricName = success ? 'ExternalServiceSuccess' : 'ExternalServiceError';
    
    await metrics.responseTime(`external/${serviceName}`, operation, duration);
    applicationMetricsService.recordExternalServiceCall(serviceName, operation, duration, success);
    
    if (!success) {
      await metrics.error(`external/${serviceName}`, operation, 'ExternalServiceError');
    }
  } catch (error) {
    logger.debug('Failed to record external service metrics', { error, serviceName, operation });
  }
}