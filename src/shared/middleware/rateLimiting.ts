/**
 * Rate Limiting Middleware
 *
 * Implements distributed rate limiting using Redis store with different limits
 * for IP addresses, authenticated users, and specific endpoints.
 *
 * Requirements: 13.5, 13.6
 */

import rateLimit from '@fastify/rate-limit';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { config } from '../../config/index.js';
import { redis } from '../../infrastructure/cache/index.js';
import { logger } from '../utils/logger.js';

/**
 * Rate limit configurations for different scenarios
 */
export const RateLimitConfig = {
  // Global rate limits per IP address (Requirement 13.5)
  GLOBAL_IP: {
    max: 100, // requests per window
    timeWindow: '15 minutes',
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Per-user rate limits for authenticated requests (Requirement 13.5)
  AUTHENTICATED_USER: {
    max: 200, // Higher limit for authenticated users
    timeWindow: '15 minutes',
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Stricter limits for expensive operations (Requirement 13.5)
  EXPENSIVE_OPERATIONS: {
    max: 10, // Very low limit for expensive operations
    timeWindow: '15 minutes',
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // File upload endpoints
  FILE_UPLOAD: {
    max: 20,
    timeWindow: '15 minutes',
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Authentication endpoints
  AUTH: {
    max: 30,
    timeWindow: '15 minutes',
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Search endpoints
  SEARCH: {
    max: 50,
    timeWindow: '15 minutes',
    skipSuccessfulRequests: false,
    skipOnError: false,
  },

  // Analytics endpoints
  ANALYTICS: {
    max: 20,
    timeWindow: '15 minutes',
    skipSuccessfulRequests: false,
    skipOnError: false,
  },
} as const;

/**
 * Custom key generator that considers both IP and user ID
 * Implements per-user rate limiting for authenticated requests
 */
function generateRateLimitKey(request: FastifyRequest, prefix: string = 'global'): string {
  // Extract user ID from JWT if available
  const userId = (request as any).user?.id;
  const ip = request.ip;

  if (userId) {
    // For authenticated users, use user ID as primary key
    return `ratelimit:${prefix}:user:${userId}`;
  } else {
    // For unauthenticated requests, use IP address
    return `ratelimit:${prefix}:ip:${ip}`;
  }
}

/**
 * Custom error response handler for rate limit exceeded
 * Implements requirement 13.6 - return 429 with headers and informative message
 */
function rateLimitErrorHandler(request: FastifyRequest, context: any) {
  // Log rate limit violation
  logger.warn('Rate limit exceeded', {
    ip: request.ip,
    userId: (request as any).user?.id,
    endpoint: `${request.method} ${request.url}`,
    userAgent: request.headers['user-agent'],
    limit: context.max,
    timeWindow: context.timeWindow,
    remaining: context.remaining || 0,
    resetTime: context.resetTime,
  });

  // Calculate retry after time in seconds
  const retryAfter = context.resetTime ? Math.ceil((context.resetTime - Date.now()) / 1000) : 900; // Default to 15 minutes if not available

  // Create informative error response (Requirement 13.6)
  const errorResponse = {
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. You have made too many requests. Please try again in ${retryAfter} seconds.`,
    details: {
      limit: context.max,
      remaining: context.remaining || 0,
      resetTime: context.resetTime ? new Date(context.resetTime).toISOString() : null,
      retryAfter,
      policy: `${context.max} requests per ${context.timeWindow}`,
    },
    timestamp: new Date().toISOString(),
  };

  const error = new Error(errorResponse.message);
  (error as any).statusCode = 429;
  (error as any).response = errorResponse;

  return error;
}

/**
 * Hook to add rate limit headers to all responses
 * Implements requirement 13.6 - include headers showing limit, remaining, reset time
 */
function addRateLimitHeaders(_request: FastifyRequest, reply: FastifyReply, context: any) {
  // Ensure all required headers are present (Requirement 13.6)
  reply.header('X-RateLimit-Limit', context.max);
  reply.header('X-RateLimit-Remaining', context.remaining || 0);

  // Calculate reset time if not provided
  const resetTime = context.resetTime || Date.now() + parseTimeWindow(context.timeWindow) * 1000;
  reply.header('X-RateLimit-Reset', Math.floor(resetTime / 1000));

  // Additional informative headers
  reply.header('X-RateLimit-Policy', `${context.max} requests per ${context.timeWindow}`);

  // Add Retry-After header for 429 responses
  if (reply.statusCode === 429) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    reply.header('Retry-After', retryAfter);
  }
}

/**
 * Registers global rate limiting middleware
 * Implements distributed rate limiting using Redis store
 */
export async function registerGlobalRateLimit(server: FastifyInstance): Promise<void> {
  if (!config.features.enableRateLimiting) {
    logger.info('Rate limiting is disabled via feature flag');
    return;
  }

  try {
    await server.register(rateLimit, {
      max: RateLimitConfig.GLOBAL_IP.max,
      timeWindow: RateLimitConfig.GLOBAL_IP.timeWindow,

      // Use Redis for distributed rate limiting
      redis: redis,

      // Custom key generator for IP/user-based limiting
      keyGenerator: (request: FastifyRequest) => generateRateLimitKey(request, 'global'),

      // Custom error response builder (Requirement 13.6)
      errorResponseBuilder: (request: FastifyRequest, context: any) => {
        const error = rateLimitErrorHandler(request, context);

        // Return the structured error response
        return (
          (error as any).response || {
            statusCode: 429,
            error: 'Too Many Requests',
            message: error.message,
            timestamp: new Date().toISOString(),
          }
        );
      },

      // Add headers to response (Requirement 13.6)
      addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
        'retry-after': true,
      },

      // Hook to add custom headers
      onExceeding: addRateLimitHeaders,
      onExceeded: addRateLimitHeaders,

      // Skip rate limiting for health checks
      skip: (request: FastifyRequest) => {
        const healthCheckPaths = ['/health', '/health/deep', '/health/ready', '/health/live'];
        return healthCheckPaths.includes(request.url);
      },

      // Enable detailed logging in development
      enableDraftSpec: config.nodeEnv === 'development',
    });

    logger.info('Global rate limiting registered successfully', {
      max: RateLimitConfig.GLOBAL_IP.max,
      timeWindow: RateLimitConfig.GLOBAL_IP.timeWindow,
      store: 'redis',
    });
  } catch (error) {
    logger.error('Failed to register global rate limiting', { error });
    throw error;
  }
}

/**
 * Creates endpoint-specific rate limiting middleware
 * Allows different limits for different types of operations
 */
export function createEndpointRateLimit(
  limitConfig: {
    max: number;
    timeWindow: string;
    skipSuccessfulRequests: boolean;
    skipOnError: boolean;
  },
  endpointType: string
) {
  return {
    config: {
      rateLimit: {
        max: limitConfig.max,
        timeWindow: limitConfig.timeWindow,

        // Use Redis for consistency
        redis: redis,

        // Custom key generator with endpoint type
        keyGenerator: (request: FastifyRequest) => generateRateLimitKey(request, endpointType),

        // Custom error response builder (Requirement 13.6)
        errorResponseBuilder: (request: FastifyRequest, context: any) => {
          const error = rateLimitErrorHandler(request, context);

          // Return the structured error response
          return (
            (error as any).response || {
              statusCode: 429,
              error: 'Too Many Requests',
              message: error.message,
              timestamp: new Date().toISOString(),
            }
          );
        },

        // Add headers (Requirement 13.6)
        addHeaders: {
          'x-ratelimit-limit': true,
          'x-ratelimit-remaining': true,
          'x-ratelimit-reset': true,
          'retry-after': true,
        },

        // Hook to add custom headers
        onExceeding: addRateLimitHeaders,
        onExceeded: addRateLimitHeaders,
      },
    },
  };
}

/**
 * Pre-configured rate limit options for common endpoint types
 */
export const EndpointRateLimits = {
  // For expensive operations like video processing, analytics generation
  expensive: createEndpointRateLimit(RateLimitConfig.EXPENSIVE_OPERATIONS, 'expensive'),

  // For file upload endpoints
  fileUpload: createEndpointRateLimit(RateLimitConfig.FILE_UPLOAD, 'upload'),

  // For authentication endpoints (login, register, password reset)
  auth: createEndpointRateLimit(RateLimitConfig.AUTH, 'auth'),

  // For search endpoints
  search: createEndpointRateLimit(RateLimitConfig.SEARCH, 'search'),

  // For analytics endpoints
  analytics: createEndpointRateLimit(RateLimitConfig.ANALYTICS, 'analytics'),
} as const;

/**
 * Utility function to check if a request is rate limited
 * Useful for custom rate limiting logic
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  try {
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds;
    const windowKey = `${key}:${windowStart}`;

    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, windowSeconds);
    pipeline.ttl(windowKey);

    const results = await pipeline.exec();

    if (!results || results.length !== 3) {
      throw new Error('Redis pipeline failed');
    }

    const count = results[0]?.[1] as number;
    const ttl = results[2]?.[1] as number;

    const allowed = count <= max;
    const remaining = Math.max(0, max - count);
    const resetTime = now + ttl * 1000;

    return {
      allowed,
      remaining,
      resetTime,
    };
  } catch (error) {
    logger.error('Rate limit check failed', { error, key });
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: max,
      resetTime: Date.now() + windowSeconds * 1000,
    };
  }
}

/**
 * Middleware to apply different rate limits based on user authentication
 * Higher limits for authenticated users, lower for anonymous
 */
export async function registerAdaptiveRateLimit(server: FastifyInstance): Promise<void> {
  if (!config.features.enableRateLimiting) {
    return;
  }

  // This will be applied after authentication middleware
  server.addHook('preHandler', async (request, reply) => {
    const isAuthenticated = !!(request as any).user;
    const limitConfig = isAuthenticated
      ? RateLimitConfig.AUTHENTICATED_USER
      : RateLimitConfig.GLOBAL_IP;

    const key = generateRateLimitKey(request, 'adaptive');
    const windowSeconds = parseTimeWindow(limitConfig.timeWindow);

    const rateLimitResult = await checkRateLimit(key, limitConfig.max, windowSeconds);

    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);

      // Add rate limit headers (Requirement 13.6)
      reply.header('X-RateLimit-Limit', limitConfig.max);
      reply.header('X-RateLimit-Remaining', rateLimitResult.remaining);
      reply.header('X-RateLimit-Reset', Math.floor(rateLimitResult.resetTime / 1000));
      reply.header(
        'X-RateLimit-Policy',
        `${limitConfig.max} requests per ${limitConfig.timeWindow}`
      );
      reply.header('Retry-After', retryAfter);

      // Log rate limit violation
      logger.warn('Adaptive rate limit exceeded', {
        ip: request.ip,
        userId: (request as unknown).user?.id,
        endpoint: `${request.method} ${request.url}`,
        isAuthenticated,
        limit: limitConfig.max,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime,
      });

      // Return structured error response (Requirement 13.6)
      return reply.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. You have made too many requests. Please try again in ${retryAfter} seconds.`,
        details: {
          limit: limitConfig.max,
          remaining: rateLimitResult.remaining,
          resetTime: new Date(rateLimitResult.resetTime).toISOString(),
          retryAfter,
          policy: `${limitConfig.max} requests per ${limitConfig.timeWindow}`,
          userType: isAuthenticated ? 'authenticated' : 'anonymous',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Add rate limit headers to successful responses
    reply.header('X-RateLimit-Limit', limitConfig.max);
    reply.header('X-RateLimit-Remaining', rateLimitResult.remaining);
    reply.header('X-RateLimit-Reset', Math.floor(rateLimitResult.resetTime / 1000));
  });

  logger.info('Adaptive rate limiting registered successfully');
}

/**
 * Utility function to parse time window strings to seconds
 */
function parseTimeWindow(timeWindow: string): number {
  const match = timeWindow.match(/^(\d+)\s*(second|minute|hour|day)s?$/i);
  if (!match || match.length < 3) {
    throw new Error(`Invalid time window format: ${timeWindow}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();

  const multipliers = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
  };

  return value * multipliers[unit as keyof typeof multipliers];
}

/**
 * Health check for rate limiting system
 */
export async function checkRateLimitHealth(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  try {
    // Test basic rate limit functionality
    const testKey = 'health:check:ratelimit';
    await checkRateLimit(testKey, 1, 60);

    // Clean up test key
    await redis.del(`${testKey}:${Math.floor(Date.now() / 60000) * 60}`);

    return {
      healthy: true,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
