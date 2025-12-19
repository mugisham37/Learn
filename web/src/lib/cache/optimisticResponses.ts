/**
 * Optimistic Response Generators
 * 
 * Utilities for generating optimistic responses for mutations.
 * Provides rollback mechanisms for failed optimistic updates.
 */

import { OptimisticResponseConfig, OptimisticResponseGenerators } from './types';

/**
 * Generate a temporary ID for optimistic responses
 */
function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate optimistic response based on configuration
 */
export function generateOptimisticResponse<T extends { id: string; __typename: string }>(
  config: OptimisticResponseConfig<T>
): T {
  const baseResponse = {
    __typename: config.typename,
    id: config.id || config.tempId || generateTempId(),
    ...config.data,
  } as T;

  switch (config.operation) {
    case 'create':
      return generateCreateResponse(config.typename, config.data);
    
    case 'update':
      return generateUpdateResponse(config.typename, config.id!, config.data) as T;
    
    case 'delete':
      return generateDeleteResponse(config.typename, config.id!) as T;
    
    default:
      return baseResponse;
  }
}

/**
 * Generate optimistic response for create operations
 */
export function generateCreateResponse<T extends { id?: string; __typename?: string }>(
  typename: string,
  data: Partial<T>
): T {
  return {
    __typename: typename,
    id: generateTempId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data,
  } as T;
}

/**
 * Generate optimistic response for update operations
 */
export function generateUpdateResponse<T>(
  typename: string,
  id: string,
  updates: Partial<T>
): Partial<T> & { __typename: string; id: string; updatedAt: string } {
  return {
    __typename: typename,
    id,
    updatedAt: new Date().toISOString(),
    ...updates,
  };
}

/**
 * Generate optimistic response for delete operations
 */
export function generateDeleteResponse(
  typename: string,
  id: string
): { __typename: string; id: string } {
  return {
    __typename: typename,
    id,
  };
}

/**
 * Optimistic response generators object
 */
export const optimisticResponseGenerators: OptimisticResponseGenerators = {
  generateOptimisticResponse,
  generateCreateResponse,
  generateUpdateResponse,
  generateDeleteResponse,
};

/**
 * Common optimistic response patterns for specific entity types
 */
export const commonOptimisticResponses = {
  /**
   * Course-related optimistic responses
   */
  course: {
    create: (courseData: any) =>
      generateCreateResponse('Course', {
        ...courseData,
        status: 'DRAFT',
        enrollmentCount: 0,
        modules: [],
        averageRating: null,
      }),
    
    update: (courseId: string, updates: any) =>
      generateUpdateResponse('Course', courseId, updates),
    
    publish: (courseId: string) =>
      generateUpdateResponse('Course', courseId, {
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
      }),
    
    delete: (courseId: string) =>
      generateDeleteResponse('Course', courseId),
  },

  /**
   * Enrollment-related optimistic responses
   */
  enrollment: {
    create: (enrollmentData: any) =>
      generateCreateResponse('Enrollment', {
        ...enrollmentData,
        enrolledAt: new Date().toISOString(),
        progressPercentage: 0,
        status: 'ACTIVE',
        lessonProgress: [],
      }),
    
    updateProgress: (enrollmentId: string, progress: any) =>
      generateUpdateResponse('Enrollment', enrollmentId, {
        progressPercentage: progress.percentage,
        lessonProgress: progress.lessons,
        lastAccessedAt: new Date().toISOString(),
      }),
    
    complete: (enrollmentId: string) =>
      generateUpdateResponse('Enrollment', enrollmentId, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        progressPercentage: 100,
      }),
  },

  /**
   * Message-related optimistic responses
   */
  message: {
    send: (messageData: any) =>
      generateCreateResponse('Message', {
        ...messageData,
        sentAt: new Date().toISOString(),
        status: 'SENDING',
        readBy: [],
      }),
    
    markAsRead: (messageId: string, userId: string) =>
      generateUpdateResponse('Message', messageId, {
        readBy: [{ userId, readAt: new Date().toISOString() }],
      }),
  },

  /**
   * Assignment-related optimistic responses
   */
  assignment: {
    submit: (submissionData: any) =>
      generateCreateResponse('AssignmentSubmission', {
        ...submissionData,
        submittedAt: new Date().toISOString(),
        status: 'SUBMITTED',
        grade: null,
        feedback: null,
      }),
    
    grade: (submissionId: string, gradeData: any) =>
      generateUpdateResponse('AssignmentSubmission', submissionId, {
        ...gradeData,
        gradedAt: new Date().toISOString(),
        status: 'GRADED',
      }),
  },

  /**
   * User profile optimistic responses
   */
  user: {
    updateProfile: (userId: string, profileData: any) =>
      generateUpdateResponse('User', userId, {
        profile: {
          ...profileData,
          updatedAt: new Date().toISOString(),
        },
      }),
    
    updatePreferences: (userId: string, preferences: any) =>
      generateUpdateResponse('User', userId, {
        notificationPreferences: preferences,
      }),
  },

  /**
   * Discussion-related optimistic responses
   */
  discussion: {
    createThread: (threadData: any) =>
      generateCreateResponse('DiscussionThread', {
        ...threadData,
        replyCount: 0,
        lastReplyAt: null,
        isPinned: false,
        isLocked: false,
      }),
    
    reply: (replyData: any) =>
      generateCreateResponse('DiscussionReply', {
        ...replyData,
        isEdited: false,
        editedAt: null,
      }),
  },

  /**
   * Notification-related optimistic responses
   */
  notification: {
    markAsRead: (notificationId: string) =>
      generateUpdateResponse('Notification', notificationId, {
        isRead: true,
        readAt: new Date().toISOString(),
      }),
    
    markAllAsRead: (userId: string) => ({
      __typename: 'NotificationBatch',
      userId,
      updatedCount: 0, // Will be updated by server response
      updatedAt: new Date().toISOString(),
    }),
  },
};

/**
 * Rollback helper for failed optimistic updates
 */
export class OptimisticUpdateRollback {
  private rollbackActions: Array<() => void> = [];

  /**
   * Add a rollback action
   */
  addRollback(action: () => void): void {
    this.rollbackActions.push(action);
  }

  /**
   * Execute all rollback actions
   */
  rollback(): void {
    this.rollbackActions.forEach(action => {
      try {
        action();
      } catch (error) {
        console.error('Rollback action failed:', error);
      }
    });
    this.rollbackActions = [];
  }

  /**
   * Clear rollback actions (call on successful mutation)
   */
  clear(): void {
    this.rollbackActions = [];
  }
}

/**
 * Create an optimistic update with rollback capability
 */
export function createOptimisticUpdate<T>(
  optimisticResponse: T,
  rollbackAction: () => void
): {
  optimisticResponse: T;
  rollback: OptimisticUpdateRollback;
} {
  const rollback = new OptimisticUpdateRollback();
  rollback.addRollback(rollbackAction);

  return {
    optimisticResponse,
    rollback,
  };
}