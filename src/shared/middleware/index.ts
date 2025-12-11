/**
 * Shared Middleware
 * 
 * Common middleware functions used across the application
 * 
 * Requirements: 1.6, 21.7
 */

import { FastifyReply, FastifyRequest } from 'fastify';

import { AuthenticationError, AuthorizationError, ValidationError } from '../errors/index.js';
import { Role } from '../types/index.js';
import { JWTPayload, verifyToken } from '../utils/auth.js';

/**
 * Extended request interface with authenticated user context
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticatedRequest(
  request: FastifyRequest
): request is AuthenticatedRequest {
  return 'user' in request && request.user !== undefined;
}

/**
 * Authentication middleware that extracts and validates JWT tokens
 * 
 * Extracts JWT from Authorization header (Bearer token format),
 * validates the token signature and expiration, and attaches
 * user context to the request object for downstream handlers.
 * 
 * @param request - Fastify request object
 * @param _reply - Fastify reply object (unused but required by Fastify preHandler signature)
 * @throws AuthenticationError if token is missing, invalid, or expired
 * 
 * Requirements: 1.6, 21.7
 */
export function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): void {
  const requestId = request.id;

  try {
    // Extract Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      request.log.warn(
        { requestId },
        'Authentication failed: Missing Authorization header'
      );
      throw new AuthenticationError('Missing Authorization header');
    }

    // Validate Bearer token format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      request.log.warn(
        { requestId, authHeader: authHeader.substring(0, 20) },
        'Authentication failed: Invalid Authorization header format'
      );
      throw new AuthenticationError('Invalid Authorization header format. Expected: Bearer <token>');
    }

    const token = parts[1];

    if (!token) {
      request.log.warn(
        { requestId },
        'Authentication failed: Empty token'
      );
      throw new AuthenticationError('Empty token provided');
    }

    // Verify and decode token
    let verifiedToken: { payload: JWTPayload; expired: boolean };
    try {
      verifiedToken = verifyToken(token);
    } catch (error) {
      request.log.warn(
        { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
        'Authentication failed: Invalid token signature'
      );
      throw new AuthenticationError('Invalid token signature');
    }

    // Check if token is expired
    if (verifiedToken.expired) {
      request.log.warn(
        { requestId, userId: verifiedToken.payload.userId },
        'Authentication failed: Token expired'
      );
      throw new AuthenticationError('Token has expired');
    }

    // Validate token type (must be access token)
    if (verifiedToken.payload.type !== 'access') {
      request.log.warn(
        { requestId, tokenType: verifiedToken.payload.type },
        'Authentication failed: Invalid token type'
      );
      throw new AuthenticationError('Invalid token type. Expected access token');
    }

    // Attach user context to request
    (request as AuthenticatedRequest).user = {
      userId: verifiedToken.payload.userId,
      email: verifiedToken.payload.email,
      role: verifiedToken.payload.role,
    };

    request.log.info(
      {
        requestId,
        userId: verifiedToken.payload.userId,
        email: verifiedToken.payload.email,
        role: verifiedToken.payload.role,
      },
      'Authentication successful'
    );
  } catch (error) {
    // If it's already an AuthenticationError, rethrow it
    if (error instanceof AuthenticationError) {
      throw error;
    }

    // Log unexpected errors
    request.log.error(
      {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Unexpected error during authentication'
    );

    // Throw generic authentication error for unexpected errors
    throw new AuthenticationError('Authentication failed');
  }
}

/**
 * Authorization middleware factory that checks if user has required role
 * 
 * Creates a middleware function that verifies the authenticated user
 * has one of the allowed roles. Must be used after requireAuth middleware.
 * 
 * @param allowedRoles - Array of roles that are permitted to access the endpoint
 * @returns Fastify preHandler middleware function
 * @throws AuthorizationError if user doesn't have required role
 * 
 * Requirements: 2.2, 2.3
 * 
 * @example
 * // Only educators can access this endpoint
 * fastify.get('/courses', { preHandler: [requireAuth, requireRole(['educator'])] }, handler);
 * 
 * @example
 * // Both educators and admins can access
 * fastify.post('/courses', { preHandler: [requireAuth, requireRole(['educator', 'admin'])] }, handler);
 */
export function requireRole(allowedRoles: Role[]) {
  return function (request: FastifyRequest, _reply: FastifyReply): void {
    const requestId = request.id;

    // Ensure request is authenticated
    if (!isAuthenticatedRequest(request)) {
      request.log.error(
        { requestId },
        'Authorization check failed: Request not authenticated'
      );
      throw new AuthenticationError('Authentication required');
    }

    const userRole = request.user.role;

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(userRole)) {
      request.log.warn(
        {
          requestId,
          userId: request.user.userId,
          userRole,
          allowedRoles,
        },
        'Authorization failed: Insufficient role permissions'
      );
      throw new AuthorizationError(
        `Access forbidden. Required role: ${allowedRoles.join(' or ')}`
      );
    }

    request.log.info(
      {
        requestId,
        userId: request.user.userId,
        userRole,
        allowedRoles,
      },
      'Authorization successful: Role check passed'
    );
  };
}

/**
 * Resource type for ownership verification
 */
export type ResourceType = 'course' | 'enrollment' | 'assignment_submission' | 'quiz_submission' | 'message' | 'discussion_thread' | 'discussion_post';

/**
 * Ownership verification function type
 */
