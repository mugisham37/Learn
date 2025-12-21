/**
 * Next.js Cache Integration
 *
 * Integrates Next.js caching strategies with backend data and Apollo Client cache.
 * Provides utilities for cache revalidation, ISR, and SSG with backend data.
 *
 * Requirements: 8.5
 */

import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Cache configuration for different data types
 */
export const CACHE_CONFIG = {
  // Static content - rarely changes
  STATIC: {
    revalidate: 3600, // 1 hour
    tags: ['static'],
  },

  // Course catalog - changes moderately
  COURSES: {
    revalidate: 300, // 5 minutes
    tags: ['courses', 'catalog'],
  },

  // User-specific data - changes frequently
  USER_DATA: {
    revalidate: 60, // 1 minute
    tags: ['user', 'profile'],
  },

  // Real-time data - always fresh
  REALTIME: {
    revalidate: 0, // No caching
    tags: ['realtime'],
  },

  // Analytics data - changes daily
  ANALYTICS: {
    revalidate: 86400, // 24 hours
    tags: ['analytics', 'reports'],
  },
} as const;

/**
 * Cache tags for different entities
 */
export const CACHE_TAGS = {
  // Entity-specific tags
  COURSE: (id: string) => `course:${id}`,
  USER: (id: string) => `user:${id}`,
  ENROLLMENT: (id: string) => `enrollment:${id}`,
  ASSESSMENT: (id: string) => `assessment:${id}`,

  // Collection tags
  COURSES_LIST: 'courses:list',
  USERS_LIST: 'users:list',
  ENROLLMENTS_LIST: 'enrollments:list',

  // Category tags
  COURSE_CATEGORY: (category: string) => `course:category:${category}`,

  // User-specific tags
  USER_COURSES: (userId: string) => `user:${userId}:courses`,
  USER_ENROLLMENTS: (userId: string) => `user:${userId}:enrollments`,
  USER_PROGRESS: (userId: string) => `user:${userId}:progress`,
} as const;

/**
 * Revalidation utilities
 */
export const cacheRevalidation = {
  /**
   * Revalidate course data
   */
  async revalidateCourse(courseId: string) {
    revalidateTag(CACHE_TAGS.COURSE(courseId));
    revalidateTag(CACHE_TAGS.COURSES_LIST);
    revalidatePath('/courses');
    revalidatePath(`/courses/${courseId}`);
  },

  /**
   * Revalidate user data
   */
  async revalidateUser(userId: string) {
    revalidateTag(CACHE_TAGS.USER(userId));
    revalidateTag(CACHE_TAGS.USERS_LIST);
    revalidateTag(CACHE_TAGS.USER_COURSES(userId));
    revalidateTag(CACHE_TAGS.USER_ENROLLMENTS(userId));
    revalidatePath('/profile');
    revalidatePath('/dashboard');
  },

  /**
   * Revalidate enrollment data
   */
  async revalidateEnrollment(enrollmentId: string, userId: string, courseId: string) {
    revalidateTag(CACHE_TAGS.ENROLLMENT(enrollmentId));
    revalidateTag(CACHE_TAGS.ENROLLMENTS_LIST);
    revalidateTag(CACHE_TAGS.USER_ENROLLMENTS(userId));
    revalidateTag(CACHE_TAGS.COURSE(courseId));
    revalidatePath('/learning');
    revalidatePath(`/courses/${courseId}`);
  },

  /**
   * Revalidate course category
   */
  async revalidateCourseCategory(category: string) {
    revalidateTag(CACHE_TAGS.COURSE_CATEGORY(category));
    revalidateTag(CACHE_TAGS.COURSES_LIST);
    revalidatePath('/courses');
  },

  /**
   * Revalidate user progress
   */
  async revalidateUserProgress(userId: string) {
    revalidateTag(CACHE_TAGS.USER_PROGRESS(userId));
    revalidateTag(CACHE_TAGS.USER_ENROLLMENTS(userId));
    revalidatePath('/learning');
    revalidatePath('/dashboard');
  },

  /**
   * Revalidate all course-related data
   */
  async revalidateAllCourses() {
    revalidateTag(CACHE_TAGS.COURSES_LIST);
    revalidateTag('courses');
    revalidatePath('/courses');
  },

  /**
   * Revalidate specific path
   */
  async revalidateCustomPath(path: string, tags?: string[]) {
    revalidatePath(path);
    if (tags) {
      tags.forEach(tag => revalidateTag(tag));
    }
  },
};

/**
 * Fetch options for different cache strategies
 */
