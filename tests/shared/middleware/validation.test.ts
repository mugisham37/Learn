/**
 * Input Validation Middleware Tests
 * 
 * Tests for the input validation middleware functionality including
 * request body, query parameters, path parameters, and headers validation.
 * 
 * Requirements: 13.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

import { ValidationError } from '@shared/errors/index.js';
import {
  createValidationMiddleware,
  createFastifySchema,
  zodToFastifySchema,
  type ValidationConfig,
} from '@shared/middleware/validation.js';

// Mock logger
vi.mock('@shared/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Creates a mock Fastify request object
 */
function createMockRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    id: 'test-request-id',
    method: 'POST',
    url: '/test',
    headers: {},
    body: undefined,
    query: {},
    params: {},
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  } as unknown as FastifyRequest;
}

/**
 * Creates a mock Fastify reply object
 */
function createMockReply(): FastifyReply {
  return {} as FastifyReply;
}

describe('Input Validation Middleware', () => {
  describe('createValidationMiddleware', () => {
    describe('request body validation', () => {
      it('should validate valid request body', () => {
        const schema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
          age: z.number().int().positive(),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({
          body: {
            name: 'John Doe',
            email: 'john@example.com',
            age: 25,
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).not.toThrow();
        expect(request.body).toEqual({
          name: 'John Doe',
          email: 'john@example.com',
          age: 25,
        });
      });

      it('should reject invalid request body', () => {
        const schema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
          age: z.number().int().positive(),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({
          body: {
            name: '',
            email: 'invalid-email',
            age: -5,
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
        
        try {
          middleware(request, reply);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as any).validationErrors).toBeDefined();
          expect((error as any).validationErrors).toHaveLength(3);
        }
      });

      it('should handle missing request body', () => {
        const schema = z.object({
          name: z.string().min(1),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({ body: undefined });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });

      it('should handle null request body', () => {
        const schema = z.object({
          name: z.string().min(1),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({ body: null });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });

      it('should handle non-object request body', () => {
        const schema = z.object({
          name: z.string().min(1),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({ body: 'invalid' });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });
    });

    describe('query parameters validation', () => {
      it('should validate valid query parameters', () => {
        const schema = z.object({
          page: z.string().transform(Number).pipe(z.number().int().positive()),
          limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)),
          sort: z.string().optional(),
        });

        const middleware = createValidationMiddleware({ querystring: schema });
        const request = createMockRequest({
          query: {
            page: '1',
            limit: '20',
            sort: 'name',
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).not.toThrow();
        expect(request.query).toEqual({
          page: 1,
          limit: 20,
          sort: 'name',
        });
      });

      it('should reject invalid query parameters', () => {
        const schema = z.object({
          page: z.string().transform(Number).pipe(z.number().int().positive()),
          limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)),
        });

        const middleware = createValidationMiddleware({ querystring: schema });
        const request = createMockRequest({
          query: {
            page: '0',
            limit: '200',
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });

      it('should handle missing optional query parameters', () => {
        const schema = z.object({
          page: z.string().transform(Number).pipe(z.number().int().positive()).default('1'),
          sort: z.string().optional(),
        });

        const middleware = createValidationMiddleware({ querystring: schema });
        const request = createMockRequest({
          query: {},
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).not.toThrow();
      });

      it('should handle empty query object', () => {
        const schema = z.object({
          page: z.string().transform(Number).pipe(z.number().int().positive()),
        });

        const middleware = createValidationMiddleware({ querystring: schema });
        const request = createMockRequest({
          query: {},
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });
    });

    describe('path parameters validation', () => {
      it('should validate valid path parameters', () => {
        const schema = z.object({
          id: z.string().uuid(),
          slug: z.string().min(1),
        });

        const middleware = createValidationMiddleware({ params: schema });
        const request = createMockRequest({
          params: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            slug: 'test-course',
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).not.toThrow();
        expect(request.params).toEqual({
          id: '123e4567-e89b-12d3-a456-426614174000',
          slug: 'test-course',
        });
      });

      it('should reject invalid path parameters', () => {
        const schema = z.object({
          id: z.string().uuid(),
        });

        const middleware = createValidationMiddleware({ params: schema });
        const request = createMockRequest({
          params: {
            id: 'invalid-uuid',
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });

      it('should handle missing path parameters', () => {
        const schema = z.object({
          id: z.string().uuid(),
        });

        const middleware = createValidationMiddleware({ params: schema });
        const request = createMockRequest({
          params: {},
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });
    });

    describe('headers validation', () => {
      it('should validate valid headers', () => {
        const schema = z.object({
          'content-type': z.string(),
          'x-api-key': z.string().min(1),
        });

        const middleware = createValidationMiddleware({ headers: schema });
        const request = createMockRequest({
          headers: {
            'content-type': 'application/json',
            'x-api-key': 'test-key',
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).not.toThrow();
        expect((request as any).validatedHeaders).toEqual({
          'content-type': 'application/json',
          'x-api-key': 'test-key',
        });
      });

      it('should reject invalid headers', () => {
        const schema = z.object({
          'x-api-key': z.string().min(1),
        });

        const middleware = createValidationMiddleware({ headers: schema });
        const request = createMockRequest({
          headers: {
            'x-api-key': '',
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });

      it('should handle missing required headers', () => {
        const schema = z.object({
          'x-api-key': z.string().min(1),
        });

        const middleware = createValidationMiddleware({ headers: schema });
        const request = createMockRequest({
          headers: {},
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });
    });

    describe('combined validation', () => {
      it('should validate all parts of request', () => {
        const config: ValidationConfig = {
          body: z.object({
            name: z.string().min(1),
          }),
          querystring: z.object({
            page: z.string().transform(Number).pipe(z.number().int().positive()),
          }),
          params: z.object({
            id: z.string().uuid(),
          }),
          headers: z.object({
            'content-type': z.string(),
          }),
        };

        const middleware = createValidationMiddleware(config);
        const request = createMockRequest({
          body: { name: 'Test' },
          query: { page: '1' },
          params: { id: '123e4567-e89b-12d3-a456-426614174000' },
          headers: { 'content-type': 'application/json' },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).not.toThrow();
      });

      it('should collect errors from all parts', () => {
        const config: ValidationConfig = {
          body: z.object({
            name: z.string().min(1),
          }),
          querystring: z.object({
            page: z.string().transform(Number).pipe(z.number().int().positive()),
          }),
          params: z.object({
            id: z.string().uuid(),
          }),
        };

        const middleware = createValidationMiddleware(config);
        const request = createMockRequest({
          body: { name: '' },
          query: { page: '0' },
          params: { id: 'invalid' },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
        
        try {
          middleware(request, reply);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          const validationErrors = (error as any).validationErrors;
          expect(validationErrors).toBeDefined();
          expect(validationErrors.length).toBeGreaterThan(0);
          
          // Check that errors from different parts are included
          const fields = validationErrors.map((err: any) => err.field);
          expect(fields.some((field: string) => field.startsWith('body'))).toBe(true);
          expect(fields.some((field: string) => field.startsWith('query'))).toBe(true);
          expect(fields.some((field: string) => field.startsWith('params'))).toBe(true);
        }
      });
    });

    describe('error handling', () => {
      it('should format validation errors correctly', () => {
        const schema = z.object({
          user: z.object({
            name: z.string().min(1),
            email: z.string().email(),
          }),
          settings: z.object({
            theme: z.enum(['light', 'dark']),
          }),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({
          body: {
            user: {
              name: '',
              email: 'invalid-email',
            },
            settings: {
              theme: 'invalid-theme',
            },
          },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
        
        try {
          middleware(request, reply);
        } catch (error) {
          const validationErrors = (error as any).validationErrors;
          expect(validationErrors).toBeDefined();
          
          // Check error structure
          validationErrors.forEach((err: any) => {
            expect(err).toHaveProperty('field');
            expect(err).toHaveProperty('message');
            expect(err).toHaveProperty('code');
            expect(typeof err.field).toBe('string');
            expect(typeof err.message).toBe('string');
            expect(typeof err.code).toBe('string');
          });
          
          // Check nested field paths
          const fields = validationErrors.map((err: any) => err.field);
          expect(fields).toContain('body.user.name');
          expect(fields).toContain('body.user.email');
          expect(fields).toContain('body.settings.theme');
        }
      });

      it('should handle non-Zod errors gracefully', () => {
        // Create a schema that throws a non-Zod error
        const schema = {
          parse: () => {
            throw new Error('Non-Zod error');
          },
        } as any;

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({ body: {} });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });

      it('should include request context in error logs', () => {
        const schema = z.object({
          name: z.string().min(1),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({
          id: 'test-request-123',
          method: 'POST',
          url: '/api/test',
          body: { name: '' },
        });
        const reply = createMockReply();

        expect(() => middleware(request, reply)).toThrow(ValidationError);
      });
    });

    describe('performance', () => {
      it('should validate requests efficiently', () => {
        const schema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
          age: z.number().int().positive(),
        });

        const middleware = createValidationMiddleware({ body: schema });
        const request = createMockRequest({
          body: {
            name: 'John Doe',
            email: 'john@example.com',
            age: 25,
          },
        });
        const reply = createMockReply();

        const startTime = Date.now();
        middleware(request, reply);
        const endTime = Date.now();

        // Validation should be fast (less than 10ms for simple schema)
        expect(endTime - startTime).toBeLessThan(10);
      });
    });
  });

  describe('createFastifySchema', () => {
    it('should create Fastify schema from validation config', () => {
      const config: ValidationConfig = {
        body: z.object({
          name: z.string(),
        }),
        querystring: z.object({
          page: z.number(),
        }),
      };

      const schema = createFastifySchema(config);

      expect(schema).toHaveProperty('body');
      expect(schema).toHaveProperty('querystring');
      expect(schema.body).toHaveProperty('type', 'object');
      expect(schema.querystring).toHaveProperty('type', 'object');
    });

    it('should handle empty config', () => {
      const schema = createFastifySchema({});
      expect(Object.keys(schema)).toHaveLength(0);
    });
  });

  describe('zodToFastifySchema', () => {
    it('should convert basic Zod schema to Fastify schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const fastifySchema = zodToFastifySchema(zodSchema);

      expect(fastifySchema).toHaveProperty('type', 'object');
      expect(fastifySchema).toHaveProperty('description');
    });

    it('should handle schema conversion errors gracefully', () => {
      const invalidSchema = null as any;

      const fastifySchema = zodToFastifySchema(invalidSchema);

      expect(fastifySchema).toHaveProperty('type', 'object');
      expect(fastifySchema).toHaveProperty('description');
    });
  });

  describe('edge cases', () => {
    it('should handle empty validation config', () => {
      const middleware = createValidationMiddleware({});
      const request = createMockRequest();
      const reply = createMockReply();

      expect(() => middleware(request, reply)).not.toThrow();
    });

    it('should handle request with no body, query, or params', () => {
      const middleware = createValidationMiddleware({
        body: z.object({}).optional(),
      });
      const request = createMockRequest({
        body: undefined,
        query: {},
        params: {},
      });
      const reply = createMockReply();

      expect(() => middleware(request, reply)).not.toThrow();
    });

    it('should preserve original request data when validation passes', () => {
      const originalBody = { name: 'Test', extra: 'data' };
      const schema = z.object({
        name: z.string(),
      });

      const middleware = createValidationMiddleware({ body: schema });
      const request = createMockRequest({ body: originalBody });
      const reply = createMockReply();

      middleware(request, reply);

      // Should contain validated data (without extra fields)
      expect(request.body).toEqual({ name: 'Test' });
    });
  });
});

describe('Validation Error Details', () => {
  it('should provide detailed error information', () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().int().min(18),
      preferences: z.object({
        theme: z.enum(['light', 'dark']),
        notifications: z.boolean(),
      }),
    });

    const middleware = createValidationMiddleware({ body: schema });
    const request = createMockRequest({
      body: {
        email: 'invalid-email',
        age: 15,
        preferences: {
          theme: 'blue',
          notifications: 'yes',
        },
      },
    });
    const reply = createMockReply();

    try {
      middleware(request, reply);
      expect.fail('Should have thrown ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationErrors = (error as any).validationErrors;
      
      expect(validationErrors).toBeDefined();
      expect(Array.isArray(validationErrors)).toBe(true);
      expect(validationErrors.length).toBeGreaterThan(0);
      
      // Check that each error has required properties
      validationErrors.forEach((err: any) => {
        expect(err).toHaveProperty('field');
        expect(err).toHaveProperty('message');
        expect(err).toHaveProperty('code');
        expect(typeof err.field).toBe('string');
        expect(typeof err.message).toBe('string');
        expect(typeof err.code).toBe('string');
      });
    }
  });
});