/**
 * Elasticsearch Client Tests
 * 
 * Tests for the ElasticsearchClient implementation to ensure proper
 * error handling, retries, and Elasticsearch operations.
 * 
 * Requirements: 8.1, 8.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import { ElasticsearchClient } from '../ElasticsearchClient.js';
import { ExternalServiceError } from '../../../shared/errors/index.js';

// Mock the Elasticsearch client
const mockElasticsearchClient = {
  index: vi.fn(),
  bulk: vi.fn(),
  search: vi.fn(),
  delete: vi.fn(),
  deleteByQuery: vi.fn(),
  indices: {
    create: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    refresh: vi.fn(),
    stats: vi.fn(),
  },
  cluster: {
    health: vi.fn(),
  },
} as unknown as Client;

describe('ElasticsearchClient', () => {
  let elasticsearchClient: ElasticsearchClient;

  beforeEach(() => {
    elasticsearchClient = new ElasticsearchClient(mockElasticsearchClient, {
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 500,
      backoffMultiplier: 2,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('index', () => {
    it('should successfully index a document', async () => {
      // Arrange
      const mockResponse = {
        _id: 'doc-1',
        _index: 'test-index',
        _version: 1,
        result: 'created',
      };
      (mockElasticsearchClient.index as any).mockResolvedValue(mockResponse);

      const document = { title: 'Test Document', content: 'Test content' };

      // Act
      const result = await elasticsearchClient.index('test-index', 'doc-1', document);

      // Assert
      expect(result).toEqual({
        _id: 'doc-1',
        _index: 'test-index',
        _version: 1,
        result: 'created',
      });
      expect(mockElasticsearchClient.index).toHaveBeenCalledWith({
        index: 'test-index',
        id: 'doc-1',
        body: document,
        refresh: undefined,
        routing: undefined,
        version: undefined,
        version_type: undefined,
      });
    });

    it('should handle indexing with options', async () => {
      // Arrange
      const mockResponse = {
        _id: 'doc-1',
        _index: 'test-index',
        _version: 2,
        result: 'updated',
      };
      (mockElasticsearchClient.index as any).mockResolvedValue(mockResponse);

      const document = { title: 'Test Document', content: 'Test content' };
      const options = {
        refresh: 'wait_for' as const,
        routing: 'user-1',
        version: 1,
        version_type: 'external' as const,
      };

      // Act
      const result = await elasticsearchClient.index('test-index', 'doc-1', document, options);

      // Assert
      expect(result.result).toBe('updated');
      expect(mockElasticsearchClient.index).toHaveBeenCalledWith({
        index: 'test-index',
        id: 'doc-1',
        body: document,
        refresh: 'wait_for',
        routing: 'user-1',
        version: 1,
        version_type: 'external',
      });
    });

    it('should retry on retryable errors', async () => {
      // Arrange
      const retryableError = new Error('Connection error');
      (retryableError as any).name = 'ConnectionError';
      
      const mockResponse = {
        _id: 'doc-1',
        _index: 'test-index',
        _version: 1,
        result: 'created',
      };

      (mockElasticsearchClient.index as any)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue(mockResponse);

      const document = { title: 'Test Document' };

      // Act
      const result = await elasticsearchClient.index('test-index', 'doc-1', document);

      // Assert
      expect(result.result).toBe('created');
      expect(mockElasticsearchClient.index).toHaveBeenCalledTimes(2);
    });

    it('should throw ExternalServiceError after max retries', async () => {
      // Arrange
      const retryableError = new Error('Connection error');
      (retryableError as any).name = 'ConnectionError';
      
      (mockElasticsearchClient.index as any).mockRejectedValue(retryableError);

      const document = { title: 'Test Document' };

      // Act & Assert
      await expect(
        elasticsearchClient.index('test-index', 'doc-1', document)
      ).rejects.toThrow(ExternalServiceError);
      
      expect(mockElasticsearchClient.index).toHaveBeenCalledTimes(2); // maxRetries = 2
    });

    it('should not retry on non-retryable errors', async () => {
      // Arrange
      const nonRetryableError = new Error('Bad request');
      (nonRetryableError as any).statusCode = 400;
      
      (mockElasticsearchClient.index as any).mockRejectedValue(nonRetryableError);

      const document = { title: 'Test Document' };

      // Act & Assert
      await expect(
        elasticsearchClient.index('test-index', 'doc-1', document)
      ).rejects.toThrow(ExternalServiceError);
      
      expect(mockElasticsearchClient.index).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('bulkIndex', () => {
    it('should successfully bulk index documents', async () => {
      // Arrange
      const mockResponse = {
        took: 5,
        errors: false,
        items: [
          { index: { _id: 'doc-1', status: 201 } },
          { index: { _id: 'doc-2', status: 201 } },
        ],
      };
      (mockElasticsearchClient.bulk as any).mockResolvedValue(mockResponse);

      const operations = [
        { index: 'test-index', id: 'doc-1', document: { title: 'Doc 1' } },
        { index: 'test-index', id: 'doc-2', document: { title: 'Doc 2' } },
      ];

      // Act
      const result = await elasticsearchClient.bulkIndex(operations);

      // Assert
      expect(result).toEqual({
        success: true,
        items: mockResponse.items,
        errors: false,
        took: 5,
      });
      expect(mockElasticsearchClient.bulk).toHaveBeenCalledWith({
        body: [
          { index: { _index: 'test-index', _id: 'doc-1' } },
          { title: 'Doc 1' },
          { index: { _index: 'test-index', _id: 'doc-2' } },
          { title: 'Doc 2' },
        ],
        refresh: 'wait_for',
      });
    });

    it('should handle bulk index errors', async () => {
      // Arrange
      const mockResponse = {
        took: 10,
        errors: true,
        items: [
          { index: { _id: 'doc-1', status: 201 } },
          { index: { _id: 'doc-2', status: 400, error: { reason: 'Invalid document' } } },
        ],
      };
      (mockElasticsearchClient.bulk as any).mockResolvedValue(mockResponse);

      const operations = [
        { index: 'test-index', id: 'doc-1', document: { title: 'Doc 1' } },
        { index: 'test-index', id: 'doc-2', document: { title: 'Doc 2' } },
      ];

      // Act
      const result = await elasticsearchClient.bulkIndex(operations);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toBe(true);
    });
  });

  describe('search', () => {
    it('should successfully search documents', async () => {
      // Arrange
      const mockResponse = {
        took: 5,
        timed_out: false,
        hits: {
          total: { value: 2, relation: 'eq' },
          max_score: 1.0,
          hits: [
            {
              _index: 'test-index',
              _id: 'doc-1',
              _score: 1.0,
              _source: { title: 'Test Document 1' },
              highlight: { title: ['<mark>Test</mark> Document 1'] },
            },
            {
              _index: 'test-index',
              _id: 'doc-2',
              _score: 0.8,
              _source: { title: 'Test Document 2' },
            },
          ],
        },
        aggregations: {
          categories: {
            buckets: [{ key: 'programming', doc_count: 2 }],
          },
        },
      };
      (mockElasticsearchClient.search as any).mockResolvedValue(mockResponse);

      const query = { match: { title: 'test' } };
      const options = {
        from: 0,
        size: 10,
        sort: [{ _score: { order: 'desc' } }],
        highlight: { fields: { title: {} } },
        aggregations: { categories: { terms: { field: 'category' } } },
      };

      // Act
      const result = await elasticsearchClient.search('test-index', query, options);

      // Assert
      expect(result).toEqual({
        took: 5,
        timed_out: false,
        hits: {
          total: { value: 2, relation: 'eq' },
          max_score: 1.0,
          hits: [
            {
              _index: 'test-index',
              _id: 'doc-1',
              _score: 1.0,
              _source: { title: 'Test Document 1' },
              highlight: { title: ['<mark>Test</mark> Document 1'] },
            },
            {
              _index: 'test-index',
              _id: 'doc-2',
              _score: 0.8,
              _source: { title: 'Test Document 2' },
              highlight: undefined,
            },
          ],
        },
        aggregations: {
          categories: {
            buckets: [{ key: 'programming', doc_count: 2 }],
          },
        },
      });
    });
  });

  describe('createIndex', () => {
    it('should successfully create an index', async () => {
      // Arrange
      const mockResponse = {
        acknowledged: true,
        shards_acknowledged: true,
        index: 'test-index',
      };
      (mockElasticsearchClient.indices.create as any).mockResolvedValue(mockResponse);

      const configuration = {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: {
          properties: {
            title: { type: 'text' },
            content: { type: 'text' },
          },
        },
      };

      // Act
      const result = await elasticsearchClient.createIndex('test-index', configuration);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockElasticsearchClient.indices.create).toHaveBeenCalledWith({
        index: 'test-index',
        body: configuration,
      });
    });
  });

  describe('deleteIndex', () => {
    it('should successfully delete an index', async () => {
      // Arrange
      const mockResponse = { acknowledged: true };
      (mockElasticsearchClient.indices.delete as any).mockResolvedValue(mockResponse);

      // Act
      const result = await elasticsearchClient.deleteIndex('test-index');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockElasticsearchClient.indices.delete).toHaveBeenCalledWith({
        index: 'test-index',
      });
    });
  });

  describe('indexExists', () => {
    it('should return true if index exists', async () => {
      // Arrange
      (mockElasticsearchClient.indices.exists as any).mockResolvedValue(true);

      // Act
      const result = await elasticsearchClient.indexExists('test-index');

      // Assert
      expect(result).toBe(true);
      expect(mockElasticsearchClient.indices.exists).toHaveBeenCalledWith({
        index: 'test-index',
      });
    });

    it('should return false if index does not exist', async () => {
      // Arrange
      (mockElasticsearchClient.indices.exists as any).mockResolvedValue(false);

      // Act
      const result = await elasticsearchClient.indexExists('test-index');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('deleteDocument', () => {
    it('should successfully delete a document', async () => {
      // Arrange
      const mockResponse = {
        _id: 'doc-1',
        _index: 'test-index',
        _version: 2,
        result: 'deleted',
      };
      (mockElasticsearchClient.delete as any).mockResolvedValue(mockResponse);

      // Act
      const result = await elasticsearchClient.deleteDocument('test-index', 'doc-1');

      // Assert
      expect(result).toEqual({
        _id: 'doc-1',
        _index: 'test-index',
        _version: 2,
        result: 'deleted',
      });
    });

    it('should handle document not found', async () => {
      // Arrange
      const notFoundError = new Error('Not found');
      (notFoundError as any).statusCode = 404;
      (mockElasticsearchClient.delete as any).mockRejectedValue(notFoundError);

      // Act
      const result = await elasticsearchClient.deleteDocument('test-index', 'doc-1');

      // Assert
      expect(result).toEqual({
        _id: 'doc-1',
        _index: 'test-index',
        _version: 0,
        result: 'not_found',
      });
    });
  });

  describe('deleteByQuery', () => {
    it('should successfully delete documents by query', async () => {
      // Arrange
      const mockResponse = {
        took: 10,
        timed_out: false,
        total: 5,
        deleted: 5,
        failures: [],
      };
      (mockElasticsearchClient.deleteByQuery as any).mockResolvedValue(mockResponse);

      const query = { term: { status: 'inactive' } };

      // Act
      const result = await elasticsearchClient.deleteByQuery('test-index', query);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockElasticsearchClient.deleteByQuery).toHaveBeenCalledWith({
        index: 'test-index',
        body: { query },
        refresh: true,
      });
    });
  });

  describe('refresh', () => {
    it('should successfully refresh indices', async () => {
      // Arrange
      const mockResponse = {
        _shards: {
          total: 2,
          successful: 2,
          failed: 0,
        },
      };
      (mockElasticsearchClient.indices.refresh as any).mockResolvedValue(mockResponse);

      // Act
      const result = await elasticsearchClient.refresh(['index1', 'index2']);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockElasticsearchClient.indices.refresh).toHaveBeenCalledWith({
        index: 'index1,index2',
      });
    });

    it('should refresh all indices when no indices specified', async () => {
      // Arrange
      const mockResponse = {
        _shards: {
          total: 10,
          successful: 10,
          failed: 0,
        },
      };
      (mockElasticsearchClient.indices.refresh as any).mockResolvedValue(mockResponse);

      // Act
      const result = await elasticsearchClient.refresh();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockElasticsearchClient.indices.refresh).toHaveBeenCalledWith({
        index: '_all',
      });
    });
  });

  describe('getClusterHealth', () => {
    it('should successfully get cluster health', async () => {
      // Arrange
      const mockResponse = {
        cluster_name: 'test-cluster',
        status: 'green',
        timed_out: false,
        number_of_nodes: 3,
        number_of_data_nodes: 3,
        active_primary_shards: 5,
        active_shards: 10,
        relocating_shards: 0,
        initializing_shards: 0,
        unassigned_shards: 0,
      };
      (mockElasticsearchClient.cluster.health as any).mockResolvedValue(mockResponse);

      // Act
      const result = await elasticsearchClient.getClusterHealth();

      // Assert
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getIndexStats', () => {
    it('should successfully get index statistics', async () => {
      // Arrange
      const mockResponse = {
        indices: {
          'test-index': {
            total: {
              docs: {
                count: 100,
                deleted: 5,
              },
              store: {
                size_in_bytes: 1024000,
              },
              indexing: {
                index_total: 105,
                index_time_in_millis: 500,
              },
              search: {
                query_total: 50,
                query_time_in_millis: 200,
              },
            },
          },
        },
      };
      (mockElasticsearchClient.indices.stats as any).mockResolvedValue(mockResponse);

      // Act
      const result = await elasticsearchClient.getIndexStats('test-index');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockElasticsearchClient.indices.stats).toHaveBeenCalledWith({
        index: 'test-index',
      });
    });
  });
});