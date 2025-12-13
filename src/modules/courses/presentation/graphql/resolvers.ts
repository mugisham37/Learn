/**
 * GraphQL Resolvers for Courses Module
 *
 * Implements GraphQL resolvers for course management operations
 * with proper error handling, validation, and authorization.
 *
 * Requirements: 21.2, 21.3, 21.6, 21.7
 */

import { GraphQLError } from 'graphql';

import {
  ICourseService,
  PublicationValidationResult,
} from '../../application/services/ICourseService.js';
import { Course } from '../../domain/entities/Course.js';
import { CourseModule } from '../../domain/entities/CourseModule.js';
import { Lesson } from '../../domain/entities/Lesson.js';
import {
  CreateCourseDTO,
  UpdateCourseDTO,
  PaginationParams,
  CourseFilters,
} from '../../infrastructure/repositories/ICourseRepository.js';
import { CourseDataLoaders } from './dataloaders.js';

/**
 * GraphQL context interface
 */
export interface GraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  courseService: ICourseService;
  dataloaders: CourseDataLoaders;
}

/**
 * Input type interfaces matching GraphQL schema
 */
interface CreateCourseInput {
  title: string;
  description: string;
  category: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  price?: string;
  currency?: string;
  enrollmentLimit?: number;
  thumbnailUrl?: string;
}

interface UpdateCourseInput {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  price?: string;
  currency?: string;
  enrollmentLimit?: number;
  thumbnailUrl?: string;
}

interface CreateModuleInput {
  title: string;
  description?: string;
  orderNumber: number;
  prerequisiteModuleId?: string;
}

interface CreateLessonInput {
  title: string;
  description?: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT';
  contentUrl?: string;
  contentText?: string;
  durationMinutes?: number;
  orderNumber: number;
  isPreview?: boolean;
}

interface UpdateModuleInput {
  title?: string;
  description?: string;
  orderNumber?: number;
  prerequisiteModuleId?: string;
}

interface UpdateLessonInput {
  title?: string;
  description?: string;
  contentUrl?: string;
  contentText?: string;
  durationMinutes?: number;
  orderNumber?: number;
  isPreview?: boolean;
}

interface ReorderModulesInput {
  moduleIds: string[];
}

interface ReorderLessonsInput {
  lessonIds: string[];
}

interface CourseFilter {
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  category?: string;
  difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  instructorId?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: number;
}

interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/**
 * Helper function to require authentication
 */
function requireAuth(context: GraphQLContext): { id: string; email: string; role: string } {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }
  return context.user;
}

/**
 * Helper function to require educator role
 */
function requireEducator(context: GraphQLContext): { id: string; email: string; role: string } {
  const user = requireAuth(context);
  if (user.role !== 'educator' && user.role !== 'admin') {
    throw new GraphQLError('Educator role required', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }
  return user;
}

/**
 * Helper function to convert GraphQL enums to domain values
 */
function mapDifficultyFromGraphQL(
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
): 'beginner' | 'intermediate' | 'advanced' {
  switch (difficulty) {
    case 'BEGINNER':
      return 'beginner';
    case 'INTERMEDIATE':
      return 'intermediate';
    case 'ADVANCED':
      return 'advanced';
    default:
      throw new Error(`Unknown difficulty: ${difficulty}`);
  }
}

/**
 * Helper function to convert domain values to GraphQL enums
 */
function mapDifficultyToGraphQL(difficulty: string): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
  switch (difficulty) {
    case 'beginner':
      return 'BEGINNER';
    case 'intermediate':
      return 'INTERMEDIATE';
    case 'advanced':
      return 'ADVANCED';
    default:
      throw new Error(`Unknown difficulty: ${difficulty}`);
  }
}

function mapStatusToGraphQL(status: string): 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED' {
  switch (status) {
    case 'draft':
      return 'DRAFT';
    case 'pending_review':
      return 'PENDING_REVIEW';
    case 'published':
      return 'PUBLISHED';
    case 'archived':
      return 'ARCHIVED';
    default:
      throw new Error(`Unknown status: ${status}`);
  }
}

function mapLessonTypeToGraphQL(type: string): 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT' {
  switch (type) {
    case 'video':
      return 'VIDEO';
    case 'text':
      return 'TEXT';
    case 'quiz':
      return 'QUIZ';
    case 'assignment':
      return 'ASSIGNMENT';
    default:
      throw new Error(`Unknown lesson type: ${type}`);
  }
}

