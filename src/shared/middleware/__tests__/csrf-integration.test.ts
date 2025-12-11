/**
 * CSRF Protection Integration Tests
 * 
 * Tests CSRF protection integration with Fastify server.
 * 
 * Requirements: 13.8
 */

import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';

import { config } from '../../../config/index.js';
import { registerCSRFProtection } from '../csrf.js';

describe('CSRF Protection Integration', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify({
      logger: false,
    });

    // Register CSRF protection
    await registerCSRFProtection(server);

    // Add a test route
    server.post('/api/test', async (request, reply) => {
      return reply.send({ success: true });
    });
  });

  describe('CSRF Token Endpoint', () => {
    it('should provide CSRF token endpoint', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/csrf-token',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('csrfToken');
      expect(typeof body.csrfToken).toBe('string');
      expect(body.csrfToken.length).toBeGreaterThan(0);
      
      // Should set cookie
      const cookies = response.cookies;
      expect(cookies).toBeDefined();
      expect(cookies.length).toBeGreaterThan(0);
      
      const csrfCookie = cookies.find(cookie => cookie.name === 'csrf-token');
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie?.httpOnly).toBe(true);
      expect(csrfCookie?.sameSite).toBe('Strict');
    });
  });

  describe('CSRF Protection Validation', () => {
    it('should reject POST requests without proper headers', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/test',
        payload: { test: 'data' },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Invalid or missing origin header');
    });

    it('should reject POST requests with invalid origin', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          origin: 'https://malicious-site.com',
        },
        payload: { test: 'data' },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Invalid or missing origin header');
    });

    it('should allow valid POST request with proper CSRF token', async () => {
      // First, get a CSRF token
      const tokenResponse = await server.inject({
        method: 'GET',
        url: '/api/csrf-token',
      });

      expect(tokenResponse.statusCode).toBe(200);
      
      const tokenBody = JSON.parse(tokenResponse.body);
      const csrfToken = tokenBody.csrfToken;
      
      const csrfCookie = tokenResponse.cookies.find(cookie => cookie.name === 'csrf-token');
      expect(csrfCookie).toBeDefined();

      // Now make a POST request with the CSRF token
      const response = await server.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          origin: config.cors.origin[0] || 'http://localhost:3001',
          referer: (config.cors.origin[0] || 'http://localhost:3001') + '/test',
          'x-requested-with': 'XMLHttpRequest',
          'x-csrf-token': csrfToken,
        },
        cookies: {
          'csrf-token': csrfCookie!.value,
        },
        payload: { test: 'data' },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });
});