/**
 * GraphQL Query Complexity Analysis
 *
 * Implements query complexity analysis to prevent resource exhaustion
 * from overly complex GraphQL queries.
 *
 * Requirements: 21.2
 */

import { ValidationRule, GraphQLError } from 'graphql';
import { createComplexityLimitRule } from 'graphql-query-complexity';
import { ApolloServerPlugin } from '@apollo/server';

import { logger } from '../../shared/utils/logger.js';

import { complexityMonitor, createComplexityMetrics } from './complexityMonitoring.js';
import {
  type GraphQLRequestContextDidResolveOperationTyped,
  type GraphQLContext,
  type TypedGraphQLRequestListener,
} from './types.js';

/**
 * Complexity analysis configuration
 */
export interface ComplexityConfig {
  maximumComplexity: number;
  maximumDepth: number;
  scalarCost: number;
  objectCost: number;
  listFactor: number;
  introspectionCost: number;
  createError: (max: number, actual: number) => GraphQLError;
}

/**
 * Default complexity configuration
 */
const DEFAULT_COMPLEXITY_CONFIG: ComplexityConfig = {
  maximumComplexity: 1000,
  maximumDepth: 15,
  scalarCost: 1,
  objectCost: 2,
  listFactor: 10,
  introspectionCost: 1000,
  createError: (max: number, actual: number): GraphQLError => {
    return new GraphQLError(
      `Query complexity limit exceeded. Maximum allowed: ${max}, actual: ${actual}. ` +
      'Please reduce the complexity of your query or use pagination.',
      {
        extensions: {
          code: 'QUERY_COMPLEXITY_LIMIT_EXCEEDED',
          maximumComplexity: max,
          actualComplexity: actual,
        },
      }
    );
  },
};

/**
 * Environment-based complexity configuration
 */
export function getComplexityConfig(): ComplexityConfig {
  const env = process.env as Record<string, string | undefined>;
  
  return {
    ...DEFAULT_COMPLEXITY_CONFIG,
    maximumComplexity: parseInt(env['GRAPHQL_MAX_COMPLEXITY'] || '1000', 10),
    maximumDepth: parseInt(env['GRAPHQL_MAX_DEPTH'] || '15', 10),
  };
}

/**
 * Custom complexity estimator for specific fields
 */
export function createComplexityEstimator() {
  return {
    // Estimate complexity based on field type and arguments
    estimateComplexity: ({ field, node, childComplexity }: {
      field: { name: string; type: unknown };
      node: {
        arguments?: Array<{
          name: { value: string };
          value: { kind: string; value: string };
        }>;
      };
      childComplexity: number;
    }): number => {
      const fieldName = field.name;
      
      // Higher complexity for list fields with pagination
      if (fieldName.endsWith('Connection') || fieldName.endsWith('List')) {
        const firstArg = node.arguments?.find(arg => arg.name.value === 'first');
        const limitArg = node.arguments?.find(arg => arg.name.value === 'limit');
        
        if (firstArg && firstArg.value.kind === 'IntValue') {
          const limit = parseInt(firstArg.value.value, 10);
          return Math.max(1, limit / 10) * childComplexity;
        }
        
        if (limitArg && limitArg.value.kind === 'IntValue') {
          const limit = parseInt(limitArg.value.value, 10);
          return Math.max(1, limit / 10) * childComplexity;
        }
        
        // Default list complexity
        return 10 * childComplexity;
      }
      
      // Higher complexity for search and analytics fields
      if (fieldName.includes('search') || fieldName.includes('analytics')) {
        return 5 * childComplexity;
      }
      
      // Default complexity
      return childComplexity;
    },
  };
}

/**
 * Creates a complexity analysis rule with custom configuration
 */
