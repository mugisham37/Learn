/**
 * GraphQL Response Optimization
 *
 * Comprehensive response optimization including field selection,
 * null value removal, compression, and payload size reduction.
 *
 * Requirements: 15.6
 */

import { GraphQLResolveInfo } from 'graphql';
import { logger } from '../../shared/utils/logger.js';
import {
  optimizeGraphQLResponse,
  removeNullValues,
  createFieldSelection,
  filterObjectFields,
} from './fieldSelection.js';
import {
  createOptimizedConnection,
  createOptimizedOffsetPagination,
  PaginationInput,
  OffsetPaginationInput,
  PaginationConfig,
  createPaginationConfig,
} from './pagination.js';

/**
 * Response optimization configuration
 */
export interface ResponseOptimizationConfig {
  enableFieldSelection: boolean;
  removeNullValues: boolean;
  enableCompressionHints: boolean;
  logOptimizations: boolean;
  maxPayloadSize: number; // bytes
  warnThreshold: number; // bytes
}

/**
 * Default response optimization configuration
 */
const DEFAULT_CONFIG: ResponseOptimizationConfig = {
  enableFieldSelection: true,
  removeNullValues: true,
  enableCompressionHints: true,
  logOptimizations: process.env.NODE_ENV === 'development',
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  warnThreshold: 1024 * 1024, // 1MB
};

/**
 * Response optimization metrics
 */
export interface OptimizationMetrics {
  originalSize: number;
  optimizedSize: number;
  reductionBytes: number;
  reductionPercentage: number;
  fieldsRequested: number;
  nullsRemoved: number;
  operationName?: string;
  operationType: string;
  timestamp: Date;
}

/**
 * Global optimization statistics
 */
let optimizationStats = {
  totalRequests: 0,
  totalOriginalBytes: 0,
  totalOptimizedBytes: 0,
  totalReductionBytes: 0,
  averageReductionPercentage: 0,
};

/**
 * Creates response optimization configuration from environment
 */
export function createOptimizationConfig(): ResponseOptimizationConfig {
  return {
    enableFieldSelection: process.env.GRAPHQL_FIELD_SELECTION !== 'false',
    removeNullValues: process.env.GRAPHQL_REMOVE_NULLS !== 'false',
    enableCompressionHints: process.env.GRAPHQL_COMPRESSION_HINTS !== 'false',
    logOptimizations: process.env.GRAPHQL_LOG_OPTIMIZATIONS === 'true',
    maxPayloadSize: parseInt(process.env.GRAPHQL_MAX_PAYLOAD_SIZE || '10485760', 10),
    warnThreshold: parseInt(process.env.GRAPHQL_WARN_THRESHOLD || '1048576', 10),
  };
}

/**
 * Optimizes a GraphQL response with comprehensive optimization
 */
