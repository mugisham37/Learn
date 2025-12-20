/**
 * Error Classification System
 * 
 * Comprehensive error classification logic that categorizes errors by type,
 * severity, and recovery strategy. Provides consistent error handling
 * across the entire frontend foundation layer.
 */

// Simple ID generator to avoid external dependencies
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
import type { 
  ClassifiedError, 
  ErrorType, 
  ErrorCategory, 
  ErrorSeverity,
  ErrorContext,
  ErrorHandlingConfig,
  NetworkErrorDetails,
  GraphQLErrorExtensions
} from './errorTypes';

/**
 * Error code to type mapping for GraphQL errors
 */
const GRAPHQL_ERROR_MAPPING: Record<string, ErrorType> = {
  'UNAUTHENTICATED': 'AUTHENTICATION_ERROR',
  'FORBIDDEN': 'AUTHORIZATION_ERROR',
  'BAD_USER_INPUT': 'VALIDATION_ERROR',
  'GRAPHQL_VALIDATION_FAILED': 'VALIDATION_ERROR',
  'INTERNAL_SERVER_ERROR': 'UNKNOWN_ERROR',
  'NETWORK_ERROR': 'NETWORK_ERROR',
  'UPLOAD_ERROR': 'UPLOAD_ERROR',
  'SUBSCRIPTION_ERROR': 'SUBSCRIPTION_ERROR',
  'CACHE_ERROR': 'CACHE_ERROR',
};

/**
 * HTTP status code to error type mapping
 */
const HTTP_STATUS_MAPPING: Record<number, ErrorType> = {
  400: 'VALIDATION_ERROR',
  401: 'AUTHENTICATION_ERROR',
  403: 'AUTHORIZATION_ERROR',
  404: 'VALIDATION_ERROR',
  408: 'NETWORK_ERROR',
  409: 'VALIDATION_ERROR',
  422: 'VALIDATION_ERROR',
  429: 'NETWORK_ERROR',
  500: 'UNKNOWN_ERROR',
  502: 'NETWORK_ERROR',
  503: 'NETWORK_ERROR',
  504: 'NETWORK_ERROR',
};

/**
 * Error type to category mapping
 */
const TYPE_TO_CATEGORY: Record<ErrorType, ErrorCategory> = {
  'AUTHENTICATION_ERROR': 'authentication',
  'AUTHORIZATION_ERROR': 'authorization',
  'VALIDATION_ERROR': 'user_input',
  'NETWORK_ERROR': 'network',
  'UPLOAD_ERROR': 'client',
  'SUBSCRIPTION_ERROR': 'network',
  'CACHE_ERROR': 'client',
  'UNKNOWN_ERROR': 'system',
};

/**
 * Error type to severity mapping
 */
const TYPE_TO_SEVERITY: Record<ErrorType, ErrorSeverity> = {
  'AUTHENTICATION_ERROR': 'high',
  'AUTHORIZATION_ERROR': 'medium',
  'VALIDATION_ERROR': 'low',
  'NETWORK_ERROR': 'medium',
  'UPLOAD_ERROR': 'medium',
  'SUBSCRIPTION_ERROR': 'low',
  'CACHE_ERROR': 'medium',
  'UNKNOWN_ERROR': 'high',
};

/**
 * Error type retryability mapping
 */
const RETRYABLE_ERRORS: Set<ErrorType> = new Set([
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
  'SUBSCRIPTION_ERROR',
  'CACHE_ERROR',
]);

/**
 * Main error classifier class
 */
export class ErrorClassifier {
  /**
   * Classifies a GraphQL error into a structured error object
   */
  classifyGraphQLError(
    error: {
      message: string;
      extensions?: GraphQLErrorExtensions;
      path?: (string | number)[];
      locations?: { line: number; column: number }[];
    },
    context?: Partial<ErrorContext>
  ): ClassifiedError {
    const code = error.extensions?.code || 'UNKNOWN_ERROR';
    const type = GRAPHQL_ERROR_MAPPING[code] || 'UNKNOWN_ERROR';
    const category = TYPE_TO_CATEGORY[type];
    const severity = TYPE_TO_SEVERITY[type];
    
    return {
      id: generateId(),
      type,
      category,
      severity,
      code,
      message: error.message,
      userMessage: this.getUserMessage(type, error.extensions?.userMessage),
      field: error.extensions?.field || undefined,
      retryable: RETRYABLE_ERRORS.has(type),
      retryDelay: this.getRetryDelay(type),
      maxRetries: this.getMaxRetries(type),
      context: context ? {
        ...context,
        metadata: {
          path: error.path,
          locations: error.locations,
          extensions: error.extensions,
        },
      } : undefined,
      timestamp: new Date(),
      stack: undefined,
    };
  }

