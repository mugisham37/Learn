/**
 * Course Module Repository Implementation
 *
 * Implements course module data access operations with Drizzle ORM queries,
 * Redis caching, and module ordering management.
 * Handles prerequisite relationships and sequential ordering.
 *
 * Requirements: 3.2
 */

import { eq, and, asc, sql, max, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import {
  getWriteDb,
  getReadDb,
  withDrizzleTransaction,
} from '../../../../infrastructure/database/index.js';
import {
  courseModules,
  CourseModule,
  NewCourseModule,
  courses,
  lessons,
} from '../../../../infrastructure/database/schema/courses.schema.js';
import {
  DatabaseError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';

import {
  ICourseModuleRepository,
  CreateCourseModuleDTO,
  UpdateCourseModuleDTO,
} from './ICourseModuleRepository.js';

/**
 * Course Module Repository Implementation
 *
 * Provides data access methods for course module entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Module ordering and prerequisite management
 * - Comprehensive error handling
 */
export class CourseModuleRepository implements ICourseModuleRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for module by ID
   */
  private getModuleCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.COURSE, 'module', 'id', id);
  }

  /**
   * Builds cache key for modules by course
   */
  private getCourseModulesCacheKey(courseId: string): string {
    return buildCacheKey(CachePrefix.COURSE, 'modules', 'course', courseId);
  }

  /**
   * Builds cache key for modules by prerequisite
   */
  private getPrerequisiteModulesCacheKey(prerequisiteModuleId: string): string {
    return buildCacheKey(CachePrefix.COURSE, 'modules', 'prerequisite', prerequisiteModuleId);
  }

  /**
   * Creates a new course module in the database
   *
   * Validates order number uniqueness within the course.
   * Validates prerequisite module exists and belongs to same course.
   *
   * @param data - Module creation data
   * @returns The created module
   * @throws ConflictError if order number already exists for the course
   * @throws ValidationError if prerequisite validation fails
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateCourseModuleDTO): Promise<CourseModule> {
    try {
      // Validate course exists
      const [courseExists] = await this.readDb
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, data.courseId))
        .limit(1);

      if (!courseExists) {
        throw new ValidationError('Invalid course ID', [
          { field: 'courseId', message: 'Course does not exist' },
        ]);
      }

      // Check for order number conflicts
      const [existingModule] = await this.readDb
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(
          and(
            eq(courseModules.courseId, data.courseId),
            eq(courseModules.orderNumber, data.orderNumber)
          )
        )
        .limit(1);

      if (existingModule) {
        throw new ConflictError(
          'A module with this order number already exists in the course',
          'orderNumber'
        );
      }

      // Validate prerequisite module if provided
      if (data.prerequisiteModuleId) {
        const [prerequisiteModule] = await this.readDb
          .select({ courseId: courseModules.courseId })
          .from(courseModules)
          .where(eq(courseModules.id, data.prerequisiteModuleId))
          .limit(1);

        if (!prerequisiteModule) {
          throw new ValidationError('Invalid prerequisite module ID', [
            { field: 'prerequisiteModuleId', message: 'Prerequisite module does not exist' },
          ]);
        }

        if (prerequisiteModule.courseId !== data.courseId) {
          throw new ValidationError('Prerequisite module must belong to the same course', [
            {
              field: 'prerequisiteModuleId',
              message: 'Prerequisite module belongs to different course',
            },
          ]);
        }
      }

      // Prepare module data for insertion
      const newModule: NewCourseModule = {
        courseId: data.courseId,
        title: data.title,
        description: data.description,
        orderNumber: data.orderNumber,
        durationMinutes: data.durationMinutes || 0,
        prerequisiteModuleId: data.prerequisiteModuleId,
      };

      // Insert module into database
      const [createdModule] = await this.writeDb
        .insert(courseModules)
        .values(newModule)
        .returning();

      if (!createdModule) {
        throw new DatabaseError('Failed to create course module', 'insert');
      }

      // Invalidate course modules cache
      await this.invalidateCacheByCourse(data.courseId);

      return createdModule;
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
            'A module with this order number already exists in the course',
            'orderNumber'
          );
        }
        if (error.message.includes('foreign key')) {
          throw new ValidationError('Invalid course or prerequisite module ID', [
            { field: 'courseId', message: 'Referenced entity does not exist' },
          ]);
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create course module',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a module by its unique ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param id - Module ID
   * @returns The module if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<CourseModule | null> {
    try {
      // Check cache first
      const cacheKey = this.getModuleCacheKey(id);
      const cachedModule = await cache.get<CourseModule>(cacheKey);

      if (cachedModule) {
        return cachedModule;
      }

      // Query database if not in cache
      const [module] = await this.readDb
        .select()
        .from(courseModules)
        .where(eq(courseModules.id, id))
        .limit(1);

      if (!module) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, module, CacheTTL.MEDIUM);

      return module;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find module by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all modules for a course ordered by orderNumber
   *
   * Implements caching with 5-minute TTL.
   *
   * @param courseId - Course ID
   * @returns Array of modules ordered by orderNumber
   * @throws DatabaseError if database operation fails
   */
  async findByCourse(courseId: string): Promise<CourseModule[]> {
    try {
      // Check cache first
      const cacheKey = this.getCourseModulesCacheKey(courseId);
      const cachedModules = await cache.get<CourseModule[]>(cacheKey);

      if (cachedModules) {
        return cachedModules;
      }

      // Query database if not in cache
      const modules = await this.readDb
        .select()
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId))
        .orderBy(asc(courseModules.orderNumber));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, modules, CacheTTL.MEDIUM);

      return modules;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find modules by course',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds modules that have the specified module as a prerequisite
   *
   * Implements caching with 5-minute TTL.
   *
   * @param prerequisiteModuleId - Prerequisite module ID
   * @returns Array of dependent modules
   * @throws DatabaseError if database operation fails
   */
  async findByPrerequisite(prerequisiteModuleId: string): Promise<CourseModule[]> {
    try {
      // Check cache first
      const cacheKey = this.getPrerequisiteModulesCacheKey(prerequisiteModuleId);
      const cachedModules = await cache.get<CourseModule[]>(cacheKey);

      if (cachedModules) {
        return cachedModules;
      }

      // Query database if not in cache
      const modules = await this.readDb
        .select()
        .from(courseModules)
        .where(eq(courseModules.prerequisiteModuleId, prerequisiteModuleId))
        .orderBy(asc(courseModules.orderNumber));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, modules, CacheTTL.MEDIUM);

      return modules;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find modules by prerequisite',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a module's data
   *
   * Validates order number uniqueness and prerequisite relationships.
   * Invalidates all related cache entries after successful update.
   *
   * @param id - Module ID
   * @param data - Update data
   * @returns The updated module
   * @throws NotFoundError if module doesn't exist
   * @throws ConflictError if order number update conflicts
   * @throws ValidationError if prerequisite validation fails
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateCourseModuleDTO): Promise<CourseModule> {
    try {
      // First, verify module exists
      const existingModule = await this.findById(id);
      if (!existingModule) {
        throw new NotFoundError('Course module', id);
      }

      // If order number is being updated, check for conflicts
      if (data.orderNumber && data.orderNumber !== existingModule.orderNumber) {
        const [orderConflict] = await this.readDb
          .select({ id: courseModules.id })
          .from(courseModules)
          .where(
            and(
              eq(courseModules.courseId, existingModule.courseId),
              eq(courseModules.orderNumber, data.orderNumber),
              sql`${courseModules.id} != ${id}`
            )
          )
          .limit(1);

        if (orderConflict) {
          throw new ConflictError(
            'A module with this order number already exists in the course',
            'orderNumber'
          );
        }
      }

      // Validate prerequisite module if being updated
      if (data.prerequisiteModuleId !== undefined) {
        if (data.prerequisiteModuleId) {
          // Prevent self-reference
          if (data.prerequisiteModuleId === id) {
            throw new ValidationError('Module cannot be its own prerequisite', [
              { field: 'prerequisiteModuleId', message: 'Self-reference not allowed' },
            ]);
          }

          const [prerequisiteModule] = await this.readDb
            .select({ courseId: courseModules.courseId })
            .from(courseModules)
            .where(eq(courseModules.id, data.prerequisiteModuleId))
            .limit(1);

          if (!prerequisiteModule) {
            throw new ValidationError('Invalid prerequisite module ID', [
              { field: 'prerequisiteModuleId', message: 'Prerequisite module does not exist' },
            ]);
          }

          if (prerequisiteModule.courseId !== existingModule.courseId) {
            throw new ValidationError('Prerequisite module must belong to the same course', [
              {
                field: 'prerequisiteModuleId',
                message: 'Prerequisite module belongs to different course',
              },
            ]);
          }
        }
      }

      // Prepare update data
      const updateData: Partial<NewCourseModule> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update module in database
      const [updatedModule] = await this.writeDb
        .update(courseModules)
        .set(updateData)
        .where(eq(courseModules.id, id))
        .returning();

      if (!updatedModule) {
        throw new DatabaseError('Failed to update course module', 'update');
      }

      // Invalidate all cache entries for this module
      await this.invalidateCache(id);
      await this.invalidateCacheByCourse(existingModule.courseId);

      // Invalidate prerequisite cache if it changed
      if (existingModule.prerequisiteModuleId) {
        await this.invalidateCacheByPrerequisite(existingModule.prerequisiteModuleId);
      }
      if (
        data.prerequisiteModuleId &&
        data.prerequisiteModuleId !== existingModule.prerequisiteModuleId
      ) {
        await this.invalidateCacheByPrerequisite(data.prerequisiteModuleId);
      }

      return updatedModule;
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
            'A module with this order number already exists in the course',
            'orderNumber'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update course module',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a module and all its lessons
   *
   * Checks for dependent modules before deletion.
   *
   * @param id - Module ID
   * @returns void
   * @throws NotFoundError if module doesn't exist
   * @throws ConflictError if module has dependent modules
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Verify module exists
      const existingModule = await this.findById(id);
      if (!existingModule) {
        throw new NotFoundError('Course module', id);
      }

      // Check for dependent modules
      const dependentModules = await this.findByPrerequisite(id);
      if (dependentModules.length > 0) {
        throw new ConflictError(
          'Cannot delete module that is a prerequisite for other modules',
          'prerequisiteModuleId'
        );
      }

      // Delete module (cascades to lessons)
      const result = await this.writeDb
        .delete(courseModules)
        .where(eq(courseModules.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to delete course module', 'delete');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByCourse(existingModule.courseId);
      if (existingModule.prerequisiteModuleId) {
        await this.invalidateCacheByPrerequisite(existingModule.prerequisiteModuleId);
      }
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NotFoundError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete course module',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Reorders modules within a course
   * Updates order numbers to maintain sequential integrity
   *
   * @param courseId - Course ID
   * @param moduleIds - Array of module IDs in desired order
   * @returns Array of updated modules
   * @throws NotFoundError if course or modules don't exist
   * @throws ValidationError if module IDs don't belong to course
   * @throws DatabaseError if database operation fails
   */
  async reorder(courseId: string, moduleIds: string[]): Promise<CourseModule[]> {
    try {
      return await withDrizzleTransaction(async (tx) => {
        // Verify all modules exist and belong to the course
        const existingModules = await tx
          .select()
          .from(courseModules)
          .where(and(eq(courseModules.courseId, courseId), inArray(courseModules.id, moduleIds)));

        if (existingModules.length !== moduleIds.length) {
          throw new ValidationError('Some module IDs do not exist or do not belong to the course', [
            { field: 'moduleIds', message: 'Invalid module IDs provided' },
          ]);
        }

        // Update order numbers
        const updatedModules: CourseModule[] = [];
        for (let i = 0; i < moduleIds.length; i++) {
          const moduleId = moduleIds[i];
          if (moduleId) {
            const [updatedModule] = await tx
              .update(courseModules)
              .set({
                orderNumber: i + 1,
                updatedAt: new Date(),
              })
              .where(eq(courseModules.id, moduleId))
              .returning();

            if (updatedModule) {
              updatedModules.push(updatedModule);
            }
          }
        }

        return updatedModules;
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
        'Failed to reorder course modules',
        'update',
        error instanceof Error ? error : undefined
      );
    } finally {
      // Invalidate cache regardless of success/failure
      await this.invalidateCacheByCourse(courseId);
    }
  }

  /**
   * Gets the next available order number for a course
   *
   * @param courseId - Course ID
   * @returns Next available order number
   * @throws DatabaseError if database operation fails
   */
  async getNextOrderNumber(courseId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ maxOrder: max(courseModules.orderNumber) })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));

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
   * Checks if a module can be deleted (no dependent modules)
   *
   * @param id - Module ID
   * @returns True if module can be safely deleted
   * @throws DatabaseError if database operation fails
   */
  async canDelete(id: string): Promise<boolean> {
    try {
      const dependentModules = await this.findByPrerequisite(id);
      return dependentModules.length === 0;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check if module can be deleted',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates the total duration of a module based on its lessons
   *
   * @param id - Module ID
   * @returns The updated module
   * @throws NotFoundError if module doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async updateDuration(id: string): Promise<CourseModule> {
    try {
      // Calculate total duration from lessons
      const [result] = await this.readDb
        .select({
          totalDuration: sql<number>`COALESCE(SUM(${lessons.durationMinutes}), 0)`,
        })
        .from(lessons)
        .where(eq(lessons.moduleId, id));

      const totalDuration = result?.totalDuration || 0;

      // Update module duration
      const [updatedModule] = await this.writeDb
        .update(courseModules)
        .set({
          durationMinutes: totalDuration,
          updatedAt: new Date(),
        })
        .where(eq(courseModules.id, id))
        .returning();

      if (!updatedModule) {
        throw new NotFoundError('Course module', id);
      }

      // Invalidate cache
      await this.invalidateCache(id);
      await this.invalidateCacheByCourse(updatedModule.courseId);

      return updatedModule;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to update module duration',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific module
   *
   * @param id - Module ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getModuleCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for module ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for all modules in a course
   *
   * @param courseId - Course ID
   * @returns void
   */
  async invalidateCacheByCourse(courseId: string): Promise<void> {
    try {
      const cacheKey = this.getCourseModulesCacheKey(courseId);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for course modules ${courseId}:`, error);
    }
  }

  /**
   * Invalidates cache for modules by prerequisite
   *
   * @param prerequisiteModuleId - Prerequisite module ID
   * @returns void
   */
  private async invalidateCacheByPrerequisite(prerequisiteModuleId: string): Promise<void> {
    try {
      const cacheKey = this.getPrerequisiteModulesCacheKey(prerequisiteModuleId);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(
        `Failed to invalidate cache for prerequisite modules ${prerequisiteModuleId}:`,
        error
      );
    }
  }
}
