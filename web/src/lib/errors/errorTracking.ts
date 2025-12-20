/**
 * Error Tracking Integration
 * 
 * Comprehensive error tracking system with Sentry integration,
 * error logging with request context, reporting utilities,
 * and performance monitoring for error scenarios.
 */

import type { 
  ClassifiedError, 
  ErrorContext,
  PerformanceMetrics
} from './errorTypes';

/**
 * Error tracking service interface
 */
interface ErrorTrackingService {
  /** Initialize the tracking service */
  initialize(config: ErrorTrackingServiceConfig): Promise<void>;
  
  /** Report an error */
  reportError(error: ClassifiedError, context?: ErrorContext): Promise<void>;
  
  /** Report performance metrics */
  reportPerformance(metrics: PerformanceMetrics): Promise<void>;
  
  /** Set user context */
  setUserContext(user: { id: string; email?: string; role?: string }): void;
  
  /** Add breadcrumb */
  addBreadcrumb(message: string, category?: string, level?: 'info' | 'warning' | 'error'): void;
  
  /** Start performance transaction */
  startTransaction(name: string, operation: string): PerformanceTransaction;
  
  /** Check if service is enabled */
  isEnabled(): boolean;
}

/**
 * Performance transaction interface
 */
interface PerformanceTransaction {
  /** Set transaction status */
  setStatus(status: 'ok' | 'cancelled' | 'unknown_error' | 'invalid_argument'): void;
  
  /** Set transaction data */
  setData(key: string, value: unknown): void;
  
  /** Start child span */
  startChild(operation: string, description?: string): PerformanceSpan;
  
  /** Finish transaction */
  finish(): void;
}

/**
 * Performance span interface
 */
interface PerformanceSpan {
  /** Set span data */
  setData(key: string, value: unknown): void;
  
  /** Set span status */
  setStatus(status: 'ok' | 'cancelled' | 'unknown_error'): void;
  
  /** Finish span */
  finish(): void;
}

/**
 * Error tracking service configuration
 */
interface ErrorTrackingServiceConfig {
  /** Service DSN or API key */
  dsn?: string;
  
  /** Environment (development, staging, production) */
  environment: string;
  
  /** Application version */
  version?: string;
  
  /** Sample rate for error reporting (0.0 to 1.0) */
  sampleRate: number;
  
  /** Sample rate for performance monitoring (0.0 to 1.0) */
  tracesSampleRate: number;
  
  /** Whether to enable in current environment */
  enabled: boolean;
  
  /** Additional configuration */
  additionalConfig?: Record<string, unknown>;
}

// Sentry types for better type safety
interface SentryScope {
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, unknown>): void;
  setLevel(level: 'fatal' | 'error' | 'warning' | 'info'): void;
}

interface SentryModule {
  init(config: Record<string, unknown>): void;
  configureScope(callback: (scope: SentryScope) => void): void;
  withScope(callback: (scope: SentryScope) => void): void;
  captureException(error: Error): void;
  setMeasurement(name: string, value: number, unit: string): void;
  setUser(user: { id: string; email?: string; role?: string }): void;
  addBreadcrumb(breadcrumb: { message: string; category: string; level: string; timestamp: number }): void;
  startTransaction(options: { name: string; op: string }): SentryTransaction;
}

interface SentryTransaction {
  setStatus(status: string): void;
  setData(key: string, value: unknown): void;
  startChild(options: { op: string; description?: string }): SentrySpan;
  finish(): void;
}

interface SentrySpan {
  setData(key: string, value: unknown): void;
  setStatus(status: string): void;
  finish(): void;
}
/**
 * Sentry error tracking service implementation
 */
class SentryTrackingService implements ErrorTrackingService {
  private isInitialized = false;
  private enabled = false;
  private sentry: SentryModule | null = null;

