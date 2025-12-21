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