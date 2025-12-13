/**
 * Analytics Cache Service
 *
 * Implements comprehensive caching strategy for analytics data with:
 * - Cache-aside pattern for expensive queries
 * - Appropriate TTL based on update frequency
 * - Cache warming for dashboard metrics
 * - Cache invalidation on data updates
 * - Cache stampede prevention
 *
 * Requirements: 12.6, 15.2
 */

import {
  cache,
  buildCacheKey,
  CachePrefix,

  redis,
} from '../../../../infrastructure/cache/index.js';
import type { Role, DateRange } from '../../../../shared/types/index.js';
import type {
  CourseReport,
  StudentReport,
  DashboardMetrics,
} from '../../application/services/IAnalyticsService.js';
import type { CourseAnalytics, StudentAnalytics } from '../../domain/entities/index.js';

interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalRevenue: number;
  averageCompletionRate: number;
  averageRating: number;
  growthMetrics: {
    userGrowth: number;
    courseGrowth: number;
    enrollmentGrowth: number;
    revenueGrowth: number;
  };
}

/**
 * Cache TTL values specific to analytics data
 * Balances freshness with performance based on update frequency
 */
export const AnalyticsCacheTTL = {
  // Real-time metrics - short TTL for frequently changing data
  DASHBOARD_METRICS: 300, // 5 minutes
  COURSE_ANALYTICS: 600, // 10 minutes
  STUDENT_ANALYTICS: 600, // 10 minutes

  // Reports - longer TTL as they're expensive to generate
  COURSE_REPORT: 1800, // 30 minutes
  STUDENT_REPORT: 1800, // 30 minutes
  PLATFORM_METRICS: 900, // 15 minutes

  // Trending data - medium TTL
  TRENDING_COURSES: 900, // 15 minutes
  TOP_PERFORMERS: 1800, // 30 minutes

  // Event aggregations - short TTL for accuracy
  EVENT_COUNTS: 300, // 5 minutes
  EVENT_DISTRIBUTION: 600, // 10 minutes

  // Cache warming locks - prevent stampede
  WARMING_LOCK: 60, // 1 minute
} as const;

/**
 * Cache key builders for different analytics data types
 */
export const AnalyticsCacheKeys = {
  courseAnalytics: (courseId: string) => buildCacheKey(CachePrefix.ANALYTICS, 'course', courseId),

  studentAnalytics: (userId: string) => buildCacheKey(CachePrefix.ANALYTICS, 'student', userId),

  dashboardMetrics: (userId: string, role: Role) =>
    buildCacheKey(CachePrefix.ANALYTICS, 'dashboard', userId, role),

  courseReport: (courseId: string, startDate: string, endDate: string) =>
    buildCacheKey(CachePrefix.ANALYTICS, 'course-report', courseId, startDate, endDate),

  studentReport: (userId: string, startDate: string, endDate: string) =>
    buildCacheKey(CachePrefix.ANALYTICS, 'student-report', userId, startDate, endDate),

  platformMetrics: (startDate: string, endDate: string) =>
    buildCacheKey(CachePrefix.ANALYTICS, 'platform', startDate, endDate),

  trendingCourses: (limit: number, startDate: string, endDate: string) =>
    buildCacheKey(CachePrefix.ANALYTICS, 'trending', limit, startDate, endDate),

  topPerformers: (limit: number) => buildCacheKey(CachePrefix.ANALYTICS, 'top-performers', limit),

  eventCount: (eventType: string, startDate?: string, endDate?: string) =>
    buildCacheKey(
      CachePrefix.ANALYTICS,
      'event-count',
      eventType,
      startDate || 'all',
      endDate || 'all'
    ),

  eventDistribution: (startDate?: string, endDate?: string) =>
    buildCacheKey(CachePrefix.ANALYTICS, 'event-dist', startDate || 'all', endDate || 'all'),

  // Cache warming locks
  warmingLock: (key: string) => buildCacheKey(CachePrefix.ANALYTICS, 'warming-lock', key),

  // Invalidation patterns
  coursePattern: (courseId: string) =>
    buildCacheKey(CachePrefix.ANALYTICS, 'course', courseId) + '*',

  studentPattern: (userId: string) => buildCacheKey(CachePrefix.ANALYTICS, 'student', userId) + '*',

  allDashboardPattern: () => buildCacheKey(CachePrefix.ANALYTICS, 'dashboard') + '*',

  allReportsPattern: () => buildCacheKey(CachePrefix.ANALYTICS, '*-report', '*'),

  allTrendingPattern: () => buildCacheKey(CachePrefix.ANALYTICS, 'trending') + '*',
} as const;

