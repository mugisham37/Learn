/**
 * Main Error Handler
 * 
 * Central error handling system that coordinates error classification,
 * message mapping, recovery strategies, and tracking integration.
 */

import { errorClassifier } from './errorClassifier';
import { errorMessageMapper, type SupportedLocale } from './errorMessages';
import { errorRecoveryManager } from './errorRecovery';
import { errorTrackingManager } from './errorTracking';
import type { 
  ClassifiedError, 
  ErrorContext,
  ErrorHandlerResult,
  GraphQLErrorExtensions,
  NetworkErrorDetails
} from './errorTypes';

/**
 * Error handler configuration
 */
interface ErrorHandlerConfig {
  /** Whether to enable error tracking */
  enableTracking?: boolean;
  
  /** Whether to enable error recovery */
  enableRecovery?: boolean;
  
  /** Whether to show user notifications */
  showNotifications?: boolean;
  
  /** Default locale for error messages */
  locale?: string;
  
  /** Custom error handlers */
  customHandlers?: Record<string, (error: ClassifiedError) => Promise<ErrorHandlerResult>>;
}

/**
 * Main error handler class
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      enableTracking: true,
      enableRecovery: true,
      showNotifications: true,
      locale: 'en',
      ...config,
    };

    // Set locale for error messages
    if (this.config.locale && errorMessageMapper.isLocaleSupported(this.config.locale)) {
      errorMessageMapper.setLocale(this.config.locale as SupportedLocale);
    }
  }

  /**
   * Handles a GraphQL error
   */
  async handleGraphQLError(
    error: {
      message: string;
      extensions?: GraphQLErrorExtensions;
      path?: (string | number)[];
      locations?: { line: number; column: number }[];
    },
    context?: Partial<ErrorContext>,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Classify the error
    const classifiedError = errorClassifier.classifyGraphQLError(error, context);
    
    return this.handleClassifiedError(classifiedError, originalOperation);
  }

  /**
   * Handles a network error
   */
  async handleNetworkError(
    error: Error & { statusCode?: number; response?: Record<string, unknown> },
    details?: NetworkErrorDetails,
    context?: Partial<ErrorContext>,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Classify the error
    const classifiedError = errorClassifier.classifyNetworkError(error, details, context);
    
    return this.handleClassifiedError(classifiedError, originalOperation);
  }

  /**
   * Handles a runtime error
   */
  async handleRuntimeError(
    error: Error,
    context?: Partial<ErrorContext>,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Classify the error
    const classifiedError = errorClassifier.classifyRuntimeError(error, context);
    
    return this.handleClassifiedError(classifiedError, originalOperation);
  }

  /**
   * Handles an upload error
   */
  async handleUploadError(
    error: {
      code: string;
      message: string;
      uploadId?: string;
      fileName?: string;
    },
    context?: Partial<ErrorContext>,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Classify the error
    const classifiedError = errorClassifier.classifyUploadError(error, context);
    
    return this.handleClassifiedError(classifiedError, originalOperation);
  }

  /**
   * Handles a subscription error
   */
  async handleSubscriptionError(
    error: {
      message: string;
      code?: string;
      type?: string;
    },
    context?: Partial<ErrorContext>,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Classify the error
    const classifiedError = errorClassifier.classifySubscriptionError(error, context);
    
    return this.handleClassifiedError(classifiedError, originalOperation);
  }

  /**
   * Handles a pre-classified error
   */
  async handleClassifiedError(
    error: ClassifiedError,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Add breadcrumb for tracking
    if (this.config.enableTracking) {
      errorTrackingManager.addBreadcrumb(
        `Handling ${error.type}: ${error.message}`,
        'error_handling',
        'info'
      );
    }

    // Check for custom handler
    if (this.config.customHandlers?.[error.type]) {
      const customHandler = this.config.customHandlers[error.type];
      if (customHandler) {
        try {
          const result = await customHandler(error);
          await this.postProcessError(error, result);
          return result;
        } catch (customHandlerError) {
          console.error('Custom error handler failed:', customHandlerError);
          // Fall through to default handling
        }
      }
    }

    // Attempt recovery if enabled
    let result: ErrorHandlerResult;
    if (this.config.enableRecovery) {
      result = await errorRecoveryManager.handleError(error, originalOperation);
    } else {
      result = {
        handled: true,
        shouldRetry: false,
        userMessage: errorMessageMapper.getMessage(error),
        actions: ['show_error'],
      };
    }

    // Post-process the error
    await this.postProcessError(error, result);

    return result;
  }

  /**
   * Post-processes an error after handling
   */
  private async postProcessError(
    error: ClassifiedError,
    result: ErrorHandlerResult
  ): Promise<void> {
    // Track the error if enabled
    if (this.config.enableTracking) {
      await errorTrackingManager.reportError(error, error.context);
    }

    // Show notification if enabled and requested
    if (this.config.showNotifications && result.userMessage) {
      this.showErrorNotification(error, result);
    }

    // Handle redirects
    if (result.redirectTo) {
      this.handleRedirect(result.redirectTo);
    }

    // Log error details in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔧 Error Handler Result`);
      console.log('Error:', error);
      console.log('Result:', result);
      console.groupEnd();
    }
  }

  /**
   * Shows error notification to user
   */
  private showErrorNotification(error: ClassifiedError, result: ErrorHandlerResult): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Emit custom event for UI to handle
    window.dispatchEvent(new CustomEvent('error:notification', {
      detail: {
        type: error.type,
        severity: error.severity,
        message: result.userMessage,
        retryable: error.retryable && result.shouldRetry,
        retryDelay: result.retryDelay,
        actions: result.actions,
      },
    }));
  }

  /**
   * Handles redirect
   */
  private handleRedirect(redirectTo: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Use Next.js router if available, otherwise fallback to window.location
    const windowWithNext = window as Window & { next?: { router?: { push: (url: string) => void } } };
    if (windowWithNext.next?.router) {
      windowWithNext.next.router.push(redirectTo);
    } else {
      window.location.href = redirectTo;
    }
  }

  /**
   * Extracts field errors from GraphQL errors
   */
  extractFieldErrors(
    errors: Array<{
      message: string;
      extensions?: {
        code?: string;
        field?: string;
        userMessage?: string;
      };
    }>
  ): Record<string, string> {
    return errorMessageMapper.extractFieldErrors(errors);
  }

  /**
   * Gets contextual error message
   */
  getContextualMessage(
    error: ClassifiedError,
    userAction?: string,
    additionalContext?: Record<string, unknown>
  ): string {
    return errorMessageMapper.getContextualMessage(error, userAction, additionalContext);
  }

  /**
   * Updates configuration
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update locale if changed
    if (config.locale && errorMessageMapper.isLocaleSupported(config.locale)) {
      errorMessageMapper.setLocale(config.locale as SupportedLocale);
    }
  }

  /**
   * Gets current configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
}

/**
 * Utility functions for common error handling patterns
 */
