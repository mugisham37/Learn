/**
 * Rate Limiting Examples
 * 
 * Demonstrates how to apply different rate limiting configurations
 * to various types of endpoints based on their requirements.
 * 
 * Requirements: 13.5, 13.6
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { requireAuth, requireRole } from '../index.js';
import { EndpointRateLimits } from '../rateLimiting.js';

/**
 * Example of applying rate limiting to different endpoint types
 * This demonstrates the patterns that should be used throughout the application
 */
export function registerRateLimitedRoutes(fastify: FastifyInstance): void {
  
  // Example 1: Authentication endpoints with stricter limits
  // These endpoints are vulnerable to brute force attacks
  fastify.post('/auth/login', {
    ...EndpointRateLimits.auth.config,
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Authentication logic would go here
    return { message: 'Login endpoint with rate limiting' };
  });

  fastify.post('/auth/register', {
    ...EndpointRateLimits.auth.config,
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          fullName: { type: 'string', minLength: 2 },
          role: { type: 'string', enum: ['student', 'educator'] },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Registration logic would go here
    return { message: 'Registration endpoint with rate limiting' };
  });

  fastify.post('/auth/forgot-password', {
    ...EndpointRateLimits.auth.config,
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Password reset logic would go here
    return { message: 'Password reset endpoint with rate limiting' };
  });

  // Example 2: File upload endpoints with moderate limits
  // These endpoints consume more resources and should have lower limits
  fastify.post('/upload/avatar', {
    ...EndpointRateLimits.fileUpload.config,
    preHandler: [requireAuth],
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Avatar upload logic would go here
    return { message: 'Avatar upload endpoint with rate limiting' };
  });

  fastify.post('/courses/:courseId/resources', {
    ...EndpointRateLimits.fileUpload.config,
    preHandler: [requireAuth, requireRole(['educator'])],
    schema: {
      params: {
        type: 'object',
        required: ['courseId'],
        properties: {
          courseId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Course resource upload logic would go here
    return { message: 'Course resource upload endpoint with rate limiting' };
  });

  fastify.post('/assignments/:assignmentId/submissions', {
    ...EndpointRateLimits.fileUpload.config,
    preHandler: [requireAuth, requireRole(['student'])],
    schema: {
      params: {
        type: 'object',
        required: ['assignmentId'],
        properties: {
          assignmentId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Assignment submission logic would go here
    return { message: 'Assignment submission endpoint with rate limiting' };
  });

  // Example 3: Search endpoints with moderate limits
  // Search can be expensive, especially with complex queries
  fastify.get('/search/courses', {
    ...EndpointRateLimits.search.config,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 1, maxLength: 100 },
          category: { type: 'string' },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Course search logic would go here
    return { message: 'Course search endpoint with rate limiting' };
  });

  fastify.get('/search/lessons', {
    ...EndpointRateLimits.search.config,
    preHandler: [requireAuth],
    schema: {
      querystring: {
        type: 'object',
        required: ['courseId'],
        properties: {
          courseId: { type: 'string', format: 'uuid' },
          q: { type: 'string', minLength: 1, maxLength: 100 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Lesson search logic would go here
    return { message: 'Lesson search endpoint with rate limiting' };
  });

  // Example 4: Analytics endpoints with stricter limits
  // Analytics queries can be very expensive
  fastify.get('/analytics/courses/:courseId', {
    ...EndpointRateLimits.analytics.config,
    preHandler: [requireAuth, requireRole(['educator', 'admin'])],
    schema: {
      params: {
        type: 'object',
        required: ['courseId'],
        properties: {
          courseId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          granularity: { type: 'string', enum: ['day', 'week', 'month'], default: 'day' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Course analytics logic would go here
    return { message: 'Course analytics endpoint with rate limiting' };
  });

  fastify.get('/analytics/students/:studentId', {
    ...EndpointRateLimits.analytics.config,
    preHandler: [requireAuth, requireRole(['educator', 'admin'])],
    schema: {
      params: {
        type: 'object',
        required: ['studentId'],
        properties: {
          studentId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Student analytics logic would go here
    return { message: 'Student analytics endpoint with rate limiting' };
  });

  // Example 5: Expensive operations with very strict limits
  // These operations consume significant resources
  fastify.post('/courses/:courseId/reindex', {
    ...EndpointRateLimits.expensive.config,
    preHandler: [requireAuth, requireRole(['educator', 'admin'])],
    schema: {
      params: {
        type: 'object',
        required: ['courseId'],
        properties: {
          courseId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Course reindexing logic would go here
    return { message: 'Course reindex endpoint with strict rate limiting' };
  });

  fastify.post('/analytics/generate-report', {
    ...EndpointRateLimits.expensive.config,
    preHandler: [requireAuth, requireRole(['admin'])],
    schema: {
      body: {
        type: 'object',
        required: ['reportType', 'dateRange'],
        properties: {
          reportType: { type: 'string', enum: ['course-performance', 'student-engagement', 'revenue'] },
          dateRange: {
            type: 'object',
            required: ['startDate', 'endDate'],
            properties: {
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' },
            },
          },
          filters: {
            type: 'object',
            properties: {
              courseIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
              instructorIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
            },
          },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Report generation logic would go here
    return { message: 'Report generation endpoint with strict rate limiting' };
  });

  // Example 6: Video processing endpoints with strict limits
  fastify.post('/videos/process', {
    ...EndpointRateLimits.expensive.config,
    preHandler: [requireAuth, requireRole(['educator'])],
    schema: {
      body: {
        type: 'object',
        required: ['videoUrl', 'lessonId'],
        properties: {
          videoUrl: { type: 'string', format: 'uri' },
          lessonId: { type: 'string', format: 'uuid' },
          quality: { type: 'string', enum: ['720p', '1080p', '4k'], default: '1080p' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Video processing logic would go here
    return { message: 'Video processing endpoint with strict rate limiting' };
  });

  // Example 7: Bulk operations with strict limits
  fastify.post('/enrollments/bulk', {
    ...EndpointRateLimits.expensive.config,
    preHandler: [requireAuth, requireRole(['admin'])],
    schema: {
      body: {
        type: 'object',
        required: ['courseId', 'studentIds'],
        properties: {
          courseId: { type: 'string', format: 'uuid' },
          studentIds: { 
            type: 'array', 
            items: { type: 'string', format: 'uuid' },
            minItems: 1,
            maxItems: 100, // Limit bulk operations
          },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Bulk enrollment logic would go here
    return { message: 'Bulk enrollment endpoint with strict rate limiting' };
  });

  // Example 8: Regular CRUD operations use global rate limiting
  // These don't need special rate limiting as they're covered by global limits
  fastify.get('/courses', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Uses global rate limiting (no specific config needed)
    return { message: 'Course list endpoint with global rate limiting' };
  });

  fastify.get('/courses/:id', {
    preHandler: [requireAuth],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Uses global rate limiting (no specific config needed)
    return { message: 'Course details endpoint with global rate limiting' };
  });

  fastify.post('/courses', {
    preHandler: [requireAuth, requireRole(['educator'])],
    schema: {
      body: {
        type: 'object',
        required: ['title', 'description', 'category'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 100 },
          description: { type: 'string', minLength: 10, maxLength: 1000 },
          category: { type: 'string', minLength: 2, maxLength: 50 },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          price: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Uses global rate limiting (no specific config needed)
    return { message: 'Course creation endpoint with global rate limiting' };
  });
}

/**
 * Fastify plugin for rate limiting examples
 * This would not be used in production - it's just for demonstration
 */
export default async function rateLimitingExamplesPlugin(fastify: FastifyInstance): Promise<void> {
  registerRateLimitedRoutes(fastify);
}