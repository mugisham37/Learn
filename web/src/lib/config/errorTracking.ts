/**
 * Error Tracking Integration
 * 
 * Integrates with Sentry and other error tracking services for comprehensive error monitoring.
 */

import { errorTrackingConfig, config } from '../config';

// Sentry integration (lazy loaded to avoid bundle bloat)
let Sentry: any = null;

/**
 * Initialize error tracking
 */
export async function initializeErrorTracking(): Promise<void> {
  if (!errorTrackingConfig.sentryDsn) {
    console.log('📊 Error tracking disabled (no Sentry DSN configured)');
    return;
  }

  try {
    console.log('🔧 Initializing error tracking...');

    // Dynamically import Sentry to avoid bundle bloat when not needed
    const { init, configureScope, setTag, setContext } = await import('@sentry/nextjs');
    Sentry = await import('@sentry/nextjs');

    // Initialize Sentry
    init({
      dsn: errorTrackingConfig.sentryDsn,
      environment: errorTrackingConfig.environment,
      release: errorTrackingConfig.release,
      sampleRate: errorTrackingConfig.sampleRate,
      tracesSampleRate: errorTrackingConfig.tracesSampleRate,
      
      // Performance monitoring
      integrations: [
        // Add performance monitoring integrations
      ],
      
      // Error filtering
      beforeSend(event, hint) {
        // Filter out development errors in production
        if (config.appEnv === 'production' && event.environment === 'development') {
          return null;
        }

        // Filter out known non-critical errors
        const error = hint.originalException;
        if (error instanceof Error) {
          // Skip network errors that are likely temporary
          if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            return null;
          }

          // Skip authentication errors (handled by auth system)
          if (error.message.includes('Unauthorized') || error.message.includes('JWT')) {
            return null;
          }
        }

        return event;
      },

      // Breadcrumb filtering
      beforeBreadcrumb(breadcrumb) {
        // Filter out noisy breadcrumbs
        if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
          return null;
        }

        return breadcrumb;
      },
    });

    // Set global context
    configureScope((scope) => {
      scope.setTag('app.environment', config.appEnv);
      scope.setTag('app.version', errorTrackingConfig.release);
      scope.setContext('configuration', {
        graphqlEndpoint: config.graphqlEndpoint,
        wsEndpoint: config.wsEndpoint,
        features: config.features,
      });
    });

    console.log('✅ Error tracking initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize error tracking:', error);
  }
}

/**
 * Report error to tracking service
 */
export function reportError(error: Error, context?: Record<string, any>): void {
  if (!Sentry) {
    console.error('Error tracking not initialized:', error);
    return;
  }

  try {
    Sentry.withScope((scope: any) => {
      if (context) {
        scope.setContext('error_context', context);
      }
      
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  } catch (trackingError) {
    console.error('Failed to report error to tracking service:', trackingError);
    console.error('Original error:', error);
  }
}

/**
 * Report message to tracking service
 */
export function reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>): void {
  if (!Sentry) {
    console.log('Error tracking not initialized, logging message:', message);
    return;
  }

  try {
    Sentry.withScope((scope: any) => {
      if (context) {
        scope.setContext('message_context', context);
      }
      
      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  } catch (trackingError) {
    console.error('Failed to report message to tracking service:', trackingError);
    console.log('Original message:', message);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: { id: string; email?: string; role?: string }): void {
  if (!Sentry) {
    return;
  }

  try {
    Sentry.configureScope((scope: any) => {
      scope.setUser({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    });
  } catch (error) {
    console.error('Failed to set user context:', error);
  }
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  if (!Sentry) {
    return;
  }

  try {
    Sentry.configureScope((scope: any) => {
      scope.clear();
    });
  } catch (error) {
    console.error('Failed to clear user context:', error);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
  if (!Sentry) {
    return;
  }

  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.error('Failed to add breadcrumb:', error);
  }
}

/**
 * Start performance transaction
 */
export function startTransaction(name: string, operation: string): any {
  if (!Sentry) {
    return null;
  }

  try {
    return Sentry.startTransaction({
      name,
      op: operation,
    });
  } catch (error) {
    console.error('Failed to start transaction:', error);
    return null;
  }
}

/**
 * Performance monitoring for GraphQL operations
 */
export function monitorGraphQLOperation(operationName: string, operationType: 'query' | 'mutation' | 'subscription') {
  const transaction = startTransaction(`GraphQL ${operationType}`, 'graphql');
  
  if (transaction) {
    transaction.setTag('graphql.operation_name', operationName);
    transaction.setTag('graphql.operation_type', operationType);
  }

  return {
    finish: (error?: Error) => {
      if (transaction) {
        if (error) {
          transaction.setStatus('internal_error');
          transaction.setTag('error', true);
        } else {
          transaction.setStatus('ok');
        }
        transaction.finish();
      }
    },
  };
}

/**
 * Error boundary integration
 */
export function handleErrorBoundary(error: Error, errorInfo: { componentStack: string }): void {
  reportError(error, {
    errorBoundary: true,
    componentStack: errorInfo.componentStack,
  });
}

/**
 * Unhandled promise rejection handler
 */
export function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  reportError(new Error(`Unhandled promise rejection: ${event.reason}`), {
    unhandledRejection: true,
    reason: event.reason,
  });
}

/**
 * Global error handler
 */
export function handleGlobalError(event: ErrorEvent): void {
  reportError(event.error || new Error(event.message), {
    globalError: true,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof window !== 'undefined') {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Handle global errors
    window.addEventListener('error', handleGlobalError);

    console.log('✅ Global error handlers setup complete');
  }
}