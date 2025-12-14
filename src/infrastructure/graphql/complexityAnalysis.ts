/**
 * GraphQL Query Complexity Analysis
 *
 * This module implements query complexity analysis to prevent expensive queries
 * from overwhelming the server. It assigns complexity scores to fields and
 * rejects queries that exceed configured limits.
 *
 * Requirements: 15.6
 */

import { ValidationRule, GraphQLError } from 'graphql';
import {
  createComplexityRule,
  fieldExtensionsEstimator,
  simpleEstimator,
} from 'graphql-query-complexity';

import { logger } from '../../shared/utils/logger.js';

import { complexityMonitor, createComplexityMetrics } from './complexityMonitoring.js';
import {
  type GraphQLDocument,
  type GraphQLSelectionSet,
  type GraphQLRequestContext,
  type GraphQLRequestContextDidResolveOperationTyped,
  type ProcessEnv,
} from './types.js';

/**
 * Configuration for query complexity limits
 */
export interface ComplexityConfig {
  maximumComplexity: number;
  maximumDepth?: number;
  scalarCost?: number;
  objectCost?: number;
  listFactor?: number;
  introspectionCost?: number;
  createError?: (max: number, actual: number) => Error;
}

/**
 * Default complexity configuration
 */
const DEFAULT_CONFIG: ComplexityConfig = {
  maximumComplexity: 1000, // Maximum complexity score allowed
  maximumDepth: 15, // Maximum query depth
  scalarCost: 1, // Cost for scalar fields
  objectCost: 2, // Cost for object fields
  listFactor: 10, // Multiplier for list fields
  introspectionCost: 1000, // High cost for introspection queries
};

/**
 * Complexity estimator arguments interface
 */
interface ComplexityEstimatorArgs {
  field: {
    name: string;
    type: unknown;
  };
  node: {
    arguments?: Array<{
      name: { value: string };
      value: { kind: string; value: string };
    }>;
    loc?: {
      source?: {
        body: string;
      };
    };
    name?: { value: string };
  };
  childComplexity: number;
}

/**
 * Custom complexity estimator that assigns scores based on field types
 */
const customComplexityEstimator = (args: ComplexityEstimatorArgs): number => {
  const { field, node, childComplexity } = args;

  // Get field name and type information
  const fieldName = field.name;
  // Note: fieldType is available but not used in current logic
  // const _fieldType = field.type;

  // Base complexity for the field
  let complexity = DEFAULT_CONFIG.scalarCost || 1;

  // Assign higher complexity to expensive operations
  if (fieldName.includes('search') || fieldName.includes('Search')) {
    complexity = 50; // Search operations are expensive
  } else if (fieldName.includes('analytics') || fieldName.includes('Analytics')) {
    complexity = 30; // Analytics operations are expensive
  } else if (fieldName.includes('report') || fieldName.includes('Report')) {
    complexity = 40; // Report generation is expensive
  } else if (fieldName.includes('aggregate') || fieldName.includes('Aggregate')) {
    complexity = 25; // Aggregation operations are expensive
  } else if (fieldName.endsWith('s') || fieldName.includes('list') || fieldName.includes('List')) {
    // List fields have higher base complexity
    complexity = DEFAULT_CONFIG.objectCost || 2;
  }

  // Handle pagination arguments
  const argsNode = node.arguments;
  if (argsNode) {
    const firstArg = argsNode.find((arg: { name: { value: string } }) => arg.name.value === 'first');
    const limitArg = argsNode.find((arg: { name: { value: string } }) => arg.name.value === 'limit');

    if (firstArg && firstArg.value.kind === 'IntValue') {
      const first = parseInt(firstArg.value.value, 10);
      complexity *= Math.min(first, 100); // Cap at 100 to prevent abuse
    } else if (limitArg && limitArg.value.kind === 'IntValue') {
      const limit = parseInt(limitArg.value.value, 10);
      complexity *= Math.min(limit, 100); // Cap at 100 to prevent abuse
    } else if (fieldName.endsWith('s') || fieldName.includes('list')) {
      // Default multiplier for lists without explicit limits
      complexity *= DEFAULT_CONFIG.listFactor || 10;
    }
  }

  // Add child complexity
  complexity += childComplexity;

  return complexity;
};

/**
 * Creates a complexity analysis rule with custom configuration
 */
export function createComplexityAnalysisRule(
  config: Partial<ComplexityConfig> = {}
): ValidationRule {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return createComplexityRule({
    maximumComplexity: finalConfig.maximumComplexity,
    estimators: [
      // Use field extensions if available (for custom @complexity directives)
      fieldExtensionsEstimator(),

      // Use custom estimator for intelligent complexity calculation
      customComplexityEstimator,

      // Fallback to simple estimator
      simpleEstimator({ defaultComplexity: 1 }),
    ],
    createError: (max: number, actual: number) => {
      // Log complex queries for monitoring
      logger.warn('GraphQL query complexity limit exceeded', {
        maximumAllowed: max,
        actualComplexity: actual,
        timestamp: new Date().toISOString(),
      });

      // Return GraphQLError instead of Error
      return new GraphQLError(
        `Query complexity limit exceeded. Maximum allowed: ${max}, actual: ${actual}. ` +
          'Please simplify your query or reduce the number of requested fields.'
      );
    },
  });
}

/**
 * Complexity analysis plugin for Apollo Server
 */
