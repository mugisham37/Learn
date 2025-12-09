/**
 * Authorization Middleware Tests
 * 
 * Tests for the requireRole and requireOwnership middleware functionality
 * 
 * Requirements: 2.2, 2.3, 2.4
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthenticationError, AuthorizationError, ValidationError } from '@shared/errors/index.js';
import {
  requireRole,
  requireOwnership,
  registerOwnershipVerifier,
  AuthenticatedRequest,
  ResourceType,
} from '@shared/middleware/index.js';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => mockLogger),
};

// Helper to create authenticated mock request
function createAuthenticatedRequest(
  userId: string,
  email: string,
  role: 'student' | 'educator' | 'admin',
  params: Record<string, string> = {}
): AuthenticatedRequest {
  return {
    id: 'test-request-id',
    headers: {},
    params,
    user: {
      userId,
      email,
      role,
    },
    log: mockLogger,
  } as unknown as AuthenticatedRequest;
}

// Helper to create unauthenticated mock request
function createUnauthenticatedRequest(): FastifyRequest {
  return {
    id: 'test-request-id',
    headers: {},
    log: mockLogger,
  } as unknown as FastifyRequest;
}

// Helper to create mock reply
function createMockReply(): FastifyReply {
  return {} as FastifyReply;
}

describe('requireRole middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful authorization', () => {
    it('should allow access when user has required role', () => {
      const middleware = requireRole(['educator']);
      const request = createAuthenticatedRequest('user-123', 'educator@example.com', 'educator');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).not.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id',
          userId: 'user-123',
          userRole: 'educator',
          allowedRoles: ['educator'],
        }),
        'Authorization successful: Role check passed'
      );
    });

    it('should allow access when user has one of multiple allowed roles', () => {
      const middleware = requireRole(['educator', 'admin']);
      const request = createAuthenticatedRequest('user-123', 'educator@example.com', 'educator');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).not.toThrow();
    });

    it('should allow admin access to admin-only endpoints', () => {
      const middleware = requireRole(['admin']);
      const request = createAuthenticatedRequest('admin-123', 'admin@example.com', 'admin');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).not.toThrow();
    });

    it('should allow student access to student-only endpoints', () => {
      const middleware = requireRole(['student']);
      const request = createAuthenticatedRequest('student-123', 'student@example.com', 'student');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).not.toThrow();
    });
  });

  describe('authorization failures', () => {
    it('should throw AuthorizationError when user lacks required role', () => {
      const middleware = requireRole(['educator']);
      const request = createAuthenticatedRequest('student-123', 'student@example.com', 'student');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).toThrow(AuthorizationError);
      expect(() => middleware(request, reply)).toThrow('Access forbidden. Required role: educator');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id',
          userId: 'student-123',
          userRole: 'student',
          allowedRoles: ['educator'],
        }),
        'Authorization failed: Insufficient role permissions'
      );
    });

    it('should throw AuthorizationError when student tries to access educator endpoint', () => {
      const middleware = requireRole(['educator']);
      const request = createAuthenticatedRequest('student-123', 'student@example.com', 'student');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).toThrow(AuthorizationError);
    });

    it('should throw AuthorizationError when educator tries to access admin endpoint', () => {
      const middleware = requireRole(['admin']);
      const request = createAuthenticatedRequest('educator-123', 'educator@example.com', 'educator');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).toThrow(AuthorizationError);
      expect(() => middleware(request, reply)).toThrow('Access forbidden. Required role: admin');
    });

    it('should show multiple roles in error message', () => {
      const middleware = requireRole(['educator', 'admin']);
      const request = createAuthenticatedRequest('student-123', 'student@example.com', 'student');
      const reply = createMockReply();

      expect(() => middleware(request, reply)).toThrow('Required role: educator or admin');
    });
  });

  describe('authentication check', () => {
    it('should throw AuthenticationError when request is not authenticated', () => {
      const middleware = requireRole(['educator']);
      const request = createUnauthenticatedRequest();
      const reply = createMockReply();

      expect(() => middleware(request, reply)).toThrow(AuthenticationError);
      expect(() => middleware(request, reply)).toThrow('Authentication required');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'test-request-id' }),
        'Authorization check failed: Request not authenticated'
      );
    });
  });
});

describe('requireOwnership middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful ownership verification', () => {
    it('should allow access when user owns the resource', async () => {
      // Register a mock verifier that returns true
      const mockVerifier = vi.fn().mockResolvedValue(true);
      registerOwnershipVerifier('course', mockVerifier);

      const middleware = requireOwnership('course');
      const request = createAuthenticatedRequest(
        'user-123',
        'educator@example.com',
        'educator',
        { id: 'course-456' }
      );
      const reply = createMockReply();

      await expect(middleware(request, reply)).resolves.not.toThrow();

      expect(mockVerifier).toHaveBeenCalledWith('user-123', 'course-456');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id',
          userId: 'user-123',
          resourceType: 'course',
          resourceId: 'course-456',
        }),
        'Authorization successful: Ownership verified'
      );
    });

    it('should use custom resource ID parameter name', async () => {
      const mockVerifier = vi.fn().mockResolvedValue(true);
      registerOwnershipVerifier('enrollment', mockVerifier);

      const middleware = requireOwnership('enrollment', 'enrollmentId');
      const request = createAuthenticatedRequest(
        'student-123',
        'student@example.com',
        'student',
        { enrollmentId: 'enrollment-789' }
      );
      const reply = createMockReply();

      await expect(middleware(request, reply)).resolves.not.toThrow();

      expect(mockVerifier).toHaveBeenCalledWith('student-123', 'enrollment-789');
    });
  });

  describe('ownership verification failures', () => {
    it('should throw AuthorizationError when user does not own resource', async () => {
      const mockVerifier = vi.fn().mockResolvedValue(false);
      registerOwnershipVerifier('course', mockVerifier);

      const middleware = requireOwnership('course');
      const request = createAuthenticatedRequest(
        'user-123',
        'educator@example.com',
        'educator',
        { id: 'course-456' }
      );
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(AuthorizationError);
      await expect(middleware(request, reply)).rejects.toThrow(
        'Access forbidden. You do not have permission to access this resource'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id',
          userId: 'user-123',
          resourceType: 'course',
          resourceId: 'course-456',
        }),
        'Authorization failed: User does not own resource'
      );
    });

    it('should throw ValidationError when resource ID parameter is missing', async () => {
      const mockVerifier = vi.fn().mockResolvedValue(true);
      registerOwnershipVerifier('course', mockVerifier);

      const middleware = requireOwnership('course');
      const request = createAuthenticatedRequest(
        'user-123',
        'educator@example.com',
        'educator',
        {} // No id parameter
      );
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ValidationError);
      await expect(middleware(request, reply)).rejects.toThrow(
        "Resource ID parameter 'id' not found in request"
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id',
          resourceIdParam: 'id',
        }),
        'Ownership check failed: Resource ID not found in parameters'
      );
    });

    it('should throw ValidationError when custom parameter is missing', async () => {
      const mockVerifier = vi.fn().mockResolvedValue(true);
      registerOwnershipVerifier('enrollment', mockVerifier);

      const middleware = requireOwnership('enrollment', 'enrollmentId');
      const request = createAuthenticatedRequest(
        'student-123',
        'student@example.com',
        'student',
        { id: 'some-id' } // Wrong parameter name
      );
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(ValidationError);
      await expect(middleware(request, reply)).rejects.toThrow(
        "Resource ID parameter 'enrollmentId' not found in request"
      );
    });
  });

  describe('authentication check', () => {
    it('should throw AuthenticationError when request is not authenticated', async () => {
      const mockVerifier = vi.fn().mockResolvedValue(true);
      registerOwnershipVerifier('course', mockVerifier);

      const middleware = requireOwnership('course');
      const request = createUnauthenticatedRequest();
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(AuthenticationError);
      await expect(middleware(request, reply)).rejects.toThrow('Authentication required');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'test-request-id' }),
        'Ownership check failed: Request not authenticated'
      );
    });
  });

  describe('verifier registration', () => {
    it('should throw error when no verifier is registered for resource type', async () => {
      const middleware = requireOwnership('message' as ResourceType);
      const request = createAuthenticatedRequest(
        'user-123',
        'user@example.com',
        'student',
        { id: 'message-123' }
      );
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(
        'No ownership verifier registered for resource type: message'
      );
    });
  });

  describe('error handling', () => {
    it('should handle verifier errors gracefully', async () => {
      const mockVerifier = vi.fn().mockRejectedValue(new Error('Database error'));
      registerOwnershipVerifier('course', mockVerifier);

      const middleware = requireOwnership('course');
      const request = createAuthenticatedRequest(
        'user-123',
        'educator@example.com',
        'educator',
        { id: 'course-456' }
      );
      const reply = createMockReply();

      await expect(middleware(request, reply)).rejects.toThrow(AuthorizationError);
      await expect(middleware(request, reply)).rejects.toThrow('Failed to verify resource ownership');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id',
          userId: 'user-123',
          resourceType: 'course',
          resourceId: 'course-456',
          error: 'Database error',
        }),
        'Unexpected error during ownership verification'
      );
    });
  });
});
