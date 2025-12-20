/**
 * Subscription Cache Integration
 * 
 * Utilities for integrating subscription data with Apollo Client cache.
 * Provides cache update functions, invalidation strategies, and conflict resolution
 * for real-time data synchronization.
 */

import { ApolloCache } from '@apollo/client';
import { DocumentNode } from 'graphql';

/**
 * Cache update strategy for subscription data
 */
export type CacheUpdateStrategy = 'merge' | 'replace' | 'append' | 'prepend' | 'remove';

/**
 * Configuration for cache updates from subscription data
 */
export interface SubscriptionCacheConfig {
  strategy: CacheUpdateStrategy;
  fieldName: string;
  idField?: string;
  sortField?: string;
  maxItems?: number;
}

/**
 * Cache invalidation configuration
 */
export interface CacheInvalidationConfig {
  queries?: DocumentNode[];
  fieldPaths?: string[];
  entityTypes?: string[];
}

/**
 * Subscription cache manager for handling real-time cache updates
 */
export class SubscriptionCacheManager {
  private cache: ApolloCache;

  constructor(cache: ApolloCache) {
    this.cache = cache;
  }

  /**
   * Update cache with subscription data using specified strategy
   */
  updateCacheFromSubscription<T>(
    data: T,
    config: SubscriptionCacheConfig
  ): void {
    try {
      this.cache.modify({
        fields: {
          [config.fieldName]: (existingData: unknown) => {
            const dataArray = Array.isArray(existingData) ? existingData : [];
            return this.applyCacheUpdateStrategy(dataArray, data, config);
          },
        },
      });
    } catch (error) {
      console.warn(`Failed to update cache for field ${config.fieldName}:`, error);
    }
  }

  /**
   * Apply cache update strategy to existing data
   */
  private applyCacheUpdateStrategy<T>(
    existingData: unknown[],
    newData: T,
    config: SubscriptionCacheConfig
  ): unknown[] {
    switch (config.strategy) {
      case 'merge':
        return this.mergeData(existingData, newData, config);
      
      case 'replace':
        return Array.isArray(newData) ? newData : [newData];
      
      case 'append':
        return [...existingData, newData];
      
      case 'prepend':
        return [newData, ...existingData];
      
      case 'remove':
        return this.removeData(existingData, newData, config);
      
      default:
        return existingData;
    }
  }

  /**
   * Merge new data with existing data based on ID field
   */
  private mergeData<T>(
    existingData: unknown[],
    newData: T,
    config: SubscriptionCacheConfig
  ): unknown[] {
    const idField = config.idField || 'id';
    const newItem = newData as Record<string, unknown>;
    
    if (!newItem[idField]) {
      return [...existingData, newItem];
    }

    const existingIndex = existingData.findIndex((item) => {
      const existingItem = item as Record<string, unknown>;
      return existingItem[idField] === newItem[idField];
    });

    if (existingIndex >= 0) {
      // Update existing item
      const updatedData = [...existingData];
      const existingItem = updatedData[existingIndex] as Record<string, unknown>;
      updatedData[existingIndex] = { ...existingItem, ...newItem };
      return updatedData;
    } else {
      // Add new item
      const updatedData = [...existingData, newItem];
      
      // Apply sorting if specified
      if (config.sortField) {
        updatedData.sort((a, b) => {
          const aItem = a as Record<string, unknown>;
          const bItem = b as Record<string, unknown>;
          const aValue = aItem[config.sortField!];
          const bValue = bItem[config.sortField!];
          
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return aValue.localeCompare(bValue);
          }
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            return aValue - bValue;
          }
          return 0;
        });
      }
      
      // Apply max items limit
      if (config.maxItems && updatedData.length > config.maxItems) {
        return updatedData.slice(0, config.maxItems);
      }
      
