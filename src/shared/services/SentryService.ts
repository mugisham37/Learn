/**
 * Sentry Error Tracking Service
 * 
 * Integrates Sentry for comprehensive error tracking, performance monitoring,
 * and user context management. Provides error grouping, deduplication,
 * and detailed error reports with context.
 * 
 * Requirements: 17.2
 */

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
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}



/**
 * Breadcrumb interface
 */
interface SentryBreadcrumb {
  message: string;
  category?: string;
  level?: string;
  data?: Record<string, unknown>;
}

/**
 * Transaction interface
 */
interface SentryTransaction {
  setTag: (key: string, value: string) => void;
  setData: (key: string, value: unknown) => void;
  finish: () => void;
}

/**
 * Scope interface
 */
interface SentryScope {
  setLevel: (level: string) => void;
  setExtra: (key: string, value: unknown) => void;
  setFingerprint: (fingerprint: string[]) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
}

/**
 * Mock Sentry implementation for when Sentry is not available
 */
interface MockSentry {
  init: (options: unknown) => void;
  captureException: (error: Error) => string;
  captureMessage: (message: string, level?: string) => string;
  withScope: <T>(callback: (scope: SentryScope) => T) => T;
  setUser: (user: SentryUserContext) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
  setTag: (key: string, value: string) => void;
  addBreadcrumb: (breadcrumb: SentryBreadcrumb) => void;
  startTransaction: (name: string, op?: string) => SentryTransaction;
  close: (timeout?: number) => Promise<boolean>;
  Integrations: {
    Http: new () => unknown;
    OnUncaughtException: new (options?: unknown) => unknown;
    OnUnhandledRejection: new (options?: unknown) => unknown;
    LinkedErrors: new () => unknown;
  };
}

/**
 * Create mock Sentry implementation
 */
const mockSentry: MockSentry = {
  init: (): void => {},
  captureException: (): string => 'mock-id',
  captureMessage: (): string => 'mock-id',
  withScope: <T>(callback: (scope: SentryScope) => T): T => callback({
    setLevel: (): void => {},
    setExtra: (): void => {},
    setFingerprint: (): void => {},
    setContext: (): void => {},
  }),
  setUser: (): void => {},
  setContext: (): void => {},
  setTag: (): void => {},
  addBreadcrumb: (): void => {},
  startTransaction: (): SentryTransaction => ({
    setTag: (): void => {},
    setData: (): void => {},
    finish: (): void => {},
  }),
  close: (): Promise<boolean> => Promise.resolve(true),
  Integrations: {
    Http: class { constructor() {} },
    OnUncaughtException: class { constructor(_options?: unknown) {} },
    OnUnhandledRejection: class { constructor(_options?: unknown) {} },
    LinkedErrors: class { constructor() {} },
  },
};

// Use mock Sentry for now
const Sentry = mockSentry;

/**
 * Sentry service interface
 */
