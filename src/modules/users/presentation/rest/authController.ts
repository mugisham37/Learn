/**
 * REST Authentication Controller
 *
 * Provides REST endpoints for authentication operations with proper
 * cookie handling for refresh tokens and CSRF protection.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 13.8
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../../../../config/index.js';
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
} from '../../../../shared/errors/index.js';
import { requireAuth } from '../../../../shared/middleware/index.js';
import { setCSRFTokenCookie } from '../../../../shared/middleware/csrf.js';
import { logger } from '../../../../shared/utils/logger.js';
import { IAuthService } from '../../application/services/IAuthService.js';

/**
 * Request/Response types for authentication endpoints
 */
interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: 'student' | 'educator' | 'admin';
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshTokenRequest {
  refreshToken?: string; // Optional - can come from cookie
}

interface VerifyEmailRequest {
  token: string;
}

interface RequestPasswordResetRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

/**
 * Sets secure refresh token cookie
 *
 * @param reply - Fastify reply object
 * @param refreshToken - Refresh token to set in cookie
 */
function setRefreshTokenCookie(reply: FastifyReply, refreshToken: string): void {
  const isProduction = config.nodeEnv === 'production';

  reply.setCookie('refresh-token', refreshToken, {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: 'strict', // Strict SameSite policy for CSRF protection
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/api/auth',
  });
}

/**
 * Clears refresh token cookie
 *
 * @param reply - Fastify reply object
 */
function clearRefreshTokenCookie(reply: FastifyReply): void {
  reply.clearCookie('refresh-token', {
    path: '/api/auth',
  });
}

/**
 * Registers authentication REST routes
 *
 * @param fastify - Fastify instance
 * @param authService - Authentication service
 */
