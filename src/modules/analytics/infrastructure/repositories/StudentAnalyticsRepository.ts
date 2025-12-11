/**
 * Student Analytics Repository Implementation
 * 
 * Implements student analytics data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 * 
 * Requirements: 12.2, 12.7
 */

import { eq, inArray, desc, count, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { cache, buildCacheKey, CachePrefix, CacheTTL } from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { 
  studentAnalytics,
  type StudentAnalytics,
  type NewStudentAnalytics
} from '../../../../infrastructure/database/schema/analytics.schema.js';
import {
  DatabaseError,
  NotFoundError,
} from '../../../../shared/errors/index.js';

import {
  IStudentAnalyticsRepository,
  StudentAnalyticsAggregation,
  PaginationParams,
  PaginatedResult,
} from './IAnalyticsRepository.js';

/**
 * Student Analytics Repository Implementation
 * 
 * Provides data access methods for student analytics entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Efficient aggregation queries with indexes
 */
export class StudentAnalyticsRepository implements IStudentAnalyticsRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for student analytics by user ID
   */
  private getStudentAnalyticsCacheKey(userId: string): string {
    return buildCacheKey(CachePrefix.ANALYTICS, 'student', userId);
  }

  /**
   * Builds cache key for all student analytics list
   */
  private getAllStudentAnalyticsCacheKey(page: number, limit: number): string {
    return buildCacheKey(CachePrefix.ANALYTICS, 'students', page, limit);
  }

  /**
   * Builds cache key for top performers list
   */
  private getTopPerformersCacheKey(limit: number): string {
    return buildCacheKey(CachePrefix.ANALYTICS, 'top-performers', limit);
  }

  /**
   * Creates or updates student analytics record
   * 
   * Uses PostgreSQL UPSERT (ON CONFLICT) to handle both create and update cases.
   * Automatically updates the lastUpdated timestamp.
   * 
   * @param userId - User ID
   * @param data - Analytics data
   * @returns The created/updated student analytics
   * @throws DatabaseError if database operation fails
   */
  async upsert(userId: string, data: StudentAnalyticsAggregation): Promise<StudentAnalytics> {
    try {
      const analyticsData: NewStudentAnalytics = {
        userId,
        totalCoursesEnrolled: data.totalCoursesEnrolled,
        coursesCompleted: data.coursesCompleted,
        coursesInProgress: data.coursesInProgress,
        averageQuizScore: data.averageQuizScore?.toString(),
        totalTimeInvestedMinutes: data.totalTimeInvestedMinutes,
        currentStreakDays: data.currentStreakDays,
        longestStreakDays: data.longestStreakDays,
        badgesEarned: data.badgesEarned,
        skillRatings: data.skillRatings,
        lastUpdated: new Date(),
      };

      const [upsertedAnalytics] = await this.writeDb
        .insert(studentAnalytics)
        .values(analyticsData)
        .onConflictDoUpdate({
          target: studentAnalytics.userId,
          set: {
            totalCoursesEnrolled: analyticsData.totalCoursesEnrolled,
            coursesCompleted: analyticsData.coursesCompleted,
            coursesInProgress: analyticsData.coursesInProgress,
            averageQuizScore: analyticsData.averageQuizScore,
            totalTimeInvestedMinutes: analyticsData.totalTimeInvestedMinutes,
            currentStreakDays: analyticsData.currentStreakDays,
            longestStreakDays: analyticsData.longestStreakDays,
            badgesEarned: analyticsData.badgesEarned,
            skillRatings: analyticsData.skillRatings,
            lastUpdated: analyticsData.lastUpdated,
          },
        })
        .returning();

      if (!upsertedAnalytics) {
        throw new DatabaseError(
          'Failed to upsert student analytics',
          'upsert'
        );
      }

      // Invalidate relevant caches
      await this.invalidateCache(userId);

      return upsertedAnalytics;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Handle unexpected database errors
      throw new DatabaseError(
        `Failed to upsert student analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'upsert'
      );
    }
  }

  /**
   * Finds student analytics by user ID
   * 
   * Uses Redis caching with 5-minute TTL for performance.
   * Falls back to database query if cache miss.
   * 
   * @param userId - User ID
   * @returns The student analytics if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByUserId(userId: string): Promise<StudentAnalytics | null> {
    const cacheKey = this.getStudentAnalyticsCacheKey(userId);

    try {
      // Try to get from cache first
      const cached = await cache.get<StudentAnalytics>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database
      const [analytics] = await this.readDb
        .select()
        .from(studentAnalytics)
        .where(eq(studentAnalytics.userId, userId))
        .limit(1);

      if (analytics) {
        // Cache the result
        await cache.set(cacheKey, analytics, CacheTTL.ANALYTICS);
      }

      return analytics || null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find student analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds student analytics for multiple users
   * 
   * Efficiently queries multiple student analytics in a single database call.
   * Does not use caching due to variable nature of the query.
   * 
   * @param userIds - Array of user IDs
   * @returns Array of student analytics
   * @throws DatabaseError if database operation fails
   */
  async findByUserIds(userIds: string[]): Promise<StudentAnalytics[]> {
    if (userIds.length === 0) {
      return [];
    }

    try {
      const analytics = await this.readDb
        .select()
        .from(studentAnalytics)
        .where(inArray(studentAnalytics.userId, userIds));

      return analytics;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find student analytics by IDs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds all student analytics with pagination
   * 
   * Uses Redis caching for paginated results with 5-minute TTL.
   * Orders by last updated timestamp descending for most recent first.
   * 
   * @param pagination - Pagination parameters
   * @returns Paginated student analytics results
   * @throws DatabaseError if database operation fails
   */
  async findAll(pagination: PaginationParams): Promise<PaginatedResult<StudentAnalytics>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const cacheKey = this.getAllStudentAnalyticsCacheKey(page, limit);

    try {
      // Try to get from cache first
      const cached = await cache.get<PaginatedResult<StudentAnalytics>>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database for data and total count
      const [data, [{ total }]] = await Promise.all([
        this.readDb
          .select()
          .from(studentAnalytics)
          .orderBy(desc(studentAnalytics.lastUpdated))
          .limit(limit)
          .offset(offset),
        this.readDb
          .select({ total: count() })
          .from(studentAnalytics)
      ]);

      const result: PaginatedResult<StudentAnalytics> = {
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
        `Failed to find all student analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Finds top performing students by completion rate
   * 
   * Orders by completion rate (coursesCompleted / totalCoursesEnrolled) descending.
   * Uses Redis caching with 5-minute TTL for performance.
   * 
   * @param limit - Number of students to return
   * @returns Array of student analytics ordered by performance
   * @throws DatabaseError if database operation fails
   */
  async findTopPerformers(limit: number): Promise<StudentAnalytics[]> {
    const cacheKey = this.getTopPerformersCacheKey(limit);

    try {
      // Try to get from cache first
      const cached = await cache.get<StudentAnalytics[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database with calculated completion rate
      const topPerformers = await this.readDb
        .select()
        .from(studentAnalytics)
        .where(sql`${studentAnalytics.totalCoursesEnrolled} > 0`)
        .orderBy(
          desc(
            sql`CASE 
              WHEN ${studentAnalytics.totalCoursesEnrolled} = 0 THEN 0 
              ELSE CAST(${studentAnalytics.coursesCompleted} AS DECIMAL) / ${studentAnalytics.totalCoursesEnrolled} 
            END`
          ),
          desc(studentAnalytics.coursesCompleted),
          desc(studentAnalytics.totalTimeInvestedMinutes)
        )
        .limit(limit);

      // Cache the result
      await cache.set(cacheKey, topPerformers, CacheTTL.ANALYTICS);

      return topPerformers;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find top performing students: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'select'
      );
    }
  }

  /**
   * Updates student analytics last updated timestamp
   * 
   * @param userId - User ID
   * @returns The updated student analytics
   * @throws NotFoundError if student analytics doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async updateLastUpdated(userId: string): Promise<StudentAnalytics> {
    try {
      const [updatedAnalytics] = await this.writeDb
        .update(studentAnalytics)
        .set({ lastUpdated: new Date() })
        .where(eq(studentAnalytics.userId, userId))
        .returning();

      if (!updatedAnalytics) {
        throw new NotFoundError(
          'Student analytics not found',
          'StudentAnalytics',
          userId
        );
      }

      // Invalidate cache
      await this.invalidateCache(userId);

      return updatedAnalytics;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        `Failed to update student analytics timestamp: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'update'
      );
    }
  }

  /**
   * Deletes student analytics record
   * 
   * @param userId - User ID
   * @returns void
   * @throws DatabaseError if database operation fails
   */
  async delete(userId: string): Promise<void> {
    try {
      await this.writeDb
        .delete(studentAnalytics)
        .where(eq(studentAnalytics.userId, userId));

      // Invalidate cache
      await this.invalidateCache(userId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete student analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'delete'
      );
    }
  }

  /**
   * Invalidates cache for student analytics
   * 
   * @param userId - User ID
   * @returns void
   */
  async invalidateCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.getStudentAnalyticsCacheKey(userId);
      await cache.delete(cacheKey);

      // Also invalidate list caches that might contain this student
      await cache.deletePattern(`${CachePrefix.ANALYTICS}:students:*`);
      await cache.deletePattern(`${CachePrefix.ANALYTICS}:top-performers:*`);
    } catch (error) {
      // Log cache invalidation errors but don't throw
      console.warn('Failed to invalidate student analytics cache:', error);
    }
  }
}