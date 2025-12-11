/**
 * Error Handling System Tests
 * 
 * Tests for custom error classes, error formatting, and error sanitization
 * as per Requirements 13.1 and 17.2
 */

import { describe, it, expect } from 'vitest';

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
  DatabaseError,
  RateLimitError,
  formatErrorResponse,
  sanitizeError,
  isOperationalError,
  getStatusCode,
} from '@shared/errors/index.js';

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('AppError');
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
    });

    it('should support non-operational errors', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR', undefined, false);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with 400 status code', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
    });

    it('should include field-level validation errors', () => {
      const fields = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ];
      const error = new ValidationError('Validation failed', fields);
      
      expect(error.fields).toEqual(fields);
      expect(error.details).toEqual({ fields });
    });
  });

  describe('AuthenticationError', () => {
    it('should create an AuthenticationError with 401 status code', () => {
      const error = new AuthenticationError();
      
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.message).toBe('Authentication failed');
    });

    it('should support custom message and reason', () => {
      const error = new AuthenticationError('Invalid token', 'expired');
      
      expect(error.message).toBe('Invalid token');
      expect(error.reason).toBe('expired');
      expect(error.details).toEqual({ reason: 'expired' });
    });
  });

  describe('AuthorizationError', () => {
    it('should create an AuthorizationError with 403 status code', () => {
      const error = new AuthorizationError();
      
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.message).toBe('Access forbidden');
    });

    it('should include role information', () => {
      const error = new AuthorizationError('Insufficient permissions', 'educator', 'student');
      
      expect(error.requiredRole).toBe('educator');
      expect(error.userRole).toBe('student');
      expect(error.details).toEqual({ requiredRole: 'educator', userRole: 'student' });
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with 404 status code', () => {
      const error = new NotFoundError('User');
      
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });

    it('should include resource ID when provided', () => {
      const error = new NotFoundError('Course', '123');
      
      expect(error.resourceType).toBe('Course');
      expect(error.resourceId).toBe('123');
      expect(error.details).toEqual({ resourceType: 'Course', resourceId: '123' });
    });
  });

  describe('ConflictError', () => {
    it('should create a ConflictError with 409 status code', () => {
      const error = new ConflictError('Email already exists');
      
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Email already exists');
    });

    it('should include conflict field', () => {
      const error = new ConflictError('Duplicate entry', 'email');
      
      expect(error.conflictField).toBe('email');
      expect(error.details).toEqual({ conflictField: 'email' });
    });
  });

  describe('ExternalServiceError', () => {
    it('should create an ExternalServiceError with 502 status code', () => {
      const error = new ExternalServiceError('Stripe', 'Payment processing failed');
      
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.message).toBe('Stripe error: Payment processing failed');
      expect(error.serviceName).toBe('Stripe');
    });

    it('should wrap original error', () => {
      const originalError = new Error('Connection timeout');
      const error = new ExternalServiceError('AWS S3', 'Upload failed', originalError);
      
      expect(error.originalError).toBe(originalError);
      expect(error.details?.originalError).toBe('Connection timeout');
    });

    it('should support custom status code', () => {
      const error = new ExternalServiceError('SendGrid', 'Service unavailable', undefined, 503);
      expect(error.statusCode).toBe(503);
    });
  });

  describe('DatabaseError', () => {
    it('should create a DatabaseError with 500 status code', () => {
      const error = new DatabaseError('Query failed');
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.message).toBe('Query failed');
      expect(error.isOperational).toBe(false);
    });

    it('should include operation and original error', () => {
      const originalError = new Error('Connection lost');
      const error = new DatabaseError('Transaction failed', 'INSERT', originalError);
      
      expect(error.operation).toBe('INSERT');
      expect(error.originalError).toBe(originalError);
      expect(error.details?.operation).toBe('INSERT');
      expect(error.details?.error).toBe('Connection lost');
    });
  });

  describe('RateLimitError', () => {
    it('should create a RateLimitError with 429 status code', () => {
      const error = new RateLimitError();
      
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.message).toBe('Too many requests');
    });

    it('should include limit and reset time', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const error = new RateLimitError('Rate limit exceeded', 100, resetTime);
      
      expect(error.limit).toBe(100);
      expect(error.resetTime).toBe(resetTime);
      expect(error.details?.limit).toBe(100);
      expect(error.details?.resetTime).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should include all rate limit parameters', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const error = new RateLimitError('Rate limit exceeded', 100, resetTime, 5, 300);
      
      expect(error.limit).toBe(100);
      expect(error.resetTime).toBe(resetTime);
      expect(error.remaining).toBe(5);
      expect(error.retryAfter).toBe(300);
      expect(error.details?.limit).toBe(100);
      expect(error.details?.resetTime).toBe('2024-01-01T12:00:00.000Z');
      expect(error.details?.remaining).toBe(5);
      expect(error.details?.retryAfter).toBe(300);
    });

    it('should generate correct headers for rate limit response', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const error = new RateLimitError('Rate limit exceeded', 100, resetTime, 5, 300);
      
      const headers = error.getHeaders();
      
      expect(headers['X-RateLimit-Limit']).toBe(100);
      expect(headers['X-RateLimit-Remaining']).toBe(5);
      expect(headers['X-RateLimit-Reset']).toBe(1704110400); // Unix timestamp for 2024-01-01T12:00:00Z
      expect(headers['Retry-After']).toBe(300);
    });

    it('should generate headers with only available parameters', () => {
      const error = new RateLimitError('Rate limit exceeded', 50);
      
      const headers = error.getHeaders();
      
      expect(headers['X-RateLimit-Limit']).toBe(50);
      expect(headers['X-RateLimit-Remaining']).toBeUndefined();
      expect(headers['X-RateLimit-Reset']).toBeUndefined();
      expect(headers['Retry-After']).toBeUndefined();
    });
  });
});