export function optimizeResponse<T>(
  data: T,
  info: GraphQLResolveInfo,
  config: ResponseOptimizationConfig = DEFAULT_CONFIG
): { data: T; metrics: OptimizationMetrics } {
  const startTime = Date.now();

  let originalData: string;
  let originalSize: number;

  try {
    originalData = JSON.stringify(data);
    originalSize = originalData.length;
  } catch (error) {
    // Handle circular references or other JSON.stringify errors
    logger.error('Failed to serialize original data for optimization', {
      error: error instanceof Error ? error.message : String(error),
      operationName: info.operation.name?.value,
    });

    // Return original data with zero metrics
    const metrics: OptimizationMetrics = {
      originalSize: 0,
      optimizedSize: 0,
      reductionBytes: 0,
      reductionPercentage: 0,
      fieldsRequested: 0,
      nullsRemoved: 0,
      operationName: info.operation.name?.value,
      operationType: info.operation.operation,
      timestamp: new Date(),
    };

    return { data, metrics };
  }

  let optimizedData = data;
  let nullsRemoved = 0;

  try {
    // Apply field selection if enabled
    if (config.enableFieldSelection) {
      const selection = createFieldSelection(info);
      optimizedData = filterObjectFields(optimizedData as any, selection) as T;
    }

    // Remove null values if enabled
    if (config.removeNullValues) {
      const beforeNullRemoval = JSON.stringify(optimizedData);
      optimizedData = removeNullValues(optimizedData);
      const afterNullRemoval = JSON.stringify(optimizedData);
      nullsRemoved = beforeNullRemoval.length - afterNullRemoval.length;
    }

    // Calculate metrics
    const optimizedSize = JSON.stringify(optimizedData).length;
    const reductionBytes = originalSize - optimizedSize;
    const reductionPercentage = originalSize > 0 ? (reductionBytes / originalSize) * 100 : 0;

    const metrics: OptimizationMetrics = {
      originalSize,
      optimizedSize,
      reductionBytes,
      reductionPercentage,
      fieldsRequested: config.enableFieldSelection ? createFieldSelection(info).fields.size : 0,
      nullsRemoved,
      operationName: info.operation.name?.value,
      operationType: info.operation.operation,
      timestamp: new Date(),
    };

    // Update global statistics
    updateOptimizationStats(metrics);

    // Log optimization if enabled
    if (config.logOptimizations) {
      logOptimization(metrics);
    }

    // Warn about large payloads
    if (optimizedSize > config.warnThreshold) {
      logger.warn('Large GraphQL response detected', {
        operationName: metrics.operationName,
        size: optimizedSize,
        threshold: config.warnThreshold,
        reductionPercentage: metrics.reductionPercentage,
      });
    }

    // Error on excessive payload size
    if (optimizedSize > config.maxPayloadSize) {
      logger.error('GraphQL response exceeds maximum payload size', {
        operationName: metrics.operationName,
        size: optimizedSize,
        maxSize: config.maxPayloadSize,
      });

      throw new Error(
        `Response payload too large: ${optimizedSize} bytes exceeds limit of ${config.maxPayloadSize} bytes. ` +
          'Please reduce the scope of your query or use pagination.'
      );
    }

    return { data: optimizedData, metrics };
  } catch (error) {
    logger.error('Response optimization failed', {
      error: error instanceof Error ? error.message : String(error),
      operationName: info.operation.name?.value,
      originalSize,
    });

    // Return original data if optimization fails
    const metrics: OptimizationMetrics = {
      originalSize,
      optimizedSize: originalSize,
      reductionBytes: 0,
      reductionPercentage: 0,
      fieldsRequested: 0,
      nullsRemoved: 0,
      operationName: info.operation.name?.value,
      operationType: info.operation.operation,
      timestamp: new Date(),
    };

    return { data, metrics };
  }
}

/**
 * Creates an optimized list response with pagination
 */
export function optimizeListResponse<T>(
  records: T[],
  paginationInput: PaginationInput,
  info: GraphQLResolveInfo,
  totalCount?: number,
  cursorField: string = 'id',
  config: ResponseOptimizationConfig = DEFAULT_CONFIG
) {
  const paginationConfig = createPaginationConfig();

  return createOptimizedConnection(
    records,
    paginationInput,
    info,
    totalCount,
    cursorField,
    paginationConfig
  );
}

/**
 * Creates an optimized offset-based list response
 */
export function optimizeOffsetListResponse<T>(
  records: T[],
  paginationInput: OffsetPaginationInput,
  info: GraphQLResolveInfo,
  totalCount: number,
  config: ResponseOptimizationConfig = DEFAULT_CONFIG
) {
  const paginationConfig = createPaginationConfig();

  return createOptimizedOffsetPagination(
    records,
    paginationInput,
    totalCount,
    info,
    paginationConfig
  );
}

/**
 * Updates global optimization statistics
 */
function updateOptimizationStats(metrics: OptimizationMetrics): void {
  optimizationStats.totalRequests++;
  optimizationStats.totalOriginalBytes += metrics.originalSize;
  optimizationStats.totalOptimizedBytes += metrics.optimizedSize;
  optimizationStats.totalReductionBytes += metrics.reductionBytes;

  // Calculate running average
  optimizationStats.averageReductionPercentage =
    (optimizationStats.totalReductionBytes / optimizationStats.totalOriginalBytes) * 100;
}

/**
 * Logs optimization metrics
 */
