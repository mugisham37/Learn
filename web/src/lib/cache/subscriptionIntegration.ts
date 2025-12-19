/**
 * Subscription Cache Integration
 * 
 * Enhanced integration between subscription data and cache management utilities.
 * Provides seamless cache updates from real-time subscription data.
 */

import { InMemoryCache } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { updateCacheAfterMutation, CacheUpdateConfig } from './cacheUpdaters';
import { invalidateCache, CacheInvalidationConfig } from './cacheInvalidation';
import { generateOptimisticResponse, OptimisticResponseConfig } from './optimisticResponses';

/**
 * Subscription cache update configuration
 */
export interface SubscriptionCacheUpdateConfig<T = any> {
  subscriptionType: 'created' | 'updated' | 'deleted' | 'status_changed';
  typename: string;
  data: T;
  listQueries?: Array<{
    query: DocumentNode;
    variables?: Record<string, any>;
    fieldName: string;
  }>;
  invalidationConfig?: CacheInvalidationConfig;
}

/**
 * Handle cache updates from subscription data
 */
export function handleSubscriptionCacheUpdate<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: SubscriptionCacheUpdateConfig<T>
): void {
  try {
    switch (config.subscriptionType) {
      case 'created':
        handleCreatedSubscription(cache, config);
        break;
      
      case 'updated':
        handleUpdatedSubscription(cache, config);
        break;
      
      case 'deleted':
        handleDeletedSubscription(cache, config);
        break;
      
      case 'status_changed':
        handleStatusChangedSubscription(cache, config);
        break;
      
      default:
        console.warn(`Unknown subscription type: ${config.subscriptionType}`);
    }

    // Handle additional invalidations if specified
    if (config.invalidationConfig) {
      invalidateCache(cache, config.invalidationConfig);
    }
  } catch (error) {
    console.error('Subscription cache update failed:', error);
  }
}

/**
 * Handle created entity subscription
 */
function handleCreatedSubscription<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: SubscriptionCacheUpdateConfig<T>
): void {
  // Update cache with new entity
  const cacheConfig: CacheUpdateConfig<T> = {
    operation: 'create',
    typename: config.typename,
    data: config.data,
  };

  // Add to lists if specified
  if (config.listQueries) {
    config.listQueries.forEach(listQuery => {
      updateCacheAfterMutation(cache, {
        ...cacheConfig,
        operation: 'prepend', // New items typically go to the top
        listQuery: listQuery.query,
        listVariables: listQuery.variables,
        listFieldName: listQuery.fieldName,
      });
    });
  } else {
    updateCacheAfterMutation(cache, cacheConfig);
  }
}

/**
 * Handle updated entity subscription
 */
function handleUpdatedSubscription<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: SubscriptionCacheUpdateConfig<T>
): void {
  const cacheConfig: CacheUpdateConfig<T> = {
    operation: 'update',
    typename: config.typename,
    data: config.data,
    id: config.data.id,
  };

  updateCacheAfterMutation(cache, cacheConfig);

  // Update in lists if specified
  if (config.listQueries) {
    config.listQueries.forEach(listQuery => {
      updateCacheAfterMutation(cache, {
        ...cacheConfig,
        operation: 'merge',
        listQuery: listQuery.query,
        listVariables: listQuery.variables,
        listFieldName: listQuery.fieldName,
      });
    });
  }
}

/**
 * Handle deleted entity subscription
 */
function handleDeletedSubscription<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: SubscriptionCacheUpdateConfig<T>
): void {
  const cacheConfig: CacheUpdateConfig<T> = {
    operation: 'delete',
    typename: config.typename,
    data: config.data,
    id: config.data.id,
  };

  // Remove from lists if specified
  if (config.listQueries) {
    config.listQueries.forEach(listQuery => {
      updateCacheAfterMutation(cache, {
        ...cacheConfig,
        listQuery: listQuery.query,
        listVariables: listQuery.variables,
        listFieldName: listQuery.fieldName,
      });
    });
  } else {
    updateCacheAfterMutation(cache, cacheConfig);
  }
}

/**
 * Handle status changed subscription (special case of update)
 */
function handleStatusChangedSubscription<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: SubscriptionCacheUpdateConfig<T>
): void {
  // Status changes are essentially updates
  handleUpdatedSubscription(cache, config);
}

/**
 * Common subscription cache update patterns
 */
