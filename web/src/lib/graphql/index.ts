/**
 * GraphQL Client Module
 * 
 * Exports the configured Apollo Client and related utilities.
 */

// Main Apollo Client instance
export { apolloClient, createApolloClient } from './client';

// Provider and hooks
export { GraphQLProvider, useGraphQLClient } from './provider';

// Cache utilities
export { createCacheConfig, cacheHelpers } from './cache';

// Link utilities
export { createAuthLink, createAuthErrorLink } from './links/authLink';
export { createErrorLink, errorUtils } from './links/errorLink';
export { createRetryLink, retryUtils } from './links/retryLink';

// Re-export Apollo Client types for convenience
export type {
  ApolloClient,
  InMemoryCache,
  ApolloQueryResult,
  MutationHookOptions,
  QueryHookOptions,
  SubscriptionHookOptions,
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
} from '@apollo/client';