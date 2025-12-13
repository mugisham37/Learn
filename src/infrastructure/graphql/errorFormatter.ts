/**
 * GraphQL Error Formatter
 *
 * Provides consistent error formatting for GraphQL responses, mapping domain errors
 * to GraphQL errors with proper codes, field-level validation details, and production sanitization.
 *
 * Requirements: 21.6
 */

import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
  DatabaseError,
  RateLimitError,
  isOperationalError,
  sanitizeError,
} from '../../shared/errors/index.js';

/**
 * GraphQL Error Extension interface
 * Defines the structure of error extensions for consistent formatting
 */
export interface GraphQLErrorExtensions {
  code: string;
  requestId?: string;
  field?: string;
  fields?: Array<{ field: string; message: string }>;
  statusCode?: number;
  timestamp?: string;
  details?: Record<string, unknown>;
}

/**
 * Formatted GraphQL Error interface
 * Defines the complete structure of formatted GraphQL errors
 */
export interface FormattedGraphQLError {
  message: string;
  locations?: ReadonlyArray<{
    line: number;
    column: number;
  }>;
  path?: ReadonlyArray<string | number>;
  extensions: GraphQLErrorExtensions;
}

/**
 * Maps domain errors to GraphQL error codes
 * Provides consistent error code mapping across the application
 */
const ERROR_CODE_MAP: Record<string, string> = {
  // Authentication & Authorization
  AUTHENTICATION_ERROR: 'UNAUTHENTICATED',
  AUTHORIZATION_ERROR: 'FORBIDDEN',

  // Validation & Input
  VALIDATION_ERROR: 'BAD_USER_INPUT',
  BAD_USER_INPUT: 'BAD_USER_INPUT',

  // Resource Management
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // External Services
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Database & Internal
  DATABASE_ERROR: 'INTERNAL_SERVER_ERROR',
  INTERNAL_ERROR: 'INTERNAL_SERVER_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMITED',

  // Default
  UNKNOWN_ERROR: 'INTERNAL_SERVER_ERROR',
};

/**
 * Maps domain errors to HTTP status codes for context
 */
const STATUS_CODE_MAP: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  BAD_USER_INPUT: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  EXTERNAL_SERVICE_ERROR: 502,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * Creates GraphQL error from domain error
 * Maps domain errors to appropriate GraphQL errors with consistent structure
 *
 * @param error - The domain error to convert
 * @param requestId - Request ID for correlation
 * @returns GraphQL error with proper extensions
 */
export function createGraphQLError(error: Error, requestId?: string): GraphQLError {
  const timestamp = new Date().toISOString();

  // Handle AppError instances (our domain errors)
  if (error instanceof AppError) {
    const code = ERROR_CODE_MAP[error.code] || 'INTERNAL_SERVER_ERROR';
    const statusCode = STATUS_CODE_MAP[code] || 500;

    const extensions: GraphQLErrorExtensions = {
      code,
      statusCode,
      timestamp: error.timestamp,
      requestId,
    };

    // Add field-level validation details for ValidationError
    if (error instanceof ValidationError && error.fields) {
      extensions.fields = error.fields;
      // If there's only one field error, also set the field property
      if (error.fields.length === 1) {
        extensions.field = error.fields[0].field;
      }
    }

    // Add additional details if available
    if (error.details) {
      extensions.details = error.details;
    }

    // Add specific error context
    if (error instanceof AuthorizationError) {
      if (error.requiredRole && error.userRole) {
        extensions.details = {
          ...extensions.details,
          requiredRole: error.requiredRole,
          userRole: error.userRole,
        };
      }
    }

    if (error instanceof NotFoundError) {
      extensions.details = {
        ...extensions.details,
        resourceType: error.resourceType,
        ...(error.resourceId && { resourceId: error.resourceId }),
      };
    }

    if (error instanceof ConflictError && error.conflictField) {
      extensions.field = error.conflictField;
    }

    if (error instanceof ExternalServiceError) {
      extensions.details = {
        ...extensions.details,
        serviceName: error.serviceName,
      };
    }

    return new GraphQLError(error.message, {
      extensions,
    });
  }

  // Handle GraphQLError instances (preserve existing structure)
  if (error instanceof GraphQLError) {
    const existingExtensions = error.extensions || {};
    const code = existingExtensions.code || 'INTERNAL_SERVER_ERROR';

    return new GraphQLError(error.message, {
      nodes: error.nodes,
      source: error.source,
      positions: error.positions,
      path: error.path,
      originalError: error.originalError,
      extensions: {
        ...existingExtensions,
        code,
        statusCode: STATUS_CODE_MAP[code] || 500,
        timestamp,
        requestId,
      },
    });
  }

  // Handle unknown errors
  const code = 'INTERNAL_SERVER_ERROR';
  return new GraphQLError(
    config.nodeEnv === 'production' ? 'An internal error occurred' : error.message,
    {
      extensions: {
        code,
        statusCode: 500,
        timestamp,
        requestId,
      },
    }
  );
}

