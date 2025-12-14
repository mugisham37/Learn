/**
 * Authentication REST Controller
 *
 * Provides REST endpoints for user authentication operations.
 * This complements the GraphQL API with traditional REST endpoints.
 */

import { FastifyInstance } from 'fastify';
import { IAuthService } from '../../application/services/IAuthService.js';

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: 'student' | 'educator' | 'admin';
}

interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Register authentication routes with Fastify
 */
export async function registerAuthRoutes(
  fastify: FastifyInstance,
  authService: IAuthService
): Promise<void> {
  // Login endpoint
  fastify.post<{ Body: LoginRequest }>('/api/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body;
      
      if (!email || !password) {
        return reply.code(400).send({
          error: 'Email and password are required'
        });
      }

      const result = await authService.login(email, password);
      
      return reply.send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: result.user.id,
          email: result.user.email.toString(),
          role: result.user.role,
          emailVerified: result.user.emailVerified
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return reply.code(401).send({ error: message });
    }
  });

  // Register endpoint
  fastify.post<{ Body: RegisterRequest }>('/api/auth/register', async (request, reply) => {
    try {
      const { email, password, fullName, role } = request.body;
      
      if (!email || !password || !fullName || !role) {
        return reply.code(400).send({
          error: 'All fields are required'
        });
      }

      await authService.register({
        email,
        password,
        fullName,
        role
      });
      
      return reply.code(201).send({
        message: 'User registered successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return reply.code(400).send({ error: message });
    }
  });

  // Refresh token endpoint
  fastify.post<{ Body: RefreshTokenRequest }>('/api/auth/refresh', async (request, reply) => {
    try {
      const { refreshToken } = request.body;
      
      if (!refreshToken) {
        return reply.code(400).send({
          error: 'Refresh token is required'
        });
      }

      const result = await authService.refreshToken(refreshToken);
      
      return reply.send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      return reply.code(401).send({ error: message });
    }
  });

  // Logout endpoint
  fastify.post('/api/auth/logout', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Authorization header required' });
      }

      // Extract user ID from token (simplified - in real implementation, verify JWT)
      // For now, we'll just return success
      return reply.send({ message: 'Logged out successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      return reply.code(500).send({ error: message });
    }
  });
}