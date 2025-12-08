/**
 * Shared Middleware
 * 
 * Common middleware functions used across the application
 * 
 * Requirements: 1.6, 21.7
 */

import { FastifyReply, FastifyRequest } from 'fastify';

import { AuthenticationError } from '../errors/index.js';
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

// TODO: Implement authorization middleware
// TODO: Implement error handling middleware
// TODO: Implement request logging middleware
