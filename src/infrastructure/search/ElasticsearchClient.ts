/**
 * Elasticsearch Client Implementation
 *
 * Concrete implementation of IElasticsearchClient providing a wrapper
 * around the Elasticsearch client with error handling, retries, and
 * proper error mapping to domain errors.
 *
 * Requirements: 8.1, 8.7
 */

import { Client } from '@elastic/elasticsearch';

import { ExternalServiceError } from '../../shared/errors/index.js';

import type {
  IElasticsearchClient,
  SearchResponse,
  SearchDocument,
  BulkOperationResult,
  IndexConfiguration,
} from './IElasticsearchClient.js';

/**
 * Retry configuration for Elasticsearch operations
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as Record<string, unknown>;
  
  // Retry on network errors, timeouts, and 5xx server errors
  if (err['name'] === 'ConnectionError' || err['name'] === 'TimeoutError') {
    return true;
  }

  if (typeof err['statusCode'] === 'number' && err['statusCode'] >= 500 && err['statusCode'] < 600) {
    return true;
  }

  // Retry on specific Elasticsearch errors
  const body = err['body'] as Record<string, unknown> | undefined;
  const errorInfo = body?.['error'] as Record<string, unknown> | undefined;
  if (errorInfo?.['type'] === 'cluster_block_exception') {
    return true;
  }

  return false;
}

/**
 * Elasticsearch Client Implementation
 *
 * Provides a robust wrapper around the Elasticsearch client with
 * automatic retries, error handling, and proper error mapping.
 */
export class ElasticsearchClient implements IElasticsearchClient {
  private client: Client;
  private retryConfig: RetryConfig;

