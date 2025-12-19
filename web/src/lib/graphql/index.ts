/**
 * GraphQL Client Module
 * 
 * Exports the configured Apollo Client and related utilities.
 */

// Main Apollo Client instance
export { apolloClient, createApolloClient } from './client';

// Cache utilities
export { createCacheConfig, cacheHelpers } from './cache';

// Link utilities
export { tokenManager, createAuthLink, createAuthErrorLink } from './links/authLink';
export { createErrorLink, errorUtils } from './links/errorLink';
export { createRetryLink, retryUtils } from './links/retryLink';

// Re-export Apollo Client types for convenience
export type {
  ApolloClient,
  InMemoryCache,
  ApolloError,
  ApolloQueryResult,
  MutationResult,
  SubscriptionResult,
  QueryResult,
  WatchQueryOptions,
  MutationOptions,
  SubscriptionOptions,
} from '@apollo/client';