/**
 * GraphQL Utilities
 *
 * Utility functions for GraphQL resolvers including authentication,
 * authorization, and error handling helpers.
 *
 * Requirements: 21.6, 21.7
 */

import { GraphQLError } from 'graphql';
import { GraphQLContext } from './apolloServer.js';
import {
  createAuthenticationError,
  createAuthorizationError,
  createValidationError,
  createNotFoundError,
  createConflictError,
  createGraphQLError,
} from './errorFormatter.js';

/**
 * Requires authentication for a resolver
 * Throws authentication error if user is not authenticated
 *
 * @param context - GraphQL context
 * @returns Authenticated user information
 * @throws GraphQLError if not authenticated
 */
export function requireAuth(context: GraphQLContext): {
  id: string;
  email: string;
  role: string;
} {
  if (!context.user) {
    throw createAuthenticationError(
      'Authentication required',
      'No valid authentication token provided',
      context.requestId
    );
  }

  return context.user;
}

/**
 * Requires specific role for a resolver
 * Throws authorization error if user doesn't have required role
 *
 * @param context - GraphQL context
 * @param allowedRoles - Array of allowed roles
 * @returns Authenticated user information
 * @throws GraphQLError if not authorized
 */
export function requireRole(
  context: GraphQLContext,
  allowedRoles: string[]
): {
  id: string;
  email: string;
  role: string;
} {
  const user = requireAuth(context);

  if (!allowedRoles.includes(user.role)) {
    throw createAuthorizationError(
      `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      allowedRoles.join(' or '),
      user.role,
      context.requestId
    );
  }

  return user;
}

/**
 * Requires ownership of a resource or admin role
 * Throws authorization error if user doesn't own resource and isn't admin
 *
 * @param context - GraphQL context
 * @param resourceOwnerId - ID of the resource owner
 * @param resourceType - Type of resource for error message
 * @returns Authenticated user information
 * @throws GraphQLError if not authorized
 */
export function requireOwnershipOrAdmin(
  context: GraphQLContext,
  resourceOwnerId: string,
  resourceType: string = 'resource'
): {
  id: string;
  email: string;
  role: string;
} {
  const user = requireAuth(context);

  if (user.id !== resourceOwnerId && user.role !== 'admin') {
    throw createAuthorizationError(
      `Access denied. You can only access your own ${resourceType}`,
      'owner or admin',
      user.role,
      context.requestId
    );
  }

  return user;
}

/**
 * Validates required input fields
 * Throws validation error if any required fields are missing or invalid
 *
 * @param input - Input object to validate
 * @param requiredFields - Array of required field names
 * @param context - GraphQL context for request ID
 * @throws GraphQLError if validation fails
 */
export function validateRequiredFields(
  input: Record<string, unknown>,
  requiredFields: Array<{
    field: string;
    type?: 'string' | 'number' | 'boolean' | 'email';
    minLength?: number;
    maxLength?: number;
  }>,
  context: GraphQLContext
): void {
  const errors: Array<{ field: string; message: string }> = [];

  for (const fieldConfig of requiredFields) {
    const { field, type, minLength, maxLength } = fieldConfig;
    const value = input[field];

    // Check if field is missing or empty
    if (value === undefined || value === null || value === '') {
      errors.push({
        field,
        message: `${field} is required`,
      });
      continue;
    }

    // Type validation
    if (type) {
      switch (type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push({
              field,
              message: `${field} must be a string`,
            });
            continue;
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push({
              field,
              message: `${field} must be a valid number`,
            });
            continue;
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push({
              field,
              message: `${field} must be a boolean`,
            });
            continue;
          }
          break;
        case 'email':
          if (typeof value !== 'string' || !isValidEmail(value)) {
            errors.push({
              field,
              message: `${field} must be a valid email address`,
            });
            continue;
          }
          break;
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (minLength && value.trim().length < minLength) {
        errors.push({
          field,
          message: `${field} must be at least ${minLength} characters long`,
        });
      }

      if (maxLength && value.length > maxLength) {
        errors.push({
          field,
          message: `${field} must not exceed ${maxLength} characters`,
        });
      }
    }
  }

  if (errors.length > 0) {
    throw createValidationError('Input validation failed', errors, context.requestId);
  }
}

/**
 * Validates email format
 *
 * @param email - Email string to validate
 * @returns True if email is valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates password strength
 *
 * @param password - Password to validate
 * @param context - GraphQL context for request ID
 * @throws GraphQLError if password is weak
 */
export function validatePasswordStrength(password: string, context: GraphQLContext): void {
  const errors: Array<{ field: string; message: string }> = [];

  if (password.length < 8) {
    errors.push({
      field: 'password',
      message: 'Password must be at least 8 characters long',
    });
  }

  if (!/[A-Z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one uppercase letter',
    });
  }

  if (!/[a-z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one lowercase letter',
    });
  }

  if (!/\d/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one number',
    });
  }

  if (errors.length > 0) {
    throw createValidationError(
      'Password does not meet strength requirements',
      errors,
      context.requestId
    );
  }
}

/**
 * Handles async resolver errors
 * Wraps resolver functions to provide consistent error handling
 *
 * @param resolver - The resolver function to wrap
 * @returns Wrapped resolver with error handling
 */
export function withErrorHandling<TArgs = any, TResult = any>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext, info: any) => Promise<TResult>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext, info: any): Promise<TResult> => {
    try {
      return await resolver(parent, args, context, info);
    } catch (error) {
      // If it's already a GraphQLError, re-throw it
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Convert domain errors to GraphQL errors
      if (error instanceof Error) {
        throw createGraphQLError(error, context.requestId);
      }

      // Handle unknown errors
      throw createGraphQLError(new Error('An unexpected error occurred'), context.requestId);
    }
  };
}

/**
 * Validates pagination input
 *
 * @param input - Pagination input
 * @param context - GraphQL context
 * @returns Validated pagination parameters
 */
export function validatePagination(
  input: {
    first?: number;
    after?: string;
    last?: number;
    before?: string;
  } = {},
  context: GraphQLContext
): {
  limit: number;
  offset: number;
  cursor?: string;
} {
  const { first, after, last, before } = input;

  // Validate that only one pagination method is used
  if (
    (first !== undefined || after !== undefined) &&
    (last !== undefined || before !== undefined)
  ) {
    throw createValidationError(
      'Cannot use both forward and backward pagination',
      [{ field: 'pagination', message: 'Use either first/after or last/before, not both' }],
      context.requestId
    );
  }

  // Validate limits
  const limit = first || last || 20; // Default to 20
  if (limit < 1 || limit > 100) {
    throw createValidationError(
      'Invalid pagination limit',
      [{ field: 'first', message: 'Limit must be between 1 and 100' }],
      context.requestId
    );
  }

  // For simplicity, convert cursor-based pagination to offset-based
  // In a real implementation, you'd decode the cursor to get the offset
  let offset = 0;
  if (after) {
    try {
      offset = parseInt(Buffer.from(after, 'base64').toString()) || 0;
    } catch {
      throw createValidationError(
        'Invalid cursor',
        [{ field: 'after', message: 'Invalid cursor format' }],
        context.requestId
      );
    }
  }

  return {
    limit,
    offset,
    cursor: after || before,
  };
}

/**
 * Creates a cursor for pagination
 *
 * @param offset - Current offset
 * @returns Base64 encoded cursor
 */
export function createCursor(offset: number): string {
  return Buffer.from(offset.toString()).toString('base64');
}

/**
 * Throws a not found error for a resource
 *
 * @param resourceType - Type of resource
 * @param resourceId - ID of resource
 * @param context - GraphQL context
 * @throws GraphQLError
 */
export function throwNotFound(
  resourceType: string,
  resourceId?: string,
  context?: GraphQLContext
): never {
  throw createNotFoundError(resourceType, resourceId, context?.requestId);
}

/**
 * Throws a conflict error
 *
 * @param message - Error message
 * @param field - Field that caused conflict
 * @param context - GraphQL context
 * @throws GraphQLError
 */
export function throwConflict(message: string, field?: string, context?: GraphQLContext): never {
  throw createConflictError(message, field, context?.requestId);
}
