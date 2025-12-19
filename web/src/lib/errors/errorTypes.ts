/**
 * Error Type Definitions
 * 
 * Comprehensive error type definitions for all error categories in the
 * frontend foundation layer. Provides structured error classification
 * with severity levels and handling strategies.
 */

/**
 * Core error types that can occur in the system
 */
export type ErrorType = 
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR' 
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'UPLOAD_ERROR'
  | 'SUBSCRIPTION_ERROR'
  | 'CACHE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Error severity levels for prioritizing error handling
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for grouping related errors
 */
export type ErrorCategory = 
  | 'user_input'
  | 'authentication'
  | 'authorization'
  | 'network'
  | 'server'
  | 'client'
  | 'system';

/**
 * Structured error object with comprehensive metadata
 */
export interface ClassifiedError {
  /** Unique error identifier */
  id: string;
  
  /** Error type classification */
  type: ErrorType;
  
  /** Error category for grouping */
  category: ErrorCategory;
  
  /** Error severity level */
  severity: ErrorSeverity;
  
  /** Error code from backend or system */
  code: string;
  
  /** Technical error message */
  message: string;
  
  /** User-friendly error message */
  userMessage: string;
  
  /** Field name if validation error */
  field?: string;
  
  /** Whether this error can be retried */
  retryable: boolean;
  
  /** Suggested retry delay in milliseconds */
  retryDelay?: number;
  
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Additional error context */
  context?: ErrorContext;
  
  /** Timestamp when error occurred */
  timestamp: Date;
  
  /** Stack trace for debugging */
  stack?: string;
}

/**
 * Error context for debugging and tracking
 */
export interface ErrorContext {
  /** GraphQL operation name */
  operation?: string;
  
  /** Request variables */
  variables?: Record<string, unknown>;
  
  /** User ID if authenticated */
  userId?: string;
  
  /** Request ID for tracing */
  requestId?: string;
  
  /** User agent information */
  userAgent?: string;
  
  /** Current URL */
  url?: string;
  
  /** Component stack trace */
  componentStack?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error recovery strategy configuration
 */
export interface ErrorRecoveryStrategy {
  /** Whether this error type supports recovery */
  canRecover: boolean;
  
  /** Recovery action to take */
  recoveryAction: RecoveryAction;
  
  /** Whether to show user notification */
  showNotification: boolean;
  
  /** Whether to redirect user */
  redirectTo?: string;
  
  /** Custom recovery function */
  customRecovery?: (error: ClassifiedError) => Promise<void>;
}

/**
 * Available recovery actions
 */
export type RecoveryAction = 
  | 'retry'
  | 'refresh_token'
  | 'redirect_login'
  | 'show_error'
  | 'ignore'
  | 'custom';

/**
 * Error notification configuration
 */
export interface ErrorNotificationConfig {
  /** Whether to show notification */
  show: boolean;
  
  /** Notification type */
  type: 'toast' | 'modal' | 'banner' | 'inline';
  
  /** Auto-dismiss timeout in milliseconds */
  timeout?: number;
  
  /** Whether notification is dismissible */
  dismissible: boolean;
  
  /** Custom notification component */
  component?: string;
}

/**
 * Error tracking configuration
 */
export interface ErrorTrackingConfig {
  /** Whether to track this error */
  track: boolean;
  
  /** Tracking service to use */
  service: 'sentry' | 'console' | 'custom';
  
  /** Additional tags for tracking */
  tags?: Record<string, string>;
  
  /** Whether to include user context */
  includeUser: boolean;
  
  /** Whether to include request context */
  includeRequest: boolean;
}

/**
 * Complete error handling configuration
 */
export interface ErrorHandlingConfig {
  /** Error classification */
  classification: {
    type: ErrorType;
    category: ErrorCategory;
    severity: ErrorSeverity;
  };
  
  /** Recovery strategy */
  recovery: ErrorRecoveryStrategy;
  
  /** Notification configuration */
  notification: ErrorNotificationConfig;
  
  /** Tracking configuration */
  tracking: ErrorTrackingConfig;
}

/**
 * Error handler result
 */
export interface ErrorHandlerResult {
  /** Whether error was handled successfully */
  handled: boolean;
  
  /** Whether error should be retried */
  shouldRetry: boolean;
  
  /** Delay before retry in milliseconds */
  retryDelay?: number;
  
  /** User message to display */
  userMessage?: string;
  
  /** Whether to redirect user */
  redirectTo?: string;
  
  /** Additional actions taken */
  actions: string[];
}

/**
 * Error boundary error info
 */
export interface ErrorBoundaryInfo {
  /** Component stack trace */
  componentStack: string;
  
  /** Error boundary name */
  errorBoundary?: string;
  
  /** Props that caused the error */
  errorInfo?: Record<string, unknown>;
}

/**
 * Network error details
 */
export interface NetworkErrorDetails {
  /** HTTP status code */
  statusCode?: number;
  
  /** Response headers */
  headers?: Record<string, string>;
  
  /** Response body */
  responseBody?: string;
  
  /** Request timeout */
  timeout?: number;
  
  /** Connection type */
  connectionType?: string;
}

/**
 * GraphQL error extensions
 */
export interface GraphQLErrorExtensions {
  /** Error code from backend */
  code?: string;
  
  /** Field that caused validation error */
  field?: string;
  
  /** Custom user message */
  userMessage?: string;
  
  /** Error details */
  details?: Record<string, unknown>;
  
  /** Trace ID for debugging */
  traceId?: string;
}