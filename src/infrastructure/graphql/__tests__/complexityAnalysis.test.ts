/**
 * GraphQL Complexity Analysis Tests
 *
 * Tests for GraphQL query complexity analysis functionality
 *
 * Requirements: 15.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createComplexityAnalysisRule,
  getComplexityConfig,
  COMPLEXITY_LIMITS,
} from '../complexityAnalysis.js';
import { complexityMonitor } from '../complexityMonitoring.js';
import { validate, parse, buildSchema } from 'graphql';

// Simple test schema
const testSchema = buildSchema(`
  type Query {
    user(id: ID!): User
    users(first: Int): [User!]!
    courses(first: Int): [Course!]!
    searchCourses(query: String!, first: Int): [Course!]!
  }

  type User {
    id: ID!
    name: String!
    courses: [Course!]!
  }

  type Course {
    id: ID!
    title: String!
    instructor: User!
    modules: [Module!]!
  }

  type Module {
    id: ID!
    title: String!
    lessons: [Lesson!]!
  }

  type Lesson {
    id: ID!
    title: String!
    content: String!
  }
`);

describe('GraphQL Complexity Analysis', () => {
  beforeEach(() => {
    // Clear metrics before each test
    complexityMonitor.clearMetrics();
  });

  afterEach(() => {
    // Clean up after each test
    complexityMonitor.clearMetrics();
  });

  describe('getComplexityConfig', () => {
    it('should return development config by default', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const config = getComplexityConfig();

      expect(config.maximumComplexity).toBeGreaterThan(0);
      expect(config.maximumDepth).toBeGreaterThan(0);

      process.env.NODE_ENV = originalEnv;
    });

    it('should return production config for production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const config = getComplexityConfig();

      expect(config.maximumComplexity).toBe(COMPLEXITY_LIMITS.production.maximumComplexity);
      expect(config.maximumDepth).toBe(COMPLEXITY_LIMITS.production.maximumDepth);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createComplexityAnalysisRule', () => {
    it('should allow simple queries under complexity limit', () => {
      const rule = createComplexityAnalysisRule({ maximumComplexity: 100 });

      const query = parse(`
        query {
          user(id: "1") {
            id
            name
          }
        }
      `);

      const errors = validate(testSchema, query, [rule]);
      expect(errors).toHaveLength(0);
    });

    it('should reject queries exceeding complexity limit', () => {
      const rule = createComplexityAnalysisRule({ maximumComplexity: 5 });

      const complexQuery = parse(`
        query {
          users(first: 100) {
            id
            name
            courses {
              id
              title
              instructor {
                id
                name
              }
              modules {
                id
                title
                lessons {
                  id
                  title
                  content
                }
              }
            }
          }
        }
      `);

      const errors = validate(testSchema, complexQuery, [rule]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Query complexity limit exceeded');
    });

    it('should handle queries with pagination arguments', () => {
      const rule = createComplexityAnalysisRule({ maximumComplexity: 1000 });

      const query = parse(`
        query {
          users(first: 10) {
            id
            name
          }
        }
      `);

      const errors = validate(testSchema, query, [rule]);
      expect(errors).toHaveLength(0);
    });

    it('should assign higher complexity to search operations', () => {
      const rule = createComplexityAnalysisRule({ maximumComplexity: 30 });

      const searchQuery = parse(`
        query {
          searchCourses(query: "test", first: 10) {
            id
            title
          }
        }
      `);

      const errors = validate(testSchema, searchQuery, [rule]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Query complexity limit exceeded');
    });
  });

  describe('complexity monitoring', () => {
    it('should track complexity statistics', () => {
      // Initially no metrics
      const initialStats = complexityMonitor.getComplexityStats();
      expect(initialStats.totalQueries).toBe(0);

      // Add some test metrics
      complexityMonitor.logComplexity({
        query: 'test query 1',
        complexity: 50,
        timestamp: new Date(),
        operationName: 'TestQuery1',
      });

      complexityMonitor.logComplexity({
        query: 'test query 2',
        complexity: 100,
        timestamp: new Date(),
        operationName: 'TestQuery2',
      });

      const stats = complexityMonitor.getComplexityStats();
      expect(stats.totalQueries).toBe(2);
      expect(stats.averageComplexity).toBe(75);
      expect(stats.maxComplexity).toBe(100);
      expect(stats.minComplexity).toBe(50);
    });

    it('should return top complex queries', () => {
      // Add test metrics with different complexities
      const queries = [
        { query: 'query1', complexity: 100 },
        { query: 'query2', complexity: 200 },
        { query: 'query3', complexity: 50 },
        { query: 'query4', complexity: 150 },
      ];

      queries.forEach(({ query, complexity }) => {
        complexityMonitor.logComplexity({
          query,
          complexity,
          timestamp: new Date(),
        });
      });

      const topQueries = complexityMonitor.getTopComplexQueries(2);
      expect(topQueries).toHaveLength(2);
      expect(topQueries[0].complexity).toBe(200);
      expect(topQueries[1].complexity).toBe(150);
    });

    it('should filter queries by user', () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      // Add metrics for different users
      complexityMonitor.logComplexity({
        query: 'query1',
        complexity: 100,
        userId: userId1,
        timestamp: new Date(),
      });

      complexityMonitor.logComplexity({
        query: 'query2',
        complexity: 200,
        userId: userId2,
        timestamp: new Date(),
      });

      complexityMonitor.logComplexity({
        query: 'query3',
        complexity: 150,
        userId: userId1,
        timestamp: new Date(),
      });

      const user1Queries = complexityMonitor.getQueriesByUser(userId1);
      expect(user1Queries).toHaveLength(2);
      expect(user1Queries.every((q) => q.userId === userId1)).toBe(true);

      const user2Queries = complexityMonitor.getQueriesByUser(userId2);
      expect(user2Queries).toHaveLength(1);
      expect(user2Queries[0].userId).toBe(userId2);
    });

    it('should clear metrics', () => {
      // Add some metrics
      complexityMonitor.logComplexity({
        query: 'test query',
        complexity: 100,
        timestamp: new Date(),
      });

      expect(complexityMonitor.getComplexityStats().totalQueries).toBe(1);

      // Clear metrics
      complexityMonitor.clearMetrics();

      expect(complexityMonitor.getComplexityStats().totalQueries).toBe(0);
    });
  });

  describe('environment configuration', () => {
    it('should use environment-specific limits', () => {
      const originalEnv = process.env.NODE_ENV;

      // Test development limits
      process.env.NODE_ENV = 'development';
      const devConfig = getComplexityConfig();
      expect(devConfig.maximumComplexity).toBeGreaterThan(1000);

      // Test production limits
      process.env.NODE_ENV = 'production';
      const prodConfig = getComplexityConfig();
      expect(prodConfig.maximumComplexity).toBeLessThanOrEqual(1000);

      process.env.NODE_ENV = originalEnv;
    });
  });
});
