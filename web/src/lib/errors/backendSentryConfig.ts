/**
 * Backend-Specific Sentry Configuration
 *
 * Configures Sentry error tracking with backend-specific settings,
 * error filtering, and integration with the LMS backend monitoring.
 */

/**
 * Backend-specific Sentry configuration
 */
export const BACKEND_SENTRY_CONFIG = {
  // Environment-specific DSN configuration
  dsn: {
    development: process.env.NEXT_PUBLIC_SENTRY_DSN_DEV,
    staging: process.env.NEXT_PUBLIC_SENTRY_DSN_STAGING,
    production: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },

  // Backend integration settings
  integration: {
    // Backend service name for correlation
    serviceName: 'lms-frontend',

    // Backend version correlation
    backendVersion: process.env.NEXT_PUBLIC_BACKEND_VERSION,

    // Backend environment correlation
    backendEnvironment: process.env.NEXT_PUBLIC_BACKEND_ENV,

    // Backend trace correlation
    enableTraceCorrelation: true,

    // Backend user correlation
    enableUserCorrelation: true,
  },

  // Error filtering for backend errors
  errorFiltering: {
    // Ignore common non-critical errors
    ignoreErrors: [
      // Network errors that are expected
      'NetworkError',
      'Failed to fetch',
      'Load failed',

      // Browser-specific errors
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
      'Script error.',

      // Development-only errors
      ...(process.env.NODE_ENV === 'development'
        ? ['ChunkLoadError', 'Loading chunk', 'Loading CSS chunk']
        : []),
    ],

    // Ignore URLs (for script errors)
    ignoreUrls: [
      // Browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,

      // Third-party scripts
      /googletagmanager\.com/i,
      /google-analytics\.com/i,
      /hotjar\.com/i,
    ],

    // Sample rate by error type
    sampleRates: {
      // Critical backend errors - always capture
      AUTHENTICATION_ERROR: 1.0,
      AUTHORIZATION_ERROR: 1.0,

      // Network errors - sample based on environment
      NETWORK_ERROR: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

      // Upload errors - moderate sampling
      UPLOAD_ERROR: 0.5,

      // Subscription errors - low sampling (high volume)
      SUBSCRIPTION_ERROR: 0.1,

      // Cache errors - very low sampling
      CACHE_ERROR: 0.05,

      // Unknown errors - always capture
      UNKNOWN_ERROR: 1.0,
    },
  },

  // Performance monitoring
  performance: {
    // Transaction sampling
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Backend operation tracking
    trackBackendOperations: true,

    // GraphQL operation tracking
    trackGraphQLOperations: true,

    // Upload operation tracking
    trackUploadOperations: true,

    // Real-time operation tracking
    trackRealtimeOperations: false, // High volume, disabled by default
  },

  // Backend-specific tags
  defaultTags: {
    component: 'frontend',
    service: 'lms-frontend',
    backend_integration: 'true',
  },

  // Backend-specific context
  defaultContext: {
    backend: {
      version: process.env.NEXT_PUBLIC_BACKEND_VERSION,
      environment: process.env.NEXT_PUBLIC_BACKEND_ENV,
      graphql_endpoint: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT,
      websocket_endpoint: process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT,
    },
    frontend: {
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      build_time: process.env.NEXT_PUBLIC_BUILD_TIME,
      commit_sha: process.env.NEXT_PUBLIC_COMMIT_SHA,
    },
  },
};

/**
 * Backend error severity mapping for Sentry levels
 */
export const BACKEND_SENTRY_LEVELS = {
  low: 'info',
  medium: 'warning',
  high: 'error',
  critical: 'fatal',
} as const;

/**
 * Backend-specific error fingerprinting
 */
export function getBackendErrorFingerprint(error: {
  type: string;
  code: string;
  operation?: string;
  field?: string;
}): string[] {
  const fingerprint = ['backend-error', error.type, error.code];

  // Add operation for more specific grouping
  if (error.operation) {
    fingerprint.push(error.operation);
  }

  // Add field for validation errors
  if (error.field && error.type === 'VALIDATION_ERROR') {
    fingerprint.push(error.field);
  }

  return fingerprint;
}

