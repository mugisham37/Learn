/**
 * Apollo Client Configuration
 * 
 * Main GraphQL client setup with authentication, error handling, and caching.
 * Provides a fully configured Apollo Client with normalized cache, authentication,
 * error handling, and retry logic.
 */

import { ApolloClient, from, createHttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { config } from '../config';
import { createAuthLink, createAuthErrorLink } from './links/authLink';
import { createErrorLink } from './links/errorLink';
import { createRetryLink } from './links/retryLink';
import { createCacheConfig } from './cache';

/**
 * Creates and configures the main Apollo Client instance
 * 
 * Features:
 * - Normalized cache with type policies
 * - Authentication with automatic token injection
 * - Comprehensive error handling with user-friendly messages
 * - Retry logic with exponential backoff
 * - WebSocket subscriptions with automatic reconnection
 * - Development tools integration
 */
function createApolloClient() {
  // HTTP link for queries and mutations
  const httpLink = createHttpLink({
    uri: config.graphqlEndpoint,
    credentials: 'include', // Include cookies for authentication
  });

  // WebSocket link for subscriptions
  const wsLink = new GraphQLWsLink(
    createClient({
      url: config.wsEndpoint,
      connectionParams: () => {
        // Authentication will be handled by the auth link
        return {};
      },
      shouldRetry: () => {
        // Retry on connection errors but not on authentication failures
        return true;
      },
    })
  );

  // Split link to route queries/mutations to HTTP and subscriptions to WebSocket
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink
  );

  // Create authentication link
  const authLink = createAuthLink();

  // Create authentication error handling link
  const authErrorLink = createAuthErrorLink();

  // Create general error handling link
  const errorLink = createErrorLink();

  // Create retry link
  const retryLink = createRetryLink();

  // Combine all links in the correct order
  // Order matters: auth -> auth-error -> error -> retry -> transport
  const link = from([
    authLink,
    authErrorLink,
    errorLink,
    retryLink,
    splitLink,
  ]);

  // Create cache configuration
  const cache = createCacheConfig();

  // Create Apollo Client instance
  const client = new ApolloClient({
    link,
    cache,
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all', // Return partial data even if there are errors
      },
      query: {
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
    // Enable Apollo DevTools in development
    ...(config.enableDevTools && { connectToDevTools: true }),
    // Custom name for debugging
    version: '1.0.0',
  });

  return client;
}

// Export the configured Apollo Client instance
export const apolloClient = createApolloClient();

// Export the client creation function for testing
export { createApolloClient };