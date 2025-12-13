/**
 * Course Service Implementation
 *
 * Implements business logic for course management operations.
 * Handles validation, authorization, caching, and domain event publishing.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { Course } from '../../domain/entities/Course.js';
import { CourseModule } from '../../domain/entities/CourseModule.js';
import { Lesson } from '../../domain/entities/Lesson.js';
import { ICourseService, PublicationValidationResult } from './ICourseService.js';
import { CourseMapper, CourseModuleMapper, LessonMapper } from '../mappers/CourseMapper.js';
import {
  ICourseRepository,
  CreateCourseDTO,
  UpdateCourseDTO,
  PaginationParams,
  PaginatedResult,
  CourseFilters,
} from '../../infrastructure/repositories/ICourseRepository.js';
import {
  ICourseModuleRepository,
  CreateCourseModuleDTO,
  UpdateCourseModuleDTO,
} from '../../infrastructure/repositories/ICourseModuleRepository.js';
import {
  ILessonRepository,
  CreateLessonDTO,
  UpdateLessonDTO,
} from '../../infrastructure/repositories/ILessonRepository.js';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  ConflictError,
} from '../../../../shared/errors/index.js';
import { sanitizeByContentType } from '../../../../shared/utils/sanitization.js';
import {
  cache,
  CachePrefix,
  CacheTTL,
  buildCacheKey,
} from '../../../../infrastructure/cache/index.js';

/**
 * Course Service Implementation
 *
 * Orchestrates course management operations with proper validation,
 * authorization, caching, and domain event handling.
 */
export class CourseService implements ICourseService {
  constructor(
    private readonly courseRepository: ICourseRepository,
    private readonly moduleRepository: ICourseModuleRepository,
    private readonly lessonRepository: ILessonRepository
  ) {}

  /**
   * Creates a new course with slug generation
   * Requirements: 3.1
   */
  async createCourse(instructorId: string, data: CreateCourseDTO): Promise<Course> {
    // Validate instructor ID
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Validate course data
    this.validateCourseData(data);

    // Ensure instructor ID matches the data and sanitize content
    const courseData: CreateCourseDTO = {
      ...data,
      instructorId,
      description: sanitizeByContentType(data.description, 'course.description'),
    };

    // Create course with automatic slug generation
    // Repository handles slug uniqueness conflicts by regenerating
    const courseSchema = await this.courseRepository.create(courseData);

    // Convert to domain entity
    const course = CourseMapper.toDomain(courseSchema);

    // Invalidate instructor's course cache
    await this.invalidateInstructorCache(instructorId);

    return course;
  }

