/**
 * CSRF Protection Middleware Tests
 * 
 * Tests CSRF token generation, validation, and protection mechanisms.
 * 
 * Requirements: 13.8
 */

import { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestServer } from '../../../__tests__/helpers/testServer.js';
import { generateCSRFToken } from '../csrf.js';

describe('CSRF Protection', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTestServer();
  });

  describe('generateCSRFToken', () => {
    it('should generate a valid base64url token', () => {
      const token = generateCSRFToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      // Should be valid base64url (no +, /, or = characters)
      expect(token).not.toMatch(/[+/=]/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      
      expect(token1).not.toBe(token2);
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

  describe('CSRF Protection for State-Changing Methods', () => {
    it('should allow GET requests without CSRF token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject POST requests without CSRF token', async () => {
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

    it('should reject POST requests without custom header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          origin: 'http://localhost:3001',
          referer: 'http://localhost:3001/test',
        },
        payload: { test: 'data' },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Missing required header: x-requested-with');
    });

    it('should reject POST requests without CSRF token header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          origin: 'http://localhost:3001',
          referer: 'http://localhost:3001/test',
          'x-requested-with': 'XMLHttpRequest',
        },
        payload: { test: 'data' },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Missing required header: x-csrf-token');
    });

    it('should reject POST requests with invalid CSRF token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          origin: 'http://localhost:3001',
          referer: 'http://localhost:3001/test',
          'x-requested-with': 'XMLHttpRequest',
          'x-csrf-token': 'invalid-token',
        },
        cookies: {
          'csrf-token': 'different-token',
        },
        payload: { test: 'data' },
      });

      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Invalid CSRF token');
    });
  });

  describe('Valid CSRF Request Flow', () => {
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

      // Add a test route that accepts POST
      server.post('/api/test', async (request, reply) => {
        return reply.send({ success: true });
      });

      // Now make a POST request with the CSRF token
      const response = await server.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          origin: 'http://localhost:3001',
          referer: 'http://localhost:3001/test',
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