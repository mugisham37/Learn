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
import type {
  IElasticsearchClient,
  SearchResponse,
  BulkOperationResult,
  IndexConfiguration,
} from './IElasticsearchClient.js';
import { ExternalServiceError } from '../../shared/errors/index.js';

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
function isRetryableError(error: any): boolean {
  // Retry on network errors, timeouts, and 5xx server errors
  if (error.name === 'ConnectionError' || error.name === 'TimeoutError') {
    return true;
  }
  
  if (error.statusCode >= 500 && error.statusCode < 600) {
    return true;
  }
  
  // Retry on specific Elasticsearch errors
  if (error.body?.error?.type === 'cluster_block_exception') {
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
    context: Record<string, any> = {}
  ): Promise<T> {
    let lastError: any;

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
        console.warn(
          `${operationName} attempt ${attempt + 1} failed. Retrying in ${delay}ms...`,
          {
            error: error.message,
            context,
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries,
          }
        );

        await sleep(delay);
      }
    }

    // All retries exhausted, throw the last error
    console.error(`${operationName} failed after ${this.retryConfig.maxRetries} attempts:`, {
      error: lastError.message,
      context,
    });

    throw new ExternalServiceError(
      `Elasticsearch ${operationName} operation failed`,
      'ELASTICSEARCH_OPERATION_ERROR',
      {
        operation: operationName,
        context,
        error: lastError.message,
        statusCode: lastError.statusCode,
        attempts: this.retryConfig.maxRetries,
      }
    );
  }

  /**
   * Index a single document
   */
  async index(
    index: string,
    id: string,
    document: any,
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
          body: document,
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
  async bulkIndex(operations: Array<{
    index: string;
    id: string;
    document: any;
  }>): Promise<BulkOperationResult> {
    return this.executeWithRetry(
      async () => {
        // Build bulk request body
        const body = operations.flatMap((op) => [
          { index: { _index: op.index, _id: op.id } },
          op.document,
        ]);

        const response = await this.client.bulk({
          body,
          refresh: 'wait_for',
        });

        return {
          success: !response.errors,
          items: response.items,
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
  async search(
    index: string,
    query: any,
    options: {
      from?: number;
      size?: number;
      sort?: any[];
      highlight?: any;
      aggregations?: any;
      source?: string[] | boolean;
      timeout?: string;
    } = {}
  ): Promise<SearchResponse> {
    return this.executeWithRetry(
      async () => {
        const searchBody: any = {
          query,
        };

        if (options.sort) {
          searchBody.sort = options.sort;
        }

        if (options.highlight) {
          searchBody.highlight = options.highlight;
        }

        if (options.aggregations) {
          searchBody.aggs = options.aggregations;
        }

        if (options.source !== undefined) {
          searchBody._source = options.source;
        }

        const response = await this.client.search({
          index,
          body: searchBody,
          from: options.from,
          size: options.size,
          timeout: options.timeout,
        });

        return {
          took: response.took,
          timed_out: response.timed_out,
          hits: {
            total: response.hits.total,
            max_score: response.hits.max_score,
            hits: response.hits.hits.map((hit: any) => ({
              _index: hit._index,
              _id: hit._id,
              _score: hit._score,
              _source: hit._source,
              highlight: hit.highlight,
            })),
          },
          aggregations: response.aggregations,
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
          body: configuration,
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
        } catch (error: any) {
          // Handle 404 as not_found result instead of error
          if (error.statusCode === 404) {
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
    query: any
  ): Promise<{
    took: number;
    timed_out: boolean;
    total: number;
    deleted: number;
    failures: any[];
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
          took: response.took,
          timed_out: response.timed_out,
          total: response.total,
          deleted: response.deleted,
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
          _shards: response._shards,
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

        return {
          cluster_name: response.cluster_name,
          status: response.status,
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
    indices: Record<string, {
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
    }>;
  }> {
    return this.executeWithRetry(
      async () => {
        const response = await this.client.indices.stats({
          index,
        });

        return {
          indices: response.indices,
        };
      },
      'getIndexStats',
      { index }
    );
  }
}