/**
 * Course Service Interface
 *
 * Defines the contract for course business logic operations.
 * Orchestrates course creation, management, publishing, and deletion workflows.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { Course } from '../../domain/entities/Course.js';
import { CourseModule } from '../../domain/entities/CourseModule.js';
import { Lesson } from '../../domain/entities/Lesson.js';
import {
  CreateCourseDTO,
  UpdateCourseDTO,
  PaginationParams,
  PaginatedResult,
  CourseFilters,
} from '../../infrastructure/repositories/ICourseRepository.js';
import {
  CreateCourseModuleDTO,
  UpdateCourseModuleDTO,
} from '../../infrastructure/repositories/ICourseModuleRepository.js';
import {
  CreateLessonDTO,
  UpdateLessonDTO,
} from '../../infrastructure/repositories/ILessonRepository.js';

/**
 * Validation result for course publication
 */
export interface PublicationValidationResult {
  canPublish: boolean;
  reasons: string[];
}

/**
 * Course Service Interface
 *
 * Provides high-level business operations for course management.
 * Handles validation, caching, and domain event publishing.
 */
export interface ICourseService {
  /**
   * Creates a new course with slug generation
   *
   * @param instructorId - ID of the instructor creating the course
   * @param data - Course creation data
   * @returns The created course
   * @throws ValidationError if data is invalid
   * @throws AuthorizationError if user is not an educator
   * @throws ConflictError if slug conflicts (handled internally with regeneration)
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.1
   */
  createCourse(instructorId: string, data: CreateCourseDTO): Promise<Course>;

