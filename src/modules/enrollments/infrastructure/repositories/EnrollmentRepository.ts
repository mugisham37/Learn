/**
 * Enrollment Repository Implementation
 *
 * Implements enrollment data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 5.1, 5.3, 5.6
 */

import { eq, and, desc, asc, count, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  enrollments,
  Enrollment,
  NewEnrollment,
} from '../../../../infrastructure/database/schema/enrollments.schema.js';
import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { DatabaseError, ConflictError, NotFoundError } from '../../../../shared/errors/index.js';
import {
  IEnrollmentRepository,
  CreateEnrollmentDTO,
  UpdateEnrollmentDTO,
  EnrollmentPaginationDTO,
  PaginatedEnrollmentResult,
  EnrollmentFilterDTO,
} from './IEnrollmentRepository.js';

/**
 * Enrollment Repository Implementation
 *
 * Provides data access methods for enrollment entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 */
export class EnrollmentRepository implements IEnrollmentRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for enrollment by ID
   */
  private getEnrollmentCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'id', id);
  }

  /**
   * Builds cache key for enrollment by student and course
   */
  private getEnrollmentStudentCourseCacheKey(studentId: string, courseId: string): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'student-course', studentId, courseId);
  }

  /**
   * Builds cache key for student enrollments list
   */
  private getStudentEnrollmentsCacheKey(studentId: string, filters?: string): string {
    const filterKey = filters || 'all';
    return buildCacheKey(CachePrefix.ENROLLMENT, 'student', studentId, filterKey);
  }

  /**
   * Builds cache key for course enrollments list
   */
  private getCourseEnrollmentsCacheKey(courseId: string, filters?: string): string {
    const filterKey = filters || 'all';
    return buildCacheKey(CachePrefix.ENROLLMENT, 'course', courseId, filterKey);
  }

  /**
   * Builds cache key for enrollment counts
   */
  private getEnrollmentCountCacheKey(courseId: string, type: 'active' | 'completed'): string {
    return buildCacheKey(CachePrefix.ENROLLMENT, 'count', courseId, type);
  }

  /**
   * Serializes filter object to string for cache key
   */
  private serializeFilters(filters?: EnrollmentFilterDTO): string {
    if (!filters) return 'all';

    const parts: string[] = [];
    if (filters.status) parts.push(`status:${filters.status}`);
    if (filters.courseId) parts.push(`course:${filters.courseId}`);
    if (filters.studentId) parts.push(`student:${filters.studentId}`);
    if (filters.completedAfter) parts.push(`after:${filters.completedAfter.toISOString()}`);
    if (filters.completedBefore) parts.push(`before:${filters.completedBefore.toISOString()}`);

    return parts.length > 0 ? parts.join('|') : 'all';
  }

  /**
   * Builds WHERE conditions from filters
   */
  private buildWhereConditions(filters?: EnrollmentFilterDTO) {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(enrollments.status, filters.status));
    }

    if (filters?.courseId) {
      conditions.push(eq(enrollments.courseId, filters.courseId));
    }

    if (filters?.studentId) {
      conditions.push(eq(enrollments.studentId, filters.studentId));
    }

    if (filters?.completedAfter) {
      conditions.push(sql`${enrollments.completedAt} >= ${filters.completedAfter}`);
    }

    if (filters?.completedBefore) {
      conditions.push(sql`${enrollments.completedAt} <= ${filters.completedBefore}`);
    }

    return conditions;
  }

  /**
   * Creates a new enrollment in the database
   *
   * Validates student-course uniqueness before insertion.
   * Does not cache on creation as the enrollment will be fetched immediately after.
   *
   * @param data - Enrollment creation data
   * @returns The created enrollment
   * @throws ConflictError if student is already enrolled in the course
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateEnrollmentDTO): Promise<Enrollment> {
    try {
      // Check for existing enrollment
      const existingEnrollment = await this.findByStudentAndCourse(data.studentId, data.courseId);
      if (existingEnrollment) {
        throw new ConflictError('Student is already enrolled in this course', 'studentId_courseId');
      }

      // Prepare enrollment data for insertion
      const newEnrollment: NewEnrollment = {
        studentId: data.studentId,
        courseId: data.courseId,
        paymentId: data.paymentId,
        status: data.status || 'active',
        progressPercentage: '0',
      };

      // Insert enrollment into database
      const [createdEnrollment] = await this.writeDb
        .insert(enrollments)
        .values(newEnrollment)
        .returning();

      if (!createdEnrollment) {
        throw new DatabaseError('Failed to create enrollment', 'insert');
      }

      return createdEnrollment;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ConflictError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError(
            'Student is already enrolled in this course',
            'studentId_courseId'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create enrollment',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds an enrollment by its unique ID
   *
   * Implements caching with 5-minute TTL.
   * Uses read database for query optimization.
   *
   * @param id - Enrollment ID
   * @returns The enrollment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Enrollment | null> {
    try {
      // Check cache first
      const cacheKey = this.getEnrollmentCacheKey(id);
      const cachedEnrollment = await cache.get<Enrollment>(cacheKey);

      if (cachedEnrollment) {
        return cachedEnrollment;
      }

      // Query database if not in cache
      const [enrollment] = await this.readDb
        .select()
        .from(enrollments)
        .where(eq(enrollments.id, id))
        .limit(1);

      if (!enrollment) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, enrollment, CacheTTL.MEDIUM);

      return enrollment;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find enrollment by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds an enrollment by student and course IDs
   *
   * Implements caching with 5-minute TTL.
   *
   * @param studentId - Student ID
   * @param courseId - Course ID
   * @returns The enrollment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByStudentAndCourse(studentId: string, courseId: string): Promise<Enrollment | null> {
    try {
      // Check cache first
      const cacheKey = this.getEnrollmentStudentCourseCacheKey(studentId, courseId);
      const cachedEnrollment = await cache.get<Enrollment>(cacheKey);

      if (cachedEnrollment) {
        return cachedEnrollment;
      }

      // Query database if not in cache
      const [enrollment] = await this.readDb
        .select()
        .from(enrollments)
        .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
        .limit(1);

      if (!enrollment) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both student-course combination and ID for consistency
      await Promise.all([
        cache.set(cacheKey, enrollment, CacheTTL.MEDIUM),
        cache.set(this.getEnrollmentCacheKey(enrollment.id), enrollment, CacheTTL.MEDIUM),
      ]);

      return enrollment;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find enrollment by student and course',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all enrollments for a specific student
   *
   * Implements caching with 5-minute TTL for first page results.
   *
   * @param studentId - Student ID
   * @param filters - Optional filters
   * @param pagination - Pagination parameters
   * @returns Paginated list of enrollments
   * @throws DatabaseError if database operation fails
   */
  async findByStudent(
    studentId: string,
    filters?: EnrollmentFilterDTO,
    pagination?: EnrollmentPaginationDTO
  ): Promise<PaginatedEnrollmentResult> {
    try {
      const limit = pagination?.limit || 20;
      const offset = pagination?.offset || 0;

      // Only cache first page results
      const shouldCache = offset === 0 && limit <= 20;
      let cacheKey: string | null = null;

      if (shouldCache) {
        const filterKey = this.serializeFilters(filters);
        cacheKey = this.getStudentEnrollmentsCacheKey(studentId, filterKey);

        const cachedResult = await cache.get<PaginatedEnrollmentResult>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Build WHERE conditions
      const conditions = [
        eq(enrollments.studentId, studentId),
        ...this.buildWhereConditions(filters),
      ];

      // Get total count
      const [{ totalCount }] = await this.readDb
        .select({ totalCount: count() })
        .from(enrollments)
        .where(and(...conditions));

      // Get enrollments with pagination
      const enrollmentList = await this.readDb
        .select()
        .from(enrollments)
        .where(and(...conditions))
        .orderBy(desc(enrollments.enrolledAt))
        .limit(limit)
        .offset(offset);

      const result: PaginatedEnrollmentResult = {
        enrollments: enrollmentList,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      };

      // Cache first page results
      if (shouldCache && cacheKey) {
        await cache.set(cacheKey, result, CacheTTL.MEDIUM);
      }

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find enrollments by student',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all enrollments for a specific course
   *
   * Implements caching with 5-minute TTL for first page results.
   *
   * @param courseId - Course ID
   * @param filters - Optional filters
   * @param pagination - Pagination parameters
   * @returns Paginated list of enrollments
   * @throws DatabaseError if database operation fails
   */
  async findByCourse(
    courseId: string,
    filters?: EnrollmentFilterDTO,
    pagination?: EnrollmentPaginationDTO
  ): Promise<PaginatedEnrollmentResult> {
    try {
      const limit = pagination?.limit || 20;
      const offset = pagination?.offset || 0;

      // Only cache first page results
      const shouldCache = offset === 0 && limit <= 20;
      let cacheKey: string | null = null;

      if (shouldCache) {
        const filterKey = this.serializeFilters(filters);
        cacheKey = this.getCourseEnrollmentsCacheKey(courseId, filterKey);

        const cachedResult = await cache.get<PaginatedEnrollmentResult>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Build WHERE conditions
      const conditions = [
        eq(enrollments.courseId, courseId),
        ...this.buildWhereConditions(filters),
      ];

      // Get total count
      const [{ totalCount }] = await this.readDb
        .select({ totalCount: count() })
        .from(enrollments)
        .where(and(...conditions));

      // Get enrollments with pagination
      const enrollmentList = await this.readDb
        .select()
        .from(enrollments)
        .where(and(...conditions))
        .orderBy(desc(enrollments.enrolledAt))
        .limit(limit)
        .offset(offset);

      const result: PaginatedEnrollmentResult = {
        enrollments: enrollmentList,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      };

      // Cache first page results
      if (shouldCache && cacheKey) {
        await cache.set(cacheKey, result, CacheTTL.MEDIUM);
      }

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find enrollments by course',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates an enrollment's data
   *
   * Invalidates all related cache entries after successful update.
   *
   * @param id - Enrollment ID
   * @param data - Update data
   * @returns The updated enrollment
   * @throws NotFoundError if enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateEnrollmentDTO): Promise<Enrollment> {
    try {
      // First, verify enrollment exists
      const existingEnrollment = await this.findById(id);
      if (!existingEnrollment) {
        throw new NotFoundError('Enrollment', id);
      }

      // Prepare update data
      const updateData: Partial<NewEnrollment> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update enrollment in database
      const [updatedEnrollment] = await this.writeDb
        .update(enrollments)
        .set(updateData)
        .where(eq(enrollments.id, id))
        .returning();

      if (!updatedEnrollment) {
        throw new DatabaseError('Failed to update enrollment', 'update');
      }

      // Invalidate all cache entries for this enrollment
      await this.invalidateCache(id);
      await this.invalidateCacheByStudent(existingEnrollment.studentId);
      await this.invalidateCacheByCourse(existingEnrollment.courseId);

      return updatedEnrollment;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update enrollment',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Soft deletes an enrollment (sets status to 'dropped')
   *
   * Invalidates all cache entries after successful deletion.
   *
   * @param id - Enrollment ID
   * @returns void
   * @throws NotFoundError if enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async softDelete(id: string): Promise<void> {
    try {
      // Verify enrollment exists
      const existingEnrollment = await this.findById(id);
      if (!existingEnrollment) {
        throw new NotFoundError('Enrollment', id);
      }

      // Set status to dropped
      const [deletedEnrollment] = await this.writeDb
        .update(enrollments)
        .set({
          status: 'dropped',
          updatedAt: new Date(),
        })
        .where(eq(enrollments.id, id))
        .returning();

      if (!deletedEnrollment) {
        throw new DatabaseError('Failed to soft delete enrollment', 'update');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByStudent(existingEnrollment.studentId);
      await this.invalidateCacheByCourse(existingEnrollment.courseId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to soft delete enrollment',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Permanently deletes an enrollment from the database
   * USE WITH CAUTION - This is irreversible
   *
   * Invalidates all cache entries after successful deletion.
   *
   * @param id - Enrollment ID
   * @returns void
   * @throws NotFoundError if enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async hardDelete(id: string): Promise<void> {
    try {
      // Get enrollment before deletion for cache invalidation
      const existingEnrollment = await this.findById(id);
      if (!existingEnrollment) {
        throw new NotFoundError('Enrollment', id);
      }

      // Permanently delete enrollment
      const result = await this.writeDb
        .delete(enrollments)
        .where(eq(enrollments.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to hard delete enrollment', 'delete');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByStudent(existingEnrollment.studentId);
      await this.invalidateCacheByCourse(existingEnrollment.courseId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to hard delete enrollment',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a student is already enrolled in a course
   *
   * More efficient than findByStudentAndCourse when only existence check is needed.
   *
   * @param studentId - Student ID
   * @param courseId - Course ID
   * @returns True if enrollment exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async existsByStudentAndCourse(studentId: string, courseId: string): Promise<boolean> {
    try {
      // Try to find enrollment by student and course
      const enrollment = await this.findByStudentAndCourse(studentId, courseId);

      return enrollment !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check enrollment existence by student and course',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the count of active enrollments for a course
   *
   * Implements caching with 5-minute TTL.
   *
   * @param courseId - Course ID
   * @returns Number of active enrollments
   * @throws DatabaseError if database operation fails
   */
  async getActiveEnrollmentCount(courseId: string): Promise<number> {
    try {
      // Check cache first
      const cacheKey = this.getEnrollmentCountCacheKey(courseId, 'active');
      const cachedCount = await cache.get<number>(cacheKey);

      if (cachedCount !== null) {
        return cachedCount;
      }

      // Query database if not in cache
      const [{ activeCount }] = await this.readDb
        .select({ activeCount: count() })
        .from(enrollments)
        .where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, 'active')));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, activeCount, CacheTTL.MEDIUM);

      return activeCount;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get active enrollment count',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the count of completed enrollments for a course
   *
   * Implements caching with 5-minute TTL.
   *
   * @param courseId - Course ID
   * @returns Number of completed enrollments
   * @throws DatabaseError if database operation fails
   */
  async getCompletedEnrollmentCount(courseId: string): Promise<number> {
    try {
      // Check cache first
      const cacheKey = this.getEnrollmentCountCacheKey(courseId, 'completed');
      const cachedCount = await cache.get<number>(cacheKey);

      if (cachedCount !== null) {
        return cachedCount;
      }

      // Query database if not in cache
      const [{ completedCount }] = await this.readDb
        .select({ completedCount: count() })
        .from(enrollments)
        .where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, 'completed')));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, completedCount, CacheTTL.MEDIUM);

      return completedCount;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get completed enrollment count',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds enrollments that are eligible for completion
   * (all lessons completed but enrollment not marked as completed)
   *
   * This is a complex query that would typically involve joining with lesson progress.
   * For now, returns enrollments with 100% progress that aren't completed.
   *
   * @param limit - Maximum number of enrollments to return
   * @returns List of enrollments eligible for completion
   * @throws DatabaseError if database operation fails
   */
  async findEligibleForCompletion(limit: number = 50): Promise<Enrollment[]> {
    try {
      // Find enrollments with 100% progress that aren't completed
      const eligibleEnrollments = await this.readDb
        .select()
        .from(enrollments)
        .where(and(eq(enrollments.progressPercentage, '100.00'), eq(enrollments.status, 'active')))
        .orderBy(asc(enrollments.updatedAt))
        .limit(limit);

      return eligibleEnrollments;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find enrollments eligible for completion',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific enrollment
   *
   * Removes all cache entries related to the enrollment by ID.
   * Should be called after any update operation.
   *
   * @param id - Enrollment ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getEnrollmentCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for enrollment ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for enrollments by student
   *
   * Removes all cache entries related to the student's enrollments.
   * Should be called after operations that affect student's enrollments.
   *
   * @param studentId - Student ID
   * @returns void
   */
  async invalidateCacheByStudent(studentId: string): Promise<void> {
    try {
      const pattern = buildCacheKey(CachePrefix.ENROLLMENT, 'student', studentId, '*');
      await cache.deletePattern(pattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for student enrollments ${studentId}:`, error);
    }
  }

  /**
   * Invalidates cache for enrollments by course
   *
   * Removes all cache entries related to the course's enrollments.
   * Should be called after operations that affect course enrollments.
   *
   * @param courseId - Course ID
   * @returns void
   */
  async invalidateCacheByCourse(courseId: string): Promise<void> {
    try {
      const patterns = [
        buildCacheKey(CachePrefix.ENROLLMENT, 'course', courseId, '*'),
        buildCacheKey(CachePrefix.ENROLLMENT, 'count', courseId, '*'),
      ];

      await Promise.all(patterns.map((pattern) => cache.deletePattern(pattern)));
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for course enrollments ${courseId}:`, error);
    }
  }
}
