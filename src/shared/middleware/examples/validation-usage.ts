/**
 * Validation Middleware Usage Examples
 * 
 * This file demonstrates how to use the input validation middleware
 * with Fastify endpoints for different types of validation scenarios.
 * 
 * Requirements: 13.1
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { createValidationMiddleware } from '../validation.js';
import {
  registerUserSchema,
  loginUserSchema,
  updateProfileSchema,
  createCourseSchema,
  paginationSchema,
  courseSearchSchema,
  idParamSchema,
} from '../../schemas/index.js';

/**
 * Example: User registration endpoint with body validation
 */
export function registerUserRegistrationRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    body: registerUserSchema,
  });

  fastify.post('/auth/register', {
    preHandler: [validation],
    schema: {
      description: 'Register a new user account',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email', 'password', 'fullName', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string', minLength: 1 },
          role: { type: 'string', enum: ['student', 'educator'] },
          timezone: { type: 'string', default: 'UTC' },
          language: { type: 'string', default: 'en' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            user: { type: 'object' },
            accessToken: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            statusCode: { type: 'number' },
            error: { type: 'string' },
            message: { type: 'string' },
            validationErrors: { type: 'array' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // At this point, request.body is validated and typed
    const userData = request.body as z.infer<typeof registerUserSchema>;
    
    // Business logic here
    // The validation middleware ensures userData is properly typed and validated
    
    return reply.code(201).send({
      user: {
        id: 'user-123',
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
      },
      accessToken: 'jwt-token-here',
    });
  });
}

/**
 * Example: User login endpoint with body validation
 */
export function registerUserLoginRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    body: loginUserSchema,
  });

  fastify.post('/auth/login', {
    preHandler: [validation],
    schema: {
      description: 'Authenticate user and return access token',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const credentials = request.body as z.infer<typeof loginUserSchema>;
    
    // Authentication logic here
    
    return reply.send({
      accessToken: 'jwt-token-here',
      user: { id: 'user-123', email: credentials.email },
    });
  });
}

/**
 * Example: Get user profile with path parameter validation
 */
