/**
 * Error Handling and Recovery System
 * 
 * Comprehensive error handling system with classification, recovery,
 * tracking, and user-friendly messaging. Provides a complete solution
 * for handling all types of errors in the frontend application.
 */

// Core error types and interfaces
export type {
  ErrorType,
  ErrorSeverity,
  ErrorCategory,
  ClassifiedError,
  ErrorContext,
  ErrorRecoveryStrategy,
  RecoveryAction,
  ErrorNotificationConfig,
  ErrorTrackingConfig,
  ErrorHandlingConfig,
  ErrorHandlerResult,
  ErrorBoundaryInfo,
  NetworkErrorDetails,
  GraphQLErrorExtensions,
} from './errorTypes';

// Error classification system
export { 
  ErrorClassifier,
  errorClassifier 
} from './errorClassifier';

// Error message mapping with localization
export { 
  ErrorMessageMapper,
  errorMessageMapper,
  errorMessageUtils,
  type SupportedLocale
} from './errorMessages';

// Error recovery strategies
export { 
  ErrorRecoveryManager,
  NetworkErrorRecovery,
  errorRecoveryManager 
} from './errorRecovery';

// Error tracking integration
export { 
  ErrorTrackingManager,
  createErrorTrackingService,
  errorTrackingManager 
} from './errorTracking';

// Main error handler
export { 
  ErrorHandler,
  errorHandler,
  errorHandlerUtils 
} from './errorHandler';

// React error boundary components
export {
  ErrorBoundary,
  AsyncErrorBoundary,
  RouteErrorBoundary,
  FormErrorBoundary,
  withErrorBoundary,
  useErrorHandler
} from './ErrorBoundary';

/**
 * Initialize the error handling system
 */
export async function initializeErrorHandling(config?: {
  /** Sentry DSN for error tracking */
  sentryDsn?: string;
  
  /** Environment (development, staging, production) */
  environment?: string;
  
  /** Application version */
  version?: string;
  
  /** Default locale for error messages */
  locale?: string;
  
  /** Whether to enable error tracking */
  enableTracking?: boolean;
  
  /** Whether to enable error recovery */
  enableRecovery?: boolean;
  
  /** Sample rate for error reporting (0.0 to 1.0) */
  sampleRate?: number;
  
  /** Sample rate for performance monitoring (0.0 to 1.0) */
  tracesSampleRate?: number;
}) {
  const environment = config?.environment || process.env.NODE_ENV || 'development';
  const {
    sentryDsn,
    version = process.env.NEXT_PUBLIC_APP_VERSION,
    locale = 'en',
    enableTracking = true,
    enableRecovery = true,
    sampleRate = environment === 'production' ? 0.1 : 1.0,
    tracesSampleRate = environment === 'production' ? 0.1 : 1.0,
  } = config || {};

  try {
    // Initialize error tracking
    if (enableTracking) {
      await errorTrackingManager.initialize({
        dsn: sentryDsn,
        environment,
        version,
        sampleRate,
        tracesSampleRate,
        enabled: enableTracking && (environment === 'production' ? !!sentryDsn : true),
      });
    }

    // Configure error handler
    errorHandler.updateConfig({
      enableTracking,
      enableRecovery,
      locale,
      showNotifications: true,
    });

    // Set up network monitoring
    if (typeof window !== 'undefined') {
      NetworkErrorRecovery.startNetworkMonitoring();
    }

    console.info('Error handling system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize error handling system:', error);
  }
}

/**
 * Quick error handling utilities for common use cases
 */
export const quickErrorHandling = {
  /**
   * Handle GraphQL errors from Apollo Client
   */
  handleApolloError: async (error: ApolloError, operationName: string, variables?: Record<string, unknown>) => {
    const context = {
      operation: operationName,
      variables,
      requestId: `apollo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    };

    if (error.graphQLErrors?.length > 0) {
      for (const gqlError of error.graphQLErrors) {
        await errorHandler.handleGraphQLError(gqlError, context);
      }
    }

    if (error.networkError) {
      await errorHandler.handleNetworkError(error.networkError, undefined, context);
    }

    return errorHandler.extractFieldErrors(error.graphQLErrors || []);
  },

  /**
   * Handle upload errors
   */
  handleUploadError: async (error: UploadError, uploadId: string, fileName?: string) => {
    const context = {
      operation: 'file_upload',
      metadata: { uploadId, fileName },
      requestId: `upload_${uploadId}`,
    };

    if (error.code && error.message) {
      return errorHandler.handleUploadError(error, context);
    } else {
      return errorHandler.handleRuntimeError(error, context);
    }
  },

  /**
   * Handle subscription errors
   */
  handleSubscriptionError: async (error: SubscriptionError, subscriptionName: string) => {
    const context = {
      operation: subscriptionName,
      requestId: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    };

    return errorHandler.handleSubscriptionError(error, context);
  },

  /**
   * Handle general runtime errors
   */
  handleRuntimeError: async (error: Error, operation?: string) => {
    const context = {
      operation: operation || 'runtime',
      requestId: `runtime_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    };

    return errorHandler.handleRuntimeError(error, context);
  },
};

// Define error types for better type safety
interface ApolloError {
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

/**
 * Error handling hooks for React components
 */
export const errorHooks = {
  /**
   * Hook for handling errors in React components
   */
  useErrorHandler: () => {
    const [error, setError] = React.useState<Error | null>(null);

    const handleError = React.useCallback((error: Error) => {
      setError(error);
    }, []);

    const clearError = React.useCallback(() => {
      setError(null);
    }, []);

    // Throw error to be caught by error boundary
    if (error) {
      throw error;
    }

    return { handleError, clearError };
  },
};

// Re-export React for the hooks
import React from 'react';