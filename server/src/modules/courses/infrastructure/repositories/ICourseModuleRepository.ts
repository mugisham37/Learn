/**
 * Course Module Repository Interface
 *
 * Defines the contract for course module data access operations.
 * Handles module ordering, prerequisites, and relationships.
 *
 * Requirements: 3.2
 */

import { CourseModule } from '../../../../infrastructure/database/schema/courses.schema.js';

/**
 * Data Transfer Object for creating a new course module
 */
export interface CreateCourseModuleDTO {
  courseId: string;
  title: string;
  description?: string;
  orderNumber: number;
  durationMinutes?: number;
  prerequisiteModuleId?: string;
}

/**
 * Data Transfer Object for updating a course module
 */
export interface UpdateCourseModuleDTO {
  title?: string;
  description?: string;
  orderNumber?: number;
  durationMinutes?: number;
  prerequisiteModuleId?: string;
}

/**
 * Course Module Repository Interface
 *
 * Provides methods for course module data access operations with caching support.
 * Handles module ordering and prerequisite relationships.
 */
export interface ICourseModuleRepository {
  /**
   * Creates a new course module in the database
   *
   * @param data - Module creation data
   * @returns The created module
   * @throws ConflictError if order number already exists for the course
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateCourseModuleDTO): Promise<CourseModule>;

  /**
   * Finds a module by its unique ID
   *
   * @param id - Module ID
   * @returns The module if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<CourseModule | null>;

  /**
   * Finds all modules for a course ordered by orderNumber
   *
   * @param courseId - Course ID
   * @returns Array of modules ordered by orderNumber
   * @throws DatabaseError if database operation fails
   */
  findByCourse(courseId: string): Promise<CourseModule[]>;

  /**
   * Finds modules that have the specified module as a prerequisite
   *
   * @param prerequisiteModuleId - Prerequisite module ID
   * @returns Array of dependent modules
   * @throws DatabaseError if database operation fails
   */
  findByPrerequisite(prerequisiteModuleId: string): Promise<CourseModule[]>;

  /**
   * Updates a module's data
   *
   * @param id - Module ID
   * @param data - Update data
   * @returns The updated module
   * @throws NotFoundError if module doesn't exist
   * @throws ConflictError if order number update conflicts
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateCourseModuleDTO): Promise<CourseModule>;

  /**
   * Deletes a module and all its lessons
   *
   * @param id - Module ID
   * @returns void
   * @throws NotFoundError if module doesn't exist
   * @throws ConflictError if module has dependent modules
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Reorders modules within a course
   * Updates order numbers to maintain sequential integrity
   *
   * @param courseId - Course ID
   * @param moduleIds - Array of module IDs in desired order
   * @returns Array of updated modules
   * @throws NotFoundError if course or modules don't exist
   * @throws ValidationError if module IDs don't belong to course
   * @throws DatabaseError if database operation fails
   */
  reorder(courseId: string, moduleIds: string[]): Promise<CourseModule[]>;

  /**
   * Gets the next available order number for a course
   *
   * @param courseId - Course ID
   * @returns Next available order number
   * @throws DatabaseError if database operation fails
   */
  getNextOrderNumber(courseId: string): Promise<number>;

  /**
   * Checks if a module can be deleted (no dependent modules)
   *
   * @param id - Module ID
   * @returns True if module can be safely deleted
   * @throws DatabaseError if database operation fails
   */
  canDelete(id: string): Promise<boolean>;

  /**
   * Updates the total duration of a module based on its lessons
   *
   * @param id - Module ID
   * @returns The updated module
   * @throws NotFoundError if module doesn't exist
   * @throws DatabaseError if database operation fails
   */
  updateDuration(id: string): Promise<CourseModule>;

  /**
   * Invalidates cache for a specific module
   *
   * @param id - Module ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for all modules in a course
   *
   * @param courseId - Course ID
   * @returns void
   */
  invalidateCacheByCourse(courseId: string): Promise<void>;
}
