/**
 * Request Deduplication Middleware
 * 
 * Implements request deduplication to prevent duplicate processing and improve performance.
 * Generates request fingerprints and caches responses to return cached responses
 * for duplicate requests within a short time window.
 * 
 * Requirements: 15.6
 */

import crypto from 'crypto';

import { FastifyReply, FastifyRequest } from 'fastify';

import { cache } from '../../infrastructure/cache/index.js';

/**
 * Configuration options for request deduplication
 */
export interface RequestDeduplicationOptions {
  /**
   * TTL for cached responses in seconds
   * Default: 30 seconds (short window for duplicate prevention)
   */
  cacheTtlSeconds?: number;
  
  /**
   * Whether to include request headers in fingerprint
   * Default: false (only method, path, body)
   */
  includeHeaders?: boolean;
  
  /**
   * Headers to include in fingerprint if includeHeaders is true
   * Default: ['authorization', 'content-type']
   */
  headersToInclude?: string[];
  
  /**
   * Whether to enable deduplication for this request
   * Can be a function that receives the request and returns boolean
   */
  enabled?: boolean | ((request: FastifyRequest) => boolean);
  
  /**
   * Custom key prefix for cache entries
   * Default: 'req_dedup'
   */
  keyPrefix?: string;
}

/**
 * Default configuration for request deduplication
 */
const DEFAULT_OPTIONS: Required<RequestDeduplicationOptions> = {
  cacheTtlSeconds: 30,
  includeHeaders: false,
  headersToInclude: ['authorization', 'content-type'],
  enabled: true,
  keyPrefix: 'req_dedup',
};

/**
 * Cached response data structure
 */
interface CachedResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: unknown;
  timestamp: number;
}

/**
 * Generates a unique fingerprint for a request based on method, path, body, and optionally headers
 */
function generateRequestFingerprint(
  request: FastifyRequest,
  options: Required<RequestDeduplicationOptions>
): string {
  const components: string[] = [
    request.method.toUpperCase(),
    request.url,
  ];
  
  // Include request body if present
  if (request.body) {
    if (typeof request.body === 'string') {
      components.push(request.body);
    } else {
      components.push(JSON.stringify(request.body));
    }
  }
  
  // Include specified headers if enabled
  if (options.includeHeaders) {
    for (const headerName of options.headersToInclude) {
      const headerValue = request.headers[headerName.toLowerCase()];
      if (headerValue) {
        components.push(`${headerName}:${Array.isArray(headerValue) ? headerValue.join(',') : headerValue}`);
      }
    }
  }
  
  // Generate SHA-256 hash of all components
  const content = components.join('|');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Builds cache key for request deduplication
 */
function buildCacheKey(fingerprint: string, keyPrefix: string): string {
  return `${keyPrefix}:response:${fingerprint}`;
}

/**
 * Checks if deduplication should be enabled for this request
 */
function shouldDeduplicateRequest(
  request: FastifyRequest,
  options: Required<RequestDeduplicationOptions>
): boolean {
  // Skip deduplication for non-idempotent methods by default
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
    return false;
  }
  
  if (typeof options.enabled === 'function') {
    return options.enabled(request);
  }
  
  return options.enabled;
}

/**
 * Serializes response data for caching
 */
function serializeResponse(reply: FastifyReply, body: unknown): CachedResponse {
  const headers: Record<string, string | string[]> = {};
  const replyHeaders = reply.getHeaders();
  
  // Convert headers to the expected format
  for (const [key, value] of Object.entries(replyHeaders)) {
    if (value !== undefined) {
      headers[key] = value as string | string[];
    }
  }
  
  return {
    statusCode: reply.statusCode,
    headers,
    body,
    timestamp: Date.now(),
  };
}

/**
 * Sends cached response to client
 */
function sendCachedResponse(reply: FastifyReply, cachedResponse: CachedResponse): void {
  // Set status code
  void reply.code(cachedResponse.statusCode);
  
  // Set headers (excluding some that shouldn't be cached)
  const excludeHeaders = new Set(['date', 'x-request-id', 'x-response-time']);
  
  for (const [name, value] of Object.entries(cachedResponse.headers)) {
    if (!excludeHeaders.has(name.toLowerCase())) {
      void reply.header(name, value);
    }
  }
  
  // Add cache hit header
  void reply.header('x-cache', 'HIT');
  void reply.header('x-cache-timestamp', cachedResponse.timestamp.toString());
  
  // Send response
  void reply.send(cachedResponse.body);
}

/**
 * Creates request deduplication middleware
 * 
 * This middleware implements request deduplication by:
 * 1. Generating a fingerprint for each request
 * 2. Checking if a cached response exists
 * 3. If cached, returning the cached response immediately
 * 4. If not cached, processing the request and caching the response
 * 
 * @param options - Configuration options for deduplication behavior
 * @returns Fastify preHandler middleware function
 */