export const subscriptionCachePatterns = {
  /**
   * Message added to conversation
   */
  messageAdded: (cache: InMemoryCache, message: any, conversationId: string) => {
    handleSubscriptionCacheUpdate(cache, {
      subscriptionType: 'created',
      typename: 'Message',
      data: message,
      listQueries: [{
        query: require('../graphql/operations').GET_CONVERSATION_MESSAGES,
        variables: { conversationId },
        fieldName: 'messages',
      }],
    });
  },

  /**
   * Enrollment progress updated
   */
  progressUpdated: (cache: InMemoryCache, progress: any, enrollmentId: string) => {
    handleSubscriptionCacheUpdate(cache, {
      subscriptionType: 'updated',
      typename: 'Enrollment',
      data: { id: enrollmentId, ...progress },
      invalidationConfig: {
        fieldNames: ['enrollmentProgress', 'courseProgress'],
      },
    });
  },

  /**
   * Course published
   */
  coursePublished: (cache: InMemoryCache, course: any) => {
    handleSubscriptionCacheUpdate(cache, {
      subscriptionType: 'status_changed',
      typename: 'Course',
      data: course,
      listQueries: [{
        query: require('../graphql/operations').GET_PUBLISHED_COURSES,
        variables: {},
        fieldName: 'publishedCourses',
      }],
      invalidationConfig: {
        fieldNames: ['courses', 'myCourses'],
      },
    });
  },

  /**
   * User presence updated
   */
  presenceUpdated: (cache: InMemoryCache, presence: any, courseId: string) => {
    handleSubscriptionCacheUpdate(cache, {
      subscriptionType: 'updated',
      typename: 'UserPresence',
      data: presence,
      listQueries: [{
        query: require('../graphql/operations').GET_COURSE_PRESENCE,
        variables: { courseId },
        fieldName: 'coursePresence',
      }],
    });
  },

  /**
   * Notification received
   */
  notificationReceived: (cache: InMemoryCache, notification: any, userId: string) => {
    handleSubscriptionCacheUpdate(cache, {
      subscriptionType: 'created',
      typename: 'Notification',
      data: notification,
      listQueries: [{
        query: require('../graphql/operations').GET_NOTIFICATIONS,
        variables: { userId },
        fieldName: 'notifications',
      }],
      invalidationConfig: {
        fieldNames: ['unreadNotificationCount'],
      },
    });
  },

  /**
   * Assignment submitted
   */
  assignmentSubmitted: (cache: InMemoryCache, submission: any, assignmentId: string) => {
    handleSubscriptionCacheUpdate(cache, {
      subscriptionType: 'created',
      typename: 'AssignmentSubmission',
      data: submission,
      listQueries: [{
        query: require('../graphql/operations').GET_ASSIGNMENT_SUBMISSIONS,
        variables: { assignmentId },
        fieldName: 'submissions',
      }],
      invalidationConfig: {
        fieldNames: ['assignmentProgress', 'gradingQueue'],
      },
    });
  },
};

/**
 * Conflict resolution for concurrent subscription updates
 */
export class SubscriptionConflictResolver {
  private pendingUpdates = new Map<string, any>();

  /**
   * Resolve conflicts when multiple subscription updates occur for the same entity
   */
  resolveConflict<T extends { id: string; updatedAt?: string }>(
    entityId: string,
    newData: T,
    existingData: T
  ): T {
    // Use timestamp-based conflict resolution
    if (newData.updatedAt && existingData.updatedAt) {
      const newTime = new Date(newData.updatedAt).getTime();
      const existingTime = new Date(existingData.updatedAt).getTime();
      
      return newTime > existingTime ? newData : existingData;
    }

    // If no timestamps, prefer new data
    return newData;
  }

  /**
   * Queue update for conflict resolution
   */
  queueUpdate<T>(entityId: string, data: T): void {
    this.pendingUpdates.set(entityId, data);
  }

  /**
   * Process queued updates
   */
  processQueuedUpdates(cache: InMemoryCache): void {
    this.pendingUpdates.forEach((data, entityId) => {
      // Process the update
      const [typename, id] = entityId.split(':');
      handleSubscriptionCacheUpdate(cache, {
        subscriptionType: 'updated',
        typename,
        data: { ...data, id },
      });
    });

    this.pendingUpdates.clear();
  }
}

/**
 * Create a subscription cache update handler
 */
export function createSubscriptionCacheHandler<T extends { id: string; __typename: string }>(
  cache: InMemoryCache,
  config: Omit<SubscriptionCacheUpdateConfig<T>, 'data'>
) {
  return (data: T) => {
    handleSubscriptionCacheUpdate(cache, {
      ...config,
      data,
    });
  };
}