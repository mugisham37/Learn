/**
 * Error Recovery Strategies
 *
 * Comprehensive error recovery system with retry mechanisms,
 * authentication error handling, network error recovery,
 * and graceful degradation strategies.
 */

import type { ClassifiedError, ErrorHandlerResult, ErrorRecoveryStrategy } from './errorTypes';
import { getBackendRetryConfig } from './backendErrorMapping';

/**
 * Retry configuration for different error types
 */
interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number;
}

/**
 * Default retry configurations by error type
 */
const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  NETWORK_ERROR: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  UNKNOWN_ERROR: {
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 8000,
    backoffMultiplier: 2,
    jitterFactor: 0.2,
  },
  SUBSCRIPTION_ERROR: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.1,
  },
  CACHE_ERROR: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
  UPLOAD_ERROR: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    jitterFactor: 0.15,
  },
};

/**
 * Recovery strategy definitions
 */
const RECOVERY_STRATEGIES: Record<string, ErrorRecoveryStrategy> = {
  AUTHENTICATION_ERROR: {
    canRecover: true,
    recoveryAction: 'refresh_token',
    showNotification: true,
    redirectTo: '/login',
  },
  AUTHORIZATION_ERROR: {
    canRecover: false,
    recoveryAction: 'show_error',
    showNotification: true,
  },
  VALIDATION_ERROR: {
    canRecover: false,
    recoveryAction: 'show_error',
    showNotification: true,
  },
  NETWORK_ERROR: {
    canRecover: true,
    recoveryAction: 'retry',
    showNotification: true,
  },
  UPLOAD_ERROR: {
    canRecover: true,
    recoveryAction: 'retry',
    showNotification: true,
  },
  SUBSCRIPTION_ERROR: {
    canRecover: true,
    recoveryAction: 'retry',
    showNotification: false, // Handle silently
  },
  CACHE_ERROR: {
    canRecover: true,
    recoveryAction: 'retry',
    showNotification: false,
  },
  UNKNOWN_ERROR: {
    canRecover: true,
    recoveryAction: 'retry',
    showNotification: true,
  },
};

/**
 * Retry attempt tracking
 */
interface RetryAttempt {
  errorId: string;
  attempts: number;
  lastAttempt: Date;
  nextRetryAt: Date;
}

/**
 * Main error recovery manager
 */
export class ErrorRecoveryManager {
  private retryAttempts = new Map<string, RetryAttempt>();
  private authTokenRefreshPromise: Promise<boolean> | null = null;

  /**
   * Handles error recovery for a classified error
   */
  async handleError(
    error: ClassifiedError,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    const strategy = RECOVERY_STRATEGIES[error.type];

    if (!strategy || !strategy.canRecover) {
      return {
        handled: false,
        shouldRetry: false,
        userMessage: error.userMessage,
        actions: ['show_error'],
      };
    }

    switch (strategy.recoveryAction) {
      case 'retry':
        return this.handleRetryRecovery(error, originalOperation);

      case 'refresh_token':
        return this.handleAuthRecovery(error, originalOperation);

      case 'redirect_login':
        return this.handleLoginRedirect(error);

      case 'show_error':
        return this.handleShowError(error);

      case 'custom':
        return this.handleCustomRecovery(error, strategy, originalOperation);

      default:
        return this.handleShowError(error);
    }
  }

  /**
   * Handles retry-based recovery with exponential backoff
   */
  private async handleRetryRecovery(
    error: ClassifiedError,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Use backend-specific retry config if available
    const backendRetryConfig = getBackendRetryConfig(error.type);
    const retryConfig = {
      ...DEFAULT_RETRY_CONFIGS[error.type],
      ...backendRetryConfig,
    };

    if (!retryConfig) {
      return {
        handled: false,
        shouldRetry: false,
        userMessage: error.userMessage,
        actions: ['no_retry_config'],
      };
    }

    const attempt = this.getOrCreateRetryAttempt(error.id);

    // Check if we've exceeded max attempts
    if (attempt.attempts >= retryConfig.maxAttempts) {
      this.retryAttempts.delete(error.id);
      return {
        handled: true,
        shouldRetry: false,
        userMessage: `${error.userMessage} Maximum retry attempts exceeded.`,
        actions: ['max_retries_exceeded'],
      };
    }

    // Calculate retry delay with exponential backoff and jitter
    const delay = this.calculateRetryDelay(attempt.attempts, retryConfig);
    const nextRetryAt = new Date(Date.now() + delay);

    // Update retry attempt
    attempt.attempts++;
    attempt.lastAttempt = new Date();
    attempt.nextRetryAt = nextRetryAt;

    // If we have the original operation, schedule retry
    if (originalOperation) {
      setTimeout(async () => {
        try {
          await originalOperation();
          // Success - remove retry tracking
          this.retryAttempts.delete(error.id);
        } catch (retryError) {
          // Retry failed - will be handled by the error system again
          console.warn('Retry attempt failed:', retryError);
        }
      }, delay);
    }

    return {
      handled: true,
      shouldRetry: true,
      retryDelay: delay,
      userMessage: `${error.userMessage} Retrying in ${Math.ceil(delay / 1000)} seconds...`,
      actions: ['scheduled_retry'],
    };
  }

