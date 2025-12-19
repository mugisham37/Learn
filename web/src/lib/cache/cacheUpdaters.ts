/**
 * Cache Update Utilities
 * 
 * Utilities for updating Apollo Client cache after mutations.
 * Provides common patterns for cache updates with error handling.
 */

import { InMemoryCache } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { CacheUpdateConfig, CacheUpdateResult, CacheUpdaters } from './types';
import { updateList, updateEntity, writeEntity, deleteEntity } from './cacheHelpers';

/**
 * Update cache after a mutation based on operation type
 */
export function updateCacheAfterMutation<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: CacheUpdateConfig<T>
): CacheUpdateResult {
  const updatedEntities: string[] = [];
  
  try {
    switch (config.operation) {
      case 'create':
        handleCreateOperation(cache, config, updatedEntities);
        break;
      
      case 'update':
        handleUpdateOperation(cache, config, updatedEntities);
        break;
      
      case 'delete':
        handleDeleteOperation(cache, config, updatedEntities);
        break;
      
      case 'append':
      case 'prepend':
        handleListOperation(cache, config);
        break;
      
      case 'merge':
        handleMergeOperation(cache, config, updatedEntities);
        break;
      
      default:
        throw new Error(`Unknown cache operation: ${config.operation}`);
    }

    return {
      success: true,
      updatedEntities,
    };
  } catch (error) {
    console.error('Cache update failed:', error);
    return {
      success: false,
      error: error as Error,
      updatedEntities,
    };
  }
}

/**
 * Handle create operation - add new entity and optionally add to lists
 */
function handleCreateOperation<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: CacheUpdateConfig<T>,
  updatedEntities: string[]
): void {
  // Write the new entity to cache
  writeEntity(cache, config.typename, config.data.id, config.data);
  updatedEntities.push(`${config.typename}:${config.data.id}`);

  // Add to list if specified
  if (config.listQuery && config.listFieldName) {
    addToList(
      cache,
      config.listQuery,
      config.listVariables || {},
      config.listFieldName,
      config.data
    );
  }
}

/**
 * Handle update operation - update existing entity
 */
function handleUpdateOperation<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: CacheUpdateConfig<T>,
  updatedEntities: string[]
): void {
  const entityId = config.id || config.data.id;
  if (!entityId) {
    throw new Error('Update operation requires entity ID');
  }

  updateEntity(cache, config.typename, entityId, config.data);
  updatedEntities.push(`${config.typename}:${entityId}`);
}

/**
 * Handle delete operation - remove entity and from lists
 */
function handleDeleteOperation<T>(
  cache: InMemoryCache,
  config: CacheUpdateConfig<T>,
  updatedEntities: string[]
): void {
  const entityId = config.id;
  if (!entityId) {
    throw new Error('Delete operation requires entity ID');
  }

  // Remove from list if specified
  if (config.listQuery && config.listFieldName) {
    removeFromList(
      cache,
      config.listQuery,
      config.listVariables || {},
      config.listFieldName,
      entityId
    );
  }

  // Delete the entity
  deleteEntity(cache, config.typename, entityId);
  updatedEntities.push(`${config.typename}:${entityId}`);
}

/**
 * Handle list operations (append/prepend)
 */
function handleListOperation<T>(
  cache: InMemoryCache,
  config: CacheUpdateConfig<T>
): void {
  if (!config.listQuery || !config.listFieldName) {
    throw new Error('List operation requires listQuery and listFieldName');
  }

  if (config.operation === 'append') {
    addToList(cache, config.listQuery, config.listVariables || {}, config.listFieldName, config.data);
  } else {
    prependToList(cache, config.listQuery, config.listVariables || {}, config.listFieldName, config.data);
  }
}

/**
 * Handle merge operation - merge data with existing entity
 */
function handleMergeOperation<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: CacheUpdateConfig<T>,
  updatedEntities: string[]
): void {
  const entityId = config.id || config.data.id;
  if (!entityId) {
    throw new Error('Merge operation requires entity ID');
  }

  updateEntity(cache, config.typename, entityId, config.data);
  updatedEntities.push(`${config.typename}:${entityId}`);
}

/**
 * Add an item to a list in the cache
 */