  /**
   * Gets a course by ID with caching
   */
  async getCourseById(id: string): Promise<Course | null> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Course ID is required');
    }

    // Try cache first
    const cacheKey = buildCacheKey(CachePrefix.COURSE, 'id', id);
    const cached = await cache.get<Course>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const courseSchema = await this.courseRepository.findById(id);
    if (courseSchema) {
      const course = CourseMapper.toDomain(courseSchema);
      // Cache for medium duration (5 minutes)
      await cache.set(cacheKey, course, CacheTTL.MEDIUM);
      return course;
    }

    return null;
  }

  /**
   * Gets a course by slug with caching
   */
  async getCourseBySlug(slug: string): Promise<Course | null> {
    if (!slug || typeof slug !== 'string') {
      throw new ValidationError('Course slug is required');
    }

    // Try cache first
    const cacheKey = buildCacheKey(CachePrefix.COURSE, 'slug', slug);
    const cached = await cache.get<Course>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const courseSchema = await this.courseRepository.findBySlug(slug);
    if (courseSchema) {
      const course = CourseMapper.toDomain(courseSchema);
      // Cache for medium duration (5 minutes)
      await cache.set(cacheKey, course, CacheTTL.MEDIUM);
      return course;
    }

    return null;
  }

  /**
   * Gets courses by instructor with pagination and filtering
   */
  async getCoursesByInstructor(
    instructorId: string,
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>> {
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    this.validatePagination(pagination);

    const result = await this.courseRepository.findByInstructor(instructorId, pagination, filters);

    return {
      ...result,
      data: CourseMapper.toDomainArray(result.data),
    };
  }

  /**
   * Gets published courses with pagination and filtering
   */
  async getPublishedCourses(
    pagination: PaginationParams,
    filters?: CourseFilters
  ): Promise<PaginatedResult<Course>> {
    this.validatePagination(pagination);

    const result = await this.courseRepository.findPublished(pagination, filters);

    return {
      ...result,
      data: CourseMapper.toDomainArray(result.data),
    };
  }

  /**
   * Updates course metadata with cache invalidation
   * Requirements: 3.6
   */
  async updateCourse(
    courseId: string,
    instructorId: string,
    data: UpdateCourseDTO
  ): Promise<Course> {
    if (!courseId || typeof courseId !== 'string') {
      throw new ValidationError('Course ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Verify course exists and instructor owns it
    await this.verifyInstructorOwnership(courseId, instructorId);

    // Validate update data
    this.validateCourseUpdateData(data);

    // Update course with sanitized content
    const sanitizedData = {
      ...data,
      ...(data.description && {
        description: sanitizeByContentType(data.description, 'course.description'),
      }),
    };
    const updatedCourseSchema = await this.courseRepository.update(courseId, sanitizedData);
    const updatedCourse = CourseMapper.toDomain(updatedCourseSchema);

    // Invalidate caches
    await this.invalidateCourseCache(courseId);
    await this.invalidateInstructorCache(instructorId);

    return updatedCourse;
  }

  /**
   * Adds a module to a course with ordering
   * Requirements: 3.2
   */
  async addModule(
    courseId: string,
    instructorId: string,
    data: Omit<CreateCourseModuleDTO, 'courseId'>
  ): Promise<CourseModule> {
    if (!courseId || typeof courseId !== 'string') {
      throw new ValidationError('Course ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Verify course exists and instructor owns it
    await this.verifyInstructorOwnership(courseId, instructorId);

    // Validate module data
    this.validateModuleData(data);

    // Get next order number if not provided
    let orderNumber = data.orderNumber;
    if (!orderNumber) {
      orderNumber = await this.moduleRepository.getNextOrderNumber(courseId);
    }

    // Create module with sanitized content
    const moduleData: CreateCourseModuleDTO = {
      ...data,
      courseId,
      orderNumber,
      ...(data.description && {
        description: sanitizeByContentType(data.description, 'module.description'),
      }),
    };

    const moduleSchema = await this.moduleRepository.create(moduleData);
    const module = CourseModuleMapper.toDomain(moduleSchema);

    // Invalidate course cache
    await this.invalidateCourseCache(courseId);

    return module;
  }

  /**
   * Updates a module with cache invalidation
   */
  async updateModule(
    moduleId: string,
    instructorId: string,
    data: UpdateCourseModuleDTO
  ): Promise<CourseModule> {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new ValidationError('Module ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Get module to verify ownership
    const moduleSchema = await this.moduleRepository.findById(moduleId);
    if (!moduleSchema) {
      throw new NotFoundError('Course module', moduleId);
    }

    // Verify instructor owns the course
    await this.verifyInstructorOwnership(moduleSchema.courseId, instructorId);

    // Validate update data
    this.validateModuleUpdateData(data);

    // Update module
    const updatedModuleSchema = await this.moduleRepository.update(moduleId, data);
    const updatedModule = CourseModuleMapper.toDomain(updatedModuleSchema);

    // Invalidate caches
    await this.invalidateCourseCache(moduleSchema.courseId);

    return updatedModule;
  }

  /**
   * Adds a lesson to a module with ordering and type validation
   * Requirements: 3.3
   */
  async addLesson(
    moduleId: string,
    instructorId: string,
    data: Omit<CreateLessonDTO, 'moduleId'>
  ): Promise<Lesson> {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new ValidationError('Module ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Get module to verify ownership
    const moduleSchema = await this.moduleRepository.findById(moduleId);
    if (!moduleSchema) {
      throw new NotFoundError('Course module', moduleId);
    }

    // Verify instructor owns the course
    await this.verifyInstructorOwnership(moduleSchema.courseId, instructorId);

    // Validate lesson data and type-specific requirements
    this.validateLessonData(data);
    this.lessonRepository.validateLessonType(data.lessonType, data);

    // Get next order number if not provided
    let orderNumber = data.orderNumber;
    if (!orderNumber) {
      orderNumber = await this.lessonRepository.getNextOrderNumber(moduleId);
    }

    // Create lesson with sanitized content
    const lessonData: CreateLessonDTO = {
      ...data,
      moduleId,
      orderNumber,
      ...(data.contentText && {
        contentText: sanitizeByContentType(data.contentText, 'lesson.contentText'),
      }),
    };

    const lessonSchema = await this.lessonRepository.create(lessonData);
    const lesson = LessonMapper.toDomain(lessonSchema);

    // Update module duration
    await this.moduleRepository.updateDuration(moduleId);

    // Invalidate caches
    await this.invalidateCourseCache(moduleSchema.courseId);

    return lesson;
  }

  /**
   * Updates a lesson with cache invalidation
   */
  async updateLesson(
    lessonId: string,
    instructorId: string,
    data: UpdateLessonDTO
  ): Promise<Lesson> {
    if (!lessonId || typeof lessonId !== 'string') {
      throw new ValidationError('Lesson ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Get lesson to verify ownership
    const lessonSchema = await this.lessonRepository.findById(lessonId);
    if (!lessonSchema) {
      throw new NotFoundError('Lesson', lessonId);
    }

    // Get module to get course ID
    const moduleSchema = await this.moduleRepository.findById(lessonSchema.moduleId);
    if (!moduleSchema) {
      throw new NotFoundError('Course module', lessonSchema.moduleId);
    }

    // Verify instructor owns the course
    await this.verifyInstructorOwnership(moduleSchema.courseId, instructorId);

    // Validate update data and type-specific requirements if type is being changed
    this.validateLessonUpdateData(data);
    if (data.lessonType) {
      this.lessonRepository.validateLessonType(data.lessonType, data);
    }

    // Update lesson
    const updatedLessonSchema = await this.lessonRepository.update(lessonId, data);
    const updatedLesson = LessonMapper.toDomain(updatedLessonSchema);

    // Update module duration if lesson duration changed
    if (data.durationMinutes !== undefined) {
      await this.moduleRepository.updateDuration(lessonSchema.moduleId);
    }

    // Invalidate caches
    await this.invalidateCourseCache(moduleSchema.courseId);

    return updatedLesson;
  }

  /**
   * Reorders modules within a course
   * Requirements: 3.4
   */
  async reorderModules(
    courseId: string,
    instructorId: string,
    moduleIds: string[]
  ): Promise<CourseModule[]> {
    if (!courseId || typeof courseId !== 'string') {
      throw new ValidationError('Course ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
      throw new ValidationError('Module IDs array is required and cannot be empty');
    }

    // Verify course exists and instructor owns it
    await this.verifyInstructorOwnership(courseId, instructorId);

    // Validate all module IDs are strings
    if (!moduleIds.every((id) => typeof id === 'string' && id.length > 0)) {
      throw new ValidationError('All module IDs must be non-empty strings');
    }

    // Reorder modules (repository handles validation of module ownership and count)
    const reorderedModulesSchema = await this.moduleRepository.reorder(courseId, moduleIds);
    const reorderedModules = CourseModuleMapper.toDomainArray(reorderedModulesSchema);

    // Invalidate course cache
    await this.invalidateCourseCache(courseId);

    return reorderedModules;
  }

  /**
   * Reorders lessons within a module
   * Requirements: 3.4
   */
  async reorderLessons(
    moduleId: string,
    instructorId: string,
    lessonIds: string[]
  ): Promise<Lesson[]> {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new ValidationError('Module ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }
    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      throw new ValidationError('Lesson IDs array is required and cannot be empty');
    }

    // Get module to verify ownership
    const moduleSchema = await this.moduleRepository.findById(moduleId);
    if (!moduleSchema) {
      throw new NotFoundError('Course module', moduleId);
    }

    // Verify instructor owns the course
    await this.verifyInstructorOwnership(moduleSchema.courseId, instructorId);

    // Validate all lesson IDs are strings
    if (!lessonIds.every((id) => typeof id === 'string' && id.length > 0)) {
      throw new ValidationError('All lesson IDs must be non-empty strings');
    }

    // Reorder lessons (repository handles validation of lesson ownership and count)
    const reorderedLessonsSchema = await this.lessonRepository.reorder(moduleId, lessonIds);
    const reorderedLessons = LessonMapper.toDomainArray(reorderedLessonsSchema);

    // Invalidate course cache
    await this.invalidateCourseCache(moduleSchema.courseId);

    return reorderedLessons;
  }

  /**
   * Validates course publication requirements
   * Requirements: 3.5
   */
  async validatePublishRequirements(
    courseId: string,
    instructorId: string
  ): Promise<PublicationValidationResult> {
    if (!courseId || typeof courseId !== 'string') {
      throw new ValidationError('Course ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Verify course exists and instructor owns it
    const course = await this.verifyInstructorOwnership(courseId, instructorId);

    const reasons: string[] = [];

    // Get all modules for the course
    const modulesSchema = await this.moduleRepository.findByCourse(courseId);
    const modules = CourseModuleMapper.toDomainArray(modulesSchema);

    // Must have at least 3 modules
    if (modules.length < 3) {
      reasons.push('Course must have at least 3 modules');
    }

    // Check each module has content
    for (const module of modules) {
      const lessonsSchema = await this.lessonRepository.findByModule(module.id);
      const lessons = LessonMapper.toDomainArray(lessonsSchema);

      if (lessons.length === 0) {
        reasons.push(`Module "${module.title}" must have at least one lesson`);
      }

      // Check video lessons are processed
      const unprocessedVideos = lessons.filter(
        (lesson) => lesson.type === 'video' && !lesson.contentUrl
      );
      if (unprocessedVideos.length > 0) {
        reasons.push(
          `Module "${module.title}" has ${unprocessedVideos.length} unprocessed video(s)`
        );
      }
    }

    // Check course has required metadata
    if (!course.description || course.description.trim().length < 50) {
      reasons.push('Course description must be at least 50 characters');
    }

    if (!course.category || course.category.trim().length === 0) {
      reasons.push('Course category is required');
    }

    return {
      canPublish: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Publishes a course with validation
   * Requirements: 3.5
   */
  async publishCourse(courseId: string, instructorId: string): Promise<Course> {
    if (!courseId || typeof courseId !== 'string') {
      throw new ValidationError('Course ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Validate publication requirements
    const validation = await this.validatePublishRequirements(courseId, instructorId);
    if (!validation.canPublish) {
      throw new ValidationError(
        `Cannot publish course: ${validation.reasons.join(', ')}`,
        validation.reasons.map((reason) => ({ field: 'course', message: reason }))
      );
    }

    // Publish course
    const publishedCourseSchema = await this.courseRepository.publish(courseId);
    const publishedCourse = CourseMapper.toDomain(publishedCourseSchema);

    // Invalidate caches
    await this.invalidateCourseCache(courseId);
    await this.invalidateInstructorCache(instructorId);

    return publishedCourse;
  }

  /**
   * Soft deletes a course (sets status to archived)
   */
  async deleteCourse(courseId: string, instructorId: string): Promise<void> {
    if (!courseId || typeof courseId !== 'string') {
      throw new ValidationError('Course ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Verify course exists and instructor owns it
    await this.verifyInstructorOwnership(courseId, instructorId);

    // Soft delete course
    await this.courseRepository.delete(courseId);

    // Invalidate caches
    await this.invalidateCourseCache(courseId);
    await this.invalidateInstructorCache(instructorId);
  }

  /**
   * Permanently deletes a course with cascade deletion
   * Requirements: 3.7
   */
  async hardDeleteCourse(courseId: string, instructorId: string): Promise<void> {
    if (!courseId || typeof courseId !== 'string') {
      throw new ValidationError('Course ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Verify course exists and instructor owns it
    await this.verifyInstructorOwnership(courseId, instructorId);

    // Hard delete course (cascades to modules and lessons)
    await this.courseRepository.hardDelete(courseId);

    // Invalidate caches
    await this.invalidateCourseCache(courseId);
    await this.invalidateInstructorCache(instructorId);
  }

  /**
   * Deletes a module and all its lessons
   */
  async deleteModule(moduleId: string, instructorId: string): Promise<void> {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new ValidationError('Module ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Get module to verify ownership
    const moduleSchema = await this.moduleRepository.findById(moduleId);
    if (!moduleSchema) {
      throw new NotFoundError('Course module', moduleId);
    }

    // Verify instructor owns the course
    await this.verifyInstructorOwnership(moduleSchema.courseId, instructorId);

    // Check if module can be deleted (no dependent modules)
    const canDelete = await this.moduleRepository.canDelete(moduleId);
    if (!canDelete) {
      throw new ConflictError('Cannot delete module: other modules depend on it as a prerequisite');
    }

    // Delete module
    await this.moduleRepository.delete(moduleId);

    // Invalidate course cache
    await this.invalidateCourseCache(moduleSchema.courseId);
  }

  /**
   * Deletes a lesson
   */
  async deleteLesson(lessonId: string, instructorId: string): Promise<void> {
    if (!lessonId || typeof lessonId !== 'string') {
      throw new ValidationError('Lesson ID is required');
    }
    if (!instructorId || typeof instructorId !== 'string') {
      throw new ValidationError('Instructor ID is required');
    }

    // Get lesson to verify ownership
    const lessonSchema = await this.lessonRepository.findById(lessonId);
    if (!lessonSchema) {
      throw new NotFoundError('Lesson', lessonId);
    }

    // Get module to get course ID
    const moduleSchema = await this.moduleRepository.findById(lessonSchema.moduleId);
    if (!moduleSchema) {
      throw new NotFoundError('Course module', lessonSchema.moduleId);
    }

    // Verify instructor owns the course
    await this.verifyInstructorOwnership(moduleSchema.courseId, instructorId);

    // Delete lesson
    await this.lessonRepository.delete(lessonId);

    // Update module duration
    await this.moduleRepository.updateDuration(lessonSchema.moduleId);

    // Invalidate course cache
    await this.invalidateCourseCache(moduleSchema.courseId);
  }

  /**
   * Invalidates all cache entries for a course
   * Requirements: 3.6
   */
  async invalidateCourseCache(courseId: string): Promise<void> {
    if (!courseId || typeof courseId !== 'string') {
      return;
    }

    // Invalidate course-specific caches
    await this.courseRepository.invalidateCache(courseId);
    await this.moduleRepository.invalidateCacheByCourse(courseId);
    await this.lessonRepository.invalidateCacheByCourse(courseId);

    // Invalidate general course cache patterns
    const patterns = [
      buildCacheKey(CachePrefix.COURSE, 'id', courseId),
      buildCacheKey(CachePrefix.COURSE, 'slug', '*'),
      buildCacheKey(CachePrefix.COURSE, 'published', '*'),
    ];

    for (const pattern of patterns) {
      await cache.deletePattern(pattern);
    }
  }

  // Private helper methods

  /**
   * Verifies that an instructor owns a course
   */
  private async verifyInstructorOwnership(courseId: string, instructorId: string): Promise<Course> {
    const courseSchema = await this.courseRepository.findById(courseId);
    if (!courseSchema) {
      throw new NotFoundError('Course', courseId);
    }

    if (courseSchema.instructorId !== instructorId) {
      throw new AuthorizationError('You do not have permission to modify this course');
    }

    return CourseMapper.toDomain(courseSchema);
  }

  /**
   * Invalidates instructor-specific caches
   */
  private async invalidateInstructorCache(instructorId: string): Promise<void> {
    await this.courseRepository.invalidateCacheByInstructor(instructorId);

    const pattern = buildCacheKey(CachePrefix.COURSE, 'instructor', instructorId, '*');
    await cache.deletePattern(pattern);
  }

  /**
   * Validates course creation data
   */
  private validateCourseData(data: CreateCourseDTO): void {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new ValidationError('Course title is required');
    }
    if (data.title.length > 255) {
      throw new ValidationError('Course title cannot exceed 255 characters');
    }
    if (
      !data.description ||
      typeof data.description !== 'string' ||
      data.description.trim().length === 0
    ) {
      throw new ValidationError('Course description is required');
    }
    if (!data.category || typeof data.category !== 'string' || data.category.trim().length === 0) {
      throw new ValidationError('Course category is required');
    }
    if (!['beginner', 'intermediate', 'advanced'].includes(data.difficulty)) {
      throw new ValidationError('Course difficulty must be beginner, intermediate, or advanced');
    }
    if (
      data.price &&
      (typeof data.price !== 'string' ||
        isNaN(parseFloat(data.price)) ||
        parseFloat(data.price) < 0)
    ) {
      throw new ValidationError('Course price must be a valid non-negative number');
    }
    if (
      data.enrollmentLimit &&
      (typeof data.enrollmentLimit !== 'number' || data.enrollmentLimit <= 0)
    ) {
      throw new ValidationError('Enrollment limit must be a positive number');
    }
  }

  /**
   * Validates course update data
   */
  private validateCourseUpdateData(data: UpdateCourseDTO): void {
    if (data.title !== undefined) {
      if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new ValidationError('Course title cannot be empty');
      }
      if (data.title.length > 255) {
        throw new ValidationError('Course title cannot exceed 255 characters');
      }
    }
    if (data.description !== undefined) {
      if (
        !data.description ||
        typeof data.description !== 'string' ||
        data.description.trim().length === 0
      ) {
        throw new ValidationError('Course description cannot be empty');
      }
    }
    if (data.category !== undefined) {
      if (
        !data.category ||
        typeof data.category !== 'string' ||
        data.category.trim().length === 0
      ) {
        throw new ValidationError('Course category cannot be empty');
      }
    }
    if (data.difficulty !== undefined) {
      if (!['beginner', 'intermediate', 'advanced'].includes(data.difficulty)) {
        throw new ValidationError('Course difficulty must be beginner, intermediate, or advanced');
      }
    }
    if (data.price !== undefined) {
      if (
        typeof data.price !== 'string' ||
        isNaN(parseFloat(data.price)) ||
        parseFloat(data.price) < 0
      ) {
        throw new ValidationError('Course price must be a valid non-negative number');
      }
    }
    if (data.enrollmentLimit !== undefined) {
      if (typeof data.enrollmentLimit !== 'number' || data.enrollmentLimit <= 0) {
        throw new ValidationError('Enrollment limit must be a positive number');
      }
    }
  }

  /**
   * Validates module creation data
   */
  private validateModuleData(data: Omit<CreateCourseModuleDTO, 'courseId'>): void {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new ValidationError('Module title is required');
    }
    if (data.title.length > 255) {
      throw new ValidationError('Module title cannot exceed 255 characters');
    }
    if (
      data.orderNumber !== undefined &&
      (typeof data.orderNumber !== 'number' || data.orderNumber <= 0)
    ) {
      throw new ValidationError('Module order number must be a positive number');
    }
    if (
      data.durationMinutes !== undefined &&
      (typeof data.durationMinutes !== 'number' || data.durationMinutes < 0)
    ) {
      throw new ValidationError('Module duration must be a non-negative number');
    }
  }

  /**
   * Validates module update data
   */
  private validateModuleUpdateData(data: UpdateCourseModuleDTO): void {
    if (data.title !== undefined) {
      if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new ValidationError('Module title cannot be empty');
      }
      if (data.title.length > 255) {
        throw new ValidationError('Module title cannot exceed 255 characters');
      }
    }
    if (
      data.orderNumber !== undefined &&
      (typeof data.orderNumber !== 'number' || data.orderNumber <= 0)
    ) {
      throw new ValidationError('Module order number must be a positive number');
    }
    if (
      data.durationMinutes !== undefined &&
      (typeof data.durationMinutes !== 'number' || data.durationMinutes < 0)
    ) {
      throw new ValidationError('Module duration must be a non-negative number');
    }
  }

  /**
   * Validates lesson creation data
   */
  private validateLessonData(data: Omit<CreateLessonDTO, 'moduleId'>): void {
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new ValidationError('Lesson title is required');
    }
    if (data.title.length > 255) {
      throw new ValidationError('Lesson title cannot exceed 255 characters');
    }
    if (!['video', 'text', 'quiz', 'assignment'].includes(data.lessonType)) {
      throw new ValidationError('Lesson type must be video, text, quiz, or assignment');
    }
    if (
      data.orderNumber !== undefined &&
      (typeof data.orderNumber !== 'number' || data.orderNumber <= 0)
    ) {
      throw new ValidationError('Lesson order number must be a positive number');
    }
    if (
      data.durationMinutes !== undefined &&
      (typeof data.durationMinutes !== 'number' || data.durationMinutes < 0)
    ) {
      throw new ValidationError('Lesson duration must be a non-negative number');
    }
    if (data.isPreview !== undefined && typeof data.isPreview !== 'boolean') {
      throw new ValidationError('Lesson preview flag must be a boolean');
    }
  }

  /**
   * Validates lesson update data
   */
  private validateLessonUpdateData(data: UpdateLessonDTO): void {
    if (data.title !== undefined) {
      if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new ValidationError('Lesson title cannot be empty');
      }
      if (data.title.length > 255) {
        throw new ValidationError('Lesson title cannot exceed 255 characters');
      }
    }
    if (
      data.lessonType !== undefined &&
      !['video', 'text', 'quiz', 'assignment'].includes(data.lessonType)
    ) {
      throw new ValidationError('Lesson type must be video, text, quiz, or assignment');
    }
    if (
      data.orderNumber !== undefined &&
      (typeof data.orderNumber !== 'number' || data.orderNumber <= 0)
    ) {
      throw new ValidationError('Lesson order number must be a positive number');
    }
    if (
      data.durationMinutes !== undefined &&
      (typeof data.durationMinutes !== 'number' || data.durationMinutes < 0)
    ) {
      throw new ValidationError('Lesson duration must be a non-negative number');
    }
    if (data.isPreview !== undefined && typeof data.isPreview !== 'boolean') {
      throw new ValidationError('Lesson preview flag must be a boolean');
    }
  }

  /**
   * Validates pagination parameters
   */
  private validatePagination(pagination: PaginationParams): void {
    if (!pagination || typeof pagination !== 'object') {
      throw new ValidationError('Pagination parameters are required');
    }
    if (typeof pagination.page !== 'number' || pagination.page < 1) {
      throw new ValidationError('Page number must be a positive integer');
    }
    if (typeof pagination.limit !== 'number' || pagination.limit < 1 || pagination.limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }
  }
}
