/**
 * Schema Integration Module
 * 
 * This module provides comprehensive GraphQL schema integration utilities
 * for synchronizing with the backend server and managing type generation.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

export {
  SchemaIntegration,
  schemaIntegration,
  checkSchemaCompatibility,
  getSchemaHealthStatus,
  type SchemaMetadata,
  type SchemaValidationResult,
  type SchemaSyncOptions,
} from './schemaIntegration.js';

// Re-export commonly used GraphQL utilities
export {
  IntrospectionQuery,
  buildClientSchema,
  printSchema,
  getIntrospectionQuery,
} from 'graphql';