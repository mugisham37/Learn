/**
 * Retry Link
 *
 * Apollo Link that implements intelligent retry logic with exponential backoff
 * for network errors and transient failures.
 */

import { RetryLink } from '@apollo/client/link/retry';
import type { Operation, FetchResult } from '@apollo/client/core';

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterMax: number;
  retryableStatusCodes: number[];
  retryableErrorCodes: string[];
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterMax: 1000, // Up to 1 second of jitter
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrorCodes: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'INTERNAL_SERVER_ERROR',
    'SERVICE_UNAVAILABLE',
    'BAD_GATEWAY',
    'GATEWAY_TIMEOUT',
  ],
};

/**
 * Request deduplication utility
 */
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<FetchResult>>();

  /**
   * Generates a unique key for a GraphQL operation
   */
  private generateKey(operation: Operation): string {
    const { operationName, query, variables } = operation;
    return `${operationName || 'anonymous'}:${query.loc?.source.body}:${JSON.stringify(variables)}`;
  }

  /**
   * Deduplicates requests by returning existing promise for identical operations
   */
  deduplicate<T extends FetchResult>(
    operation: Operation,
    executeRequest: () => Promise<T>
  ): Promise<T> {
    const key = this.generateKey(operation);

    // Check if identical request is already pending
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Execute new request
    const promise = executeRequest().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Clears all pending requests (useful for cleanup)
   */
  clear(): void {
    this.pendingRequests.clear();
  }
}

/**
 * Exponential backoff calculator
 */
class BackoffCalculator {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  /**
   * Calculates delay for a given attempt number
   */
  calculateDelay(attemptNumber: number): number {
    // Exponential backoff: delay = initialDelay * (backoffMultiplier ^ attemptNumber)
    const exponentialDelay =
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attemptNumber - 1);

    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.config.jitterMax;

    return cappedDelay + jitter;
  }
}

/**
 * Retry condition checker
 */
class RetryChecker {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  /**
   * Determines if an error is retryable
   */
  isRetryable(
    error: {
      networkError?: { code?: string; name?: string; statusCode?: number };
      graphQLErrors?: { extensions?: { code?: string } }[];
    },
    attemptNumber: number
  ): boolean {
    // Don't retry if max attempts reached
    if (attemptNumber >= this.config.maxAttempts) {
      return false;
    }

    // Check for network errors
    if (this.isNetworkError(error)) {
      return true;
    }

    // Check for retryable GraphQL errors
    if (this.isRetryableGraphQLError(error)) {
      return true;
    }

    // Check for retryable HTTP status codes
    if (this.isRetryableHttpError(error)) {
      return true;
    }

    return false;
  }

  /**
   * Checks if error is a network error
   */
  private isNetworkError(error: {
    networkError?: { code?: string; name?: string; statusCode?: number };
  }): boolean {
    return !!(
      error.networkError &&
      (error.networkError.code === 'NETWORK_ERROR' ||
        error.networkError.name === 'NetworkError' ||
        !error.networkError.statusCode)
    );
  }

  /**
   * Checks if GraphQL error is retryable
   */
  private isRetryableGraphQLError(error: {
    graphQLErrors?: { extensions?: { code?: string } }[];
  }): boolean {
    if (!error.graphQLErrors) {
      return false;
    }

    return error.graphQLErrors.some(gqlError => {
      const code = gqlError.extensions?.code;
      return code && this.config.retryableErrorCodes.includes(code);
    });
  }

  /**
   * Checks if HTTP error is retryable
   */
  private isRetryableHttpError(error: { networkError?: { statusCode?: number } }): boolean {
    if (!error.networkError || !error.networkError.statusCode) {
      return false;
    }

    const statusCode = error.networkError.statusCode;
    return this.config.retryableStatusCodes.includes(statusCode);
  }
}

/**
 * Creates the retry link with intelligent retry logic
 */
export function createRetryLink(customConfig?: Partial<RetryConfig>) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...customConfig };
  const backoffCalculator = new BackoffCalculator(config);
  const retryChecker = new RetryChecker(config);

  return new RetryLink({
    delay: (count: number, operation: Operation, error: unknown) => {
      // Log retry attempt in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `🔄 Retrying ${operation.operationName || 'operation'} (attempt ${count}/${config.maxAttempts})`,
          { error, variables: operation.variables }
        );
      }

      return backoffCalculator.calculateDelay(count);
    },

    attempts: (count: number, operation: Operation, error: unknown) => {
      const shouldRetry = retryChecker.isRetryable(
        error as {
          networkError?: { code?: string; name?: string; statusCode?: number };
          graphQLErrors?: { extensions?: { code?: string } }[];
        },
        count
      );

      // Log final failure in development
      if (!shouldRetry && process.env.NODE_ENV === 'development') {
        console.error(
          `❌ Giving up on ${operation.operationName || 'operation'} after ${count} attempts`,
          { error, variables: operation.variables }
        );
      }

      return !!shouldRetry;
    },
  });
}

/**
 * Creates a retry link with request deduplication
 */
export function createRetryLinkWithDeduplication(customConfig?: Partial<RetryConfig>) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...customConfig };
  const backoffCalculator = new BackoffCalculator(config);
  const retryChecker = new RetryChecker(config);

  return new RetryLink({
    delay: (count: number, operation: Operation, error: unknown) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `🔄 Retrying ${operation.operationName || 'operation'} (attempt ${count}/${config.maxAttempts})`,
          { error, variables: operation.variables }
        );
      }

      return backoffCalculator.calculateDelay(count);
    },

    attempts: (count: number, operation: Operation, error: unknown) => {
      const shouldRetry = retryChecker.isRetryable(
        error as {
          networkError?: { code?: string; name?: string; statusCode?: number };
          graphQLErrors?: { extensions?: { code?: string } }[];
        },
        count
      );

      if (!shouldRetry && process.env.NODE_ENV === 'development') {
        console.error(
          `❌ Giving up on ${operation.operationName || 'operation'} after ${count} attempts`,
          { error, variables: operation.variables }
        );
      }

      return !!shouldRetry;
    },
  });
}

/**
 * Utility functions for retry logic
 */
export const retryUtils = {
  /**
   * Creates a custom retry configuration
   */
  createRetryConfig: (overrides: Partial<RetryConfig>): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    ...overrides,
  }),

  /**
   * Calculates total maximum retry time
   */
  calculateMaxRetryTime: (config: RetryConfig): number => {
    let totalTime = 0;
    for (let i = 1; i <= config.maxAttempts; i++) {
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, i - 1),
        config.maxDelay
      );
      totalTime += delay;
    }
    return totalTime + config.jitterMax * config.maxAttempts;
  },

  /**
   * Creates a retry configuration optimized for real-time operations
   */
  createRealtimeRetryConfig: (): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 5,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    jitterMax: 200,
  }),

  /**
   * Creates a retry configuration optimized for file uploads
   */
  createUploadRetryConfig: (): RetryConfig => ({
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 2,
    initialDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterMax: 500,
    retryableStatusCodes: [408, 500, 502, 503, 504], // Don't retry 429 for uploads
  }),
};

// Export classes for testing
export { RequestDeduplicator, BackoffCalculator, RetryChecker, type RetryConfig };
