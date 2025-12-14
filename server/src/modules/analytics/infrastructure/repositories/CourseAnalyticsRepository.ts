/**
 * Course Analytics Repository Implementation
 *
 * Implements course analytics data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 12.1, 12.7
 */

import { eq, inArray, desc, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  courseAnalytics,
  type CourseAnalytics,
  type NewCourseAnalytics,
} from '../../../../infrastructure/database/schema/analytics.schema.js';
import { courses } from '../../../../infrastructure/database/schema/courses.schema.js';
import { DatabaseError, NotFoundError } from '../../../../shared/errors/index.js';

import {
  ICourseAnalyticsRepository,
  CourseAnalyticsAggregation,
  PaginationParams,
  PaginatedResult,
} from './IAnalyticsRepository.js';

/**
 * Course Analytics Repository Implementation
 *
 * Provides data access methods for course analytics entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Efficient aggregation queries with indexes
 */
export class CourseAnalyticsRepository implements ICourseAnalyticsRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for course analytics by course ID
   */
  private getCourseAnalyticsCacheKey(courseId: string): string {
    return buildCacheKey(CachePrefix.ANALYTICS, 'course', courseId);
  }

  /**
   * Builds cache key for instructor course analytics list
   */
  private getInstructorAnalyticsCacheKey(
    instructorId: string,
    page: number,
    limit: number
  ): string {
    return buildCacheKey(CachePrefix.ANALYTICS, 'instructor', instructorId, page, limit);
  }

  /**
   * Builds cache key for all course analytics list
   */
  private getAllAnalyticsCacheKey(page: number, limit: number): string {
    return buildCacheKey(CachePrefix.ANALYTICS, 'all', page, limit);
  }

  /**
   * Creates or updates course analytics record
   *
   * Uses PostgreSQL UPSERT (ON CONFLICT) to handle both create and update cases.
   * Automatically updates the lastUpdated timestamp.
   *
   * @param courseId - Course ID
   * @param data - Analytics data
   * @returns The created/updated course analytics
   * @throws DatabaseError if database operation fails
   */
  async upsert(courseId: string, data: CourseAnalyticsAggregation): Promise<CourseAnalytics> {
    try {
      const analyticsData: NewCourseAnalytics = {
        courseId,
        totalEnrollments: data.totalEnrollments,
        activeEnrollments: data.activeEnrollments,
        completionCount: data.completionCount,
        completionRate: data.completionRate.toString(),
        averageRating: data.averageRating?.toString(),
        totalRevenue: data.totalRevenue.toString(),
        averageTimeToCompletionDays: data.averageTimeToCompletionDays,
        dropoutRate: data.dropoutRate.toString(),
        mostDifficultLessonId: data.mostDifficultLessonId,
        engagementMetrics: data.engagementMetrics,
        lastUpdated: new Date(),
      };

      const [upsertedAnalytics] = await this.writeDb
        .insert(courseAnalytics)
        .values(analyticsData)
        .onConflictDoUpdate({
          target: courseAnalytics.courseId,
          set: {
            totalEnrollments: analyticsData.totalEnrollments,
            activeEnrollments: analyticsData.activeEnrollments,
            completionCount: analyticsData.completionCount,
            completionRate: analyticsData.completionRate,
            averageRating: analyticsData.averageRating,
            totalRevenue: analyticsData.totalRevenue,
            averageTimeToCompletionDays: analyticsData.averageTimeToCompletionDays,
            dropoutRate: analyticsData.dropoutRate,
            mostDifficultLessonId: analyticsData.mostDifficultLessonId,
            engagementMetrics: analyticsData.engagementMetrics,
            lastUpdated: analyticsData.lastUpdated,
          },
        })
        .returning();

      if (!upsertedAnalytics) {
        throw new DatabaseError('Failed to upsert course analytics', 'upsert');
      }

      // Invalidate relevant caches
      await this.invalidateCache(courseId);

      return upsertedAnalytics;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Handle unexpected database errors
      throw new DatabaseError(
        `Failed to upsert course analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'upsert'
      );
    }
  }

  /**
   * Finds course analytics by course ID
   *
   * Uses Redis caching with 5-minute TTL for performance.
   * Falls back to database query if cache miss.
   *
   * @param courseId - Course ID
   * @returns The course analytics if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByCourseId(courseId: string): Promise<CourseAnalytics | null> {
    const cacheKey = this.getCourseAnalyticsCacheKey(courseId);

    try {
      // Try to get from cache first
      const cached = await cache.get<CourseAnalytics>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database
      const [analytics] = await this.readDb
        .select()
        .from(courseAnalytics)
        .where(eq(courseAnalytics.courseId, courseId))
        .limit(1);

      if (analytics) {
        // Cache the result
        await cache.set(cacheKey, analytics, CacheTTL.ANALYTICS);
      }

      return analytics || null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find course analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds course analytics for multiple courses
   *
   * Efficiently queries multiple course analytics in a single database call.
   * Does not use caching due to variable nature of the query.
   *
   * @param courseIds - Array of course IDs
   * @returns Array of course analytics
   * @throws DatabaseError if database operation fails
   */
  async findByCourseIds(courseIds: string[]): Promise<CourseAnalytics[]> {
    if (courseIds.length === 0) {
      return [];
    }

    try {
      const analytics = await this.readDb
        .select()
        .from(courseAnalytics)
        .where(inArray(courseAnalytics.courseId, courseIds));

      return analytics;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find course analytics by IDs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds all course analytics with pagination
   *
   * Uses Redis caching for paginated results with 5-minute TTL.
   * Orders by last updated timestamp descending for most recent first.
   *
   * @param pagination - Pagination parameters
   * @returns Paginated course analytics results
   * @throws DatabaseError if database operation fails
   */
  async findAll(pagination: PaginationParams): Promise<PaginatedResult<CourseAnalytics>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const cacheKey = this.getAllAnalyticsCacheKey(page, limit);

    try {
      // Try to get from cache first
      const cached = await cache.get<PaginatedResult<CourseAnalytics>>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database for data and total count
      const [data, totalResult] = await Promise.all([
        this.readDb
          .select()
          .from(courseAnalytics)
          .orderBy(desc(courseAnalytics.lastUpdated))
          .limit(limit)
          .offset(offset),
        this.readDb.select({ total: count() }).from(courseAnalytics),
      ]);

      const total = totalResult[0]?.total || 0;

      const result: PaginatedResult<CourseAnalytics> = {
        data,
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      };

      // Cache the result
      await cache.set(cacheKey, result, CacheTTL.ANALYTICS);

      return result;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find all course analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds course analytics by instructor
   *
   * Joins with courses table to filter by instructor ID.
   * Uses Redis caching for paginated results with 5-minute TTL.
   *
   * @param instructorId - Instructor user ID
   * @param pagination - Pagination parameters
   * @returns Paginated course analytics results
   * @throws DatabaseError if database operation fails
   */
  async findByInstructor(
    instructorId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<CourseAnalytics>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const cacheKey = this.getInstructorAnalyticsCacheKey(instructorId, page, limit);

    try {
      // Try to get from cache first
      const cached = await cache.get<PaginatedResult<CourseAnalytics>>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database with join to courses table
      const [data, totalResult] = await Promise.all([
        this.readDb
          .select({
            courseId: courseAnalytics.courseId,
            totalEnrollments: courseAnalytics.totalEnrollments,
            activeEnrollments: courseAnalytics.activeEnrollments,
            completionCount: courseAnalytics.completionCount,
            completionRate: courseAnalytics.completionRate,
            averageRating: courseAnalytics.averageRating,
            totalRevenue: courseAnalytics.totalRevenue,
            averageTimeToCompletionDays: courseAnalytics.averageTimeToCompletionDays,
            dropoutRate: courseAnalytics.dropoutRate,
            mostDifficultLessonId: courseAnalytics.mostDifficultLessonId,
            engagementMetrics: courseAnalytics.engagementMetrics,
            lastUpdated: courseAnalytics.lastUpdated,
          })
          .from(courseAnalytics)
          .innerJoin(courses, eq(courseAnalytics.courseId, courses.id))
          .where(eq(courses.instructorId, instructorId))
          .orderBy(desc(courseAnalytics.lastUpdated))
          .limit(limit)
          .offset(offset),
        this.readDb
          .select({ total: count() })
          .from(courseAnalytics)
          .innerJoin(courses, eq(courseAnalytics.courseId, courses.id))
          .where(eq(courses.instructorId, instructorId)),
      ]);

      const total = totalResult[0]?.total || 0;

      const result: PaginatedResult<CourseAnalytics> = {
        data,
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      };

      // Cache the result
      await cache.set(cacheKey, result, CacheTTL.ANALYTICS);

      return result;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find course analytics by instructor: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Updates course analytics last updated timestamp
   *
   * @param courseId - Course ID
   * @returns The updated course analytics
   * @throws NotFoundError if course analytics doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async updateLastUpdated(courseId: string): Promise<CourseAnalytics> {
    try {
      const [updatedAnalytics] = await this.writeDb
        .update(courseAnalytics)
        .set({ lastUpdated: new Date() })
        .where(eq(courseAnalytics.courseId, courseId))
        .returning();

      if (!updatedAnalytics) {
        throw new NotFoundError('CourseAnalytics', courseId);
      }

      // Invalidate cache
      await this.invalidateCache(courseId);

      return updatedAnalytics;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        `Failed to update course analytics timestamp: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'update'
      );
    }
  }

  /**
   * Deletes course analytics record
   *
   * @param courseId - Course ID
   * @returns void
   * @throws DatabaseError if database operation fails
   */
  async delete(courseId: string): Promise<void> {
    try {
      await this.writeDb.delete(courseAnalytics).where(eq(courseAnalytics.courseId, courseId));

      // Invalidate cache
      await this.invalidateCache(courseId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete course analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'delete'
      );
    }
  }

  /**
   * Invalidates cache for course analytics
   *
   * @param courseId - Course ID
   * @returns void
   */
  async invalidateCache(courseId: string): Promise<void> {
    try {
      const cacheKey = this.getCourseAnalyticsCacheKey(courseId);
      await cache.delete(cacheKey);

      // Also invalidate list caches that might contain this course
      await cache.deletePattern(`${CachePrefix.ANALYTICS}:all:*`);
    } catch (error) {
      // Log cache invalidation errors but don't throw
      console.warn('Failed to invalidate course analytics cache:', error);
    }
  }

  /**
   * Invalidates cache for instructor course analytics
   *
   * @param instructorId - Instructor user ID
   * @returns void
   */
  async invalidateCacheByInstructor(instructorId: string): Promise<void> {
    try {
      await cache.deletePattern(`${CachePrefix.ANALYTICS}:instructor:${instructorId}:*`);
    } catch (error) {
      // Log cache invalidation errors but don't throw
      console.warn('Failed to invalidate instructor course analytics cache:', error);
    }
  }
}