  /**
   * Handles authentication error recovery
   */
  private async handleAuthRecovery(
    error: ClassifiedError,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    // Prevent multiple simultaneous token refresh attempts
    if (this.authTokenRefreshPromise) {
      try {
        const refreshSuccess = await this.authTokenRefreshPromise;
        if (refreshSuccess && originalOperation) {
          // Retry original operation with new token
          await originalOperation();
          return {
            handled: true,
            shouldRetry: false,
            userMessage: 'Authentication refreshed successfully.',
            actions: ['token_refreshed', 'operation_retried'],
          };
        }
      } catch (refreshError) {
        console.warn('Token refresh failed:', refreshError);
      }
    }

    // Start token refresh
    this.authTokenRefreshPromise = this.refreshAuthToken();

    try {
      const refreshSuccess = await this.authTokenRefreshPromise;

      if (refreshSuccess) {
        // Token refresh successful
        if (originalOperation) {
          await originalOperation();
          return {
            handled: true,
            shouldRetry: false,
            userMessage: 'Authentication refreshed successfully.',
            actions: ['token_refreshed', 'operation_retried'],
          };
        }

        return {
          handled: true,
          shouldRetry: false,
          userMessage: 'Authentication refreshed successfully.',
          actions: ['token_refreshed'],
        };
      } else {
        // Token refresh failed - redirect to login
        return {
          handled: true,
          shouldRetry: false,
          redirectTo: '/login',
          userMessage: 'Please log in again.',
          actions: ['token_refresh_failed', 'redirect_login'],
        };
      }
    } catch (refreshError) {
      console.error('Token refresh error:', refreshError);
      return {
        handled: true,
        shouldRetry: false,
        redirectTo: '/login',
        userMessage: 'Please log in again.',
        actions: ['token_refresh_error', 'redirect_login'],
      };
    } finally {
      this.authTokenRefreshPromise = null;
    }
  }

  /**
   * Handles login redirect recovery
   */
  private async handleLoginRedirect(error: ClassifiedError): Promise<ErrorHandlerResult> {
    // Store current location for redirect after login
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    }

    return {
      handled: true,
      shouldRetry: false,
      redirectTo: '/login',
      userMessage: error.userMessage,
      actions: ['redirect_login'],
    };
  }

  /**
   * Handles show error recovery (no recovery action)
   */
  private async handleShowError(error: ClassifiedError): Promise<ErrorHandlerResult> {
    return {
      handled: true,
      shouldRetry: false,
      userMessage: error.userMessage,
      actions: ['show_error'],
    };
  }

  /**
   * Handles custom recovery strategies
   */
  private async handleCustomRecovery(
    error: ClassifiedError,
    strategy: ErrorRecoveryStrategy,
    originalOperation?: () => Promise<unknown>
  ): Promise<ErrorHandlerResult> {
    if (strategy.customRecovery) {
      try {
        await strategy.customRecovery(error);
        return {
          handled: true,
          shouldRetry: !!originalOperation,
          userMessage: 'Error recovered successfully.',
          actions: ['custom_recovery_success'],
        };
      } catch (recoveryError) {
        console.error('Custom recovery failed:', recoveryError);
        return {
          handled: false,
          shouldRetry: false,
          userMessage: error.userMessage,
          actions: ['custom_recovery_failed'],
        };
      }
    }

    return this.handleShowError(error);
  }

  /**
   * Gets or creates retry attempt tracking
   */
  private getOrCreateRetryAttempt(errorId: string): RetryAttempt {
    let attempt = this.retryAttempts.get(errorId);

    if (!attempt) {
      attempt = {
        errorId,
        attempts: 0,
        lastAttempt: new Date(),
        nextRetryAt: new Date(),
      };
      this.retryAttempts.set(errorId, attempt);
    }

    return attempt;
  }

  /**
   * Calculates retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attemptNumber: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attemptNumber)
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber);

    // Apply maximum delay limit
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * config.jitterFactor * Math.random();

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Refreshes authentication token
   */
  private async refreshAuthToken(): Promise<boolean> {
    try {
      // This would integrate with your auth system
      // For now, we'll emit an event that the auth system can listen to
      if (typeof window !== 'undefined') {
        const refreshEvent = new CustomEvent('auth:refresh-token');
        window.dispatchEvent(refreshEvent);

        // Wait for auth system to handle refresh
        return new Promise(resolve => {
          const handleRefreshResult = (event: CustomEvent) => {
            window.removeEventListener('auth:refresh-result', handleRefreshResult as EventListener);
            resolve(event.detail.success);
          };

          window.addEventListener('auth:refresh-result', handleRefreshResult as EventListener);

          // Timeout after 10 seconds
          setTimeout(() => {
            window.removeEventListener('auth:refresh-result', handleRefreshResult as EventListener);
            resolve(false);
          }, 10000);
        });
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Clears retry attempts for a specific error
   */
  clearRetryAttempts(errorId: string): void {
    this.retryAttempts.delete(errorId);
  }

  /**
   * Clears all retry attempts
   */
  clearAllRetryAttempts(): void {
    this.retryAttempts.clear();
  }

  /**
   * Gets current retry attempts
   */
  getRetryAttempts(): Map<string, RetryAttempt> {
    return new Map(this.retryAttempts);
  }

  /**
   * Checks if an error is currently being retried
   */
  isRetrying(errorId: string): boolean {
    const attempt = this.retryAttempts.get(errorId);
    return attempt ? attempt.nextRetryAt > new Date() : false;
  }
}

/**
 * Network error recovery utilities
 */
export class NetworkErrorRecovery {
  /**
   * Handles network connectivity issues
   */
  static async handleConnectivityIssue(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return false;
    }

    try {
      // Try to fetch a small resource to test connectivity
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Monitors network status and provides feedback
   */
  static startNetworkMonitoring(): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    const handleOnline = () => {
      window.dispatchEvent(new CustomEvent('network:online'));
    };

    const handleOffline = () => {
      window.dispatchEvent(new CustomEvent('network:offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

// Export singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();
