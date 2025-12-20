/**
 * Optimistic Response Generators
 * 
 * Utilities for generating optimistic responses for mutations.
 * Provides rollback mechanisms for failed optimistic updates.
 */

import { OptimisticResponseConfig, OptimisticResponseGenerators, CacheEntity } from './types';

// Export the OptimisticResponseConfig type for use in other modules
export type { OptimisticResponseConfig } from './types';

/**
 * Generate a temporary ID for optimistic responses
 */
function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate optimistic response based on configuration
 */
export function generateOptimisticResponse<T extends CacheEntity>(
  config: OptimisticResponseConfig<T>
): T {
  const baseResponse = {
    __typename: config.typename,
    id: config.id || config.tempId || generateTempId(),
    ...config.data,
  } as T;

  switch (config.operation) {
    case 'create':
      return generateCreateResponse(config.typename, config.data) as T;
    
    case 'update':
      return { ...baseResponse, ...generateUpdateResponse(config.typename, config.id!, config.data) } as T;
    
    case 'delete':
      return generateDeleteResponse(config.typename, config.id!) as T;
    
    default:
      return baseResponse;
  }
}

/**
 * Generate optimistic response for create operations
 */
export function generateCreateResponse<T extends Partial<CacheEntity>>(
  typename: string,
  data: Partial<T>
): T & CacheEntity {
  return {
    __typename: typename,
    id: generateTempId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data,
  } as T & CacheEntity;
}

/**
 * Generate optimistic response for update operations
 */
export function generateUpdateResponse<T extends CacheEntity>(
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
/**
 * Common optimistic response patterns for specific entity types
 */

// Define specific entity types for better type safety
interface CourseData extends CacheEntity {
  status?: string;
  enrollmentCount?: number;
  modules?: unknown[];
  averageRating?: number | null;
  publishedAt?: string;
}

interface EnrollmentData extends CacheEntity {
  enrolledAt?: string;
  progressPercentage?: number;
  status?: string;
  lessonProgress?: unknown[];
  lastAccessedAt?: string;
  completedAt?: string;
}

interface MessageData extends CacheEntity {
  sentAt?: string;
  status?: string;
  readBy?: Array<{ userId: string; readAt: string }>;
}

interface AssignmentSubmissionData extends CacheEntity {
  submittedAt?: string;
  status?: string;
  grade?: number | null;
  feedback?: string | null;
  gradedAt?: string;
}

interface UserData extends CacheEntity {
  profile?: Record<string, unknown>;
  notificationPreferences?: Record<string, unknown>;
}

interface DiscussionThreadData extends CacheEntity {
  replyCount?: number;
  lastReplyAt?: string | null;
  isPinned?: boolean;
  isLocked?: boolean;
}

interface DiscussionReplyData extends CacheEntity {
  isEdited?: boolean;
  editedAt?: string | null;
}

interface NotificationData extends CacheEntity {
  isRead?: boolean;
  readAt?: string;
}

export const commonOptimisticResponses = {
  /**
   * Course-related optimistic responses
   */
  course: {
    create: (courseData: Partial<CourseData>) =>
      generateCreateResponse('Course', {
        ...courseData,
        status: 'DRAFT',
        enrollmentCount: 0,
        modules: [],
        averageRating: null,
      }),
    
    update: (courseId: string, updates: Partial<CourseData>) =>
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
    create: (enrollmentData: Partial<EnrollmentData>) =>
      generateCreateResponse('Enrollment', {
        ...enrollmentData,
        enrolledAt: new Date().toISOString(),
        progressPercentage: 0,
        status: 'ACTIVE',
        lessonProgress: [],
      }),
    
    updateProgress: (enrollmentId: string, progress: { percentage: number; lessons: unknown[] }) =>
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
    send: (messageData: Partial<MessageData>) =>
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
    submit: (submissionData: Partial<AssignmentSubmissionData>) =>
      generateCreateResponse('AssignmentSubmission', {
        ...submissionData,
        submittedAt: new Date().toISOString(),
        status: 'SUBMITTED',
        grade: null,
        feedback: null,
      }),
    
    grade: (submissionId: string, gradeData: Partial<AssignmentSubmissionData>) =>
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
    updateProfile: (userId: string, profileData: Record<string, unknown>) =>
      generateUpdateResponse('User', userId, {
        profile: {
          ...profileData,
          updatedAt: new Date().toISOString(),
        },
      }),
    
    updatePreferences: (userId: string, preferences: Record<string, unknown>) =>
      generateUpdateResponse('User', userId, {
        notificationPreferences: preferences,
      }),
  },

  /**
   * Discussion-related optimistic responses
   */
  discussion: {
    createThread: (threadData: Partial<DiscussionThreadData>) =>
      generateCreateResponse('DiscussionThread', {
        ...threadData,
        replyCount: 0,
        lastReplyAt: null,
        isPinned: false,
        isLocked: false,
      }),
    
    reply: (replyData: Partial<DiscussionReplyData>) =>
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