/**
 * Schema Integration Utilities
 *
 * This module provides utilities for managing GraphQL schema integration
 * between the frontend and backend, including validation and synchronization.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { IntrospectionQuery, buildClientSchema, printSchema } from 'graphql';

/**
 * Schema metadata interface
 */
export interface SchemaMetadata {
  extractedAt: string;
  endpoint: string;
  stats: {
    types: number;
    queries: number;
    mutations: number;
    subscriptions: number;
  };
  version: string;
  hash?: string;
}

/**
 * Schema validation result interface
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: Array<{
    message: string;
    code?: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  stats: SchemaMetadata['stats'];
  health: {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  };
}

/**
 * Schema synchronization options
 */
export interface SchemaSyncOptions {
  endpoint?: string;
  validateBeforeUse?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Schema integration class for managing GraphQL schema operations
 */
export class SchemaIntegration {
  private endpoint: string;
  private metadata: SchemaMetadata | null = null;
  private lastValidation: SchemaValidationResult | null = null;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Fetches the GraphQL schema from the backend server
   */
  async fetchSchema(options: SchemaSyncOptions = {}): Promise<IntrospectionQuery> {
    const {
      endpoint = this.endpoint,
      retryAttempts = 3,
      retryDelay = 1000,
      timeout = 10000,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            query: `
              query IntrospectionQuery {
                __schema {
                  queryType { name }
                  mutationType { name }
                  subscriptionType { name }
                  types {
                    ...FullType
                  }
                  directives {
                    name
                    description
                    locations
                    args {
                      ...InputValue
                    }
                  }
                }
              }

              fragment FullType on __Type {
                kind
                name
                description
                fields(includeDeprecated: true) {
                  name
                  description
                  args {
                    ...InputValue
                  }
                  type {
                    ...TypeRef
                  }
                  isDeprecated
                  deprecationReason
                }
                inputFields {
                  ...InputValue
                }
                interfaces {
                  ...TypeRef
                }
                enumValues(includeDeprecated: true) {
                  name
                  description
                  isDeprecated
                  deprecationReason
                }
                possibleTypes {
                  ...TypeRef
                }
              }

              fragment InputValue on __InputValue {
                name
                description
                type { ...TypeRef }
                defaultValue
              }

              fragment TypeRef on __Type {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                        ofType {
                          kind
                          name
                          ofType {
                            kind
                            name
                            ofType {
                              kind
                              name
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        if (!result.data?.__schema) {
          throw new Error('Invalid introspection response');
        }

        return result.data;
      } catch (error) {
        lastError = error as Error;

        if (attempt < retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw lastError || new Error('Schema fetch failed');
  }

  /**
   * Validates the schema structure and health
   */
  validateSchema(introspectionResult: IntrospectionQuery): SchemaValidationResult {
    const errors: SchemaValidationResult['errors'] = [];

    try {
      const schema = buildClientSchema(introspectionResult);

      // Get schema statistics
      const queryType = schema.getQueryType();
      const mutationType = schema.getMutationType();
      const subscriptionType = schema.getSubscriptionType();

      const typeMap = schema.getTypeMap();
      const customTypes = Object.keys(typeMap).filter(name => !name.startsWith('__'));

      const queryFields = queryType ? Object.keys(queryType.getFields()) : [];
      const mutationFields = mutationType ? Object.keys(mutationType.getFields()) : [];
      const subscriptionFields = subscriptionType ? Object.keys(subscriptionType.getFields()) : [];

      const stats = {
        types: customTypes.length,
        queries: queryFields.length,
        mutations: mutationFields.length,
        subscriptions: subscriptionFields.length,
      };

      // Validation checks
      if (!queryType) {
        errors.push({
          message: 'Schema is missing Query type',
          code: 'MISSING_QUERY_TYPE',
          severity: 'error',
        });
      }

      // Check for placeholder operations
      const hasPlaceholders =
        queryFields.includes('_empty') ||
        mutationFields.includes('_empty') ||
        subscriptionFields.includes('_empty');

      if (hasPlaceholders) {
        errors.push({
          message: 'Schema contains placeholder operations (_empty)',
          code: 'PLACEHOLDER_OPERATIONS',
          severity: 'warning',
        });
      }

      // Check for required scalars
      const requiredScalars = ['DateTime', 'JSON', 'Upload'];
      requiredScalars.forEach(scalar => {
        if (!typeMap[scalar]) {
          errors.push({
            message: `Missing required scalar: ${scalar}`,
            code: 'MISSING_SCALAR',
            severity: 'warning',
          });
        }
      });

      // Calculate health score
      let healthScore = 0;

      // Base score for having required types
      if (queryType) healthScore += 20;
      if (mutationType) healthScore += 15;
      if (subscriptionType) healthScore += 10;

      // Score for operation completeness
      if (queryFields.length > 1 || !queryFields.includes('_empty')) healthScore += 20;
      if (mutationFields.length > 1 || !mutationFields.includes('_empty')) healthScore += 15;
      if (subscriptionFields.length > 1 || !subscriptionFields.includes('_empty'))
        healthScore += 10;

      // Score for type richness
      if (customTypes.length > 10) healthScore += 10;

      const healthStatus =
        healthScore >= 80
          ? 'excellent'
          : healthScore >= 60
            ? 'good'
            : healthScore >= 40
              ? 'fair'
              : 'poor';

      // Generate recommendations
      const recommendations: string[] = [];

      if (hasPlaceholders) {
        recommendations.push('Replace placeholder operations with real implementations');
      }

      if (queryFields.length < 5) {
        recommendations.push('Add more query operations for better API coverage');
      }

      if (mutationFields.length < 3) {
        recommendations.push('Add more mutation operations for CRUD functionality');
      }

      if (subscriptionFields.length === 0) {
        recommendations.push('Consider adding subscription operations for real-time features');
      }

      const result: SchemaValidationResult = {
        valid: errors.filter(e => e.severity === 'error').length === 0,
        errors,
        stats,
        health: {
          score: healthScore,
          status: healthStatus,
          recommendations,
        },
      };

      this.lastValidation = result;
      return result;
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            message: `Schema validation failed: ${(error as Error).message}`,
            code: 'VALIDATION_ERROR',
            severity: 'error',
          },
        ],
        stats: { types: 0, queries: 0, mutations: 0, subscriptions: 0 },
        health: {
          score: 0,
          status: 'poor',
          recommendations: ['Fix schema parsing errors'],
        },
      };
    }
  }

  /**
   * Converts introspection result to SDL (Schema Definition Language)
   */
  introspectionToSDL(introspectionResult: IntrospectionQuery): string {
    try {
      const schema = buildClientSchema(introspectionResult);
      return printSchema(schema);
    } catch (error) {
      throw new Error(`Failed to convert introspection to SDL: ${(error as Error).message}`);
    }
  }

  /**
   * Checks if the schema has changed compared to a previous version
   */
  hasSchemaChanged(newSDL: string, previousSDL?: string): boolean {
    if (!previousSDL) {
      return true; // First time, consider it changed
    }

    // Simple string comparison (could be enhanced with semantic comparison)
    return newSDL !== previousSDL;
  }

  /**
   * Gets the current schema metadata
   */
  getMetadata(): SchemaMetadata | null {
    return this.metadata;
  }

  /**
   * Gets the last validation result
   */
  getLastValidation(): SchemaValidationResult | null {
    return this.lastValidation;
  }

  /**
   * Updates the schema metadata
   */
  updateMetadata(metadata: Partial<SchemaMetadata>): void {
    this.metadata = {
      ...this.metadata,
      ...metadata,
    } as SchemaMetadata;
  }

  /**
   * Performs a complete schema synchronization workflow
   */
  async synchronize(options: SchemaSyncOptions = {}): Promise<{
    success: boolean;
    schemaSDL?: string;
    validation?: SchemaValidationResult;
    metadata?: SchemaMetadata;
    error?: string;
  }> {
    try {
      // Step 1: Fetch schema
      const introspectionResult = await this.fetchSchema(options);

      // Step 2: Validate schema if requested
      let validation: SchemaValidationResult | undefined;
      if (options.validateBeforeUse !== false) {
        validation = this.validateSchema(introspectionResult);

        if (!validation.valid) {
          const criticalErrors = validation.errors.filter(e => e.severity === 'error');
          if (criticalErrors.length > 0) {
            throw new Error(
              `Schema validation failed: ${criticalErrors.map(e => e.message).join(', ')}`
            );
          }
        }
      }

      // Step 3: Convert to SDL
      const schemaSDL = this.introspectionToSDL(introspectionResult);

      // Step 4: Update metadata
      const metadata: SchemaMetadata = {
        extractedAt: new Date().toISOString(),
        endpoint: options.endpoint || this.endpoint,
        stats: validation?.stats || { types: 0, queries: 0, mutations: 0, subscriptions: 0 },
        version: '1.0.0',
      };

      this.updateMetadata(metadata);

      return {
        success: true,
        schemaSDL,
        validation,
        metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Default schema integration instance
 */
export const schemaIntegration = new SchemaIntegration(
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:3000/graphql'
);

/**
 * Utility function to check schema compatibility
 */
export function checkSchemaCompatibility(
  currentSchema: string,
  newSchema: string
): {
  compatible: boolean;
  breakingChanges: string[];
  safeChanges: string[];
} {
  // Simple compatibility check (could be enhanced with proper schema diffing)
  const compatible = currentSchema === newSchema;

  return {
    compatible,
    breakingChanges: compatible ? [] : ['Schema structure changed'],
    safeChanges: compatible ? [] : ['Schema updated'],
  };
}

/**
 * Utility function to get schema health status
 */
export function getSchemaHealthStatus(validation: SchemaValidationResult): {
  status: string;
  color: string;
  message: string;
} {
  const { health } = validation;

  switch (health.status) {
    case 'excellent':
      return {
        status: 'Excellent',
        color: 'green',
        message: 'Schema is in excellent condition',
      };
    case 'good':
      return {
        status: 'Good',
        color: 'blue',
        message: 'Schema is in good condition with minor improvements possible',
      };
    case 'fair':
      return {
        status: 'Fair',
        color: 'yellow',
        message: 'Schema needs some improvements',
      };
    case 'poor':
      return {
        status: 'Poor',
        color: 'red',
        message: 'Schema needs significant improvements',
      };
    default:
      return {
        status: 'Unknown',
        color: 'gray',
        message: 'Schema status unknown',
      };
  }
}
