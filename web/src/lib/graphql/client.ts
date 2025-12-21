/**
 * Apollo Client Configuration
 *
 * Main GraphQL client setup with authentication, error handling, and caching.
 * Provides a fully configured Apollo Client with normalized cache, authentication,
 * error handling, and retry logic. Supports both client-side and server-side rendering.
 */

import { ApolloClient, ApolloLink, HttpLink, split, FetchPolicy, NormalizedCacheObject } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { config } from '../config';
import { tokenManager } from '../auth/tokenStorage';
import { createAuthLink, createAuthErrorLink } from './links/authLink';
import { createErrorLink } from './links/errorLink';
import { createRetryLink } from './links/retryLink';
import { createBackendErrorLink } from '../errors/backendErrorLink';
import { createCacheConfig } from './cache';

/**
 * Creates and configures the main Apollo Client instance
 *
 * Features:
 * - Normalized cache with type policies
 * - Authentication with automatic token injection
 * - Backend-integrated error handling with classification and recovery
 * - Retry logic with exponential backoff
 * - WebSocket subscriptions with automatic reconnection (client-side only)
 * - Development tools integration
 * - Server-side rendering support
 */
async function createApolloClient(ssrMode: boolean = false) {
  // HTTP link for queries and mutations
  const httpLink = new HttpLink({
    uri: ssrMode
      ? config.graphqlEndpoint // Direct connection on server
      : '/api/graphql', // Use proxy in browser
    credentials: 'include', // Include cookies for authentication
    ...(ssrMode && { fetch }), // Only add fetch for SSR
  });

  // WebSocket link for subscriptions (client-side only)
  let wsLink: GraphQLWsLink | null = null;

  if (!ssrMode && typeof window !== 'undefined') {
    wsLink = new GraphQLWsLink(
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
        shouldRetry: (errOrCloseEvent: unknown) => {
          // Retry on connection errors but not on authentication failures (4401)
          const closeEvent = errOrCloseEvent as CloseEvent;
          return closeEvent.code !== 4401;
        },
        retryAttempts: 5,
        retryWait: async (retries: number): Promise<void> => {
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, retries), 30000);
          const jitter = Math.random() * 0.1 * delay;
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        },
      })
    );
  }

  // Split link to route queries/mutations to HTTP and subscriptions to WebSocket
  const splitLink = wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
          );
        },
        wsLink,
        httpLink
      )
    : httpLink;

  // Create authentication link
  const authLink = createAuthLink();

  // Create authentication error handling link
  const authErrorLink = createAuthErrorLink();

  // Create backend-specific error handling link
  const backendErrorLink = createBackendErrorLink();

  // Create general error handling link (fallback)
  const errorLink = createErrorLink();

  // Create retry link (disabled on server to avoid hanging)
  const retryLink = ssrMode ? null : createRetryLink();

  // Combine all links in the correct order
  // Order matters: auth -> auth-error -> backend-error -> error -> retry -> transport
  const links = [
    authLink,
    authErrorLink,
    backendErrorLink,
    errorLink,
    ...(retryLink ? [retryLink] : []),
    splitLink,
  ].filter(Boolean);

  const link = ApolloLink.from(links);

  // Create cache configuration with backend integration
  const cache = createCacheConfig();

  // Load persisted cache if enabled (client-side only)
  if (!ssrMode && config.features.realTime) {
    try {
      const { cachePersistence } = await import('./cache');
      cachePersistence.loadFromStorage(cache, 'lms-apollo-cache');
    } catch (error) {
      console.warn('Failed to load persisted cache:', error);
    }
  }

  return new ApolloClient({
    link,
    cache,
    ssrMode,
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
        fetchPolicy: (ssrMode ? 'cache-first' : 'cache-and-network') as FetchPolicy,
      },
      query: {
        errorPolicy: 'all',
        fetchPolicy: (ssrMode ? 'cache-first' : 'cache-and-network') as FetchPolicy,
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
    // Enable Apollo DevTools in development (client-side only)
    ...(config.enableDevTools && !ssrMode && { connectToDevTools: true }),
  });
}

// Create and export the configured Apollo Client instance
let apolloClientInstance: ApolloClient<any> | null = null;

export const apolloClient = (() => {
  if (typeof window === 'undefined') {
    // Server-side: create new instance for each request
    return null;
  }

  if (!apolloClientInstance) {
    createApolloClient(false)
      .then(client => {
        apolloClientInstance = client;
      })
      .catch(error => {
        console.error('Failed to create Apollo Client:', error);
      });
  }
  return apolloClientInstance;
})();

// Export async client creation for proper initialization
export async function getApolloClient(ssrMode: boolean = false) {
  if (ssrMode || typeof window === 'undefined') {
    // Always create new instance for server-side
    return await createApolloClient(true);
  }

  if (!apolloClientInstance) {
    apolloClientInstance = await createApolloClient(false);
  }
  return apolloClientInstance;
}

// Export the client creation function for testing
export { createApolloClient };