export async function registerAuthRoutes(
  fastify: FastifyInstance,
  authService: IAuthService
): Promise<void> {
  // Register user
  fastify.post<{ Body: RegisterRequest }>(
    '/api/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'fullName', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            fullName: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['student', 'educator', 'admin'] },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id;

      try {
        const result = await authService.register(request.body);

        logger.info(
          { requestId, userId: result.user.id, email: result.user.email.value },
          'User registered successfully'
        );

        return reply.code(201).send({
          message: 'Registration successful. Please check your email to verify your account.',
          user: {
            id: result.user.id,
            email: result.user.email.value,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
          },
        });
      } catch (error) {
        if (error instanceof ConflictError) {
          return reply.code(409).send({
            error: 'Conflict',
            message: error.message,
            field: error.field,
          });
        }

        if (error instanceof ValidationError) {
          return reply.code(400).send({
            error: 'Validation Error',
            message: error.message,
            details: error.details,
          });
        }

        logger.error(
          { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
          'Registration failed'
        );

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Registration failed',
        });
      }
    }
  );

  // Login user
  fastify.post<{ Body: LoginRequest }>(
    '/api/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id;

      try {
        const result = await authService.login(request.body.email, request.body.password);

        // Set refresh token in secure cookie
        setRefreshTokenCookie(reply, result.refreshToken);

        // Generate and set CSRF token
        const csrfToken = (
          await import('../../../../shared/middleware/csrf.js')
        ).generateCSRFToken();
        setCSRFTokenCookie(reply, csrfToken);

        logger.info(
          { requestId, userId: result.user.id, email: result.user.email.value },
          'User logged in successfully'
        );

        const response: AuthResponse = {
          accessToken: result.accessToken,
          user: {
            id: result.user.id,
            email: result.user.email.value,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
          },
        };

        return reply.code(200).send(response);
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return reply.code(401).send({
            error: 'Authentication Error',
            message: error.message,
          });
        }

        logger.error(
          { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
          'Login failed'
        );

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Login failed',
        });
      }
    }
  );

  // Refresh token
  fastify.post<{ Body: RefreshTokenRequest }>(
    '/api/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id;

      try {
        // Get refresh token from cookie or request body
        const refreshToken = request.cookies['refresh-token'] || request.body.refreshToken;

        if (!refreshToken) {
          return reply.code(401).send({
            error: 'Authentication Error',
            message: 'Refresh token is required',
          });
        }

        const result = await authService.refreshToken(refreshToken);

        // Set new refresh token in secure cookie
        setRefreshTokenCookie(reply, result.refreshToken);

        logger.info({ requestId }, 'Token refreshed successfully');

        return reply.code(200).send({
          accessToken: result.accessToken,
        });
      } catch (error) {
        if (error instanceof AuthenticationError) {
          // Clear invalid refresh token cookie
          clearRefreshTokenCookie(reply);

          return reply.code(401).send({
            error: 'Authentication Error',
            message: error.message,
          });
        }

        logger.error(
          { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
          'Token refresh failed'
        );

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Token refresh failed',
        });
      }
    }
  );

  // Logout user
  fastify.post(
    '/api/auth/logout',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const requestId = request.id;
      const user = (request as any).user;

      try {
        // Get refresh token from cookie
        const refreshToken = request.cookies['refresh-token'];

        if (refreshToken) {
          await authService.logout(user.userId, refreshToken);
        }

        // Clear refresh token cookie
        clearRefreshTokenCookie(reply);

        logger.info({ requestId, userId: user.userId }, 'User logged out successfully');

        return reply.code(200).send({
          message: 'Logout successful',
        });
      } catch (error) {
        logger.error(
          {
            requestId,
            userId: user.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Logout failed'
        );

        // Still clear the cookie even if logout fails
        clearRefreshTokenCookie(reply);

        return reply.code(200).send({
          message: 'Logout completed',
        });
      }
    }
  );

  // Verify email
  fastify.post<{ Body: VerifyEmailRequest }>(
    '/api/auth/verify-email',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id;

      try {
        const user = await authService.verifyEmail(request.body.token);

        logger.info(
          { requestId, userId: user.id, email: user.email.value },
          'Email verified successfully'
        );

        return reply.code(200).send({
          message: 'Email verified successfully',
          user: {
            id: user.id,
            email: user.email.value,
            role: user.role,
            emailVerified: user.emailVerified,
          },
        });
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return reply.code(400).send({
            error: 'Authentication Error',
            message: error.message,
          });
        }

        logger.error(
          { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
          'Email verification failed'
        );

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Email verification failed',
        });
      }
    }
  );

  // Request password reset
  fastify.post<{ Body: RequestPasswordResetRequest }>(
    '/api/auth/request-password-reset',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id;

      try {
        await authService.requestPasswordReset(request.body.email);

        logger.info({ requestId, email: request.body.email }, 'Password reset requested');

        // Always return success to prevent email enumeration
        return reply.code(200).send({
          message: 'If an account with that email exists, a password reset link has been sent.',
        });
      } catch (error) {
        logger.error(
          { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
          'Password reset request failed'
        );

        // Still return success to prevent email enumeration
        return reply.code(200).send({
          message: 'If an account with that email exists, a password reset link has been sent.',
        });
      }
    }
  );

  // Reset password
  fastify.post<{ Body: ResetPasswordRequest }>(
    '/api/auth/reset-password',
    {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string', minLength: 1 },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id;

      try {
        await authService.resetPassword(request.body.token, request.body.newPassword);

        logger.info({ requestId }, 'Password reset successfully');

        return reply.code(200).send({
          message: 'Password reset successfully',
        });
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return reply.code(400).send({
            error: 'Authentication Error',
            message: error.message,
          });
        }

        if (error instanceof ValidationError) {
          return reply.code(400).send({
            error: 'Validation Error',
            message: error.message,
            details: error.details,
          });
        }

        logger.error(
          { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
          'Password reset failed'
        );

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Password reset failed',
        });
      }
    }
  );

  logger.info('Authentication REST routes registered successfully');
}
