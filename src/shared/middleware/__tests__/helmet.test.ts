/**
 * Test for security headers implementation using Fastify Helmet
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

describe('Security Headers (Helmet)', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });

    // Register helmet with the same configuration as in server.ts
    await server.register(helmet, {
      // Content Security Policy - comprehensive policy for production
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      
      // HTTP Strict Transport Security - enforce HTTPS for 1 year
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      
      // X-Content-Type-Options - prevent MIME type sniffing
      noSniff: true,
      
      // X-Frame-Options - prevent clickjacking attacks
      frameguard: {
        action: 'deny',
      },
      
      // X-XSS-Protection - enable XSS filtering
      xssFilter: true,
      
      // Referrer Policy - control referrer information
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      

    });

    // Add a test route
    server.get('/test', async () => {
      return { message: 'Security headers test' };
    });

    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should set Content Security Policy header', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("object-src 'none'");
    expect(response.headers['content-security-policy']).toContain("frame-src 'none'");
  });

  it('should set HSTS header with correct max-age', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
    expect(response.headers['strict-transport-security']).toContain('preload');
  });

  it('should set X-Content-Type-Options to nosniff', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should set X-Frame-Options to deny', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should set X-XSS-Protection header', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.headers['x-xss-protection']).toBeDefined();
    // Modern browsers disable XSS protection by default, so helmet sets it to '0'
    expect(response.headers['x-xss-protection']).toBe('0');
  });

  it('should set Referrer-Policy header', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });



  it('should return successful response with all security headers', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Security headers test' });
    
    // Verify core required security headers are present
    const coreRequiredHeaders = [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy'
    ];

    coreRequiredHeaders.forEach(header => {
      expect(response.headers[header]).toBeDefined();
    });
  });
});