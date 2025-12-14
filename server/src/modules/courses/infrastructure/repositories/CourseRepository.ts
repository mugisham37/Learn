/**
 * Course Repository Implementation
 *
 * Implements course data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 3.1, 3.6
 */

import { eq, and, desc, count, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  courses,
  Course,
  NewCourse,
} from '../../../../infrastructure/database/schema/courses.schema.js';
import {
  DatabaseError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';

import {
  ICourseRepository,
  CreateCourseDTO,
  UpdateCourseDTO,
  PaginationParams,
  PaginatedResult,
  CourseFilters,
} from './ICourseRepository.js';

/**
 * Utility function to generate URL slug from title
 * Converts title to lowercase, replaces spaces with hyphens, removes special characters
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Utility function to ensure unique slug
 * Appends number suffix if slug already exists
 */
async function ensureUniqueSlug(
  db: NodePgDatabase,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const whereConditions = excludeId
      ? and(eq(courses.slug, slug), sql`${courses.id} != ${excludeId}`)
      : eq(courses.slug, slug);

    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(whereConditions)
      .limit(1);

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    // Safety mechanism to prevent infinite loops
    if (counter > 10000) {
      throw new Error('Unable to generate unique slug after 10000 attempts');
    }
  }
}

/**
 * Course Repository Implementation
 *
 * Provides data access methods for course entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Slug generation and uniqueness validation
 */
