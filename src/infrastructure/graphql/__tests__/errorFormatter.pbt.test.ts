/**
 * Property-Based Tests for GraphQL Error Formatting
 * 
 * **Feature: learning-platform-backend, Property 70: GraphQL error formatting**
 * **Validates: Requirements 21.6**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { GraphQLFormattedError } from 'graphql';
import {
  formatGraphQLError,
  createGraphQLError
} from '../errorFormatter.js';
import {
  ValidationError,
  AuthenticationError
} from '../../../shared/errors/index.js';

// Mock the config
vi.mock('../../../config/index.js', () => ({
  config: {
    nodeEnv: 'test'
  }
}));

// Mock the logger
vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('GraphQL Error Formatting - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property: Error code consistency
   * For any domain error, the GraphQL error should have a consistent error code mapping
   */
  it('should consistently map domain errors to GraphQL error codes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (message, requestId) => {
          // Test ValidationError
          const validationError = new ValidationError(message, [
            { field: 'test', message: 'test error' }
          ]);
          const validationGraphQLError = createGraphQLError(validationError, requestId);
          
          expect(validationGraphQLError.extensions?.code).toBe('BAD_USER_INPUT');
          expect(validationGraphQLError.extensions?.statusCode).toBe(400);
          expect(validationGraphQLError.extensions?.requestId).toBe(requestId);
          expect(validationGraphQLError.message).toBe(message);

          // Test AuthenticationError
          const authError = new AuthenticationError(message);
          const authGraphQLError = createGraphQLError(authError, requestId);
          
          expect(authGraphQLError.extensions?.code).toBe('UNAUTHENTICATED');
          expect(authGraphQLError.extensions?.statusCode).toBe(401);
          expect(authGraphQLError.extensions?.requestId).toBe(requestId);
          expect(authGraphQLError.message).toBe(message);
        }
      )
    );
  });

  /**
   * Property: Field-level validation details preservation
   * For any validation error with fields, all field details should be preserved
   */
  it('should preserve all field-level validation details', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 5 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (message, fieldCount, requestId) => {
          const fields = Array.from({ length: fieldCount }, (_, i) => ({
            field: `field${i}`,
            message: `Error for field ${i}`
          }));

          const validationError = new ValidationError(message, fields);
          const graphqlError = createGraphQLError(validationError, requestId);

          // Property: All fields are preserved
          expect(graphqlError.extensions?.fields).toEqual(fields);
          
          // Property: Single field gets field property, multiple fields don't
          if (fields.length === 1) {
            expect(graphqlError.extensions?.field).toBe(fields[0].field);
          } else {
            expect(graphqlError.extensions?.field).toBeUndefined();
          }
          
          // Property: Field count matches input
          expect((graphqlError.extensions?.fields as any[])?.length).toBe(fields.length);
        }
      )
    );
  });

  /**
   * Property: Error formatting consistency
   * For any formatted GraphQL error, the output should have consistent structure
   */
  it('should produce consistent error structure for any formatted error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (message, code, requestId) => {
          const formattedError: GraphQLFormattedError = {
            message,
            extensions: {
              code,
              requestId
            }
          };

          const result = formatGraphQLError(formattedError, new Error('Test error'));

          // Property: Message is preserved
          expect(result.message).toBe(message);
          
          // Property: Extensions always exist and have required fields
          expect(result.extensions).toBeDefined();
          expect(result.extensions.code).toBeDefined();
          expect(result.extensions.requestId).toBeDefined();
          expect(result.extensions.timestamp).toBeDefined();
          
          // Property: Code is preserved
          expect(result.extensions.code).toBe(code);
          
          // Property: Request ID is preserved
          expect(result.extensions.requestId).toBe(requestId);
        }
      )
    );
  });

  /**
   * Property: Unknown error handling
   * For any unknown error, it should be converted to a safe GraphQL error
   */
  it('should safely handle unknown errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (errorMessage, requestId) => {
          const unknownError = new Error(errorMessage);
          const graphqlError = createGraphQLError(unknownError, requestId);

          // Property: Unknown errors get INTERNAL_SERVER_ERROR code
          expect(graphqlError.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
          
          // Property: Status code is 500
          expect(graphqlError.extensions?.statusCode).toBe(500);
          
          // Property: Request ID is preserved
          expect(graphqlError.extensions?.requestId).toBe(requestId);
          
          // Property: Timestamp is added
          expect(graphqlError.extensions?.timestamp).toBeDefined();
          
          // Property: Message is preserved in test environment
          expect(graphqlError.message).toBe(errorMessage);
        }
      )
    );
  });
});