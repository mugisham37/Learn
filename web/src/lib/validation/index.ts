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

// Export specific functions for compatibility
export { validateGraphQLResponse } from './runtimeValidation';

// Create runtime validator function
export function createRuntimeValidator<T>(schema: import('zod').ZodType<T>) {
  return (data: unknown): T => {
    return schema.parse(data);
  };
}

// GraphQL-specific validation utilities
export * from './graphqlValidation';
