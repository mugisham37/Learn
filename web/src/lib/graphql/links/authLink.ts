/**
 * Authentication Links
 *
 * Apollo Links for handling authentication.
 */

import { ApolloLink } from '@apollo/client';

export function createAuthLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    if (!forward) {
      throw new Error('Auth link must not be the last link in the chain');
    }

    return forward(operation);
  });
}

export function createAuthErrorLink(): ApolloLink {
  return new ApolloLink((operation, forward) => {
    if (!forward) {
      throw new Error('Auth error link must not be the last link in the chain');
    }

    return forward(operation);
  });
}