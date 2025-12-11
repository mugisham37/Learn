/**
 * Rate Limit Response Handling Tests
 * 
 * Tests the rate limit response handling implementation
 * without requiring Redis connection.
 * 
 * Requirements: 13.6
 */

import { describe, it, expect } from 'vitest';
import { RateLimitError } from '../../errors/index.js';

describe('Rate Limit Response Handling', () => {
  describe('RateLimitError Response Format', () => {
    it('should create proper 429 response with all required headers', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const error = new RateLimitError(
        'Rate limit exceeded. You have made too many requests. Please try again in 300 seconds.',
        100, // limit
        resetTime, // resetTime
        5, // remaining
        300 // retryAfter
      );

      // Verify error properties (Requirement 13.6)
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.message).toContain('Please try again in 300 seconds');

      // Verify headers are generated correctly (Requirement 13.6)
      const headers = error.getHeaders();
      expect(headers['X-RateLimit-Limit']).toBe(100);
      expect(headers['X-RateLimit-Remaining']).toBe(5);
      expect(headers['X-RateLimit-Reset']).toBe(1704110400); // Unix timestamp
      expect(headers['Retry-After']).toBe(300);
    });

    it('should provide informative error message', () => {
      const error = new RateLimitError(
        'Rate limit exceeded. You have made too many requests. Please try again in 900 seconds.',
        50,
        new Date(),
        0,
        900
      );

      // Verify informative message (Requirement 13.6)
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.message).toContain('too many requests');
      expect(error.message).toContain('Please try again');
      expect(error.message).toContain('900 seconds');
    });

    it('should handle partial rate limit information', () => {
      const error = new RateLimitError('Rate limit exceeded', 25);
      
      expect(error.statusCode).toBe(429);
      expect(error.limit).toBe(25);
      expect(error.remaining).toBeUndefined();
      expect(error.resetTime).toBeUndefined();
      expect(error.retryAfter).toBeUndefined();

      const headers = error.getHeaders();
      expect(headers['X-RateLimit-Limit']).toBe(25);
      expect(headers['X-RateLimit-Remaining']).toBeUndefined();
      expect(headers['X-RateLimit-Reset']).toBeUndefined();
      expect(headers['Retry-After']).toBeUndefined();
    });

    it('should include all rate limit details in error details', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const error = new RateLimitError(
        'Custom rate limit message',
        200,
        resetTime,
        10,
        600
      );

      expect(error.details).toEqual({
        limit: 200,
        resetTime: '2024-01-01T12:00:00.000Z',
        remaining: 10,
        retryAfter: 600,
      });
    });
  });

  describe('Rate Limit Response Structure', () => {
    it('should match expected response structure for rate limit errors', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const error = new RateLimitError(
        'Rate limit exceeded. You have made too many requests. Please try again in 300 seconds.',
        100,
        resetTime,
        0,
        300
      );

      // Simulate the response structure that would be sent
      const responseStructure = {
        statusCode: error.statusCode,
        error: 'Too Many Requests',
        message: error.message,
        details: {
          limit: error.limit,
          remaining: error.remaining,
          resetTime: error.resetTime?.toISOString(),
          retryAfter: error.retryAfter,
          policy: `${error.limit} requests per 15 minutes`,
        },
        timestamp: new Date().toISOString(),
      };

      expect(responseStructure.statusCode).toBe(429);
      expect(responseStructure.error).toBe('Too Many Requests');
      expect(responseStructure.message).toContain('Rate limit exceeded');
      expect(responseStructure.details.limit).toBe(100);
      expect(responseStructure.details.remaining).toBe(0);
      expect(responseStructure.details.resetTime).toBe('2024-01-01T12:00:00.000Z');
      expect(responseStructure.details.retryAfter).toBe(300);
    });
  });

  describe('Header Validation', () => {
    it('should generate all required headers when all data is available', () => {
      const resetTime = new Date('2024-06-15T10:30:00Z');
      const error = new RateLimitError(
        'Rate limit exceeded',
        75,
        resetTime,
        3,
        450
      );

      const headers = error.getHeaders();

      // Verify all required headers are present (Requirement 13.6)
      expect(headers).toHaveProperty('X-RateLimit-Limit');
      expect(headers).toHaveProperty('X-RateLimit-Remaining');
      expect(headers).toHaveProperty('X-RateLimit-Reset');
      expect(headers).toHaveProperty('Retry-After');

      // Verify header values
      expect(headers['X-RateLimit-Limit']).toBe(75);
      expect(headers['X-RateLimit-Remaining']).toBe(3);
      expect(headers['X-RateLimit-Reset']).toBe(Math.floor(resetTime.getTime() / 1000)); // Unix timestamp for 2024-06-15T10:30:00Z
      expect(headers['Retry-After']).toBe(450);
    });

    it('should only include headers for available data', () => {
      const error = new RateLimitError('Rate limit exceeded', 30, undefined, 2);

      const headers = error.getHeaders();

      expect(headers['X-RateLimit-Limit']).toBe(30);
      expect(headers['X-RateLimit-Remaining']).toBe(2);
      expect(headers).not.toHaveProperty('X-RateLimit-Reset');
      expect(headers).not.toHaveProperty('Retry-After');
    });
  });
});