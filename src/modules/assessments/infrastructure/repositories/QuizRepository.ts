/**
 * Quiz Repository Implementation
 * 
 * Implements quiz data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 * 
 * Requirements: 6.1, 6.2, 6.3
 */

import { eq, and, desc, count, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { cache, buildCacheKey, CachePrefix, CacheTTL } from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import { 
  quizzes, 
  questions,
  Quiz, 
  NewQuiz
} from '../../../../infrastructure/database/schema/assessments.schema.js';
import {
  DatabaseError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';

import {
  IQuizRepository,
  CreateQuizDTO,
  UpdateQuizDTO,
  PaginationParams,
  PaginatedResult,
  QuizFilters,
  QuizWithQuestions,
} from './IQuizRepository.js';

/**
 * Quiz Repository Implementation
 * 
 * Provides data access methods for quiz entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Support for quiz availability checking
 */
export class QuizRepository implements IQuizRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for quiz by ID
   */
  private getQuizCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.QUIZ, 'id', id);
  }

  /**
   * Builds cache key for quiz with questions by ID
   */
  private getQuizWithQuestionsCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.QUIZ, 'with-questions', id);
  }

  /**
   * Builds cache key for lesson quizzes list
   */
  private getLessonQuizzesCacheKey(
    lessonId: string, 
    page: number, 
    limit: number,
    filters?: QuizFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.QUIZ, 'lesson', lessonId, page, limit, filterKey);
  }

  /**
   * Builds cache key for all quizzes list
   */
  private getAllQuizzesCacheKey(
    page: number, 
    limit: number,
    filters?: QuizFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.QUIZ, 'all', page, limit, filterKey);
  }

  /**
   * Creates a new quiz in the database
   * 
   * @param data - Quiz creation data
   * @returns The created quiz
   * @throws ValidationError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateQuizDTO): Promise<Quiz> {
    try {
      // Prepare quiz data for insertion
      const newQuiz: NewQuiz = {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        quizType: data.quizType,
        timeLimitMinutes: data.timeLimitMinutes,
        passingScorePercentage: data.passingScorePercentage,
        maxAttempts: data.maxAttempts || 0,
        randomizeQuestions: data.randomizeQuestions || false,
        randomizeOptions: data.randomizeOptions || false,
        showCorrectAnswers: data.showCorrectAnswers ?? true,
        showExplanations: data.showExplanations ?? true,
        availableFrom: data.availableFrom,
        availableUntil: data.availableUntil,
      };

      // Insert quiz into database
      const [createdQuiz] = await this.writeDb
        .insert(quizzes)
        .values(newQuiz)
        .returning();

      if (!createdQuiz) {
        throw new DatabaseError(
          'Failed to create quiz',
          'insert'
        );
      }

      // Invalidate lesson quizzes cache
      await this.invalidateCacheByLesson(data.lessonId);

      return createdQuiz;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('foreign key') || error.message.includes('lesson')) {
          throw new ValidationError(
            'Invalid lesson ID',
            [{ field: 'lessonId', message: 'Lesson does not exist' }]
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create quiz',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a quiz by its unique ID
   * 
   * @param id - Quiz ID
   * @returns The quiz if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Quiz | null> {
    try {
      // Check cache first
      const cacheKey = this.getQuizCacheKey(id);
      const cachedQuiz = await cache.get<Quiz>(cacheKey);
      
      if (cachedQuiz) {
        return cachedQuiz;
      }

      // Query database if not in cache
      const [quiz] = await this.readDb
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, id))
        .limit(1);

      if (!quiz) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, quiz, CacheTTL.MEDIUM);

      return quiz;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find quiz by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a quiz by ID with all questions included
   * 
   * @param id - Quiz ID
   * @returns The quiz with questions if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByIdWithQuestions(id: string): Promise<QuizWithQuestions | null> {
    try {
      // Check cache first
      const cacheKey = this.getQuizWithQuestionsCacheKey(id);
      const cachedQuizWithQuestions = await cache.get<QuizWithQuestions>(cacheKey);
      
      if (cachedQuizWithQuestions) {
        return cachedQuizWithQuestions;
      }

      // First get the quiz
      const quiz = await this.findById(id);
      if (!quiz) {
        return null;
      }

      // Then get all questions for the quiz
      const quizQuestions = await this.readDb
        .select()
        .from(questions)
        .where(eq(questions.quizId, id))
        .orderBy(questions.orderNumber);

      const quizWithQuestions: QuizWithQuestions = {
        ...quiz,
        questions: quizQuestions,
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, quizWithQuestions, CacheTTL.MEDIUM);

      return quizWithQuestions;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find quiz with questions by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds quizzes by lesson with pagination
   * 
   * @param lessonId - Lesson ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz results
   * @throws DatabaseError if database operation fails
   */
  async findByLesson(
    lessonId: string,
    pagination: PaginationParams,
    filters?: QuizFilters
  ): Promise<PaginatedResult<Quiz>> {
    try {
      // Check cache first
      const cacheKey = this.getLessonQuizzesCacheKey(
        lessonId, 
        pagination.page, 
        pagination.limit, 
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<Quiz>>(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(quizzes.lessonId, lessonId)];
      
      if (filters?.quizType) {
        whereConditions.push(eq(quizzes.quizType, filters.quizType));
      }
      
      if (filters?.availableOnly) {
        const now = new Date();
        whereConditions.push(
          and(
            sql`(${quizzes.availableFrom} IS NULL OR ${quizzes.availableFrom} <= ${now})`,
            sql`(${quizzes.availableUntil} IS NULL OR ${quizzes.availableUntil} >= ${now})`
          )!
        );
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(quizzes)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const quizzesData = await this.readDb
        .select()
        .from(quizzes)
        .where(whereClause)
        .orderBy(desc(quizzes.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Quiz> = {
        data: quizzesData,
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
        'Failed to find quizzes by lesson',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all quizzes with pagination and filtering
   * 
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz results
   * @throws DatabaseError if database operation fails
   */
  async findAll(
    pagination: PaginationParams,
    filters?: QuizFilters
  ): Promise<PaginatedResult<Quiz>> {
    try {
      // Check cache first
      const cacheKey = this.getAllQuizzesCacheKey(
        pagination.page, 
        pagination.limit, 
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<Quiz>>(cacheKey);
      
      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [];
      
      if (filters?.lessonId) {
        whereConditions.push(eq(quizzes.lessonId, filters.lessonId));
      }
      
      if (filters?.quizType) {
        whereConditions.push(eq(quizzes.quizType, filters.quizType));
      }
      
      if (filters?.availableOnly) {
        const now = new Date();
        whereConditions.push(
          and(
            sql`(${quizzes.availableFrom} IS NULL OR ${quizzes.availableFrom} <= ${now})`,
            sql`(${quizzes.availableUntil} IS NULL OR ${quizzes.availableUntil} >= ${now})`
          )!
        );
      }

      const whereClause = whereConditions.length > 1 
        ? and(...whereConditions) 
        : whereConditions.length === 1 
        ? whereConditions[0] 
        : undefined;

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(quizzes)
        .where(whereClause);
      
      const total = totalResult?.total || 0;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const quizzesData = await this.readDb
        .select()
        .from(quizzes)
        .where(whereClause)
        .orderBy(desc(quizzes.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Quiz> = {
        data: quizzesData,
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
        'Failed to find all quizzes',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a quiz's data
   * 
   * @param id - Quiz ID
   * @param data - Update data
   * @returns The updated quiz
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateQuizDTO): Promise<Quiz> {
    try {
      // First, verify quiz exists
      const existingQuiz = await this.findById(id);
      if (!existingQuiz) {
        throw new NotFoundError('Quiz', id);
      }

      // Prepare update data
      const updateData: Partial<NewQuiz> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update quiz in database
      const [updatedQuiz] = await this.writeDb
        .update(quizzes)
        .set(updateData)
        .where(eq(quizzes.id, id))
        .returning();

      if (!updatedQuiz) {
        throw new DatabaseError(
          'Failed to update quiz',
          'update'
        );
      }

      // Invalidate all cache entries for this quiz
      await this.invalidateCache(id);
      await this.invalidateCacheByLesson(existingQuiz.lessonId);

      return updatedQuiz;
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
        'Failed to update quiz',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a quiz from the database
   * This cascades to delete all questions and submissions
   * 
   * @param id - Quiz ID
   * @returns void
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get quiz before deletion for cache invalidation
      const existingQuiz = await this.findById(id);
      if (!existingQuiz) {
        throw new NotFoundError('Quiz', id);
      }

      // Delete quiz (cascades to questions and submissions)
      const result = await this.writeDb
        .delete(quizzes)
        .where(eq(quizzes.id, id))
        .returning();

      if (!result || result.length === 0) {
        throw new DatabaseError(
          'Failed to delete quiz',
          'delete'
        );
      }

      // Invalidate all cache entries
      await this.invalidateCache(id);
      await this.invalidateCacheByLesson(existingQuiz.lessonId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete quiz',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a quiz exists
   * 
   * @param id - Quiz ID
   * @returns True if quiz exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async exists(id: string): Promise<boolean> {
    try {
      const quiz = await this.findById(id);
      return quiz !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check quiz existence',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a quiz is available for taking at the current time
   * 
   * @param id - Quiz ID
   * @returns True if quiz is available, false otherwise
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async isAvailable(id: string): Promise<boolean> {
    try {
      const quiz = await this.findById(id);
      if (!quiz) {
        throw new NotFoundError('Quiz', id);
      }

      const now = new Date();
      
      // Check availability window
      if (quiz.availableFrom && quiz.availableFrom > now) {
        return false;
      }
      
      if (quiz.availableUntil && quiz.availableUntil < now) {
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to check quiz availability',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the total number of questions in a quiz
   * 
   * @param id - Quiz ID
   * @returns Number of questions
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async getQuestionCount(id: string): Promise<number> {
    try {
      // Verify quiz exists
      const quiz = await this.findById(id);
      if (!quiz) {
        throw new NotFoundError('Quiz', id);
      }

      const [result] = await this.readDb
        .select({ count: count() })
        .from(questions)
        .where(eq(questions.quizId, id));

      return result?.count || 0;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to get question count',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the total points possible for a quiz
   * 
   * @param id - Quiz ID
   * @returns Total points
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async getTotalPoints(id: string): Promise<number> {
    try {
      // Verify quiz exists
      const quiz = await this.findById(id);
      if (!quiz) {
        throw new NotFoundError('Quiz', id);
      }

      const [result] = await this.readDb
        .select({ total: sql<number>`COALESCE(SUM(${questions.points}), 0)` })
        .from(questions)
        .where(eq(questions.quizId, id));

      return result?.total || 0;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new DatabaseError(
        'Failed to get total points',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific quiz
   * Should be called after any update operation
   * 
   * @param id - Quiz ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKeys = [
        this.getQuizCacheKey(id),
        this.getQuizWithQuestionsCacheKey(id),
      ];
      
      await cache.deleteMany(cacheKeys);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for quiz ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for quizzes by lesson
   * Should be called after operations that affect lesson quiz lists
   * 
   * @param lessonId - Lesson ID
   * @returns void
   */
  async invalidateCacheByLesson(lessonId: string): Promise<void> {
    try {
      // Invalidate lesson quiz list cache entries
      const lessonPattern = buildCacheKey(CachePrefix.QUIZ, 'lesson', lessonId, '*');
      await cache.deletePattern(lessonPattern);
      
      // Also invalidate all quizzes cache as it might be affected
      const allPattern = buildCacheKey(CachePrefix.QUIZ, 'all', '*');
      await cache.deletePattern(allPattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for lesson ${lessonId}:`, error);
    }
  }
}