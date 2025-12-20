/**
 * Error Boundary Components
 * 
 * React error boundary components for graceful error handling
 * and recovery in the frontend application.
 */

'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { errorClassifier } from './errorClassifier';
import { errorMessageMapper } from './errorMessages';
import type { ClassifiedError, ErrorBoundaryInfo } from './errorTypes';

/**
 * Error boundary props
 */
interface ErrorBoundaryProps {
  /** Child components */
  children: ReactNode;
  /** Fallback component to render on error */
  fallback?: (error: ClassifiedError, retry: () => void) => ReactNode;
  /** Error boundary name for tracking */
  name?: string;
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Custom error handler */
  onError?: (error: ClassifiedError, errorInfo: ErrorBoundaryInfo) => void;
  /** Whether to report errors to tracking service */
  reportErrors?: boolean;
}

/**
 * Error boundary state
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: ClassifiedError | null;
  errorInfo: ErrorBoundaryInfo | null;
  retryCount: number;
}

/**
 * Main error boundary component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Classify the error
    const classifiedError = errorClassifier.classifyRuntimeError(error, {
      componentStack: 'Error boundary caught error',
    });

    return {
      hasError: true,
      error: classifiedError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const boundaryInfo: ErrorBoundaryInfo = {
      componentStack: errorInfo.componentStack || '',
      errorBoundary: this.props.name || 'ErrorBoundary',
      errorInfo: {
        error: error.message,
        stack: error.stack,
      },
    };

    this.setState({
      errorInfo: boundaryInfo,
    });

    // Call custom error handler
    if (this.props.onError && this.state.error) {
      this.props.onError(this.state.error, boundaryInfo);
    }

    // Report error if enabled
    if (this.props.reportErrors !== false) {
      this.reportError(error, errorInfo);
    }
  }

  /**
   * Retries rendering by resetting error state
   */
  retry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: this.state.retryCount + 1,
      });
    }
  };

  /**
   * Reports error to tracking service
   */
  private reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      // Report to Sentry or other error tracking service
      if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Sentry) {
        const sentry = (window as unknown as Record<string, unknown>).Sentry as Record<string, unknown>;
        if (typeof sentry.captureException === 'function') {
          sentry.captureException(error, {
            tags: {
              errorBoundary: this.props.name || 'ErrorBoundary',
              retryCount: this.state.retryCount,
            },
            extra: {
              componentStack: errorInfo.componentStack,
              errorInfo: this.state.errorInfo,
            },
          });
        }
      }

      // Fallback: log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.group('🚨 Error Boundary Caught Error');
        console.error('Error:', error);
        console.error('Error Info:', errorInfo);
        console.error('Classified Error:', this.state.error);
        console.error('Boundary Info:', this.state.errorInfo);
        console.groupEnd();
      }
    } catch (reportingError) {
      console.warn('Failed to report error:', reportingError);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      // Use default fallback
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.props.showRetry !== false ? this.retry : undefined}
          canRetry={this.state.retryCount < this.maxRetries}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
interface DefaultErrorFallbackProps {
  error: ClassifiedError;
  errorInfo: ErrorBoundaryInfo | null;
  onRetry?: (() => void) | undefined;
  canRetry?: boolean;
}

function DefaultErrorFallback({ 
  error, 
  errorInfo, 
  onRetry, 
  canRetry = true 
}: DefaultErrorFallbackProps) {
  const userMessage = errorMessageMapper.getMessage(error);

  return (
    <div className="error-boundary-fallback" style={{
      padding: '2rem',
      margin: '1rem',
      border: '1px solid #e2e8f0',
      borderRadius: '0.5rem',
      backgroundColor: '#fef2f2',
      color: '#991b1b',
    }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ 
          fontSize: '1.25rem', 
          fontWeight: 'bold', 
          marginBottom: '0.5rem',
          color: '#dc2626'
        }}>
          Something went wrong
        </h2>
        <p style={{ marginBottom: '1rem' }}>
          {userMessage}
        </p>
      </div>

      {onRetry && canRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            marginRight: '0.5rem',
          }}
        >
          Try Again
        </button>
      )}

      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer',
        }}
      >
        Refresh Page
      </button>

      {process.env.NODE_ENV === 'development' && (
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Error Details (Development)
          </summary>
          <pre style={{
            marginTop: '0.5rem',
            padding: '1rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            overflow: 'auto',
            color: '#374151',
          }}>
            {JSON.stringify({
              error: {
                type: error.type,
                code: error.code,
                message: error.message,
                stack: error.stack,
              },
              errorInfo,
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Async error boundary for handling async errors
 */
interface AsyncErrorBoundaryProps extends ErrorBoundaryProps {
  /** Reset key to force re-render */
  resetKey?: string | number;
}

export class AsyncErrorBoundary extends ErrorBoundary {
  componentDidUpdate(prevProps: AsyncErrorBoundaryProps) {
    const { resetKey } = this.props as AsyncErrorBoundaryProps;
    
    // Reset error state when resetKey changes
    if (prevProps.resetKey !== resetKey && this.state.hasError) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: 0,
      });
    }
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for handling async errors in components
 */
export function useErrorHandler() {
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
}

/**
 * Specialized error boundaries for different parts of the app
 */

/**
 * Route error boundary for page-level errors
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      name="RouteErrorBoundary"
      showRetry={true}
      fallback={(error, retry) => (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '2rem',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Page Error
          </h1>
          <p style={{ marginBottom: '2rem', textAlign: 'center' }}>
            {errorMessageMapper.getMessage(error)}
          </p>
          <div>
            <button
              onClick={retry}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                marginRight: '1rem',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Form error boundary for form-specific errors
 */
export function FormErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      name="FormErrorBoundary"
      showRetry={true}
      fallback={(error, retry) => (
        <div style={{
          padding: '1rem',
          border: '1px solid #fca5a5',
          borderRadius: '0.5rem',
          backgroundColor: '#fef2f2',
          marginBottom: '1rem',
        }}>
          <p style={{ color: '#dc2626', marginBottom: '1rem' }}>
            {errorMessageMapper.getMessage(error)}
          </p>
          <button
            onClick={retry}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}