function mapLessonTypeFromGraphQL(
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT'
): 'video' | 'text' | 'quiz' | 'assignment' {
  switch (type) {
    case 'VIDEO':
      return 'video';
    case 'TEXT':
      return 'text';
    case 'QUIZ':
      return 'quiz';
    case 'ASSIGNMENT':
      return 'assignment';
    default:
      throw new Error(`Unknown lesson type: ${type}`);
  }
}

/**
 * Helper function to convert pagination input to domain params
 */
function convertPaginationInput(input?: PaginationInput): PaginationParams {
  // Default pagination
  const defaultPage = 1;
  const defaultLimit = 20;

  if (!input) {
    return { page: defaultPage, limit: defaultLimit };
  }

  // For now, implement simple offset-based pagination
  // In a full implementation, you'd handle cursor-based pagination
  const limit = input.first || input.last || defaultLimit;
  const page = defaultPage; // Simplified - would calculate from cursor in real implementation

  return { page, limit };
}

/**
 * Helper function to convert course filters
 */
function convertCourseFilters(input?: CourseFilter): CourseFilters | undefined {
  if (!input) return undefined;

  return {
    status: input.status ? (input.status.toLowerCase() as any) : undefined,
    category: input.category,
    difficulty: input.difficulty ? mapDifficultyFromGraphQL(input.difficulty) : undefined,
    instructorId: input.instructorId,
  };
}

/**
 * GraphQL resolvers for courses module
 */
