/**
 * Runtime Validation Module
 * 
 * Exports runtime type validation utilities, GraphQL response validation,
 * and development-time type checking helpers.
 * 
 * Requirements: 8.4 - Runtime type validation for GraphQL responses
 */

// Runtime validation with Zod schemas
export * from './runtimeValidation';

// GraphQL-specific validation utilities
export * from './graphqlValidation';