export function createRequestDeduplicationMiddleware(
  options: RequestDeduplicationOptions = {}
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  return async function requestDeduplicationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const requestId = request.id;
    
    // Check if deduplication should be applied to this request
    if (!shouldDeduplicateRequest(request, config)) {
      request.log.debug(
        { requestId, method: request.method, url: request.url },
        'Request deduplication skipped - not applicable for this request type'
      );
      return;
    }
    
    // Generate request fingerprint
    const fingerprint = generateRequestFingerprint(request, config);
    const cacheKey = buildCacheKey(fingerprint, config.keyPrefix);
    
    request.log.debug(
      { requestId, fingerprint, method: request.method, url: request.url },
      'Generated request fingerprint for deduplication'
    );
    
    try {
      // Check for cached response
      const cachedResponse = await cache.get<CachedResponse>(cacheKey);
      
      if (cachedResponse) {
        request.log.info(
          { 
            requestId, 
            fingerprint, 
            cacheAge: Date.now() - cachedResponse.timestamp,
            method: request.method,
            url: request.url 
          },
          'Returning cached response for duplicate request'
        );
        
        sendCachedResponse(reply, cachedResponse);
        return;
      }
      
      // No cached response found, set up response caching
      const originalSend = reply.send.bind(reply);
      reply.send = function (payload: unknown): FastifyReply {
        try {
          // Only cache successful responses (2xx status codes)
          if (reply.statusCode >= 200 && reply.statusCode < 300) {
            // Serialize and cache the response
            const cachedResponse = serializeResponse(reply, payload);
            
            // Cache the response (fire and forget)
            void cache.set(cacheKey, cachedResponse, config.cacheTtlSeconds)
              .catch((error) => {
                request.log.error(
                  { requestId, fingerprint, error: error instanceof Error ? error.message : 'Unknown error' },
                  'Failed to cache response'
                );
              });
            
            request.log.debug(
              { requestId, fingerprint, statusCode: reply.statusCode },
              'Response cached for future duplicate requests'
            );
            
            // Add cache miss header
            void reply.header('x-cache', 'MISS');
          } else {
            request.log.debug(
              { requestId, fingerprint, statusCode: reply.statusCode },
              'Response not cached due to non-success status code'
            );
          }
          
        } catch (error) {
          request.log.error(
            { requestId, fingerprint, error: error instanceof Error ? error.message : 'Unknown error' },
            'Error in response caching'
          );
        }
        
        // Call original send method
        return originalSend(payload);
      };
      
    } catch (error) {
      request.log.error(
        { 
          requestId, 
          fingerprint, 
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        'Error in request deduplication middleware'
      );
      
      // Continue with normal request processing on error
      return;
    }
  };
}

/**
 * Pre-configured middleware for common use cases
 */

/**
 * Standard request deduplication for GET requests
 * Uses default settings with 30-second cache window
 */
export const standardRequestDeduplication = createRequestDeduplicationMiddleware({
  cacheTtlSeconds: 30,
  includeHeaders: false,
});

/**
 * Aggressive request deduplication for expensive operations
 * Uses longer cache window and includes authorization header
 */
export const aggressiveRequestDeduplication = createRequestDeduplicationMiddleware({
  cacheTtlSeconds: 120, // 2 minutes
  includeHeaders: true,
  headersToInclude: ['authorization', 'content-type'],
});

/**
 * Conservative request deduplication for frequently changing data
 * Uses shorter cache window
 */
export const conservativeRequestDeduplication = createRequestDeduplicationMiddleware({
  cacheTtlSeconds: 10, // 10 seconds
  includeHeaders: false,
});

/**
 * Gets deduplication statistics from cache
 */
export async function getDeduplicationStats(): Promise<{
  totalCachedResponses: number;
  cacheHitRate?: number;
}> {
  try {
    const stats = await cache.getStats();
    
    return {
      totalCachedResponses: Math.floor(stats.keys * 0.6), // Rough estimate
      cacheHitRate: stats.hits && stats.misses 
        ? parseFloat(stats.hits) / (parseFloat(stats.hits) + parseFloat(stats.misses))
        : undefined,
    };
  } catch (error) {
    return {
      totalCachedResponses: 0,
    };
  }
}

/**
 * Clears all cached responses for request deduplication
 * Useful for testing or cache invalidation
 */
export async function clearDeduplicationCache(keyPrefix: string = 'req_dedup'): Promise<number> {
  try {
    const deletedCount = await cache.deletePattern(`${keyPrefix}:*`);
    return deletedCount;
  } catch (error) {
    console.error('Error clearing deduplication cache:', error);
    return 0;
  }
}

/**
 * Registers request deduplication middleware globally for a Fastify instance
 */
export function registerRequestDeduplication(
  fastify: { 
    addHook: (hook: string, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>) => void; 
    log: { info: (obj: RequestDeduplicationOptions, msg: string) => void } 
  },
  options: RequestDeduplicationOptions = {}
): void {
  const middleware = createRequestDeduplicationMiddleware(options);
  
  // Register as a global preHandler
  fastify.addHook('preHandler', middleware);
  
  fastify.log.info(
    options,
    'Request deduplication middleware registered globally'
  );
}