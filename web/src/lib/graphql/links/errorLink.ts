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