  /**
   * Gets a course by ID with caching
   *
   * @param id - Course ID
   * @returns The course if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  getCourseById(id: string): Promise<Course | null>;

  /**
   * Gets a course by slug with caching
   *
   * @param slug - Course slug
   * @returns The course if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  getCourseBySlug(slug: string): Promise<Course | null>;

  /**
   * Gets courses by instructor with pagination and filtering
   *
   * @param instructorId - Instructor user ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated course results
   * @throws DatabaseError if database operation fails
   */
  getCoursesByInstructor(
    instructorId: string,
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>>;

  /**
   * Gets published courses with pagination and filtering
   *
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated course results
   * @throws DatabaseError if database operation fails
   */
  getPublishedCourses(
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>>;

  /**
   * Updates course metadata with cache invalidation
   *
   * @param courseId - Course ID
   * @param instructorId - ID of the instructor (for authorization)
   * @param data - Update data
   * @returns The updated course
   * @throws NotFoundError if course doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if data is invalid
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.6
   */
  updateCourse(courseId: string, instructorId: string, data: UpdateCourseDTO): Promise<Course>;

  /**
   * Adds a module to a course with ordering
   *
   * @param courseId - Course ID
   * @param instructorId - ID of the instructor (for authorization)
   * @param data - Module creation data
   * @returns The created module
   * @throws NotFoundError if course doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if data is invalid
   * @throws ConflictError if order number conflicts
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.2
   */
  addModule(
    courseId: string,
    instructorId: string,
    data: Omit<CreateCourseModuleDTO, 'courseId'>
  ): Promise<CourseModule>;

  /**
   * Updates a module with cache invalidation
   *
   * @param moduleId - Module ID
   * @param instructorId - ID of the instructor (for authorization)
   * @param data - Update data
   * @returns The updated module
   * @throws NotFoundError if module doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if data is invalid
   * @throws ConflictError if order number conflicts
   * @throws DatabaseError if database operation fails
   */
  updateModule(
    moduleId: string,
    instructorId: string,
    data: UpdateCourseModuleDTO
  ): Promise<CourseModule>;

  /**
   * Adds a lesson to a module with ordering and type validation
   *
   * @param moduleId - Module ID
   * @param instructorId - ID of the instructor (for authorization)
   * @param data - Lesson creation data
   * @returns The created lesson
   * @throws NotFoundError if module doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if data is invalid or lesson type validation fails
   * @throws ConflictError if order number conflicts
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.3
   */
  addLesson(
    moduleId: string,
    instructorId: string,
    data: Omit<CreateLessonDTO, 'moduleId'>
  ): Promise<Lesson>;

  /**
   * Updates a lesson with cache invalidation
   *
   * @param lessonId - Lesson ID
   * @param instructorId - ID of the instructor (for authorization)
   * @param data - Update data
   * @returns The updated lesson
   * @throws NotFoundError if lesson doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if data is invalid or lesson type validation fails
   * @throws ConflictError if order number conflicts
   * @throws DatabaseError if database operation fails
   */
  updateLesson(lessonId: string, instructorId: string, data: UpdateLessonDTO): Promise<Lesson>;

  /**
   * Reorders modules within a course
   * Updates order numbers maintaining uniqueness and sequential integrity
   *
   * @param courseId - Course ID
   * @param instructorId - ID of the instructor (for authorization)
   * @param moduleIds - Array of module IDs in desired order
   * @returns Array of updated modules
   * @throws NotFoundError if course or modules don't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if module IDs don't belong to course or count mismatch
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.4
   */
  reorderModules(
    courseId: string,
    instructorId: string,
    moduleIds: string[]
  ): Promise<CourseModule[]>;

  /**
   * Reorders lessons within a module
   * Updates order numbers maintaining uniqueness and sequential integrity
   *
   * @param moduleId - Module ID
   * @param instructorId - ID of the instructor (for authorization)
   * @param lessonIds - Array of lesson IDs in desired order
   * @returns Array of updated lessons
   * @throws NotFoundError if module or lessons don't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if lesson IDs don't belong to module or count mismatch
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.4
   */
  reorderLessons(moduleId: string, instructorId: string, lessonIds: string[]): Promise<Lesson[]>;

  /**
   * Validates course publication requirements
   *
   * @param courseId - Course ID
   * @param instructorId - ID of the instructor (for authorization)
   * @returns Validation result with canPublish flag and reasons
   * @throws NotFoundError if course doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.5
   */
  validatePublishRequirements(
    courseId: string,
    instructorId: string
  ): Promise<PublicationValidationResult>;

  /**
   * Publishes a course with validation
   *
   * @param courseId - Course ID
   * @param instructorId - ID of the instructor (for authorization)
   * @returns The published course
   * @throws NotFoundError if course doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ValidationError if course doesn't meet publication requirements
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.5
   */
  publishCourse(courseId: string, instructorId: string): Promise<Course>;

  /**
   * Soft deletes a course (sets status to archived)
   *
   * @param courseId - Course ID
   * @param instructorId - ID of the instructor (for authorization)
   * @returns void
   * @throws NotFoundError if course doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws DatabaseError if database operation fails
   */
  deleteCourse(courseId: string, instructorId: string): Promise<void>;

  /**
   * Permanently deletes a course with cascade deletion
   * USE WITH CAUTION - This is irreversible
   *
   * @param courseId - Course ID
   * @param instructorId - ID of the instructor (for authorization)
   * @returns void
   * @throws NotFoundError if course doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws DatabaseError if database operation fails
   *
   * Requirements: 3.7
   */
  hardDeleteCourse(courseId: string, instructorId: string): Promise<void>;

  /**
   * Deletes a module and all its lessons
   *
   * @param moduleId - Module ID
   * @param instructorId - ID of the instructor (for authorization)
   * @returns void
   * @throws NotFoundError if module doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws ConflictError if module has dependent modules (prerequisites)
   * @throws DatabaseError if database operation fails
   */
  deleteModule(moduleId: string, instructorId: string): Promise<void>;

  /**
   * Deletes a lesson
   *
   * @param lessonId - Lesson ID
   * @param instructorId - ID of the instructor (for authorization)
   * @returns void
   * @throws NotFoundError if lesson doesn't exist
   * @throws AuthorizationError if user doesn't own the course
   * @throws DatabaseError if database operation fails
   */
  deleteLesson(lessonId: string, instructorId: string): Promise<void>;

  /**
   * Invalidates all cache entries for a course
   * Should be called after any course update operation
   *
   * @param courseId - Course ID
   * @returns void
   *
   * Requirements: 3.6
   */
  invalidateCourseCache(courseId: string): Promise<void>;
}
