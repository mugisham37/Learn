/**
 * Apollo Cache Configuration
 * 
 * Normalized cache configuration with type policies for efficient data management.
 * Implements cache normalization, field policies, and merge functions.
 */

import { InMemoryCache, TypePolicy, gql } from '@apollo/client';

/**
 * Type policies for normalized cache storage
 * 
 * These policies define how Apollo Client normalizes and stores data:
 * - Key fields: How to identify unique entities
 * - Field policies: How to merge and read specific fields
 * - Merge functions: How to handle updates to cached data
 */
const typePolicies: Record<string, TypePolicy> = {
  Query: {
    fields: {
      // Pagination handling for courses
      courses: {
        keyArgs: ['filter'], // Cache separately by filter
        merge(existing = [], incoming, { args }) {
          // Handle cursor-based pagination
          if (args?.after) {
            return [...existing, ...incoming];
          }
          // Replace for new queries
          return incoming;
        },
      },
      // Similar pagination for other list fields
      enrollments: {
        keyArgs: ['filter'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
      notifications: {
        keyArgs: ['filter'],
        merge(existing = [], incoming, { args }) {
          if (args?.after) {
            return [...existing, ...incoming];
          }
          return incoming;
        },
      },
    },
  },
  
  User: {
    keyFields: ['id'],
    fields: {
      // Handle user profile updates
      profile: {
        merge: true, // Deep merge profile objects
      },
    },
  },

  Course: {
    keyFields: ['id'],
    fields: {
      // Handle course modules array updates
      modules: {
        merge(existing = [], incoming) {
          // Merge modules by ID, preserving order
          const merged = [...existing];
          
          incoming.forEach((incomingModule: { id: string }) => {
            const existingIndex = merged.findIndex((m: { id: string }) => m.id === incomingModule.id);
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingModule };
            } else {
              merged.push(incomingModule);
            }
          });
          
          return merged;
        },
      },
      // Handle enrollment count updates
      enrollmentCount: {
        merge(existing, incoming) {
          // Always use the most recent count
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
            const existingIndex = merged.findIndex((l: { id: string }) => l.id === incomingLesson.id);
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingLesson };
            } else {
              merged.push(incomingLesson);
            }
          });
          
          return merged;
        },
      },
    },
  },

  Enrollment: {
    keyFields: ['id'],
    fields: {
      // Handle progress updates
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
            const existingIndex = merged.findIndex((p: { lessonId: string }) => p.lessonId === incomingProgress.lessonId);
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingProgress };
            } else {
              merged.push(incomingProgress);
            }
          });
          
          return merged;
        },
      },
    },
  },

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
    },
  },

  Message: {
    keyFields: ['id'],
    fields: {
      // Handle message status updates
      status: {
        merge(existing, incoming) {
          return incoming;
        },
      },
    },
  },

  Quiz: {
    keyFields: ['id'],
    fields: {
      questions: {
        merge: true, // Deep merge questions
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
            const existingIndex = merged.findIndex((s: { studentId: string }) => s.studentId === incomingSub.studentId);
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex], ...incomingSub };
            } else {
              merged.push(incomingSub);
            }
          });
          
          return merged;
        },
      },
    },
  },
};

/**
 * Creates and configures the Apollo InMemoryCache
 * 
 * Features:
 * - Normalized storage by entity ID
 * - Intelligent field merging for arrays and objects
 * - Pagination support for list queries
 * - Real-time update handling
 * - Memory management with size limits
 */
export function createCacheConfig(): InMemoryCache {
  return new InMemoryCache({
    typePolicies,
    
    // Cache configuration
    resultCaching: true, // Enable result caching for performance
    
    // Add cache size management if needed
    possibleTypes: {
      // Define possible types for union/interface types
      // This will be populated from the GraphQL schema introspection
    },
    
    // Data ID from object function for custom entity identification
    dataIdFromObject: (object: { __typename?: string; id?: string; enrollmentId?: string; lessonId?: string }) => {
      // Default behavior: use __typename:id
      if (object.__typename && object.id) {
        return `${object.__typename}:${object.id}`;
      }
      
      // Custom handling for specific types if needed
      switch (object.__typename) {
        case 'LessonProgress':
          // Use composite key for lesson progress
          return `LessonProgress:${object.enrollmentId}:${object.lessonId}`;
        default:
          return false; // Let Apollo handle it
      }
    },
  });
}

/**
 * Cache helper functions for manual cache updates
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
};