/**
 * Backend-specific error tags
 */
export function getBackendErrorTags(error: {
  type: string;
  code: string;
  category: string;
  severity: string;
  retryable: boolean;
  operation?: string;
  userId?: string;
}): Record<string, string> {
  return {
    'error.type': error.type,
    'error.code': error.code,
    'error.category': error.category,
    'error.severity': error.severity,
    'error.retryable': error.retryable.toString(),
    ...(error.operation && { 'error.operation': error.operation }),
    ...(error.userId && { 'user.id': error.userId }),
    'backend.integrated': 'true',
  };
}

/**
 * Backend-specific error context
 */
export function getBackendErrorContext(error: {
  message: string;
  context?: {
    operation?: string;
    variables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    requestId?: string;
  };
}): Record<string, unknown> {
  const context: Record<string, unknown> = {
    error: {
      message: error.message,
      backend_integrated: true,
    },
  };

  if (error.context?.operation) {
    context.operation = {
      name: error.context.operation,
      ...(error.context.variables && { variables: error.context.variables }),
      ...(error.context.requestId && { request_id: error.context.requestId }),
    };
  }

  if (error.context?.metadata) {
    context.metadata = error.context.metadata;
  }

  return context;
}

/**
 * Checks if error should be reported to Sentry based on backend configuration
 */
export function shouldReportBackendError(error: {
  type: string;
  code: string;
  severity: string;
}): boolean {
  // Always report critical errors
  if (error.severity === 'critical') {
    return true;
  }

  // Check sample rate for error type
  const sampleRate =
    BACKEND_SENTRY_CONFIG.errorFiltering.sampleRates[
      error.type as keyof typeof BACKEND_SENTRY_CONFIG.errorFiltering.sampleRates
    ] || 1.0;

  return Math.random() < sampleRate;
}

/**
 * Gets environment-specific Sentry DSN
 */
export function getBackendSentryDSN(): string | undefined {
  const environment = process.env.NODE_ENV || 'development';
  return BACKEND_SENTRY_CONFIG.dsn[environment as keyof typeof BACKEND_SENTRY_CONFIG.dsn];
}

/**
 * Creates backend-specific Sentry configuration object
 */
export function createBackendSentryConfig() {
  const environment = process.env.NODE_ENV || 'development';
  const dsn = getBackendSentryDSN();

  return {
    dsn,
    environment,
    release: process.env.NEXT_PUBLIC_APP_VERSION,

    // Sampling rates
    sampleRate: environment === 'production' ? 0.1 : 1.0,
    tracesSampleRate: BACKEND_SENTRY_CONFIG.performance.tracesSampleRate,

    // Error filtering
    ignoreErrors: BACKEND_SENTRY_CONFIG.errorFiltering.ignoreErrors,
    denyUrls: BACKEND_SENTRY_CONFIG.errorFiltering.ignoreUrls,

    // Default tags and context
    initialScope: {
      tags: BACKEND_SENTRY_CONFIG.defaultTags,
      contexts: {
        backend: BACKEND_SENTRY_CONFIG.defaultContext.backend,
        frontend: BACKEND_SENTRY_CONFIG.defaultContext.frontend,
      },
    },

    // Backend-specific integrations
    integrations: [
      // Add backend-specific integrations here if needed
    ],

    // Before send hook for backend error processing
    beforeSend: (event: Record<string, unknown>) => {
      // Add backend-specific processing
      if (event.tags && typeof event.tags === 'object') {
        const tags = event.tags as Record<string, unknown>;
        if (tags['backend.integrated']) {
          // This is a backend-integrated error, apply special handling
          event.fingerprint = event.fingerprint || ['backend-integrated-error'];
        }
      }

      return event;
    },

    // Before send transaction hook
    beforeSendTransaction: (event: Record<string, unknown>) => {
      // Add backend-specific transaction processing
      return event;
    },
  };
}

// Export alias for compatibility
export const backendSentryConfig = createBackendSentryConfig;
