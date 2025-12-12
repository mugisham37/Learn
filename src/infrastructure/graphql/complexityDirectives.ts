/**
 * GraphQL Complexity Directives
 * 
 * This module defines GraphQL directives for assigning custom complexity scores
 * to fields. This allows fine-grained control over query complexity calculation.
 * 
 * Requirements: 15.6
 */

import { GraphQLDirective, DirectiveLocation, GraphQLInt, GraphQLString } from 'graphql';

/**
 * @complexity directive for assigning custom complexity scores to fields
 * 
 * Usage:
 * type Query {
 *   expensiveOperation: Result @complexity(value: 100)
 *   searchCourses(query: String!): [Course!]! @complexity(value: 50, multipliers: ["first"])
 * }
 */
export const complexityDirective = new GraphQLDirective({
  name: 'complexity',
  description: 'Assigns a custom complexity score to a field',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    value: {
      type: GraphQLInt,
      description: 'The complexity score for this field',
      defaultValue: 1,
    },
    multipliers: {
      type: GraphQLString,
      description: 'Comma-separated list of argument names that should multiply the complexity',
    },
  },
});

/**
 * @rateLimit directive for fields that should have additional rate limiting
 * 
 * Usage:
 * type Mutation {
 *   sendEmail: Boolean @rateLimit(max: 10, window: "1h")
 * }
 */
export const rateLimitDirective = new GraphQLDirective({
  name: 'rateLimit',
  description: 'Applies rate limiting to a field',
  locations: [DirectiveLocation.FIELD_DEFINITION],
  args: {
    max: {
      type: GraphQLInt,
      description: 'Maximum number of requests allowed',
      defaultValue: 100,
    },
    window: {
      type: GraphQLString,
      description: 'Time window for rate limiting (e.g., "1h", "15m", "60s")',
      defaultValue: '1h',
    },
  },
});

/**
 * Schema definition for complexity directives
 */
export const complexityDirectiveTypeDefs = `
  """
  Assigns a custom complexity score to a field
  """
  directive @complexity(
    """
    The complexity score for this field
    """
    value: Int = 1
    
    """
    Comma-separated list of argument names that should multiply the complexity
    """
    multipliers: String
  ) on FIELD_DEFINITION

  """
  Applies rate limiting to a field
  """
  directive @rateLimit(
    """
    Maximum number of requests allowed
    """
    max: Int = 100
    
    """
    Time window for rate limiting (e.g., "1h", "15m", "60s")
    """
    window: String = "1h"
  ) on FIELD_DEFINITION
`;

/**
 * Field complexity scores for common operations
 * These can be used as reference values when assigning complexity
 */
export const FIELD_COMPLEXITY_SCORES = {
  // Basic operations
  SCALAR_FIELD: 1,
  OBJECT_FIELD: 2,
  LIST_FIELD: 5,
  
  // Database operations
  SIMPLE_QUERY: 5,
  COMPLEX_QUERY: 15,
  AGGREGATION: 25,
  
  // Search operations
  BASIC_SEARCH: 30,
  FULL_TEXT_SEARCH: 50,
  FACETED_SEARCH: 75,
  
  // Analytics operations
  SIMPLE_ANALYTICS: 20,
  COMPLEX_ANALYTICS: 40,
  REPORT_GENERATION: 60,
  
  // File operations
  FILE_UPLOAD: 10,
  FILE_PROCESSING: 30,
  
  // External API calls
  EXTERNAL_API_CALL: 20,
  PAYMENT_PROCESSING: 40,
  
  // Real-time operations
  SUBSCRIPTION: 15,
  NOTIFICATION: 10,
  
  // Expensive mutations
  BULK_OPERATION: 50,
  DATA_MIGRATION: 100,
} as const;

/**
 * Helper function to get complexity score for common field types
 */
export function getFieldComplexityScore(fieldType: string, hasArguments = false): number {
  const baseScore = FIELD_COMPLEXITY_SCORES[fieldType as keyof typeof FIELD_COMPLEXITY_SCORES] || 
                   FIELD_COMPLEXITY_SCORES.SCALAR_FIELD;
  
  // Add extra complexity for fields with arguments
  return hasArguments ? baseScore + 2 : baseScore;
}

/**
 * Complexity multipliers for pagination arguments
 */
export const PAGINATION_MULTIPLIERS = {
  first: (value: number) => Math.min(value, 100), // Cap at 100
  last: (value: number) => Math.min(value, 100),  // Cap at 100
  limit: (value: number) => Math.min(value, 100), // Cap at 100
  take: (value: number) => Math.min(value, 100),  // Cap at 100
} as const;

/**
 * Get multiplier value for pagination arguments
 */
export function getPaginationMultiplier(argName: string, argValue: any): number {
  const multiplierFn = PAGINATION_MULTIPLIERS[argName as keyof typeof PAGINATION_MULTIPLIERS];
  
  if (multiplierFn && typeof argValue === 'number') {
    return multiplierFn(argValue);
  }
  
  // Default multiplier for unknown pagination arguments
  if (typeof argValue === 'number') {
    return Math.min(argValue, 100);
  }
  
  return 1;
}