  constructor(client: Client, retryConfig: Partial<RetryConfig> = {}) {
    this.client = client;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Execute an operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {}
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.retryConfig.maxRetries - 1;

        // Don't retry if error is not retryable or it's the last attempt
        if (!isRetryableError(error) || isLastAttempt) {
          break;
        }

        const delay = calculateBackoffDelay(attempt, this.retryConfig);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`${operationName} attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, {
          error: errorMessage,
          context,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
        });

        await sleep(delay);
      }
    }

    // All retries exhausted, throw the last error
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

    console.error(`${operationName} failed after ${this.retryConfig.maxRetries} attempts:`, {
      error: errorMessage,
      context,
    });

    throw new ExternalServiceError(
      'Elasticsearch',
      `${operationName} operation failed: ${errorMessage}`,
      lastError instanceof Error ? lastError : new Error(errorMessage),
      502
    );
  }

  /**
   * Index a single document
   */
  async index<T = SearchDocument>(
    index: string,
    id: string,
    document: T,
    options: {
      refresh?: 'true' | 'false' | 'wait_for';
      routing?: string;
      version?: number;
      version_type?: 'internal' | 'external' | 'external_gte';
    } = {}
  ): Promise<{
    _id: string;
    _index: string;
    _version: number;
    result: 'created' | 'updated';
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.index({
          index,
          id,
          body: document as Record<string, unknown>,
          refresh: options.refresh,
          routing: options.routing,
          version: options.version,
          version_type: options.version_type,
        });

        return {
          _id: response._id,
          _index: response._index,
          _version: response._version,
          result: response.result as 'created' | 'updated',
        };
      },
      'index',
      { index, id, options }
    );
  }

  /**
   * Bulk index multiple documents
   */
  async bulkIndex<T = SearchDocument>(
    operations: Array<{
      index: string;
      id: string;
      document: T;
    }>
  ): Promise<BulkOperationResult> {
    return this.executeWithRetry(
      async () => {
        // Build bulk request body
        const body: Array<Record<string, unknown>> = operations.flatMap((op) => [
          { index: { _index: op.index, _id: op.id } },
          op.document as Record<string, unknown>,
        ]);

        const response = await this.client.bulk({
          body,
          refresh: 'wait_for',
        });

        return {
          success: !response.errors,
          items: response.items.map((item) => ({
            index: item.index ? {
              _id: item.index._id || '',
              status: item.index.status || 0,
              error: item.index.error ? {
                type: String(item.index.error.type || 'unknown'),
                reason: String(item.index.error.reason || 'Unknown error'),
                caused_by: item.index.error.caused_by ? {
                  type: String(item.index.error.caused_by.type || 'unknown'),
                  reason: String(item.index.error.caused_by.reason || 'Unknown error'),
                } : undefined,
              } : undefined,
            } : undefined,
            delete: item.delete ? {
              _id: item.delete._id || '',
              status: item.delete.status || 0,
              error: item.delete.error ? {
                type: String(item.delete.error.type || 'unknown'),
                reason: String(item.delete.error.reason || 'Unknown error'),
                caused_by: item.delete.error.caused_by ? {
                  type: String(item.delete.error.caused_by.type || 'unknown'),
                  reason: String(item.delete.error.caused_by.reason || 'Unknown error'),
                } : undefined,
              } : undefined,
            } : undefined,
          })),
          errors: response.errors,
          took: response.took,
        };
      },
      'bulkIndex',
      { operationCount: operations.length }
    );
  }

  /**
   * Search documents with query DSL
   */
  async search<T = SearchDocument>(
    index: string,
    query: Record<string, unknown>,
    options: {
      from?: number;
      size?: number;
      sort?: Array<Record<string, unknown>>;
      highlight?: Record<string, unknown>;
      aggregations?: Record<string, unknown>;
      source?: string[] | boolean;
      timeout?: string;
    } = {}
  ): Promise<SearchResponse<T>> {
    return this.executeWithRetry(
      async () => {
        const searchBody: Record<string, unknown> = {
          query,
        };

        if (options.sort) {
          searchBody['sort'] = options.sort;
        }

        if (options.highlight) {
          searchBody['highlight'] = options.highlight;
        }

        if (options.aggregations) {
          searchBody['aggs'] = options.aggregations;
        }

        if (options.source !== undefined) {
          searchBody['_source'] = options.source;
        }

        const response = await this.client.search({
          index,
          body: searchBody,
          from: options.from,
          size: options.size,
          timeout: options.timeout,
        });

        // Safely handle total field which can be number or object
        const total = typeof response.hits.total === 'number' 
          ? response.hits.total 
          : response.hits.total?.value || 0;

        return {
          took: response.took,
          timed_out: response.timed_out,
          hits: {
            total,
            max_score: response.hits.max_score ?? null,
            hits: response.hits.hits.map((hit) => ({
              _index: String(hit._index),
              _id: String(hit._id),
              _score: Number(hit._score),
              _source: hit._source as T,
              highlight: hit.highlight || undefined,
            })),
          },
          aggregations: response.aggregations as Record<string, unknown> | undefined,
        };
      },
      'search',
      { index, options }
    );
  }

  /**
   * Delete an index
   */
  async deleteIndex(index: string): Promise<{
    acknowledged: boolean;
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.indices.delete({
          index,
        });

        return {
          acknowledged: response.acknowledged,
        };
      },
      'deleteIndex',
      { index }
    );
  }

  /**
   * Create an index with mappings and settings
   */
  async createIndex(
    index: string,
    configuration: IndexConfiguration
  ): Promise<{
    acknowledged: boolean;
    shards_acknowledged: boolean;
    index: string;
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.indices.create({
          index,
          body: configuration as Record<string, unknown>,
        });

        return {
          acknowledged: response.acknowledged,
          shards_acknowledged: response.shards_acknowledged,
          index: response.index,
        };
      },
      'createIndex',
      { index, configuration }
    );
  }

  /**
   * Check if an index exists
   */
  async indexExists(index: string): Promise<boolean> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.indices.exists({
          index,
        });

        return response;
      },
      'indexExists',
      { index }
    );
  }

  /**
   * Delete a document by ID
   */
  async deleteDocument(
    index: string,
    id: string,
    options: {
      refresh?: 'true' | 'false' | 'wait_for';
      routing?: string;
    } = {}
  ): Promise<{
    _id: string;
    _index: string;
    _version: number;
    result: 'deleted' | 'not_found';
  }> {
    return this.executeWithRetry(
      async () => {
        try {
          const response = await this.client.delete({
            index,
            id,
            refresh: options.refresh,
            routing: options.routing,
          });

          return {
            _id: response._id,
            _index: response._index,
            _version: response._version,
            result: response.result as 'deleted' | 'not_found',
          };
        } catch (error: unknown) {
          // Handle 404 as not_found result instead of error
          const statusCode = error && typeof error === 'object' && 'statusCode' in error 
            ? (error as { statusCode: unknown }).statusCode 
            : undefined;
            
          if (statusCode === 404) {
            return {
              _id: id,
              _index: index,
              _version: 0,
              result: 'not_found' as const,
            };
          }
          throw error;
        }
      },
      'deleteDocument',
      { index, id, options }
    );
  }

  /**
   * Delete documents by query
   */
  async deleteByQuery(
    index: string,
    query: Record<string, unknown>
  ): Promise<{
    took: number;
    timed_out: boolean;
    total: number;
    deleted: number;
    failures: unknown[];
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.deleteByQuery({
          index,
          body: {
            query,
          },
          refresh: true,
        });

        return {
          took: response.took || 0,
          timed_out: response.timed_out || false,
          total: response.total || 0,
          deleted: response.deleted || 0,
          failures: response.failures || [],
        };
      },
      'deleteByQuery',
      { index, query }
    );
  }

  /**
   * Refresh one or more indices
   */
  async refresh(indices?: string[]): Promise<{
    _shards: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.indices.refresh({
          index: indices?.join(',') || '_all',
        });

        return {
          _shards: response._shards || { total: 0, successful: 0, failed: 0 },
        };
      },
      'refresh',
      { indices }
    );
  }

  /**
   * Get cluster health information
   */
  async getClusterHealth(): Promise<{
    cluster_name: string;
    status: 'green' | 'yellow' | 'red';
    timed_out: boolean;
    number_of_nodes: number;
    number_of_data_nodes: number;
    active_primary_shards: number;
    active_shards: number;
    relocating_shards: number;
    initializing_shards: number;
    unassigned_shards: number;
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.cluster.health();

        // Map the status to ensure it's one of the expected values
        const status = response.status === 'green' || response.status === 'yellow' || response.status === 'red'
          ? response.status
          : 'red'; // Default to red for unknown status

        return {
          cluster_name: response.cluster_name,
          status,
          timed_out: response.timed_out,
          number_of_nodes: response.number_of_nodes,
          number_of_data_nodes: response.number_of_data_nodes,
          active_primary_shards: response.active_primary_shards,
          active_shards: response.active_shards,
          relocating_shards: response.relocating_shards,
          initializing_shards: response.initializing_shards,
          unassigned_shards: response.unassigned_shards,
        };
      },
      'getClusterHealth',
      {}
    );
  }

  /**
   * Get index statistics
   */
  async getIndexStats(index: string): Promise<{
    indices: Record<
      string,
      {
        total: {
          docs: {
            count: number;
            deleted: number;
          };
          store: {
            size_in_bytes: number;
          };
          indexing: {
            index_total: number;
            index_time_in_millis: number;
          };
          search: {
            query_total: number;
            query_time_in_millis: number;
          };
        };
      }
    >;
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.indices.stats({
          index,
        });

        // Transform the response to match our interface
        const transformedIndices: Record<string, {
          total: {
            docs: { count: number; deleted: number };
            store: { size_in_bytes: number };
            indexing: { index_total: number; index_time_in_millis: number };
            search: { query_total: number; query_time_in_millis: number };
          };
        }> = {};

        if (response.indices) {
          for (const [indexName, stats] of Object.entries(response.indices)) {
            transformedIndices[indexName] = {
              total: {
                docs: {
                  count: stats.total?.docs?.count || 0,
                  deleted: stats.total?.docs?.deleted || 0,
                },
                store: {
                  size_in_bytes: stats.total?.store?.size_in_bytes || 0,
                },
                indexing: {
                  index_total: stats.total?.indexing?.index_total || 0,
                  index_time_in_millis: stats.total?.indexing?.index_time_in_millis || 0,
                },
                search: {
                  query_total: stats.total?.search?.query_total || 0,
                  query_time_in_millis: stats.total?.search?.query_time_in_millis || 0,
                },
              },
            };
          }
        }

        return {
          indices: transformedIndices,
        };
      },
      'getIndexStats',
      { index }
    );
  }
}