export const courseResolvers = {
  Query: {
    /**
     * Get course by ID
     */
    course: async (
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ): Promise<Course | null> => {
      try {
        const course = await context.courseService.getCourseById(args.id);
        return course;
      } catch (error) {
        throw new GraphQLError('Failed to fetch course', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get course by slug
     */
    courseBySlug: async (
      _parent: any,
      args: { slug: string },
      context: GraphQLContext
    ): Promise<Course | null> => {
      try {
        const course = await context.courseService.getCourseBySlug(args.slug);
        return course;
      } catch (error) {
        throw new GraphQLError('Failed to fetch course', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get courses with pagination and filtering
     */
    courses: async (
      _parent: any,
      args: { filter?: CourseFilter; pagination?: PaginationInput },
      context: GraphQLContext
    ) => {
      try {
        const pagination = convertPaginationInput(args.pagination);
        const filters = convertCourseFilters(args.filter);

        const result = await context.courseService.getPublishedCourses(pagination, filters);

        // Convert to GraphQL connection format
        return {
          edges: result.data.map((course, index) => ({
            node: course,
            cursor: Buffer.from(`${result.page}:${index}`).toString('base64'),
          })),
          pageInfo: {
            hasNextPage: result.page < result.totalPages,
            hasPreviousPage: result.page > 1,
            startCursor:
              result.data.length > 0 ? Buffer.from(`${result.page}:0`).toString('base64') : null,
            endCursor:
              result.data.length > 0
                ? Buffer.from(`${result.page}:${result.data.length - 1}`).toString('base64')
                : null,
          },
          totalCount: result.total,
        };
      } catch (error) {
        throw new GraphQLError('Failed to fetch courses', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get current user's courses
     */
    myCourses: async (
      _parent: any,
      args: { filter?: CourseFilter; pagination?: PaginationInput },
      context: GraphQLContext
    ) => {
      const user = requireEducator(context);

      try {
        const pagination = convertPaginationInput(args.pagination);
        const filters = convertCourseFilters(args.filter);

        const result = await context.courseService.getCoursesByInstructor(
          user.id,
          pagination,
          filters
        );

        // Convert to GraphQL connection format
        return {
          edges: result.data.map((course, index) => ({
            node: course,
            cursor: Buffer.from(`${result.page}:${index}`).toString('base64'),
          })),
          pageInfo: {
            hasNextPage: result.page < result.totalPages,
            hasPreviousPage: result.page > 1,
            startCursor:
              result.data.length > 0 ? Buffer.from(`${result.page}:0`).toString('base64') : null,
            endCursor:
              result.data.length > 0
                ? Buffer.from(`${result.page}:${result.data.length - 1}`).toString('base64')
                : null,
          },
          totalCount: result.total,
        };
      } catch (error) {
        throw new GraphQLError('Failed to fetch your courses', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Validate course publication requirements
     */
    validateCoursePublication: async (
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ): Promise<PublicationValidationResult> => {
      const user = requireEducator(context);

      try {
        const result = await context.courseService.validatePublishRequirements(args.id, user.id);
        return result;
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          throw new GraphQLError('Course not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        throw new GraphQLError('Failed to validate course publication', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },
  },

  Mutation: {
    /**
     * Create a new course
     */
    createCourse: async (
      _parent: any,
      args: { input: CreateCourseInput },
      context: GraphQLContext
    ): Promise<Course> => {
      const user = requireEducator(context);

      try {
        // Validate input
        if (!args.input.title || args.input.title.trim().length === 0) {
          throw new GraphQLError('Course title is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'title',
            },
          });
        }

        if (!args.input.description || args.input.description.trim().length === 0) {
          throw new GraphQLError('Course description is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'description',
            },
          });
        }

        if (!args.input.category || args.input.category.trim().length === 0) {
          throw new GraphQLError('Course category is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'category',
            },
          });
        }

        const createData: CreateCourseDTO = {
          instructorId: user.id,
          title: args.input.title.trim(),
          description: args.input.description.trim(),
          category: args.input.category.trim(),
          difficulty: mapDifficultyFromGraphQL(args.input.difficulty),
          price: args.input.price || '0',
          currency: args.input.currency || 'USD',
          enrollmentLimit: args.input.enrollmentLimit,
          thumbnailUrl: args.input.thumbnailUrl,
        };

        const course = await context.courseService.createCourse(user.id, createData);
        return course;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new GraphQLError('Invalid course data', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to create course', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Update course
     */
    updateCourse: async (
      _parent: any,
      args: { id: string; input: UpdateCourseInput },
      context: GraphQLContext
    ): Promise<Course> => {
      const user = requireEducator(context);

      try {
        const updateData: UpdateCourseDTO = {
          title: args.input.title?.trim(),
          description: args.input.description?.trim(),
          category: args.input.category?.trim(),
          difficulty: args.input.difficulty
            ? mapDifficultyFromGraphQL(args.input.difficulty)
            : undefined,
          price: args.input.price,
          currency: args.input.currency,
          enrollmentLimit: args.input.enrollmentLimit,
          thumbnailUrl: args.input.thumbnailUrl,
        };

        const course = await context.courseService.updateCourse(args.id, user.id, updateData);
        return course;
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          throw new GraphQLError('Course not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to update this course', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
          throw new GraphQLError('Invalid course data', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to update course', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Publish course
     */
    publishCourse: async (
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ): Promise<Course> => {
      const user = requireEducator(context);

      try {
        const course = await context.courseService.publishCourse(args.id, user.id);
        return course;
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          throw new GraphQLError('Course not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to publish this course', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (error.message?.includes('validation') || error.message?.includes('requirements')) {
          throw new GraphQLError('Course does not meet publication requirements', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to publish course', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Delete course
     */
    deleteCourse: async (
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      const user = requireEducator(context);

      try {
        await context.courseService.deleteCourse(args.id, user.id);
        return true;
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          throw new GraphQLError('Course not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to delete this course', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        throw new GraphQLError('Failed to delete course', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Add module to course
     */
    addModule: async (
      _parent: any,
      args: { courseId: string; input: CreateModuleInput },
      context: GraphQLContext
    ): Promise<CourseModule> => {
      const user = requireEducator(context);

      try {
        // Validate input
        if (!args.input.title || args.input.title.trim().length === 0) {
          throw new GraphQLError('Module title is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'title',
            },
          });
        }

        if (args.input.orderNumber <= 0) {
          throw new GraphQLError('Order number must be positive', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'orderNumber',
            },
          });
        }

        const moduleData = {
          title: args.input.title.trim(),
          description: args.input.description?.trim(),
          orderNumber: args.input.orderNumber,
          prerequisiteModuleId: args.input.prerequisiteModuleId,
        };

        const module = await context.courseService.addModule(args.courseId, user.id, moduleData);
        return module;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('Course not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to add module to this course', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (error.message?.includes('order number') || error.message?.includes('conflict')) {
          throw new GraphQLError('Module order number already exists', {
            extensions: {
              code: 'CONFLICT',
              http: { status: 409 },
            },
          });
        }

        throw new GraphQLError('Failed to add module', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Add lesson to module
     */
    addLesson: async (
      _parent: any,
      args: { moduleId: string; input: CreateLessonInput },
      context: GraphQLContext
    ): Promise<Lesson> => {
      const user = requireEducator(context);

      try {
        // Validate input
        if (!args.input.title || args.input.title.trim().length === 0) {
          throw new GraphQLError('Lesson title is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'title',
            },
          });
        }

        if (args.input.orderNumber <= 0) {
          throw new GraphQLError('Order number must be positive', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'orderNumber',
            },
          });
        }

        const lessonData = {
          title: args.input.title.trim(),
          description: args.input.description?.trim(),
          lessonType: mapLessonTypeFromGraphQL(args.input.type),
          contentUrl: args.input.contentUrl,
          contentText: args.input.contentText,
          durationMinutes: args.input.durationMinutes,
          orderNumber: args.input.orderNumber,
          isPreview: args.input.isPreview || false,
        };

        const lesson = await context.courseService.addLesson(args.moduleId, user.id, lessonData);
        return lesson;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('Module not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to add lesson to this module', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (error.message?.includes('order number') || error.message?.includes('conflict')) {
          throw new GraphQLError('Lesson order number already exists in module', {
            extensions: {
              code: 'CONFLICT',
              http: { status: 409 },
            },
          });
        }

        if (error.message?.includes('validation') || error.message?.includes('type')) {
          throw new GraphQLError('Invalid lesson data or type validation failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to add lesson', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Reorder modules
     */
    reorderModules: async (
      _parent: any,
      args: { courseId: string; input: ReorderModulesInput },
      context: GraphQLContext
    ): Promise<CourseModule[]> => {
      const user = requireEducator(context);

      try {
        if (!args.input.moduleIds || args.input.moduleIds.length === 0) {
          throw new GraphQLError('Module IDs are required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        const modules = await context.courseService.reorderModules(
          args.courseId,
          user.id,
          args.input.moduleIds
        );
        return modules;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('Course or modules not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to reorder modules in this course', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (
          error.message?.includes('validation') ||
          error.message?.includes('count') ||
          error.message?.includes('belong')
        ) {
          throw new GraphQLError('Invalid module IDs or count mismatch', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to reorder modules', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Update module
     */
    updateModule: async (
      _parent: any,
      args: { id: string; input: UpdateModuleInput },
      context: GraphQLContext
    ): Promise<CourseModule> => {
      const user = requireEducator(context);

      try {
        // Validate input
        if (
          args.input.title !== undefined &&
          (!args.input.title || args.input.title.trim().length === 0)
        ) {
          throw new GraphQLError('Module title cannot be empty', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'title',
            },
          });
        }

        if (args.input.orderNumber !== undefined && args.input.orderNumber <= 0) {
          throw new GraphQLError('Order number must be positive', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'orderNumber',
            },
          });
        }

        const updateData = {
          title: args.input.title?.trim(),
          description: args.input.description?.trim(),
          orderNumber: args.input.orderNumber,
          prerequisiteModuleId: args.input.prerequisiteModuleId,
        };

        const module = await context.courseService.updateModule(args.id, user.id, updateData);
        return module;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('Module not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to update this module', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (error.message?.includes('order number') || error.message?.includes('conflict')) {
          throw new GraphQLError('Module order number already exists', {
            extensions: {
              code: 'CONFLICT',
              http: { status: 409 },
            },
          });
        }

        throw new GraphQLError('Failed to update module', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Delete module
     */
    deleteModule: async (
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      const user = requireEducator(context);

      try {
        await context.courseService.deleteModule(args.id, user.id);
        return true;
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          throw new GraphQLError('Module not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to delete this module', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        throw new GraphQLError('Failed to delete module', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Update lesson
     */
    updateLesson: async (
      _parent: any,
      args: { id: string; input: UpdateLessonInput },
      context: GraphQLContext
    ): Promise<Lesson> => {
      const user = requireEducator(context);

      try {
        // Validate input
        if (
          args.input.title !== undefined &&
          (!args.input.title || args.input.title.trim().length === 0)
        ) {
          throw new GraphQLError('Lesson title cannot be empty', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'title',
            },
          });
        }

        if (args.input.orderNumber !== undefined && args.input.orderNumber <= 0) {
          throw new GraphQLError('Order number must be positive', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
              field: 'orderNumber',
            },
          });
        }

        const updateData = {
          title: args.input.title?.trim(),
          description: args.input.description?.trim(),
          contentUrl: args.input.contentUrl,
          contentText: args.input.contentText,
          durationMinutes: args.input.durationMinutes,
          orderNumber: args.input.orderNumber,
          isPreview: args.input.isPreview,
        };

        const lesson = await context.courseService.updateLesson(args.id, user.id, updateData);
        return lesson;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('Lesson not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to update this lesson', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (error.message?.includes('order number') || error.message?.includes('conflict')) {
          throw new GraphQLError('Lesson order number already exists in module', {
            extensions: {
              code: 'CONFLICT',
              http: { status: 409 },
            },
          });
        }

        throw new GraphQLError('Failed to update lesson', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Delete lesson
     */
    deleteLesson: async (
      _parent: any,
      args: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      const user = requireEducator(context);

      try {
        await context.courseService.deleteLesson(args.id, user.id);
        return true;
      } catch (error: any) {
        if (error.message?.includes('not found')) {
          throw new GraphQLError('Lesson not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to delete this lesson', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        throw new GraphQLError('Failed to delete lesson', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Reorder lessons
     */
    reorderLessons: async (
      _parent: any,
      args: { moduleId: string; input: ReorderLessonsInput },
      context: GraphQLContext
    ): Promise<Lesson[]> => {
      const user = requireEducator(context);

      try {
        if (!args.input.lessonIds || args.input.lessonIds.length === 0) {
          throw new GraphQLError('Lesson IDs are required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        const lessons = await context.courseService.reorderLessons(
          args.moduleId,
          user.id,
          args.input.lessonIds
        );
        return lessons;
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (error.message?.includes('not found')) {
          throw new GraphQLError('Module or lessons not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (error.message?.includes('permission') || error.message?.includes('authorization')) {
          throw new GraphQLError('Insufficient permissions to reorder lessons in this module', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if (
          error.message?.includes('validation') ||
          error.message?.includes('count') ||
          error.message?.includes('belong')
        ) {
          throw new GraphQLError('Invalid lesson IDs or count mismatch', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to reorder lessons', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },
  },

  // Field resolvers
  Course: {
    difficulty: (course: Course): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' =>
      mapDifficultyToGraphQL(course.difficulty),
    status: (course: Course): 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED' =>
      mapStatusToGraphQL(course.status),

    instructor: async (
      course: Course,
      _args: unknown,
      _context: GraphQLContext
    ): Promise<{ id: string }> => {
      // Return a placeholder that matches the User type
      // In a full implementation, this would use a UserDataLoader
      return {
        id: course.instructorId,
        // Other user fields would be loaded via UserDataLoader
      };
    },

    modules: async (
      course: Course,
      _args: unknown,
      context: GraphQLContext
    ): Promise<CourseModule[]> => {
      // Use DataLoader to efficiently load modules
      if (course.modules && course.modules.length > 0) {
        // If modules are already loaded, return them
        return course.modules;
      }

      // Load modules using DataLoader to prevent N+1 queries
      return await context.dataloaders.modulesByCourseId.load(course.id);
    },
  },

  CourseModule: {
    course: async (
      module: CourseModule,
      _args: unknown,
      context: GraphQLContext
    ): Promise<Course | null> => {
      // Use DataLoader to efficiently load the course
      return await context.dataloaders.courseById.load(module.courseId);
    },

    prerequisiteModule: async (
      module: CourseModule,
      _args: unknown,
      context: GraphQLContext
    ): Promise<CourseModule | null> => {
      if (!module.prerequisiteModuleId) return null;

      // Use DataLoader to efficiently load the prerequisite module
      return await context.dataloaders.moduleById.load(module.prerequisiteModuleId);
    },

    lessons: async (
      module: CourseModule,
      _args: unknown,
      context: GraphQLContext
    ): Promise<Lesson[]> => {
      // Use DataLoader to efficiently load lessons
      if (module.lessons && module.lessons.length > 0) {
        // If lessons are already loaded, return them
        return module.lessons;
      }

      // Load lessons using DataLoader to prevent N+1 queries
      return await context.dataloaders.lessonsByModuleId.load(module.id);
    },
  },

  Lesson: {
    type: (lesson: Lesson): 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT' =>
      mapLessonTypeToGraphQL(lesson.type),

    module: async (
      lesson: Lesson,
      _args: unknown,
      context: GraphQLContext
    ): Promise<CourseModule | null> => {
      // Use DataLoader to efficiently load the module
      return await context.dataloaders.moduleById.load(lesson.moduleId);
    },
  },
};
