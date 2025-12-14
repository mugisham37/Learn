/**
 * Assignment Repository Implementation
 *
 * Implements assignment data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 7.1, 7.2
 */

import { eq, and, desc, count, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  assignments,
  Assignment,
  NewAssignment,
} from '../../../../infrastructure/database/schema/assessments.schema.js';
import { DatabaseError, NotFoundError, ValidationError } from '../../../../shared/errors/index.js';

import {
  IAssignmentRepository,
  CreateAssignmentDTO,
  UpdateAssignmentDTO,
  PaginationParams,
  PaginatedResult,
  AssignmentFilters,
} from './IAssignmentRepository.js';

/**
 * Assignment Repository Implementation
 *
 * Provides data access methods for assignment entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Support for assignment due date checking
 */
export class AssignmentRepository implements IAssignmentRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for assignment by ID
   */
  private getAssignmentCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.ASSIGNMENT, 'id', id);
  }

  /**
   * Builds cache key for lesson assignments list
   */
  private getLessonAssignmentsCacheKey(
    lessonId: string,
    page: number,
    limit: number,
    filters?: AssignmentFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.ASSIGNMENT, 'lesson', lessonId, page, limit, filterKey);
  }

  /**
   * Builds cache key for all assignments list
   */
  private getAllAssignmentsCacheKey(
    page: number,
    limit: number,
    filters?: AssignmentFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.ASSIGNMENT, 'all', page, limit, filterKey);
  }

  /**
   * Creates a new assignment in the database
   *
   * @param data - Assignment creation data
   * @returns The created assignment
   * @throws ValidationError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateAssignmentDTO): Promise<Assignment> {
    try {
      // Prepare assignment data for insertion
      const newAssignment: NewAssignment = {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        dueDate: data.dueDate,
        lateSubmissionAllowed: data.lateSubmissionAllowed || false,
        latePenaltyPercentage: data.latePenaltyPercentage || 0,
        maxPoints: data.maxPoints,
        requiresFileUpload: data.requiresFileUpload ?? true,
        allowedFileTypes: data.allowedFileTypes,
        maxFileSizeMb: data.maxFileSizeMb || 10,
        rubric: data.rubric,
      };

      // Insert assignment into database
      const [createdAssignment] = await this.writeDb
        .insert(assignments)
        .values(newAssignment)
        .returning();

      if (!createdAssignment) {
        throw new DatabaseError('Failed to create assignment', 'insert');
      }

      // Invalidate lesson assignments cache
      await this.invalidateCacheByLesson(data.lessonId);

      return createdAssignment;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('foreign key') || error.message.includes('lesson')) {
          throw new ValidationError('Invalid lesson ID', [
            { field: 'lessonId', message: 'Lesson does not exist' },
          ]);
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create assignment',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds an assignment by its unique ID
   *
   * @param id - Assignment ID
   * @returns The assignment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Assignment | null> {
    try {
      // Check cache first
      const cacheKey = this.getAssignmentCacheKey(id);
      const cachedAssignment = await cache.get<Assignment>(cacheKey);

      if (cachedAssignment) {
        return cachedAssignment;
      }

      // Query database if not in cache
      const [assignment] = await this.readDb
        .select()
        .from(assignments)
        .where(eq(assignments.id, id))
        .limit(1);

      if (!assignment) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, assignment, CacheTTL.MEDIUM);

      return assignment;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find assignment by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds assignments by lesson with pagination
   *
   * @param lessonId - Lesson ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment results
   * @throws DatabaseError if database operation fails
   */
  async findByLesson(
    lessonId: string,
    pagination: PaginationParams,
    filters?: AssignmentFilters
  ): Promise<PaginatedResult<Assignment>> {
    try {
      // Check cache first
      const cacheKey = this.getLessonAssignmentsCacheKey(
        lessonId,
        pagination.page,
        pagination.limit,
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<Assignment>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(assignments.lessonId, lessonId)];

      if (filters?.dueAfter) {
        whereConditions.push(gte(assignments.dueDate, filters.dueAfter));
      }

      if (filters?.dueBefore) {
        whereConditions.push(lte(assignments.dueDate, filters.dueBefore));
      }

      if (filters?.requiresFileUpload !== undefined) {
        whereConditions.push(eq(assignments.requiresFileUpload, filters.requiresFileUpload));
      }

      const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(assignments)
        .where(whereClause);

      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const assignmentsData = await this.readDb
        .select()
        .from(assignments)
        .where(whereClause)
        .orderBy(desc(assignments.dueDate))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Assignment> = {
        data: assignmentsData,
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
        'Failed to find assignments by lesson',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all assignments with pagination and filtering
   *
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment results
   * @throws DatabaseError if database operation fails
   */
  async findAll(
    pagination: PaginationParams,
    filters?: AssignmentFilters
  ): Promise<PaginatedResult<Assignment>> {
    try {
      // Check cache first
      const cacheKey = this.getAllAssignmentsCacheKey(pagination.page, pagination.limit, filters);
      const cachedResult = await cache.get<PaginatedResult<Assignment>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [];

      if (filters?.lessonId) {
        whereConditions.push(eq(assignments.lessonId, filters.lessonId));
      }

      if (filters?.dueAfter) {
        whereConditions.push(gte(assignments.dueDate, filters.dueAfter));
      }

      if (filters?.dueBefore) {
        whereConditions.push(lte(assignments.dueDate, filters.dueBefore));
      }

      if (filters?.requiresFileUpload !== undefined) {
        whereConditions.push(eq(assignments.requiresFileUpload, filters.requiresFileUpload));
      }

      const whereClause =
        whereConditions.length > 1
          ? and(...whereConditions)
          : whereConditions.length === 1
            ? whereConditions[0]
            : undefined;

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(assignments)
        .where(whereClause);

      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const assignmentsData = await this.readDb
        .select()
        .from(assignments)
        .where(whereClause)
        .orderBy(desc(assignments.dueDate))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Assignment> = {
        data: assignmentsData,
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
        'Failed to find all assignments',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates an assignment's data
   *
   * @param id - Assignment ID
   * @param data - Update data
   * @returns The updated assignment
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateAssignmentDTO): Promise<Assignment> {
    try {
      // First, verify assignment exists
      const existingAssignment = await this.findById(id);
      if (!existingAssignment) {
        throw new NotFoundError('Assignment', id);
      }

      // Prepare update data
      const updateData: Partial<NewAssignment> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update assignment in database
      const [updatedAssignment] = await this.writeDb
        .update(assignments)
        .set(updateData)
        .where(eq(assignments.id, id))
        .returning();

      if (!updatedAssignment) {
        throw new DatabaseError('Failed to update assignment', 'update');
      }

      // Invalidate all cache entries for this assignment
      await this.invalidateCache(id);
      await this.invalidateCacheByLesson(existingAssignment.lessonId);

      return updatedAssignment;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update assignment',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes an assignment from the database
   * This cascades to delete all submissions
   *
   * @param id - Assignment ID
   * @returns void
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get assignment before deletion for cache invalidation
      const existingAssignment = await this.findById(id);
      if (!existingAssignment) {
        throw new NotFoundError('Assignment', id);
      }

      // Delete assignment (cascades to submissions)
      const result = await this.writeDb
        .delete(assignments)
        .where(eq(assignments.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to delete assignment', 'delete');
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByLesson(existingAssignment.lessonId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete assignment',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if an assignment exists
   *
   * @param id - Assignment ID
   * @returns True if assignment exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async exists(id: string): Promise<boolean> {
    try {
      const assignment = await this.findById(id);
      return assignment !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check assignment existence',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if an assignment is past due
   *
   * @param id - Assignment ID
   * @returns True if assignment is past due, false otherwise
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async isPastDue(id: string): Promise<boolean> {
    try {
      const assignment = await this.findById(id);
      if (!assignment) {
        throw new NotFoundError('Assignment', id);
      }

      const now = new Date();
      return assignment.dueDate < now;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to check assignment due date',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific assignment
   * Should be called after any update operation
   *
   * @param id - Assignment ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getAssignmentCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for assignment ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for assignments by lesson
   * Should be called after operations that affect lesson assignment lists
   *
   * @param lessonId - Lesson ID
   * @returns void
   */
  async invalidateCacheByLesson(lessonId: string): Promise<void> {
    try {
      // Invalidate lesson assignment list cache entries
      const lessonPattern = buildCacheKey(CachePrefix.ASSIGNMENT, 'lesson', lessonId, '*');
      await cache.deletePattern(lessonPattern);

      // Also invalidate all assignments cache as it might be affected
      const allPattern = buildCacheKey(CachePrefix.ASSIGNMENT, 'all', '*');
      await cache.deletePattern(allPattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for lesson ${lessonId}:`, error);
    }
  }
}
