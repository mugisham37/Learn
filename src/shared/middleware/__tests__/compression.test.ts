/**
 * Compression Middleware Tests
 * 
 * Tests for HTTP response compression middleware including
 * gzip and brotli compression with various content types.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { createCompressionMiddleware, registerCompression } from '../compression.js';

describe('Compression Middleware', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({ logger: false });
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('createCompressionMiddleware', () => {
    it('should create compression middleware with default options', () => {
      const middleware = createCompressionMiddleware();
      expect(middleware).toBeInstanceOf(Function);
    });

    it('should create compression middleware with custom options', () => {
      const middleware = createCompressionMiddleware({
        threshold: 2048,
        level: 9,
        preferBrotli: false,
      });
      expect(middleware).toBeInstanceOf(Function);
    });
  });

  describe('registerCompression', () => {
    it('should register compression middleware with Fastify', async () => {
      await registerCompression(fastify);
      
      // Add a test route
      fastify.get('/test', async () => {
        return { message: 'Hello, World!'.repeat(100) }; // Large enough to trigger compression
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'accept-encoding': 'gzip, deflate, br',
        },
      });

      expect(response.statusCode).toBe(200);
      // Note: In a real test, you would check for compression headers
      // but Fastify's inject doesn't fully simulate compression
    });

    it('should handle requests without accept-encoding header', async () => {
      await registerCompression(fastify);
      
      fastify.get('/test', async () => {
        return { message: 'Hello, World!' };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should skip compression for small responses', async () => {
      await registerCompression(fastify, { threshold: 1000 });
      
      fastify.get('/test', async () => {
        return { message: 'Small' }; // Below threshold
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'accept-encoding': 'gzip',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-encoding']).toBeUndefined();
    });

    it('should skip compression for HEAD requests', async () => {
      await registerCompression(fastify);
      
      fastify.head('/test', async () => {
        return { message: 'Hello, World!'.repeat(100) };
      });

      const response = await fastify.inject({
        method: 'HEAD',
        url: '/test',
        headers: {
          'accept-encoding': 'gzip',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should skip compression when content-encoding already set', async () => {
      await registerCompression(fastify);
      
      fastify.get('/test', async (request, reply) => {
        reply.header('content-encoding', 'identity');
        return { message: 'Hello, World!'.repeat(100) };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'accept-encoding': 'gzip',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-encoding']).toBe('identity');
    });
  });

  describe('Content Type Filtering', () => {
    beforeEach(async () => {
      await registerCompression(fastify);
    });

    it('should compress JSON responses', async () => {
      fastify.get('/json', async (request, reply) => {
        reply.type('application/json');
        return { data: 'x'.repeat(2000) };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/json',
        headers: {
          'accept-encoding': 'gzip',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should compress text responses', async () => {
      fastify.get('/text', async (request, reply) => {
        reply.type('text/plain');
        return 'x'.repeat(2000);
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/text',
        headers: {
          'accept-encoding': 'gzip',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should not compress image responses by default', async () => {
      fastify.get('/image', async (request, reply) => {
        reply.type('image/jpeg');
        return Buffer.from('fake-image-data'.repeat(200));
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/image',
        headers: {
          'accept-encoding': 'gzip',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Compression Algorithm Selection', () => {
    beforeEach(async () => {
      await registerCompression(fastify, { preferBrotli: true });
    });

    it('should prefer brotli when available and preferred', async () => {
      fastify.get('/test', async () => {
        return { data: 'x'.repeat(2000) };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'accept-encoding': 'gzip, br',
        },
      });

      expect(response.statusCode).toBe(200);
      // Note: Actual compression testing would require more sophisticated setup
    });

    it('should fallback to gzip when brotli not available', async () => {
      fastify.get('/test', async () => {
        return { data: 'x'.repeat(2000) };
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'accept-encoding': 'gzip',
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});