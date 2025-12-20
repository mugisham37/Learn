/**
 * Cache Management Types
 * 
 * Type definitions for cache management utilities.
 */

import { InMemoryCache } from '@apollo/client';
import { DocumentNode } from 'graphql';

/**
 * Cache update operation types
 */
export type CacheUpdateOperation = 'create' | 'update' | 'delete' | 'append' | 'prepend' | 'merge';

/**
 * Base entity interface for cache operations
 */
export interface CacheEntity {
  id: string;
  __typename: string;
  createdAt?: string;
  updatedAt?: string;
  // Common fields that might be present in entities
  status?: string;
  progressPercentage?: number;
  readBy?: Array<{ userId: string; readAt: string }>;
  // Course-specific fields
  publishedAt?: string;
  enrollmentCount?: number;
  modules?: unknown[];
  averageRating?: number | null;
  // Enrollment-specific fields
  enrolledAt?: string;
  lessonProgress?: unknown[];
  lastAccessedAt?: string;
  completedAt?: string;
  // Message-specific fields
  sentAt?: string;
  // Assignment-specific fields
  submittedAt?: string;
  grade?: number | null;
  feedback?: string | null;
  gradedAt?: string;
  // User-specific fields
  profile?: Record<string, unknown>;
  notificationPreferences?: Record<string, unknown>;
  // Discussion-specific fields
  replyCount?: number;
  lastReplyAt?: string | null;
  isPinned?: boolean;
  isLocked?: boolean;
  isEdited?: boolean;
  editedAt?: string | null;
  // Notification-specific fields
  isRead?: boolean;
  readAt?: string;
}

/**
 * Cache update configuration
 */
export interface CacheUpdateConfig<T extends CacheEntity = CacheEntity> {
  operation: CacheUpdateOperation;
  typename: string;
  data: T;
  id?: string;
  listQuery?: DocumentNode;
  listVariables?: Record<string, unknown>;
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
    variables?: Record<string, unknown>;
  }>;
  fieldNames?: string[];
}

/**
 * Optimistic response configuration
 */
export interface OptimisticResponseConfig<T extends Partial<CacheEntity> = Partial<CacheEntity>> {
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
  readEntity<T extends CacheEntity>(cache: InMemoryCache, typename: string, id: string): T | null;
  writeEntity<T extends CacheEntity>(cache: InMemoryCache, typename: string, id: string, data: T): void;
  updateEntity<T extends CacheEntity>(cache: InMemoryCache, typename: string, id: string, updates: Partial<T>): void;
  deleteEntity(cache: InMemoryCache, typename: string, id: string): void;
  readList<T extends CacheEntity>(cache: InMemoryCache, query: DocumentNode, variables?: Record<string, unknown>): T[] | null;
  updateList<T extends CacheEntity>(cache: InMemoryCache, query: DocumentNode, variables: Record<string, unknown>, updater: (list: T[]) => T[]): void;
}

/**
 * Cache updater utilities interface
 */
export interface CacheUpdaters {
  updateCacheAfterMutation<T extends CacheEntity>(cache: InMemoryCache, config: CacheUpdateConfig<T>): CacheUpdateResult;
  addToList<T extends CacheEntity>(cache: InMemoryCache, query: DocumentNode, variables: Record<string, unknown>, fieldName: string, item: T): void;
  removeFromList(cache: InMemoryCache, query: DocumentNode, variables: Record<string, unknown>, fieldName: string, itemId: string): void;
  updateInList<T extends CacheEntity>(cache: InMemoryCache, query: DocumentNode, variables: Record<string, unknown>, fieldName: string, itemId: string, updates: Partial<T>): void;
}

/**
 * Cache invalidation utilities interface
 */
export interface CacheInvalidation {
  invalidateEntity(cache: InMemoryCache, typename: string, id: string): void;
  invalidateQueries(cache: InMemoryCache, queries: Array<{ query: DocumentNode; variables?: Record<string, unknown> }>): void;
  invalidateByFieldName(cache: InMemoryCache, fieldNames: string[]): void;
  invalidateAll(cache: InMemoryCache): void;
}

/**
 * Optimistic response generators interface
 */
export interface OptimisticResponseGenerators {
  generateOptimisticResponse<T extends CacheEntity>(config: OptimisticResponseConfig<T>): T;
  generateCreateResponse<T extends Partial<CacheEntity>>(typename: string, data: Partial<T>): T & CacheEntity;
  generateUpdateResponse<T extends CacheEntity>(typename: string, id: string, updates: Partial<T>): Partial<T>;
  generateDeleteResponse(typename: string, id: string): { __typename: string; id: string };
}