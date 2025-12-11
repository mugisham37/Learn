/**
 * GraphQL Error Formatter Tests
 * 
 * Tests for GraphQL error formatting functionality including domain error mapping,
 * field-level validation details, and production sanitization.
 * 
 * Requirements: 21.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import {
  formatGraphQLError,
  createGraphQLError,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError
} from '../errorFormatter.js';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError
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

describe('GraphQL Error Formatter', () => {
  const mockRequestId = 'test-request-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGraphQLError', () => {
    it('should create GraphQL error from ValidationError with multiple field details', () => {
      const validationError = new ValidationError('Validation failed', [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is too short' }
      ]);

      const graphqlError = createGraphQLError(validationError, mockRequestId);

      expect(graphqlError).toBeInstanceOf(GraphQLError);
      expect(graphqlError.message).toBe('Validation failed');
      expect(graphqlError.extensions?.code).toBe('BAD_USER_INPUT');
      expect(graphqlError.extensions?.statusCode).toBe(400);
      expect(graphqlError.extensions?.requestId).toBe(mockRequestId);
      expect(graphqlError.extensions?.fields).toEqual([
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is too short' }
      ]);
      // Field property should not be set when there are multiple fields
      expect(graphqlError.extensions?.field).toBeUndefined();
    });

    it('should create GraphQL error from ValidationError with single field detail', () => {
      const validationError = new ValidationError('Email is required', [
        { field: 'email', message: 'Email is required' }
      ]);

      const graphqlError = createGraphQLError(validationError, mockRequestId);

      expect(graphqlError.extensions?.fields).toEqual([
        { field: 'email', message: 'Email is required' }
      ]);
      // Field property should be set when there's only one field
      expect(graphqlError.extensions?.field).toBe('email');
    });

    it('should create GraphQL error from AuthenticationError', () => {
      const authError = new AuthenticationError('Invalid credentials', 'bad_password');

      const graphqlError = createGraphQLError(authError, mockRequestId);

      expect(graphqlError.message).toBe('Invalid credentials');
      expect(graphqlError.extensions?.code).toBe('UNAUTHENTICATED');
      expect(graphqlError.extensions?.statusCode).toBe(401);
      expect(graphqlError.extensions?.details?.reason).toBe('bad_password');
    });

    it('should create GraphQL error from AuthorizationError with role details', () => {
      const authzError = new AuthorizationError('Access denied', 'admin', 'student');

      const graphqlError = createGraphQLError(authzError, mockRequestId);

      expect(graphqlError.message).toBe('Access denied');
      expect(graphqlError.extensions?.code).toBe('FORBIDDEN');
      expect(graphqlError.extensions?.statusCode).toBe(403);
      expect(graphqlError.extensions?.details?.requiredRole).toBe('admin');
      expect(graphqlError.extensions?.details?.userRole).toBe('student');
    });

    it('should create GraphQL error from NotFoundError', () => {
      const notFoundError = new NotFoundError('User', 'user-123');

      const graphqlError = createGraphQLError(notFoundError, mockRequestId);

      expect(graphqlError.message).toBe('User not found');
      expect(graphqlError.extensions?.code).toBe('NOT_FOUND');
      expect(graphqlError.extensions?.statusCode).toBe(404);
      expect(graphqlError.extensions?.details?.resourceType).toBe('User');
      expect(graphqlError.extensions?.details?.resourceId).toBe('user-123');
    });

    it('should create GraphQL error from ConflictError', () => {
      const conflictError = new ConflictError('Email already exists', 'email');

      const graphqlError = createGraphQLError(conflictError, mockRequestId);

      expect(graphqlError.message).toBe('Email already exists');
      expect(graphqlError.extensions?.code).toBe('CONFLICT');
      expect(graphqlError.extensions?.statusCode).toBe(409);
      expect(graphqlError.extensions?.field).toBe('email');
    });

    it('should preserve existing GraphQLError structure', () => {
      const existingError = new GraphQLError('Existing error', {
        extensions: {
          code: 'CUSTOM_ERROR',
          customField: 'custom value'
        }
      });

      const graphqlError = createGraphQLError(existingError, mockRequestId);

      expect(graphqlError.message).toBe('Existing error');
      expect(graphqlError.extensions?.code).toBe('CUSTOM_ERROR');
      expect(graphqlError.extensions?.customField).toBe('custom value');
      expect(graphqlError.extensions?.requestId).toBe(mockRequestId);
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error');

      const graphqlError = createGraphQLError(unknownError, mockRequestId);

      expect(graphqlError.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
      expect(graphqlError.extensions?.statusCode).toBe(500);
      expect(graphqlError.extensions?.requestId).toBe(mockRequestId);
    });
  });

  describe('formatGraphQLError', () => {
    it('should format GraphQL error with all required fields', () => {
      const formattedError: GraphQLFormattedError = {
        message: 'Test error',
        locations: [{ line: 1, column: 1 }],
        path: ['user', 'email'],
        extensions: {
          code: 'BAD_USER_INPUT',
          statusCode: 400,
          requestId: mockRequestId,
          field: 'email'
        }
      };

      const result = formatGraphQLError(formattedError, new Error('Original error'));

      expect(result.message).toBe('Test error');
      expect(result.locations).toEqual([{ line: 1, column: 1 }]);
      expect(result.path).toEqual(['user', 'email']);
      expect(result.extensions.code).toBe('BAD_USER_INPUT');
      expect(result.extensions.statusCode).toBe(400);
      expect(result.extensions.requestId).toBe(mockRequestId);
      expect(result.extensions.field).toBe('email');
    });

    it('should add default values for missing extensions', () => {
      const formattedError: GraphQLFormattedError = {
        message: 'Test error'
      };

      const result = formatGraphQLError(formattedError, new Error('Original error'));

      expect(result.extensions.code).toBe('INTERNAL_SERVER_ERROR');
      expect(result.extensions.requestId).toBe('unknown');
      expect(result.extensions.timestamp).toBeDefined();
    });
  });

  describe('Helper functions', () => {
    it('should create validation error with multiple fields', () => {
      const fields = [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is too short' }
      ];

      const error = createValidationError('Validation failed', fields, mockRequestId);

      expect(error.extensions?.code).toBe('BAD_USER_INPUT');
      expect(error.extensions?.fields).toEqual(fields);
    });

    it('should create authentication error', () => {
      const error = createAuthenticationError('Login failed', 'invalid_token', mockRequestId);

      expect(error.extensions?.code).toBe('UNAUTHENTICATED');
      expect(error.message).toBe('Login failed');
    });

    it('should create authorization error', () => {
      const error = createAuthorizationError('Access denied', 'admin', 'student', mockRequestId);

      expect(error.extensions?.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Access denied');
    });

    it('should create not found error', () => {
      const error = createNotFoundError('User', 'user-123', mockRequestId);

      expect(error.extensions?.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });

    it('should create conflict error', () => {
      const error = createConflictError('Email exists', 'email', mockRequestId);

      expect(error.extensions?.code).toBe('CONFLICT');
      expect(error.message).toBe('Email exists');
    });
  });

  describe('Error code mapping', () => {
    it('should map domain error codes to GraphQL codes correctly', () => {
      const testCases = [
        { domainError: new ValidationError('Test'), expectedCode: 'BAD_USER_INPUT' },
        { domainError: new AuthenticationError('Test'), expectedCode: 'UNAUTHENTICATED' },
        { domainError: new AuthorizationError('Test'), expectedCode: 'FORBIDDEN' },
        { domainError: new NotFoundError('Test'), expectedCode: 'NOT_FOUND' },
        { domainError: new ConflictError('Test'), expectedCode: 'CONFLICT' },
        { domainError: new DatabaseError('Test'), expectedCode: 'INTERNAL_SERVER_ERROR' }
      ];

      testCases.forEach(({ domainError, expectedCode }) => {
        const graphqlError = createGraphQLError(domainError, mockRequestId);
        expect(graphqlError.extensions?.code).toBe(expectedCode);
      });
    });
  });
});