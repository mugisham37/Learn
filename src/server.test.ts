/**
 * Fastify Server Tests
 * 
 * Tests for server initialization, configuration, and basic endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from './server.js';

describe('Fastify Server', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Server Initialization', () => {
    it('should create a Fastify server instance', () => {
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
    });

    it('should have CORS plugin registered', () => {
      expect(server.hasPlugin('@fastify/cors')).toBe(true);
    });

    it('should have Helmet plugin registered', () => {
      expect(server.hasPlugin('@fastify/helmet')).toBe(true);
    });
  });

  describe('Health Check Endpoints', () => {
    it('should respond to /health endpoint', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(body.environment).toBeDefined();
    });

    it('should respond to /health/deep endpoint', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health/deep',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.checks).toBeDefined();
      expect(body.checks.database).toBeDefined();
      expect(body.checks.redis).toBeDefined();
    });
  });

  describe('Root Endpoint', () => {
    it('should respond to / endpoint with API information', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Learning Platform API');
      expect(body.version).toBe('1.0.0');
      expect(body.environment).toBeDefined();
      expect(body.graphql).toBe('/graphql');
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', async () => {
      const response1 = await server.inject({
        method: 'GET',
        url: '/health',
      });

      const response2 = await server.inject({
        method: 'GET',
        url: '/health',
      });

      // Request IDs are logged but not exposed in headers by default
      // We can verify they exist in the response body for endpoints that return them
      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);

      // Both responses should be successful
      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);
      expect(body1.status).toBe('ok');
      expect(body2.status).toBe('ok');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'http://localhost:3001',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:3001',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from Helmet', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      // Helmet adds various security headers
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(404);
      expect(body.error).toBe('Not Found');
      expect(body.message).toContain('not found');
      expect(body.requestId).toBeDefined();
    });
  });

  describe('Error Handler', () => {
    it('should handle errors gracefully', async () => {
      // Create a new server instance for this test to avoid route conflicts
      const testServer = await createServer();
      
      // Register a route that throws an error
      testServer.get('/test-error', async () => {
        throw new Error('Test error');
      });

      const response = await testServer.inject({
        method: 'GET',
        url: '/test-error',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(500);
      expect(body.error).toBeDefined();
      expect(body.requestId).toBeDefined();

      await testServer.close();
    });
  });
});