export const errorHandlerUtils = {
  /**
   * Wraps an async function with error handling
   */
  withErrorHandling: <T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    errorHandler: ErrorHandler,
    context?: Partial<ErrorContext>
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        if (error instanceof Error) {
          await errorHandler.handleRuntimeError(error, context);
        }
        throw error;
      }
    };
  },

  /**
   * Creates an error handler for GraphQL operations
   */
  createGraphQLErrorHandler: (
    errorHandler: ErrorHandler,
    operationName: string
  ) => {
    return async (error: GraphQLError, variables?: Record<string, unknown>) => {
      const context: Partial<ErrorContext> = {
        operation: operationName,
        ...(variables && { variables }),
        requestId: `gql_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      };

      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        for (const gqlError of error.graphQLErrors) {
          await errorHandler.handleGraphQLError(gqlError, context);
        }
      }

      if (error.networkError) {
        await errorHandler.handleNetworkError(error.networkError, undefined, context);
      }

      return errorHandler.extractFieldErrors(error.graphQLErrors || []);
    };
  },

  /**
   * Creates an error handler for upload operations
   */
  createUploadErrorHandler: (
    errorHandler: ErrorHandler,
    uploadId: string,
    fileName?: string
  ) => {
    return async (error: UploadError) => {
      const context: Partial<ErrorContext> = {
        operation: 'file_upload',
        metadata: { uploadId, fileName },
        requestId: `upload_${uploadId}`,
      };

      if (error.code && error.message) {
        return errorHandler.handleUploadError({
          code: error.code,
          message: error.message,
          uploadId,
          ...(fileName && { fileName }),
        }, context);
      } else {
        return errorHandler.handleRuntimeError(error, context);
      }
    };
  },

  /**
   * Creates an error handler for subscription operations
   */
  createSubscriptionErrorHandler: (
    errorHandler: ErrorHandler,
    subscriptionName: string
  ) => {
    return async (error: SubscriptionError) => {
      const context: Partial<ErrorContext> = {
        operation: subscriptionName,
        requestId: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      };

      return errorHandler.handleSubscriptionError(error, context);
    };
  },
};

// Define error types for better type safety
interface GraphQLError {
  graphQLErrors?: Array<{
    message: string;
    extensions?: GraphQLErrorExtensions;
    path?: (string | number)[];
    locations?: { line: number; column: number }[];
  }>;
  networkError?: Error & { statusCode?: number; response?: Record<string, unknown> };
}

interface UploadError extends Error {
  code?: string;
}

interface SubscriptionError {
  message: string;
  code?: string;
  type?: string;
}

// Export singleton instance
export const errorHandler = new ErrorHandler();