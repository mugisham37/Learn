/**
 * Tests for GraphQL Apollo Server Context Builder
 * 
 * Tests the JWT extraction, validation, and context creation functionality
 * implemented in task 114.
 * 
 * Requirements: 21.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGraphQLContext } from '../apolloServer.js';

// Mock the auth utilities
vi.mock('../../../shared/utils/auth.js', () => ({
  verifyToken: vi.fn(),
}));

// Mock the logger
vi.mock('../../../shared/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GraphQL Context Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGraphQLContext', () => {
    it('should create context without user when no authorization header', async () => {
      // Arrange
      const request = {
        id: 'test-request-1',
        headers: {},
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context).toEqual({
        requestId: 'test-request-1',
        user: undefined,
        dataloaders: {},
      });
    });

    it('should create context without user when authorization header is malformed', async () => {
      // Arrange
      const request = {
        id: 'test-request-2',
        headers: {
          authorization: 'InvalidFormat token',
        },
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context).toEqual({
        requestId: 'test-request-2',
        user: undefined,
        dataloaders: {},
      });
    });

    it('should create context without user when JWT token is invalid', async () => {
      // Arrange
      const { verifyToken } = await import('../../../shared/utils/auth.js');
      vi.mocked(verifyToken).mockImplementation(() => {
        throw new Error('Invalid token signature');
      });

      const request = {
        id: 'test-request-3',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context).toEqual({
        requestId: 'test-request-3',
        user: undefined,
        dataloaders: {},
      });
      expect(verifyToken).toHaveBeenCalledWith('invalid-token');
    });

    it('should create context without user when JWT token is expired', async () => {
      // Arrange
      const { verifyToken } = await import('../../../shared/utils/auth.js');
      vi.mocked(verifyToken).mockReturnValue({
        payload: {
          userId: 'user-123',
          email: 'test@example.com',
          role: 'student',
          type: 'access',
        },
        expired: true,
      });

      const request = {
        id: 'test-request-4',
        headers: {
          authorization: 'Bearer expired-token',
        },
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context).toEqual({
        requestId: 'test-request-4',
        user: undefined,
        dataloaders: {},
      });
      expect(verifyToken).toHaveBeenCalledWith('expired-token');
    });

    it('should create context with user when JWT token is valid', async () => {
      // Arrange
      const { verifyToken } = await import('../../../shared/utils/auth.js');
      vi.mocked(verifyToken).mockReturnValue({
        payload: {
          userId: 'user-123',
          email: 'test@example.com',
          role: 'student',
          type: 'access',
        },
        expired: false,
      });

      const request = {
        id: 'test-request-5',
        headers: {
          authorization: 'Bearer valid-token',
        },
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context).toEqual({
        requestId: 'test-request-5',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'student',
        },
        dataloaders: {},
      });
      expect(verifyToken).toHaveBeenCalledWith('valid-token');
    });

    it('should use "unknown" as requestId when request.id is missing', async () => {
      // Arrange
      const request = {
        headers: {},
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context.requestId).toBe('unknown');
    });

    it('should handle authorization header as array (edge case)', async () => {
      // Arrange
      const request = {
        id: 'test-request-6',
        headers: {
          authorization: ['Bearer token1', 'Bearer token2'], // Edge case: array of headers
        },
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context).toEqual({
        requestId: 'test-request-6',
        user: undefined,
        dataloaders: {},
      });
    });

    it('should handle different user roles correctly', async () => {
      // Arrange
      const { verifyToken } = await import('../../../shared/utils/auth.js');
      vi.mocked(verifyToken).mockReturnValue({
        payload: {
          userId: 'educator-456',
          email: 'educator@example.com',
          role: 'educator',
          type: 'access',
        },
        expired: false,
      });

      const request = {
        id: 'test-request-7',
        headers: {
          authorization: 'Bearer educator-token',
        },
      };

      // Act
      const context = await createGraphQLContext({ request });

      // Assert
      expect(context.user).toEqual({
        id: 'educator-456',
        email: 'educator@example.com',
        role: 'educator',
      });
    });
  });
});