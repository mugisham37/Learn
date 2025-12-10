/**
 * Lesson Repository Interface
 * 
 * Defines the contract for lesson data access operations.
 * Handles lesson ordering, type-specific validation, and content management.
 * 
 * Requirements: 3.3
 */

import { Lesson } from '../../../../infrastructure/database/schema/courses.schema.js';

/**
 * Data Transfer Object for creating a new lesson
 */
export interface CreateLessonDTO {
  moduleId: string;
  title: string;
  description?: string;
  lessonType: 'video' | 'text' | 'quiz' | 'assignment';
  contentUrl?: string;
  contentText?: string;
  durationMinutes?: number;
  orderNumber: number;
  isPreview?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Data Transfer Object for updating a lesson
 */
export interface UpdateLessonDTO {
  title?: string;
  description?: string;
  lessonType?: 'video' | 'text' | 'quiz' | 'assignment';
  contentUrl?: string;
  contentText?: string;
  durationMinutes?: number;
  orderNumber?: number;
  isPreview?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Lesson filter parameters
 */
export interface LessonFilters {
  lessonType?: 'video' | 'text' | 'quiz' | 'assignment';
  isPreview?: boolean;
}

/**
 * Lesson Repository Interface
 * 
 * Provides methods for lesson data access operations with caching support.
 * Handles lesson ordering and type-specific validation.
 */
export interface ILessonRepository {
  /**
   * Creates a new lesson in the database
   * 
   * @param data - Lesson creation data
   * @returns The created lesson
   * @throws ConflictError if order number already exists for the module
   * @throws ValidationError if lesson type validation fails
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateLessonDTO): Promise<Lesson>;

  /**
   * Finds a lesson by its unique ID
   * 
   * @param id - Lesson ID
   * @returns The lesson if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Lesson | null>;

  /**
   * Finds all lessons for a module ordered by orderNumber
   * 
   * @param moduleId - Module ID
   * @param filters - Optional filters
   * @returns Array of lessons ordered by orderNumber
   * @throws DatabaseError if database operation fails
   */
  findByModule(moduleId: string, filters?: LessonFilters): Promise<Lesson[]>;

  /**
   * Finds all lessons for a course across all modules
   * 
   * @param courseId - Course ID
   * @param filters - Optional filters
   * @returns Array of lessons ordered by module and lesson order
   * @throws DatabaseError if database operation fails
   */
  findByCourse(courseId: string, filters?: LessonFilters): Promise<Lesson[]>;

  /**
   * Finds lessons by type across all courses
   * 
   * @param lessonType - Lesson type
   * @param courseId - Optional course ID to filter by
   * @returns Array of lessons of the specified type
   * @throws DatabaseError if database operation fails
   */
  findByType(
    lessonType: 'video' | 'text' | 'quiz' | 'assignment',
    courseId?: string
  ): Promise<Lesson[]>;

  /**
   * Finds preview lessons for a course (accessible without enrollment)
   * 
   * @param courseId - Course ID
   * @returns Array of preview lessons
   * @throws DatabaseError if database operation fails
   */
  findPreviewLessons(courseId: string): Promise<Lesson[]>;

  /**
   * Updates a lesson's data
   * 
   * @param id - Lesson ID
   * @param data - Update data
   * @returns The updated lesson
   * @throws NotFoundError if lesson doesn't exist
   * @throws ConflictError if order number update conflicts
   * @throws ValidationError if lesson type validation fails
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateLessonDTO): Promise<Lesson>;

  /**
   * Deletes a lesson
   * 
   * @param id - Lesson ID
   * @returns void
   * @throws NotFoundError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Reorders lessons within a module
   * Updates order numbers to maintain sequential integrity
   * 
   * @param moduleId - Module ID
   * @param lessonIds - Array of lesson IDs in desired order
   * @returns Array of updated lessons
   * @throws NotFoundError if module or lessons don't exist
   * @throws ValidationError if lesson IDs don't belong to module
   * @throws DatabaseError if database operation fails
   */
  reorder(moduleId: string, lessonIds: string[]): Promise<Lesson[]>;

  /**
   * Gets the next available order number for a module
   * 
   * @param moduleId - Module ID
   * @returns Next available order number
   * @throws DatabaseError if database operation fails
   */
  getNextOrderNumber(moduleId: string): Promise<number>;

  /**
   * Updates lesson content URL (for video processing completion)
   * 
   * @param id - Lesson ID
   * @param contentUrl - New content URL
   * @param metadata - Optional metadata update
   * @returns The updated lesson
   * @throws NotFoundError if lesson doesn't exist
   * @throws DatabaseError if database operation fails
   */
  updateContentUrl(id: string, contentUrl: string, metadata?: Record<string, any>): Promise<Lesson>;

  /**
   * Counts lessons by type for a course
   * 
   * @param courseId - Course ID
   * @returns Object with counts by lesson type
   * @throws DatabaseError if database operation fails
   */
  countByType(courseId: string): Promise<{
    video: number;
    text: number;
    quiz: number;
    assignment: number;
    total: number;
  }>;

  /**
   * Validates lesson type-specific requirements
   * 
   * @param lessonType - Lesson type
   * @param data - Lesson data to validate
   * @returns True if valid, throws ValidationError if invalid
   * @throws ValidationError if validation fails
   */
  validateLessonType(
    lessonType: 'video' | 'text' | 'quiz' | 'assignment',
    data: CreateLessonDTO | UpdateLessonDTO
  ): boolean;

  /**
   * Invalidates cache for a specific lesson
   * 
   * @param id - Lesson ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for all lessons in a module
   * 
   * @param moduleId - Module ID
   * @returns void
   */
  invalidateCacheByModule(moduleId: string): Promise<void>;

  /**
   * Invalidates cache for all lessons in a course
   * 
   * @param courseId - Course ID
   * @returns void
   */
  invalidateCacheByCourse(courseId: string): Promise<void>;
}