export function addToList<T>(
  cache: InMemoryCache,
  query: DocumentNode,
  variables: Record<string, unknown>,
  fieldName: string,
  item: T
): void {
  updateList(cache, query, variables, (existingList) => {
    // Check if item already exists to avoid duplicates
    const itemId = (item as Record<string, unknown>)?.id;
    if (itemId && existingList.some((existing: unknown) => (existing as Record<string, unknown>).id === itemId)) {
      return existingList;
    }
    
    return [...existingList, item];
  });
}

/**
 * Prepend an item to a list in the cache
 */
export function prependToList<T>(
  cache: InMemoryCache,
  query: DocumentNode,
  variables: Record<string, unknown>,
  fieldName: string,
  item: T
): void {
  updateList(cache, query, variables, (existingList) => {
    // Check if item already exists to avoid duplicates
    const itemId = (item as Record<string, unknown>)?.id;
    if (itemId && existingList.some((existing: unknown) => (existing as Record<string, unknown>).id === itemId)) {
      return existingList;
    }
    
    return [item, ...existingList];
  });
}

/**
 * Remove an item from a list in the cache
 */
export function removeFromList(
  cache: InMemoryCache,
  query: DocumentNode,
  variables: Record<string, unknown>,
  fieldName: string,
  itemId: string
): void {
  updateList(cache, query, variables, (existingList) => {
    return existingList.filter((item: unknown) => (item as Record<string, unknown>).id !== itemId);
  });
}

/**
 * Update an item in a list in the cache
 */
export function updateInList<T>(
  cache: InMemoryCache,
  query: DocumentNode,
  variables: Record<string, unknown>,
  fieldName: string,
  itemId: string,
  updates: Partial<T>
): void {
  updateList(cache, query, variables, (existingList) => {
    return existingList.map((item: unknown) => {
      const typedItem = item as Record<string, unknown>;
      if (typedItem.id === itemId) {
        return { ...typedItem, ...updates };
      }
      return item;
    });
  });
}

/**
 * Cache updater utilities object
 */
export const cacheUpdaters: CacheUpdaters = {
  updateCacheAfterMutation: updateCacheAfterMutation as <T>(cache: InMemoryCache, config: CacheUpdateConfig<T>) => CacheUpdateResult,
  addToList,
  removeFromList,
  updateInList,
};

/**
 * Common cache update patterns for specific entity types
 */
export const commonCacheUpdates = {
  /**
   * Course-related cache updates
   */
  course: {
    created: (cache: InMemoryCache, course: { id: string; __typename: string }) =>
      updateCacheAfterMutation(cache, {
        operation: 'create',
        typename: 'Course',
        data: course,
        // Could add to courses list if needed
      }),
    
    updated: (cache: InMemoryCache, course: { id: string; __typename: string }) =>
      updateCacheAfterMutation(cache, {
        operation: 'update',
        typename: 'Course',
        data: course,
      }),
    
    deleted: (cache: InMemoryCache, courseId: string) =>
      updateCacheAfterMutation(cache, {
        operation: 'delete',
        typename: 'Course',
        id: courseId,
        data: { id: courseId, __typename: 'Course' },
      }),
  },

  /**
   * Enrollment-related cache updates
   */
  enrollment: {
    created: (cache: InMemoryCache, enrollment: { id: string; __typename: string }) =>
      updateCacheAfterMutation(cache, {
        operation: 'create',
        typename: 'Enrollment',
        data: enrollment,
      }),
    
    progressUpdated: (cache: InMemoryCache, enrollmentId: string, progress: { percentage: number; lessons: unknown[] }) =>
      updateCacheAfterMutation(cache, {
        operation: 'merge',
        typename: 'Enrollment',
        id: enrollmentId,
        data: { 
          id: enrollmentId, 
          __typename: 'Enrollment',
          progressPercentage: progress.percentage, 
          lessonProgress: progress.lessons 
        },
      }),
  },

  /**
   * Message-related cache updates
   */
  message: {
    sent: (cache: InMemoryCache, message: { id: string; __typename: string }, conversationQuery: DocumentNode, variables: Record<string, unknown>) =>
      updateCacheAfterMutation(cache, {
        operation: 'prepend',
        typename: 'Message',
        data: message,
        listQuery: conversationQuery,
        listVariables: variables,
        listFieldName: 'messages',
      }),
  },
};