      return updatedData;
    }
  }

  /**
   * Remove data from existing array based on ID field
   */
  private removeData<T>(
    existingData: unknown[],
    dataToRemove: T,
    config: SubscriptionCacheConfig
  ): unknown[] {
    const idField = config.idField || 'id';
    const itemToRemove = dataToRemove as Record<string, unknown>;
    
    if (!itemToRemove[idField]) {
      return existingData;
    }

    return existingData.filter((item) => {
      const existingItem = item as Record<string, unknown>;
      return existingItem[idField] !== itemToRemove[idField];
    });
  }

  /**
   * Invalidate cache entries based on configuration
   */
  invalidateCache(config: CacheInvalidationConfig): void {
    try {
      // Invalidate specific queries
      if (config.queries) {
        config.queries.forEach(() => {
          // Simple cache invalidation by clearing all data
          this.cache.evict({});
        });
      }

      // Invalidate specific field paths
      if (config.fieldPaths) {
        config.fieldPaths.forEach(fieldPath => {
          this.cache.modify({
            fields: {
              [fieldPath]: () => undefined,
            },
          });
        });
      }

      // Invalidate entity types
      if (config.entityTypes) {
        config.entityTypes.forEach(typeName => {
          this.cache.modify({
            fields: {
              [typeName]: () => undefined,
            },
          });
        });
      }

      // Garbage collect evicted entries
      this.cache.gc();
    } catch (error) {
      console.warn('Failed to invalidate cache:', error);
    }
  }

  /**
   * Handle cache conflicts when multiple updates occur simultaneously
   */
  resolveConflict<T>(
    existingData: T,
    incomingData: T,
    conflictResolutionStrategy: 'latest-wins' | 'merge' | 'custom' = 'latest-wins',
    customResolver?: (existing: T, incoming: T) => T
  ): T {
    switch (conflictResolutionStrategy) {
      case 'latest-wins':
        return incomingData;
      
      case 'merge':
        return { ...existingData, ...incomingData };
      
      case 'custom':
        return customResolver ? customResolver(existingData, incomingData) : incomingData;
      
      default:
        return incomingData;
    }
  }
}

/**
 * Predefined cache configurations for common subscription types
 */
export const SUBSCRIPTION_CACHE_CONFIGS = {
  messages: {
    strategy: 'prepend' as CacheUpdateStrategy,
    fieldName: 'messages',
    idField: 'id',
    sortField: 'createdAt',
    maxItems: 100,
  },
  
  progress: {
    strategy: 'merge' as CacheUpdateStrategy,
    fieldName: 'enrollmentProgress',
    idField: 'enrollmentId',
  },
  
  notifications: {
    strategy: 'prepend' as CacheUpdateStrategy,
    fieldName: 'notifications',
    idField: 'id',
    sortField: 'createdAt',
    maxItems: 50,
  },
  
  presence: {
    strategy: 'merge' as CacheUpdateStrategy,
    fieldName: 'coursePresence',
    idField: 'userId',
  },
} as const;

/**
 * Predefined cache invalidation configurations
 */
export const CACHE_INVALIDATION_CONFIGS = {
  messageUpdate: {
    fieldPaths: ['conversations', 'unreadMessageCount'],
  },
  
  progressUpdate: {
    fieldPaths: ['enrollments', 'courseProgress', 'userProgress'],
  },
  
  notificationUpdate: {
    fieldPaths: ['notifications', 'unreadNotificationCount'],
  },
  
  presenceUpdate: {
    fieldPaths: ['coursePresence', 'onlineUsers'],
  },
} as const;

/**
 * Factory function to create subscription cache manager
 */
export function createSubscriptionCacheManager(cache: ApolloCache): SubscriptionCacheManager {
  return new SubscriptionCacheManager(cache);
}

/**
 * Utility function to create cache update handler for subscriptions
 */
export function createCacheUpdateHandler<T>(
  cacheManager: SubscriptionCacheManager,
  config: SubscriptionCacheConfig
) {
  return (data: T) => {
    cacheManager.updateCacheFromSubscription(data, config);
  };
}

/**
 * Utility function to create cache invalidation handler
 */
export function createCacheInvalidationHandler(
  cacheManager: SubscriptionCacheManager,
  config: CacheInvalidationConfig
) {
  return () => {
    cacheManager.invalidateCache(config);
  };
}