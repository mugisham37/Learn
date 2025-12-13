/**
 * Lesson Progress Repository Implementation
 *
 * Implements lesson progress data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 5.3, 5.4, 5.5
 */

import { eq, and, count, avg, sum, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  getWriteDb,
  getReadDb,
  withDrizzleTransaction,
} from '../../../../infrastructure/database/index.js';
import {
  lessonProgress,
  LessonProgress,
  NewLessonProgress,
} from '../../../../infrastructure/database/schema/enrollments.schema.js';
import {
  lessons,
  courseModules,
} from '../../../../infrastructure/database/schema/courses.schema.js';
import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { DatabaseError, ConflictError, NotFoundError } from '../../../../shared/errors/index.js';
import {
  ILessonProgressRepository,
  CreateLessonProgressDTO,
  UpdateLessonProgressDTO,
  ProgressSummaryDTO,
  ModuleProgressDTO,
} from './ILessonProgressRepository.js';

/**
 * Lesson Progress Repository Implementation
 *
 * Provides data access methods for lesson progress entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 */
export class LessonProgressRepository implements ILessonProgressRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for lesson progress by ID
   */
  private getLessonProgressCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'id', id);
  }

  /**
   * Builds cache key for lesson progress by enrollment and lesson
   */
  private getLessonProgressEnrollmentLessonCacheKey(
    enrollmentId: string,
    lessonId: string
  ): string {
    return buildCacheKey(
      CachePrefix.ENROLLMENT,
      'progress',
      'enrollment-lesson',
      enrollmentId,
      lessonId
    );
  }

  /**
   * Builds cache key for enrollment progress list
   */
  private getEnrollmentProgressCacheKey(enrollmentId: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'enrollment', enrollmentId);
  }

  /**
   * Builds cache key for lesson progress list
   */
  private getLessonProgressListCacheKey(lessonId: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'lesson', lessonId);
  }

  /**
   * Builds cache key for progress summary
   */
  private getProgressSummaryCacheKey(enrollmentId: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'summary', enrollmentId);
  }

  /**
   * Creates a new lesson progress record in the database
   *
   * Validates enrollment-lesson uniqueness before insertion.
   *
   * @param data - Lesson progress creation data
   * @returns The created lesson progress record
   * @throws ConflictError if progress record already exists for enrollment+lesson
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateLessonProgressDTO): Promise<LessonProgress> {
    try {
      // Check for existing progress record
      const existingProgress = await this.findByEnrollmentAndLesson(
        data.enrollmentId,
        data.lessonId
      );
      if (existingProgress) {
        throw new ConflictError(
          'Progress record already exists for this enrollment and lesson',
          'enrollmentId_lessonId'
        );
      }

      // Prepare lesson progress data for insertion
      const newLessonProgress: NewLessonProgress = {
        enrollmentId: data.enrollmentId,
        lessonId: data.lessonId,
        status: data.status || 'not_started',
        timeSpentSeconds: data.timeSpentSeconds || 0,
        quizScore: data.quizScore,
        attemptsCount: data.attemptsCount || 0,
      };

      // Insert lesson progress into database
      const [createdProgress] = await this.writeDb
        .insert(lessonProgress)
        .values(newLessonProgress)
        .returning();

      if (!createdProgress) {
        throw new DatabaseError('Failed to create lesson progress', 'insert');
      }

      return createdProgress;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ConflictError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError(
            'Progress record already exists for this enrollment and lesson',
            'enrollmentId_lessonId'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create lesson progress',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Creates multiple lesson progress records in a single transaction
   * Used when initializing progress for all lessons in a course upon enrollment
   *
   * @param progressRecords - Array of lesson progress creation data
   * @returns Array of created lesson progress records
   * @throws DatabaseError if database operation fails
   */
  async createMany(progressRecords: CreateLessonProgressDTO[]): Promise<LessonProgress[]> {
    try {
      if (progressRecords.length === 0) {
        return [];
      }

      // Use transaction to ensure all records are created or none
      const createdRecords = await withDrizzleTransaction(async (tx) => {
        const newProgressRecords: NewLessonProgress[] = progressRecords.map((data) => ({
          enrollmentId: data.enrollmentId,
          lessonId: data.lessonId,
          status: data.status || 'not_started',
          timeSpentSeconds: data.timeSpentSeconds || 0,
          quizScore: data.quizScore,
          attemptsCount: data.attemptsCount || 0,
        }));

        // Insert all records in a single query
        const results = await tx.insert(lessonProgress).values(newProgressRecords).returning();

        return results;
      });

      return createdRecords;
    } catch (error) {
      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError(
            'One or more progress records already exist',
            'enrollmentId_lessonId'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create lesson progress records',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a lesson progress record by its unique ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param id - Lesson progress ID
   * @returns The lesson progress record if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<LessonProgress | null> {
    try {
      // Check cache first
      const cacheKey = this.getLessonProgressCacheKey(id);
      const cachedProgress = await cache.get<LessonProgress>(cacheKey);

      if (cachedProgress) {
        return cachedProgress;
      }

      // Query database if not in cache
      const [progress] = await this.readDb
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.id, id))
        .limit(1);

      if (!progress) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, progress, CacheTTL.MEDIUM);

      return progress;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lesson progress by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a lesson progress record by enrollment and lesson IDs
   *
   * Implements caching with 5-minute TTL.
   *
   * @param enrollmentId - Enrollment ID
   * @param lessonId - Lesson ID
   * @returns The lesson progress record if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByEnrollmentAndLesson(
    enrollmentId: string,
    lessonId: string
  ): Promise<LessonProgress | null> {
    try {
      // Check cache first
      const cacheKey = this.getLessonProgressEnrollmentLessonCacheKey(enrollmentId, lessonId);
      const cachedProgress = await cache.get<LessonProgress>(cacheKey);

      if (cachedProgress) {
        return cachedProgress;
      }

      // Query database if not in cache
      const [progress] = await this.readDb
        .select()
        .from(lessonProgress)
        .where(
          and(eq(lessonProgress.enrollmentId, enrollmentId), eq(lessonProgress.lessonId, lessonId))
        )
        .limit(1);

      if (!progress) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both enrollment-lesson combination and ID for consistency
      await Promise.all([
        cache.set(cacheKey, progress, CacheTTL.MEDIUM),
        cache.set(this.getLessonProgressCacheKey(progress.id), progress, CacheTTL.MEDIUM),
      ]);

      return progress;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lesson progress by enrollment and lesson',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all lesson progress records for a specific enrollment
   *
   * Implements caching with 5-minute TTL.
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of lesson progress records
   * @throws DatabaseError if database operation fails
   */
  async findByEnrollment(enrollmentId: string): Promise<LessonProgress[]> {
    try {
      // Check cache first
      const cacheKey = this.getEnrollmentProgressCacheKey(enrollmentId);
      const cachedProgress = await cache.get<LessonProgress[]>(cacheKey);

      if (cachedProgress) {
        return cachedProgress;
      }

      // Query database if not in cache
      const progressRecords = await this.readDb
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.enrollmentId, enrollmentId))
        .orderBy(lessonProgress.createdAt);

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, progressRecords, CacheTTL.MEDIUM);

      return progressRecords;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lesson progress by enrollment',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all lesson progress records for a specific lesson across all enrollments
   *
   * Implements caching with 5-minute TTL.
   *
   * @param lessonId - Lesson ID
   * @returns Array of lesson progress records
   * @throws DatabaseError if database operation fails
   */
  async findByLesson(lessonId: string): Promise<LessonProgress[]> {
    try {
      // Check cache first
      const cacheKey = this.getLessonProgressListCacheKey(lessonId);
      const cachedProgress = await cache.get<LessonProgress[]>(cacheKey);

      if (cachedProgress) {
        return cachedProgress;
      }

      // Query database if not in cache
      const progressRecords = await this.readDb
        .select()
        .from(lessonProgress)
        .where(eq(lessonProgress.lessonId, lessonId))
        .orderBy(lessonProgress.createdAt);

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, progressRecords, CacheTTL.MEDIUM);

      return progressRecords;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lesson progress by lesson',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a lesson progress record's data
   *
   * Invalidates all related cache entries after successful update.
   *
   * @param id - Lesson progress ID
   * @param data - Update data
   * @returns The updated lesson progress record
   * @throws NotFoundError if lesson progress record doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateLessonProgressDTO): Promise<LessonProgress> {
    try {
      // First, verify progress record exists
      const existingProgress = await this.findById(id);
      if (!existingProgress) {
        throw new NotFoundError('Lesson Progress', id);
      }

      // Prepare update data
      const updateData: Partial<NewLessonProgress> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update lesson progress in database
      const [updatedProgress] = await this.writeDb
        .update(lessonProgress)
        .set(updateData)
        .where(eq(lessonProgress.id, id))
        .returning();

      if (!updatedProgress) {
        throw new DatabaseError('Failed to update lesson progress', 'update');
      }

      // Invalidate all cache entries for this progress record
      await this.invalidateCache(id);
      await this.invalidateCacheByEnrollment(existingProgress.enrollmentId);
      await this.invalidateCacheByLesson(existingProgress.lessonId);

      return updatedProgress;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update lesson progress',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates lesson progress by enrollment and lesson IDs
   * More convenient than finding the ID first
   *
   * @param enrollmentId - Enrollment ID
   * @param lessonId - Lesson ID
   * @param data - Update data
   * @returns The updated lesson progress record
   * @throws NotFoundError if lesson progress record doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async updateByEnrollmentAndLesson(
    enrollmentId: string,
    lessonId: string,
    data: UpdateLessonProgressDTO
  ): Promise<LessonProgress> {
    try {
      // First, verify progress record exists
      const existingProgress = await this.findByEnrollmentAndLesson(enrollmentId, lessonId);
      if (!existingProgress) {
        throw new NotFoundError('Lesson Progress', `${enrollmentId}-${lessonId}`);
      }

      // Use the update method with the found ID
      return await this.update(existingProgress.id, data);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update lesson progress by enrollment and lesson',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a lesson progress record from the database
   *
   * Invalidates all cache entries after successful deletion.
   *
   * @param id - Lesson progress ID
   * @returns void
   * @throws NotFoundError if lesson progress record doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get progress record before deletion for cache invalidation
      const existingProgress = await this.findById(id);
      if (!existingProgress) {
        throw new NotFoundError('Lesson Progress', id);
      }

      // Delete lesson progress record
      const result = await this.writeDb
        .delete(lessonProgress)
        .where(eq(lessonProgress.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to delete lesson progress', 'delete');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByEnrollment(existingProgress.enrollmentId);
      await this.invalidateCacheByLesson(existingProgress.lessonId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete lesson progress',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets progress summary for an enrollment
   * Calculates completion statistics and percentages
   *
   * @param enrollmentId - Enrollment ID
   * @returns Progress summary with statistics
   * @throws DatabaseError if database operation fails
   */
  async getProgressSummary(enrollmentId: string): Promise<ProgressSummaryDTO> {
    try {
      // Check cache first
      const cacheKey = this.getProgressSummaryCacheKey(enrollmentId);
      const cachedSummary = await cache.get<ProgressSummaryDTO>(cacheKey);

      if (cachedSummary) {
        return cachedSummary;
      }

      // Query database for progress statistics
      const [stats] = await this.readDb
        .select({
          totalLessons: count(),
          completedLessons: count(sql`CASE WHEN ${lessonProgress.status} = 'completed' THEN 1 END`),
          inProgressLessons: count(
            sql`CASE WHEN ${lessonProgress.status} = 'in_progress' THEN 1 END`
          ),
          notStartedLessons: count(
            sql`CASE WHEN ${lessonProgress.status} = 'not_started' THEN 1 END`
          ),
          totalTimeSpentSeconds: sum(lessonProgress.timeSpentSeconds),
          averageQuizScore: avg(lessonProgress.quizScore),
        })
        .from(lessonProgress)
        .where(eq(lessonProgress.enrollmentId, enrollmentId));

      if (!stats) {
        throw new DatabaseError('Failed to calculate progress summary', 'select');
      }

      // Calculate progress percentage
      const progressPercentage =
        stats.totalLessons > 0
          ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
          : 0;

      const summary: ProgressSummaryDTO = {
        enrollmentId,
        totalLessons: stats.totalLessons,
        completedLessons: stats.completedLessons,
        inProgressLessons: stats.inProgressLessons,
        notStartedLessons: stats.notStartedLessons,
        progressPercentage,
        totalTimeSpentSeconds: stats.totalTimeSpentSeconds || 0,
        averageQuizScore: stats.averageQuizScore
          ? Math.round(stats.averageQuizScore * 100) / 100
          : undefined,
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, summary, CacheTTL.MEDIUM);

      return summary;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get progress summary',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets progress summary for all modules in an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of module progress summaries
   * @throws DatabaseError if database operation fails
   */
  async getModuleProgress(enrollmentId: string): Promise<ModuleProgressDTO[]> {
    try {
      // This is a complex query that joins lesson progress with lessons and modules
      const moduleStats = await this.readDb
        .select({
          moduleId: courseModules.id,
          totalLessons: count(),
          completedLessons: count(sql`CASE WHEN ${lessonProgress.status} = 'completed' THEN 1 END`),
        })
        .from(lessonProgress)
        .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(eq(lessonProgress.enrollmentId, enrollmentId))
        .groupBy(courseModules.id)
        .orderBy(courseModules.orderNumber);

      // Calculate progress percentages and completion status
      const moduleProgress: ModuleProgressDTO[] = moduleStats.map((stats) => {
        const progressPercentage =
          stats.totalLessons > 0
            ? Math.round((stats.completedLessons / stats.totalLessons) * 100)
            : 0;

        return {
          moduleId: stats.moduleId,
          totalLessons: stats.totalLessons,
          completedLessons: stats.completedLessons,
          progressPercentage,
          isCompleted: stats.completedLessons === stats.totalLessons && stats.totalLessons > 0,
        };
      });

      return moduleProgress;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get module progress',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds completed lesson progress records for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of completed lesson progress records
   * @throws DatabaseError if database operation fails
   */
  async findCompletedByEnrollment(enrollmentId: string): Promise<LessonProgress[]> {
    try {
      const completedProgress = await this.readDb
        .select()
        .from(lessonProgress)
        .where(
          and(eq(lessonProgress.enrollmentId, enrollmentId), eq(lessonProgress.status, 'completed'))
        )
        .orderBy(lessonProgress.completedAt);

      return completedProgress;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find completed lesson progress',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds in-progress lesson progress records for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of in-progress lesson progress records
   * @throws DatabaseError if database operation fails
   */
  async findInProgressByEnrollment(enrollmentId: string): Promise<LessonProgress[]> {
    try {
      const inProgressRecords = await this.readDb
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollmentId),
            eq(lessonProgress.status, 'in_progress')
          )
        )
        .orderBy(lessonProgress.lastAccessedAt);

      return inProgressRecords;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find in-progress lesson progress',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if all lessons in a course are completed for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns True if all lessons are completed, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async areAllLessonsCompleted(enrollmentId: string): Promise<boolean> {
    try {
      const [stats] = await this.readDb
        .select({
          totalLessons: count(),
          completedLessons: count(sql`CASE WHEN ${lessonProgress.status} = 'completed' THEN 1 END`),
        })
        .from(lessonProgress)
        .where(eq(lessonProgress.enrollmentId, enrollmentId));

      if (!stats || stats.totalLessons === 0) {
        return false;
      }

      return stats.completedLessons === stats.totalLessons;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check if all lessons are completed',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the next lesson that should be accessed based on progress
   * Returns the first not-started or in-progress lesson
   *
   * @param enrollmentId - Enrollment ID
   * @returns The next lesson progress record, null if all completed
   * @throws DatabaseError if database operation fails
   */
  async getNextLesson(enrollmentId: string): Promise<LessonProgress | null> {
    try {
      // First try to find an in-progress lesson
      const [inProgressLesson] = await this.readDb
        .select()
        .from(lessonProgress)
        .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollmentId),
            eq(lessonProgress.status, 'in_progress')
          )
        )
        .orderBy(courseModules.orderNumber, lessons.orderNumber)
        .limit(1);

      if (inProgressLesson) {
        return inProgressLesson.lesson_progress;
      }

      // If no in-progress lesson, find the first not-started lesson
      const [notStartedLesson] = await this.readDb
        .select()
        .from(lessonProgress)
        .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(
          and(
            eq(lessonProgress.enrollmentId, enrollmentId),
            eq(lessonProgress.status, 'not_started')
          )
        )
        .orderBy(courseModules.orderNumber, lessons.orderNumber)
        .limit(1);

      return notStartedLesson ? notStartedLesson.lesson_progress : null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get next lesson',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific lesson progress record
   *
   * Removes all cache entries related to the progress record by ID.
   * Should be called after any update operation.
   *
   * @param id - Lesson progress ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getLessonProgressCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for lesson progress ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for lesson progress by enrollment
   *
   * Removes all cache entries related to the enrollment's progress.
   * Should be called after operations that affect enrollment progress.
   *
   * @param enrollmentId - Enrollment ID
   * @returns void
   */
  async invalidateCacheByEnrollment(enrollmentId: string): Promise<void> {
    try {
      const patterns = [
        buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'enrollment', enrollmentId),
        buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'summary', enrollmentId),
        buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'enrollment-lesson', enrollmentId, '*'),
      ];

      await Promise.all(patterns.map((pattern) => cache.deletePattern(pattern)));
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for enrollment progress ${enrollmentId}:`, error);
    }
  }

  /**
   * Invalidates cache for lesson progress by lesson
   *
   * Removes all cache entries related to the lesson's progress across enrollments.
   * Should be called after operations that affect lesson progress across enrollments.
   *
   * @param lessonId - Lesson ID
   * @returns void
   */
  async invalidateCacheByLesson(lessonId: string): Promise<void> {
    try {
      const patterns = [
        buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'lesson', lessonId),
        buildCacheKey(CachePrefix.ENROLLMENT, 'progress', 'enrollment-lesson', '*', lessonId),
      ];

      await Promise.all(patterns.map((pattern) => cache.deletePattern(pattern)));
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for lesson progress ${lessonId}:`, error);
    }
  }
}
