/**
 * Subscription Cache Integration
 *
 * Provides cache update strategies and utilities for GraphQL subscriptions.
 * Handles optimistic updates, cache invalidation, and real-time data synchronization.
 */

import { InMemoryCache } from '@apollo/client';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface CacheUpdateStrategy {
  type: 'merge' | 'replace' | 'append' | 'prepend' | 'remove';
  field?: string;
  condition?: (existing: unknown, incoming: unknown) => boolean;
}

export interface CacheInvalidationRule {
  typename: string;
  fields?: string[];
  condition?: (data: unknown) => boolean;
}

export interface SubscriptionCacheConfig {
  updateStrategy: CacheUpdateStrategy;
  invalidationRules?: CacheInvalidationRule[];
  optimisticResponse?: (variables: Record<string, unknown>) => unknown;
}

export interface CacheInvalidationConfig {
  typename: string;
  id?: string;
  fieldNames?: string[];
}

// =============================================================================
// Cache Manager Class
// =============================================================================

export class SubscriptionCacheManager {
  private cache: InMemoryCache;
  private configs: Map<string, SubscriptionCacheConfig> = new Map();

  constructor(cache: InMemoryCache) {
    this.cache = cache;
  }

  registerConfig(subscriptionType: string, config: SubscriptionCacheConfig): void {
    this.configs.set(subscriptionType, config);
  }

  handleSubscriptionData(subscriptionType: string, data: unknown): void {
    const config = this.configs.get(subscriptionType);
    if (config) {
      updateCacheWithSubscriptionData(this.cache, data, config);
    }
  }

