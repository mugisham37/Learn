/**
 * GraphQL Infrastructure Index
 * 
 * Exports all GraphQL infrastructure components including Apollo Server
 * configuration, Fastify plugin, and context creation utilities.
 * 
 * Requirements: 21.1
 */

export { createApolloServer, createGraphQLContext } from './apolloServer.js';
export { default as apolloServerPlugin } from './fastifyApolloPlugin.js';
export type { GraphQLContext } from './apolloServer.js';

// Error formatting utilities
export {
  formatGraphQLError,
  createGraphQLError,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError
} from './errorFormatter.js';

// GraphQL utilities
export {
  requireAuth,
  requireRole,
  requireOwnershipOrAdmin,
  validateRequiredFields,
  validatePasswordStrength,
  withErrorHandling,
  validatePagination,
  createCursor,
  throwNotFound,
  throwConflict
} from './utils.js';

// Response optimization utilities
export {
  optimizeResponse,
  optimizeListResponse,
  optimizeOffsetListResponse,
  withResponseOptimization,
  getOptimizationStats,
  resetOptimizationStats,
  isOptimizationEnabled,
  type ResponseOptimizationConfig,
  type OptimizationMetrics
} from './responseOptimization.js';

// Field selection utilities
export {
  createFieldSelection,
  filterObjectFields,
  removeNullValues,
  optimizeGraphQLResponse,
  isFieldRequested,
  getNestedFieldSelection,
  createMinimalResponse,
  type FieldSelection
} from './fieldSelection.js';

// Pagination utilities
export {
  createConnection,
  createOptimizedConnection,
  createOffsetPagination,
  createOptimizedOffsetPagination,
  extractPaginationInput,
  extractOffsetPaginationInput,
  createPaginationConfig,
  type PaginationInput,
  type OffsetPaginationInput,
  type Connection,
  type Edge,
  type PageInfo,
  type OffsetPaginationResult,
  type PaginationConfig
} from './pagination.js';