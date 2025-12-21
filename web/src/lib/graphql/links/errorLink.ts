/**
 * Error Link
 *
 * Apollo Link for general error handling.
 */

import { ApolloLink } from '@apollo/client';

export function createErrorLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    if (!forward) {
      throw new Error('Error link must not be the last link in the chain');
    }

    return forward(operation);
  });
}

/**
 * Error utilities for GraphQL error handling
 */
export const errorUtils = {
  /**
   * Check if error is a network error
   */
  isNetworkError: (error: unknown): boolean => {
    return error instanceof Error && error.message.includes('NetworkError');
  },

  /**
   * Check if error is a GraphQL error
   */
  isGraphQLError: (error: unknown): boolean => {
    return error instanceof Error && error.message.includes('GraphQL');
  },

  /**
   * Extract error message from various error types
   */
  extractErrorMessage: (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  },
};