/**
 * Formats GraphQL errors for consistent response structure
 * Implements production sanitization and comprehensive logging
 *
 * @param formattedError - The formatted error from GraphQL
 * @param error - The original error
 * @returns Formatted error response
 */
export function formatGraphQLError(
  formattedError: GraphQLFormattedError,
  error: unknown
): FormattedGraphQLError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  const requestId = (formattedError.extensions?.requestId as string) || 'unknown';

  // Log the error with full context
  logGraphQLError(formattedError, originalError, requestId);

  // In production, sanitize non-operational errors
  if (config.nodeEnv === 'production' && !isOperationalError(originalError)) {
    const sanitized = sanitizeError(originalError);
    const sanitizedGraphQLError = createGraphQLError(sanitized, requestId);

    return {
      message: sanitizedGraphQLError.message,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: sanitizedGraphQLError.extensions as GraphQLErrorExtensions,
    };
  }

  // Ensure extensions exist and have required properties
  const extensions: GraphQLErrorExtensions = {
    code: (formattedError.extensions?.code as string) || 'INTERNAL_SERVER_ERROR',
    requestId,
    timestamp: (formattedError.extensions?.timestamp as string) || new Date().toISOString(),
    ...(formattedError.extensions?.statusCode && {
      statusCode: formattedError.extensions.statusCode as number,
    }),
    ...(formattedError.extensions?.field && {
      field: formattedError.extensions.field as string,
    }),
    ...(formattedError.extensions?.fields && {
      fields: formattedError.extensions.fields as Array<{ field: string; message: string }>,
    }),
    ...(formattedError.extensions?.details && {
      details: formattedError.extensions.details as Record<string, unknown>,
    }),
  };

  return {
    message: formattedError.message,
    locations: formattedError.locations,
    path: formattedError.path,
    extensions,
  };
}

/**
 * Logs GraphQL errors with comprehensive context
 * Provides detailed logging for debugging and monitoring
 *
 * @param formattedError - The formatted GraphQL error
 * @param originalError - The original error object
 * @param requestId - Request ID for correlation
 */
