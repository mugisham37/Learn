/**
 * Elasticsearch Integration Tests
 * 
 * Tests for Elasticsearch client configuration, health checks,
 * and basic operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  elasticsearch,
  checkElasticsearchHealth,
  initializeElasticsearchIndices,
  bulkIndex,
  deleteByQuery,
  refreshIndices,
  getIndexStats,
  ElasticsearchIndex,
  ElasticsearchAlias,
} from '../index.js';

describe('Elasticsearch Integration', () => {
  beforeAll(async () => {
    // Wait a bit for Elasticsearch to be ready in CI/test environments
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Clean up test indices
    try {
      await elasticsearch.indices.delete({
        index: `${ElasticsearchIndex.COURSES}_test`,
        ignore_unavailable: true,
      });
      await elasticsearch.indices.delete({
        index: `${ElasticsearchIndex.LESSONS}_test`,
        ignore_unavailable: true,
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Health Check', () => {
    it('should check Elasticsearch health', async () => {
      const health = await checkElasticsearchHealth();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('latencyMs');
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.latencyMs).toBe('number');
      
      if (health.healthy) {
        expect(health.cluster).toBeDefined();
        expect(health.cluster?.name).toBeDefined();
        expect(health.cluster?.status).toBeDefined();
      } else {
        expect(health.error).toBeDefined();
      }
    }, 10000);
  });

  describe('Index Management', () => {
    it('should initialize Elasticsearch indices', async () => {
      // Skip if Elasticsearch is not available
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        console.log('Skipping Elasticsearch tests - service not available');
        return;
      }

      await expect(initializeElasticsearchIndices()).resolves.not.toThrow();
      
      // Check if indices exist
      const coursesExists = await elasticsearch.indices.exists({
        index: ElasticsearchAlias.COURSES,
      });
      const lessonsExists = await elasticsearch.indices.exists({
        index: ElasticsearchAlias.LESSONS,
      });
      
      expect(coursesExists).toBe(true);
      expect(lessonsExists).toBe(true);
    }, 15000);

    it('should handle index creation when indices already exist', async () => {
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        return;
      }

      // Should not throw when indices already exist
      await expect(initializeElasticsearchIndices()).resolves.not.toThrow();
    }, 10000);
  });

  describe('Document Operations', () => {
    const testIndexName = `${ElasticsearchIndex.COURSES}_test`;
    
    beforeAll(async () => {
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        return;
      }

      // Create test index
      try {
        await elasticsearch.indices.create({
          index: testIndexName,
          body: {
            mappings: {
              properties: {
                title: { type: 'text' },
                description: { type: 'text' },
                category: { type: 'keyword' },
              },
            },
          },
        });
      } catch (error) {
        // Index might already exist
      }
    });

    it('should bulk index documents', async () => {
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        return;
      }

      const documents = [
        {
          id: 'test-1',
          body: {
            title: 'Test Course 1',
            description: 'A test course for unit testing',
            category: 'programming',
          },
        },
        {
          id: 'test-2',
          body: {
            title: 'Test Course 2',
            description: 'Another test course',
            category: 'design',
          },
        },
      ];

      const result = await bulkIndex(testIndexName, documents);
      
      expect(result.success).toBe(true);
      expect(result.indexed).toBe(2);
      expect(result.errors).toHaveLength(0);
    }, 10000);

    it('should delete documents by query', async () => {
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        return;
      }

      // First ensure we have documents to delete
      await bulkIndex(testIndexName, [
        {
          id: 'delete-test-1',
          body: {
            title: 'Delete Test Course',
            description: 'This should be deleted',
            category: 'test',
          },
        },
      ]);

      // Wait for indexing
      await refreshIndices([testIndexName]);

      const result = await deleteByQuery(testIndexName, {
        match: { category: 'test' },
      });

      expect(result.success).toBe(true);
      expect(result.deleted).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should refresh indices', async () => {
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        return;
      }

      await expect(refreshIndices([testIndexName])).resolves.not.toThrow();
    });

    it('should get index statistics', async () => {
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        return;
      }

      const stats = await getIndexStats(testIndexName);
      
      expect(stats).toHaveProperty('documentCount');
      expect(stats).toHaveProperty('storeSize');
      expect(stats).toHaveProperty('indexingRate');
      expect(stats).toHaveProperty('searchRate');
      expect(typeof stats.documentCount).toBe('number');
      expect(typeof stats.storeSize).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // This test verifies that our error handling works
      // We can't easily simulate connection errors in tests,
      // but we can verify the structure of error responses
      
      const result = await bulkIndex('non-existent-index', []);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('indexed');
      expect(result).toHaveProperty('errors');
    });

    it('should handle invalid queries gracefully', async () => {
      const health = await checkElasticsearchHealth();
      if (!health.healthy) {
        return;
      }

      const result = await deleteByQuery('non-existent-index', {
        invalid_query: 'this should fail',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});