export class CourseRepository implements ICourseRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for course by ID
   */
  private getCourseCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.COURSE, 'id', id);
  }

  /**
   * Builds cache key for course by slug
   */
  private getCourseSlugCacheKey(slug: string): string {
    return buildCacheKey(CachePrefix.COURSE, 'slug', slug);
  }

  /**
   * Builds cache key for instructor courses list
   */
  private getInstructorCoursesCacheKey(
    instructorId: string,
    page: number,
    limit: number,
    filters?: CourseFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.COURSE, 'instructor', instructorId, page, limit, filterKey);
  }

  /**
   * Builds cache key for published courses list
   */
  private getPublishedCoursesCacheKey(
    page: number,
    limit: number,
    filters?: CourseFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.COURSE, 'published', page, limit, filterKey);
  }

  /**
   * Creates a new course in the database
   *
   * Generates unique slug from title and validates instructor exists.
   * Does not cache on creation as the course will be fetched immediately after.
   *
   * @param data - Course creation data
   * @returns The created course
   * @throws ConflictError if slug generation fails
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateCourseDTO): Promise<Course> {
    try {
      // Generate unique slug from title
      const baseSlug = generateSlug(data.title);
      const uniqueSlug = await ensureUniqueSlug(this.writeDb, baseSlug);

      // Prepare course data for insertion
      const newCourse: NewCourse = {
        instructorId: data.instructorId,
        title: data.title,
        description: data.description,
        slug: uniqueSlug,
        category: data.category,
        difficulty: data.difficulty,
        price: data.price || '0',
        currency: data.currency || 'USD',
        enrollmentLimit: data.enrollmentLimit,
        thumbnailUrl: data.thumbnailUrl,
        status: 'draft',
      };

      // Insert course into database
      const [createdCourse] = await this.writeDb.insert(courses).values(newCourse).returning();

      if (!createdCourse) {
        throw new DatabaseError('Failed to create course', 'insert');
      }

      // Invalidate instructor courses cache
      await this.invalidateCacheByInstructor(data.instructorId);

      return createdCourse;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ConflictError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError('A course with this slug already exists', 'slug');
        }
        if (error.message.includes('foreign key') || error.message.includes('instructor')) {
          throw new ValidationError('Invalid instructor ID', [
            { field: 'instructorId', message: 'Instructor does not exist' },
          ]);
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create course',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a course by its unique ID
   *
   * Implements caching with 5-minute TTL.
   * Uses read database for query optimization.
   *
   * @param id - Course ID
   * @returns The course if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Course | null> {
    try {
      // Check cache first
      const cacheKey = this.getCourseCacheKey(id);
      const cachedCourse = await cache.get<Course>(cacheKey);

      if (cachedCourse) {
        return cachedCourse;
      }

      // Query database if not in cache
      const [course] = await this.readDb.select().from(courses).where(eq(courses.id, id)).limit(1);

      if (!course) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, course, CacheTTL.MEDIUM);

      return course;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find course by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a course by its URL slug
   *
   * Implements caching with 5-minute TTL.
   *
   * @param slug - Course slug
   * @returns The course if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findBySlug(slug: string): Promise<Course | null> {
    try {
      // Check cache first
      const cacheKey = this.getCourseSlugCacheKey(slug);
      const cachedCourse = await cache.get<Course>(cacheKey);

      if (cachedCourse) {
        return cachedCourse;
      }

      // Query database if not in cache
      const [course] = await this.readDb
        .select()
        .from(courses)
        .where(eq(courses.slug, slug))
        .limit(1);

      if (!course) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both slug and ID for consistency
      await Promise.all([
        cache.set(cacheKey, course, CacheTTL.MEDIUM),
        cache.set(this.getCourseCacheKey(course.id), course, CacheTTL.MEDIUM),
      ]);

      return course;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find course by slug',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds courses by instructor with pagination
   *
   * Implements caching with 5-minute TTL for paginated results.
   * Supports filtering by status, category, and difficulty.
   *
   * @param instructorId - Instructor user ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated course results
   * @throws DatabaseError if database operation fails
   */
  async findByInstructor(
    instructorId: string,
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>> {
    try {
      // Check cache first
      const cacheKey = this.getInstructorCoursesCacheKey(
        instructorId,
        pagination.page,
        pagination.limit,
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<Course>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(courses.instructorId, instructorId)];

      if (filters?.status) {
        whereConditions.push(eq(courses.status, filters.status));
      }
      if (filters?.category) {
        whereConditions.push(eq(courses.category, filters.category));
      }
      if (filters?.difficulty) {
        whereConditions.push(eq(courses.difficulty, filters.difficulty));
      }

      const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(courses)
        .where(whereClause);

      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const coursesData = await this.readDb
        .select()
        .from(courses)
        .where(whereClause)
        .orderBy(desc(courses.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Course> = {
        data: coursesData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, result, CacheTTL.MEDIUM);

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find courses by instructor',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds published courses with pagination and filtering
   *
   * Implements caching with 5-minute TTL for paginated results.
   * Only returns courses with 'published' status.
   *
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated course results
   * @throws DatabaseError if database operation fails
   */
  async findPublished(
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>> {
    try {
      // Check cache first
      const cacheKey = this.getPublishedCoursesCacheKey(pagination.page, pagination.limit, filters);
      const cachedResult = await cache.get<PaginatedResult<Course>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions (always include published status)
      const whereConditions = [eq(courses.status, 'published')];

      if (filters?.category) {
        whereConditions.push(eq(courses.category, filters.category));
      }
      if (filters?.difficulty) {
        whereConditions.push(eq(courses.difficulty, filters.difficulty));
      }
      if (filters?.instructorId) {
        whereConditions.push(eq(courses.instructorId, filters.instructorId));
      }

      const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(courses)
        .where(whereClause);

      const total = totalResult?.total || 0;

      // Get paginated results ordered by rating and enrollment
      const offset = (pagination.page - 1) * pagination.limit;
      const coursesData = await this.readDb
        .select()
        .from(courses)
        .where(whereClause)
        .orderBy(
          desc(courses.averageRating),
          desc(courses.enrollmentCount),
          desc(courses.publishedAt)
        )
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Course> = {
        data: coursesData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, result, CacheTTL.MEDIUM);

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find published courses',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a course's data
   *
   * Invalidates all related cache entries after successful update.
   * Regenerates slug if title is changed.
   *
   * @param id - Course ID
   * @param data - Update data
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws ConflictError if slug update conflicts with existing course
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateCourseDTO): Promise<Course> {
    try {
      // First, verify course exists
      const existingCourse = await this.findById(id);
      if (!existingCourse) {
        throw new NotFoundError('Course', id);
      }

      // Prepare update data
      const updateData: Partial<NewCourse> = {
        ...data,
        updatedAt: new Date(),
      };

      // If title is being updated, regenerate slug
      if (data.title && data.title !== existingCourse.title) {
        const baseSlug = generateSlug(data.title);
        updateData.slug = await ensureUniqueSlug(this.writeDb, baseSlug, id);
      }

      // Update course in database
      const [updatedCourse] = await this.writeDb
        .update(courses)
        .set(updateData)
        .where(eq(courses.id, id))
        .returning();

      if (!updatedCourse) {
        throw new DatabaseError('Failed to update course', 'update');
      }

      // Invalidate all cache entries for this course
      await this.invalidateCache(id);
      if (existingCourse.slug) {
        await this.invalidateCacheBySlug(existingCourse.slug);
      }
      if (updatedCourse.slug && updatedCourse.slug !== existingCourse.slug) {
        await this.invalidateCacheBySlug(updatedCourse.slug);
      }
      await this.invalidateCacheByInstructor(existingCourse.instructorId);

      return updatedCourse;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError('A course with this slug already exists', 'slug');
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update course',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Publishes a course by updating status and setting publishedAt
   *
   * @param id - Course ID
   * @returns The published course
   * @throws NotFoundError if course doesn't exist
   * @throws ValidationError if course doesn't meet publication requirements
   * @throws DatabaseError if database operation fails
   */
  async publish(id: string): Promise<Course> {
    try {
      // Verify course exists and is in draft status
      const existingCourse = await this.findById(id);
      if (!existingCourse) {
        throw new NotFoundError('Course', id);
      }

      if (existingCourse.status === 'published') {
        return existingCourse; // Already published
      }

      // TODO: Add publication validation (minimum modules, processed videos, etc.)
      // This would be implemented in the service layer with business rules

      // Update course to published status
      const [publishedCourse] = await this.writeDb
        .update(courses)
        .set({
          status: 'published',
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(courses.id, id))
        .returning();

      if (!publishedCourse) {
        throw new DatabaseError('Failed to publish course', 'update');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      if (existingCourse.slug) {
        await this.invalidateCacheBySlug(existingCourse.slug);
      }
      await this.invalidateCacheByInstructor(existingCourse.instructorId);

      return publishedCourse;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NotFoundError ||
        error instanceof ValidationError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to publish course',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Soft deletes a course by setting status to archived
   *
   * @param id - Course ID
   * @returns void
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Verify course exists
      const existingCourse = await this.findById(id);
      if (!existingCourse) {
        throw new NotFoundError('Course', id);
      }

      // Set status to archived
      const [archivedCourse] = await this.writeDb
        .update(courses)
        .set({
          status: 'archived',
          updatedAt: new Date(),
        })
        .where(eq(courses.id, id))
        .returning();

      if (!archivedCourse) {
        throw new DatabaseError('Failed to archive course', 'update');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      if (existingCourse.slug) {
        await this.invalidateCacheBySlug(existingCourse.slug);
      }
      await this.invalidateCacheByInstructor(existingCourse.instructorId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to archive course',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Permanently deletes a course from the database
   * USE WITH CAUTION - This is irreversible and cascades to modules/lessons
   *
   * @param id - Course ID
   * @returns void
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async hardDelete(id: string): Promise<void> {
    try {
      // Get course before deletion for cache invalidation
      const existingCourse = await this.findById(id);
      if (!existingCourse) {
        throw new NotFoundError('Course', id);
      }

      // Permanently delete course (cascades to modules and lessons)
      const result = await this.writeDb.delete(courses).where(eq(courses.id, id)).returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to hard delete course', 'delete');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      if (existingCourse.slug) {
        await this.invalidateCacheBySlug(existingCourse.slug);
      }
      await this.invalidateCacheByInstructor(existingCourse.instructorId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to hard delete course',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a course with the given slug exists
   *
   * @param slug - Course slug
   * @returns True if course exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async existsBySlug(slug: string): Promise<boolean> {
    try {
      const course = await this.findBySlug(slug);
      return course !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check course existence by slug',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Increments the enrollment count for a course
   *
   * @param id - Course ID
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async incrementEnrollmentCount(id: string): Promise<Course> {
    try {
      const [updatedCourse] = await this.writeDb
        .update(courses)
        .set({
          enrollmentCount: sql`${courses.enrollmentCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(courses.id, id))
        .returning();

      if (!updatedCourse) {
        throw new NotFoundError('Course', id);
      }

      // Invalidate cache
      await this.invalidateCache(id);
      if (updatedCourse.slug) {
        await this.invalidateCacheBySlug(updatedCourse.slug);
      }

      return updatedCourse;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to increment enrollment count',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Decrements the enrollment count for a course
   *
   * @param id - Course ID
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async decrementEnrollmentCount(id: string): Promise<Course> {
    try {
      const [updatedCourse] = await this.writeDb
        .update(courses)
        .set({
          enrollmentCount: sql`GREATEST(${courses.enrollmentCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(courses.id, id))
        .returning();

      if (!updatedCourse) {
        throw new NotFoundError('Course', id);
      }

      // Invalidate cache
      await this.invalidateCache(id);
      if (updatedCourse.slug) {
        await this.invalidateCacheBySlug(updatedCourse.slug);
      }

      return updatedCourse;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to decrement enrollment count',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates course rating statistics
   *
   * @param id - Course ID
   * @param averageRating - New average rating
   * @param totalReviews - Total number of reviews
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async updateRating(id: string, averageRating: number, totalReviews: number): Promise<Course> {
    try {
      const [updatedCourse] = await this.writeDb
        .update(courses)
        .set({
          averageRating: averageRating.toString(),
          totalReviews,
          updatedAt: new Date(),
        })
        .where(eq(courses.id, id))
        .returning();

      if (!updatedCourse) {
        throw new NotFoundError('Course', id);
      }

      // Invalidate cache
      await this.invalidateCache(id);
      if (updatedCourse.slug) {
        await this.invalidateCacheBySlug(updatedCourse.slug);
      }

      return updatedCourse;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to update course rating',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific course
   * Should be called after any update operation
   *
   * @param id - Course ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getCourseCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for course ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for a course by slug
   * Should be called after operations that affect slug lookups
   *
   * @param slug - Course slug
   * @returns void
   */
  async invalidateCacheBySlug(slug: string): Promise<void> {
    try {
      const cacheKey = this.getCourseSlugCacheKey(slug);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for course slug ${slug}:`, error);
    }
  }

  /**
   * Invalidates cache for courses by instructor
   * Should be called after operations that affect instructor course lists
   *
   * @param instructorId - Instructor user ID
   * @returns void
   */
  async invalidateCacheByInstructor(instructorId: string): Promise<void> {
    try {
      // Invalidate all instructor course list cache entries
      const pattern = buildCacheKey(CachePrefix.COURSE, 'instructor', instructorId, '*');
      await cache.deletePattern(pattern);

      // Also invalidate published courses cache as it might be affected
      const publishedPattern = buildCacheKey(CachePrefix.COURSE, 'published', '*');
      await cache.deletePattern(publishedPattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for instructor ${instructorId}:`, error);
    }
  }
}
