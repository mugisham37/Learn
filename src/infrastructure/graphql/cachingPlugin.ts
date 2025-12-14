/**
 * GraphQL HTTP Caching Plugin
 *
 * Adds HTTP caching support to GraphQL responses including ETag generation,
 * conditional requests, and appropriate Cache-Control headers.
 *
 * Requirements: 15.4
 */

import { ApolloServerPlugin } from '@apollo/server';

import {
  generateETag,
  buildCacheControlHeader,
  parseIfNoneMatch,
  etagsMatch,
  CacheConfigs,
  type CacheConfig,
} from '../../shared/middleware/httpCaching.js';
import { logger } from '../../shared/utils/logger.js';

import {
  type GraphQLContext,
  type TypedGraphQLRequestListener,
  type GraphQLRequestContextWillSendResponseTyped,
  type GraphQLRequestContextDidEncounterErrorsTyped,
} from './types.js';

/**
 * GraphQL operation cache configuration
 */
interface GraphQLCacheConfig extends CacheConfig {
  /** Operations that should use this cache config (regex patterns) */
  operations?: string[];
  /** Whether to cache based on variables */
  includeVariables?: boolean;
  /** Whether to cache based on user context */
  includeUserContext?: boolean;
}

/**
 * Predefined cache configurations for GraphQL operations
 */
const GraphQLCacheConfigs: Record<string, GraphQLCacheConfig> = {
  // Public queries - longer cache
  PUBLIC_QUERIES: {
    ...CacheConfigs.COURSE_CATALOG,
    operations: ['^courses$', '^course$', '^searchCourses$'],
    includeVariables: true,
    includeUserContext: false,
  },

  // User-specific queries - shorter cache
  USER_QUERIES: {
    ...CacheConfigs.USER_PROFILES,
    operations: ['^me$', '^myEnrollments$', '^myProgress$'],
    includeVariables: true,
    includeUserContext: true,
  },

  // Analytics queries - medium cache
  ANALYTICS_QUERIES: {
    ...CacheConfigs.ANALYTICS,
    operations: ['^courseAnalytics$', '^studentAnalytics$', '^dashboardMetrics$'],
    includeVariables: true,
    includeUserContext: true,
  },

  // Search queries - short cache
  SEARCH_QUERIES: {
    ...CacheConfigs.SEARCH_RESULTS,
    operations: ['^searchCourses$', '^searchLessons$', '^autocomplete$'],
    includeVariables: true,
    includeUserContext: false,
  },

  // Real-time data - no cache
  REALTIME_QUERIES: {
    ...CacheConfigs.NO_CACHE,
    operations: ['^notifications$', '^messages$', '^onlineUsers$'],
    includeVariables: false,
    includeUserContext: false,
  },

  // Mutations - no cache
  MUTATIONS: {
    ...CacheConfigs.NO_CACHE,
    operations: ['.*'], // All mutations
    includeVariables: false,
    includeUserContext: false,
  },
};

/**
 * Get cache configuration for a GraphQL operation
 */
function getCacheConfigForOperation(
  operationName: string | null | undefined,
  operationType: 'query' | 'mutation' | 'subscription'
): GraphQLCacheConfig | null {
  // No caching for mutations and subscriptions
  if (operationType !== 'query') {
    return GraphQLCacheConfigs['MUTATIONS'] || null;
  }

  if (!operationName) {
    return null;
  }

  // Find matching cache configuration
  for (const [configName, config] of Object.entries(GraphQLCacheConfigs)) {
    if (config.operations) {
      for (const pattern of config.operations) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(operationName)) {
          logger.debug('Matched GraphQL cache config', {
            operationName,
            configName,
            pattern,
          });
          return config;
        }
      }
    }
  }

  // Default to API responses config for unmatched queries
  return {
    ...CacheConfigs.API_RESPONSES,
    includeVariables: true,
    includeUserContext: true,
  };
}

/**
 * Generate cache key for GraphQL operation
 */
function generateCacheKey(
  operationName: string | null | undefined,
  variables: Record<string, unknown> | null | undefined,
  userContext: GraphQLContext,
  config: GraphQLCacheConfig
): string {
  const parts: string[] = [];

  // Add operation name
  if (operationName) {
    parts.push(`op:${operationName}`);
  }

  // Add variables if configured
  if (config.includeVariables && variables) {
    const sortedVars = JSON.stringify(variables, Object.keys(variables).sort());
    parts.push(`vars:${sortedVars}`);
  }

  // Add user context if configured
  if (config.includeUserContext && userContext.user?.id) {
    parts.push(`user:${userContext.user.id}`);
    if (userContext.user.role) {
      parts.push(`role:${userContext.user.role}`);
    }
  }

  return parts.join('|');
}