describe('Error Formatting', () => {
  describe('formatErrorResponse', () => {
    it('should format AppError correctly', () => {
      const error = new AppError('Test error', 500, 'TEST_ERROR', { foo: 'bar' });
      const response = formatErrorResponse(error, 'req-123', false);
      
      expect(response).toEqual({
        error: true,
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: error.timestamp,
        requestId: 'req-123',
        details: { foo: 'bar' },
      });
    });

    it('should include stack trace in development mode', () => {
      const error = new AppError('Test error');
      const response = formatErrorResponse(error, 'req-123', true);
      
      expect(response.stack).toBeDefined();
      expect(response.stack).toContain('AppError');
    });

    it('should not include stack trace in production mode', () => {
      const error = new AppError('Test error');
      const response = formatErrorResponse(error, 'req-123', false);
      
      expect(response.stack).toBeUndefined();
    });

    it('should format generic Error correctly', () => {
      const error = new Error('Generic error');
      const response = formatErrorResponse(error, 'req-123', false);
      
      expect(response).toMatchObject({
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: 'req-123',
      });
      expect(response.timestamp).toBeDefined();
    });

    it('should show original message in development for generic errors', () => {
      const error = new Error('Generic error');
      const response = formatErrorResponse(error, 'req-123', true);
      
      expect(response.message).toBe('Generic error');
      expect(response.stack).toBeDefined();
    });
  });
});

describe('Error Sanitization', () => {
  describe('sanitizeError', () => {
    it('should return operational errors as-is', () => {
      const error = new ValidationError('Invalid input');
      const sanitized = sanitizeError(error);
      
      expect(sanitized).toBe(error);
    });

    it('should sanitize non-operational errors', () => {
      const error = new DatabaseError('Query failed');
      const sanitized = sanitizeError(error);
      
      expect(sanitized).toBeInstanceOf(AppError);
      expect(sanitized.message).toBe('An unexpected error occurred');
      expect(sanitized.code).toBe('INTERNAL_ERROR');
      expect(sanitized.statusCode).toBe(500);
      expect(sanitized.isOperational).toBe(false);
    });

    it('should sanitize generic errors', () => {
      const error = new Error('Sensitive information');
      const sanitized = sanitizeError(error);
      
      expect(sanitized).toBeInstanceOf(AppError);
      expect(sanitized.message).toBe('An unexpected error occurred');
      expect(sanitized.message).not.toContain('Sensitive information');
    });
  });
});

describe('Error Utilities', () => {
  describe('isOperationalError', () => {
    it('should return true for operational errors', () => {
      const error = new ValidationError('Invalid input');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for non-operational errors', () => {
      const error = new DatabaseError('Query failed');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for generic errors', () => {
      const error = new Error('Generic error');
      expect(isOperationalError(error)).toBe(false);
    });
  });

  describe('getStatusCode', () => {
    it('should extract status code from AppError', () => {
      const error = new ValidationError('Invalid input');
      expect(getStatusCode(error)).toBe(400);
    });

    it('should return 500 for generic errors', () => {
      const error = new Error('Generic error');
      expect(getStatusCode(error)).toBe(500);
    });

    it('should return correct status codes for different error types', () => {
      expect(getStatusCode(new ValidationError('test'))).toBe(400);
      expect(getStatusCode(new AuthenticationError())).toBe(401);
      expect(getStatusCode(new AuthorizationError())).toBe(403);
      expect(getStatusCode(new NotFoundError('User'))).toBe(404);
      expect(getStatusCode(new ConflictError('test'))).toBe(409);
      expect(getStatusCode(new RateLimitError())).toBe(429);
      expect(getStatusCode(new DatabaseError('test'))).toBe(500);
      expect(getStatusCode(new ExternalServiceError('test', 'test'))).toBe(502);
    });
  });
});