  invalidateCache(config: CacheInvalidationConfig): void {
    invalidateCacheForEntity(this.cache, config.typename, config.fieldNames);
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

export function createSubscriptionCacheManager(cache: InMemoryCache): SubscriptionCacheManager {
  return new SubscriptionCacheManager(cache);
}

export function createCacheUpdateHandler(
  cache: InMemoryCache,
  config: SubscriptionCacheConfig
) {
  return (data: unknown) => {
    updateCacheWithSubscriptionData(cache, data, config);
  };
}

export function createCacheInvalidationHandler(
  cache: InMemoryCache
) {
  return (config: CacheInvalidationConfig) => {
    invalidateCacheForEntity(cache, config.typename, config.fieldNames);
  };
}

// =============================================================================
// Configuration Constants
// =============================================================================

export const SUBSCRIPTION_CACHE_CONFIGS: Record<string, SubscriptionCacheConfig> = {
  MESSAGE_RECEIVED: {
    updateStrategy: { type: 'append', field: 'messages' },
    invalidationRules: [
      { typename: 'Conversation', fields: ['lastMessage', 'unreadCount'] }
    ]
  },
  NOTIFICATION_RECEIVED: {
    updateStrategy: { type: 'prepend', field: 'notifications' },
    invalidationRules: [
      { typename: 'User', fields: ['unreadNotificationCount'] }
    ]
  },
  PROGRESS_UPDATED: {
    updateStrategy: { type: 'replace' },
    invalidationRules: [
      { typename: 'Enrollment', fields: ['progress', 'completedLessons'] }
    ]
  },
  USER_PRESENCE: {
    updateStrategy: { type: 'merge' },
    invalidationRules: [
      { typename: 'Course', fields: ['activeUsers'] }
    ]
  }
};

export const CACHE_INVALIDATION_CONFIGS: Record<string, CacheInvalidationConfig> = {
  USER_UPDATED: {
    typename: 'User',
    fieldNames: ['profile', 'preferences']
  },
  COURSE_UPDATED: {
    typename: 'Course',
    fieldNames: ['title', 'description', 'modules']
  },
  ENROLLMENT_UPDATED: {
    typename: 'Enrollment',
    fieldNames: ['progress', 'status']
  }
};

// =============================================================================
// Cache Update Functions
// =============================================================================

/**
 * Update cache with subscription data
 */
export function updateCacheWithSubscriptionData(
  cache: InMemoryCache,
  subscriptionData: unknown,
  config: SubscriptionCacheConfig
): void {
  if (!subscriptionData) return;

  const { updateStrategy, invalidationRules } = config;

  // Apply cache updates based on strategy
  switch (updateStrategy.type) {
    case 'merge':
      handleMergeUpdate(cache, subscriptionData, updateStrategy);
      break;
    case 'replace':
      handleReplaceUpdate(cache, subscriptionData, updateStrategy);
      break;
    case 'append':
      handleAppendUpdate(cache, subscriptionData, updateStrategy);
      break;
    case 'prepend':
      handlePrependUpdate(cache, subscriptionData, updateStrategy);
      break;
    case 'remove':
      handleRemoveUpdate(cache, subscriptionData, updateStrategy);
      break;
  }

  // Apply invalidation rules
  if (invalidationRules) {
    invalidationRules.forEach(rule => {
      if (!rule.condition || rule.condition(subscriptionData)) {
        invalidateCacheForEntity(cache, rule.typename, rule.fields);
      }
    });
  }
}

/**
 * Invalidate cache for specific entity
 */
export function invalidateCacheForEntity(
  cache: InMemoryCache,
  typename: string,
  fields?: string[]
): void {
  if (fields) {
    // Invalidate specific fields
    fields.forEach(field => {
      cache.evict({ id: 'ROOT_QUERY', fieldName: field });
    });
  } else {
    // Invalidate all instances of the type
    cache.modify({
      fields: {
        [typename.toLowerCase()]: (existing, { DELETE }) => DELETE,
      },
    });
  }

  // Garbage collect dangling references
  cache.gc();
}

/**
 * Get cache update strategy based on subscription type
 */
export function getCacheUpdateStrategy(subscriptionType: string): CacheUpdateStrategy {
  switch (subscriptionType) {
    case 'MESSAGE_RECEIVED':
      return { type: 'append', field: 'messages' };
    case 'NOTIFICATION_RECEIVED':
      return { type: 'prepend', field: 'notifications' };
    case 'USER_PRESENCE':
      return { type: 'merge' };
    case 'PROGRESS_UPDATED':
      return { type: 'replace' };
    default:
      return { type: 'merge' };
  }
}

/**
 * Create optimistic response for mutation
 */
export function createOptimisticResponse(
  mutationType: string,
  variables: Record<string, unknown>
): unknown {
  switch (mutationType) {
    case 'sendMessage':
      return {
        __typename: 'Message',
        id: `temp-${Date.now()}`,
        content: variables.content,
        createdAt: new Date().toISOString(),
        user: variables.user,
        status: 'SENDING',
      };
    case 'createNotification':
      return {
        __typename: 'Notification',
        id: `temp-${Date.now()}`,
        title: variables.title,
        message: variables.message,
        type: variables.type,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
    default:
      return null;
  }
}

// =============================================================================
// Private Helper Functions
// =============================================================================

function handleMergeUpdate(
  cache: InMemoryCache,
  data: unknown,
  strategy: CacheUpdateStrategy
): void {
  // Implement merge logic
  const dataObj = data as Record<string, unknown>;
  if (dataObj.__typename && dataObj.id) {
    const entityId = `${dataObj.__typename}:${dataObj.id}`;
    
    cache.modify({
      id: entityId,
      fields: {
        ...Object.keys(dataObj).reduce((acc, key) => {
          if (key !== '__typename' && key !== 'id') {
            acc[key] = (existing) => {
              // Use strategy condition if provided
              if (strategy.condition) {
                return strategy.condition(existing, dataObj[key]) ? dataObj[key] : existing;
              }
              return dataObj[key];
            };
          }
          return acc;
        }, {} as Record<string, (existing: unknown) => unknown>),
      },
    });
  }
}

function handleReplaceUpdate(
  cache: InMemoryCache,
  data: unknown,
  strategy: CacheUpdateStrategy
): void {
  // Implement replace logic
  if (strategy.field) {
    cache.modify({
      id: 'ROOT_QUERY',
      fields: {
        [strategy.field]: (existing) => {
          // Use strategy condition if provided
          if (strategy.condition) {
            return strategy.condition(existing, data) ? data : existing;
          }
          return data;
        },
      },
    });
  }
}

function handleAppendUpdate(
  cache: InMemoryCache,
  data: unknown,
  strategy: CacheUpdateStrategy
): void {
  // Implement append logic
  if (strategy.field) {
    cache.modify({
      id: 'ROOT_QUERY',
      fields: {
        [strategy.field]: (existing = []) => {
          const existingArray = Array.isArray(existing) ? existing : [];
          // Use strategy condition if provided
          if (strategy.condition && !strategy.condition(existingArray, data)) {
            return existingArray;
          }
          return [...existingArray, data];
        },
      },
    });
  }
}

function handlePrependUpdate(
  cache: InMemoryCache,
  data: unknown,
  strategy: CacheUpdateStrategy
): void {
  // Implement prepend logic
  if (strategy.field) {
    cache.modify({
      id: 'ROOT_QUERY',
      fields: {
        [strategy.field]: (existing = []) => {
          const existingArray = Array.isArray(existing) ? existing : [];
          // Use strategy condition if provided
          if (strategy.condition && !strategy.condition(existingArray, data)) {
            return existingArray;
          }
          return [data, ...existingArray];
        },
      },
    });
  }
}

function handleRemoveUpdate(
  cache: InMemoryCache,
  data: unknown,
  strategy: CacheUpdateStrategy
): void {
  // Implement remove logic
  const dataObj = data as Record<string, unknown>;
  if (dataObj.__typename && dataObj.id) {
    // Use strategy condition if provided
    if (strategy.condition && !strategy.condition(null, dataObj)) {
      return; // Don't remove if condition fails
    }
    
    const entityId = `${dataObj.__typename}:${dataObj.id}`;
    cache.evict({ id: entityId });
    cache.gc();
  }
}