/**
 * Assignment Submission Repository Implementation
 * 
 * Implements assignment submission data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles submission tracking with revision history and parent linking.
 * 
 * Requirements: 7.1, 7.2
 */

import { eq, and, desc, count, sql, gte, lte, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { cache, buildCacheKey, CachePrefix, CacheTTL } from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { 
  assignmentSubmissions, 
  AssignmentSubmission, 
  NewAssignmentSubmission
} from '../../../../infrastructure/database/schema/assessments.schema.js';
import {
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';

import {
  IAssignmentSubmissionRepository,
  CreateAssignmentSubmissionDTO,
  UpdateAssignmentSubmissionDTO,
  PaginationParams,
  PaginatedResult,
  AssignmentSubmissionFilters,
  AssignmentSubmissionWithRevisions,
  StudentSubmissionSummary,
} from './IAssignmentSubmissionRepository.js';

/**
 * Assignment Submission Repository Implementation
 * 
 * Provides data access methods for assignment submission entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Support for revision tracking and parent linking
 */
export class AssignmentSubmissionRepository implements IAssignmentSubmissionRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for assignment submission by ID
   */
  private getSubmissionCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'id', id);
  }

  /**
   * Builds cache key for assignment submission with revisions by ID
   */
  private getSubmissionWithRevisionsCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'with-revisions', id);
  }

  /**
   * Builds cache key for assignment submissions list
   */
  private getAssignmentSubmissionsCacheKey(
    assignmentId: string, 
    page: number, 
    limit: number,
    filters?: AssignmentSubmissionFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'assignment', assignmentId, page, limit, filterKey);
  }

  /**
   * Builds cache key for student submissions list
   */
  private getStudentSubmissionsCacheKey(
    studentId: string, 
    page: number, 
    limit: number,
    filters?: AssignmentSubmissionFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'student', studentId, page, limit, filterKey);
  }

  /**
   * Builds cache key for latest submission by student and assignment
   */
  private getLatestSubmissionCacheKey(assignmentId: string, studentId: string): string {
    return buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'latest', assignmentId, studentId);
  }

  /**
   * Builds cache key for student submission summary
   */
  private getSubmissionSummaryCacheKey(assignmentId: string, studentId: string): string {
    return buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'summary', assignmentId, studentId);
  }

  /**
   * Creates a new assignment submission in the database
   * 
   * @param data - Assignment submission creation data
   * @returns The created assignment submission
   * @throws ValidationError if assignment, student, or enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateAssignmentSubmissionDTO): Promise<AssignmentSubmission> {
    try {
      // Prepare assignment submission data for insertion
      const newSubmission: NewAssignmentSubmission = {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSizeBytes: data.fileSizeBytes,
        submissionText: data.submissionText,
        isLate: data.isLate || false,
        revisionNumber: data.revisionNumber || 1,
        parentSubmissionId: data.parentSubmissionId,
      };

      // Insert assignment submission into database
      const [createdSubmission] = await this.writeDb
        .insert(assignmentSubmissions)
        .values(newSubmission)
        .returning();

      if (!createdSubmission) {
        throw new DatabaseError(
          'Failed to create assignment submission',
          'insert'
        );
      }

      // Invalidate related caches
      await this.invalidateCacheByAssignment(data.assignmentId);
      await this.invalidateCacheByStudent(data.studentId);

      return createdSubmission;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('foreign key')) {
          if (error.message.includes('assignment')) {
            throw new ValidationError(
              'Invalid assignment ID',
              [{ field: 'assignmentId', message: 'Assignment does not exist' }]
            );
          }
          if (error.message.includes('student') || error.message.includes('user')) {
            throw new ValidationError(
              'Invalid student ID',
              [{ field: 'studentId', message: 'Student does not exist' }]
            );
          }
          if (error.message.includes('enrollment')) {
            throw new ValidationError(
              'Invalid enrollment ID',
              [{ field: 'enrollmentId', message: 'Enrollment does not exist' }]
            );
          }
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create assignment submission',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds an assignment submission by its unique ID
   * 
   * @param id - Assignment submission ID
   * @returns The assignment submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<AssignmentSubmission | null> {
    try {
      // Check cache first
      const cacheKey = this.getSubmissionCacheKey(id);
      const cachedSubmission = await cache.get<AssignmentSubmission>(cacheKey);
      
      if (cachedSubmission) {
        return cachedSubmission;
      }

      // Query database if not in cache
      const [submission] = await this.readDb
        .select()
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.id, id))
        .limit(1);

      if (!submission) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, submission, CacheTTL.MEDIUM);

      return submission;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find assignment submission by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds an assignment submission by ID with revision history
   * 
   * @param id - Assignment submission ID
   * @returns The assignment submission with revisions if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByIdWithRevisions(id: string): Promise<AssignmentSubmissionWithRevisions | null> {
    try {
      // Check cache first
      const cacheKey = this.getSubmissionWithRevisionsCacheKey(id);
      const cachedSubmissionWithRevisions = await cache.get<AssignmentSubmissionWithRevisions>(cacheKey);
      
      if (cachedSubmissionWithRevisions) {
        return cachedSubmissionWithRevisions;
      }

      // First get the submission
      const submission = await this.findById(id);
      if (!submission) {
        return null;
      }

      // Get parent submission if this is a revision
      let parentSubmission: AssignmentSubmission | undefined;
      if (submission.parentSubmissionId) {
        parentSubmission = await this.findById(submission.parentSubmissionId) || undefined;
      }

      // Get all revisions (submissions that have this submission as parent)
      const revisions = await this.readDb
        .select()
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.parentSubmissionId, id))
        .orderBy(assignmentSubmissions.revisionNumber);

      const submissionWithRevisions: AssignmentSubmissionWithRevisions = {
        ...submission,
        revisions,
        parentSubmission,
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, submissionWithRevisions, CacheTTL.MEDIUM);

      return submissionWithRevisions;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find assignment submission with revisions by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds assignment submissions by assignment with pagination
   * 
   * @param assignmentId - Assignment ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment submission results
   * @throws DatabaseError if database operation fails
   */
  async findByAssignment(
    assignmentId: string,
    pagination: PaginationParams,
    filters?: AssignmentSubmissionFilters
  ): Promise<PaginatedResult<AssignmentSubmission>> {
    try {
      // Check cache first
      const cacheKey = this.getAssignmentSubmissionsCacheKey(
        assignmentId, 
        pagination.page, 
        pagination.limit, 
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<AssignmentSubmission>>(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(assignmentSubmissions.assignmentId, assignmentId)];
      
      if (filters?.studentId) {
        whereConditions.push(eq(assignmentSubmissions.studentId, filters.studentId));
      }
      
      if (filters?.gradingStatus) {
        whereConditions.push(eq(assignmentSubmissions.gradingStatus, filters.gradingStatus));
      }
      
      if (filters?.isLate !== undefined) {
        whereConditions.push(eq(assignmentSubmissions.isLate, filters.isLate));
      }
      
      if (filters?.submittedAfter) {
        whereConditions.push(gte(assignmentSubmissions.submittedAt, filters.submittedAfter));
      }
      
      if (filters?.submittedBefore) {
        whereConditions.push(lte(assignmentSubmissions.submittedAt, filters.submittedBefore));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(assignmentSubmissions)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const submissionsData = await this.readDb
        .select()
        .from(assignmentSubmissions)
        .where(whereClause)
        .orderBy(desc(assignmentSubmissions.submittedAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<AssignmentSubmission> = {
        data: submissionsData,
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
        'Failed to find assignment submissions by assignment',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds assignment submissions by student with pagination
   * 
   * @param studentId - Student ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment submission results
   * @throws DatabaseError if database operation fails
   */
  async findByStudent(
    studentId: string,
    pagination: PaginationParams,
    filters?: AssignmentSubmissionFilters
  ): Promise<PaginatedResult<AssignmentSubmission>> {
    try {
      // Check cache first
      const cacheKey = this.getStudentSubmissionsCacheKey(
        studentId, 
        pagination.page, 
        pagination.limit, 
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<AssignmentSubmission>>(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(assignmentSubmissions.studentId, studentId)];
      
      if (filters?.assignmentId) {
        whereConditions.push(eq(assignmentSubmissions.assignmentId, filters.assignmentId));
      }
      
      if (filters?.gradingStatus) {
        whereConditions.push(eq(assignmentSubmissions.gradingStatus, filters.gradingStatus));
      }
      
      if (filters?.isLate !== undefined) {
        whereConditions.push(eq(assignmentSubmissions.isLate, filters.isLate));
      }
      
      if (filters?.submittedAfter) {
        whereConditions.push(gte(assignmentSubmissions.submittedAt, filters.submittedAfter));
      }
      
      if (filters?.submittedBefore) {
        whereConditions.push(lte(assignmentSubmissions.submittedAt, filters.submittedBefore));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(assignmentSubmissions)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const submissionsData = await this.readDb
        .select()
        .from(assignmentSubmissions)
        .where(whereClause)
        .orderBy(desc(assignmentSubmissions.submittedAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<AssignmentSubmission> = {
        data: submissionsData,
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
        'Failed to find assignment submissions by student',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds the latest submission for a student and assignment
   * 
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns The latest submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findLatestByStudentAndAssignment(
    assignmentId: string,
    studentId: string
  ): Promise<AssignmentSubmission | null> {
    try {
      // Check cache first
      const cacheKey = this.getLatestSubmissionCacheKey(assignmentId, studentId);
      const cachedSubmission = await cache.get<AssignmentSubmission>(cacheKey);
      
      if (cachedSubmission) {
        return cachedSubmission;
      }

      // Query database for latest submission
      const [latestSubmission] = await this.readDb
        .select()
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, studentId)
          )
        )
        .orderBy(desc(assignmentSubmissions.submittedAt))
        .limit(1);

      if (!latestSubmission) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, latestSubmission, CacheTTL.MEDIUM);

      return latestSubmission;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find latest assignment submission',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets submission summary for a student and assignment
   * 
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns Submission summary
   * @throws DatabaseError if database operation fails
   */
  async getStudentSubmissionSummary(
    assignmentId: string,
    studentId: string
  ): Promise<StudentSubmissionSummary> {
    try {
      // Check cache first
      const cacheKey = this.getSubmissionSummaryCacheKey(assignmentId, studentId);
      const cachedSummary = await cache.get<StudentSubmissionSummary>(cacheKey);
      
      if (cachedSummary) {
        return cachedSummary;
      }

      // Get total submissions count
      const [countResult] = await this.readDb
        .select({ total: count() })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, studentId)
          )
        );

      const totalSubmissions = countResult?.total || 0;

      // Get latest submission
      const latestSubmission = await this.findLatestByStudentAndAssignment(assignmentId, studentId);

      // Get best score
      const [bestScoreResult] = await this.readDb
        .select({ 
          bestScore: sql<number>`MAX(${assignmentSubmissions.pointsAwarded})` 
        })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, studentId),
            sql`${assignmentSubmissions.pointsAwarded} IS NOT NULL`
          )
        );

      const bestScore = bestScoreResult?.bestScore || undefined;

      // Check if any submission has revision requested
      const [revisionResult] = await this.readDb
        .select({ count: count() })
        .from(assignmentSubmissions)
        .where(
          and(
            eq(assignmentSubmissions.assignmentId, assignmentId),
            eq(assignmentSubmissions.studentId, studentId),
            eq(assignmentSubmissions.gradingStatus, 'revision_requested')
          )
        );

      const hasRevisionRequested = (revisionResult?.count || 0) > 0;

      const summary: StudentSubmissionSummary = {
        assignmentId,
        studentId,
        totalSubmissions,
        latestSubmission: latestSubmission || undefined,
        bestScore,
        hasRevisionRequested,
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, summary, CacheTTL.MEDIUM);

      return summary;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get student submission summary',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all assignment submissions with pagination and filtering
   * 
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment submission results
   * @throws DatabaseError if database operation fails
   */
  async findAll(
    pagination: PaginationParams,
    filters?: AssignmentSubmissionFilters
  ): Promise<PaginatedResult<AssignmentSubmission>> {
    try {
      // Build where conditions
      const whereConditions = [];
      
      if (filters?.assignmentId) {
        whereConditions.push(eq(assignmentSubmissions.assignmentId, filters.assignmentId));
      }
      
      if (filters?.studentId) {
        whereConditions.push(eq(assignmentSubmissions.studentId, filters.studentId));
      }
      
      if (filters?.gradingStatus) {
        whereConditions.push(eq(assignmentSubmissions.gradingStatus, filters.gradingStatus));
      }
      
      if (filters?.isLate !== undefined) {
        whereConditions.push(eq(assignmentSubmissions.isLate, filters.isLate));
      }
      
      if (filters?.submittedAfter) {
        whereConditions.push(gte(assignmentSubmissions.submittedAt, filters.submittedAfter));
      }
      
      if (filters?.submittedBefore) {
        whereConditions.push(lte(assignmentSubmissions.submittedAt, filters.submittedBefore));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions.length === 1 
        ? whereConditions[0] 
        : undefined;

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(assignmentSubmissions)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const submissionsData = await this.readDb
        .select()
        .from(assignmentSubmissions)
        .where(whereClause)
        .orderBy(desc(assignmentSubmissions.submittedAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<AssignmentSubmission> = {
        data: submissionsData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find all assignment submissions',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates an assignment submission's data
   * 
   * @param id - Assignment submission ID
   * @param data - Update data
   * @returns The updated assignment submission
   * @throws NotFoundError if assignment submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateAssignmentSubmissionDTO): Promise<AssignmentSubmission> {
    try {
      // First, verify submission exists
      const existingSubmission = await this.findById(id);
      if (!existingSubmission) {
        throw new NotFoundError('Assignment submission', id);
      }

      // Prepare update data
      const updateData: Partial<NewAssignmentSubmission> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update assignment submission in database
      const [updatedSubmission] = await this.writeDb
        .update(assignmentSubmissions)
        .set(updateData)
        .where(eq(assignmentSubmissions.id, id))
        .returning();

      if (!updatedSubmission) {
        throw new DatabaseError(
          'Failed to update assignment submission',
          'update'
        );
      }

      // Invalidate all cache entries for this submission
      await this.invalidateCache(id);
      await this.invalidateCacheByAssignment(existingSubmission.assignmentId);
      await this.invalidateCacheByStudent(existingSubmission.studentId);

      return updatedSubmission;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NotFoundError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update assignment submission',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes an assignment submission from the database
   * This also deletes any child revisions
   * 
   * @param id - Assignment submission ID
   * @returns void
   * @throws NotFoundError if assignment submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get submission before deletion for cache invalidation
      const existingSubmission = await this.findById(id);
      if (!existingSubmission) {
        throw new NotFoundError('Assignment submission', id);
      }

      // Delete child revisions first (submissions that have this as parent)
      await this.writeDb
        .delete(assignmentSubmissions)
        .where(eq(assignmentSubmissions.parentSubmissionId, id));

      // Delete the submission itself
      const result = await this.writeDb
        .delete(assignmentSubmissions)
        .where(eq(assignmentSubmissions.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError(
          'Failed to delete assignment submission',
          'delete'
        );
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByAssignment(existingSubmission.assignmentId);
      await this.invalidateCacheByStudent(existingSubmission.studentId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete assignment submission',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if an assignment submission exists
   * 
   * @param id - Assignment submission ID
   * @returns True if assignment submission exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async exists(id: string): Promise<boolean> {
    try {
      const submission = await this.findById(id);
      return submission !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check assignment submission existence',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the revision count for a submission chain
   * 
   * @param parentSubmissionId - Parent submission ID (or any submission in the chain)
   * @returns Number of revisions in the chain
   * @throws DatabaseError if database operation fails
   */
  async getRevisionCount(parentSubmissionId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ count: count() })
        .from(assignmentSubmissions)
        .where(
          or(
            eq(assignmentSubmissions.id, parentSubmissionId),
            eq(assignmentSubmissions.parentSubmissionId, parentSubmissionId)
          )!
        );

      return result?.count || 0;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get revision count',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all revisions for a submission
   * 
   * @param parentSubmissionId - Parent submission ID
   * @returns Array of revisions ordered by revision number
   * @throws DatabaseError if database operation fails
   */
  async findRevisions(parentSubmissionId: string): Promise<AssignmentSubmission[]> {
    try {
      const revisions = await this.readDb
        .select()
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.parentSubmissionId, parentSubmissionId))
        .orderBy(assignmentSubmissions.revisionNumber);

      return revisions;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find revisions',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific assignment submission
   * Should be called after any update operation
   * 
   * @param id - Assignment submission ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKeys = [
        this.getSubmissionCacheKey(id),
        this.getSubmissionWithRevisionsCacheKey(id),
      ];
      
      await cache.deleteMany(cacheKeys);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for assignment submission ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for assignment submissions by assignment
   * Should be called after operations that affect assignment submission lists
   * 
   * @param assignmentId - Assignment ID
   * @returns void
   */
  async invalidateCacheByAssignment(assignmentId: string): Promise<void> {
    try {
      // Invalidate assignment submission list cache entries
      const assignmentPattern = buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'assignment', assignmentId, '*');
      await cache.deletePattern(assignmentPattern);
      
      // Invalidate latest submission cache entries for this assignment
      const latestPattern = buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'latest', assignmentId, '*');
      await cache.deletePattern(latestPattern);
      
      // Invalidate summary cache entries for this assignment
      const summaryPattern = buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'summary', assignmentId, '*');
      await cache.deletePattern(summaryPattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for assignment ${assignmentId}:`, error);
    }
  }

  /**
   * Invalidates cache for assignment submissions by student
   * Should be called after operations that affect student submission lists
   * 
   * @param studentId - Student ID
   * @returns void
   */
  async invalidateCacheByStudent(studentId: string): Promise<void> {
    try {
      // Invalidate student submission list cache entries
      const studentPattern = buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'student', studentId, '*');
      await cache.deletePattern(studentPattern);
      
      // Invalidate latest submission cache entries for this student
      const latestPattern = buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'latest', '*', studentId);
      await cache.deletePattern(latestPattern);
      
      // Invalidate summary cache entries for this student
      const summaryPattern = buildCacheKey(CachePrefix.ASSIGNMENT_SUBMISSION, 'summary', '*', studentId);
      await cache.deletePattern(summaryPattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for student ${studentId}:`, error);
    }
  }
}