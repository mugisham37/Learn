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