export function createComplexityAnalysisRule(
  config: Partial<ComplexityConfig> = {}
): ValidationRule {
  const finalConfig = { ...DEFAULT_COMPLEXITY_CONFIG, ...config };
  
  return createComplexityLimitRule(finalConfig.maximumComplexity, {
    maximumDepth: finalConfig.maximumDepth,
    scalarCost: finalConfig.scalarCost,
    objectCost: finalConfig.objectCost,
    listFactor: finalConfig.listFactor,
    introspectionCost: finalConfig.introspectionCost,
    createError: finalConfig.createError,
    estimators: [createComplexityEstimator().estimateComplexity],
  });
}

/**
 * Complexity analysis plugin for Apollo Server
 */
export function createComplexityAnalysisPlugin(_config: Partial<ComplexityConfig> = {}): ApolloServerPlugin<GraphQLContext> {
  return {
    requestDidStart(): Promise<TypedGraphQLRequestListener> {
      return Promise.resolve({
        didResolveOperation: async (requestContext: GraphQLRequestContextDidResolveOperationTyped): Promise<void> => {
          try {
            const { request, document, operationName } = requestContext;
            
            if (!document) {
              return;
            }

            // Create complexity metrics for monitoring
            const metrics = createComplexityMetrics({
              query: request.query || '',
              operationName: operationName || undefined,
              variables: request.variables || {},
              complexity: 0, // Will be calculated by the validation rule
              depth: 0, // Will be calculated separately if needed
              executionTime: 0, // Will be set later
              timestamp: new Date(),
              userId: requestContext.contextValue?.user?.id,
            });

            // Record the operation for monitoring
            complexityMonitor.recordQuery(metrics);

            logger.debug('Query complexity analysis completed', {
              operationName: operationName || 'anonymous',
              userId: requestContext.contextValue?.user?.id,
              requestId: requestContext.contextValue?.requestId,
            });
          } catch (error) {
            logger.error('Complexity analysis failed', {
              error: error instanceof Error ? error.message : String(error),
              operationName: requestContext.operationName || 'anonymous',
              requestId: requestContext.contextValue?.requestId,
            });
          }
        },
      });
    },
  };
}

/**
 * Utility to calculate query depth
 */
export function calculateQueryDepth(document: unknown): number {
  // This is a simplified implementation
  // In a real scenario, you would traverse the AST to calculate actual depth
  try {
    const docString = JSON.stringify(document);
    const braceCount = (docString.match(/{/g) || []).length;
    return Math.min(braceCount, 20); // Cap at reasonable depth
  } catch {
    return 1;
  }
}

/**
 * Utility to estimate query complexity without validation
 */
export function estimateQueryComplexity(
  query: string,
  variables?: Record<string, unknown>
): number {
  try {
    // Simple heuristic-based complexity estimation
    let complexity = 0;
    
    // Count field selections
    const fieldMatches = query.match(/\w+\s*{/g) || [];
    complexity += fieldMatches.length * 2;
    
    // Count list operations
    const listMatches = query.match(/(first|last|limit):\s*\d+/g) || [];
    for (const match of listMatches) {
      const numberMatch = match.match(/\d+/);
      if (numberMatch) {
        const limit = parseInt(numberMatch[0], 10);
        complexity += Math.max(1, limit / 10);
      }
    }
    
    // Add complexity for variables
    if (variables) {
      complexity += Object.keys(variables).length;
    }
    
    return Math.max(1, complexity);
  } catch {
    return 1;
  }
}

/**
 * Utility to check if query exceeds complexity limits
 */
export function isQueryTooComplex(
  query: string,
  variables?: Record<string, unknown>,
  config: Partial<ComplexityConfig> = {}
): { isComplex: boolean; estimated: number; limit: number } {
  const finalConfig = { ...DEFAULT_COMPLEXITY_CONFIG, ...config };
  const estimated = estimateQueryComplexity(query, variables);
  
  return {
    isComplex: estimated > finalConfig.maximumComplexity,
    estimated,
    limit: finalConfig.maximumComplexity,
  };
}