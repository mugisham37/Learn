/**
 * Example Usage of Authentication Middleware
 * 
 * This file demonstrates how to use the requireAuth middleware
 * with Fastify routes. This is for documentation purposes only.
 * 
 * Requirements: 1.6, 21.7
 */

import { FastifyInstance } from 'fastify';

import { requireAuth, AuthenticatedRequest } from './index.js';

/**
 * Example: Register protected routes with authentication
 */
export async function registerExampleRoutes(server: FastifyInstance): Promise<void> {
  // Public route - no authentication required
  server.get('/api/public', async (_request, _reply) => {
    return {
      message: 'This is a public route',
      timestamp: new Date().toISOString(),
    };
  });

  // Protected route - requires authentication
  server.get(
    '/api/protected',
    {
      preHandler: requireAuth,
    },
    async (request, _reply) => {
      // Type assertion to access user context
      const authenticatedRequest = request as AuthenticatedRequest;
      
      return {
        message: 'This is a protected route',
        user: authenticatedRequest.user,
        timestamp: new Date().toISOString(),
      };
    }
  );

  // Protected route - get current user profile
  server.get(
    '/api/me',
    {
      preHandler: requireAuth,
    },
    async (request, _reply) => {
      const { userId, email, role } = (request as AuthenticatedRequest).user;
      
      return {
        userId,
        email,
        role,
        message: 'Current user information',
      };
    }
  );

  // Protected route - role-specific endpoint
  server.get(
    '/api/educator/dashboard',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { role } = (request as AuthenticatedRequest).user;
      
      // Manual role check (authorization middleware would handle this)
      if (role !== 'educator' && role !== 'admin') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'This endpoint is only accessible to educators',
        });
      }
      
      return {
        message: 'Educator dashboard data',
        role,
      };
    }
  );

  // Protected route - POST example
  server.post(
    '/api/courses',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { userId, role } = (request as AuthenticatedRequest).user;
      
      // Check if user is an educator
      if (role !== 'educator' && role !== 'admin') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Only educators can create courses',
        });
      }
      
      // Course creation logic would go here
      const courseData = request.body;
      
      return {
        message: 'Course created successfully',
        instructorId: userId,
        course: courseData,
      };
    }
  );
}

/**
 * Example: Error handling with authentication
 */
export async function registerErrorHandlingExample(server: FastifyInstance): Promise<void> {
  server.get(
    '/api/test-auth-error',
    {
      preHandler: requireAuth,
    },
    async (request, _reply) => {
      // This will only execute if authentication succeeds
      const { userId } = (request as AuthenticatedRequest).user;
      
      return {
        message: 'Authentication successful',
        userId,
      };
    }
  );
}

/**
 * Example: Testing authentication with curl
 * 
 * 1. Get a token (from login endpoint):
 *    curl -X POST http://localhost:3000/api/auth/login \
 *      -H "Content-Type: application/json" \
 *      -d '{"email":"user@example.com","password":"password123"}'
 * 
 * 2. Use the token to access protected route:
 *    curl http://localhost:3000/api/protected \
 *      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
 * 
 * 3. Test without token (should fail):
 *    curl http://localhost:3000/api/protected
 * 
 * 4. Test with invalid token (should fail):
 *    curl http://localhost:3000/api/protected \
 *      -H "Authorization: Bearer invalid.token.here"
 */