export const fetchOptions = {
  /**
   * Static generation - cache indefinitely
   */
  static: {
    next: {
      revalidate: false,
      tags: CACHE_CONFIG.STATIC.tags,
    },
  },

  /**
   * Incremental static regeneration - revalidate periodically
   */
  isr: (revalidate: number, tags: string[] = []) => ({
    next: {
      revalidate,
      tags,
    },
  }),

  /**
   * Server-side rendering - no caching
   */
  ssr: {
    cache: 'no-store' as const,
  },

  /**
   * On-demand revalidation - cache with tags
   */
  onDemand: (tags: string[]) => ({
    next: {
      tags,
    },
  }),
};

/**
 * Cache key generators for consistent cache keys
 */
export const cacheKeys = {
  /**
   * Generate cache key for course list
   */
  courseList: (params: {
    category?: string;
    difficulty?: string;
    page?: number;
    limit?: number;
  }) => {
    const parts = ['courses'];
    if (params.category) parts.push(`cat:${params.category}`);
    if (params.difficulty) parts.push(`diff:${params.difficulty}`);
    if (params.page) parts.push(`page:${params.page}`);
    if (params.limit) parts.push(`limit:${params.limit}`);
    return parts.join(':');
  },

  /**
   * Generate cache key for user enrollments
   */
  userEnrollments: (
    userId: string,
    params: {
      status?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const parts = ['enrollments', `user:${userId}`];
    if (params.status) parts.push(`status:${params.status}`);
    if (params.page) parts.push(`page:${params.page}`);
    if (params.limit) parts.push(`limit:${params.limit}`);
    return parts.join(':');
  },

  /**
   * Generate cache key for course details
   */
  courseDetails: (courseId: string, includeModules: boolean = true) => {
    const parts = ['course', courseId];
    if (includeModules) parts.push('modules');
    return parts.join(':');
  },

  /**
   * Generate cache key for user progress
   */
  userProgress: (userId: string, courseId?: string) => {
    const parts = ['progress', `user:${userId}`];
    if (courseId) parts.push(`course:${courseId}`);
    return parts.join(':');
  },
};

/**
 * Cache warming utilities
 */
export const cacheWarming = {
  /**
   * Warm cache for popular courses
   */
  async warmPopularCourses(limit: number = 10) {
    // This would be called during build or on-demand
    // to pre-populate cache with popular courses
    console.log(`Warming cache for ${limit} popular courses`);
    // Implementation would fetch and cache popular courses
  },

  /**
   * Warm cache for course categories
   */
  async warmCourseCategories() {
    console.log('Warming cache for course categories');
    // Implementation would fetch and cache all categories
  },

  /**
   * Warm cache for user dashboard data
   */
  async warmUserDashboard(userId: string) {
    console.log(`Warming cache for user ${userId} dashboard`);
    // Implementation would fetch and cache user-specific data
  },
};

/**
 * Cache invalidation strategies
 */
export const cacheInvalidation = {
  /**
   * Invalidate on course update
   */
  onCourseUpdate: async (courseId: string, updates: any) => {
    await cacheRevalidation.revalidateCourse(courseId);

    // If category changed, invalidate category cache
    if (updates.category) {
      await cacheRevalidation.revalidateCourseCategory(updates.category);
    }
  },

  /**
   * Invalidate on enrollment
   */
  onEnrollment: async (enrollmentId: string, userId: string, courseId: string) => {
    await cacheRevalidation.revalidateEnrollment(enrollmentId, userId, courseId);
    await cacheRevalidation.revalidateUser(userId);
    await cacheRevalidation.revalidateCourse(courseId);
  },

  /**
   * Invalidate on progress update
   */
  onProgressUpdate: async (userId: string, courseId: string) => {
    await cacheRevalidation.revalidateUserProgress(userId);
    await cacheRevalidation.revalidateEnrollment('', userId, courseId);
  },

  /**
   * Invalidate on user update
   */
  onUserUpdate: async (userId: string) => {
    await cacheRevalidation.revalidateUser(userId);
  },
};

/**
 * Cache monitoring utilities
 */
export const cacheMonitoring = {
  /**
   * Log cache hit/miss
   */
  logCacheAccess: (key: string, hit: boolean) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Cache ${hit ? 'HIT' : 'MISS'}: ${key}`);
    }
  },

  /**
   * Track cache performance
   */
  trackCachePerformance: (key: string, duration: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Cache operation for ${key} took ${duration}ms`);
    }
  },
};

/**
 * Export all cache utilities
 */
export const nextCache = {
  config: CACHE_CONFIG,
  tags: CACHE_TAGS,
  revalidation: cacheRevalidation,
  fetchOptions,
  keys: cacheKeys,
  warming: cacheWarming,
  invalidation: cacheInvalidation,
  monitoring: cacheMonitoring,
};
