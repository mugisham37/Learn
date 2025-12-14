/**
 * Course Repository Interface
 *
 * Defines the contract for course data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 3.1, 3.6
 */

import { Course } from '../../../../infrastructure/database/schema/courses.schema.js';

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
 * Course filter parameters
 */
export interface CourseFilters {
  status?: 'draft' | 'pending_review' | 'published' | 'archived';
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  instructorId?: string;
}

/**
 * Data Transfer Object for creating a new course
 */
export interface CreateCourseDTO {
  instructorId: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  price?: string; // Decimal as string
  currency?: string;
  enrollmentLimit?: number;
  thumbnailUrl?: string;
}

/**
 * Data Transfer Object for updating a course
 */
export interface UpdateCourseDTO {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  price?: string; // Decimal as string
  currency?: string;
  enrollmentLimit?: number;
  thumbnailUrl?: string;
  status?: 'draft' | 'pending_review' | 'published' | 'archived';
  publishedAt?: Date;
}

/**
 * Course Repository Interface
 *
 * Provides methods for all course data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface ICourseRepository {
  /**
   * Creates a new course in the database
   *
   * @param data - Course creation data
   * @returns The created course
   * @throws ConflictError if slug already exists
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateCourseDTO): Promise<Course>;

  /**
   * Finds a course by its unique ID
   *
   * @param id - Course ID
   * @returns The course if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Course | null>;

  /**
   * Finds a course by its URL slug
   *
   * @param slug - Course slug
   * @returns The course if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findBySlug(slug: string): Promise<Course | null>;

  /**
   * Finds courses by instructor with pagination
   *
   * @param instructorId - Instructor user ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated course results
   * @throws DatabaseError if database operation fails
   */
  findByInstructor(
    instructorId: string,
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>>;

  /**
   * Finds published courses with pagination and filtering
   *
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated course results
   * @throws DatabaseError if database operation fails
   */
  findPublished(
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>>;

  /**
   * Updates a course's data
   *
   * @param id - Course ID
   * @param data - Update data
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws ConflictError if slug update conflicts with existing course
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateCourseDTO): Promise<Course>;

  /**
   * Publishes a course by updating status and setting publishedAt
   *
   * @param id - Course ID
   * @returns The published course
   * @throws NotFoundError if course doesn't exist
   * @throws ValidationError if course doesn't meet publication requirements
   * @throws DatabaseError if database operation fails
   */
  publish(id: string): Promise<Course>;

  /**
   * Soft deletes a course by setting status to archived
   *
   * @param id - Course ID
   * @returns void
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Permanently deletes a course from the database
   * USE WITH CAUTION - This is irreversible and cascades to modules/lessons
   *
   * @param id - Course ID
   * @returns void
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  hardDelete(id: string): Promise<void>;

  /**
   * Checks if a course with the given slug exists
   *
   * @param slug - Course slug
   * @returns True if course exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  existsBySlug(slug: string): Promise<boolean>;

  /**
   * Increments the enrollment count for a course
   *
   * @param id - Course ID
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  incrementEnrollmentCount(id: string): Promise<Course>;

  /**
   * Decrements the enrollment count for a course
   *
   * @param id - Course ID
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  decrementEnrollmentCount(id: string): Promise<Course>;

  /**
   * Updates course rating statistics
   *
   * @param id - Course ID
   * @param averageRating - New average rating
   * @param totalReviews - Total number of reviews
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if database operation fails
   */
  updateRating(id: string, averageRating: number, totalReviews: number): Promise<Course>;

  /**
   * Invalidates cache for a specific course
   * Should be called after any update operation
   *
   * @param id - Course ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for a course by slug
   * Should be called after operations that affect slug lookups
   *
   * @param slug - Course slug
   * @returns void
   */
  invalidateCacheBySlug(slug: string): Promise<void>;

  /**
   * Invalidates cache for courses by instructor
   * Should be called after operations that affect instructor course lists
   *
   * @param instructorId - Instructor user ID
   * @returns void
   */
  invalidateCacheByInstructor(instructorId: string): Promise<void>;
}
