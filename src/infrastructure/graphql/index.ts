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