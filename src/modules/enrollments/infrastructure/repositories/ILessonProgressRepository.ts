/**
 * Lesson Progress Repository Interface
 *
 * Defines the contract for lesson progress data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 5.3, 5.4, 5.5
 */

import { LessonProgress } from '../../../../infrastructure/database/schema/enrollments.schema.js';

/**
 * Data Transfer Object for creating a new lesson progress record
 */
export interface CreateLessonProgressDTO {
  enrollmentId: string;
  lessonId: string;
  status?: 'not_started' | 'in_progress' | 'completed';
  timeSpentSeconds?: number;
  quizScore?: number;
  attemptsCount?: number;
}

/**
 * Data Transfer Object for updating lesson progress
 */
export interface UpdateLessonProgressDTO {
  status?: 'not_started' | 'in_progress' | 'completed';
  timeSpentSeconds?: number;
  completedAt?: Date;
  quizScore?: number;
  attemptsCount?: number;
  lastAccessedAt?: Date;
}

/**
 * Progress summary for an enrollment
 */
export interface ProgressSummaryDTO {
  enrollmentId: string;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  notStartedLessons: number;
  progressPercentage: number;
  totalTimeSpentSeconds: number;
  averageQuizScore?: number;
}

/**
 * Module progress summary
 */
export interface ModuleProgressDTO {
  moduleId: string;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  isCompleted: boolean;
}

/**
 * Lesson Progress Repository Interface
 *
 * Provides methods for all lesson progress data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface ILessonProgressRepository {
  /**
   * Creates a new lesson progress record in the database
   *
   * @param data - Lesson progress creation data
   * @returns The created lesson progress record
   * @throws ConflictError if progress record already exists for enrollment+lesson
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateLessonProgressDTO): Promise<LessonProgress>;

  /**
   * Creates multiple lesson progress records in a single transaction
   * Used when initializing progress for all lessons in a course upon enrollment
   *
   * @param progressRecords - Array of lesson progress creation data
   * @returns Array of created lesson progress records
   * @throws DatabaseError if database operation fails
   */
  createMany(progressRecords: CreateLessonProgressDTO[]): Promise<LessonProgress[]>;

  /**
   * Finds a lesson progress record by its unique ID
   *
   * @param id - Lesson progress ID
   * @returns The lesson progress record if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<LessonProgress | null>;

  /**
   * Finds a lesson progress record by enrollment and lesson IDs
   *
   * @param enrollmentId - Enrollment ID
   * @param lessonId - Lesson ID
   * @returns The lesson progress record if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByEnrollmentAndLesson(enrollmentId: string, lessonId: string): Promise<LessonProgress | null>;

  /**
   * Finds all lesson progress records for a specific enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of lesson progress records
   * @throws DatabaseError if database operation fails
   */
  findByEnrollment(enrollmentId: string): Promise<LessonProgress[]>;

  /**
   * Finds all lesson progress records for a specific lesson across all enrollments
   *
   * @param lessonId - Lesson ID
   * @returns Array of lesson progress records
   * @throws DatabaseError if database operation fails
   */
  findByLesson(lessonId: string): Promise<LessonProgress[]>;

  /**
   * Updates a lesson progress record's data
   *
   * @param id - Lesson progress ID
   * @param data - Update data
   * @returns The updated lesson progress record
   * @throws NotFoundError if lesson progress record doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateLessonProgressDTO): Promise<LessonProgress>;

  /**
   * Updates lesson progress by enrollment and lesson IDs
   * More convenient than finding the ID first
   *
   * @param enrollmentId - Enrollment ID
   * @param lessonId - Lesson ID
   * @param data - Update data
   * @returns The updated lesson progress record
   * @throws NotFoundError if lesson progress record doesn't exist
   * @throws DatabaseError if database operation fails
   */
  updateByEnrollmentAndLesson(
    enrollmentId: string,
    lessonId: string,
    data: UpdateLessonProgressDTO
  ): Promise<LessonProgress>;

  /**
   * Deletes a lesson progress record from the database
   *
   * @param id - Lesson progress ID
   * @returns void
   * @throws NotFoundError if lesson progress record doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Gets progress summary for an enrollment
   * Calculates completion statistics and percentages
   *
   * @param enrollmentId - Enrollment ID
   * @returns Progress summary with statistics
   * @throws DatabaseError if database operation fails
   */
  getProgressSummary(enrollmentId: string): Promise<ProgressSummaryDTO>;

  /**
   * Gets progress summary for all modules in an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of module progress summaries
   * @throws DatabaseError if database operation fails
   */
  getModuleProgress(enrollmentId: string): Promise<ModuleProgressDTO[]>;

  /**
   * Finds completed lesson progress records for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of completed lesson progress records
   * @throws DatabaseError if database operation fails
   */
  findCompletedByEnrollment(enrollmentId: string): Promise<LessonProgress[]>;

  /**
   * Finds in-progress lesson progress records for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of in-progress lesson progress records
   * @throws DatabaseError if database operation fails
   */
  findInProgressByEnrollment(enrollmentId: string): Promise<LessonProgress[]>;

  /**
   * Checks if all lessons in a course are completed for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns True if all lessons are completed, false otherwise
   * @throws DatabaseError if database operation fails
   */
  areAllLessonsCompleted(enrollmentId: string): Promise<boolean>;

  /**
   * Gets the next lesson that should be accessed based on progress
   * Returns the first not-started or in-progress lesson
   *
   * @param enrollmentId - Enrollment ID
   * @returns The next lesson progress record, null if all completed
   * @throws DatabaseError if database operation fails
   */
  getNextLesson(enrollmentId: string): Promise<LessonProgress | null>;

  /**
   * Invalidates cache for a specific lesson progress record
   * Should be called after any update operation
   *
   * @param id - Lesson progress ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for lesson progress by enrollment
   * Should be called after operations that affect enrollment progress
   *
   * @param enrollmentId - Enrollment ID
   * @returns void
   */
  invalidateCacheByEnrollment(enrollmentId: string): Promise<void>;

  /**
   * Invalidates cache for lesson progress by lesson
   * Should be called after operations that affect lesson progress across enrollments
   *
   * @param lessonId - Lesson ID
   * @returns void
   */
  invalidateCacheByLesson(lessonId: string): Promise<void>;
}
