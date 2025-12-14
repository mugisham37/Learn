/**
 * Assignment Repository Interface
 *
 * Defines the contract for assignment data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 7.1, 7.2
 */

import { Assignment } from '../../../../infrastructure/database/schema/assessments.schema.js';

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
 * Assignment filter parameters
 */
export interface AssignmentFilters {
  lessonId?: string;
  dueAfter?: Date;
  dueBefore?: Date;
  requiresFileUpload?: boolean;
}

/**
 * Data Transfer Object for creating a new assignment
 */
export interface CreateAssignmentDTO {
  lessonId: string;
  title: string;
  description?: string;
  instructions: string;
  dueDate: Date;
  lateSubmissionAllowed?: boolean;
  latePenaltyPercentage?: number;
  maxPoints: number;
  requiresFileUpload?: boolean;
  allowedFileTypes: string[];
  maxFileSizeMb?: number;
  rubric?: Record<string, unknown>;
}

/**
 * Data Transfer Object for updating an assignment
 */
export interface UpdateAssignmentDTO {
  title?: string;
  description?: string;
  instructions?: string;
  dueDate?: Date;
  lateSubmissionAllowed?: boolean;
  latePenaltyPercentage?: number;
  maxPoints?: number;
  requiresFileUpload?: boolean;
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
  rubric?: Record<string, unknown>;
}

/**
 * Assignment Repository Interface
 *
 * Provides methods for all assignment data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IAssignmentRepository {
  /**
   * Creates a new assignment in the database
   *
   * @param data - Assignment creation data
   * @returns The created assignment
   * @throws ValidationError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateAssignmentDTO): Promise<Assignment>;

  /**
   * Finds an assignment by its unique ID
   *
   * @param id - Assignment ID
   * @returns The assignment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Assignment | null>;

  /**
   * Finds assignments by lesson with pagination
   *
   * @param lessonId - Lesson ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment results
   * @throws DatabaseError if database operation fails
   */
  findByLesson(
    lessonId: string,
    pagination: PaginationParams,
    filters?: AssignmentFilters
  ): Promise<PaginatedResult<Assignment>>;

  /**
   * Finds all assignments with pagination and filtering
   *
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment results
   * @throws DatabaseError if database operation fails
   */
  findAll(
    pagination: PaginationParams,
    filters?: AssignmentFilters
  ): Promise<PaginatedResult<Assignment>>;

  /**
   * Updates an assignment's data
   *
   * @param id - Assignment ID
   * @param data - Update data
   * @returns The updated assignment
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateAssignmentDTO): Promise<Assignment>;

  /**
   * Deletes an assignment from the database
   * This cascades to delete all submissions
   *
   * @param id - Assignment ID
   * @returns void
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Checks if an assignment exists
   *
   * @param id - Assignment ID
   * @returns True if assignment exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  exists(id: string): Promise<boolean>;

  /**
   * Checks if an assignment is past due
   *
   * @param id - Assignment ID
   * @returns True if assignment is past due, false otherwise
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  isPastDue(id: string): Promise<boolean>;

  /**
   * Invalidates cache for a specific assignment
   * Should be called after any update operation
   *
   * @param id - Assignment ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for assignments by lesson
   * Should be called after operations that affect lesson assignment lists
   *
   * @param lessonId - Lesson ID
   * @returns void
   */
  invalidateCacheByLesson(lessonId: string): Promise<void>;
}