  async initialize(config: ErrorTrackingServiceConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.enabled = config.enabled && !!config.dsn;

    if (!this.enabled) {
      console.info('Error tracking disabled or no DSN provided');
      return;
    }

    try {
      // Dynamically import Sentry to avoid bundling if not needed
      const sentryModule = await import('@sentry/nextjs') as SentryModule;
      this.sentry = sentryModule;

      sentryModule.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.version,
        sampleRate: config.sampleRate,
        tracesSampleRate: config.tracesSampleRate,
        beforeSend: this.beforeSend.bind(this),
        beforeSendTransaction: this.beforeSendTransaction.bind(this),
        ...config.additionalConfig,
      });

      // Set initial context
      sentryModule.configureScope((scope: SentryScope) => {
        scope.setTag('component', 'frontend-foundation');
        scope.setContext('app', {
          name: 'Learning Platform Frontend',
          version: config.version,
        });
      });

      this.isInitialized = true;
      console.info('Error tracking initialized successfully');
    } catch (error) {
      console.error('Failed to initialize error tracking:', error);
      this.enabled = false;
    }
  }

  async reportError(error: ClassifiedError, context?: ErrorContext): Promise<void> {
    if (!this.enabled || !this.sentry) {
      return;
    }

    try {
      this.sentry?.withScope((scope: SentryScope) => {
        // Set error classification tags
        scope.setTag('error.type', error.type);
        scope.setTag('error.category', error.category);
        scope.setTag('error.severity', error.severity);
        scope.setTag('error.retryable', error.retryable.toString());

        // Set error level based on severity
        const level = this.mapSeverityToLevel(error.severity);
        scope.setLevel(level);

        // Create error object
        const errorObj = new Error(error.message);
        errorObj.name = error.code;
        if (error.stack) {
          errorObj.stack = error.stack;
        }

        // Capture exception
        this.sentry?.captureException(errorObj);
      });
    } catch (trackingError) {
      console.error('Failed to report error to tracking service:', trackingError);
    }
  }

  async reportPerformance(metrics: PerformanceMetrics): Promise<void> {
    if (!this.enabled || !this.sentry) {
      return;
    }

    try {
      // Report performance metrics as custom measurements
      this.sentry.setMeasurement('request_duration', metrics.requestDuration, 'millisecond');
      this.sentry.setMeasurement('cache_hit_rate', metrics.cacheHitRate, 'ratio');
      this.sentry.setMeasurement('error_rate', metrics.errorRate, 'ratio');
      this.sentry.setMeasurement('active_subscriptions', metrics.activeSubscriptions, 'none');
    } catch (error) {
      console.error('Failed to report performance metrics:', error);
    }
  }

  setUserContext(user: { id: string; email?: string; role?: string }): void {
    if (!this.enabled || !this.sentry) {
      return;
    }

    try {
      this.sentry.setUser({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    } catch (error) {
      console.error('Failed to set user context:', error);
    }
  }

  addBreadcrumb(message: string, category = 'default', level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.enabled || !this.sentry) {
      return;
    }

    try {
      this.sentry.addBreadcrumb({
        message,
        category,
        level,
        timestamp: Date.now() / 1000,
      });
    } catch (error) {
      console.error('Failed to add breadcrumb:', error);
    }
  }

  startTransaction(name: string, operation: string): PerformanceTransaction {
    if (!this.enabled || !this.sentry) {
      return new NoOpTransaction();
    }

    try {
      const transaction = this.sentry.startTransaction({ name, op: operation });
      return new SentryTransactionWrapper(transaction);
    } catch (error) {
      console.error('Failed to start transaction:', error);
      return new NoOpTransaction();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private beforeSend(event: Record<string, unknown>): Record<string, unknown> {
    // Filter out sensitive information
    const request = event.request as Record<string, unknown> | undefined;
    if (request?.data) {
      request.data = this.sanitizeData(request.data);
    }

    const extra = event.extra as Record<string, unknown> | undefined;
    if (extra?.variables) {
      extra.variables = this.sanitizeData(extra.variables);
    }

    return event;
  }

  private beforeSendTransaction(event: Record<string, unknown>): Record<string, unknown> {
    // Filter out sensitive transaction data
    return event;
  }

  private sanitizeData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = { ...data as Record<string, unknown> };

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private mapSeverityToLevel(severity: string): 'fatal' | 'error' | 'warning' | 'info' {
    switch (severity) {
      case 'critical':
        return 'fatal';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'error';
    }
  }
}

/**
 * Sentry transaction wrapper
 */
class SentryTransactionWrapper implements PerformanceTransaction {
  constructor(private transaction: SentryTransaction) {}

  setStatus(status: 'ok' | 'cancelled' | 'unknown_error' | 'invalid_argument'): void {
    this.transaction.setStatus(status);
  }

  setData(key: string, value: unknown): void {
    this.transaction.setData(key, value);
  }

  startChild(operation: string, description?: string): PerformanceSpan {
    const span = this.transaction.startChild({ op: operation, description });
    return new SentrySpanWrapper(span);
  }

  finish(): void {
    this.transaction.finish();
  }
}

/**
 * Sentry span wrapper
 */
class SentrySpanWrapper implements PerformanceSpan {
  constructor(private span: SentrySpan) {}

  setData(key: string, value: unknown): void {
    this.span.setData(key, value);
  }

  setStatus(status: 'ok' | 'cancelled' | 'unknown_error'): void {
    this.span.setStatus(status);
  }

  finish(): void {
    this.span.finish();
  }
}

/**
 * No-op implementations for when tracking is disabled
 */
class NoOpTransaction implements PerformanceTransaction {
  setStatus(): void {}
  setData(): void {}
  startChild(): PerformanceSpan { return new NoOpSpan(); }
  finish(): void {}
}

class NoOpSpan implements PerformanceSpan {
  setData(): void {}
  setStatus(): void {}
  finish(): void {}
}

/**
 * Console-based error tracking service for development
 */
class ConsoleTrackingService implements ErrorTrackingService {
  private enabled = false;

  async initialize(config: ErrorTrackingServiceConfig): Promise<void> {
    this.enabled = config.enabled;
    if (this.enabled) {
      console.info('Console error tracking enabled');
    }
  }

  async reportError(error: ClassifiedError, context?: ErrorContext): Promise<void> {
    if (!this.enabled) {
      return;
    }

    console.group(`🚨 Error Tracked: ${error.type}`);
    console.error('Error:', error);
    console.error('Context:', context);
    console.groupEnd();
  }

  async reportPerformance(metrics: PerformanceMetrics): Promise<void> {
    if (!this.enabled) {
      return;
    }

    console.info('📊 Performance Metrics:', metrics);
  }

  setUserContext(user: { id: string; email?: string; role?: string }): void {
    if (this.enabled) {
      console.info('👤 User Context:', user);
    }
  }

  addBreadcrumb(message: string, category = 'default', level: 'info' | 'warning' | 'error' = 'info'): void {
    if (this.enabled) {
      console.info(`🍞 Breadcrumb [${category}] ${level}: ${message}`);
    }
  }

  startTransaction(name: string, operation: string): PerformanceTransaction {
    if (this.enabled) {
      console.time(`Transaction: ${name} (${operation})`);
    }
    return new ConsoleTransaction(name, operation, this.enabled);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Console transaction implementation
 */
class ConsoleTransaction implements PerformanceTransaction {
  constructor(
    private name: string,
    private operation: string,
    private enabled: boolean
  ) {}

  setStatus(status: string): void {
    if (this.enabled) {
      console.info(`Transaction ${this.name} status: ${status}`);
    }
  }

  setData(key: string, value: any): void {
    if (this.enabled) {
      console.info(`Transaction ${this.name} data:`, { [key]: value });
    }
  }

  startChild(operation: string, description?: string): PerformanceSpan {
    return new ConsoleSpan(operation, description, this.enabled);
  }

  finish(): void {
    if (this.enabled) {
      console.timeEnd(`Transaction: ${this.name} (${this.operation})`);
    }
  }
}

/**
 * Console span implementation
 */
class ConsoleSpan implements PerformanceSpan {
  constructor(
    private operation: string,
    private description?: string,
    private enabled = false
  ) {
    if (this.enabled) {
      console.time(`Span: ${this.operation}${this.description ? ` - ${this.description}` : ''}`);
    }
  }

  setData(key: string, value: any): void {
    if (this.enabled) {
      console.info(`Span ${this.operation} data:`, { [key]: value });
    }
  }

  setStatus(status: string): void {
    if (this.enabled) {
      console.info(`Span ${this.operation} status: ${status}`);
    }
  }

  finish(): void {
    if (this.enabled) {
      console.timeEnd(`Span: ${this.operation}${this.description ? ` - ${this.description}` : ''}`);
    }
  }
}

/**
 * Error tracking manager
 */
export class ErrorTrackingManager {
  private service: ErrorTrackingService;
  private performanceMetrics: PerformanceMetrics = {
    requestDuration: 0,
    cacheHitRate: 0,
    errorRate: 0,
    activeSubscriptions: 0,
  };

  constructor(service?: ErrorTrackingService) {
    this.service = service || new ConsoleTrackingService();
  }

  /**
   * Initializes error tracking
   */
  async initialize(config: ErrorTrackingServiceConfig): Promise<void> {
    await this.service.initialize(config);
  }

  /**
   * Reports an error with context
   */
  async reportError(error: ClassifiedError, context?: ErrorContext): Promise<void> {
    // Add breadcrumb for error
    this.service.addBreadcrumb(
      `Error occurred: ${error.message}`,
      'error',
      'error'
    );

    // Report the error
    await this.service.reportError(error, context);

    // Update error rate metric
    this.updateErrorRate();
  }

  /**
   * Reports performance metrics
   */
  async reportPerformance(metrics: Partial<PerformanceMetrics>): Promise<void> {
    this.performanceMetrics = { ...this.performanceMetrics, ...metrics };
    await this.service.reportPerformance(this.performanceMetrics);
  }

  /**
   * Sets user context for error tracking
   */
  setUserContext(user: { id: string; email?: string; role?: string }): void {
    this.service.setUserContext(user);
  }

  /**
   * Adds a breadcrumb for tracking user actions
   */
  addBreadcrumb(message: string, category?: string, level?: 'info' | 'warning' | 'error'): void {
    this.service.addBreadcrumb(message, category, level);
  }

  /**
   * Starts a performance transaction
   */
  startTransaction(name: string, operation: string): PerformanceTransaction {
    return this.service.startTransaction(name, operation);
  }

  /**
   * Tracks GraphQL operation performance
   */
  trackGraphQLOperation(operationName: string, variables?: Record<string, unknown>): PerformanceTransaction {
    const transaction = this.startTransaction(operationName, 'graphql');
    
    if (variables) {
      transaction.setData('variables', variables);
    }
    
    return transaction;
  }

  /**
   * Tracks upload operation performance
   */
  trackUploadOperation(fileName: string, fileSize: number): PerformanceTransaction {
    const transaction = this.startTransaction(`Upload: ${fileName}`, 'upload');
    transaction.setData('file_size', fileSize);
    return transaction;
  }

  /**
   * Tracks subscription operation performance
   */
  trackSubscriptionOperation(subscriptionName: string): PerformanceTransaction {
    const transaction = this.startTransaction(subscriptionName, 'subscription');
    return transaction;
  }

  /**
   * Updates error rate metric
   */
  private updateErrorRate(): void {
    // Simple error rate calculation - in a real app, this would be more sophisticated
    this.performanceMetrics.errorRate = Math.min(this.performanceMetrics.errorRate + 0.01, 1.0);
  }

  /**
   * Checks if tracking is enabled
   */
  isEnabled(): boolean {
    return this.service.isEnabled();
  }
}

/**
 * Create error tracking service based on environment
 */
export function createErrorTrackingService(): ErrorTrackingService {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return new SentryTrackingService();
  }
  
  return new ConsoleTrackingService();
}

// Export singleton instance
export const errorTrackingManager = new ErrorTrackingManager(createErrorTrackingService());