  /**
   * Classifies a network error
   */
  classifyNetworkError(
    error: Error & { statusCode?: number; response?: Record<string, unknown> },
    details?: NetworkErrorDetails,
    context?: Partial<ErrorContext>
  ): ClassifiedError {
    const statusCode = error.statusCode || details?.statusCode || 0;
    const type = HTTP_STATUS_MAPPING[statusCode] || 'NETWORK_ERROR';
    const category = TYPE_TO_CATEGORY[type];
    const severity = this.getNetworkErrorSeverity(statusCode);
    
    return {
      id: generateId(),
      type,
      category,
      severity,
      code: `HTTP_${statusCode}`,
      message: error.message,
      userMessage: this.getNetworkErrorMessage(statusCode, type),
      field: undefined,
      retryable: this.isNetworkErrorRetryable(statusCode, type),
      retryDelay: this.getRetryDelay(type),
      maxRetries: this.getMaxRetries(type),
      context: context ? {
        ...context,
        metadata: {
          statusCode,
          headers: details?.headers,
          responseBody: details?.responseBody,
          timeout: details?.timeout,
          connectionType: details?.connectionType,
        },
      } : undefined,
      timestamp: new Date(),
      stack: error.stack || undefined,
    };
  }

  /**
   * Classifies a JavaScript runtime error
   */
  classifyRuntimeError(
    error: Error,
    context?: Partial<ErrorContext>
  ): ClassifiedError {
    // Determine error type based on error name and message
    let type: ErrorType = 'UNKNOWN_ERROR';
    
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      type = 'UNKNOWN_ERROR';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      type = 'NETWORK_ERROR';
    } else if (error.message.includes('upload') || error.message.includes('file')) {
      type = 'UPLOAD_ERROR';
    } else if (error.message.includes('subscription') || error.message.includes('websocket')) {
      type = 'SUBSCRIPTION_ERROR';
    } else if (error.message.includes('cache')) {
      type = 'CACHE_ERROR';
    }

    const category = TYPE_TO_CATEGORY[type];
    const severity = TYPE_TO_SEVERITY[type];
    
