/**
 * Lesson Repository Implementation
 * 
 * Implements lesson data access operations with Drizzle ORM queries,
 * Redis caching, and lesson type-specific validation.
 * Handles lesson ordering and content management.
 * 
 * Requirements: 3.3
 */

import { eq, and, desc, asc, count, sql, max, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { getWriteDb, getReadDb, withDrizzleTransaction } from '../../../../infrastructure/database/index.js';
import { 
  lessons, 
  Lesson, 
  NewLesson,
  courseModules
} from '../../../../infrastructure/database/schema/courses.schema.js';
import { cache, buildCacheKey, CachePrefix, CacheTTL } from '../../../../infrastructure/cache/index.js';
import {
  DatabaseError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';
import {
  ILessonRepository,
  CreateLessonDTO,
  UpdateLessonDTO,
  LessonFilters,
} from './ILessonRepository.js';

/**
 * Lesson Repository Implementation
 * 
 * Provides data access methods for lesson entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Lesson ordering and type-specific validation
 * - Comprehensive error handling
 */
export class LessonRepository implements ILessonRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for lesson by ID
   */
  private getLessonCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.COURSE, 'lesson', 'id', id);
  }

  /**
   * Builds cache key for lessons by module
   */
  private getModuleLessonsCacheKey(moduleId: string, filters?: LessonFilters): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.COURSE, 'lessons', 'module', moduleId, filterKey);
  }

  /**
   * Builds cache key for lessons by course
   */
  private getCourseLessonsCacheKey(courseId: string, filters?: LessonFilters): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.COURSE, 'lessons', 'course', courseId, filterKey);
  }

  /**
   * Builds cache key for lessons by type
   */
  private getTypeLessonsCacheKey(
    lessonType: string, 
    courseId?: string
  ): string {
    return courseId 
      ? buildCacheKey(CachePrefix.COURSE, 'lessons', 'type', lessonType, 'course', courseId)
      : buildCacheKey(CachePrefix.COURSE, 'lessons', 'type', lessonType);
  }

  /**
   * Builds cache key for preview lessons
   */
  private getPreviewLessonsCacheKey(courseId: string): string {
    return buildCacheKey(CachePrefix.COURSE, 'lessons', 'preview', courseId);
  }

  /**
   * Validates lesson type-specific requirements
   * 
   * @param lessonType - Lesson type
   * @param data - Lesson data to validate
   * @returns True if valid, throws ValidationError if invalid
   * @throws ValidationError if validation fails
   */
  validateLessonType(
    lessonType: 'video' | 'text' | 'quiz' | 'assignment',
    data: CreateLessonDTO | UpdateLessonDTO
  ): boolean {
    const errors: Array<{ field: string; message: string }> = [];

    switch (lessonType) {
      case 'video':
        // Video lessons should have contentUrl or be prepared for upload
        // contentUrl can be null initially for video processing workflow
        break;

      case 'text':
        // Text lessons must have contentText
        if (!data.contentText || data.contentText.trim().length === 0) {
          errors.push({
            field: 'contentText',
            message: 'Text lessons must have content text'
          });
        }
        break;

      case 'quiz':
        // Quiz lessons will have associated quiz records
        // No specific content requirements at lesson level
        break;

      case 'assignment':
        // Assignment lessons will have associated assignment records
        // No specific content requirements at lesson level
        break;

      default:
        errors.push({
          field: 'lessonType',
          message: 'Invalid lesson type'
        });
    }

    if (errors.length > 0) {
      throw new ValidationError(
        'Lesson type validation failed',
        errors
      );
    }

    return true;
  }

  /**
   * Creates a new lesson in the database
   * 
   * Validates order number uniqueness within the module.
   * Validates lesson type-specific requirements.
   * 
   * @param data - Lesson creation data
   * @returns The created lesson
   * @throws ConflictError if order number already exists for the module
   * @throws ValidationError if lesson type validation fails
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateLessonDTO): Promise<Lesson> {
    try {
      // Validate lesson type requirements
      this.validateLessonType(data.lessonType, data);

      // Validate module exists
      const [moduleExists] = await this.readDb
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(eq(courseModules.id, data.moduleId))
        .limit(1);

      if (!moduleExists) {
        throw new ValidationError(
          'Invalid module ID',
          [{ field: 'moduleId', message: 'Module does not exist' }]
        );
      }

      // Check for order number conflicts
      const [existingLesson] = await this.readDb
        .select({ id: lessons.id })
        .from(lessons)
        .where(
          and(
            eq(lessons.moduleId, data.moduleId),
            eq(lessons.orderNumber, data.orderNumber)
          )
        )
        .limit(1);

      if (existingLesson) {
        throw new ConflictError(
          'A lesson with this order number already exists in the module',
          'orderNumber'
        );
      }

      // Prepare lesson data for insertion
      const newLesson: NewLesson = {
        moduleId: data.moduleId,
        title: data.title,
        description: data.description,
        lessonType: data.lessonType,
        contentUrl: data.contentUrl,
        contentText: data.contentText,
        durationMinutes: data.durationMinutes,
        orderNumber: data.orderNumber,
        isPreview: data.isPreview || false,
        metadata: data.metadata || {},
      };

      // Insert lesson into database
      const [createdLesson] = await this.writeDb
        .insert(lessons)
        .values(newLesson)
        .returning();

      if (!createdLesson) {
        throw new DatabaseError(
          'Failed to create lesson',
          'insert'
        );
      }

      // Invalidate module lessons cache
      await this.invalidateCacheByModule(data.moduleId);

      return createdLesson;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof ConflictError ||
        error instanceof ValidationError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError(
            'A lesson with this order number already exists in the module',
            'orderNumber'
          );
        }
        if (error.message.includes('foreign key')) {
          throw new ValidationError(
            'Invalid module ID',
            [{ field: 'moduleId', message: 'Module does not exist' }]
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create lesson',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a lesson by its unique ID
   * 
   * Implements caching with 5-minute TTL.
   * 
   * @param id - Lesson ID
   * @returns The lesson if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Lesson | null> {
    try {
      // Check cache first
      const cacheKey = this.getLessonCacheKey(id);
      const cachedLesson = await cache.get<Lesson>(cacheKey);
      
      if (cachedLesson) {
        return cachedLesson;
      }

      // Query database if not in cache
      const [lesson] = await this.readDb
        .select()
        .from(lessons)
        .where(eq(lessons.id, id))
        .limit(1);

      if (!lesson) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, lesson, CacheTTL.MEDIUM);

      return lesson;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lesson by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all lessons for a module ordered by orderNumber
   * 
   * Implements caching with 5-minute TTL.
   * 
   * @param moduleId - Module ID
   * @param filters - Optional filters
   * @returns Array of lessons ordered by orderNumber
   * @throws DatabaseError if database operation fails
   */
  async findByModule(moduleId: string, filters?: LessonFilters): Promise<Lesson[]> {
    try {
      // Check cache first
      const cacheKey = this.getModuleLessonsCacheKey(moduleId, filters);
      const cachedLessons = await cache.get<Lesson[]>(cacheKey);
      
      if (cachedLessons) {
        return cachedLessons;
      }

      // Build where conditions
      const whereConditions = [eq(lessons.moduleId, moduleId)];
      
      if (filters?.lessonType) {
        whereConditions.push(eq(lessons.lessonType, filters.lessonType));
      }
      if (filters?.isPreview !== undefined) {
        whereConditions.push(eq(lessons.isPreview, filters.isPreview));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Query database if not in cache
      const lessonsData = await this.readDb
        .select()
        .from(lessons)
        .where(whereClause)
        .orderBy(asc(lessons.orderNumber));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, lessonsData, CacheTTL.MEDIUM);

      return lessonsData;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lessons by module',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all lessons for a course across all modules
   * 
   * Implements caching with 5-minute TTL.
   * 
   * @param courseId - Course ID
   * @param filters - Optional filters
   * @returns Array of lessons ordered by module and lesson order
   * @throws DatabaseError if database operation fails
   */
  async findByCourse(courseId: string, filters?: LessonFilters): Promise<Lesson[]> {
    try {
      // Check cache first
      const cacheKey = this.getCourseLessonsCacheKey(courseId, filters);
      const cachedLessons = await cache.get<Lesson[]>(cacheKey);
      
      if (cachedLessons) {
        return cachedLessons;
      }

      // Build where conditions
      const whereConditions = [eq(courseModules.courseId, courseId)];
      
      if (filters?.lessonType) {
        whereConditions.push(eq(lessons.lessonType, filters.lessonType));
      }
      if (filters?.isPreview !== undefined) {
        whereConditions.push(eq(lessons.isPreview, filters.isPreview));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Query database with join to get lessons across all modules
      const lessonsData = await this.readDb
        .select({
          id: lessons.id,
          moduleId: lessons.moduleId,
          title: lessons.title,
          description: lessons.description,
          lessonType: lessons.lessonType,
          contentUrl: lessons.contentUrl,
          contentText: lessons.contentText,
          durationMinutes: lessons.durationMinutes,
          orderNumber: lessons.orderNumber,
          isPreview: lessons.isPreview,
          metadata: lessons.metadata,
          createdAt: lessons.createdAt,
          updatedAt: lessons.updatedAt,
        })
        .from(lessons)
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(whereClause)
        .orderBy(
          asc(courseModules.orderNumber),
          asc(lessons.orderNumber)
        );

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, lessonsData, CacheTTL.MEDIUM);

      return lessonsData;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lessons by course',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds lessons by type across all courses
   * 
   * Implements caching with 5-minute TTL.
   * 
   * @param lessonType - Lesson type
   * @param courseId - Optional course ID to filter by
   * @returns Array of lessons of the specified type
   * @throws DatabaseError if database operation fails
   */
  async findByType(
    lessonType: 'video' | 'text' | 'quiz' | 'assignment',
    courseId?: string
  ): Promise<Lesson[]> {
    try {
      // Check cache first
      const cacheKey = this.getTypeLessonsCacheKey(lessonType, courseId);
      const cachedLessons = await cache.get<Lesson[]>(cacheKey);
      
      if (cachedLessons) {
        return cachedLessons;
      }

      let lessonsData: Lesson[];

      if (courseId) {
        // Filter by course and lesson type
        lessonsData = await this.readDb
          .select({
            id: lessons.id,
            moduleId: lessons.moduleId,
            title: lessons.title,
            description: lessons.description,
            lessonType: lessons.lessonType,
            contentUrl: lessons.contentUrl,
            contentText: lessons.contentText,
            durationMinutes: lessons.durationMinutes,
            orderNumber: lessons.orderNumber,
            isPreview: lessons.isPreview,
            metadata: lessons.metadata,
            createdAt: lessons.createdAt,
            updatedAt: lessons.updatedAt,
          })
          .from(lessons)
          .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
          .where(
            and(
              eq(courseModules.courseId, courseId),
              eq(lessons.lessonType, lessonType)
            )
          )
          .orderBy(
            asc(courseModules.orderNumber),
            asc(lessons.orderNumber)
          );
      } else {
        // Filter by lesson type only
        lessonsData = await this.readDb
          .select()
          .from(lessons)
          .where(eq(lessons.lessonType, lessonType))
          .orderBy(desc(lessons.createdAt));
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, lessonsData, CacheTTL.MEDIUM);

      return lessonsData;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find lessons by type',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds preview lessons for a course (accessible without enrollment)
   * 
   * Implements caching with 5-minute TTL.
   * 
   * @param courseId - Course ID
   * @returns Array of preview lessons
   * @throws DatabaseError if database operation fails
   */
  async findPreviewLessons(courseId: string): Promise<Lesson[]> {
    try {
      // Check cache first
      const cacheKey = this.getPreviewLessonsCacheKey(courseId);
      const cachedLessons = await cache.get<Lesson[]>(cacheKey);
      
      if (cachedLessons) {
        return cachedLessons;
      }

      // Query database for preview lessons
      const lessonsData = await this.readDb
        .select({
          id: lessons.id,
          moduleId: lessons.moduleId,
          title: lessons.title,
          description: lessons.description,
          lessonType: lessons.lessonType,
          contentUrl: lessons.contentUrl,
          contentText: lessons.contentText,
          durationMinutes: lessons.durationMinutes,
          orderNumber: lessons.orderNumber,
          isPreview: lessons.isPreview,
          metadata: lessons.metadata,
          createdAt: lessons.createdAt,
          updatedAt: lessons.updatedAt,
        })
        .from(lessons)
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(
          and(
            eq(courseModules.courseId, courseId),
            eq(lessons.isPreview, true)
          )
        )
        .orderBy(
          asc(courseModules.orderNumber),
          asc(lessons.orderNumber)
        );

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, lessonsData, CacheTTL.MEDIUM);

      return lessonsData;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find preview lessons',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a lesson's data
   * 
   * Validates order number uniqueness and lesson type requirements.
   * Invalidates all related cache entries after successful update.
   * 
   * @param id - Lesson ID
   * @param data - Update data
   * @returns The updated lesson
   * @throws NotFoundError if lesson doesn't exist
   * @throws ConflictError if order number update conflicts
   * @throws ValidationError if lesson type validation fails
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateLessonDTO): Promise<Lesson> {
    try {
      // First, verify lesson exists
      const existingLesson = await this.findById(id);
      if (!existingLesson) {
        throw new NotFoundError('Lesson', id);
      }

      // Validate lesson type if being updated
      const lessonType = data.lessonType || existingLesson.lessonType;
      this.validateLessonType(lessonType, data);

      // If order number is being updated, check for conflicts
      if (data.orderNumber && data.orderNumber !== existingLesson.orderNumber) {
        const [orderConflict] = await this.readDb
          .select({ id: lessons.id })
          .from(lessons)
          .where(
            and(
              eq(lessons.moduleId, existingLesson.moduleId),
              eq(lessons.orderNumber, data.orderNumber),
              sql`${lessons.id} != ${id}`
            )
          )
          .limit(1);

        if (orderConflict) {
          throw new ConflictError(
            'A lesson with this order number already exists in the module',
            'orderNumber'
          );
        }
      }

      // Prepare update data
      const updateData: Partial<NewLesson> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update lesson in database
      const [updatedLesson] = await this.writeDb
        .update(lessons)
        .set(updateData)
        .where(eq(lessons.id, id))
        .returning();

      if (!updatedLesson) {
        throw new DatabaseError(
          'Failed to update lesson',
          'update'
        );
      }

      // Invalidate all cache entries for this lesson
      await this.invalidateCache(id);
      await this.invalidateCacheByModule(existingLesson.moduleId);

      return updatedLesson;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof ValidationError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new ConflictError(
            'A lesson with this order number already exists in the module',
            'orderNumber'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update lesson',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a lesson
   * 
   * @param id - Lesson ID
   * @returns void
   * @throws NotFoundError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Verify lesson exists
      const existingLesson = await this.findById(id);
      if (!existingLesson) {
        throw new NotFoundError('Lesson', id);
      }

      // Delete lesson
      const result = await this.writeDb
        .delete(lessons)
        .where(eq(lessons.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError(
          'Failed to delete lesson',
          'delete'
        );
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByModule(existingLesson.moduleId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete lesson',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Reorders lessons within a module
   * Updates order numbers to maintain sequential integrity
   * 
   * @param moduleId - Module ID
   * @param lessonIds - Array of lesson IDs in desired order
   * @returns Array of updated lessons
   * @throws NotFoundError if module or lessons don't exist
   * @throws ValidationError if lesson IDs don't belong to module
   * @throws DatabaseError if database operation fails
   */
  async reorder(moduleId: string, lessonIds: string[]): Promise<Lesson[]> {
    try {
      return await withDrizzleTransaction(async (tx) => {
        // Verify all lessons exist and belong to the module
        const existingLessons = await tx
          .select()
          .from(lessons)
          .where(
            and(
              eq(lessons.moduleId, moduleId),
              inArray(lessons.id, lessonIds)
            )
          );

        if (existingLessons.length !== lessonIds.length) {
          throw new ValidationError(
            'Some lesson IDs do not exist or do not belong to the module',
            [{ field: 'lessonIds', message: 'Invalid lesson IDs provided' }]
          );
        }

        // Update order numbers
        const updatedLessons: Lesson[] = [];
        for (let i = 0; i < lessonIds.length; i++) {
          const lessonId = lessonIds[i];
          if (lessonId) {
            const [updatedLesson] = await tx
              .update(lessons)
              .set({
                orderNumber: i + 1,
                updatedAt: new Date(),
              })
              .where(eq(lessons.id, lessonId))
              .returning();

            if (updatedLesson) {
              updatedLessons.push(updatedLesson);
            }
          }
        }

        return updatedLessons;
      });
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
        'Failed to reorder lessons',
        'update',
        error instanceof Error ? error : undefined
      );
    } finally {
      // Invalidate cache regardless of success/failure
      await this.invalidateCacheByModule(moduleId);
    }
  }

  /**
   * Gets the next available order number for a module
   * 
   * @param moduleId - Module ID
   * @returns Next available order number
   * @throws DatabaseError if database operation fails
   */
  async getNextOrderNumber(moduleId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ maxOrder: max(lessons.orderNumber) })
        .from(lessons)
        .where(eq(lessons.moduleId, moduleId));

      return (result?.maxOrder || 0) + 1;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get next order number',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates lesson content URL (for video processing completion)
   * 
   * @param id - Lesson ID
   * @param contentUrl - New content URL
   * @param metadata - Optional metadata update
   * @returns The updated lesson
   * @throws NotFoundError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async updateContentUrl(id: string, contentUrl: string, metadata?: Record<string, unknown>): Promise<Lesson> {
    try {
      const updateData: Partial<NewLesson> = {
        contentUrl,
        updatedAt: new Date(),
      };

      if (metadata) {
        updateData.metadata = metadata;
      }

      const [updatedLesson] = await this.writeDb
        .update(lessons)
        .set(updateData)
        .where(eq(lessons.id, id))
        .returning();

      if (!updatedLesson) {
        throw new NotFoundError('Lesson', id);
      }

      // Invalidate cache
      await this.invalidateCache(id);
      await this.invalidateCacheByModule(updatedLesson.moduleId);

      return updatedLesson;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to update lesson content URL',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Counts lessons by type for a course
   * 
   * @param courseId - Course ID
   * @returns Object with counts by lesson type
   * @throws DatabaseError if database operation fails
   */
  async countByType(courseId: string): Promise<{
    video: number;
    text: number;
    quiz: number;
    assignment: number;
    total: number;
  }> {
    try {
      const results = await this.readDb
        .select({
          lessonType: lessons.lessonType,
          count: count(),
        })
        .from(lessons)
        .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
        .where(eq(courseModules.courseId, courseId))
        .groupBy(lessons.lessonType);

      const counts = {
        video: 0,
        text: 0,
        quiz: 0,
        assignment: 0,
        total: 0,
      };

      for (const result of results) {
        const count = Number(result.count);
        counts[result.lessonType as keyof typeof counts] = count;
        counts.total += count;
      }

      return counts;
    } catch (error) {
      throw new DatabaseError(
        'Failed to count lessons by type',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific lesson
   * 
   * @param id - Lesson ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getLessonCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for lesson ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for all lessons in a module
   * 
   * @param moduleId - Module ID
   * @returns void
   */
  async invalidateCacheByModule(moduleId: string): Promise<void> {
    try {
      // Invalidate all module lesson cache entries
      const pattern = buildCacheKey(CachePrefix.COURSE, 'lessons', 'module', moduleId, '*');
      await cache.deletePattern(pattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for module lessons ${moduleId}:`, error);
    }
  }

  /**
   * Invalidates cache for all lessons in a course
   * 
   * @param courseId - Course ID
   * @returns void
   */
  async invalidateCacheByCourse(courseId: string): Promise<void> {
    try {
      // Invalidate all course lesson cache entries
      const pattern = buildCacheKey(CachePrefix.COURSE, 'lessons', 'course', courseId, '*');
      await cache.deletePattern(pattern);
      
      // Also invalidate preview lessons cache
      const previewCacheKey = this.getPreviewLessonsCacheKey(courseId);
      await cache.delete(previewCacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for course lessons ${courseId}:`, error);
    }
  }
}