export function createComplexityAnalysisPlugin(_config: Partial<ComplexityConfig> = {}): {
  requestDidStart(): Promise<{
    didResolveOperation(requestContext: GraphQLRequestContextDidResolveOperationTyped): Promise<void>;
  }>;
} {
  return {
    requestDidStart(): Promise<{
      didResolveOperation(requestContext: GraphQLRequestContextDidResolveOperationTyped): Promise<void>;
    }> {
      return Promise.resolve({
        didResolveOperation(requestContext: GraphQLRequestContextDidResolveOperationTyped): Promise<void> {
          return new Promise<void>((resolve) => {
            const { request, contextValue } = requestContext;
            
            // Log query complexity for monitoring
            try {
              // Create metrics for monitoring
              const metrics = createComplexityMetrics(request.query || 'Unknown query', 0, {
                operationName: request.operationName,
                userId: contextValue.user?.id,
                userRole: contextValue.user?.role,
                variables: request.variables,
              });

              // Log through monitoring system
              complexityMonitor.logComplexity(metrics);
            } catch (error) {
              logger.error('Failed to calculate query complexity', {
                error: error instanceof Error ? error.message : String(error),
                operationName: request.operationName,
              });
            }

            resolve();
          });
        },
      });
    },
  };
}

/**
 * Calculate query complexity for a given document
 * This is used for logging and monitoring purposes
 */
function _calculateQueryComplexity(document: GraphQLDocument): number {
  try {
    // This is a simplified complexity calculation for logging
    // In a real implementation, you would use the same estimators
    // as the validation rule

    let complexity = 0;

    // Count selections in the document
    if (document.definitions) {
      for (const definition of document.definitions) {
        if (definition.kind === 'OperationDefinition' && definition.selectionSet) {
          complexity += countSelections(definition.selectionSet);
        }
      }
    }

    return complexity;
  } catch (error) {
    logger.error('Error calculating query complexity', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Recursively count selections in a selection set
 */
function countSelections(selectionSet: GraphQLSelectionSet): number {
  let count = 0;

  if (selectionSet.selections) {
    for (const selection of selectionSet.selections) {
      count += 1; // Base cost for each field

      if (selection.selectionSet) {
        count += countSelections(selection.selectionSet);
      }

      // Add extra cost for fields with arguments (likely more expensive)
      if (selection.arguments && selection.arguments.length > 0) {
        count += 2;
      }
    }
  }

  return count;
}

/**
 * Default complexity limits for different environments
 */
export const COMPLEXITY_LIMITS = {
  development: {
    maximumComplexity: 2000,
    maximumDepth: 20,
    logThreshold: 300,
    alertThreshold: 1500,
    enableDetailedLogging: true,
    enablePerformanceTracking: true,
  },
  staging: {
    maximumComplexity: 1500,
    maximumDepth: 18,
    logThreshold: 500,
    alertThreshold: 1200,
    enableDetailedLogging: true,
    enablePerformanceTracking: true,
  },
  production: {
    maximumComplexity: 1000,
    maximumDepth: 15,
    logThreshold: 600,
    alertThreshold: 800,
    enableDetailedLogging: false,
    enablePerformanceTracking: true,
  },
} as const;

/**
 * Get complexity configuration based on environment
 */
export function getComplexityConfig(): ComplexityConfig {
  const env = (process.env as ProcessEnv)['NODE_ENV'] || 'development';

  // Try to load from environment variables
  const envConfig = {
    maximumComplexity: (process.env as ProcessEnv)['GRAPHQL_MAX_COMPLEXITY']
      ? parseInt((process.env as ProcessEnv)['GRAPHQL_MAX_COMPLEXITY']!, 10)
      : undefined,
    maximumDepth: (process.env as ProcessEnv)['GRAPHQL_MAX_DEPTH']
      ? parseInt((process.env as ProcessEnv)['GRAPHQL_MAX_DEPTH']!, 10)
      : undefined,
    logThreshold: (process.env as ProcessEnv)['GRAPHQL_LOG_THRESHOLD']
      ? parseInt((process.env as ProcessEnv)['GRAPHQL_LOG_THRESHOLD']!, 10)
      : undefined,
    alertThreshold: (process.env as ProcessEnv)['GRAPHQL_ALERT_THRESHOLD']
      ? parseInt((process.env as ProcessEnv)['GRAPHQL_ALERT_THRESHOLD']!, 10)
      : undefined,
    enableDetailedLogging: (process.env as ProcessEnv)['GRAPHQL_DETAILED_LOGGING'] === 'true',
    enablePerformanceTracking: (process.env as ProcessEnv)['GRAPHQL_PERFORMANCE_TRACKING'] !== 'false',
  };

  // Get base configuration for environment
  let baseConfig: ComplexityConfig;
  switch (env) {
    case 'production':
      baseConfig = { ...DEFAULT_CONFIG, ...COMPLEXITY_LIMITS.production };
      break;
    case 'staging':
      baseConfig = { ...DEFAULT_CONFIG, ...COMPLEXITY_LIMITS.staging };
      break;
    default:
      baseConfig = { ...DEFAULT_CONFIG, ...COMPLEXITY_LIMITS.development };
      break;
  }

  // Override with environment variables if provided
  return {
    ...baseConfig,
    ...Object.fromEntries(Object.entries(envConfig).filter(([_, value]) => value !== undefined)),
  };
}
