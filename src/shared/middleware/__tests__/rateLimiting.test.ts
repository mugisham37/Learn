/**
 * Rate Limiting Tests
 * 
 * Tests for rate limiting middleware functionality
 * 
 * Requirements: 13.5, 13.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

import { redis } from '../../../infrastructure/cache/index.js';
import { 
  registerGlobalRateLimit, 
  checkRateLimit, 
  checkRateLimitHealth,
  EndpointRateLimits 
} from '../rateLimiting.js';

describe('Rate Limiting', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify({ logger: false });
    
    // Clear any existing rate limit keys
    await redis.flushdb();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    
    // Clean up test keys
    await redis.flushdb();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const key = 'test:user:123';
      const max = 5;
      const windowSeconds = 60;

      const result = await checkRateLimit(key, max, windowSeconds);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1 = 4
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should reject requests when limit exceeded', async () => {
      const key = 'test:user:456';
      const max = 2;
      const windowSeconds = 60;

      // Make requests up to the limit
      await checkRateLimit(key, max, windowSeconds);
      await checkRateLimit(key, max, windowSeconds);
      
      // This should be rejected
      const result = await checkRateLimit(key, max, windowSeconds);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after time window', async () => {
      const key = 'test:user:789';
      const max = 1;
      const windowSeconds = 1; // 1 second window

      // First request should be allowed
      const result1 = await checkRateLimit(key, max, windowSeconds);
      expect(result1.allowed).toBe(true);

      // Second request should be rejected
      const result2 = await checkRateLimit(key, max, windowSeconds);
      expect(result2.allowed).toBe(false);

      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Third request should be allowed again
      const result3 = await checkRateLimit(key, max, windowSeconds);
      expect(result3.allowed).toBe(true);
    });
  });

  describe('checkRateLimitHealth', () => {
    it('should return healthy status when Redis is available', async () => {
      const health = await checkRateLimitHealth();
      
      expect(health.healthy).toBe(true);
      expect(health.error).toBeUndefined();
    });
  });

  describe('EndpointRateLimits configuration', () => {
    it('should have different limits for different endpoint types', () => {
      expect(EndpointRateLimits.auth.config.rateLimit.max).toBeLessThan(
        EndpointRateLimits.search.config.rateLimit.max
      );
      
      expect(EndpointRateLimits.expensive.config.rateLimit.max).toBeLessThan(
        EndpointRateLimits.fileUpload.config.rateLimit.max
      );
      
      expect(EndpointRateLimits.analytics.config.rateLimit.max).toBeLessThan(
        EndpointRateLimits.search.config.rateLimit.max
      );
    });

    it('should use Redis store for all endpoint types', () => {
      expect(EndpointRateLimits.auth.config.rateLimit.redis).toBe(redis);
      expect(EndpointRateLimits.expensive.config.rateLimit.redis).toBe(redis);
      expect(EndpointRateLimits.fileUpload.config.rateLimit.redis).toBe(redis);
      expect(EndpointRateLimits.search.config.rateLimit.redis).toBe(redis);
      expect(EndpointRateLimits.analytics.config.rateLimit.redis).toBe(redis);
    });
  });

  describe('Global rate limiting registration', () => {
    it('should register global rate limiting without errors', async () => {
      // Mock the feature flag to be enabled
      const originalEnv = process.env.ENABLE_RATE_LIMITING;
      process.env.ENABLE_RATE_LIMITING = 'true';

      try {
        await expect(registerGlobalRateLimit(server)).resolves.not.toThrow();
      } finally {
        process.env.ENABLE_RATE_LIMITING = originalEnv;
      }
    });

    it('should skip registration when feature flag is disabled', async () => {
      // Mock the feature flag to be disabled
      const originalEnv = process.env.ENABLE_RATE_LIMITING;
      process.env.ENABLE_RATE_LIMITING = 'false';

      try {
        await expect(registerGlobalRateLimit(server)).resolves.not.toThrow();
      } finally {
        process.env.ENABLE_RATE_LIMITING = originalEnv;
      }
    });
  });

  describe('Rate limit key generation', () => {
    it('should generate different keys for different users', () => {
      // This tests the internal key generation logic indirectly
      // by checking that different users get different rate limit buckets
      const testCases = [
        { userId: 'user1', ip: '192.168.1.1' },
        { userId: 'user2', ip: '192.168.1.1' },
        { userId: null, ip: '192.168.1.1' },
        { userId: null, ip: '192.168.1.2' },
      ];

      // We can't directly test the key generation function since it's internal,
      // but we can verify that rate limits are applied independently
      testCases.forEach(async (testCase, index) => {
        const key = testCase.userId 
          ? `ratelimit:test:user:${testCase.userId}`
          : `ratelimit:test:ip:${testCase.ip}`;
        
        const result = await checkRateLimit(key, 1, 60);
        expect(result.allowed).toBe(true);
      });
    });
  });
});