function logOptimization(metrics: OptimizationMetrics): void {
  logger.debug('GraphQL response optimized', {
    operationName: metrics.operationName,
    operationType: metrics.operationType,
    originalSize: metrics.originalSize,
    optimizedSize: metrics.optimizedSize,
    reductionBytes: metrics.reductionBytes,
    reductionPercentage: Math.round(metrics.reductionPercentage * 100) / 100,
    fieldsRequested: metrics.fieldsRequested,
    nullsRemoved: metrics.nullsRemoved,
    processingTime: Date.now() - metrics.timestamp.getTime(),
  });
}

/**
 * Gets current optimization statistics
 */
export function getOptimizationStats() {
  return { ...optimizationStats };
}

/**
 * Resets optimization statistics
 */
export function resetOptimizationStats(): void {
  optimizationStats = {
    totalRequests: 0,
    totalOriginalBytes: 0,
    totalOptimizedBytes: 0,
    totalReductionBytes: 0,
    averageReductionPercentage: 0,
  };
}

/**
 * Apollo Server plugin for automatic response optimization
 */
export function createResponseOptimizationPlugin(
  config: ResponseOptimizationConfig = DEFAULT_CONFIG
) {
  return {
    async requestDidStart() {
      return {
        async willSendResponse({ response, request }: any) {
          try {
            // Only optimize successful responses with data
            if (response.body.kind === 'single' && response.body.singleResult.data) {
              const originalData = response.body.singleResult.data;

              // Apply basic null value removal (field selection handled at resolver level)
              if (config.removeNullValues) {
                const optimizedData = removeNullValues(originalData);
                response.body.singleResult.data = optimizedData;

                // Log optimization metrics
                if (config.logOptimizations) {
                  const originalSize = JSON.stringify(originalData).length;
                  const optimizedSize = JSON.stringify(optimizedData).length;
                  const reduction = Math.round(
                    ((originalSize - optimizedSize) / originalSize) * 100
                  );

                  logger.debug('Response optimized in plugin', {
                    operationName: request.operationName,
                    originalSize,
                    optimizedSize,
                    reductionPercentage: reduction,
                  });
                }
              }

              // Add compression hints if enabled
              if (config.enableCompressionHints) {
                const responseSize = JSON.stringify(response.body.singleResult.data).length;

                // Add headers to encourage compression for larger responses
                if (responseSize > 1024) {
                  // 1KB threshold
                  response.http.headers.set('X-Compress-Hint', 'true');
                }
              }
            }
          } catch (error) {
            logger.error('Failed to optimize response in plugin', {
              error: error instanceof Error ? error.message : String(error),
              operationName: request.operationName,
            });
          }
        },
      };
    },
  };
}

/**
 * Utility function to wrap resolvers with automatic optimization
 */
export function withResponseOptimization<TArgs = any, TResult = any>(
  resolver: (parent: any, args: TArgs, context: any, info: GraphQLResolveInfo) => Promise<TResult>,
  config: ResponseOptimizationConfig = DEFAULT_CONFIG
) {
  return async (
    parent: any,
    args: TArgs,
    context: unknown,
    info: GraphQLResolveInfo
  ): Promise<TResult> => {
    const result = await resolver(parent, args, context, info);

    // Apply optimization to the result
    const { data } = optimizeResponse(result, info, config);
    return data;
  };
}

/**
 * Utility to check if response optimization is enabled
 */
export function isOptimizationEnabled(): boolean {
  return process.env.GRAPHQL_RESPONSE_OPTIMIZATION !== 'false';
}

/**
 * Utility to get optimization configuration for current environment
 */
export function getEnvironmentOptimizationConfig(): ResponseOptimizationConfig {
  const env = process.env.NODE_ENV || 'development';

  const baseConfig = createOptimizationConfig();

  // Environment-specific overrides
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        logOptimizations: false,
        warnThreshold: 512 * 1024, // 512KB
        maxPayloadSize: 5 * 1024 * 1024, // 5MB
      };
    case 'staging':
      return {
        ...baseConfig,
        logOptimizations: true,
        warnThreshold: 1024 * 1024, // 1MB
        maxPayloadSize: 8 * 1024 * 1024, // 8MB
      };
    default:
      return {
        ...baseConfig,
        logOptimizations: true,
        warnThreshold: 2 * 1024 * 1024, // 2MB
        maxPayloadSize: 10 * 1024 * 1024, // 10MB
      };
  }
}
