/**
 * Cache Management Module
 * 
 * Centralized cache management utilities for Apollo Client.
 * Provides cache update functions, invalidation strategies, and optimistic response generators.
 */

// Provider and hooks
export { CacheProvider, useCacheManager } from './provider';

export * from './cacheHelpers';
export * from './cacheUpdaters';
export * from './cacheInvalidation';
export * from './optimisticResponses';
export * from './subscriptionIntegration';
export * from './types';