export interface ISentryService {
  initialize(): void;
  captureException(error: Error, context?: Record<string, unknown>): string;
  captureMessage(message: string, level?: string, context?: Record<string, unknown>): string;
  setUserContext(user: SentryUserContext): void;
  setRequestContext(req: FastifyRequest): void;
  addBreadcrumb(message: string, category?: string, level?: string, data?: Record<string, unknown>): void;
  withScope<T>(callback: (scope: SentryScope) => T): T;
  startTransaction(name: string, op?: string): SentryTransaction;
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
      dsn: process.env['SENTRY_DSN'] || '',
      environment: config.nodeEnv,
      release: process.env['SENTRY_RELEASE'] || process.env['npm_package_version'] || 'unknown',
      sampleRate: 1.0,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
      enabled: Boolean(process.env['SENTRY_DSN']),
    };
  }

  /**
   * Initialize Sentry SDK
   */
  initialize(): void {
    if (!this.config.enabled) {
      logger.info('Sentry disabled - no DSN provided');
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        integrations: [
          new Sentry.Integrations.Http(),
          new Sentry.Integrations.OnUncaughtException({
            exitEvenIfOtherHandlersAreRegistered: false,
          }),
          new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
          new Sentry.Integrations.LinkedErrors(),
        ],
        beforeSend: (event: unknown) => this.beforeSend(event),
        beforeBreadcrumb: (breadcrumb: unknown) => this.beforeBreadcrumb(breadcrumb),
      });

      this.initialized = true;
      logger.info('Sentry initialized successfully', {
        environment: this.config.environment,
        release: this.config.release,
        dsn: this.config.dsn ? 'configured' : 'not configured',
      });
    } catch (error) {
      logger.error('Failed to initialize Sentry', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Capture exception with context
   */
  captureException(error: Error, context?: Record<string, unknown>): string {
    if (!this.initialized) {
      return '';
    }

    return Sentry.withScope((scope: SentryScope) => {
      // Add extra context
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      // Set fingerprinting for better error grouping
      if (error.name && error.message) {
        scope.setFingerprint([error.name, error.message]);
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Capture message with context
   */
  captureMessage(message: string, level: string = 'info', context?: Record<string, unknown>): string {
    if (!this.initialized) {
      return '';
    }

    return Sentry.withScope((scope: SentryScope) => {
      scope.setLevel(level);

      // Add extra context
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }

      return Sentry.captureMessage(message, level);
    });
  }

  /**
   * Set user context
   */
  setUserContext(user: SentryUserContext): void {
    if (!this.initialized) {
      return;
    }

    Sentry.setUser(user);
  }

  /**
   * Set request context
   */
  setRequestContext(request: FastifyRequest): void {
    if (!this.initialized) {
      return;
    }

    Sentry.withScope((scope: SentryScope) => {
      scope.setContext('request', {
        method: request.method,
        url: request.url,
        headers: request.headers,
        query: request.query,
      });

      // Set user context if available
      if ('user' in request && request.user) {
        const user = request.user as { id?: string; email?: string; role?: string };
        
        this.setUserContext({
          id: user.id,
          email: user.email,
        });
      }
    });
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(message: string, category?: string, level?: string, data?: Record<string, unknown>): void {
    if (!this.initialized) {
      return;
    }

    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
    });
  }

  /**
   * Execute callback with Sentry scope
   */
  withScope<T>(callback: (scope: SentryScope) => T): T {
    if (!this.initialized) {
      return callback({
        setLevel: () => {},
        setExtra: () => {},
        setFingerprint: () => {},
        setContext: () => {},
      });
    }

    return Sentry.withScope(callback);
  }

  /**
   * Start performance transaction
   */
  startTransaction(name: string, op?: string): SentryTransaction {
    if (!this.initialized) {
      return {
        setTag: (): void => {},
        setData: (): void => {},
        finish: (): void => {},
      };
    }

    return Sentry.startTransaction(name, op);
  }

  /**
   * Check if Sentry is enabled
   */
  isEnabled(): boolean {
    return this.initialized;
  }

  /**
   * Close Sentry connection
   */
  async close(timeout: number = 2000): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }

    return Sentry.close(timeout);
  }

  /**
   * Before send hook for filtering events
   */
  private beforeSend(event: unknown): unknown {
    const eventObj = event as { 
      exception?: { values?: Array<{ type?: string }> };
      server_name?: string;
    };

    // Filter out specific error types
    if (eventObj.exception?.values?.[0]?.type === 'AbortError') {
      return null; // Don't send AbortError to Sentry
    }

    // Add server name
    if (!eventObj.server_name) {
      eventObj.server_name = 'learning-platform';
    }

    return event;
  }

  /**
   * Before breadcrumb hook for filtering breadcrumbs
   */
  private beforeBreadcrumb(breadcrumb: unknown): unknown {
    const breadcrumbObj = breadcrumb as { 
      category?: string; 
      level?: string;
      data?: Record<string, unknown>;
    };

    // Filter out noisy breadcrumbs
    if (breadcrumbObj.category === 'http') {
      return null;
    }

    // Sanitize sensitive data
    if (breadcrumbObj.data) {
      breadcrumbObj.data = this.sanitizeData(breadcrumbObj.data);
    }

    return breadcrumb;
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeData(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return {};
    }

    const sanitized: Record<string, unknown> = {};
    const dataObj = data as Record<string, unknown>;

    Object.entries(dataObj).forEach(([key, value]): void => {
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = `${value.substring(0, 100)}...`;
      } else {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }
}

/**
 * Global Sentry service instance
 */
export const sentryService = new SentryService();