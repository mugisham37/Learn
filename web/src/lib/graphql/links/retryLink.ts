/**
 * Retry Link
 *
 * Apollo Link for request retry logic.
 */

import { ApolloLink } from '@apollo/client';

export function createRetryLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    if (!forward) {
      throw new Error('Retry link must not be the last link in the chain');
    }

    return forward(operation);
  });
}

/**
 * Retry utilities for GraphQL request retry logic
 */
export const retryUtils = {
  /**
   * Check if error is retryable
   */
  isRetryableError: (error: unknown): boolean => {
    if (error instanceof Error) {
      return error.message.includes('NetworkError') || error.message.includes('timeout');
    }
    return false;
  },

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay: (attempt: number, baseDelay: number = 1000): number => {
    return Math.min(baseDelay * Math.pow(2, attempt), 30000);
  },

  /**
   * Check if maximum retry attempts reached
   */
  shouldRetry: (attempt: number, maxAttempts: number = 3): boolean => {
    return attempt < maxAttempts;
  },
};