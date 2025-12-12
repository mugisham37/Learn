/**
 * Sentry Error Tracking Service
 * 
 * Integrates Sentry for comprehensive error tracking, performance monitoring,
 * and user context management. Provides error grouping, deduplication,
 * and detailed error reports with context.
 * 
 * Requirements: 17.2
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { FastifyRequest } from 'fastify';
import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Sentry configuration interface
 */
interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

/**
 * User context for Sentry
 */
interface SentryUserContext {
  id: string;
  email?: string;
  role?: string;
  ip_address?: string;
}

/**
 * Request context for Sentry
 */
interface SentryRequestContext {
  method: string;
  url: string;
  headers: Record<string, string>;
  query_string?: string;
  data?: any;
}

/**
 * Sentry service interface
 */
export interface ISentryService {
  initialize(): void;
  captureException(error: Error, context?: Record<string, any>): string;
  captureMessage(message: string, level?: Sentry.SeverityLevel, context?: Record<string, any>): string;
  setUserContext(user: SentryUserContext): void;
  setRequestContext(request: FastifyRequest): void;
  addBreadcrumb(message: string, category?: string, level?: Sentry.SeverityLevel, data?: any): void;
  withScope<T>(callback: (scope: Sentry.Scope) => T): T;
  startTransaction(name: string, op: string): Sentry.Transaction;
  isEnabled(): boolean;
  close(timeout?: number): Promise<boolean>;
}

/**
 * Sentry service implementation
 */
export class SentryService implements ISentryService {
  private initialized = false;
  private config: SentryConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Load Sentry configuration from environment
   */
  private loadConfig(): SentryConfig {
    return {
      dsn: process.env.SENTRY_DSN || '',
      environment: config.nodeEnv,
      release: process.env.SENTRY_RELEASE || process.env.npm_package_version || '1.0.0',
      sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
      enabled: config.nodeEnv === 'production' && !!process.env.SENTRY_DSN,
    };
  }

  /**
   * Initialize Sentry SDK
   */
  initialize(): void {
    if (this.initialized || !this.config.enabled) {
      if (!this.config.enabled) {
        logger.info('Sentry error tracking disabled (no DSN configured or not in production)');
      }
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release,
        
        // Performance monitoring
        tracesSampleRate: this.config.tracesSampleRate,
        profilesSampleRate: this.config.profilesSampleRate,
        
        // Error sampling
        sampleRate: this.config.sampleRate,
        
        // Integrations
        integrations: [
          // Enable HTTP instrumentation
          new Sentry.Integrations.Http({ tracing: true }),
          
          // Enable Express instrumentation (works with Fastify too)
          new Sentry.Integrations.Express({ app: undefined }),
          
          // Enable profiling
          new ProfilingIntegration(),
          
          // Enable console integration
          new Sentry.Integrations.Console(),
          
          // Enable modules integration
          new Sentry.Integrations.Modules(),
        ],
        
        // Before send hook for filtering and sanitization
        beforeSend: this.beforeSendHook.bind(this),
        
        // Before breadcrumb hook for filtering
        beforeBreadcrumb: this.beforeBreadcrumbHook.bind(this),
        
        // Initial scope configuration
        initialScope: {
          tags: {
            component: 'learning-platform-backend',
            nodeVersion: process.version,
          },
        },
        
        // Debug mode for development
        debug: config.nodeEnv === 'development',
        
        // Server name
        serverName: process.env.SERVER_NAME || 'learning-platform-backend',
        
        // Max breadcrumbs
        maxBreadcrumbs: 50,
        
        // Attach stack trace
        attachStacktrace: true,
        
        // Send default PII
        sendDefaultPii: false,
      });

