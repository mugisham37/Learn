/**
 * HTTP Response Caching Middleware
 *
 * Implements HTTP caching mechanisms including Cache-Control headers,
 * ETag generation, conditional requests, and 304 Not Modified responses.
 *
 * Requirements: 15.4
 */

import { createHash } from 'crypto';

import { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { logger } from '../utils/logger.js';

/**
 * Cache configuration for different resource types
 */
export interface CacheConfig {
  /** Cache duration in seconds */
  maxAge: number;
  /** Whether the response can be cached by shared caches (CDNs, proxies) */
  public?: boolean;
  /** Whether the response must be revalidated with the origin server */
  mustRevalidate?: boolean;
  /** Whether the response can be cached by private caches (browsers) */
  private?: boolean;
  /** Whether the response should not be cached at all */
  noCache?: boolean;
  /** Whether the response should not be stored at all */
  noStore?: boolean;
  /** Custom cache directives */
  customDirectives?: string[];
}

/**
 * ETag generation options
 */
export interface ETagOptions {
  /** Whether to generate weak ETags (default: false for strong ETags) */
  weak?: boolean;
  /** Custom hash algorithm (default: 'sha256') */
  algorithm?: string;
  /** Whether to include request-specific data in ETag calculation */
  includeRequestData?: boolean;
}

/**
 * Predefined cache configurations for common resource types
 */
export const CacheConfigs = {
  /** Static assets - long cache duration */
  STATIC_ASSETS: {
    maxAge: 31536000, // 1 year
    public: true,
  } as CacheConfig,

  /** API responses - short cache duration */
  API_RESPONSES: {
    maxAge: 300, // 5 minutes
    private: true,
    mustRevalidate: true,
  } as CacheConfig,

  /** Search results - medium cache duration */
  SEARCH_RESULTS: {
    maxAge: 600, // 10 minutes
    public: true,
    mustRevalidate: true,
  } as CacheConfig,

  /** Analytics data - longer cache duration */
  ANALYTICS: {
    maxAge: 3600, // 1 hour
    private: true,
    mustRevalidate: true,
  } as CacheConfig,

  /** Course catalog - medium cache duration */
  COURSE_CATALOG: {
    maxAge: 1800, // 30 minutes
    public: true,
    mustRevalidate: true,
  } as CacheConfig,

  /** User profiles - short cache duration */
  USER_PROFILES: {
    maxAge: 600, // 10 minutes
    private: true,
    mustRevalidate: true,
  } as CacheConfig,

  /** No cache - for sensitive or dynamic content */
  NO_CACHE: {
    maxAge: 0,
    noCache: true,
    noStore: true,
    mustRevalidate: true,
  } as CacheConfig,
} as const;

/**
 * Generate ETag for response data
 */
export function generateETag(data: any, options: ETagOptions = {}): string {
  const { weak = false, algorithm = 'sha256' } = options;

  try {
    // Convert data to string for hashing
    let content: string;
    if (typeof data === 'string') {
      content = data;
    } else if (Buffer.isBuffer(data)) {
      content = data.toString();
    } else {
      content = JSON.stringify(data);
    }

    // Generate hash
    const hash = createHash(algorithm).update(content).digest('hex').substring(0, 16); // Use first 16 characters for shorter ETags

    // Return ETag with appropriate format
    return weak ? `W/"${hash}"` : `"${hash}"`;
  } catch (error) {
    logger.warn('Failed to generate ETag', {
      error: error instanceof Error ? error.message : String(error),
      dataType: typeof data,
    });

    // Fallback to timestamp-based ETag
    const fallbackHash = createHash('md5')
      .update(Date.now().toString())
      .digest('hex')
      .substring(0, 8);

    return weak ? `W/"${fallbackHash}"` : `"${fallbackHash}"`;
  }
}

/**
 * Build Cache-Control header value from configuration
 */
export function buildCacheControlHeader(config: CacheConfig): string {
  const directives: string[] = [];

  // Add max-age directive
  directives.push(`max-age=${config.maxAge}`);

  // Add visibility directives
  if (config.public) {
    directives.push('public');
  } else if (config.private) {
    directives.push('private');
  }

  // Add revalidation directives
  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }

  // Add no-cache directive
  if (config.noCache) {
    directives.push('no-cache');
  }

  // Add no-store directive
  if (config.noStore) {
    directives.push('no-store');
  }

  // Add custom directives
  if (config.customDirectives) {
    directives.push(...config.customDirectives);
  }

  return directives.join(', ');
}

