/**
 * Custom Error Classes
 * 
 * Standardized error classes for consistent error handling across the application.
 * Implements hierarchical error handling strategy as per Requirements 13.1 and 17.2.
 */

/**
 * Base application error class
 * All custom errors extend from this class
 */
export class AppError extends Error {
  public readonly timestamp: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * ValidationError
 * Represents invalid input data with detailed field-level validation failures
 * HTTP Status: 400
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Array<{ field: string; message: string }>
  ) {
    super(
      message,
      400,
      'VALIDATION_ERROR',
      fields ? { fields } : undefined
    );
  }
}

/**
 * AuthenticationError
 * Signals invalid credentials, expired tokens, or missing authentication
 * HTTP Status: 401
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication failed',
    public readonly reason?: string
  ) {
    super(
      message,
      401,
      'AUTHENTICATION_ERROR',
      reason ? { reason } : undefined
    );
  }
}

/**
 * AuthorizationError
 * Indicates insufficient permissions for the requested action
 * HTTP Status: 403
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Access forbidden',
    public readonly requiredRole?: string,
    public readonly userRole?: string
  ) {
    super(
      message,
      403,
      'AUTHORIZATION_ERROR',
      requiredRole && userRole ? { requiredRole, userRole } : undefined
    );
  }
}

/**
 * NotFoundError
 * Represents requested resources that don't exist
 * HTTP Status: 404
 */
export class NotFoundError extends AppError {
  constructor(
    public readonly resourceType: string = 'Resource',
    public readonly resourceId?: string
  ) {
    super(
      `${resourceType} not found`,
      404,
      'NOT_FOUND',
      resourceId ? { resourceType, resourceId } : { resourceType }
    );
  }
}

/**
 * ConflictError
 * Signals duplicate data or state conflicts
 * HTTP Status: 409
 */
export class ConflictError extends AppError {
  constructor(
    message: string,
    public readonly conflictField?: string
  ) {
    super(
      message,
      409,
      'CONFLICT',
      conflictField ? { conflictField } : undefined
    );
  }
}

/**
 * ExternalServiceError
 * Wraps failures from third-party APIs (Stripe, AWS, SendGrid)
 * HTTP Status: 502 or 503
 */
export class ExternalServiceError extends AppError {
  constructor(
    public readonly serviceName: string,
    message: string,
    public readonly originalError?: Error,
    statusCode: number = 502
  ) {
    super(
      `${serviceName} error: ${message}`,
      statusCode,
      'EXTERNAL_SERVICE_ERROR',
      {
        serviceName,
        originalError: originalError?.message
      }
    );
  }
}

/**
 * DatabaseError
 * Represents database operation failures
 * HTTP Status: 500
 */
export class DatabaseError extends AppError {
  constructor(
    message: string,
    public readonly operation?: string,
    public readonly originalError?: Error
  ) {
    super(
      message,
      500,
      'DATABASE_ERROR',
      {
        operation,
        // Sanitize error to avoid exposing schema details
        error: originalError?.message
      },
      false // Database errors are not operational
    );
  }
}

/**
 * RateLimitError
 * Indicates rate limit exceeded
 * HTTP Status: 429
 * Implements requirement 13.6 - proper rate limit error with headers
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests',
    public readonly limit?: number,
    public readonly resetTime?: Date,
    public readonly remaining?: number,
    public readonly retryAfter?: number
  ) {
    const details: Record<string, unknown> = {};
    
    if (limit !== undefined) details.limit = limit;
    if (resetTime) details.resetTime = resetTime.toISOString();
    if (remaining !== undefined) details.remaining = remaining;
    if (retryAfter !== undefined) details.retryAfter = retryAfter;
    
    super(
      message,
      429,
      'RATE_LIMIT_EXCEEDED',
      Object.keys(details).length > 0 ? details : undefined
    );
  }
  
  /**
   * Get headers that should be included in the response
   * Implements requirement 13.6 - include rate limit headers
   */
  getHeaders(): Record<string, string | number> {
    const headers: Record<string, string | number> = {};
    
    if (this.limit !== undefined) {
      headers['X-RateLimit-Limit'] = this.limit;
    }
    
    if (this.remaining !== undefined) {
      headers['X-RateLimit-Remaining'] = this.remaining;
    }
    
    if (this.resetTime) {
      headers['X-RateLimit-Reset'] = Math.floor(this.resetTime.getTime() / 1000);
    }
    
    if (this.retryAfter !== undefined) {
      headers['Retry-After'] = this.retryAfter;
    }
    
    return headers;
  }
}

/**
 * Error Response Format
 * Consistent JSON structure for all error responses
 */
export interface ErrorResponse {
  error: true;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
  stack?: string; // Only in development
}

/**
 * Format error for API response
 * Implements consistent error response structure as per Requirements 13.1 and 17.2
 * 
 * @param error - The error to format
 * @param requestId - Request ID for correlation
 * @param isDevelopment - Whether to include debug information
 * @returns Formatted error response
 */
export function formatErrorResponse(
  error: Error,
  requestId?: string,
  isDevelopment: boolean = false
): ErrorResponse {
  const timestamp = new Date().toISOString();

  // Handle AppError instances
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: true,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      requestId,
    };

    // Add details if available
    if (error.details) {
      response.details = error.details;
    }

    // Add stack trace in development
    if (isDevelopment && error.stack) {
      response.stack = error.stack;
    }

    return response;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: true,
    code: 'INTERNAL_ERROR',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    timestamp,
    requestId,
  };

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Sanitize error for production
 * Removes sensitive information from error messages and details
 * 
 * @param error - The error to sanitize
 * @returns Sanitized error
 */
export function sanitizeError(error: Error): Error {
  // For operational errors, return as-is
  if (error instanceof AppError && error.isOperational) {
    return error;
  }

  // For non-operational errors, create a generic error
  return new AppError(
    'An unexpected error occurred',
    500,
    'INTERNAL_ERROR',
    undefined,
    false
  );
}

/**
 * Check if error is operational
 * Operational errors are expected and can be safely shown to users
 * 
 * @param error - The error to check
 * @returns True if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Extract HTTP status code from error
 * 
 * @param error - The error to extract status from
 * @returns HTTP status code
 */
export function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

// Re-export error handler
export { errorHandler, handleUncaughtException, handleUnhandledRejection } from './errorHandler.js';
