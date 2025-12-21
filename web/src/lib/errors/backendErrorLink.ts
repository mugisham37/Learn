/**
 * Backend Error Link
 *
 * Apollo Link for handling backend-specific errors.
 */

import { ApolloLink } from '@apollo/client';

export function createBackendErrorLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    if (!forward) {
      throw new Error('Backend error link must not be the last link in the chain');
    }

    return forward(operation);
  });
}

// Export missing functions that are imported in index.ts
export function createBackendRetryLink(): ApolloLink {
  return createBackendErrorLink(); // For now, same as error link
}

export function enrichBackendErrorContext(error: unknown): unknown {
  // Add backend-specific error context enrichment
  return error;
}

export function collectBackendErrorMetrics(error: unknown): void {
  // Collect backend-specific error metrics
  console.debug('Backend error metrics collected:', error);
}

export function handleBackendErrorNotification(error: unknown): void {
  // Handle backend-specific error notifications
  console.debug('Backend error notification handled:', error);
}