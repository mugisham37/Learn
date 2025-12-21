/**
 * Apollo Cache Configuration
 *
 * Production-ready cache configuration with comprehensive type policies for all backend modules.
 * Implements cache normalization, field policies, and merge functions for:
 * - Users Module (authentication, profiles, permissions)
 * - Courses Module (courses, modules, lessons)
 * - Enrollments Module (enrollments, progress tracking)
 * - Assessments Module (quizzes, assignments, submissions)
 * - Content Module (files, videos, streaming)
 * - Payments Module (transactions, subscriptions)
 * - Notifications Module (notifications, preferences)
 * - Communication Module (messages, discussions)
 * - Analytics Module (metrics, reports)
 * - Search Module (search results, facets)
 */

import { InMemoryCache, TypePolicy, gql, NormalizedCacheObject } from '@apollo/client';

/**
 * Comprehensive type policies for all backend modules
 *
 * These policies define how Apollo Client normalizes and stores data:
 * - Key fields: How to identify unique entities
 * - Field policies: How to merge and read specific fields
 * - Merge functions: How to handle updates to cached data
 * - Pagination: How to handle cursor-based and offset-based pagination
 * - Real-time updates: How to merge subscription data
 */
const typePolicies: Record<string, TypePolicy> = {
  Query: {
    fields: {
      // Users Module Queries
      users: {
        keyArgs: ['filter', 'role'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      currentUser: {
        merge: true, // Always use latest user data
      },
      userProfile: {
        keyArgs: ['userId'],
        merge: true,
      },

      // Courses Module Queries
      courses: {
        keyArgs: ['filter', 'category', 'difficulty', 'status'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      myCourses: {
        keyArgs: ['filter', 'role'], // educator vs student courses
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      courseModules: {
        keyArgs: ['courseId'],
        merge(existing = [], incoming) {
          // Merge modules by ID, preserving order
          const merged = [...existing];
          incoming.forEach((incomingModule: { id: string }) => {
            const existingIndex = merged.findIndex(
              (m: { id: string }) => m.id === incomingModule.id
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingModule };
            } else {
              merged.push(incomingModule);
            }
          });
          return merged;
        },
      },

      // Enrollments Module Queries
      enrollments: {
        keyArgs: ['filter', 'status'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      myEnrollments: {
        keyArgs: ['filter', 'status'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      enrollmentProgress: {
        keyArgs: ['enrollmentId'],
        merge: true, // Always use latest progress data
      },

      // Assessments Module Queries
      quizzes: {
        keyArgs: ['courseId', 'moduleId'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      assignments: {
        keyArgs: ['courseId', 'moduleId'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      assignmentSubmissions: {
        keyArgs: ['assignmentId'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },

      // Content Module Queries
      courseContent: {
        keyArgs: ['courseId'],
        merge(_, incoming) {
          return incoming; // Content structure can change completely
        },
      },
      mediaAssets: {
        keyArgs: ['filter', 'type'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },

      // Payments Module Queries
      paymentHistory: {
        keyArgs: ['userId'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      subscriptions: {
        keyArgs: ['userId'],
        merge(_, incoming) {
          return incoming; // Subscription data should be replaced
        },
      },

      // Notifications Module Queries
      notifications: {
        keyArgs: ['filter', 'type'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      unreadNotifications: {
        merge(_, incoming) {
          return incoming; // Unread notifications should be replaced
        },
      },

      // Communication Module Queries
      conversations: {
        keyArgs: ['filter'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      conversationMessages: {
        keyArgs: ['conversationId'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      discussionThreads: {
        keyArgs: ['courseId', 'filter'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      announcements: {
        keyArgs: ['courseId', 'filter'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      coursePresence: {
        keyArgs: ['courseId'],
        merge(_, incoming) {
          // Always replace with latest presence data
          return incoming;
        },
      },

      // Analytics Module Queries
      courseAnalytics: {
        keyArgs: ['courseId'],
        merge: false, // Analytics data should be replaced
      },
      studentAnalytics: {
        keyArgs: ['userId'],
        merge: false, // Analytics data should be replaced
      },
      dashboardMetrics: {
        keyArgs: false, // User-specific, no additional key args needed
        merge: false, // Dashboard data should be replaced
      },
      generateCourseReport: {
        keyArgs: ['input', ['courseId', 'dateRange']],
        merge: false, // Reports should be replaced
      },
      generateStudentReport: {
        keyArgs: ['input', ['studentId', 'dateRange']],
        merge: false, // Reports should be replaced
      },
      platformMetrics: {
        keyArgs: ['input', ['dateRange']],
        merge: false, // Platform metrics should be replaced
      },
      trendingCourses: {
        keyArgs: ['limit', 'dateRange'],
        merge: false, // Trending data should be replaced
      },
      topPerformingStudents: {
        keyArgs: ['limit'],
        merge: false, // Top performers should be replaced
      },

      // Search Module Queries
      searchResults: {
        keyArgs: ['query', 'filters'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      searchSuggestions: {
        keyArgs: ['query'],
        merge(_, incoming) {
          return incoming; // Suggestions should be replaced
        },
      },
    },
  },

  // Users Module Type Policies
  User: {
    keyFields: ['id'],
    fields: {
      profile: {
        merge: true, // Deep merge profile objects
      },
      notificationPreferences: {
        merge: true, // Deep merge preferences
      },
      permissions: {
        merge(_, incoming) {
          return incoming; // Permissions should be replaced completely
        },
      },
      enrollments: {
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
    },
  },

  UserProfile: {
    keyFields: ['userId'],
    fields: {
      avatar: {
        merge: true,
      },
      socialLinks: {
        merge: true,
      },
    },
  },

  // Courses Module Type Policies
  Course: {
    keyFields: ['id'],
    fields: {
      modules: {
        merge(existing = [], incoming) {
          // Merge modules by ID, preserving order
          const merged = [...existing];

          incoming.forEach((incomingModule: { id: string }) => {
            const existingIndex = merged.findIndex(
              (m: { id: string }) => m.id === incomingModule.id
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingModule };
            } else {
              merged.push(incomingModule);
            }
          });

          return merged;
        },
      },
      enrollmentCount: {
        merge(existing, incoming) {
          // Always use the most recent count
          return incoming;
        },
      },
      averageRating: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      tags: {
        merge(_, incoming) {
          return incoming; // Tags should be replaced
        },
      },
      prerequisites: {
        merge(_, incoming) {
          return incoming;
        },
      },
    },
  },

  CourseModule: {
    keyFields: ['id'],
    fields: {
      lessons: {
        merge(existing = [], incoming) {
          // Similar merge logic for lessons
          const merged = [...existing];

          incoming.forEach((incomingLesson: { id: string }) => {
            const existingIndex = merged.findIndex(
              (l: { id: string }) => l.id === incomingLesson.id
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingLesson };
            } else {
              merged.push(incomingLesson);
            }
          });

          return merged;
        },
      },
      assessments: {
        merge(existing = [], incoming) {
          const merged = [...existing];

          incoming.forEach((incomingAssessment: { id: string }) => {
            const existingIndex = merged.findIndex(
              (a: { id: string }) => a.id === incomingAssessment.id
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingAssessment };
            } else {
              merged.push(incomingAssessment);
            }
          });

          return merged;
        },
      },
    },
  },

  Lesson: {
    keyFields: ['id'],
    fields: {
      content: {
        merge: true, // Deep merge lesson content
      },
      resources: {
        merge(_, incoming) {
          return incoming; // Resources should be replaced
        },
      },
    },
  },

  // Enrollments Module Type Policies
  Enrollment: {
    keyFields: ['id'],
    fields: {
      progressPercentage: {
        merge(existing, incoming) {
          // Always use the most recent progress
          return incoming;
        },
      },
      lessonProgress: {
        merge(existing = [], incoming) {
          // Merge lesson progress by lesson ID
          const merged = [...existing];

          incoming.forEach((incomingProgress: { lessonId: string }) => {
            const existingIndex = merged.findIndex(
              (p: { lessonId: string }) => p.lessonId === incomingProgress.lessonId
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingProgress };
            } else {
              merged.push(incomingProgress);
            }
          });

          return merged;
        },
      },
      certificates: {
        merge(_, incoming) {
          return incoming; // Certificates should be replaced
        },
      },
      lastAccessedAt: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  LessonProgress: {
    keyFields: ['enrollmentId', 'lessonId'],
    fields: {
      timeSpent: {
        merge(existing = 0, incoming) {
          // Accumulate time spent
          return Math.max(existing, incoming);
        },
      },
      watchedPercentage: {
        merge(existing = 0, incoming) {
          return Math.max(existing, incoming);
        },
      },
    },
  },

  // Assessments Module Type Policies
  Quiz: {
    keyFields: ['id'],
    fields: {
      questions: {
        merge: true, // Deep merge questions
      },
      attempts: {
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
    },
  },

  Assignment: {
    keyFields: ['id'],
    fields: {
      submissions: {
        merge(existing = [], incoming) {
          // Merge submissions by student ID
          const merged = [...existing];

          incoming.forEach((incomingSub: { studentId: string }) => {
            const existingIndex = merged.findIndex(
              (s: { studentId: string }) => s.studentId === incomingSub.studentId
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingSub };
            } else {
              merged.push(incomingSub);
            }
          });

          return merged;
        },
      },
      rubric: {
        merge: true,
      },
    },
  },

  QuizAttempt: {
    keyFields: ['id'],
    fields: {
      answers: {
        merge: true, // Deep merge answers
      },
      score: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  AssignmentSubmission: {
    keyFields: ['id'],
    fields: {
      files: {
        merge(_, incoming) {
          return incoming; // Files should be replaced
        },
      },
      feedback: {
        merge: true, // Deep merge feedback
      },
      grade: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  // Content Module Type Policies
  MediaAsset: {
    keyFields: ['id'],
    fields: {
      processingStatus: {
        merge(existing, incoming) {
          return incoming; // Always use latest processing status
        },
      },
      streamingUrls: {
        merge: true, // Deep merge streaming URLs
      },
      metadata: {
        merge: true,
      },
    },
  },

  VideoProcessingJob: {
    keyFields: ['id'],
    fields: {
      status: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      progress: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      outputs: {
        merge(_, incoming) {
          return incoming;
        },
      },
    },
  },

  // Payments Module Type Policies
  Payment: {
    keyFields: ['id'],
    fields: {
      status: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      metadata: {
        merge: true,
      },
    },
  },

  Subscription: {
    keyFields: ['id'],
    fields: {
      status: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      currentPeriod: {
        merge: true,
      },
      paymentMethod: {
        merge: true,
      },
    },
  },

  Invoice: {
    keyFields: ['id'],
    fields: {
      lineItems: {
        merge(_, incoming) {
          return incoming;
        },
      },
      status: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  // Notifications Module Type Policies
  Notification: {
    keyFields: ['id'],
    fields: {
      isRead: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      readAt: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      metadata: {
        merge: true,
      },
    },
  },

  NotificationPreferences: {
    keyFields: ['userId'],
    fields: {
      channels: {
        merge: true, // Deep merge channel preferences
      },
      types: {
        merge: true,
      },
    },
  },

  // Communication Module Type Policies
  Conversation: {
    keyFields: ['id'],
    fields: {
      messages: {
        keyArgs: false, // Don't cache separately by arguments
        merge(existing = [], incoming, { args }) {
          // Handle real-time message updates
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      participants: {
        merge(_, incoming) {
          return incoming; // Participants should be replaced
        },
      },
      lastMessage: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  Message: {
    keyFields: ['id'],
    fields: {
      status: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      readBy: {
        merge(existing = [], incoming) {
          // Merge read receipts by user ID
          const merged = [...existing];

          incoming.forEach((incomingRead: { userId: string }) => {
            const existingIndex = merged.findIndex(
              (r: { userId: string }) => r.userId === incomingRead.userId
            );
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingRead };
            } else {
              merged.push(incomingRead);
            }
          });

          return merged;
        },
      },
      reactions: {
        merge(_, incoming) {
          return incoming;
        },
      },
    },
  },

  DiscussionThread: {
    keyFields: ['id'],
    fields: {
      replies: {
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      replyCount: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      lastReplyAt: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  DiscussionReply: {
    keyFields: ['id'],
    fields: {
      reactions: {
        merge(_, incoming) {
          return incoming;
        },
      },
      isEdited: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  Announcement: {
    keyFields: ['id'],
    fields: {
      course: {
        merge(existing, incoming) {
          return incoming;
        },
      },
      educator: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  PresenceUpdate: {
    keyFields: ['userId', 'courseId'],
    fields: {
      user: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  TypingIndicator: {
    keyFields: ['userId', ['conversationId', 'threadId']],
    fields: {
      user: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  // Analytics Module Type Policies
  CourseAnalytics: {
    keyFields: ['courseId'],
    fields: {
      engagementMetrics: {
        merge: false, // Replace engagement metrics completely
      },
      mostDifficultLesson: {
        merge: false, // Replace lesson reference
      },
    },
  },

  StudentAnalytics: {
    keyFields: ['userId'],
    fields: {
      performanceSummary: {
        merge: false, // Replace performance summary completely
      },
      learningStreak: {
        merge: false, // Replace streak data completely
      },
      badgesEarned: {
        merge: false, // Replace badges array completely
      },
      skillRatings: {
        merge: false, // Replace skill ratings completely
      },
    },
  },

  DashboardMetrics: {
    keyFields: ['userId', 'role'],
    fields: {
      overview: {
        merge: false, // Replace overview data
      },
      studentMetrics: {
        merge: false, // Replace student metrics
      },
      educatorMetrics: {
        merge: false, // Replace educator metrics
      },
      adminMetrics: {
        merge: false, // Replace admin metrics
      },
    },
  },

  // Search Module Type Policies
  SearchResult: {
    keyFields: ['id', 'type'],
    fields: {
      highlights: {
        merge: true,
      },
      score: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  SearchFacet: {
    keyFields: ['field'],
    fields: {
      buckets: {
        merge(_, incoming) {
          return incoming;
        },
      },
    },
  },
};

/**
 * Creates and configures the Apollo InMemoryCache with comprehensive backend integration
 *
 * Features:
 * - Normalized storage by entity ID for all 10 backend modules
 * - Intelligent field merging for arrays and objects
 * - Pagination support for all list queries
 * - Real-time update handling with subscription integration
 * - Memory management with configurable size limits
 * - Cache persistence and restoration capabilities
 * - Optimized type policies for performance
 */
export function createCacheConfig(): InMemoryCache {
  return new InMemoryCache({
    typePolicies,

    // Cache configuration
    resultCaching: true, // Enable result caching for performance

    // Add cache size management
    possibleTypes: {
      // Define possible types for union/interface types
      // This will be populated from the GraphQL schema introspection
      Node: [
        'User',
        'Course',
        'CourseModule',
        'Lesson',
        'Enrollment',
        'LessonProgress',
        'Quiz',
        'Assignment',
        'QuizAttempt',
        'AssignmentSubmission',
        'MediaAsset',
        'VideoProcessingJob',
        'Payment',
        'Subscription',
        'Invoice',
        'Notification',
        'NotificationPreferences',
        'Conversation',
        'Message',
        'DiscussionThread',
        'DiscussionReply',
        'CourseAnalytics',
        'StudentAnalytics',
        'DashboardMetrics',
        'SearchResult',
        'SearchFacet',
      ],
      Content: ['VideoContent', 'DocumentContent', 'ImageContent', 'AudioContent'],
      Assessment: ['Quiz', 'Assignment', 'Survey'],
      NotificationChannel: ['EmailChannel', 'PushChannel', 'InAppChannel'],
    },

    // Data ID from object function for custom entity identification
    dataIdFromObject: (object: {
      __typename?: string;
      id?: string;
      enrollmentId?: string;
      lessonId?: string;
      userId?: string;
      courseId?: string;
      studentId?: string;
      conversationId?: string;
      threadId?: string;
    }) => {
      // Default behavior: use __typename:id
      if (object.__typename && object.id) {
        return `${object.__typename}:${object.id}`;
      }

      // Custom handling for specific types
      switch (object.__typename) {
        case 'LessonProgress':
          // Use composite key for lesson progress
          return `LessonProgress:${object.enrollmentId}:${object.lessonId}`;

        case 'NotificationPreferences':
          // Use user ID as key for notification preferences
          return `NotificationPreferences:${object.userId}`;

        case 'CourseAnalytics':
          // Use course ID for analytics
          return `CourseAnalytics:${object.courseId}`;

        case 'StudentAnalytics':
          // Use user ID for student analytics
          return `StudentAnalytics:${object.userId}`;

        case 'DashboardMetrics':
          // Use user ID and role for dashboard metrics
          return `DashboardMetrics:${object.userId}:${(object as { role?: string }).role || 'unknown'}`;

        case 'ConversationParticipant':
          // Use composite key for conversation participants
          return `ConversationParticipant:${object.conversationId}:${object.userId}`;

        case 'MessageReadReceipt':
          // Use composite key for read receipts
          return `MessageReadReceipt:${object.conversationId}:${object.userId}`;

        case 'ThreadParticipant':
          // Use composite key for thread participants
          return `ThreadParticipant:${object.threadId}:${object.userId}`;

        default:
          return false; // Let Apollo handle it
      }
    },
  });
}

/**
 * Cache helper functions for manual cache updates and backend integration
 */
export const cacheHelpers = {
  /**
   * Updates a single entity in the cache
   */
  updateEntity: <T>(cache: InMemoryCache, typename: string, id: string, updates: Partial<T>) => {
    const entityId = `${typename}:${id}`;
    const existing = cache.readFragment({
      id: entityId,
      fragment: gql`
        fragment Update on ${typename} {
          id
        }
      `,
    });

    if (existing) {
      cache.writeFragment({
        id: entityId,
        fragment: gql`
          fragment Update on ${typename} {
            id
          }
        `,
        data: { ...existing, ...updates },
      });
    }
  },

  /**
   * Invalidates cache entries for a specific type
   */
  invalidateType: (cache: InMemoryCache, typename: string) => {
    cache.modify({
      fields: {
        [typename.toLowerCase()]: (existing, { DELETE }) => DELETE,
      },
    });
  },

  /**
   * Evicts a specific entity from the cache
   */
  evictEntity: (cache: InMemoryCache, typename: string, id: string) => {
    cache.evict({ id: `${typename}:${id}` });
    cache.gc(); // Garbage collect dangling references
  },

  /**
   * Batch update multiple entities of the same type
   */
  batchUpdateEntities: <T>(
    cache: InMemoryCache,
    typename: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ) => {
    updates.forEach(({ id, data }) => {
      cacheHelpers.updateEntity(cache, typename, id, data);
    });
  },

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats: (cache: InMemoryCache) => {
    const data = cache.extract();
    const entities = Object.keys(data).filter(
      key => key !== 'ROOT_QUERY' && key !== 'ROOT_MUTATION' && key !== 'ROOT_SUBSCRIPTION'
    ).length;
    const queries = data.ROOT_QUERY ? Object.keys(data.ROOT_QUERY).length : 0;
    const subscriptions = data.ROOT_SUBSCRIPTION ? Object.keys(data.ROOT_SUBSCRIPTION).length : 0;

    return {
      size: JSON.stringify(data).length,
      entities,
      queries,
      subscriptions,
      memoryUsage: (JSON.stringify(data).length / (1024 * 1024)).toFixed(2) + ' MB',
    };
  },

  /**
   * Clear cache with selective preservation
   */
  clearCacheSelectively: (cache: InMemoryCache, preserveTypes: string[] = []) => {
    const data = cache.extract();

    // Clear all data
    cache.reset();

    // Restore preserved types
    if (preserveTypes.length > 0) {
      const preservedData: Record<string, unknown> = {};

      Object.keys(data).forEach(key => {
        const shouldPreserve = preserveTypes.some(
          type => key.startsWith(`${type}:`) || key === 'ROOT_QUERY' || key === 'ROOT_SUBSCRIPTION'
        );

        if (shouldPreserve) {
          preservedData[key] = data[key];
        }
      });

      cache.restore(preservedData as NormalizedCacheObject);
    }
  },
};

/**
 * Cache persistence utilities for offline support
 */
export const cachePersistence = {
  /**
   * Save cache to localStorage
   */
  saveToStorage: (cache: InMemoryCache, key: string = 'apollo-cache') => {
    try {
      const data = cache.extract();
      const serialized = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0.0',
      });

      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
      return false;
    }
  },

  /**
   * Load cache from localStorage
   */
  loadFromStorage: (cache: InMemoryCache, key: string = 'apollo-cache') => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return false;

      const parsed = JSON.parse(stored);
      const { data, timestamp, version } = parsed;

      // Check if cache is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(key);
        return false;
      }

      // Check version compatibility
      if (version !== '1.0.0') {
        localStorage.removeItem(key);
        return false;
      }

      cache.restore(data as NormalizedCacheObject);
      return true;
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
      localStorage.removeItem(key);
      return false;
    }
  },

  /**
   * Clear persisted cache
   */
  clearStorage: (key: string = 'apollo-cache') => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('Failed to clear cache storage:', error);
      return false;
    }
  },

  /**
   * Get storage info
   */
  getStorageInfo: (key: string = 'apollo-cache') => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return {
        size: stored.length,
        timestamp: parsed.timestamp,
        version: parsed.version,
        age: Date.now() - parsed.timestamp,
        sizeInMB: (stored.length / (1024 * 1024)).toFixed(2),
      };
    } catch {
      return null;
    }
  },
};

/**
 * Backend-specific cache invalidation patterns
 */
export const backendCacheInvalidation = {
  /**
   * Invalidate after user profile update
   */
  userProfileUpdated: (cache: InMemoryCache, userId: string) => {
    cacheHelpers.evictEntity(cache, 'User', userId);
    cacheHelpers.evictEntity(cache, 'UserProfile', userId);

    // Invalidate related queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'currentUser' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'userProfile', args: { userId } });
  },

  /**
   * Invalidate after course enrollment
   */
  courseEnrolled: (cache: InMemoryCache, courseId: string, userId: string) => {
    // Update course enrollment count
    cacheHelpers.updateEntity(cache, 'Course', courseId, {
      enrollmentCount: (existing: number) => existing + 1,
    });

    // Invalidate enrollment-related queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'myEnrollments' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'courseEnrollments', args: { courseId } });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'enrollmentProgress' });

    // Invalidate user dashboard data
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'dashboardData', args: { userId } });
  },

  /**
   * Invalidate after course publication
   */
  coursePublished: (cache: InMemoryCache, courseId: string) => {
    cacheHelpers.updateEntity(cache, 'Course', courseId, {
      status: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
    });

    // Invalidate course listing queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'courses' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'myCourses' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'publishedCourses' });
  },

  /**
   * Invalidate after message sent
   */
  messageSent: (cache: InMemoryCache, conversationId: string, messageId: string) => {
    // Update conversation last message
    cacheHelpers.updateEntity(cache, 'Conversation', conversationId, {
      lastMessageId: messageId,
      lastMessageAt: new Date().toISOString(),
    });

    // Invalidate conversation queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'conversations' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'conversationMessages', args: { conversationId } });
  },

  /**
   * Invalidate after assignment submission
   */
  assignmentSubmitted: (cache: InMemoryCache, assignmentId: string, studentId: string) => {
    // Invalidate assignment-related queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'assignmentSubmissions', args: { assignmentId } });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'studentSubmissions', args: { studentId } });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'assignmentProgress' });

    // Update assignment submission count
    cacheHelpers.updateEntity(cache, 'Assignment', assignmentId, {
      submissionCount: (existing: number) => existing + 1,
    });
  },

  /**
   * Invalidate after payment completion
   */
  paymentCompleted: (cache: InMemoryCache, courseId: string, userId: string, paymentId: string) => {
    // Update payment status
    cacheHelpers.updateEntity(cache, 'Payment', paymentId, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    });

    // Invalidate payment and enrollment queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'paymentHistory', args: { userId } });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'myEnrollments' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'courseEnrollments', args: { courseId } });

    // Update course enrollment count
    cacheHelpers.updateEntity(cache, 'Course', courseId, {
      enrollmentCount: (existing: number) => existing + 1,
    });
  },

  /**
   * Invalidate after notification read
   */
  notificationRead: (cache: InMemoryCache, notificationId: string, userId: string) => {
    cacheHelpers.updateEntity(cache, 'Notification', notificationId, {
      isRead: true,
      readAt: new Date().toISOString(),
    });

    // Invalidate notification queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'notifications', args: { userId } });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'unreadNotifications', args: { userId } });
  },

  /**
   * Invalidate after content processing completion
   */
  contentProcessingCompleted: (cache: InMemoryCache, assetId: string, jobId: string) => {
    cacheHelpers.updateEntity(cache, 'MediaAsset', assetId, {
      processingStatus: 'COMPLETED',
      processedAt: new Date().toISOString(),
    });

    cacheHelpers.updateEntity(cache, 'VideoProcessingJob', jobId, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    });

    // Invalidate content queries
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'mediaAssets' });
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'processingJobs' });
  },
};
