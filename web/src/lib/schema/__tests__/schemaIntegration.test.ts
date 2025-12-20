/**
 * Schema Integration Tests
 * 
 * Tests for the GraphQL schema integration utilities.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaIntegration, checkSchemaCompatibility, getSchemaHealthStatus } from '../schemaIntegration.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('SchemaIntegration', () => {
  let schemaIntegration: SchemaIntegration;
  
  beforeEach(() => {
    schemaIntegration = new SchemaIntegration('http://localhost:3000/graphql');
    vi.clearAllMocks();
  });

  describe('fetchSchema', () => {
    it('should fetch schema successfully', async () => {
      const mockIntrospectionResult = {
        __schema: {
          queryType: { name: 'Query' },
          mutationType: { name: 'Mutation' },
          subscriptionType: { name: 'Subscription' },
          types: [
            { name: 'Query', kind: 'OBJECT' },
            { name: 'Mutation', kind: 'OBJECT' },
            { name: 'User', kind: 'OBJECT' },
          ],
          directives: [],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockIntrospectionResult,
        }),
      });

      const result = await schemaIntegration.fetchSchema();
      
      expect(result).toEqual(mockIntrospectionResult);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })
      );
    });

    it('should retry on failure', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              __schema: {
                queryType: { name: 'Query' },
                types: [],
                directives: [],
              },
            },
          }),
        });

      const result = await schemaIntegration.fetchSchema({
        retryAttempts: 2,
        retryDelay: 10,
      });

      expect(result).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(
        schemaIntegration.fetchSchema({
          retryAttempts: 2,
          retryDelay: 10,
        })
      ).rejects.toThrow('Network error');

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateSchema', () => {
    it('should validate a healthy schema', () => {
      const mockIntrospectionResult = {
        __schema: {
          queryType: { name: 'Query' },
          mutationType: { name: 'Mutation' },
          subscriptionType: { name: 'Subscription' },
          types: [
            {
              name: 'Query',
              kind: 'OBJECT',
              fields: [
                { name: 'users', type: { name: 'User' } },
                { name: 'courses', type: { name: 'Course' } },
              ],
            },
            {
              name: 'Mutation',
              kind: 'OBJECT',
              fields: [
                { name: 'createUser', type: { name: 'User' } },
                { name: 'updateUser', type: { name: 'User' } },
              ],
            },
            {
              name: 'Subscription',
              kind: 'OBJECT',
              fields: [
                { name: 'userUpdates', type: { name: 'User' } },
              ],
            },
            { name: 'User', kind: 'OBJECT', fields: [] },
            { name: 'Course', kind: 'OBJECT', fields: [] },
            { name: 'DateTime', kind: 'SCALAR' },
            { name: 'JSON', kind: 'SCALAR' },
            { name: 'Upload', kind: 'SCALAR' },
          ],
          directives: [],
        },
      };

      const result = schemaIntegration.validateSchema(mockIntrospectionResult);

      expect(result.valid).toBe(true);
      expect(result.health.score).toBeGreaterThan(70);
      expect(result.health.status).toBe('good');
      expect(result.stats.queries).toBe(2);
      expect(result.stats.mutations).toBe(2);
      expect(result.stats.subscriptions).toBe(1);
    });

    it('should detect placeholder operations', () => {
      const mockIntrospectionResult = {
        __schema: {
          queryType: { name: 'Query' },
          mutationType: null,
          subscriptionType: null,
          types: [
            {
              name: 'Query',
              kind: 'OBJECT',
              fields: [
                { name: '_empty', type: { name: 'String' } },
              ],
            },
          ],
          directives: [],
        },
      };

      const result = schemaIntegration.validateSchema(mockIntrospectionResult);

      expect(result.valid).toBe(true); // Still valid, but has warnings
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PLACEHOLDER_OPERATIONS',
          severity: 'warning',
        })
      );
      expect(result.health.score).toBeLessThan(50);
    });

    it('should detect missing required scalars', () => {
      const mockIntrospectionResult = {
        __schema: {
          queryType: { name: 'Query' },
          mutationType: null,
          subscriptionType: null,
          types: [
            {
              name: 'Query',
              kind: 'OBJECT',
              fields: [
                { name: 'test', type: { name: 'String' } },
              ],
            },
          ],
          directives: [],
        },
      };

      const result = schemaIntegration.validateSchema(mockIntrospectionResult);

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_SCALAR',
          severity: 'warning',
          message: 'Missing required scalar: DateTime',
        })
      );
    });
  });

  describe('synchronize', () => {
    it('should perform complete synchronization workflow', async () => {
      const mockIntrospectionResult = {
        __schema: {
          queryType: { name: 'Query' },
          mutationType: { name: 'Mutation' },
          subscriptionType: null,
          types: [
            {
              name: 'Query',
              kind: 'OBJECT',
              fields: [
                { name: 'users', type: { name: 'User' } },
              ],
            },
            {
              name: 'Mutation',
              kind: 'OBJECT',
              fields: [
                { name: 'createUser', type: { name: 'User' } },
              ],
            },
            { name: 'User', kind: 'OBJECT', fields: [] },
            { name: 'DateTime', kind: 'SCALAR' },
            { name: 'JSON', kind: 'SCALAR' },
            { name: 'Upload', kind: 'SCALAR' },
          ],
          directives: [],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: mockIntrospectionResult,
        }),
      });

      const result = await schemaIntegration.synchronize({
        validateBeforeUse: true,
      });

      expect(result.success).toBe(true);
      expect(result.schemaSDL).toContain('type Query');
      expect(result.schemaSDL).toContain('type Mutation');
      expect(result.validation).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle synchronization errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await schemaIntegration.synchronize({
        retryAttempts: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});

describe('checkSchemaCompatibility', () => {
  it('should detect identical schemas as compatible', () => {
    const schema = 'type Query { hello: String }';
    
    const result = checkSchemaCompatibility(schema, schema);
    
    expect(result.compatible).toBe(true);
    expect(result.breakingChanges).toHaveLength(0);
    expect(result.safeChanges).toHaveLength(0);
  });

  it('should detect schema changes', () => {
    const oldSchema = 'type Query { hello: String }';
    const newSchema = 'type Query { hello: String, world: String }';
    
    const result = checkSchemaCompatibility(oldSchema, newSchema);
    
    expect(result.compatible).toBe(false);
    expect(result.breakingChanges).toContain('Schema structure changed');
    expect(result.safeChanges).toContain('Schema updated');
  });
});

describe('getSchemaHealthStatus', () => {
  it('should return correct status for excellent health', () => {
    const validation = {
      valid: true,
      errors: [],
      stats: { types: 20, queries: 10, mutations: 5, subscriptions: 3 },
      health: {
        score: 95,
        status: 'excellent' as const,
        recommendations: [],
      },
    };

    const result = getSchemaHealthStatus(validation);

    expect(result.status).toBe('Excellent');
    expect(result.color).toBe('green');
    expect(result.message).toBe('Schema is in excellent condition');
  });

  it('should return correct status for poor health', () => {
    const validation = {
      valid: false,
      errors: [
        { message: 'Missing Query type', code: 'MISSING_QUERY_TYPE', severity: 'error' as const },
      ],
      stats: { types: 2, queries: 0, mutations: 0, subscriptions: 0 },
      health: {
        score: 20,
        status: 'poor' as const,
        recommendations: ['Fix schema parsing errors'],
      },
    };

    const result = getSchemaHealthStatus(validation);

    expect(result.status).toBe('Poor');
    expect(result.color).toBe('red');
    expect(result.message).toBe('Schema needs significant improvements');
  });
});