/**
 * Analytics Cache Service
 *
 * Provides comprehensive caching functionality for analytics data with
 * cache-aside pattern, appropriate TTLs, cache warming, and invalidation.
 */
export class AnalyticsCacheService {
  /**
   * Gets cached course analytics or returns null if not cached
   */
  async getCourseAnalytics(courseId: string): Promise<CourseAnalytics | null> {
    const key = AnalyticsCacheKeys.courseAnalytics(courseId);
    return await cache.get<CourseAnalytics>(key);
  }

  /**
   * Caches course analytics with appropriate TTL
   */
  async setCourseAnalytics(courseId: string, analytics: CourseAnalytics): Promise<void> {
    const key = AnalyticsCacheKeys.courseAnalytics(courseId);
    await cache.set(key, analytics, AnalyticsCacheTTL.COURSE_ANALYTICS);
  }

  /**
   * Gets cached student analytics or returns null if not cached
   */
  async getStudentAnalytics(userId: string): Promise<StudentAnalytics | null> {
    const key = AnalyticsCacheKeys.studentAnalytics(userId);
    return await cache.get<StudentAnalytics>(key);
  }

  /**
   * Caches student analytics with appropriate TTL
   */
  async setStudentAnalytics(userId: string, analytics: StudentAnalytics): Promise<void> {
    const key = AnalyticsCacheKeys.studentAnalytics(userId);
    await cache.set(key, analytics, AnalyticsCacheTTL.STUDENT_ANALYTICS);
  }

  /**
   * Gets cached dashboard metrics or returns null if not cached
   */
  async getDashboardMetrics(userId: string, role: Role): Promise<DashboardMetrics | null> {
    const key = AnalyticsCacheKeys.dashboardMetrics(userId, role);
    return await cache.get<DashboardMetrics>(key);
  }

  /**
   * Caches dashboard metrics with appropriate TTL
   */
  async setDashboardMetrics(userId: string, role: Role, metrics: DashboardMetrics): Promise<void> {
    const key = AnalyticsCacheKeys.dashboardMetrics(userId, role);
    await cache.set(key, metrics, AnalyticsCacheTTL.DASHBOARD_METRICS);
  }

