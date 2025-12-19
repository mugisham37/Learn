/**
 * Error Handling Link
 * 
 * Apollo Link that provides comprehensive error handling with user-friendly
 * messages, error classification, and integration with error tracking services.
 */

import { onError, ErrorResponse } from '@apollo/client/link/error';
import { ServerError } from '@apollo/client';
import type { ClassifiedError, ErrorType } from '../../../types';

/**
 * Error classification mapping
 * Maps GraphQL error codes to user-friendly error types
 */
const ERROR_CODE_MAPPING: Record<string, ErrorType> = {
  UNAUTHENTICATED: 'AUTHENTICATION_ERROR',
  FORBIDDEN: 'AUTHORIZATION_ERROR',
  BAD_USER_INPUT: 'VALIDATION_ERROR',
  GRAPHQL_VALIDATION_FAILED: 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UPLOAD_ERROR: 'UPLOAD_ERROR',
};

/**
 * User-friendly error messages
 * Maps error types to messages that can be displayed to users
 */
const USER_FRIENDLY_MESSAGES: Record<ErrorType, string> = {
  AUTHENTICATION_ERROR: 'Please log in to continue.',
  AUTHORIZATION_ERROR: 'You don\'t have permission to perform this action.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_ERROR: 'Connection problem. Please check your internet connection.',
  UPLOAD_ERROR: 'File upload failed. Please try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

/**
 * Error classification utility
 */
class ErrorClassifier {
  /**
   * Classifies a GraphQL error into a structured error object
   */
  classifyGraphQLError(error: { message: string; extensions?: { code?: string; field?: string; userMessage?: string } }): ClassifiedError {
    const code = error.extensions?.code || 'UNKNOWN_ERROR';
    const type = ERROR_CODE_MAPPING[code] || 'UNKNOWN_ERROR';
    
    return {
      type,
      code,
      message: error.message,
      userMessage: this.getUserMessage(type, error),
      field: error.extensions?.field,
      retryable: this.isRetryable(type),
    };
  }

  /**
   * Classifies a network error
   */
  classifyNetworkError(error: ServerError): ClassifiedError {
    const statusCode = error.statusCode || 0;
    
    let type: ErrorType = 'NETWORK_ERROR';
    let userMessage = USER_FRIENDLY_MESSAGES.NETWORK_ERROR;
    
    // Classify based on HTTP status code
    if (statusCode === 401) {
      type = 'AUTHENTICATION_ERROR';
      userMessage = USER_FRIENDLY_MESSAGES.AUTHENTICATION_ERROR;
    } else if (statusCode === 403) {
      type = 'AUTHORIZATION_ERROR';
      userMessage = USER_FRIENDLY_MESSAGES.AUTHORIZATION_ERROR;
    } else if (statusCode >= 400 && statusCode < 500) {
      type = 'VALIDATION_ERROR';
      userMessage = USER_FRIENDLY_MESSAGES.VALIDATION_ERROR;
    } else if (statusCode >= 500) {
      type = 'UNKNOWN_ERROR';
      userMessage = USER_FRIENDLY_MESSAGES.UNKNOWN_ERROR;
    }

    return {
      type,
      code: `HTTP_${statusCode}`,
      message: error.message,
      userMessage,
      retryable: this.isRetryable(type) && statusCode >= 500,
    };
  }

  /**
   * Gets a user-friendly message for an error
   */
  private getUserMessage(type: ErrorType, error: { extensions?: { userMessage?: string } }): string {
    // Check for custom user message in error extensions
    if (error.extensions?.userMessage) {
      return error.extensions.userMessage;
    }

    // Use default message for the error type
    return USER_FRIENDLY_MESSAGES[type];
  }

  /**
   * Determines if an error type is retryable
   */
  private isRetryable(type: ErrorType): boolean {
    switch (type) {
      case 'NETWORK_ERROR':
      case 'UNKNOWN_ERROR':
        return true;
      case 'AUTHENTICATION_ERROR':
      case 'AUTHORIZATION_ERROR':
      case 'VALIDATION_ERROR':
      case 'UPLOAD_ERROR':
        return false;
      default:
        return false;
    }
  }
}

/**
 * Error tracking integration
 */
class ErrorTracker {
  private isEnabled: boolean;

  constructor() {
    // Enable error tracking in production or when explicitly enabled
    this.isEnabled = process.env.NODE_ENV === 'production' || 
                     process.env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING === 'true';
  }

  /**
   * Reports an error to the tracking service
   */
  reportError(error: ClassifiedError, context: {
    operation?: string;
    variables?: Record<string, unknown>;
    userId?: string;
  }) {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Integration with Sentry or other error tracking service
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(new Error(error.message), {
          tags: {
            errorType: error.type,
            errorCode: error.code,
            operation: context.operation,
          },
          extra: {
            userMessage: error.userMessage,
            field: error.field,
            retryable: error.retryable,
            variables: context.variables,
          },
          user: context.userId ? { id: context.userId } : undefined,
        });
      }

      // Fallback: log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.group('🚨 GraphQL Error');
        console.error('Type:', error.type);
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('User Message:', error.userMessage);
        console.error('Context:', context);
        console.groupEnd();
      }
    } catch (trackingError) {
      console.warn('Failed to report error to tracking service:', trackingError);
    }
  }
}