function logGraphQLError(
  formattedError: GraphQLFormattedError,
  originalError: Error,
  requestId: string
): void {
  const logContext = {
    requestId,
    errorCode: formattedError.extensions?.code || 'UNKNOWN',
    errorMessage: formattedError.message,
    graphqlPath: formattedError.path,
    graphqlLocations: formattedError.locations,
    originalErrorName: originalError.constructor.name,
    originalErrorMessage: originalError.message,
    ...(formattedError.extensions?.statusCode && {
      statusCode: formattedError.extensions.statusCode,
    }),
    ...(formattedError.extensions?.field && {
      field: formattedError.extensions.field,
    }),
    ...(formattedError.extensions?.fields && {
      validationFields: formattedError.extensions.fields,
    }),
  };

  // Determine log level based on error type
  const errorCode = formattedError.extensions?.code as string;
  const statusCode = formattedError.extensions?.statusCode as number;

  if (errorCode === 'UNAUTHENTICATED' || errorCode === 'FORBIDDEN') {
    // Authentication/authorization errors are warnings
    logger.warn('GraphQL Authentication/Authorization Error', logContext);
  } else if (errorCode === 'BAD_USER_INPUT' || statusCode === 400) {
    // Validation errors are info level
    logger.info('GraphQL Validation Error', logContext);
  } else if (errorCode === 'NOT_FOUND' || statusCode === 404) {
    // Not found errors are info level
    logger.info('GraphQL Not Found Error', logContext);
  } else if (errorCode === 'CONFLICT' || statusCode === 409) {
    // Conflict errors are warnings
    logger.warn('GraphQL Conflict Error', logContext);
  } else if (errorCode === 'RATE_LIMITED' || statusCode === 429) {
    // Rate limit errors are warnings
    logger.warn('GraphQL Rate Limit Error', logContext);
  } else if (statusCode >= 500) {
    // Server errors are errors with stack trace
    logger.error('GraphQL Server Error', {
      ...logContext,
      stack: originalError.stack,
    });
  } else {
    // Other errors are warnings
    logger.warn('GraphQL Error', logContext);
  }
}

/**
 * Creates a validation error with field-level details
 * Helper function for creating consistent validation errors
 *
 * @param message - Main error message
 * @param fields - Array of field-level validation errors
 * @param requestId - Request ID for correlation
 * @returns GraphQL error with validation details
 */
export function createValidationError(
  message: string,
  fields: Array<{ field: string; message: string }>,
  requestId?: string
): GraphQLError {
  const validationError = new ValidationError(message, fields);
  return createGraphQLError(validationError, requestId);
}

/**
 * Creates an authentication error
 * Helper function for creating consistent authentication errors
 *
 * @param message - Error message
 * @param reason - Optional reason for authentication failure
 * @param requestId - Request ID for correlation
 * @returns GraphQL error for authentication failure
 */
export function createAuthenticationError(
  message?: string,
  reason?: string,
  requestId?: string
): GraphQLError {
  const authError = new AuthenticationError(message, reason);
  return createGraphQLError(authError, requestId);
}

/**
 * Creates an authorization error
 * Helper function for creating consistent authorization errors
 *
 * @param message - Error message
 * @param requiredRole - Required role for the operation
 * @param userRole - Current user's role
 * @param requestId - Request ID for correlation
 * @returns GraphQL error for authorization failure
 */
export function createAuthorizationError(
  message?: string,
  requiredRole?: string,
  userRole?: string,
  requestId?: string
): GraphQLError {
  const authzError = new AuthorizationError(message, requiredRole, userRole);
  return createGraphQLError(authzError, requestId);
}

/**
 * Creates a not found error
 * Helper function for creating consistent not found errors
 *
 * @param resourceType - Type of resource that was not found
 * @param resourceId - ID of the resource that was not found
 * @param requestId - Request ID for correlation
 * @returns GraphQL error for resource not found
 */
export function createNotFoundError(
  resourceType: string,
  resourceId?: string,
  requestId?: string
): GraphQLError {
  const notFoundError = new NotFoundError(resourceType, resourceId);
  return createGraphQLError(notFoundError, requestId);
}

/**
 * Creates a conflict error
 * Helper function for creating consistent conflict errors
 *
 * @param message - Error message
 * @param conflictField - Field that caused the conflict
 * @param requestId - Request ID for correlation
 * @returns GraphQL error for conflict
 */
export function createConflictError(
  message: string,
  conflictField?: string,
  requestId?: string
): GraphQLError {
  const conflictError = new ConflictError(message, conflictField);
  return createGraphQLError(conflictError, requestId);
}
