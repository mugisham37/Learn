/**
 * Cache Invalidation Utilities
 *
 * Utilities for invalidating Apollo Client cache entries.
 * Provides strategies for cache invalidation and cleanup.
 */

import { InMemoryCache } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { CacheInvalidationConfig, CacheInvalidation } from './types';

// Export the CacheInvalidationConfig type for use in other modules
export type { CacheInvalidationConfig } from './types';

/**
 * Invalidate a specific entity in the cache
 */
export function invalidateEntity(cache: InMemoryCache, typename: string, id: string): void {
  try {
    const entityId = cache.identify({ __typename: typename, id });
    if (entityId) {
      cache.evict({ id: entityId });
    }
  } catch (error) {
    console.error(`Failed to invalidate entity ${typename}:${id}`, error);
  }
}

/**
 * Invalidate specific queries in the cache
 */
export function invalidateQueries(
  cache: InMemoryCache,
  queries: Array<{ query: DocumentNode; variables?: Record<string, unknown> }>
): void {
  try {
    queries.forEach(({ query, variables }) => {
      const evictOptions: { id: string; fieldName: string; args?: Record<string, unknown> } = {
        id: 'ROOT_QUERY',
        fieldName: getQueryFieldName(query),
      };

      if (variables) {
        evictOptions.args = variables;
      }

      cache.evict(evictOptions);
    });
  } catch (error) {
    console.error('Failed to invalidate queries', error);
  }
}

/**
 * Invalidate cache entries by field name
 */
export function invalidateByFieldName(cache: InMemoryCache, fieldNames: string[]): void {
  try {
    fieldNames.forEach(fieldName => {
      cache.evict({
        id: 'ROOT_QUERY',
        fieldName,
      });
    });
  } catch (error) {
    console.error('Failed to invalidate by field names', error);
  }
}

/**
 * Clear all cache data (use with caution)
 */
export function invalidateAll(cache: InMemoryCache): void {
  try {
    cache.reset();
  } catch (error) {
    console.error('Failed to clear cache', error);
  }
}

/**
 * Invalidate cache based on configuration
 */
export function invalidateCache(cache: InMemoryCache, config: CacheInvalidationConfig): void {
  try {
    // Invalidate specific entity
    if (config.typename && config.id) {
      invalidateEntity(cache, config.typename, config.id);
    }

    // Invalidate specific queries
    if (config.queries) {
      invalidateQueries(cache, config.queries);
    }

    // Invalidate by field names
    if (config.fieldNames) {
      invalidateByFieldName(cache, config.fieldNames);
    }

    // Garbage collect after invalidation
    cache.gc();
  } catch (error) {
    console.error('Cache invalidation failed', error);
  }
}

/**
 * Get the field name from a GraphQL query
 */
function getQueryFieldName(query: DocumentNode): string {
  try {
    const definition = query.definitions[0];
    if (definition && definition.kind === 'OperationDefinition' && definition.selectionSet) {
      const firstSelection = definition.selectionSet.selections[0];
      if (firstSelection && firstSelection.kind === 'Field') {
        return firstSelection.name.value;
      }
    }
    return 'unknown';
  } catch (error) {
    console.warn('Failed to extract query field name', error);
    return 'unknown';
  }
}

/**
 * Cache invalidation utilities object
 */
export const cacheInvalidation: CacheInvalidation = {
  invalidateEntity,
  invalidateQueries,
  invalidateByFieldName,
  invalidateAll,
};

/**
 * Common invalidation patterns for specific scenarios
 */
export const commonInvalidations = {
  /**
   * Invalidate after user profile update
   */
  userProfileUpdated: (cache: InMemoryCache, userId: string) => {
    invalidateCache(cache, {
      typename: 'User',
      id: userId,
      fieldNames: ['currentUser', 'userProfile'],
    });
  },

  /**
   * Invalidate after course enrollment
   */
  courseEnrolled: (cache: InMemoryCache, courseId: string, userId: string) => {
    invalidateCache(cache, {
      fieldNames: ['myEnrollments', 'courseEnrollments', 'enrollmentProgress'],
    });

    // Also invalidate the specific course to update enrollment count
    invalidateEntity(cache, 'Course', courseId);
    // Also invalidate user data
    invalidateEntity(cache, 'User', userId);
  },

  /**
   * Invalidate after course publication
   */
  coursePublished: (cache: InMemoryCache, courseId: string) => {
    invalidateCache(cache, {
      typename: 'Course',
      id: courseId,
      fieldNames: ['courses', 'myCourses', 'publishedCourses'],
    });
  },

  /**
   * Invalidate after message sent
   */
  messageSent: (cache: InMemoryCache, conversationId: string) => {
    invalidateCache(cache, {
      fieldNames: ['conversations', 'conversationMessages'],
    });

    // Also invalidate the specific conversation
    invalidateEntity(cache, 'Conversation', conversationId);
  },

  /**
   * Invalidate after assignment submission
   */
  assignmentSubmitted: (cache: InMemoryCache, assignmentId: string, studentId: string) => {
    invalidateCache(cache, {
      fieldNames: ['assignmentSubmissions', 'studentSubmissions', 'assignmentProgress'],
    });

    // Also invalidate specific entities
    invalidateEntity(cache, 'Assignment', assignmentId);
    invalidateEntity(cache, 'User', studentId);
  },

  /**
   * Invalidate after payment completion
   */
  paymentCompleted: (cache: InMemoryCache, courseId: string, userId: string) => {
    invalidateCache(cache, {
      fieldNames: ['myEnrollments', 'courseEnrollments', 'paymentHistory'],
    });

    // Update course enrollment count
    invalidateEntity(cache, 'Course', courseId);
    // Update user payment history
    invalidateEntity(cache, 'User', userId);
    invalidateEntity(cache, 'Course', courseId);
  },

  /**
   * Invalidate after notification read
   */
  notificationRead: (cache: InMemoryCache, notificationId: string) => {
    invalidateCache(cache, {
      typename: 'Notification',
      id: notificationId,
      fieldNames: ['notifications', 'unreadNotifications'],
    });
  },

  /**
   * Invalidate after course content update
   */
  courseContentUpdated: (cache: InMemoryCache, courseId: string) => {
    invalidateCache(cache, {
      typename: 'Course',
      id: courseId,
      fieldNames: ['courseModules', 'courseLessons', 'courseContent'],
    });
  },
};
