/**
 * Course GraphQL Resolvers Tests
 * 
 * Tests for the GraphQL resolvers to verify proper functionality,
 * authorization, error handling, and DataLoader integration.
 * 
 * Requirements: 21.2, 21.3, 21.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphQLError } from 'graphql';
import { courseResolvers, type GraphQLContext } from '../../../src/modules/courses/presentation/graphql/resolvers.js';
import { CourseDataLoaders } from '../../../src/modules/courses/presentation/graphql/dataloaders.js';
import { Course } from '../../../src/modules/courses/domain/entities/Course.js';
import { CourseModule } from '../../../src/modules/courses/domain/entities/CourseModule.js';
import { Lesson } from '../../../src/modules/courses/domain/entities/Lesson.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../../../src/shared/errors/index.js';

// Mock course service
const mockCourseService = {
  createCourse: vi.fn(),
  getCourseById: vi.fn(),
  getCourseBySlug: vi.fn(),
  getCoursesByInstructor: vi.fn(),
  getPublishedCourses: vi.fn(),
  updateCourse: vi.fn(),
  publishCourse: vi.fn(),
  deleteCourse: vi.fn(),
  addModule: vi.fn(),
  addLesson: vi.fn(),
  reorderModules: vi.fn(),
  reorderLessons: vi.fn(),
  updateModule: vi.fn(),
  updateLesson: vi.fn(),
  deleteModule: vi.fn(),
  deleteLesson: vi.fn(),
  validatePublishRequirements: vi.fn(),
};

// Mock DataLoaders
const mockDataLoaders = {
  courseById: {
    load: vi.fn(),
    loadMany: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    prime: vi.fn(),
  },
  modulesByCourseId: {
    load: vi.fn(),
    loadMany: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    prime: vi.fn(),
  },
  moduleById: {
    load: vi.fn(),
    loadMany: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    prime: vi.fn(),
  },
  lessonsByModuleId: {
    load: vi.fn(),
    loadMany: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    prime: vi.fn(),
  },
  lessonById: {
    load: vi.fn(),
    loadMany: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    prime: vi.fn(),
  },
} as unknown as CourseDataLoaders;

// Helper to create authenticated context
function createAuthenticatedContext(role: string = 'educator'): GraphQLContext {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role,
    },
    courseService: mockCourseService as any,
    dataloaders: mockDataLoaders,
  };
}

// Helper to create unauthenticated context
function createUnauthenticatedContext(): GraphQLContext {
  return {
    courseService: mockCourseService as any,
    dataloaders: mockDataLoaders,
  };
}

// Sample course data
const sampleCourse = new Course({
  id: 'course-123',
  instructorId: 'user-123',
  title: 'Test Course',
  description: 'A test course',
  slug: 'test-course',
  category: 'programming',
  difficulty: 'beginner',
  price: '99.99',
  currency: 'USD',
  enrollmentLimit: 100,
  enrollmentCount: 0,
  averageRating: undefined,
  totalReviews: 0,
  status: 'draft',
  publishedAt: undefined,
  thumbnailUrl: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('Course GraphQL Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Resolvers', () => {
    describe('course', () => {
      it('should return course when found', async () => {
        // Arrange
        const context = createAuthenticatedContext();
        mockCourseService.getCourseById.mockResolvedValue(sampleCourse);

        // Act
        const result = await courseResolvers.Query.course(null, { id: 'course-123' }, context);

        // Assert
        expect(result).toBe(sampleCourse);
        expect(mockCourseService.getCourseById).toHaveBeenCalledWith('course-123');
      });

      it('should return null when course not found', async () => {
        // Arrange
        const context = createAuthenticatedContext();
        mockCourseService.getCourseById.mockResolvedValue(null);

        // Act
        const result = await courseResolvers.Query.course(null, { id: 'nonexistent' }, context);

        // Assert
        expect(result).toBeNull();
        expect(mockCourseService.getCourseById).toHaveBeenCalledWith('nonexistent');
      });

      it('should throw GraphQLError on service error', async () => {
        // Arrange
        const context = createAuthenticatedContext();
        mockCourseService.getCourseById.mockRejectedValue(new Error('Database error'));

        // Act & Assert
        await expect(
          courseResolvers.Query.course(null, { id: 'course-123' }, context)
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe('myCourses', () => {
      it('should require educator role', async () => {
        // Arrange
        const context = createAuthenticatedContext('student');

        // Act & Assert
        await expect(
          courseResolvers.Query.myCourses(null, {}, context)
        ).rejects.toThrow(GraphQLError);
      });

      it('should return paginated courses for educator', async () => {
        // Arrange
        const context = createAuthenticatedContext('educator');
        const mockResult = {
          data: [sampleCourse],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        };
        mockCourseService.getCoursesByInstructor.mockResolvedValue(mockResult);

        // Act
        const result = await courseResolvers.Query.myCourses(null, {}, context);

        // Assert
        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].node).toBe(sampleCourse);
        expect(result.totalCount).toBe(1);
        expect(mockCourseService.getCoursesByInstructor).toHaveBeenCalledWith(
          'user-123',
          { page: 1, limit: 20 },
          undefined
        );
      });
    });
  });

  describe('Mutation Resolvers', () => {
    describe('createCourse', () => {
      it('should require authentication', async () => {
        // Arrange
        const context = createUnauthenticatedContext();
        const input = {
          title: 'New Course',
          description: 'Course description',
          category: 'programming',
          difficulty: 'BEGINNER' as const,
        };

        // Act & Assert
        await expect(
          courseResolvers.Mutation.createCourse(null, { input }, context)
        ).rejects.toThrow(GraphQLError);
      });

      it('should require educator role', async () => {
        // Arrange
        const context = createAuthenticatedContext('student');
        const input = {
          title: 'New Course',
          description: 'Course description',
          category: 'programming',
          difficulty: 'BEGINNER' as const,
        };

        // Act & Assert
        await expect(
          courseResolvers.Mutation.createCourse(null, { input }, context)
        ).rejects.toThrow(GraphQLError);
      });

      it('should create course successfully', async () => {
        // Arrange
        const context = createAuthenticatedContext('educator');
        const input = {
          title: 'New Course',
          description: 'Course description',
          category: 'programming',
          difficulty: 'BEGINNER' as const,
        };
        mockCourseService.createCourse.mockResolvedValue(sampleCourse);

        // Act
        const result = await courseResolvers.Mutation.createCourse(null, { input }, context);

        // Assert
        expect(result).toBe(sampleCourse);
        expect(mockCourseService.createCourse).toHaveBeenCalledWith('user-123', {
          instructorId: 'user-123',
          title: 'New Course',
          description: 'Course description',
          category: 'programming',
          difficulty: 'beginner',
          price: '0',
          currency: 'USD',
          enrollmentLimit: undefined,
          thumbnailUrl: undefined,
        });
      });

      it('should validate required fields', async () => {
        // Arrange
        const context = createAuthenticatedContext('educator');
        const input = {
          title: '',
          description: 'Course description',
          category: 'programming',
          difficulty: 'BEGINNER' as const,
        };

        // Act & Assert
        await expect(
          courseResolvers.Mutation.createCourse(null, { input }, context)
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe('publishCourse', () => {
      it('should require educator role', async () => {
        // Arrange
        const context = createAuthenticatedContext('student');

        // Act & Assert
        await expect(
          courseResolvers.Mutation.publishCourse(null, { id: 'course-123' }, context)
        ).rejects.toThrow(GraphQLError);
      });

      it('should publish course successfully', async () => {
        // Arrange
        const context = createAuthenticatedContext('educator');
        const publishedCourse = { ...sampleCourse, status: 'published' };
        mockCourseService.publishCourse.mockResolvedValue(publishedCourse);

        // Act
        const result = await courseResolvers.Mutation.publishCourse(null, { id: 'course-123' }, context);

        // Assert
        expect(result).toBe(publishedCourse);
        expect(mockCourseService.publishCourse).toHaveBeenCalledWith('course-123', 'user-123');
      });

      it('should handle authorization errors', async () => {
        // Arrange
        const context = createAuthenticatedContext('educator');
        mockCourseService.publishCourse.mockRejectedValue(new AuthorizationError('Not authorized'));

        // Act & Assert
        await expect(
          courseResolvers.Mutation.publishCourse(null, { id: 'course-123' }, context)
        ).rejects.toThrow(GraphQLError);
      });
    });
  });

  describe('Field Resolvers', () => {
    describe('Course.modules', () => {
      it('should return existing modules if already loaded', async () => {
        // Arrange
        const context = createAuthenticatedContext();
        const sampleModule = new CourseModule({
          id: 'module-123',
          courseId: 'course-123',
          title: 'Test Module',
          orderNumber: 1,
          durationMinutes: 60,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const courseWithModules = { ...sampleCourse, modules: [sampleModule] };

        // Act
        const result = await courseResolvers.Course.modules(courseWithModules, {}, context);

        // Assert
        expect(result).toEqual([sampleModule]);
        expect(mockDataLoaders.modulesByCourseId.load).not.toHaveBeenCalled();
      });

      it('should use DataLoader when modules not loaded', async () => {
        // Arrange
        const context = createAuthenticatedContext();
        const sampleModule = new CourseModule({
          id: 'module-123',
          courseId: 'course-123',
          title: 'Test Module',
          orderNumber: 1,
          durationMinutes: 60,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        mockDataLoaders.modulesByCourseId.load.mockResolvedValue([sampleModule]);

        // Act
        const result = await courseResolvers.Course.modules(sampleCourse, {}, context);

        // Assert
        expect(result).toEqual([sampleModule]);
        expect(mockDataLoaders.modulesByCourseId.load).toHaveBeenCalledWith('course-123');
      });
    });

    describe('CourseModule.course', () => {
      it('should use DataLoader to load course', async () => {
        // Arrange
        const context = createAuthenticatedContext();
        const sampleModule = new CourseModule({
          id: 'module-123',
          courseId: 'course-123',
          title: 'Test Module',
          orderNumber: 1,
          durationMinutes: 60,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        mockDataLoaders.courseById.load.mockResolvedValue(sampleCourse);

        // Act
        const result = await courseResolvers.CourseModule.course(sampleModule, {}, context);

        // Assert
        expect(result).toBe(sampleCourse);
        expect(mockDataLoaders.courseById.load).toHaveBeenCalledWith('course-123');
      });
    });
  });

  describe('Enum Mapping', () => {
    it('should map difficulty enum correctly', () => {
      // Act
      const result = courseResolvers.Course.difficulty(sampleCourse);

      // Assert
      expect(result).toBe('BEGINNER');
    });

    it('should map status enum correctly', () => {
      // Act
      const result = courseResolvers.Course.status(sampleCourse);

      // Assert
      expect(result).toBe('DRAFT');
    });
  });
});