  /**
   * Gets cached course report or returns null if not cached
   */
  async getCourseReport(courseId: string, dateRange: DateRange): Promise<CourseReport | null> {
    const key = AnalyticsCacheKeys.courseReport(
      courseId,
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    return await cache.get<CourseReport>(key);
  }

  /**
   * Caches course report with appropriate TTL
   */
  async setCourseReport(
    courseId: string,
    dateRange: DateRange,
    report: CourseReport
  ): Promise<void> {
    const key = AnalyticsCacheKeys.courseReport(
      courseId,
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    await cache.set(key, report, AnalyticsCacheTTL.COURSE_REPORT);
  }

  /**
   * Gets cached student report or returns null if not cached
   */
  async getStudentReport(userId: string, dateRange: DateRange): Promise<StudentReport | null> {
    const key = AnalyticsCacheKeys.studentReport(
      userId,
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    return await cache.get<StudentReport>(key);
  }

  /**
   * Caches student report with appropriate TTL
   */
  async setStudentReport(
    userId: string,
    dateRange: DateRange,
    report: StudentReport
  ): Promise<void> {
    const key = AnalyticsCacheKeys.studentReport(
      userId,
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    await cache.set(key, report, AnalyticsCacheTTL.STUDENT_REPORT);
  }

  /**
   * Gets cached platform metrics or returns null if not cached
   */
  async getPlatformMetrics(dateRange: DateRange): Promise<PlatformMetrics | null> {
    const key = AnalyticsCacheKeys.platformMetrics(
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    return await cache.get(key);
  }

  /**
   * Caches platform metrics with appropriate TTL
   */
  async setPlatformMetrics(dateRange: DateRange, metrics: PlatformMetrics): Promise<void> {
    const key = AnalyticsCacheKeys.platformMetrics(
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    await cache.set(key, metrics, AnalyticsCacheTTL.PLATFORM_METRICS);
  }

  /**
   * Gets cached trending courses or returns null if not cached
   */
  async getTrendingCourses(limit: number, dateRange: DateRange): Promise<CourseAnalytics[] | null> {
    const key = AnalyticsCacheKeys.trendingCourses(
      limit,
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    return await cache.get<CourseAnalytics[]>(key);
  }

  /**
   * Caches trending courses with appropriate TTL
   */
  async setTrendingCourses(
    limit: number,
    dateRange: DateRange,
    courses: CourseAnalytics[]
  ): Promise<void> {
    const key = AnalyticsCacheKeys.trendingCourses(
      limit,
      dateRange.startDate.toISOString(),
      dateRange.endDate.toISOString()
    );
    await cache.set(key, courses, AnalyticsCacheTTL.TRENDING_COURSES);
  }

  /**
   * Gets cached top performing students or returns null if not cached
   */
  async getTopPerformers(limit: number): Promise<StudentAnalytics[] | null> {
    const key = AnalyticsCacheKeys.topPerformers(limit);
    return await cache.get<StudentAnalytics[]>(key);
  }

  /**
   * Caches top performing students with appropriate TTL
   */
  async setTopPerformers(limit: number, students: StudentAnalytics[]): Promise<void> {
    const key = AnalyticsCacheKeys.topPerformers(limit);
    await cache.set(key, students, AnalyticsCacheTTL.TOP_PERFORMERS);
  }

  /**
   * Gets cached event count or returns null if not cached
   */
  async getEventCount(eventType: string, dateRange?: DateRange): Promise<number | null> {
    const key = AnalyticsCacheKeys.eventCount(
      eventType,
      dateRange?.startDate.toISOString(),
      dateRange?.endDate.toISOString()
    );
    return await cache.get<number>(key);
  }

  /**
   * Caches event count with appropriate TTL
   */
  async setEventCount(eventType: string, count: number, dateRange?: DateRange): Promise<void> {
    const key = AnalyticsCacheKeys.eventCount(
      eventType,
      dateRange?.startDate.toISOString(),
      dateRange?.endDate.toISOString()
    );
    await cache.set(key, count, AnalyticsCacheTTL.EVENT_COUNTS);
  }

  /**
   * Gets cached event distribution or returns null if not cached
   */
  async getEventDistribution(dateRange?: DateRange): Promise<Record<string, number> | null> {
    const key = AnalyticsCacheKeys.eventDistribution(
      dateRange?.startDate.toISOString(),
      dateRange?.endDate.toISOString()
    );
    return await cache.get<Record<string, number>>(key);
  }

  /**
   * Caches event distribution with appropriate TTL
   */
  async setEventDistribution(
    distribution: Record<string, number>,
    dateRange?: DateRange
  ): Promise<void> {
    const key = AnalyticsCacheKeys.eventDistribution(
      dateRange?.startDate.toISOString(),
      dateRange?.endDate.toISOString()
    );
    await cache.set(key, distribution, AnalyticsCacheTTL.EVENT_DISTRIBUTION);
  }

  /**
   * Cache warming with stampede prevention
   *
   * Uses distributed locks to prevent multiple processes from warming the same cache
   * simultaneously (cache stampede prevention).
   */
  async warmCache<T>(cacheKey: string, warmingFunction: () => Promise<T>, ttl: number): Promise<T> {
    // Check if data is already cached
    const cached = await cache.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to acquire warming lock
    const lockKey = AnalyticsCacheKeys.warmingLock(cacheKey);
    const lockAcquired = await cache.setIfNotExists(
      lockKey,
      'warming',
      AnalyticsCacheTTL.WARMING_LOCK
    );

    if (lockAcquired) {
      try {
        // We got the lock, warm the cache
        const data = await warmingFunction();
        await cache.set(cacheKey, data, ttl);
        return data;
      } finally {
        // Always release the lock
        await cache.delete(lockKey);
      }
    } else {
      // Another process is warming the cache, wait a bit and check again
      await new Promise((resolve) => setTimeout(resolve, 100));

      const warmedData = await cache.get<T>(cacheKey);
      if (warmedData) {
        return warmedData;
      }

      // If still not cached, execute the function without caching
      // This prevents blocking but may result in duplicate work
      return await warmingFunction();
    }
  }

  /**
   * Invalidates course-related cache entries
   *
   * Called when course data is updated to ensure cache consistency
   */
  async invalidateCourseCache(courseId: string): Promise<void> {
    const patterns = [
      AnalyticsCacheKeys.coursePattern(courseId),
      AnalyticsCacheKeys.allDashboardPattern(),
      AnalyticsCacheKeys.allReportsPattern(),
      AnalyticsCacheKeys.allTrendingPattern(),
    ];

    await Promise.all(patterns.map((pattern) => cache.deletePattern(pattern)));
  }

  /**
   * Invalidates student-related cache entries
   *
   * Called when student data is updated to ensure cache consistency
   */
  async invalidateStudentCache(userId: string): Promise<void> {
    const patterns = [
      AnalyticsCacheKeys.studentPattern(userId),
      AnalyticsCacheKeys.allDashboardPattern(),
      AnalyticsCacheKeys.allReportsPattern(),
    ];

    await Promise.all(patterns.map((pattern) => cache.deletePattern(pattern)));
  }

  /**
   * Invalidates enrollment-related cache entries
   *
   * Called when enrollment data changes (new enrollment, completion, etc.)
   */
  async invalidateEnrollmentCache(courseId: string, studentId: string): Promise<void> {
    await Promise.all([
      this.invalidateCourseCache(courseId),
      this.invalidateStudentCache(studentId),
    ]);
  }

  /**
   * Invalidates quiz/assignment-related cache entries
   *
   * Called when assessment data changes (submissions, grades, etc.)
   */
  async invalidateAssessmentCache(courseId: string, studentId: string): Promise<void> {
    await Promise.all([
      this.invalidateCourseCache(courseId),
      this.invalidateStudentCache(studentId),
    ]);
  }

  /**
   * Invalidates payment-related cache entries
   *
   * Called when payment data changes (new payments, refunds, etc.)
   */
  async invalidatePaymentCache(courseId?: string): Promise<void> {
    const patterns = [
      AnalyticsCacheKeys.allDashboardPattern(),
      AnalyticsCacheKeys.allReportsPattern(),
    ];

    if (courseId) {
      patterns.push(AnalyticsCacheKeys.coursePattern(courseId));
    }

    await Promise.all(patterns.map((pattern) => cache.deletePattern(pattern)));
  }

  /**
   * Invalidates all analytics cache
   *
   * Nuclear option for when major data changes occur
   */
  async invalidateAllAnalyticsCache(): Promise<void> {
    const pattern = buildCacheKey(CachePrefix.ANALYTICS, '*');
    await cache.deletePattern(pattern);
  }

  /**
   * Warms critical dashboard metrics for all active users
   *
   * Should be called periodically to ensure fast dashboard loading
   */
  async warmDashboardCaches(userIds: string[], roles: Role[]): Promise<void> {
    const warmingPromises: Promise<unknown>[] = [];

    for (const userId of userIds) {
      for (const role of roles) {
        const cacheKey = AnalyticsCacheKeys.dashboardMetrics(userId, role);

        // Only warm if not already cached
        const cached = await cache.get(cacheKey);
        if (!cached) {
          warmingPromises.push(
            this.warmCache(
              cacheKey,
              async () => {
                // This would call the actual dashboard metrics generation
                // For now, return a placeholder
                return Promise.resolve({ role, userId, generatedAt: new Date(), overview: {} });
              },
              AnalyticsCacheTTL.DASHBOARD_METRICS
            )
          );
        }
      }
    }

    // Execute warming in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < warmingPromises.length; i += batchSize) {
      const batch = warmingPromises.slice(i, i + batchSize);
      await Promise.all(batch);
    }
  }

  /**
   * Gets cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    courseAnalyticsKeys: number;
    studentAnalyticsKeys: number;
    dashboardKeys: number;
    reportKeys: number;
    hitRate?: number;
  }> {
    const [totalStats, courseKeys, studentKeys, dashboardKeys, reportKeys] = await Promise.all([
      cache.getStats(),
      this.countKeysByPattern(buildCacheKey(CachePrefix.ANALYTICS, 'course', '*')),
      this.countKeysByPattern(buildCacheKey(CachePrefix.ANALYTICS, 'student', '*')),
      this.countKeysByPattern(buildCacheKey(CachePrefix.ANALYTICS, 'dashboard', '*')),
      this.countKeysByPattern(buildCacheKey(CachePrefix.ANALYTICS, '*-report', '*')),
    ]);

    const hitRate =
      totalStats.hits && totalStats.misses
        ? (parseInt(totalStats.hits) / (parseInt(totalStats.hits) + parseInt(totalStats.misses))) *
          100
        : undefined;

    return {
      totalKeys: totalStats.keys,
      courseAnalyticsKeys: courseKeys,
      studentAnalyticsKeys: studentKeys,
      dashboardKeys: dashboardKeys,
      reportKeys: reportKeys,
      hitRate,
    };
  }

  /**
   * Deletes all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    return await cache.deletePattern(pattern);
  }

  /**
   * Counts keys matching a pattern
   */
  private async countKeysByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let count = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');

    return count;
  }
}

/**
 * Singleton instance of the analytics cache service
 */
export const analyticsCacheService = new AnalyticsCacheService();
