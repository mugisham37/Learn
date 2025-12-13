/**
 * Enrollment Repository Interface
 *
 * Defines the contract for enrollment data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 5.1, 5.3, 5.6
 */

import { Enrollment } from '../../../../infrastructure/database/schema/enrollments.schema.js';

/**
 * Data Transfer Object for creating a new enrollment
 */
export interface CreateEnrollmentDTO {
  studentId: string;
  courseId: string;
  paymentId?: string;
  status?: 'active' | 'completed' | 'dropped';
}

/**
 * Data Transfer Object for updating an enrollment
 */
export interface UpdateEnrollmentDTO {
  completedAt?: Date;
  progressPercentage?: string; // Decimal string
  lastAccessedAt?: Date;
  certificateId?: string;
  status?: 'active' | 'completed' | 'dropped';
}

/**
 * Pagination parameters for enrollment queries
 */
export interface EnrollmentPaginationDTO {
  limit: number;
  offset: number;
}

/**
 * Paginated result for enrollment queries
 */
export interface PaginatedEnrollmentResult {
  enrollments: Enrollment[];
  total: number;
  hasMore: boolean;
}

/**
 * Filter options for enrollment queries
 */
export interface EnrollmentFilterDTO {
  status?: 'active' | 'completed' | 'dropped';
  courseId?: string;
  studentId?: string;
  completedAfter?: Date;
  completedBefore?: Date;
}

/**
 * Enrollment Repository Interface
 *
 * Provides methods for all enrollment data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IEnrollmentRepository {
  /**
   * Creates a new enrollment in the database
   *
   * @param data - Enrollment creation data
   * @returns The created enrollment
   * @throws ConflictError if student is already enrolled in the course
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateEnrollmentDTO): Promise<Enrollment>;

  /**
   * Finds an enrollment by its unique ID
   *
   * @param id - Enrollment ID
   * @returns The enrollment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Enrollment | null>;

  /**
   * Finds an enrollment by student and course IDs
   *
   * @param studentId - Student ID
   * @param courseId - Course ID
   * @returns The enrollment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByStudentAndCourse(studentId: string, courseId: string): Promise<Enrollment | null>;

  /**
   * Finds all enrollments for a specific student
   *
   * @param studentId - Student ID
   * @param filters - Optional filters
   * @param pagination - Pagination parameters
   * @returns Paginated list of enrollments
   * @throws DatabaseError if database operation fails
   */
  findByStudent(
    studentId: string,
    filters?: EnrollmentFilterDTO,
    pagination?: EnrollmentPaginationDTO
  ): Promise<PaginatedEnrollmentResult>;

  /**
   * Finds all enrollments for a specific course
   *
   * @param courseId - Course ID
   * @param filters - Optional filters
   * @param pagination - Pagination parameters
   * @returns Paginated list of enrollments
   * @throws DatabaseError if database operation fails
   */
  findByCourse(
    courseId: string,
    filters?: EnrollmentFilterDTO,
    pagination?: EnrollmentPaginationDTO
  ): Promise<PaginatedEnrollmentResult>;

  /**
   * Updates an enrollment's data
   *
   * @param id - Enrollment ID
   * @param data - Update data
   * @returns The updated enrollment
   * @throws NotFoundError if enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateEnrollmentDTO): Promise<Enrollment>;

  /**
   * Soft deletes an enrollment (sets status to 'dropped')
   *
   * @param id - Enrollment ID
   * @returns void
   * @throws NotFoundError if enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  softDelete(id: string): Promise<void>;

  /**
   * Permanently deletes an enrollment from the database
   * USE WITH CAUTION - This is irreversible
   *
   * @param id - Enrollment ID
   * @returns void
   * @throws NotFoundError if enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  hardDelete(id: string): Promise<void>;

  /**
   * Checks if a student is already enrolled in a course
   *
   * @param studentId - Student ID
   * @param courseId - Course ID
   * @returns True if enrollment exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  existsByStudentAndCourse(studentId: string, courseId: string): Promise<boolean>;

  /**
   * Gets the count of active enrollments for a course
   *
   * @param courseId - Course ID
   * @returns Number of active enrollments
   * @throws DatabaseError if database operation fails
   */
  getActiveEnrollmentCount(courseId: string): Promise<number>;

  /**
   * Gets the count of completed enrollments for a course
   *
   * @param courseId - Course ID
   * @returns Number of completed enrollments
   * @throws DatabaseError if database operation fails
   */
  getCompletedEnrollmentCount(courseId: string): Promise<number>;

  /**
   * Finds enrollments that are eligible for completion
   * (all lessons completed but enrollment not marked as completed)
   *
   * @param limit - Maximum number of enrollments to return
   * @returns List of enrollments eligible for completion
   * @throws DatabaseError if database operation fails
   */
  findEligibleForCompletion(limit?: number): Promise<Enrollment[]>;

  /**
   * Invalidates cache for a specific enrollment
   * Should be called after any update operation
   *
   * @param id - Enrollment ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for enrollments by student
   * Should be called after operations that affect student's enrollments
   *
   * @param studentId - Student ID
   * @returns void
   */
  invalidateCacheByStudent(studentId: string): Promise<void>;

  /**
   * Invalidates cache for enrollments by course
   * Should be called after operations that affect course enrollments
   *
   * @param courseId - Course ID
   * @returns void
   */
  invalidateCacheByCourse(courseId: string): Promise<void>;
}
