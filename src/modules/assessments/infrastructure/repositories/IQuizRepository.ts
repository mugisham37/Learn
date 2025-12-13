/**
 * Quiz Repository Interface
 *
 * Defines the contract for quiz data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 6.1, 6.2, 6.3
 */

import { Quiz, Question } from '../../../../infrastructure/database/schema/assessments.schema.js';

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Quiz filter parameters
 */
export interface QuizFilters {
  lessonId?: string;
  quizType?: 'formative' | 'summative' | 'practice';
  availableOnly?: boolean; // Filter by availability dates
}

/**
 * Data Transfer Object for creating a new quiz
 */
export interface CreateQuizDTO {
  lessonId: string;
  title: string;
  description?: string;
  quizType: 'formative' | 'summative' | 'practice';
  timeLimitMinutes?: number;
  passingScorePercentage: number;
  maxAttempts?: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showCorrectAnswers?: boolean;
  showExplanations?: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
}

/**
 * Data Transfer Object for updating a quiz
 */
export interface UpdateQuizDTO {
  title?: string;
  description?: string;
  quizType?: 'formative' | 'summative' | 'practice';
  timeLimitMinutes?: number;
  passingScorePercentage?: number;
  maxAttempts?: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showCorrectAnswers?: boolean;
  showExplanations?: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
}

/**
 * Quiz with questions included
 */
export interface QuizWithQuestions extends Quiz {
  questions: Question[];
}

/**
 * Quiz Repository Interface
 *
 * Provides methods for all quiz data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IQuizRepository {
  /**
   * Creates a new quiz in the database
   *
   * @param data - Quiz creation data
   * @returns The created quiz
   * @throws ValidationError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateQuizDTO): Promise<Quiz>;

  /**
   * Finds a quiz by its unique ID
   *
   * @param id - Quiz ID
   * @returns The quiz if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Quiz | null>;

  /**
   * Finds a quiz by ID with all questions included
   *
   * @param id - Quiz ID
   * @returns The quiz with questions if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByIdWithQuestions(id: string): Promise<QuizWithQuestions | null>;

  /**
   * Finds quizzes by lesson with pagination
   *
   * @param lessonId - Lesson ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz results
   * @throws DatabaseError if database operation fails
   */
  findByLesson(
    lessonId: string,
    pagination: PaginationParams,
    filters?: QuizFilters
  ): Promise<PaginatedResult<Quiz>>;

  /**
   * Finds all quizzes with pagination and filtering
   *
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz results
   * @throws DatabaseError if database operation fails
   */
  findAll(pagination: PaginationParams, filters?: QuizFilters): Promise<PaginatedResult<Quiz>>;

  /**
   * Updates a quiz's data
   *
   * @param id - Quiz ID
   * @param data - Update data
   * @returns The updated quiz
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateQuizDTO): Promise<Quiz>;

  /**
   * Deletes a quiz from the database
   * This cascades to delete all questions and submissions
   *
   * @param id - Quiz ID
   * @returns void
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Checks if a quiz exists
   *
   * @param id - Quiz ID
   * @returns True if quiz exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  exists(id: string): Promise<boolean>;

  /**
   * Checks if a quiz is available for taking at the current time
   *
   * @param id - Quiz ID
   * @returns True if quiz is available, false otherwise
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  isAvailable(id: string): Promise<boolean>;

  /**
   * Gets the total number of questions in a quiz
   *
   * @param id - Quiz ID
   * @returns Number of questions
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  getQuestionCount(id: string): Promise<number>;

  /**
   * Gets the total points possible for a quiz
   *
   * @param id - Quiz ID
   * @returns Total points
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  getTotalPoints(id: string): Promise<number>;

  /**
   * Invalidates cache for a specific quiz
   * Should be called after any update operation
   *
   * @param id - Quiz ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for quizzes by lesson
   * Should be called after operations that affect lesson quiz lists
   *
   * @param lessonId - Lesson ID
   * @returns void
   */
  invalidateCacheByLesson(lessonId: string): Promise<void>;
}
