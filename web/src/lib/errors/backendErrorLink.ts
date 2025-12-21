/**
 * Backend-Specific GraphQL Error Link
 * 
 * Apollo Link that handles backend-specific GraphQL errors with proper
 * classification, recovery, and integration with the error handling system.
 */

import { onError } from '@apollo/client/link/error';
import { errorHandler } from './errorHandler';
import { isBackendError } from './backendErrorMapping';

/**
 * Creates a backend-integrated error link for Apollo Client
 */
export function createBackendErrorLink() {
  return onError(({ graphQLErrors, networkError, operation, forward }) => {
    const operationName = operation.operationName || 'Unknown';
    
    // Create context for error handling
    const context = {
      operation: operationName,
      variables: operation.variables,
      requestId: `gql_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    };

    // Handle GraphQL errors with backend integration
    if (graphQLErrors) {
      graphQLErrors.forEach(async (error) => {
        const errorCode = error.extensions?.code;
        
        // Log backend vs non-backend errors differently
        if (errorCode && isBackendError(errorCode)) {
          console.group('🔗 Backend GraphQL Error');
          console.error('Backend Error Code:', errorCode);
          console.error('Error:', error);
          console.error('Operation:', operationName);
          console.error('Variables:', operation.variables);
          console.groupEnd();
          
          // Handle with backend-specific error handling
          await errorHandler.handleGraphQLError(error, context);
        } else {
          console.group('⚠️ GraphQL Error (Non-Backend)');
          console.error('Error:', error);
          console.error('Operation:', operationName);
          console.groupEnd();
          
          // Handle with standard error handling
          await errorHandler.handleGraphQLError(error, context);
        }
      });
    }

    // Handle network errors
    if (networkError) {
      console.group('🌐 Network Error');
      console.error('Network Error:', networkError);
      console.error('Operation:', operationName);
      console.groupEnd();
      
      // Handle network error with backend context
      errorHandler.handleNetworkError(networkError, undefined, context);
    }
  });
}

/**
 * Backend-specific error retry logic
 */
export function createBackendRetryLink() {
  return onError(({ graphQLErrors, networkError, operation, forward }) => {
    // Handle authentication errors with token refresh
    if (graphQLErrors) {
      for (const error of graphQLErrors) {
        const errorCode = error.extensions?.code;
        
        // Handle token refresh for backend authentication errors
        if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'UNAUTHENTICATED') {
          // Emit token refresh event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:token-refresh-needed', {
              detail: { operation: operation.operationName }
            }));
          }
          
          // Return observable that waits for token refresh
          return new Promise((resolve) => {
            const handleRefreshComplete = () => {
              window.removeEventListener('auth:token-refresh-complete', handleRefreshComplete);
              // Retry the operation
              resolve(forward(operation));
            };
            
            window.addEventListener('auth:token-refresh-complete', handleRefreshComplete);
            
            // Timeout after 10 seconds
            setTimeout(() => {
              window.removeEventListener('auth:token-refresh-complete', handleRefreshComplete);
              resolve(forward(operation));
            }, 10000);
          });
        }
        
        // Handle rate limiting with exponential backoff
        if (errorCode === 'RATE_LIMITED') {
          const retryAfter = error.extensions?.retryAfter || 1000;
          
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(forward(operation));
            }, retryAfter);
          });
        }
      }
    }
    
    // Handle network errors with retry logic
    if (networkError && 'statusCode' in networkError) {
      const statusCode = (networkError as { statusCode: number }).statusCode;
      
      // Retry on 5xx errors
      if (statusCode >= 500) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(forward(operation));
          }, 2000); // 2 second delay for server errors
        });
      }
      
      // Retry on timeout
      if (statusCode === 408) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(forward(operation));
          }, 1000); // 1 second delay for timeouts
        });
      }
    }
  });
}

/**
 * Backend error context enrichment
 */
export function enrichBackendErrorContext(error: {
  extensions?: {
    code?: string;
    traceId?: string;
    requestId?: string;
    timestamp?: string;
  };
}) {
  const context: Record<string, unknown> = {};
  
  if (error.extensions) {
    // Add backend trace correlation
    if (error.extensions.traceId) {
      context.backendTraceId = error.extensions.traceId;
    }
    
    // Add backend request correlation
    if (error.extensions.requestId) {
      context.backendRequestId = error.extensions.requestId;
    }
    
    // Add backend timestamp
    if (error.extensions.timestamp) {
      context.backendTimestamp = error.extensions.timestamp;
    }
  }
  
  return context;
}

/**
 * Backend error metrics collection
 */
export function collectBackendErrorMetrics(error: {
  extensions?: {
    code?: string;
    duration?: number;
    retryCount?: number;
  };
}, operation: {
  operationName?: string;
}) {
  if (typeof window !== 'undefined' && 'performance' in window) {
    // Collect performance metrics for backend errors
    const metrics = {
      errorCode: error.extensions?.code,
      operation: operation.operationName,
      duration: error.extensions?.duration,
      retryCount: error.extensions?.retryCount,
      timestamp: Date.now(),
    };
    
    // Emit metrics event for collection
    window.dispatchEvent(new CustomEvent('backend:error-metrics', {
      detail: metrics
    }));
  }
}

/**
 * Backend error notification system
 */
export function handleBackendErrorNotification(error: {
  extensions?: {
    code?: string;
    userMessage?: string;
    severity?: string;
  };
  message: string;
}) {
  if (typeof window !== 'undefined') {
    const notification = {
      type: 'backend-error',
      code: error.extensions?.code,
      message: error.extensions?.userMessage || error.message,
      severity: error.extensions?.severity || 'medium',
      timestamp: Date.now(),
    };
    
    // Emit notification event for UI handling
    window.dispatchEvent(new CustomEvent('backend:error-notification', {
      detail: notification
    }));
  }
}