/**
 * GraphQL HTTP Caching Plugin
 */
export function createGraphQLCachingPlugin(): ApolloServerPlugin<GraphQLContext> {
  return {
    requestDidStart(): Promise<TypedGraphQLRequestListener> {
      return Promise.resolve({
        willSendResponse: (requestContext: GraphQLRequestContextWillSendResponseTyped) => {
          return new Promise<void>((resolve) => {
            const { request, response, contextValue } = requestContext;

            try {
              // Skip caching for errors
              if (response.body && 'kind' in response.body && response.body.kind === 'single' && 'singleResult' in response.body && response.body.singleResult?.errors) {
                resolve();
                return;
              }

              // Get operation info
              const operationName = request.operationName;
              const operationType = requestContext.operation?.operation || 'query';

              // Get cache configuration
              const cacheConfig = getCacheConfigForOperation(operationName, operationType);
              if (!cacheConfig) {
                resolve();
                return;
              }

              // Generate cache key for ETag
              const cacheKey = generateCacheKey(
                operationName,
                request.variables,
                contextValue,
                cacheConfig
              );

              // Get response data
              const responseData = response.body && 'kind' in response.body && response.body.kind === 'single' && 'singleResult' in response.body ? response.body.singleResult?.data : null;

              if (!responseData) {
                resolve();
                return;
              }

              // Generate ETag including cache key and response data
              const etagData = {
                key: cacheKey,
                data: responseData,
                timestamp: Date.now(),
              };
              const etag = generateETag(etagData);

              // Set caching headers
              response.http.headers.set('ETag', etag);
              response.http.headers.set('Cache-Control', buildCacheControlHeader(cacheConfig));

              // Add Vary header for user-specific content
              if (cacheConfig.includeUserContext) {
                response.http.headers.set('Vary', 'Authorization');
              }

              // Handle conditional requests
              const ifNoneMatch = request.http?.headers.get('if-none-match');
              if (ifNoneMatch) {
                const clientETags = parseIfNoneMatch(ifNoneMatch);
                const matches = clientETags.some(
                  (clientETag) => clientETag === '*' || etagsMatch(clientETag, etag)
                );

                if (matches) {
                  // Return 304 Not Modified
                  if (response.http) {
                    response.http.status = 304;
                    if ('body' in response.http) {
                      (response.http as { body?: string }).body = '';
                    }

                    // Remove content headers
                    response.http.headers.delete('Content-Type');
                    response.http.headers.delete('Content-Length');
                  }

                  logger.debug('GraphQL 304 Not Modified response', {
                    operationName,
                    etag,
                    clientETags,
                  });

                  resolve();
                  return;
                }
              }

              logger.debug('GraphQL caching headers added', {
                operationName,
                operationType,
                etag,
                cacheControl: buildCacheControlHeader(cacheConfig),
                cacheKey,
              });
            } catch (error) {
              logger.error('Error in GraphQL caching plugin', {
                operationName: request.operationName,
                error: error instanceof Error ? error.message : String(error),
              });

              // Continue without caching if plugin fails
            }

            resolve();
          });
        },

        didEncounterErrors: (requestContext: GraphQLRequestContextDidEncounterErrorsTyped): Promise<void> => {
          return new Promise<void>((resolve) => {
            // Don't cache responses with errors
            const { response } = requestContext;

            // Set no-cache headers for error responses
            response.http.headers.set(
              'Cache-Control',
              buildCacheControlHeader(CacheConfigs.NO_CACHE)
            );

            logger.debug('GraphQL error response - no caching applied', {
              operationName: requestContext.request.operationName,
              errorCount: requestContext.errors?.length || 0,
            });

            resolve();
          });
        },
      });
    },
  };
}

/**
 * Create cache-aware GraphQL context
 */
export function createCacheAwareContext(baseContext: GraphQLContext): GraphQLContext {
  return {
    ...baseContext,
    cache: {
      // Add cache utilities to GraphQL context
      generateETag,
      buildCacheControlHeader,
      configs: GraphQLCacheConfigs,
    },
  };
}
