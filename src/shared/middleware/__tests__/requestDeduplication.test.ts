/**
 * Request Deduplication Middleware Tests
 *
 * Tests for request deduplication functionality including fingerprint generation,
 * response caching, and duplicate request handling.
 *
 * Requirements: 15.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import fastify from 'fastify';

import { cache } from '../../../infrastructure/cache/index.js';
import {
  createRequestDeduplicationMiddleware,
  standardRequestDeduplication,
  aggressiveRequestDeduplication,
  conservativeRequestDeduplication,
  getDeduplicationStats,
  clearDeduplicationCache,
  registerRequestDeduplication,
} from '../requestDeduplication.js';

describe('Request Deduplication Middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = fastify({ logger: false });

    // Clear cache before each test
    await clearDeduplicationCache();
  });

  afterEach(async () => {
    await app.close();
    await clearDeduplicationCache();
  });

  describe('createRequestDeduplicationMiddleware', () => {
    it('should create middleware with default options', () => {
      const middleware = createRequestDeduplicationMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware with custom options', () => {
      const middleware = createRequestDeduplicationMiddleware({
        cacheTtlSeconds: 60,
        includeHeaders: true,
        keyPrefix: 'custom',
      });
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Request Fingerprinting', () => {
    it('should generate same fingerprint for identical GET requests', async () => {
      const middleware = createRequestDeduplicationMiddleware();

      app.addHook('preHandler', middleware);

      let fingerprint1: string;
      let fingerprint2: string;

      app.get('/test', async (request, reply) => {
        // Access the fingerprint from the middleware (would need to expose it for testing)
        return { message: 'test' };
      });

      // Make two identical requests
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      // Second response should be cached
      expect(response2.headers['x-cache']).toBe('HIT');
    });

    it('should generate different fingerprints for different requests', async () => {
      const middleware = createRequestDeduplicationMiddleware();

      app.addHook('preHandler', middleware);

      app.get('/test1', async () => ({ message: 'test1' }));
      app.get('/test2', async () => ({ message: 'test2' }));

      const response1 = await app.inject({
        method: 'GET',
        url: '/test1',
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/test2',
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      // Both should be cache misses since they're different requests
      expect(response1.headers['x-cache']).toBe('MISS');
      expect(response2.headers['x-cache']).toBe('MISS');
    });

    it('should include request body in fingerprint for POST requests when enabled', async () => {
      const middleware = createRequestDeduplicationMiddleware({
        enabled: () => true, // Enable for all methods
      });

      app.addHook('preHandler', middleware);

      app.post('/test', async (request) => {
        return { received: request.body };
      });

      const response1 = await app.inject({
        method: 'POST',
        url: '/test',
        payload: { data: 'test1' },
      });

      const response2 = await app.inject({
        method: 'POST',
        url: '/test',
        payload: { data: 'test1' }, // Same payload
      });

      const response3 = await app.inject({
        method: 'POST',
        url: '/test',
        payload: { data: 'test2' }, // Different payload
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      expect(response3.statusCode).toBe(200);

      // Second request should be cached (same payload)
      expect(response2.headers['x-cache']).toBe('HIT');

      // Third request should be a miss (different payload)
      expect(response3.headers['x-cache']).toBe('MISS');
    });
  });

  describe('Response Caching', () => {
    it('should cache successful responses', async () => {
      const middleware = createRequestDeduplicationMiddleware({
        cacheTtlSeconds: 60,
      });

      app.addHook('preHandler', middleware);

      let callCount = 0;
      app.get('/test', async () => {
        callCount++;
        return { message: 'test', callCount };
      });

      // First request
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
      });

      // Second request (should be cached)
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      // Handler should only be called once
      expect(callCount).toBe(1);
      expect(body1.callCount).toBe(1);
      expect(body2.callCount).toBe(1); // Same as first response

      // Headers should indicate cache status
      expect(response1.headers['x-cache']).toBe('MISS');
      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.headers['x-cache-timestamp']).toBeDefined();
    });

    it('should not cache error responses', async () => {
      const middleware = createRequestDeduplicationMiddleware();

      app.addHook('preHandler', middleware);

      let callCount = 0;
      app.get('/test', async () => {
        callCount++;
        throw new Error('Test error');
      });

      // First request (should fail)
      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
      });

      // Second request (should also fail, not cached)
      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response1.statusCode).toBe(500);
      expect(response2.statusCode).toBe(500);

      // Handler should be called twice (errors not cached)
      expect(callCount).toBe(2);

      // No cache headers on error responses
      expect(response1.headers['x-cache']).toBeUndefined();
      expect(response2.headers['x-cache']).toBeUndefined();
    });
  });

  describe('Method Filtering', () => {
    it('should only deduplicate safe methods by default', async () => {
      const middleware = createRequestDeduplicationMiddleware();

      app.addHook('preHandler', middleware);

      let getCallCount = 0;
      let postCallCount = 0;

      app.get('/test', async () => {
        getCallCount++;
        return { method: 'GET', callCount: getCallCount };
      });

      app.post('/test', async () => {
        postCallCount++;
        return { method: 'POST', callCount: postCallCount };
      });

      // GET requests should be deduplicated
      await app.inject({ method: 'GET', url: '/test' });
      const getResponse2 = await app.inject({ method: 'GET', url: '/test' });

      // POST requests should not be deduplicated
      await app.inject({ method: 'POST', url: '/test' });
      const postResponse2 = await app.inject({ method: 'POST', url: '/test' });

      expect(getCallCount).toBe(1); // GET deduplicated
      expect(postCallCount).toBe(2); // POST not deduplicated

      expect(getResponse2.headers['x-cache']).toBe('HIT');
      expect(postResponse2.headers['x-cache']).toBeUndefined();
    });

    it('should respect custom enabled function', async () => {
      const middleware = createRequestDeduplicationMiddleware({
        enabled: (request) => request.url.includes('cacheable'),
      });

      app.addHook('preHandler', middleware);

      let cacheableCallCount = 0;
      let nonCacheableCallCount = 0;

      app.get('/cacheable', async () => {
        cacheableCallCount++;
        return { callCount: cacheableCallCount };
      });

      app.get('/non-cacheable', async () => {
        nonCacheableCallCount++;
        return { callCount: nonCacheableCallCount };
      });

      // Cacheable endpoint
      await app.inject({ method: 'GET', url: '/cacheable' });
      const cacheableResponse2 = await app.inject({ method: 'GET', url: '/cacheable' });

      // Non-cacheable endpoint
      await app.inject({ method: 'GET', url: '/non-cacheable' });
      await app.inject({ method: 'GET', url: '/non-cacheable' });

      expect(cacheableCallCount).toBe(1); // Deduplicated
      expect(nonCacheableCallCount).toBe(2); // Not deduplicated

      expect(cacheableResponse2.headers['x-cache']).toBe('HIT');
    });
  });

  describe('Header Inclusion', () => {
    it('should include headers in fingerprint when enabled', async () => {
      const middleware = createRequestDeduplicationMiddleware({
        includeHeaders: true,
        headersToInclude: ['authorization'],
      });

      app.addHook('preHandler', middleware);

      let callCount = 0;
      app.get('/test', async () => {
        callCount++;
        return { callCount };
      });

      // Same request with different authorization headers
      await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer token1' },
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer token2' },
      });

      // Should be treated as different requests due to different auth headers
      expect(callCount).toBe(2);
      expect(response2.headers['x-cache']).toBe('MISS');
    });
  });

  describe('Pre-configured Middlewares', () => {
    it('should provide standard deduplication middleware', () => {
      expect(typeof standardRequestDeduplication).toBe('function');
    });

    it('should provide aggressive deduplication middleware', () => {
      expect(typeof aggressiveRequestDeduplication).toBe('function');
    });

    it('should provide conservative deduplication middleware', () => {
      expect(typeof conservativeRequestDeduplication).toBe('function');
    });
  });

  describe('Statistics and Management', () => {
    it('should provide deduplication statistics', async () => {
      const stats = await getDeduplicationStats();

      expect(stats).toHaveProperty('totalCachedResponses');
      expect(stats).toHaveProperty('activeLocks');
      expect(typeof stats.totalCachedResponses).toBe('number');
      expect(typeof stats.activeLocks).toBe('number');
    });

    it('should clear deduplication cache', async () => {
      // Add some cached data first
      await cache.set('req_dedup:response:test', { test: 'data' }, 60);

      const deletedCount = await clearDeduplicationCache();

      expect(typeof deletedCount).toBe('number');

      // Verify cache is cleared
      const cachedData = await cache.get('req_dedup:response:test');
      expect(cachedData).toBeNull();
    });
  });

  describe('Global Registration', () => {
    it('should register middleware globally', async () => {
      const testApp = fastify({ logger: false });

      registerRequestDeduplication(testApp, {
        cacheTtlSeconds: 30,
      });

      let callCount = 0;
      testApp.get('/test', async () => {
        callCount++;
        return { callCount };
      });

      await testApp.ready();

      // Make duplicate requests
      await testApp.inject({ method: 'GET', url: '/test' });
      const response2 = await testApp.inject({ method: 'GET', url: '/test' });

      expect(callCount).toBe(1);
      expect(response2.headers['x-cache']).toBe('HIT');

      await testApp.close();
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent duplicate requests correctly', async () => {
      const middleware = createRequestDeduplicationMiddleware();

      app.addHook('preHandler', middleware);

      let callCount = 0;
      app.get('/slow', async () => {
        callCount++;
        // Simulate slow operation
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { callCount };
      });

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => app.inject({ method: 'GET', url: '/slow' }));

      const responses = await Promise.all(promises);

      // Handler should only be called once
      expect(callCount).toBe(1);

      // All responses should have the same body
      const bodies = responses.map((r) => JSON.parse(r.body));
      bodies.forEach((body) => {
        expect(body.callCount).toBe(1);
      });

      // First response should be a miss, others should be hits or coordinated
      const cacheStatuses = responses.map((r) => r.headers['x-cache']);
      expect(cacheStatuses.filter((status) => status === 'MISS')).toHaveLength(1);
    });
  });
});