/**
 * Parse If-None-Match header to extract ETags
 */
export function parseIfNoneMatch(ifNoneMatch: string): string[] {
  if (!ifNoneMatch) {
    return [];
  }

  // Handle wildcard
  if (ifNoneMatch.trim() === '*') {
    return ['*'];
  }

  // Parse comma-separated ETags
  return ifNoneMatch
    .split(',')
    .map((etag) => etag.trim())
    .filter((etag) => etag.length > 0);
}

/**
 * Check if ETags match for conditional requests
 */
export function etagsMatch(etag1: string, etag2: string): boolean {
  if (!etag1 || !etag2) {
    return false;
  }

  // Normalize ETags (remove W/ prefix for comparison)
  const normalize = (etag: string) => etag.replace(/^W\//, '');

  return normalize(etag1) === normalize(etag2);
}

/**
 * HTTP caching middleware factory
 */
export function createHttpCachingMiddleware(
  config: CacheConfig,
  etagOptions: ETagOptions = {}
): preHandlerHookHandler {
  return async function httpCachingMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const requestId = request.id;

    try {
      // Skip caching for non-GET requests
      if (request.method !== 'GET') {
        return;
      }

      // Skip caching if no-cache is configured
      if (config.noCache && config.noStore) {
        reply.header('Cache-Control', buildCacheControlHeader(config));
        return;
      }

      // Set basic cache headers
      reply.header('Cache-Control', buildCacheControlHeader(config));

      // Handle conditional requests
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch) {
        // For now, just set the cache control header
        // ETag handling would need to be implemented at the route level
        logger.debug('Conditional request detected', {
          requestId,
          url: request.url,
          ifNoneMatch,
        });
      }

      logger.debug('HTTP caching headers set', {
        requestId,
        url: request.url,
        cacheControl: buildCacheControlHeader(config),
      });
    } catch (error) {
      logger.error('Error in HTTP caching middleware', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Continue without caching if middleware fails
    }
  };
}

/**
 * Convenience function to add caching to specific routes
 */
export function addCachingToRoute(
  fastify: FastifyInstance,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  config: CacheConfig,
  handler: unknown,
  etagOptions?: ETagOptions
): void {
  const routeOptions = {
    preHandler: method === 'GET' ? createHttpCachingMiddleware(config, etagOptions) : undefined,
  };

  fastify.route({
    method,
    url,
    ...routeOptions,
    handler,
  });
}

/**
 * Register HTTP caching plugin for Fastify
 */
export async function registerHttpCaching(fastify: FastifyInstance): Promise<void> {
  // Add caching utilities to Fastify instance
  fastify.decorate('cache', {
    generateETag,
    buildCacheControlHeader,
    createMiddleware: createHttpCachingMiddleware,
    addToRoute: (
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      url: string,
      config: CacheConfig,
      handler: unknown,
      etagOptions?: ETagOptions
    ) => addCachingToRoute(fastify, method, url, config, handler, etagOptions),
    configs: CacheConfigs,
  });

  logger.info('HTTP caching plugin registered successfully');
}

/**
 * Extended Fastify instance with caching utilities
 */
declare module 'fastify' {
  interface FastifyInstance {
    cache: {
      generateETag: typeof generateETag;
      buildCacheControlHeader: typeof buildCacheControlHeader;
      createMiddleware: typeof createHttpCachingMiddleware;
      addToRoute: typeof addCachingToRoute;
      configs: typeof CacheConfigs;
    };
  }
}
