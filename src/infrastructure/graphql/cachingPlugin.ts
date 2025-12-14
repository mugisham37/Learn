/**
 * GraphQL HTTP Caching Plugin
 *
 * Provides HTTP caching capabilities for GraphQL responses including
 * ETag generation, cache control headers, and cache-aware context.
 *
 * Requirements: 21.3
 */

import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLResolveInfo } from 'graphql';

import { logger } from '../../shared/utils/logger.js';

import { GraphQLContext, TypedGraphQLRequestListener } from './types.js';

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate: number;
  public: boolean;
  varyHeaders: string[];
}

/**
 * Default cache configurations for different operation types
 */
const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  query: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 600, // 10 minutes
    public: true,
    varyHeaders: ['Authorization'],
  },
  mutation: {
    maxAge: 0,
    staleWhileRevalidate: 0,
    public: false,
    varyHeaders: ['Authorization'],
  },
  subscription: {
    maxAge: 0,
    staleWhileRevalidate: 0,
    public: false,
    varyHeaders: ['Authorization'],
  },
};

/**
 * Helper function to safely get cache config
 */
function getSafeCacheConfig(operationType: string, configs?: Record<string, CacheConfig>): CacheConfig {
  const configMap = configs || DEFAULT_CACHE_CONFIGS;
  
  // Use explicit key checking for known operation types
  if (operationType === 'query') {
    return configMap[operationType] || DEFAULT_CACHE_CONFIGS['query']!;
  }
  if (operationType === 'mutation') {
    return configMap[operationType] || DEFAULT_CACHE_CONFIGS['query']!;
  }
  if (operationType === 'subscription') {
    return configMap[operationType] || DEFAULT_CACHE_CONFIGS['query']!;
  }
  
  // For unknown operation types, fall back to query config
  return DEFAULT_CACHE_CONFIGS['query']!;
}

/**
 * Cache utilities interface
 */
export interface CacheUtilities {
  generateETag: (data: Record<string, unknown>) => string;
  buildCacheControlHeader: (config: CacheConfig) => string;
  configs: Record<string, CacheConfig>;
}

/**
 * Generates ETag for response data
 */
export function generateETag(data: Record<string, unknown>): string {
  try {
    const dataString = JSON.stringify(data);
    // Simple hash function for ETag generation
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `"${Math.abs(hash).toString(16)}"`;
  } catch (error) {
    logger.warn('Failed to generate ETag', {
      error: error instanceof Error ? error.message : String(error),
    });
    return `"${Date.now()}"`;
  }
}

/**
 * Builds Cache-Control header from configuration
 */
export function buildCacheControlHeader(config: CacheConfig): string {
  const parts: string[] = [];

  if (config.public) {
    parts.push('public');
  } else {
    parts.push('private');
  }

  if (config.maxAge > 0) {
    parts.push(`max-age=${config.maxAge}`);
  } else {
    parts.push('no-cache');
  }

  if (config.staleWhileRevalidate > 0) {
    parts.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  return parts.join(', ');
}

/**
 * Creates cache utilities for GraphQL context
 */
export function createCacheUtilities(): CacheUtilities {
  return {
    generateETag,
    buildCacheControlHeader,
    configs: { ...DEFAULT_CACHE_CONFIGS },
  };
}

/**
 * Adds cache utilities to GraphQL context
 */
export function createCacheAwareContext<T extends GraphQLContext>(context: T): T {
  return {
    ...context,
    cache: createCacheUtilities(),
  };
}

/**
 * Helper function to get cache configuration for operation
 */
export function getCacheConfig(
  info: GraphQLResolveInfo,
  customConfigs?: Record<string, CacheConfig>
): CacheConfig {
  const operationType = info.operation.operation;
  return getSafeCacheConfig(operationType, customConfigs);
}

/**
 * Helper function to set cache headers on response
 */
export function setCacheHeaders(
  response: { headers: Map<string, string> },
  config: CacheConfig,
  etag?: string
): void {
  // Set Cache-Control header
  response.headers.set('Cache-Control', buildCacheControlHeader(config));

  // Set ETag if provided
  if (etag) {
    response.headers.set('ETag', etag);
  }

  // Set Vary headers
  if (config.varyHeaders.length > 0) {
    response.headers.set('Vary', config.varyHeaders.join(', '));
  }
}

/**
 * GraphQL HTTP Caching Plugin
 */
export function createGraphQLCachingPlugin(): ApolloServerPlugin<GraphQLContext> {
  return {
    requestDidStart(): Promise<TypedGraphQLRequestListener> {
      return Promise.resolve({
        willSendResponse({ response, request }): Promise<void> {
          return Promise.resolve().then(() => {
          try {
            // Only cache successful responses
            if (response.body.kind === 'single' && response.body.singleResult?.data) {
              const operationType = request.operationName ? 'query' : 'query'; // Default to query
              const config: CacheConfig = getSafeCacheConfig(operationType);

              // Generate ETag for response data
              const etag = generateETag(response.body.singleResult.data);

              // Set cache headers
              setCacheHeaders(response.http, config, etag);

              logger.debug('Cache headers set for GraphQL response', {
                operationName: request.operationName,
                operationType,
                etag,
                cacheControl: buildCacheControlHeader(config),
              });
            }
          } catch (error) {
            logger.error('Failed to set cache headers', {
              error: error instanceof Error ? error.message : String(error),
              operationName: request.operationName,
            });
          }
          });
        },
      });
    },
  };
}

/**
 * Utility to check if response should be cached
 */
export function shouldCacheResponse(
  operationType: string,
  hasErrors: boolean,
  customRules?: (operationType: string) => boolean
): boolean {
  // Don't cache responses with errors
  if (hasErrors) {
    return false;
  }

  // Don't cache mutations or subscriptions by default
  if (operationType === 'mutation' || operationType === 'subscription') {
    return false;
  }

  // Apply custom rules if provided
  if (customRules) {
    return customRules(operationType);
  }

  // Cache queries by default
  return operationType === 'query';
}

/**
 * Utility to create custom cache configuration
 */
export function createCustomCacheConfig(
  operationType: string,
  overrides: Partial<CacheConfig>
): CacheConfig {
  const baseConfig: CacheConfig = getSafeCacheConfig(operationType);
  const result: CacheConfig = {
    maxAge: overrides.maxAge ?? baseConfig.maxAge,
    staleWhileRevalidate: overrides.staleWhileRevalidate ?? baseConfig.staleWhileRevalidate,
    public: overrides.public ?? baseConfig.public,
    varyHeaders: overrides.varyHeaders ?? baseConfig.varyHeaders,
  };
  return result;
}