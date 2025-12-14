/**
 * Quiz Submission Repository Interface
 *
 * Defines the contract for quiz submission data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { QuizSubmission } from '../../../../infrastructure/database/schema/assessments.schema.js';

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
 * Quiz submission filter parameters
 */
export interface QuizSubmissionFilters {
  quizId?: string;
  studentId?: string;
  enrollmentId?: string;
  gradingStatus?: 'auto_graded' | 'pending_review' | 'graded';
  submittedOnly?: boolean; // Filter only submitted attempts
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Data Transfer Object for creating a new quiz submission
 */
export interface CreateQuizSubmissionDTO {
  quizId: string;
  studentId: string;
  enrollmentId: string;
  attemptNumber: number;
  answers?: unknown; // JSONB field for student answers
}

/**
 * Data Transfer Object for updating a quiz submission
 */
export interface UpdateQuizSubmissionDTO {
  submittedAt?: Date;
  timeTakenSeconds?: number;
  scorePercentage?: string; // Decimal as string
  pointsEarned?: string; // Decimal as string
  answers?: unknown; // JSONB field for student answers
  gradingStatus?: 'auto_graded' | 'pending_review' | 'graded';
  feedback?: string;
  gradedAt?: Date;
  gradedBy?: string;
}

/**
 * Quiz submission with related data
 */
export interface QuizSubmissionWithDetails extends QuizSubmission {
  quiz?: {
    id: string;
    title: string;
    maxAttempts: number;
    passingScorePercentage: number;
  };
  student?: {
    id: string;
    email: string;
    profile?: {
      fullName: string;
    };
  };
}

/**
 * Student attempt summary
 */
export interface StudentAttemptSummary {
  studentId: string;
  quizId: string;
  totalAttempts: number;
  bestScore: number | null;
  lastAttemptAt: Date | null;
  hasPassingScore: boolean;
}

/**
 * Quiz Submission Repository Interface
 *
 * Provides methods for all quiz submission data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IQuizSubmissionRepository {
  /**
   * Creates a new quiz submission in the database
   *
   * @param data - Quiz submission creation data
   * @returns The created quiz submission
   * @throws ValidationError if quiz, student, or enrollment doesn't exist
   * @throws ConflictError if attempt number conflicts
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateQuizSubmissionDTO): Promise<QuizSubmission>;

  /**
   * Finds a quiz submission by its unique ID
   *
   * @param id - Quiz submission ID
   * @returns The quiz submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<QuizSubmission | null>;

  /**
   * Finds a quiz submission by ID with related quiz and student data
   *
   * @param id - Quiz submission ID
   * @returns The quiz submission with details if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByIdWithDetails(id: string): Promise<QuizSubmissionWithDetails | null>;

  /**
   * Finds quiz submissions by quiz with pagination
   *
   * @param quizId - Quiz ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz submission results
   * @throws DatabaseError if database operation fails
   */
  findByQuiz(
    quizId: string,
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmission>>;

  /**
   * Finds quiz submissions by student with pagination
   *
   * @param studentId - Student ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz submission results
   * @throws DatabaseError if database operation fails
   */
  findByStudent(
    studentId: string,
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmission>>;

  /**
   * Finds quiz submissions by enrollment with pagination
   *
   * @param enrollmentId - Enrollment ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated quiz submission results
   * @throws DatabaseError if database operation fails
   */
  findByEnrollment(
    enrollmentId: string,
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmission>>;

  /**
   * Finds a specific attempt for a student and quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @param attemptNumber - Attempt number
   * @returns The quiz submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findAttempt(
    quizId: string,
    studentId: string,
    attemptNumber: number
  ): Promise<QuizSubmission | null>;

  /**
   * Finds the latest attempt for a student and quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns The latest quiz submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findLatestAttempt(quizId: string, studentId: string): Promise<QuizSubmission | null>;

  /**
   * Finds all attempts for a student and quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns All quiz submissions for the student and quiz
   * @throws DatabaseError if database operation fails
   */
  findAllAttempts(quizId: string, studentId: string): Promise<QuizSubmission[]>;

  /**
   * Finds submissions pending manual grading
   *
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated submissions pending review
   * @throws DatabaseError if database operation fails
   */
  findPendingGrading(
    pagination: PaginationParams,
    filters?: QuizSubmissionFilters
  ): Promise<PaginatedResult<QuizSubmissionWithDetails>>;

  /**
   * Updates a quiz submission's data
   *
   * @param id - Quiz submission ID
   * @param data - Update data
   * @returns The updated quiz submission
   * @throws NotFoundError if quiz submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateQuizSubmissionDTO): Promise<QuizSubmission>;

  /**
   * Deletes a quiz submission from the database
   *
   * @param id - Quiz submission ID
   * @returns void
   * @throws NotFoundError if quiz submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Deletes all submissions for a quiz
   *
   * @param quizId - Quiz ID
   * @returns Number of deleted submissions
   * @throws DatabaseError if database operation fails
   */
  deleteByQuiz(quizId: string): Promise<number>;

  /**
   * Gets the next attempt number for a student and quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Next attempt number
   * @throws DatabaseError if database operation fails
   */
  getNextAttemptNumber(quizId: string, studentId: string): Promise<number>;

  /**
   * Counts total attempts for a student and quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Number of attempts
   * @throws DatabaseError if database operation fails
   */
  countAttempts(quizId: string, studentId: string): Promise<number>;

  /**
   * Gets the best score for a student and quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Best score percentage, null if no attempts
   * @throws DatabaseError if database operation fails
   */
  getBestScore(quizId: string, studentId: string): Promise<number | null>;

  /**
   * Gets attempt summary for a student and quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Student attempt summary
   * @throws DatabaseError if database operation fails
   */
  getAttemptSummary(quizId: string, studentId: string): Promise<StudentAttemptSummary>;

  /**
   * Checks if a student has a passing score for a quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns True if student has passing score, false otherwise
   * @throws DatabaseError if database operation fails
   */
  hasPassingScore(quizId: string, studentId: string): Promise<boolean>;

  /**
   * Checks if a quiz submission exists
   *
   * @param id - Quiz submission ID
   * @returns True if submission exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  exists(id: string): Promise<boolean>;

  /**
   * Invalidates cache for quiz submissions
   * Should be called after any update operation
   *
   * @param quizId - Quiz ID
   * @param studentId - Optional student ID for targeted invalidation
   * @returns void
   */
  invalidateCache(quizId: string, studentId?: string): Promise<void>;
}
