/**
 * Question Repository Interface
 * 
 * Defines the contract for question data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 * 
 * Requirements: 6.1, 6.2
 */

import { 
  Question
} from '../../../../infrastructure/database/schema/assessments.schema.js';

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
 * Question filter parameters
 */
export interface QuestionFilters {
  questionType?: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank' | 'matching';
  difficulty?: 'easy' | 'medium' | 'hard';
  minPoints?: number;
  maxPoints?: number;
}

/**
 * Data Transfer Object for creating a new question
 */
export interface CreateQuestionDTO {
  quizId: string;
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank' | 'matching';
  questionText: string;
  questionMediaUrl?: string;
  options?: unknown; // JSONB field for question options
  correctAnswer: unknown; // JSONB field for correct answer
  explanation?: string;
  points?: number;
  orderNumber: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Data Transfer Object for updating a question
 */
export interface UpdateQuestionDTO {
  questionType?: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank' | 'matching';
  questionText?: string;
  questionMediaUrl?: string;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: string;
  points?: number;
  orderNumber?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Question Repository Interface
 * 
 * Provides methods for all question data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IQuestionRepository {
  /**
   * Creates a new question in the database
   * 
   * @param data - Question creation data
   * @returns The created question
   * @throws ValidationError if quiz doesn't exist
   * @throws ConflictError if order number conflicts
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateQuestionDTO): Promise<Question>;

  /**
   * Creates multiple questions in a single transaction
   * 
   * @param questions - Array of question creation data
   * @returns The created questions
   * @throws ValidationError if quiz doesn't exist
   * @throws ConflictError if order numbers conflict
   * @throws DatabaseError if database operation fails
   */
  createMany(questions: CreateQuestionDTO[]): Promise<Question[]>;

  /**
   * Finds a question by its unique ID
   * 
   * @param id - Question ID
   * @returns The question if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Question | null>;

  /**
   * Finds questions by quiz with pagination and ordering
   * 
   * @param quizId - Quiz ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated question results ordered by orderNumber
   * @throws DatabaseError if database operation fails
   */
  findByQuiz(
    quizId: string,
    pagination: PaginationParams,
    filters?: QuestionFilters
  ): Promise<PaginatedResult<Question>>;

  /**
   * Finds all questions for a quiz ordered by orderNumber
   * 
   * @param quizId - Quiz ID
   * @param randomize - Whether to randomize the order
   * @returns All questions for the quiz
   * @throws DatabaseError if database operation fails
   */
  findAllByQuiz(quizId: string, randomize?: boolean): Promise<Question[]>;

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
  update(id: string, data: UpdateQuestionDTO): Promise<Question>;

  /**
   * Updates multiple questions in a single transaction
   * 
   * @param updates - Array of question updates with IDs
   * @returns The updated questions
   * @throws NotFoundError if any question doesn't exist
   * @throws DatabaseError if database operation fails
   */
  updateMany(updates: Array<{ id: string; data: UpdateQuestionDTO }>): Promise<Question[]>;

  /**
   * Deletes a question from the database
   * 
   * @param id - Question ID
   * @returns void
   * @throws NotFoundError if question doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Deletes all questions for a quiz
   * 
   * @param quizId - Quiz ID
   * @returns Number of deleted questions
   * @throws DatabaseError if database operation fails
   */
  deleteByQuiz(quizId: string): Promise<number>;

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
  reorder(quizId: string, questionIds: string[]): Promise<void>;

  /**
   * Gets the next available order number for a quiz
   * 
   * @param quizId - Quiz ID
   * @returns Next order number
   * @throws DatabaseError if database operation fails
   */
  getNextOrderNumber(quizId: string): Promise<number>;

  /**
   * Counts questions in a quiz
   * 
   * @param quizId - Quiz ID
   * @returns Number of questions
   * @throws DatabaseError if database operation fails
   */
  countByQuiz(quizId: string): Promise<number>;

  /**
   * Calculates total points for all questions in a quiz
   * 
   * @param quizId - Quiz ID
   * @returns Total points
   * @throws DatabaseError if database operation fails
   */
  getTotalPointsByQuiz(quizId: string): Promise<number>;

  /**
   * Checks if a question exists
   * 
   * @param id - Question ID
   * @returns True if question exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  exists(id: string): Promise<boolean>;

  /**
   * Validates that all question IDs belong to the specified quiz
   * 
   * @param quizId - Quiz ID
   * @param questionIds - Array of question IDs to validate
   * @returns True if all questions belong to quiz, false otherwise
   * @throws DatabaseError if database operation fails
   */
  validateQuestionsBelongToQuiz(quizId: string, questionIds: string[]): Promise<boolean>;

  /**
   * Invalidates cache for questions by quiz
   * Should be called after any update operation
   * 
   * @param quizId - Quiz ID
   * @returns void
   */
  invalidateCacheByQuiz(quizId: string): Promise<void>;
}