export function registerGetUserRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    params: idParamSchema,
  });

  fastify.get('/users/:id', {
    preHandler: [validation],
    schema: {
      description: 'Get user profile by ID',
      tags: ['Users'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof idParamSchema>;
    
    // Fetch user logic here
    
    return reply.send({
      id,
      email: 'user@example.com',
      fullName: 'John Doe',
    });
  });
}

/**
 * Example: Update user profile with body validation and path parameters
 */
export function registerUpdateUserRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    params: idParamSchema,
    body: updateProfileSchema,
  });

  fastify.put('/users/:id', {
    preHandler: [validation],
    schema: {
      description: 'Update user profile',
      tags: ['Users'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          fullName: { type: 'string', minLength: 1 },
          bio: { type: 'string', maxLength: 1000 },
          timezone: { type: 'string' },
          language: { type: 'string', minLength: 2, maxLength: 2 },
          phone: { type: 'string' },
          socialMedia: { type: 'object' },
          notificationPreferences: { type: 'object' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof idParamSchema>;
    const updateData = request.body as z.infer<typeof updateProfileSchema>;
    
    // Update user logic here
    
    return reply.send({
      id,
      ...updateData,
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Example: Search courses with query parameter validation
 */
export function registerSearchCoursesRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    querystring: courseSearchSchema.merge(paginationSchema),
  });

  fastify.get('/courses/search', {
    preHandler: [validation],
    schema: {
      description: 'Search courses with filters and pagination',
      tags: ['Courses'],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1 },
          category: { type: 'string' },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          minRating: { type: 'number', minimum: 0, maximum: 5 },
          maxPrice: { type: 'number', minimum: 0 },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          sort: { type: 'string' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const searchParams = request.query as z.infer<typeof courseSearchSchema> & z.infer<typeof paginationSchema>;
    
    // Search logic here
    
    return reply.send({
      courses: [],
      pagination: {
        page: searchParams.page,
        limit: searchParams.limit,
        total: 0,
        totalPages: 0,
      },
      filters: {
        category: searchParams.category,
        difficulty: searchParams.difficulty,
        minRating: searchParams.minRating,
        maxPrice: searchParams.maxPrice,
      },
    });
  });
}

/**
 * Example: Create course with comprehensive validation
 */
export function registerCreateCourseRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    body: createCourseSchema,
    headers: z.object({
      'content-type': z.string().includes('application/json'),
      authorization: z.string().startsWith('Bearer '),
    }),
  });

  fastify.post('/courses', {
    preHandler: [validation],
    schema: {
      description: 'Create a new course',
      tags: ['Courses'],
      headers: {
        type: 'object',
        required: ['authorization'],
        properties: {
          'content-type': { type: 'string' },
          authorization: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['title', 'description', 'category', 'difficulty'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string', minLength: 1, maxLength: 5000 },
          category: { type: 'string', minLength: 1, maxLength: 100 },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          price: { type: 'object' },
          tags: { type: 'array', items: { type: 'string' } },
          isPublic: { type: 'boolean', default: true },
          enrollmentLimit: { type: 'number', minimum: 1 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const courseData = request.body as z.infer<typeof createCourseSchema>;
    const validatedHeaders = (request as any).validatedHeaders;
    
    // Extract user from JWT token in authorization header
    // Create course logic here
    
    return reply.code(201).send({
      id: 'course-123',
      ...courseData,
      slug: courseData.title.toLowerCase().replace(/\s+/g, '-'),
      createdAt: new Date().toISOString(),
    });
  });
}

/**
 * Example: Bulk operations with array validation
 */
export function registerBulkDeleteCoursesRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    body: z.object({
      courseIds: z.array(z.string().uuid()).min(1, 'At least one course ID is required').max(50, 'Too many courses'),
      reason: z.string().max(500, 'Reason too long').optional(),
    }),
  });

  fastify.delete('/courses/bulk', {
    preHandler: [validation],
    schema: {
      description: 'Delete multiple courses',
      tags: ['Courses'],
      body: {
        type: 'object',
        required: ['courseIds'],
        properties: {
          courseIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
            maxItems: 50,
          },
          reason: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { courseIds, reason } = request.body as {
      courseIds: string[];
      reason?: string;
    };
    
    // Bulk delete logic here
    
    return reply.send({
      deletedCount: courseIds.length,
      deletedIds: courseIds,
      reason,
    });
  });
}

/**
 * Example: File upload with custom validation
 */
export function registerFileUploadRoute(fastify: FastifyInstance) {
  const validation = createValidationMiddleware({
    querystring: z.object({
      uploadType: z.enum(['avatar', 'course_resource', 'assignment_submission']),
      maxSize: z.string().transform(Number).pipe(z.number().int().positive().max(100 * 1024 * 1024)), // 100MB max
    }),
    headers: z.object({
      'content-type': z.string().startsWith('multipart/form-data'),
    }),
  });

  fastify.post('/upload', {
    preHandler: [validation],
    schema: {
      description: 'Upload a file',
      tags: ['Files'],
      querystring: {
        type: 'object',
        required: ['uploadType'],
        properties: {
          uploadType: { type: 'string', enum: ['avatar', 'course_resource', 'assignment_submission'] },
          maxSize: { type: 'number', maximum: 104857600 }, // 100MB
        },
      },
      headers: {
        type: 'object',
        properties: {
          'content-type': { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { uploadType, maxSize } = request.query as {
      uploadType: 'avatar' | 'course_resource' | 'assignment_submission';
      maxSize: number;
    };
    
    // File upload logic here
    
    return reply.send({
      uploadUrl: 'https://s3.amazonaws.com/bucket/file-key',
      uploadType,
      maxSize,
      expiresIn: 3600, // 1 hour
    });
  });
}

/**
 * Example: Complex nested validation
 */
export function registerComplexValidationRoute(fastify: FastifyInstance) {
  const complexSchema = z.object({
    course: z.object({
      title: z.string().min(1).max(255),
      modules: z.array(
        z.object({
          title: z.string().min(1).max(255),
          lessons: z.array(
            z.object({
              title: z.string().min(1).max(255),
              type: z.enum(['video', 'text', 'quiz', 'assignment']),
              duration: z.number().int().min(0).optional(),
              content: z.union([
                z.object({
                  type: z.literal('video'),
                  url: z.string().url(),
                  thumbnail: z.string().url().optional(),
                }),
                z.object({
                  type: z.literal('text'),
                  html: z.string().min(1),
                }),
                z.object({
                  type: z.literal('quiz'),
                  questions: z.array(z.object({
                    text: z.string().min(1),
                    type: z.enum(['multiple_choice', 'true_false', 'short_answer']),
                    options: z.array(z.string()).optional(),
                    correctAnswer: z.string(),
                  })).min(1),
                }),
              ]).optional(),
            })
          ).min(1),
        })
      ).min(1),
      settings: z.object({
        isPublic: z.boolean().default(true),
        allowComments: z.boolean().default(true),
        certificateEnabled: z.boolean().default(false),
        passingGrade: z.number().min(0).max(100).default(70),
      }),
    }),
  });

  const validation = createValidationMiddleware({
    body: complexSchema,
  });

  fastify.post('/courses/complex', {
    preHandler: [validation],
    schema: {
      description: 'Create course with complex nested structure',
      tags: ['Courses'],
      body: {
        type: 'object',
        required: ['course'],
        properties: {
          course: {
            type: 'object',
            required: ['title', 'modules', 'settings'],
            properties: {
              title: { type: 'string', minLength: 1, maxLength: 255 },
              modules: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['title', 'lessons'],
                  properties: {
                    title: { type: 'string', minLength: 1, maxLength: 255 },
                    lessons: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        required: ['title', 'type'],
                        properties: {
                          title: { type: 'string', minLength: 1, maxLength: 255 },
                          type: { type: 'string', enum: ['video', 'text', 'quiz', 'assignment'] },
                          duration: { type: 'number', minimum: 0 },
                          content: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
              settings: {
                type: 'object',
                properties: {
                  isPublic: { type: 'boolean', default: true },
                  allowComments: { type: 'boolean', default: true },
                  certificateEnabled: { type: 'boolean', default: false },
                  passingGrade: { type: 'number', minimum: 0, maximum: 100, default: 70 },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { course } = request.body as z.infer<typeof complexSchema>;
    
    // Complex course creation logic here
    
    return reply.code(201).send({
      id: 'course-123',
      ...course,
      createdAt: new Date().toISOString(),
    });
  });
}

/**
 * Register all example routes with a Fastify instance
 */
export function registerAllExampleRoutes(fastify: FastifyInstance) {
  registerUserRegistrationRoute(fastify);
  registerUserLoginRoute(fastify);
  registerGetUserRoute(fastify);
  registerUpdateUserRoute(fastify);
  registerSearchCoursesRoute(fastify);
  registerCreateCourseRoute(fastify);
  registerBulkDeleteCoursesRoute(fastify);
  registerFileUploadRoute(fastify);
  registerComplexValidationRoute(fastify);
}