    return {
      id: generateId(),
      type,
      category,
      severity,
      code: error.name || 'RUNTIME_ERROR',
      message: error.message,
      userMessage: this.getUserMessage(type),
      field: undefined,
      retryable: RETRYABLE_ERRORS.has(type),
      retryDelay: this.getRetryDelay(type),
      maxRetries: this.getMaxRetries(type),
      context,
      timestamp: new Date(),
      stack: error.stack || undefined,
    };
  }

  /**
   * Classifies an upload error
   */
  classifyUploadError(
    error: {
      code: string;
      message: string;
      uploadId?: string;
      fileName?: string;
    },
    context?: Partial<ErrorContext>
  ): ClassifiedError {
    const type: ErrorType = 'UPLOAD_ERROR';
    const category = TYPE_TO_CATEGORY[type];
    const severity = this.getUploadErrorSeverity(error.code);
    
    return {
      id: generateId(),
      type,
      category,
      severity,
      code: error.code,
      message: error.message,
      userMessage: this.getUploadErrorMessage(error.code),
      retryable: this.isUploadErrorRetryable(error.code),
      retryDelay: this.getRetryDelay(type),
      maxRetries: this.getMaxRetries(type),
      context: {
        ...context,
        metadata: {
          uploadId: error.uploadId,
          fileName: error.fileName,
        },
      },
      timestamp: new Date(),
    };
  }

  /**
   * Classifies a subscription error
   */
  classifySubscriptionError(
    error: {
      message: string;
      code?: string;
      type?: string;
    },
    context?: Partial<ErrorContext>
  ): ClassifiedError {
    const type: ErrorType = 'SUBSCRIPTION_ERROR';
    const category = TYPE_TO_CATEGORY[type];
    const severity = TYPE_TO_SEVERITY[type];
    
    return {
      id: generateId(),
      type,
      category,
      severity,
      code: error.code || error.type || 'SUBSCRIPTION_ERROR',
      message: error.message,
      userMessage: this.getUserMessage(type),
      field: undefined,
      retryable: true, // Most subscription errors are retryable
      retryDelay: this.getRetryDelay(type),
      maxRetries: this.getMaxRetries(type),
      context,
      timestamp: new Date(),
      stack: undefined,
    };
  }

  /**
   * Gets user-friendly message for error type
   */
  private getUserMessage(type: ErrorType, customMessage?: string): string {
    if (customMessage) {
      return customMessage;
    }

    const messages: Record<ErrorType, string> = {
      'AUTHENTICATION_ERROR': 'Please log in to continue.',
      'AUTHORIZATION_ERROR': 'You don\'t have permission to perform this action.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'NETWORK_ERROR': 'Connection problem. Please check your internet connection.',
      'UPLOAD_ERROR': 'File upload failed. Please try again.',
      'SUBSCRIPTION_ERROR': 'Real-time connection lost. Reconnecting...',
      'CACHE_ERROR': 'Data synchronization issue. Please refresh the page.',
      'UNKNOWN_ERROR': 'Something went wrong. Please try again.',
    };

    return messages[type];
  }

  /**
   * Gets network error message based on status code
   */
  private getNetworkErrorMessage(statusCode: number, type: ErrorType): string {
    if (statusCode === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    } else if (statusCode >= 500) {
      return 'Server is temporarily unavailable. Please try again later.';
    } else if (statusCode === 408) {
      return 'Request timed out. Please check your connection and try again.';
    }
    
    return this.getUserMessage(type);
  }

  /**
   * Gets upload error message based on error code
   */
  private getUploadErrorMessage(code: string): string {
    const messages: Record<string, string> = {
      'FILE_TOO_LARGE': 'File is too large. Please choose a smaller file.',
      'INVALID_FILE_TYPE': 'File type not supported. Please choose a different file.',
      'UPLOAD_TIMEOUT': 'Upload timed out. Please try again.',
      'NETWORK_ERROR': 'Upload failed due to connection issues. Please try again.',
      'SERVER_ERROR': 'Upload failed due to server error. Please try again.',
      'VALIDATION_ERROR': 'File validation failed. Please check the file and try again.',
    };

    return messages[code] || 'File upload failed. Please try again.';
  }

  /**
   * Gets retry delay for error type
   */
  private getRetryDelay(type: ErrorType): number {
    const delays: Record<ErrorType, number> = {
      'AUTHENTICATION_ERROR': 0, // No retry
      'AUTHORIZATION_ERROR': 0, // No retry
      'VALIDATION_ERROR': 0, // No retry
      'NETWORK_ERROR': 1000, // 1 second
      'UPLOAD_ERROR': 2000, // 2 seconds
      'SUBSCRIPTION_ERROR': 1000, // 1 second
      'CACHE_ERROR': 500, // 0.5 seconds
      'UNKNOWN_ERROR': 2000, // 2 seconds
    };

    return delays[type];
  }

  /**
   * Gets maximum retry attempts for error type
   */
  private getMaxRetries(type: ErrorType): number {
    const maxRetries: Record<ErrorType, number> = {
      'AUTHENTICATION_ERROR': 0,
      'AUTHORIZATION_ERROR': 0,
      'VALIDATION_ERROR': 0,
      'NETWORK_ERROR': 3,
      'UPLOAD_ERROR': 3,
      'SUBSCRIPTION_ERROR': 5,
      'CACHE_ERROR': 2,
      'UNKNOWN_ERROR': 2,
    };

    return maxRetries[type];
  }

  /**
   * Gets network error severity based on status code
   */
  private getNetworkErrorSeverity(statusCode: number): ErrorSeverity {
    if (statusCode >= 500) {
      return 'high';
    } else if (statusCode === 401 || statusCode === 403) {
      return 'medium';
    } else if (statusCode >= 400) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Gets upload error severity based on error code
   */
  private getUploadErrorSeverity(code: string): ErrorSeverity {
    const highSeverity = ['SERVER_ERROR', 'NETWORK_ERROR'];
    const lowSeverity = ['FILE_TOO_LARGE', 'INVALID_FILE_TYPE', 'VALIDATION_ERROR'];
    
    if (highSeverity.includes(code)) {
      return 'high';
    } else if (lowSeverity.includes(code)) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Determines if network error is retryable
   */
  private isNetworkErrorRetryable(statusCode: number, type: ErrorType): boolean {
    // Don't retry client errors (4xx) except for specific cases
    if (statusCode >= 400 && statusCode < 500) {
      return statusCode === 408 || statusCode === 429; // Timeout or rate limit
    }
    
    // Retry server errors (5xx) and network errors
    return statusCode >= 500 || type === 'NETWORK_ERROR';
  }

  /**
   * Determines if upload error is retryable
   */
  private isUploadErrorRetryable(code: string): boolean {
    const nonRetryable = ['FILE_TOO_LARGE', 'INVALID_FILE_TYPE', 'VALIDATION_ERROR'];
    return !nonRetryable.includes(code);
  }
}

// Export singleton instance
export const errorClassifier = new ErrorClassifier();