      this.initialized = true;
      logger.info('Sentry error tracking initialized successfully', {
        environment: this.config.environment,
        release: this.config.release,
        tracesSampleRate: this.config.tracesSampleRate,
      });
    } catch (error) {
      logger.error('Failed to initialize Sentry', { error });
    }
  }

  /**
   * Capture exception with context
   */
  captureException(error: Error, context?: Record<string, any>): string {
    if (!this.isEnabled()) {
      return '';
    }

    return Sentry.withScope((scope) => {
      if (context) {
        // Add context as extra data
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Add error fingerprint for better grouping
      if (error.name && error.message) {
        scope.setFingerprint([error.name, error.message]);
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Capture message with context
   */
  captureMessage(
    message: string, 
    level: Sentry.SeverityLevel = 'info', 
    context?: Record<string, any>
  ): string {
    if (!this.isEnabled()) {
      return '';
    }

    return Sentry.withScope((scope) => {
      scope.setLevel(level);

      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      return Sentry.captureMessage(message);
    });
  }

  /**
   * Set user context for error tracking
   */
  setUserContext(user: SentryUserContext): void {
    if (!this.isEnabled()) {
      return;
    }

    Sentry.setUser({
      id: user.id,
      email: user.email,
      ip_address: user.ip_address,
      role: user.role,
    });
  }

  /**
   * Set request context from Fastify request
   */
  setRequestContext(request: FastifyRequest): void {
    if (!this.isEnabled()) {
      return;
    }

    Sentry.withScope((scope) => {
      // Set request context
      scope.setContext('request', {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        query_string: request.query ? JSON.stringify(request.query) : undefined,
        data: request.body ? this.sanitizeRequestBody(request.body) : undefined,
      });

      // Set request ID as tag
      if (request.id) {
        scope.setTag('requestId', request.id);
      }

      // Set user context if available
      if ('user' in request && request.user) {
        const user = request.user as any;
        this.setUserContext({
          id: user.userId || user.id,
          email: user.email,
          role: user.role,
          ip_address: request.ip,
        });
      }
    });
  }

  /**
   * Add breadcrumb for tracking user actions
   */
  addBreadcrumb(
    message: string, 
    category: string = 'custom', 
    level: Sentry.SeverityLevel = 'info', 
    data?: any
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data: data ? this.sanitizeData(data) : undefined,
      timestamp: Date.now() / 1000,
    });
  }

  /**
   * Execute callback within Sentry scope
   */
  withScope<T>(callback: (scope: Sentry.Scope) => T): T {
    if (!this.isEnabled()) {
      return callback({} as Sentry.Scope);
    }

    return Sentry.withScope(callback);
  }

  /**
   * Start performance transaction
   */
  startTransaction(name: string, op: string): Sentry.Transaction {
    if (!this.isEnabled()) {
      return {} as Sentry.Transaction;
    }

    return Sentry.startTransaction({ name, op });
  }

  /**
   * Check if Sentry is enabled and initialized
   */
  isEnabled(): boolean {
    return this.initialized && this.config.enabled;
  }

  /**
   * Close Sentry and flush pending events
   */
  async close(timeout: number = 2000): Promise<boolean> {
    if (!this.isEnabled()) {
      return true;
    }

    try {
      return await Sentry.close(timeout);
    } catch (error) {
      logger.error('Failed to close Sentry', { error });
      return false;
    }
  }

  /**
   * Before send hook for filtering and sanitization
   */
  private beforeSendHook(event: Sentry.Event): Sentry.Event | null {
    // Filter out certain errors in development
    if (config.nodeEnv === 'development') {
      // Skip certain development-only errors
      if (event.exception?.values?.[0]?.type === 'ValidationError') {
        return null;
      }
    }

    // Sanitize sensitive data
    if (event.request?.data) {
      event.request.data = this.sanitizeRequestBody(event.request.data);
    }

    if (event.request?.headers) {
      event.request.headers = this.sanitizeHeaders(event.request.headers);
    }

    // Add server context
    event.server_name = process.env.SERVER_NAME || 'learning-platform-backend';
    
    return event;
  }

  /**
   * Before breadcrumb hook for filtering
   */
  private beforeBreadcrumbHook(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/health')) {
      return null;
    }

    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }

    // Sanitize breadcrumb data
    if (breadcrumb.data) {
      breadcrumb.data = this.sanitizeData(breadcrumb.data);
    }

    return breadcrumb;
  }

  /**
   * Sanitize request headers
   */
  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[Filtered]';
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize request body
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    return this.sanitizeData(body);
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
      'apiKey', 'secret', 'creditCard', 'cvv', 'ssn', 'privateKey',
      'jwtSecret', 'sessionSecret', 'stripeSecretKey', 'awsSecretAccessKey'
    ];

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        (sanitized as any)[key] = '[Filtered]';
      } else if (value && typeof value === 'object') {
        (sanitized as any)[key] = this.sanitizeData(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Global Sentry service instance
 */
export const sentryService = new SentryService();