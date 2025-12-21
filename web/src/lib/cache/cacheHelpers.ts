/**
 * Cache Helper Utilities
 *
 * Core utilities for reading and writing to Apollo Client cache.
 * Provides type-safe cache operations with error handling.
 */

import { InMemoryCache, gql } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { CacheHelpers, CacheEntity } from './types';

/**
 * Read a single entity from the cache by typename and id
 */
export function readEntity<T extends CacheEntity>(
  cache: InMemoryCache,
  typename: string,
  id: string
): T | null {
  try {
    const entityId = cache.identify({ __typename: typename, id });
    if (!entityId) return null;

    return cache.readFragment({
      id: entityId,
      fragment: gql`
        fragment ${typename}Fragment on ${typename} {
          id
          __typename
        }
      `,
    });
  } catch (error) {
    console.warn(`Failed to read entity ${typename}:${id}`, error);
    return null;
  }
}

/**
 * Write a single entity to the cache
 */
export function writeEntity<T extends CacheEntity>(
  cache: InMemoryCache,
  typename: string,
  id: string,
  data: T
): void {
  try {
    const entityId = cache.identify({ __typename: typename, id });
    if (!entityId) {
      console.warn(`Cannot identify entity ${typename}:${id}`);
      return;
    }

    cache.writeFragment({
      id: entityId,
      fragment: gql`
        fragment ${typename}Fragment on ${typename} {
          id
          __typename
        }
      `,
      data: {
        ...data,
        __typename: typename,
        id,
      },
    });
  } catch (error) {
    console.error(`Failed to write entity ${typename}:${id}`, error);
  }
}

/**
 * Update a single entity in the cache with partial data
 */
export function updateEntity<T extends CacheEntity>(
  cache: InMemoryCache,
  typename: string,
  id: string,
  updates: Partial<T>
): void {
  try {
    const entityId = cache.identify({ __typename: typename, id });
    if (!entityId) {
      console.warn(`Cannot identify entity ${typename}:${id}`);
      return;
    }

    cache.updateFragment(
      {
        id: entityId,
        fragment: gql`
          fragment ${typename}Fragment on ${typename} {
            id
            __typename
          }
        `,
      },
      data => {
        if (!data) return null;
        return {
          ...data,
          ...updates,
        };
      }
    );
  } catch (error) {
    console.error(`Failed to update entity ${typename}:${id}`, error);
  }
}

/**
 * Delete an entity from the cache
 */
export function deleteEntity(cache: InMemoryCache, typename: string, id: string): void {
  try {
    const entityId = cache.identify({ __typename: typename, id });
    if (!entityId) {
      console.warn(`Cannot identify entity ${typename}:${id}`);
      return;
    }

    cache.evict({ id: entityId });
    cache.gc(); // Garbage collect to clean up orphaned references
  } catch (error) {
    console.error(`Failed to delete entity ${typename}:${id}`, error);
  }
}

/**
 * Read a list from a query result
 */
export function readList<T extends CacheEntity>(
  cache: InMemoryCache,
  query: DocumentNode,
  variables: Record<string, unknown> = {}
): T[] | null {
  try {
    const result = cache.readQuery({
      query,
      variables,
    });

    // Extract the list from the query result
    // Assumes the query has a single root field that contains the list
    const rootFields = Object.keys(result || {});
    const rootField = rootFields[0];

    if (!rootField || !result) {
      return null;
    }

    const resultData = result as Record<string, unknown>;
    return (resultData[rootField] as T[]) || null;
  } catch (error) {
    console.warn('Failed to read list from cache', error);
    return null;
  }
}

/**
 * Update a list in the cache using an updater function
 */
export function updateList<T extends CacheEntity>(
  cache: InMemoryCache,
  query: DocumentNode,
  variables: Record<string, unknown>,
  updater: (list: T[]) => T[]
): void {
  try {
    cache.updateQuery({ query, variables }, existingData => {
      if (!existingData) return existingData;

      // Find the list field in the query result
      const rootFields = Object.keys(existingData);
      const rootField = rootFields[0];

      if (!rootField) {
        console.warn('Query result does not contain any fields');
        return existingData;
      }

      const existingDataTyped = existingData as Record<string, unknown>;
      const existingList = existingDataTyped[rootField];

      if (!Array.isArray(existingList)) {
        console.warn('Query result does not contain a list');
        return existingData;
      }

      const updatedList = updater(existingList as T[]);

      return {
        ...existingData,
        [rootField]: updatedList,
      };
    });
  } catch (error) {
    console.error('Failed to update list in cache', error);
  }
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(cache: InMemoryCache): {
  size: number;
  entities: number;
  queries: number;
} {
  try {
    const data = cache.extract();
    const entities = Object.keys(data).filter(
      key => key !== 'ROOT_QUERY' && key !== 'ROOT_MUTATION'
    ).length;
    const queries = data.ROOT_QUERY ? Object.keys(data.ROOT_QUERY).length : 0;

    return {
      size: JSON.stringify(data).length,
      entities,
      queries,
    };
  } catch (error) {
    console.error('Failed to get cache stats', error);
    return { size: 0, entities: 0, queries: 0 };
  }
}

/**
 * Cache helper utilities object
 */
export const cacheHelpers: CacheHelpers = {
  readEntity,
  writeEntity,
  updateEntity,
  deleteEntity,
  readList,
  updateList,
};

// Re-export individual functions for convenience
export {
  readEntity as readCacheEntity,
  writeEntity as writeCacheEntity,
  updateEntity as updateCacheEntity,
  deleteEntity as deleteCacheEntity,
  readList as readCacheList,
  updateList as updateCacheList,
};
