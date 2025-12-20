/**
 * Apollo Client Configuration
 * 
 * Main GraphQL client setup with authentication, error handling, and caching.
 * Provides a fully configured Apollo Client with normalized cache, authentication,
 * error handling, and retry logic.
 */

import { ApolloClient, ApolloLink, createHttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { config } from '../config';
import { tokenManager } from '../auth/tokenStorage';
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
      connectionParams: async () => {
        // Get access token for WebSocket authentication
        const accessToken = tokenManager.getAccessToken();
        
        if (accessToken) {
          // Check if token needs refresh
          if (tokenManager.isTokenExpired(accessToken)) {
            try {
              const refreshedToken = await tokenManager.refreshAccessToken();
              return {
                authorization: `Bearer ${refreshedToken}`,
              };
            } catch (error) {
              console.warn('Token refresh failed for WebSocket connection:', error);
              return {};
            }
          }
          
          return {
            authorization: `Bearer ${accessToken}`,
          };
        }
        
        return {};
      },
      shouldRetry: (closeEvent) => {
        // Retry on connection errors but not on authentication failures (4401)
        return closeEvent.code !== 4401;
      },
      retryAttempts: 5,
      retryWait: async (retries) => {
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        const jitter = Math.random() * 0.1 * delay;
        return delay + jitter;
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
  const link = ApolloLink.from([
    authLink,
    authErrorLink,
    errorLink,
    retryLink,
    splitLink,
  ]);

  // Create cache configuration with backend integration
  const cache = createCacheConfig();

  // Load persisted cache if enabled
  if (config.features.realTime && cacheConfig.enablePersistence) {
    try {
      const { cachePersistence } = await import('./cache');
      cachePersistence.loadFromStorage(cache, 'lms-apollo-cache');
    } catch (error) {
      console.warn('Failed to load persisted cache:', error);
    }
  }

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
  });

  return client;
}

// Export the configured Apollo Client instance
export const apolloClient = createApolloClient();

// Export the client creation function for testing
export { createApolloClient };