/**
 * Quiz Submission Repository Implementation
 * 
 * Implements quiz submission data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 * 
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { eq, and, desc, count, sql, max, gte, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { cache, buildCacheKey, CachePrefix, CacheTTL } from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { 
  quizSubmissions,
  quizzes,
  QuizSubmission, 
  NewQuizSubmission
} from '../../../../infrastructure/database/schema/assessments.schema.js';
import { users, userProfiles } from '../../../../infrastructure/database/schema/users.schema.js';
import {
  DatabaseError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';

import {
  IQuizSubmissionRepository,
  CreateQuizSubmissionDTO,
  UpdateQuizSubmissionDTO,
  PaginationParams,
  PaginatedResult,
  QuizSubmissionFilters,
  QuizSubmissionWithDetails,
  StudentAttemptSummary,
} from './IQuizSubmissionRepository.js';

/**
 * Quiz Submission Repository Implementation
 * 
 * Provides data access methods for quiz submission entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Support for attempt tracking and grading workflows
 */
export class QuizSubmissionRepository implements IQuizSubmissionRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for quiz submission by ID
   */
  private getSubmissionCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.QUIZ, 'submission', id);
  }

  /**
   * Builds cache key for quiz submissions list
   */
  private getQuizSubmissionsCacheKey(
    quizId: string, 
    page: number, 
    limit: number,
    filters?: QuizSubmissionFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.QUIZ, 'submissions', quizId, page, limit, filterKey);
  }

  /**
   * Builds cache key for student submissions list
   */
  private getStudentSubmissionsCacheKey(
    studentId: string, 
    page: number, 
    limit: number,
    filters?: QuizSubmissionFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.QUIZ, 'student-submissions', studentId, page, limit, filterKey);
  }

  /**
   * Builds cache key for student attempt summary
   */
  private getAttemptSummaryCacheKey(quizId: string, studentId: string): string {
    return buildCacheKey(CachePrefix.QUIZ, 'attempt-summary', quizId, studentId);
  }

  /**
   * Creates a new quiz submission in the database
   * 
   * @param data - Quiz submission creation data
   * @returns The created quiz submission
   * @throws ValidationError if quiz, student, or enrollment doesn't exist
   * @throws ConflictError if attempt number conflicts
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateQuizSubmissionDTO): Promise<QuizSubmission> {
    try {
      // Prepare quiz submission data for insertion
      const newSubmission: NewQuizSubmission = {
        quizId: data.quizId,
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        attemptNumber: data.attemptNumber,
        answers: data.answers || {},
        gradingStatus: 'auto_graded', // Default status
      };

      // Insert quiz submission into database
      const [createdSubmission] = await this.writeDb
        .insert(quizSubmissions)
        .values(newSubmission)
        .returning();

      if (!createdSubmission) {
        throw new DatabaseError(
          'Failed to create quiz submission',
          'insert'
        );
      }

      // Invalidate related caches
      await this.invalidateCache(data.quizId, data.studentId);

      return createdSubmission;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('foreign key')) {
          if (error.message.includes('quiz')) {
            throw new ValidationError(
              'Invalid quiz ID',
              [{ field: 'quizId', message: 'Quiz does not exist' }]
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
        if (error.message.includes('unique') || error.message.includes('attempt')) {
          throw new ConflictError(
            'Attempt number already exists for this student and quiz',
            'attemptNumber'
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create quiz submission',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a quiz submission by its unique ID
   * 
   * @param id - Quiz submission ID
   * @returns The quiz submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<QuizSubmission | null> {
    try {
      // Check cache first
      const cacheKey = this.getSubmissionCacheKey(id);
      const cachedSubmission = await cache.get<QuizSubmission>(cacheKey);
      
      if (cachedSubmission) {
        return cachedSubmission;
      }

      // Query database if not in cache
      const [submission] = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(eq(quizSubmissions.id, id))
        .limit(1);

      if (!submission) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, submission, CacheTTL.MEDIUM);

      return submission;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find quiz submission by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a quiz submission by ID with related quiz and student data
   * 
   * @param id - Quiz submission ID
   * @returns The quiz submission with details if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByIdWithDetails(id: string): Promise<QuizSubmissionWithDetails | null> {
    try {
      // Query database with joins
      const [result] = await this.readDb
        .select({
          submission: quizSubmissions,
          quiz: {
            id: quizzes.id,
            title: quizzes.title,
            maxAttempts: quizzes.maxAttempts,
            passingScorePercentage: quizzes.passingScorePercentage,
          },
          student: {
            id: users.id,
            email: users.email,
          },
          profile: {
            fullName: userProfiles.fullName,
          },
        })
        .from(quizSubmissions)
        .leftJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
        .leftJoin(users, eq(quizSubmissions.studentId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(eq(quizSubmissions.id, id))
        .limit(1);

      if (!result) {
        return null;
      }

      const submissionWithDetails: QuizSubmissionWithDetails = {
        ...result.submission,
        quiz: result.quiz || undefined,
        student: {
          id: result.student?.id || '',
          email: result.student?.email || '',
          profile: result.profile || undefined,
        },
      };

      return submissionWithDetails;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find quiz submission with details by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds quiz submissions by quiz with pagination
   * 
   * @param quizId - Quiz ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz submission results
   * @throws DatabaseError if database operation fails
   */
  async findByQuiz(
    quizId: string,
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmission>> {
    try {
      // Check cache first
      const cacheKey = this.getQuizSubmissionsCacheKey(
        quizId, 
        pagination.page, 
        pagination.limit, 
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<QuizSubmission>>(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(quizSubmissions.quizId, quizId)];
      
      if (filters?.studentId) {
        whereConditions.push(eq(quizSubmissions.studentId, filters.studentId));
      }
      
      if (filters?.enrollmentId) {
        whereConditions.push(eq(quizSubmissions.enrollmentId, filters.enrollmentId));
      }
      
      if (filters?.gradingStatus) {
        whereConditions.push(eq(quizSubmissions.gradingStatus, filters.gradingStatus));
      }
      
      if (filters?.submittedOnly) {
        whereConditions.push(sql`${quizSubmissions.submittedAt} IS NOT NULL`);
      }
      
      if (filters?.dateFrom) {
        whereConditions.push(gte(quizSubmissions.startedAt, filters.dateFrom));
      }
      
      if (filters?.dateTo) {
        whereConditions.push(lte(quizSubmissions.startedAt, filters.dateTo));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(quizSubmissions)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const submissionsData = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(whereClause)
        .orderBy(desc(quizSubmissions.startedAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<QuizSubmission> = {
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
        'Failed to find quiz submissions by quiz',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds quiz submissions by student with pagination
   * 
   * @param studentId - Student ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz submission results
   * @throws DatabaseError if database operation fails
   */
  async findByStudent(
    studentId: string,
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmission>> {
    try {
      // Check cache first
      const cacheKey = this.getStudentSubmissionsCacheKey(
        studentId, 
        pagination.page, 
        pagination.limit, 
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<QuizSubmission>>(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(quizSubmissions.studentId, studentId)];
      
      if (filters?.quizId) {
        whereConditions.push(eq(quizSubmissions.quizId, filters.quizId));
      }
      
      if (filters?.enrollmentId) {
        whereConditions.push(eq(quizSubmissions.enrollmentId, filters.enrollmentId));
      }
      
      if (filters?.gradingStatus) {
        whereConditions.push(eq(quizSubmissions.gradingStatus, filters.gradingStatus));
      }
      
      if (filters?.submittedOnly) {
        whereConditions.push(sql`${quizSubmissions.submittedAt} IS NOT NULL`);
      }
      
      if (filters?.dateFrom) {
        whereConditions.push(gte(quizSubmissions.startedAt, filters.dateFrom));
      }
      
      if (filters?.dateTo) {
        whereConditions.push(lte(quizSubmissions.startedAt, filters.dateTo));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(quizSubmissions)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const submissionsData = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(whereClause)
        .orderBy(desc(quizSubmissions.startedAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<QuizSubmission> = {
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
        'Failed to find quiz submissions by student',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds quiz submissions by enrollment with pagination
   * 
   * @param enrollmentId - Enrollment ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz submission results
   * @throws DatabaseError if database operation fails
   */
  async findByEnrollment(
    enrollmentId: string,
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmission>> {
    try {
      // Build where conditions
      const whereConditions = [eq(quizSubmissions.enrollmentId, enrollmentId)];
      
      if (filters?.quizId) {
        whereConditions.push(eq(quizSubmissions.quizId, filters.quizId));
      }
      
      if (filters?.studentId) {
        whereConditions.push(eq(quizSubmissions.studentId, filters.studentId));
      }
      
      if (filters?.gradingStatus) {
        whereConditions.push(eq(quizSubmissions.gradingStatus, filters.gradingStatus));
      }
      
      if (filters?.submittedOnly) {
        whereConditions.push(sql`${quizSubmissions.submittedAt} IS NOT NULL`);
      }
      
      if (filters?.dateFrom) {
        whereConditions.push(gte(quizSubmissions.startedAt, filters.dateFrom));
      }
      
      if (filters?.dateTo) {
        whereConditions.push(lte(quizSubmissions.startedAt, filters.dateTo));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(quizSubmissions)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const submissionsData = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(whereClause)
        .orderBy(desc(quizSubmissions.startedAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<QuizSubmission> = {
        data: submissionsData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find quiz submissions by enrollment',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a specific attempt for a student and quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @param attemptNumber - Attempt number
   * @returns The quiz submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findAttempt(quizId: string, studentId: string, attemptNumber: number): Promise<QuizSubmission | null> {
    try {
      const [submission] = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.quizId, quizId),
            eq(quizSubmissions.studentId, studentId),
            eq(quizSubmissions.attemptNumber, attemptNumber)
          )
        )
        .limit(1);

      return submission || null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find quiz attempt',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds the latest attempt for a student and quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns The latest quiz submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findLatestAttempt(quizId: string, studentId: string): Promise<QuizSubmission | null> {
    try {
      const [submission] = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.quizId, quizId),
            eq(quizSubmissions.studentId, studentId)
          )
        )
        .orderBy(desc(quizSubmissions.attemptNumber))
        .limit(1);

      return submission || null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find latest quiz attempt',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all attempts for a student and quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns All quiz submissions for the student and quiz
   * @throws DatabaseError if database operation fails
   */
  async findAllAttempts(quizId: string, studentId: string): Promise<QuizSubmission[]> {
    try {
      const submissions = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.quizId, quizId),
            eq(quizSubmissions.studentId, studentId)
          )
        )
        .orderBy(quizSubmissions.attemptNumber);

      return submissions;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find all quiz attempts',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds submissions pending manual grading
   * 
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated submissions pending review
   * @throws DatabaseError if database operation fails
   */
  async findPendingGrading(
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmissionWithDetails>> {
    try {
      // Build where conditions
      const whereConditions = [eq(quizSubmissions.gradingStatus, 'pending_review')];
      
      if (filters?.quizId) {
        whereConditions.push(eq(quizSubmissions.quizId, filters.quizId));
      }
      
      if (filters?.studentId) {
        whereConditions.push(eq(quizSubmissions.studentId, filters.studentId));
      }
      
      if (filters?.enrollmentId) {
        whereConditions.push(eq(quizSubmissions.enrollmentId, filters.enrollmentId));
      }
      
      if (filters?.dateFrom) {
        whereConditions.push(gte(quizSubmissions.submittedAt, filters.dateFrom));
      }
      
      if (filters?.dateTo) {
        whereConditions.push(lte(quizSubmissions.submittedAt, filters.dateTo));
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(quizSubmissions)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results with details
      const offset = (pagination.page - 1) * pagination.limit;
      const results = await this.readDb
        .select({
          submission: quizSubmissions,
          quiz: {
            id: quizzes.id,
            title: quizzes.title,
            maxAttempts: quizzes.maxAttempts,
            passingScorePercentage: quizzes.passingScorePercentage,
          },
          student: {
            id: users.id,
            email: users.email,
          },
          profile: {
            fullName: userProfiles.fullName,
          },
        })
        .from(quizSubmissions)
        .leftJoin(quizzes, eq(quizSubmissions.quizId, quizzes.id))
        .leftJoin(users, eq(quizSubmissions.studentId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(whereClause)
        .orderBy(desc(quizSubmissions.submittedAt))
        .limit(pagination.limit)
        .offset(offset);

      const submissionsWithDetails: QuizSubmissionWithDetails[] = results.map(result => ({
        ...result.submission,
        quiz: result.quiz || undefined,
        student: {
          id: result.student?.id || '',
          email: result.student?.email || '',
          profile: result.profile || undefined,
        },
      }));

      const result: PaginatedResult<QuizSubmissionWithDetails> = {
        data: submissionsWithDetails,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find pending grading submissions',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a quiz submission's data
   * 
   * @param id - Quiz submission ID
   * @param data - Update data
   * @returns The updated quiz submission
   * @throws NotFoundError if quiz submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateQuizSubmissionDTO): Promise<QuizSubmission> {
    try {
      // First, verify submission exists
      const existingSubmission = await this.findById(id);
      if (!existingSubmission) {
        throw new NotFoundError('Quiz submission', id);
      }

      // Prepare update data
      const updateData: Partial<NewQuizSubmission> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update submission in database
      const [updatedSubmission] = await this.writeDb
        .update(quizSubmissions)
        .set(updateData)
        .where(eq(quizSubmissions.id, id))
        .returning();

      if (!updatedSubmission) {
        throw new DatabaseError(
          'Failed to update quiz submission',
          'update'
        );
      }

      // Invalidate cache
      await cache.delete(this.getSubmissionCacheKey(id));
      await this.invalidateCache(existingSubmission.quizId, existingSubmission.studentId);

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
        'Failed to update quiz submission',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a quiz submission from the database
   * 
   * @param id - Quiz submission ID
   * @returns void
   * @throws NotFoundError if quiz submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get submission before deletion for cache invalidation
      const existingSubmission = await this.findById(id);
      if (!existingSubmission) {
        throw new NotFoundError('Quiz submission', id);
      }

      // Delete submission
      const result = await this.writeDb
        .delete(quizSubmissions)
        .where(eq(quizSubmissions.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError(
          'Failed to delete quiz submission',
          'delete'
        );
      }

      // Invalidate cache
      await cache.delete(this.getSubmissionCacheKey(id));
      await this.invalidateCache(existingSubmission.quizId, existingSubmission.studentId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete quiz submission',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes all submissions for a quiz
   * 
   * @param quizId - Quiz ID
   * @returns Number of deleted submissions
   * @throws DatabaseError if database operation fails
   */
  async deleteByQuiz(quizId: string): Promise<number> {
    try {
      // Get all submissions for cache invalidation
      const existingSubmissions = await this.readDb
        .select()
        .from(quizSubmissions)
        .where(eq(quizSubmissions.quizId, quizId));

      // Delete all submissions for the quiz
      const result = await this.writeDb
        .delete(quizSubmissions)
        .where(eq(quizSubmissions.quizId, quizId))
        .returning();

      // Invalidate cache for all deleted submissions
      await Promise.all([
        ...existingSubmissions.map(s => cache.delete(this.getSubmissionCacheKey(s.id))),
        ...existingSubmissions.map(s => this.invalidateCache(s.quizId, s.studentId))
      ]);

      return result.length;
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete quiz submissions by quiz',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the next attempt number for a student and quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Next attempt number
   * @throws DatabaseError if database operation fails
   */
  async getNextAttemptNumber(quizId: string, studentId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ maxAttempt: max(quizSubmissions.attemptNumber) })
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.quizId, quizId),
            eq(quizSubmissions.studentId, studentId)
          )
        );

      return (result?.maxAttempt || 0) + 1;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get next attempt number',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Counts total attempts for a student and quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Number of attempts
   * @throws DatabaseError if database operation fails
   */
  async countAttempts(quizId: string, studentId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ count: count() })
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.quizId, quizId),
            eq(quizSubmissions.studentId, studentId)
          )
        );

      return result?.count || 0;
    } catch (error) {
      throw new DatabaseError(
        'Failed to count attempts',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the best score for a student and quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Best score percentage, null if no attempts
   * @throws DatabaseError if database operation fails
   */
  async getBestScore(quizId: string, studentId: string): Promise<number | null> {
    try {
      const [result] = await this.readDb
        .select({ 
          bestScore: sql<string>`MAX(${quizSubmissions.scorePercentage})` 
        })
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.quizId, quizId),
            eq(quizSubmissions.studentId, studentId),
            sql`${quizSubmissions.scorePercentage} IS NOT NULL`
          )
        );

      return result?.bestScore ? parseFloat(result.bestScore) : null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get best score',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets attempt summary for a student and quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Student attempt summary
   * @throws DatabaseError if database operation fails
   */
  async getAttemptSummary(quizId: string, studentId: string): Promise<StudentAttemptSummary> {
    try {
      // Check cache first
      const cacheKey = this.getAttemptSummaryCacheKey(quizId, studentId);
      const cachedSummary = await cache.get<StudentAttemptSummary>(cacheKey);
      
      if (cachedSummary) {
        return cachedSummary;
      }

      const [result] = await this.readDb
        .select({
          totalAttempts: count(),
          bestScore: sql<string>`MAX(${quizSubmissions.scorePercentage})`,
          lastAttemptAt: sql<Date>`MAX(${quizSubmissions.startedAt})`,
        })
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.quizId, quizId),
            eq(quizSubmissions.studentId, studentId)
          )
        );

      // Get quiz passing score to determine if student has passing score
      const [quiz] = await this.readDb
        .select({ passingScorePercentage: quizzes.passingScorePercentage })
        .from(quizzes)
        .where(eq(quizzes.id, quizId))
        .limit(1);

      const bestScore = result?.bestScore ? parseFloat(result.bestScore) : null;
      const passingScore = quiz?.passingScorePercentage || 0;
      
      const summary: StudentAttemptSummary = {
        studentId,
        quizId,
        totalAttempts: result?.totalAttempts || 0,
        bestScore,
        lastAttemptAt: result?.lastAttemptAt || null,
        hasPassingScore: bestScore !== null && bestScore >= passingScore,
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, summary, CacheTTL.MEDIUM);

      return summary;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get attempt summary',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a student has a passing score for a quiz
   * 
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns True if student has passing score, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async hasPassingScore(quizId: string, studentId: string): Promise<boolean> {
    try {
      const summary = await this.getAttemptSummary(quizId, studentId);
      return summary.hasPassingScore;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check passing score',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a quiz submission exists
   * 
   * @param id - Quiz submission ID
   * @returns True if submission exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async exists(id: string): Promise<boolean> {
    try {
      const submission = await this.findById(id);
      return submission !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check quiz submission existence',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for quiz submissions
   * Should be called after any update operation
   * 
   * @param quizId - Quiz ID
   * @param studentId - Optional student ID for targeted invalidation
   * @returns void
   */
  async invalidateCache(quizId: string, studentId?: string): Promise<void> {
    try {
      const patterns = [
        buildCacheKey(CachePrefix.QUIZ, 'submissions', quizId, '*'),
      ];

      if (studentId) {
        patterns.push(
          buildCacheKey(CachePrefix.QUIZ, 'student-submissions', studentId, '*'),
          this.getAttemptSummaryCacheKey(quizId, studentId)
        );
      }

      await Promise.all(patterns.map(pattern => cache.deletePattern(pattern)));
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for quiz submissions ${quizId}:`, error);
    }
  }
}