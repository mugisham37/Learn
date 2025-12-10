/**
 * Course Service Tests
 * 
 * Tests for the CourseService implementation to verify business logic,
 * validation, authorization, and caching behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CourseService } from '../../../src/modules/courses/application/services/CourseService.js';
import { CourseMapper } from '../../../src/modules/courses/application/mappers/CourseMapper.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../../../src/shared/errors/index.js';

// Mock the cache module
vi.mock('../../../src/infrastructure/cache/index.js', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deletePattern: vi.fn().mockResolvedValue(0),
  },
  CachePrefix: {
    COURSE: 'course',
  },
  CacheTTL: {
    MEDIUM: 300,
  },
  buildCacheKey: vi.fn((...args) => args.join(':')),
}));

// Mock dependencies
const mockCourseRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByInstructor: vi.fn(),
  findPublished: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  delete: vi.fn(),
  hardDelete: vi.fn(),
  existsBySlug: vi.fn(),
  incrementEnrollmentCount: vi.fn(),
  decrementEnrollmentCount: vi.fn(),
  updateRating: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateCacheBySlug: vi.fn(),
  invalidateCacheByInstructor: vi.fn(),
};

const mockModuleRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByCourse: vi.fn(),
  findByPrerequisite: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
  getNextOrderNumber: vi.fn(),
  canDelete: vi.fn(),
  updateDuration: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateCacheByCourse: vi.fn(),
};

const mockLessonRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByModule: vi.fn(),
  findByCourse: vi.fn(),
  findByType: vi.fn(),
  findPreviewLessons: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  reorder: vi.fn(),
  getNextOrderNumber: vi.fn(),
  updateContentUrl: vi.fn(),
  countByType: vi.fn(),
  validateLessonType: vi.fn(),
  invalidateCache: vi.fn(),
  invalidateCacheByModule: vi.fn(),
  invalidateCacheByCourse: vi.fn(),
};

describe('CourseService', () => {
  let courseService: CourseService;

  beforeEach(() => {
    vi.clearAllMocks();
    courseService = new CourseService(
      mockCourseRepository as any,
      mockModuleRepository as any,
      mockLessonRepository as any
    );
  });

  describe('createCourse', () => {
    it('should create a course successfully', async () => {
      // Arrange
      const instructorId = 'instructor-123';
      const courseData = {
        instructorId,
        title: 'Test Course',
        description: 'A test course description',
        category: 'Programming',
        difficulty: 'beginner' as const,
        price: '99.99',
        currency: 'USD',
      };

      const mockCourseSchema = {
        id: 'course-123',
        instructorId,
        title: 'Test Course',
        description: 'A test course description',
        slug: 'test-course-abc123',
        category: 'Programming',
        difficulty: 'beginner',
        price: '99.99',
        currency: 'USD',
        enrollmentLimit: null,
        enrollmentCount: 0,
        averageRating: null,
        totalReviews: 0,
        status: 'draft',
        publishedAt: null,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCourseRepository.create.mockResolvedValue(mockCourseSchema);

      // Act
      const result = await courseService.createCourse(instructorId, courseData);

      // Assert
      expect(mockCourseRepository.create).toHaveBeenCalledWith(courseData);
      expect(result).toBeDefined();
      expect(result.title).toBe('Test Course');
      expect(result.instructorId).toBe(instructorId);
    });

    it('should throw ValidationError for invalid instructor ID', async () => {
      // Arrange
      const courseData = {
        instructorId: 'instructor-123',
        title: 'Test Course',
        description: 'A test course description',
        category: 'Programming',
        difficulty: 'beginner' as const,
      };

      // Act & Assert
      await expect(courseService.createCourse('', courseData)).rejects.toThrow(ValidationError);
      await expect(courseService.createCourse(null as any, courseData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid course data', async () => {
      // Arrange
      const instructorId = 'instructor-123';
      const invalidCourseData = {
        instructorId,
        title: '', // Invalid: empty title
        description: 'A test course description',
        category: 'Programming',
        difficulty: 'beginner' as const,
      };

      // Act & Assert
      await expect(courseService.createCourse(instructorId, invalidCourseData)).rejects.toThrow(ValidationError);
    });
  });

  describe('getCourseById', () => {
    it('should return course when found', async () => {
      // Arrange
      const courseId = 'course-123';
      const mockCourseSchema = {
        id: courseId,
        instructorId: 'instructor-123',
        title: 'Test Course',
        description: 'A test course description',
        slug: 'test-course',
        category: 'Programming',
        difficulty: 'beginner',
        price: '99.99',
        currency: 'USD',
        enrollmentLimit: null,
        enrollmentCount: 0,
        averageRating: null,
        totalReviews: 0,
        status: 'published',
        publishedAt: new Date(),
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCourseRepository.findById.mockResolvedValue(mockCourseSchema);

      // Act
      const result = await courseService.getCourseById(courseId);

      // Assert
      expect(mockCourseRepository.findById).toHaveBeenCalledWith(courseId);
      expect(result).toBeDefined();
      expect(result!.id).toBe(courseId);
      expect(result!.title).toBe('Test Course');
    });

    it('should return null when course not found', async () => {
      // Arrange
      const courseId = 'nonexistent-course';
      mockCourseRepository.findById.mockResolvedValue(null);

      // Act
      const result = await courseService.getCourseById(courseId);

      // Assert
      expect(mockCourseRepository.findById).toHaveBeenCalledWith(courseId);
      expect(result).toBeNull();
    });

    it('should throw ValidationError for invalid course ID', async () => {
      // Act & Assert
      await expect(courseService.getCourseById('')).rejects.toThrow(ValidationError);
      await expect(courseService.getCourseById(null as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('updateCourse', () => {
    it('should update course successfully', async () => {
      // Arrange
      const courseId = 'course-123';
      const instructorId = 'instructor-123';
      const updateData = {
        title: 'Updated Course Title',
        description: 'Updated description',
      };

      const mockExistingCourse = {
        id: courseId,
        instructorId,
        title: 'Original Title',
        description: 'Original description',
        slug: 'original-title',
        category: 'Programming',
        difficulty: 'beginner',
        price: '99.99',
        currency: 'USD',
        enrollmentLimit: null,
        enrollmentCount: 0,
        averageRating: null,
        totalReviews: 0,
        status: 'draft',
        publishedAt: null,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedCourse = {
        ...mockExistingCourse,
        title: 'Updated Course Title',
        description: 'Updated description',
        updatedAt: new Date(),
      };

      mockCourseRepository.findById.mockResolvedValue(mockExistingCourse);
      mockCourseRepository.update.mockResolvedValue(mockUpdatedCourse);

      // Act
      const result = await courseService.updateCourse(courseId, instructorId, updateData);

      // Assert
      expect(mockCourseRepository.findById).toHaveBeenCalledWith(courseId);
      expect(mockCourseRepository.update).toHaveBeenCalledWith(courseId, updateData);
      expect(result.title).toBe('Updated Course Title');
      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundError when course does not exist', async () => {
      // Arrange
      const courseId = 'nonexistent-course';
      const instructorId = 'instructor-123';
      const updateData = { title: 'Updated Title' };

      mockCourseRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(courseService.updateCourse(courseId, instructorId, updateData)).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthorizationError when instructor does not own course', async () => {
      // Arrange
      const courseId = 'course-123';
      const instructorId = 'instructor-123';
      const otherInstructorId = 'other-instructor';
      const updateData = { title: 'Updated Title' };

      const mockExistingCourse = {
        id: courseId,
        instructorId: otherInstructorId, // Different instructor
        title: 'Original Title',
        description: 'Original description',
        slug: 'original-title',
        category: 'Programming',
        difficulty: 'beginner',
        price: '99.99',
        currency: 'USD',
        enrollmentLimit: null,
        enrollmentCount: 0,
        averageRating: null,
        totalReviews: 0,
        status: 'draft',
        publishedAt: null,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCourseRepository.findById.mockResolvedValue(mockExistingCourse);

      // Act & Assert
      await expect(courseService.updateCourse(courseId, instructorId, updateData)).rejects.toThrow(AuthorizationError);
    });
  });

  describe('validatePublishRequirements', () => {
    it('should return validation errors when course does not meet requirements', async () => {
      // Arrange
      const courseId = 'course-123';
      const instructorId = 'instructor-123';

      const mockCourse = {
        id: courseId,
        instructorId,
        title: 'Test Course',
        description: 'Short', // Too short description
        slug: 'test-course',
        category: 'Programming',
        difficulty: 'beginner',
        price: '99.99',
        currency: 'USD',
        enrollmentLimit: null,
        enrollmentCount: 0,
        averageRating: null,
        totalReviews: 0,
        status: 'draft',
        publishedAt: null,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Only 2 modules (need at least 3)
      const mockModules = [
        {
          id: 'module-1',
          courseId,
          title: 'Module 1',
          description: null,
          orderNumber: 1,
          durationMinutes: 60,
          prerequisiteModuleId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'module-2',
          courseId,
          title: 'Module 2',
          description: null,
          orderNumber: 2,
          durationMinutes: 45,
          prerequisiteModuleId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCourseRepository.findById.mockResolvedValue(mockCourse);
      mockModuleRepository.findByCourse.mockResolvedValue(mockModules);
      mockLessonRepository.findByModule.mockResolvedValue([]);

      // Act
      const result = await courseService.validatePublishRequirements(courseId, instructorId);

      // Assert
      expect(result.canPublish).toBe(false);
      expect(result.reasons).toContain('Course must have at least 3 modules');
      expect(result.reasons).toContain('Course description must be at least 50 characters');
    });

    it('should return success when course meets all requirements', async () => {
      // Arrange
      const courseId = 'course-123';
      const instructorId = 'instructor-123';

      const mockCourse = {
        id: courseId,
        instructorId,
        title: 'Test Course',
        description: 'This is a comprehensive course description that meets the minimum length requirement for publication.',
        slug: 'test-course',
        category: 'Programming',
        difficulty: 'beginner',
        price: '99.99',
        currency: 'USD',
        enrollmentLimit: null,
        enrollmentCount: 0,
        averageRating: null,
        totalReviews: 0,
        status: 'draft',
        publishedAt: null,
        thumbnailUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 3 modules with lessons
      const mockModules = [
        {
          id: 'module-1',
          courseId,
          title: 'Module 1',
          description: null,
          orderNumber: 1,
          durationMinutes: 60,
          prerequisiteModuleId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'module-2',
          courseId,
          title: 'Module 2',
          description: null,
          orderNumber: 2,
          durationMinutes: 45,
          prerequisiteModuleId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'module-3',
          courseId,
          title: 'Module 3',
          description: null,
          orderNumber: 3,
          durationMinutes: 30,
          prerequisiteModuleId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockLessons = [
        {
          id: 'lesson-1',
          moduleId: 'module-1',
          title: 'Lesson 1',
          description: null,
          lessonType: 'text',
          contentUrl: null,
          contentText: 'Lesson content',
          durationMinutes: 30,
          orderNumber: 1,
          isPreview: false,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockCourseRepository.findById.mockResolvedValue(mockCourse);
      mockModuleRepository.findByCourse.mockResolvedValue(mockModules);
      mockLessonRepository.findByModule.mockResolvedValue(mockLessons);

      // Act
      const result = await courseService.validatePublishRequirements(courseId, instructorId);

      // Assert
      expect(result.canPublish).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });
  });
});