export type OwnershipVerifier = (
  userId: string,
  resourceId: string
) => Promise<boolean>;

/**
 * Registry of ownership verification functions by resource type
 */
const ownershipVerifiers: Map<ResourceType, OwnershipVerifier> = new Map();

/**
 * Register an ownership verification function for a resource type
 * 
 * This allows modules to register their own ownership verification logic
 * without creating circular dependencies.
 * 
 * @param resourceType - Type of resource to verify ownership for
 * @param verifier - Async function that returns true if user owns the resource
 * 
 * @example
 * // In courses module
 * registerOwnershipVerifier('course', async (userId, courseId) => {
 *   const course = await courseRepository.findById(courseId);
 *   return course?.instructorId === userId;
 * });
 */
export function registerOwnershipVerifier(
  resourceType: ResourceType,
  verifier: OwnershipVerifier
): void {
  ownershipVerifiers.set(resourceType, verifier);
}

/**
 * Get ownership verifier for a resource type
 * 
 * @param resourceType - Type of resource
 * @returns Ownership verifier function
 * @throws Error if no verifier registered for resource type
 */
function getOwnershipVerifier(resourceType: ResourceType): OwnershipVerifier {
  const verifier = ownershipVerifiers.get(resourceType);
  if (!verifier) {
    throw new Error(
      `No ownership verifier registered for resource type: ${resourceType}`
    );
  }
  return verifier;
}

/**
 * Authorization middleware factory that checks resource ownership
 * 
 * Creates a middleware function that verifies the authenticated user
 * owns the specified resource. The resource ID is extracted from the
 * request parameters. Must be used after requireAuth middleware.
 * 
 * @param resourceType - Type of resource to check ownership for
 * @param resourceIdParam - Name of the route parameter containing the resource ID (defaults to 'id')
 * @returns Fastify preHandler middleware function
 * @throws AuthorizationError if user doesn't own the resource
 * @throws NotFoundError if resource doesn't exist
 * 
 * Requirements: 2.4
 * 
 * @example
 * // Only course owner (instructor) can update their course
 * fastify.put('/courses/:id', {
 *   preHandler: [requireAuth, requireOwnership('course')]
 * }, handler);
 * 
 * @example
 * // Only enrollment owner (student) can view their progress
 * fastify.get('/enrollments/:enrollmentId/progress', {
 *   preHandler: [requireAuth, requireOwnership('enrollment', 'enrollmentId')]
 * }, handler);
 */
export function requireOwnership(
  resourceType: ResourceType,
  resourceIdParam: string = 'id'
) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const requestId = request.id;

    // Ensure request is authenticated
    if (!isAuthenticatedRequest(request)) {
      request.log.error(
        { requestId },
        'Ownership check failed: Request not authenticated'
      );
      throw new AuthenticationError('Authentication required');
    }

    // Extract resource ID from route parameters
    const params = request.params as Record<string, string>;
    const resourceId = params[resourceIdParam];

    if (!resourceId) {
      request.log.error(
        { requestId, resourceIdParam, params },
        'Ownership check failed: Resource ID not found in parameters'
      );
      throw new ValidationError(
        `Resource ID parameter '${resourceIdParam}' not found in request`
      );
    }

    const userId = request.user.userId;

    try {
      // Get the appropriate ownership verifier
      const verifier = getOwnershipVerifier(resourceType);

      // Verify ownership
      const isOwner = await verifier(userId, resourceId);

      if (!isOwner) {
        request.log.warn(
          {
            requestId,
            userId,
            resourceType,
            resourceId,
          },
          'Authorization failed: User does not own resource'
        );
        throw new AuthorizationError(
          'Access forbidden. You do not have permission to access this resource'
        );
      }

      request.log.info(
        {
          requestId,
          userId,
          resourceType,
          resourceId,
        },
        'Authorization successful: Ownership verified'
      );
    } catch (error) {
      // If it's already an authorization or authentication error, rethrow it
      if (
        error instanceof AuthorizationError ||
        error instanceof AuthenticationError ||
        error instanceof ValidationError
      ) {
        throw error;
      }

      // If verifier not found, throw error
      if (error instanceof Error && error.message.includes('No ownership verifier')) {
        request.log.error(
          { requestId, resourceType, error: error.message },
          'Ownership check failed: Verifier not registered'
        );
        throw new Error(error.message);
      }

      // Log unexpected errors
      request.log.error(
        {
          requestId,
          userId,
          resourceType,
          resourceId,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Unexpected error during ownership verification'
      );

      // Throw generic authorization error for unexpected errors
      throw new AuthorizationError('Failed to verify resource ownership');
    }
  };
}

// Export request logging middleware
export { logRequest, logResponse, logError } from './requestLogger.js';

// Export validation middleware
export {
  createValidationMiddleware,
  createFastifySchema,
  zodToFastifySchema,
  validationPlugin,
  commonValidationSchemas,
  type ValidationConfig,
  type ValidationErrorDetail,
  type ValidationResult,
} from './validation.js';

// Export file upload security middleware
export {
  createFileUploadSecurityMiddleware,
  createAvatarUploadMiddleware,
  createCourseResourceUploadMiddleware,
  createAssignmentSubmissionUploadMiddleware,
  createVideoContentUploadMiddleware,
  createDocumentUploadMiddleware,
  type FileUploadMiddlewareOptions,
  type RequestWithFileValidation,
} from './fileUploadSecurity.js';
