/**
 * Cache Management Types
 * 
 * Type definitions for cache management utilities.
 */

import { InMemoryCache, Reference } from '@apollo/client';
import { DocumentNode } from 'graphql';

/**
 * Cache update operation types
 */
export type CacheUpdateOperation = 'create' | 'update' | 'delete' | 'append' | 'prepend' | 'merge';

/**
 * Cache update configuration
 */
export interface CacheUpdateConfig<T = any> {
  operation: CacheUpdateOperation;
  typename: string;
  data: T;
  id?: string;
  listQuery?: DocumentNode;
  listVariables?: Record<string, any>;
  listFieldName?: string;
}

/**
 * Cache invalidation configuration
 */
export interface CacheInvalidationConfig {
  typename?: string;
  id?: string;
  queries?: Array<{
    query: DocumentNode;
    variables?: Record<string, any>;
  }>;
  fieldNames?: string[];
}

/**
 * Optimistic response configuration
 */
export interface OptimisticResponseConfig<T = any> {
  operation: CacheUpdateOperation;
  typename: string;
  data: Partial<T>;
  id?: string;
  tempId?: string;
}

/**
 * Cache normalization helper configuration
 */
export interface CacheNormalizationConfig {
  typename: string;
  keyFields: string[];
  merge?: boolean;
}

/**
 * Cache update result
 */
export interface CacheUpdateResult {
  success: boolean;
  error?: Error;
  updatedEntities: string[];
}

/**
 * Cache helper utilities interface
 */
export interface CacheHelpers {
  readEntity<T>(cache: InMemoryCache, typename: string, id: string): T | null;
  writeEntity<T>(cache: InMemoryCache, typename: string, id: string, data: T): void;
  updateEntity<T>(cache: InMemoryCache, typename: string, id: string, updates: Partial<T>): void;
  deleteEntity(cache: InMemoryCache, typename: string, id: string): void;
  readList<T>(cache: InMemoryCache, query: DocumentNode, variables?: Record<string, any>): T[] | null;
  updateList<T>(cache: InMemoryCache, query: DocumentNode, variables: Record<string, any>, updater: (list: T[]) => T[]): void;
}

/**
 * Cache updater utilities interface
 */
export interface CacheUpdaters {
  updateCacheAfterMutation<T>(cache: InMemoryCache, config: CacheUpdateConfig<T>): CacheUpdateResult;
  addToList<T>(cache: InMemoryCache, query: DocumentNode, variables: Record<string, any>, fieldName: string, item: T): void;
  removeFromList(cache: InMemoryCache, query: DocumentNode, variables: Record<string, any>, fieldName: string, itemId: string): void;
  updateInList<T>(cache: InMemoryCache, query: DocumentNode, variables: Record<string, any>, fieldName: string, itemId: string, updates: Partial<T>): void;
}

/**
 * Cache invalidation utilities interface
 */
export interface CacheInvalidation {
  invalidateEntity(cache: InMemoryCache, typename: string, id: string): void;
  invalidateQueries(cache: InMemoryCache, queries: Array<{ query: DocumentNode; variables?: Record<string, any> }>): void;
  invalidateByFieldName(cache: InMemoryCache, fieldNames: string[]): void;
  invalidateAll(cache: InMemoryCache): void;
}

/**
 * Optimistic response generators interface
 */
export interface OptimisticResponseGenerators {
  generateOptimisticResponse<T>(config: OptimisticResponseConfig<T>): T;
  generateCreateResponse<T>(typename: string, data: Partial<T>): T;
  generateUpdateResponse<T>(typename: string, id: string, updates: Partial<T>): Partial<T>;
  generateDeleteResponse(typename: string, id: string): { __typename: string; id: string };
}