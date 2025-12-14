/**
 * GraphQL Infrastructure Type Definitions
 *
 * Centralized type definitions for GraphQL infrastructure components
 * to ensure type safety across the GraphQL layer.
 */

import { GraphQLRequestListener } from '@apollo/server';
import { GraphQLError, GraphQLFormattedError } from 'graphql';

/**
 * User context interface for GraphQL operations
 */
export interface GraphQLUserContext {
  userId: string;
  role: string;
  email?: string;
  permissions?: string[];
}

/**
 * GraphQL request context interface
 */
export interface GraphQLContext {
  user?: GraphQLUserContext;
  requestId: string;
  executionTime?: number;
  [key: string]: unknown;
}

/**
 * GraphQL request interface
 */
export interface GraphQLRequest {
  query?: string;
  operationName?: string;
  variables?: Record<string, unknown>;
  http?: {
    headers: Map<string, string>;
    requestId?: string;
  };
}

/**
 * GraphQL response interface
 */
export interface GraphQLResponse {
  body: {
    kind: 'single' | 'incremental';
    singleResult?: {
      data?: Record<string, unknown>;
      errors?: GraphQLError[];
    };
  };
  http: {
    status?: number;
    headers: Map<string, string>;
    body?: string;
  };
}

/**
 * GraphQL request context for plugins
 */
export interface GraphQLRequestContext {
  request: GraphQLRequest;
  response: GraphQLResponse;
  contextValue: GraphQLContext;
  operation?: {
    operation: 'query' | 'mutation' | 'subscription';
  };
  errors?: GraphQLError[];
}

/**
 * Complexity estimator arguments interface
 */
export interface ComplexityEstimatorArgs {
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
 * GraphQL document interface for complexity analysis
 */
export interface GraphQLDocument {
  definitions?: Array<{
    kind: string;
    selectionSet?: GraphQLSelectionSet;
    name?: { value: string };
  }>;
}

/**
 * GraphQL selection set interface
 */
export interface GraphQLSelectionSet {
  selections?: Array<{
    selectionSet?: GraphQLSelectionSet;
    arguments?: Array<{
      name: { value: string };
      value: { kind: string; value: string };
    }>;
  }>;
}

/**
 * HTTP GraphQL request interface
 */
export interface HTTPGraphQLRequest {
  headers: Map<string, string>;
  search: string;
  body?: string;
}

/**
 * Enhanced GraphQL error extensions
 */
export interface EnhancedGraphQLErrorExtensions {
  code: string;
  requestId?: string;
  field?: string;
  fields?: Array<{ field: string; message: string }>;
  statusCode?: number;
  timestamp?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Type-safe GraphQL request listener
 */
export type TypedGraphQLRequestListener = GraphQLRequestListener<GraphQLContext>;

/**
 * Pagination arguments interface
 */
export interface PaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
  page?: number;
  limit?: number;
}

/**
 * Field selection context interface
 */
export interface FieldSelectionContext {
  operationName?: string;
  query?: string;
  variables?: Record<string, unknown>;
}

/**
 * Response optimization context interface
 */
export interface ResponseOptimizationContext {
  operationName?: string;
  body?: {
    query?: string;
    operationName?: string;
    variables?: Record<string, unknown>;
  };
  http?: {
    setHeader: (name: string, value: string) => void;
  };
}

/**
 * Subscription server context interface
 */
export interface SubscriptionContext {
  connectionParams?: Record<string, unknown>;
  extra?: {
    user?: GraphQLUserContext;
    requestId?: string;
  };
}

/**
 * Subscription message interface
 */
export interface SubscriptionMessage {
  payload?: {
    query?: string;
    operationName?: string;
    variables?: Record<string, unknown>;
  };
}

/**
 * Data loader context interfaces
 */
export interface UserDataLoaderContext {
  userId: string;
  [key: string]: unknown;
}

export interface DataLoaderContext {
  courseId: string;
  [key: string]: unknown;
}

export interface EnrollmentDataLoaderContext {
  studentId: string;
  courseId: string;
  [key: string]: unknown;
}

/**
 * Environment variables interface
 */
export interface ProcessEnv {
  NODE_ENV?: string;
  GRAPHQL_MAX_COMPLEXITY?: string;
  GRAPHQL_MAX_DEPTH?: string;
  GRAPHQL_LOG_THRESHOLD?: string;
  GRAPHQL_ALERT_THRESHOLD?: string;
  GRAPHQL_DETAILED_LOGGING?: string;
  GRAPHQL_PERFORMANCE_TRACKING?: string;
  GRAPHQL_FIELD_SELECTION?: string;
  GRAPHQL_REMOVE_NULLS?: string;
  GRAPHQL_COMPRESSION_HINTS?: string;
  GRAPHQL_LOG_OPTIMIZATIONS?: string;
  GRAPHQL_MAX_PAYLOAD_SIZE?: string;
  GRAPHQL_WARN_THRESHOLD?: string;
  GRAPHQL_RESPONSE_OPTIMIZATION?: string;
  LOG_RESPONSE_OPTIMIZATION?: string;
  LOG_PAGINATION_OPTIMIZATION?: string;
  PAGINATION_DEFAULT_LIMIT?: string;
  PAGINATION_MAX_LIMIT?: string;
  PAGINATION_INCLUDE_TOTAL_COUNT?: string;
  [key: string]: string | undefined;
}

/**
 * Type guard for GraphQL user context
 */
export function isGraphQLUserContext(context: unknown): context is GraphQLUserContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'userId' in context &&
    'role' in context &&
    typeof (context as GraphQLUserContext).userId === 'string' &&
    typeof (context as GraphQLUserContext).role === 'string'
  );
}

/**
 * Type guard for GraphQL context
 */
export function isGraphQLContext(context: unknown): context is GraphQLContext {
  return (
    typeof context === 'object' &&
    context !== null &&
    'requestId' in context &&
    typeof (context as GraphQLContext).requestId === 'string'
  );
}