/**
 * Error notification system
 */
class ErrorNotifier {
  /**
   * Shows an error notification to the user
   */
  notifyUser(error: ClassifiedError) {
    // Emit a custom event that the UI can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('graphql:error', {
        detail: {
          type: error.type,
          message: error.userMessage,
          field: error.field,
          retryable: error.retryable,
        },
      }));
    }
  }

  /**
   * Shows a network error notification
   */
  notifyNetworkError(error: ClassifiedError) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('network:error', {
        detail: {
          type: error.type,
          message: error.userMessage,
          retryable: error.retryable,
        },
      }));
    }
  }
}

// Global instances
const errorClassifier = new ErrorClassifier();
const errorTracker = new ErrorTracker();
const errorNotifier = new ErrorNotifier();

/**
 * Creates the error handling link
 */
export function createErrorLink() {
  return onError(({ graphQLErrors, networkError, operation }) => {
    const operationName = operation.operationName;
    const variables = operation.variables;

    // Handle GraphQL errors
    if (graphQLErrors) {
      graphQLErrors.forEach((error) => {
        const classifiedError = errorClassifier.classifyGraphQLError(error);
        
        // Report to error tracking
        errorTracker.reportError(classifiedError, {
          operation: operationName,
          variables,
        });

        // Notify user for non-authentication errors
        // (Authentication errors are handled by the auth link)
        if (classifiedError.type !== 'AUTHENTICATION_ERROR') {
          errorNotifier.notifyUser(classifiedError);
        }

        // Log detailed error information in development
        if (process.env.NODE_ENV === 'development') {
          console.group(`🔴 GraphQL Error in ${operationName}`);
          console.error('Original Error:', error);
          console.error('Classified Error:', classifiedError);
          console.error('Variables:', variables);
          console.groupEnd();
        }
      });
    }

    // Handle network errors
    if (networkError) {
      const classifiedError = errorClassifier.classifyNetworkError(networkError as ServerError);
      
      // Report to error tracking
      errorTracker.reportError(classifiedError, {
        operation: operationName,
        variables,
      });

      // Notify user
      errorNotifier.notifyNetworkError(classifiedError);

      // Log detailed error information in development
      if (process.env.NODE_ENV === 'development') {
        console.group(`🔴 Network Error in ${operationName}`);
        console.error('Original Error:', networkError);
        console.error('Classified Error:', classifiedError);
        console.error('Variables:', variables);
        console.groupEnd();
      }
    }
  });
}

/**
 * Utility functions for error handling
 */
export const errorUtils = {
  /**
   * Extracts field-specific errors from GraphQL errors
   */
  extractFieldErrors: (errors: { message: string; extensions?: { code?: string; field?: string } }[]): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};
    
    errors.forEach((error) => {
      const classified = errorClassifier.classifyGraphQLError(error);
      if (classified.field) {
        fieldErrors[classified.field] = classified.userMessage;
      }
    });
    
    return fieldErrors;
  },

  /**
   * Checks if any errors are retryable
   */
  hasRetryableErrors: (errors: { message: string; extensions?: { code?: string } }[]): boolean => {
    return errors.some((error) => {
      const classified = errorClassifier.classifyGraphQLError(error);
      return classified.retryable;
    });
  },

  /**
   * Gets the most severe error from a list of errors
   */
  getMostSevereError: (errors: { message: string; extensions?: { code?: string; field?: string } }[]): ClassifiedError => {
    const classified = errors.map((error) => errorClassifier.classifyGraphQLError(error));
    
    // Priority order: AUTHENTICATION > AUTHORIZATION > VALIDATION > NETWORK > UNKNOWN
    const severityOrder: ErrorType[] = [
      'AUTHENTICATION_ERROR',
      'AUTHORIZATION_ERROR', 
      'VALIDATION_ERROR',
      'NETWORK_ERROR',
      'UPLOAD_ERROR',
      'UNKNOWN_ERROR',
    ];

    for (const errorType of severityOrder) {
      const error = classified.find((e) => e.type === errorType);
      if (error) {
        return error;
      }
    }

    return classified[0] || {
      type: 'UNKNOWN_ERROR' as ErrorType,
      code: 'UNKNOWN',
      message: 'Unknown error occurred',
      userMessage: 'Something went wrong. Please try again.',
      retryable: false,
    }; // Fallback to first error or default
  },
};

// Export classifier and tracker for testing
export { errorClassifier, errorTracker, errorNotifier };