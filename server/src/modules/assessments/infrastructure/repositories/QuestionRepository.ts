/**
 * Question Repository Implementation
 *
 * Implements question data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 6.1, 6.2
 */

import { eq, and, count, sql, inArray } from 'drizzle-orm';
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
  questions,
  Question,
  NewQuestion,
} from '../../../../infrastructure/database/schema/assessments.schema.js';
import {
  DatabaseError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/errors/index.js';

import {
  IQuestionRepository,
  CreateQuestionDTO,
  UpdateQuestionDTO,
  PaginationParams,
  PaginatedResult,
  QuestionFilters,
} from './IQuestionRepository.js';

/**
 * Question Repository Implementation
 *
 * Provides data access methods for question entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Support for question ordering and reordering
 */
export class QuestionRepository implements IQuestionRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for question by ID
   */
  private getQuestionCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.QUIZ, 'question', id);
  }

  /**
   * Builds cache key for quiz questions list
   */
  private getQuizQuestionsCacheKey(
    quizId: string,
    page: number,
    limit: number,
    filters?: QuestionFilters
  ): string {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    return buildCacheKey(CachePrefix.QUIZ, 'questions', quizId, page, limit, filterKey);
  }

  /**
   * Builds cache key for all quiz questions
   */
  private getAllQuizQuestionsCacheKey(quizId: string, randomize?: boolean): string {
    return buildCacheKey(
      CachePrefix.QUIZ,
      'all-questions',
      quizId,
      randomize ? 'random' : 'ordered'
    );
  }

  /**
   * Creates a new question in the database
   *
   * @param data - Question creation data
   * @returns The created question
   * @throws ValidationError if quiz doesn't exist
   * @throws ConflictError if order number conflicts
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateQuestionDTO): Promise<Question> {
    try {
      // Prepare question data for insertion
      const newQuestion: NewQuestion = {
        quizId: data.quizId,
        questionType: data.questionType,
        questionText: data.questionText,
        questionMediaUrl: data.questionMediaUrl,
        options: data.options,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        points: data.points || 1,
        orderNumber: data.orderNumber,
        difficulty: data.difficulty || 'medium',
      };

      // Insert question into database
      const [createdQuestion] = await this.writeDb
        .insert(questions)
        .values(newQuestion)
        .returning();

      if (!createdQuestion) {
        throw new DatabaseError('Failed to create question', 'insert');
      }

      // Invalidate quiz questions cache
      await this.invalidateCacheByQuiz(data.quizId);

      return createdQuestion;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('foreign key') || error.message.includes('quiz')) {
          throw new ValidationError('Invalid quiz ID', [
            { field: 'quizId', message: 'Quiz does not exist' },
          ]);
        }
        if (error.message.includes('unique') || error.message.includes('order')) {
          throw new ConflictError('Order number already exists for this quiz', 'orderNumber');
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create question',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Creates multiple questions in a single transaction
   *
   * @param questions - Array of question creation data
   * @returns The created questions
   * @throws ValidationError if quiz doesn't exist
   * @throws ConflictError if order numbers conflict
   * @throws DatabaseError if database operation fails
   */
  async createMany(questionsData: CreateQuestionDTO[]): Promise<Question[]> {
    try {
      if (questionsData.length === 0) {
        return [];
      }

      const result = await withDrizzleTransaction(async (tx) => {
        const createdQuestions: Question[] = [];

        for (const data of questionsData) {
          const newQuestion: NewQuestion = {
            quizId: data.quizId,
            questionType: data.questionType,
            questionText: data.questionText,
            questionMediaUrl: data.questionMediaUrl,
            options: data.options,
            correctAnswer: data.correctAnswer,
            explanation: data.explanation,
            points: data.points || 1,
            orderNumber: data.orderNumber,
            difficulty: data.difficulty || 'medium',
          };

          const [createdQuestion] = await tx.insert(questions).values(newQuestion).returning();

          if (!createdQuestion) {
            throw new DatabaseError('Failed to create question in batch', 'insert');
          }

          createdQuestions.push(createdQuestion);
        }

        return createdQuestions;
      });

      // Invalidate cache for all affected quizzes
      const quizIds = Array.from(new Set(questionsData.map((q) => q.quizId)));
      await Promise.all(quizIds.map((quizId) => this.invalidateCacheByQuiz(quizId)));

      return result;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof ValidationError ||
        error instanceof ConflictError ||
        error instanceof DatabaseError
      ) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('foreign key') || error.message.includes('quiz')) {
          throw new ValidationError('Invalid quiz ID in batch', [
            { field: 'quizId', message: 'One or more quizzes do not exist' },
          ]);
        }
        if (error.message.includes('unique') || error.message.includes('order')) {
          throw new ConflictError('Order number conflicts in batch', 'orderNumber');
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create questions in batch',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a question by its unique ID
   *
   * @param id - Question ID
   * @returns The question if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Question | null> {
    try {
      // Check cache first
      const cacheKey = this.getQuestionCacheKey(id);
      const cachedQuestion = await cache.get<Question>(cacheKey);

      if (cachedQuestion) {
        return cachedQuestion;
      }

      // Query database if not in cache
      const [question] = await this.readDb
        .select()
        .from(questions)
        .where(eq(questions.id, id))
        .limit(1);

      if (!question) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, question, CacheTTL.MEDIUM);

      return question;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find question by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds questions by quiz with pagination and ordering
   *
   * @param quizId - Quiz ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated question results ordered by orderNumber
   * @throws DatabaseError if database operation fails
   */
  async findByQuiz(
    quizId: string,
    pagination: PaginationParams,
    filters?: QuestionFilters
  ): Promise<PaginatedResult<Question>> {
    try {
      // Check cache first
      const cacheKey = this.getQuizQuestionsCacheKey(
        quizId,
        pagination.page,
        pagination.limit,
        filters
      );
      const cachedResult = await cache.get<PaginatedResult<Question>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Build where conditions
      const whereConditions = [eq(questions.quizId, quizId)];

      if (filters?.questionType) {
        whereConditions.push(eq(questions.questionType, filters.questionType));
      }

      if (filters?.difficulty) {
        whereConditions.push(eq(questions.difficulty, filters.difficulty));
      }

      if (filters?.minPoints !== undefined) {
        whereConditions.push(sql`${questions.points} >= ${filters.minPoints}`);
      }

      if (filters?.maxPoints !== undefined) {
        whereConditions.push(sql`${questions.points} <= ${filters.maxPoints}`);
      }

      const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

      // Get total count
      const [totalResult] = await this.readDb
        .select({ total: count() })
        .from(questions)
        .where(whereClause);

      const total = totalResult?.total || 0;

      // Get paginated results ordered by orderNumber
      const offset = (pagination.page - 1) * pagination.limit;
      const questionsData = await this.readDb
        .select()
        .from(questions)
        .where(whereClause)
        .orderBy(questions.orderNumber)
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Question> = {
        data: questionsData,
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
        'Failed to find questions by quiz',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds all questions for a quiz ordered by orderNumber
   *
   * @param quizId - Quiz ID
   * @param randomize - Whether to randomize the order
   * @returns All questions for the quiz
   * @throws DatabaseError if database operation fails
   */
  async findAllByQuiz(quizId: string, randomize?: boolean): Promise<Question[]> {
    try {
      // Check cache first
      const cacheKey = this.getAllQuizQuestionsCacheKey(quizId, randomize);
      const cachedQuestions = await cache.get<Question[]>(cacheKey);

      if (cachedQuestions) {
        return cachedQuestions;
      }

      // Query database with ordering
      const questionsData = await this.readDb
        .select()
        .from(questions)
        .where(eq(questions.quizId, quizId))
        .orderBy(randomize ? sql`RANDOM()` : questions.orderNumber);

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, questionsData, CacheTTL.MEDIUM);

      return questionsData;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find all questions by quiz',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a question's data
   *
   * @param id - Question ID
   * @param data - Update data
   * @returns The updated question
   * @throws NotFoundError if question doesn't exist
   * @throws ConflictError if order number update conflicts
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateQuestionDTO): Promise<Question> {
    try {
      // First, verify question exists
      const existingQuestion = await this.findById(id);
      if (!existingQuestion) {
        throw new NotFoundError('Question', id);
      }

      // Prepare update data
      const updateData: Partial<NewQuestion> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update question in database
      const [updatedQuestion] = await this.writeDb
        .update(questions)
        .set(updateData)
        .where(eq(questions.id, id))
        .returning();

      if (!updatedQuestion) {
        throw new DatabaseError('Failed to update question', 'update');
      }

      // Invalidate cache
      await cache.delete(this.getQuestionCacheKey(id));
      await this.invalidateCacheByQuiz(existingQuestion.quizId);

      return updatedQuestion;
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
        if (error.message.includes('unique') || error.message.includes('order')) {
          throw new ConflictError('Order number already exists for this quiz', 'orderNumber');
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update question',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates multiple questions in a single transaction
   *
   * @param updates - Array of question updates with IDs
   * @returns The updated questions
   * @throws NotFoundError if any question doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async updateMany(updates: Array<{ id: string; data: UpdateQuestionDTO }>): Promise<Question[]> {
    try {
      if (updates.length === 0) {
        return [];
      }

      const result = await withDrizzleTransaction(async (tx) => {
        const updatedQuestions: Question[] = [];
        const affectedQuizIds = new Set<string>();

        for (const { id, data } of updates) {
          // Get existing question to track affected quizzes
          const [existingQuestion] = await tx
            .select()
            .from(questions)
            .where(eq(questions.id, id))
            .limit(1);

          if (!existingQuestion) {
            throw new NotFoundError('Question', id);
          }

          affectedQuizIds.add(existingQuestion.quizId);

          const updateData: Partial<NewQuestion> = {
            ...data,
            updatedAt: new Date(),
          };

          const [updatedQuestion] = await tx
            .update(questions)
            .set(updateData)
            .where(eq(questions.id, id))
            .returning();

          if (!updatedQuestion) {
            throw new DatabaseError('Failed to update question in batch', 'update');
          }

          updatedQuestions.push(updatedQuestion);
        }

        // Invalidate cache for all affected questions and quizzes
        await Promise.all([
          ...updates.map(({ id }) => cache.delete(this.getQuestionCacheKey(id))),
          ...Array.from(affectedQuizIds).map((quizId) => this.invalidateCacheByQuiz(quizId)),
        ]);

        return updatedQuestions;
      });

      return result;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update questions in batch',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes a question from the database
   *
   * @param id - Question ID
   * @returns void
   * @throws NotFoundError if question doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async delete(id: string): Promise<void> {
    try {
      // Get question before deletion for cache invalidation
      const existingQuestion = await this.findById(id);
      if (!existingQuestion) {
        throw new NotFoundError('Question', id);
      }

      // Delete question
      const result = await this.writeDb.delete(questions).where(eq(questions.id, id)).returning();

      if (!result || result.length === 0) {
        throw new DatabaseError('Failed to delete question', 'delete');
      }

      // Invalidate cache
      await cache.delete(this.getQuestionCacheKey(id));
      await this.invalidateCacheByQuiz(existingQuestion.quizId);
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to delete question',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deletes all questions for a quiz
   *
   * @param quizId - Quiz ID
   * @returns Number of deleted questions
   * @throws DatabaseError if database operation fails
   */
  async deleteByQuiz(quizId: string): Promise<number> {
    try {
      // Get all questions for cache invalidation
      const existingQuestions = await this.findAllByQuiz(quizId);

      // Delete all questions for the quiz
      const result = await this.writeDb
        .delete(questions)
        .where(eq(questions.quizId, quizId))
        .returning();

      // Invalidate cache for all deleted questions
      await Promise.all([
        ...existingQuestions.map((q) => cache.delete(this.getQuestionCacheKey(q.id))),
        this.invalidateCacheByQuiz(quizId),
      ]);

      return result.length;
    } catch (error) {
      throw new DatabaseError(
        'Failed to delete questions by quiz',
        'delete',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Reorders questions within a quiz
   * Updates orderNumber for all provided question IDs
   *
   * @param quizId - Quiz ID
   * @param questionIds - Array of question IDs in desired order
   * @returns void
   * @throws NotFoundError if quiz doesn't exist
   * @throws ValidationError if question IDs don't belong to quiz
   * @throws DatabaseError if database operation fails
   */
  async reorder(quizId: string, questionIds: string[]): Promise<void> {
    try {
      // Validate that all questions belong to the quiz
      const isValid = await this.validateQuestionsBelongToQuiz(quizId, questionIds);
      if (!isValid) {
        throw new ValidationError('Some questions do not belong to the specified quiz', [
          { field: 'questionIds', message: 'Invalid question IDs for this quiz' },
        ]);
      }

      // Update order numbers in a transaction
      await withDrizzleTransaction(async (tx) => {
        for (let i = 0; i < questionIds.length; i++) {
          await tx
            .update(questions)
            .set({
              orderNumber: i + 1,
              updatedAt: new Date(),
            })
            .where(eq(questions.id, questionIds[i]!));
        }
      });

      // Invalidate cache for all affected questions and quiz
      await Promise.all([
        ...questionIds.map((id) => cache.delete(this.getQuestionCacheKey(id))),
        this.invalidateCacheByQuiz(quizId),
      ]);
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
        'Failed to reorder questions',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets the next available order number for a quiz
   *
   * @param quizId - Quiz ID
   * @returns Next order number
   * @throws DatabaseError if database operation fails
   */
  async getNextOrderNumber(quizId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ maxOrder: sql<number>`COALESCE(MAX(${questions.orderNumber}), 0)` })
        .from(questions)
        .where(eq(questions.quizId, quizId));

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
   * Counts questions in a quiz
   *
   * @param quizId - Quiz ID
   * @returns Number of questions
   * @throws DatabaseError if database operation fails
   */
  async countByQuiz(quizId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ count: count() })
        .from(questions)
        .where(eq(questions.quizId, quizId));

      return result?.count || 0;
    } catch (error) {
      throw new DatabaseError(
        'Failed to count questions by quiz',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Calculates total points for all questions in a quiz
   *
   * @param quizId - Quiz ID
   * @returns Total points
   * @throws DatabaseError if database operation fails
   */
  async getTotalPointsByQuiz(quizId: string): Promise<number> {
    try {
      const [result] = await this.readDb
        .select({ total: sql<number>`COALESCE(SUM(${questions.points}), 0)` })
        .from(questions)
        .where(eq(questions.quizId, quizId));

      return result?.total || 0;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get total points by quiz',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Checks if a question exists
   *
   * @param id - Question ID
   * @returns True if question exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async exists(id: string): Promise<boolean> {
    try {
      const question = await this.findById(id);
      return question !== null;
    } catch (error) {
      throw new DatabaseError(
        'Failed to check question existence',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validates that all question IDs belong to the specified quiz
   *
   * @param quizId - Quiz ID
   * @param questionIds - Array of question IDs to validate
   * @returns True if all questions belong to quiz, false otherwise
   * @throws DatabaseError if database operation fails
   */
  async validateQuestionsBelongToQuiz(quizId: string, questionIds: string[]): Promise<boolean> {
    try {
      if (questionIds.length === 0) {
        return true;
      }

      const [result] = await this.readDb
        .select({ count: count() })
        .from(questions)
        .where(and(eq(questions.quizId, quizId), inArray(questions.id, questionIds)));

      return (result?.count || 0) === questionIds.length;
    } catch (error) {
      throw new DatabaseError(
        'Failed to validate questions belong to quiz',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for questions by quiz
   * Should be called after any update operation
   *
   * @param quizId - Quiz ID
   * @returns void
   */
  async invalidateCacheByQuiz(quizId: string): Promise<void> {
    try {
      // Invalidate quiz questions cache entries
      const pattern = buildCacheKey(CachePrefix.QUIZ, 'questions', quizId, '*');
      await cache.deletePattern(pattern);

      // Also invalidate all questions cache
      const allPattern = buildCacheKey(CachePrefix.QUIZ, 'all-questions', quizId, '*');
      await cache.deletePattern(allPattern);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for quiz questions ${quizId}:`, error);
    }
  }
}
