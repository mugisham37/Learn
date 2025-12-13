/**
 * Elasticsearch Client Interface
 *
 * Defines the contract for low-level Elasticsearch operations.
 * Provides a clean abstraction over the Elasticsearch client with
 * error handling, retries, and type safety.
 *
 * Requirements: 8.1, 8.7
 */

/**
 * Generic document type for search operations
 */
export type SearchDocument = Record<string, unknown>;

/**
 * Elasticsearch search hit structure
 */
export interface SearchHit<T = SearchDocument> {
  _index: string;
  _id: string;
  _score: number;
  _source: T;
  highlight?: Record<string, string[]>;
}

/**
 * Elasticsearch search response structure
 */
export interface SearchResponse<T = SearchDocument> {
  took: number;
  timed_out: boolean;
  hits: {
    total:
      | {
          value: number;
          relation: string;
        }
      | number;
    max_score: number | null;
    hits: Array<SearchHit<T>>;
  };
  aggregations?: Record<string, unknown>;
}

/**
 * Bulk operation item result
 */
export interface BulkOperationItem {
  _id: string;
  status: number;
  error?: {
    type: string;
    reason: string;
    caused_by?: {
      type: string;
      reason: string;
    };
  };
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  success: boolean;
  items: Array<{
    index?: BulkOperationItem;
    delete?: BulkOperationItem;
  }>;
  errors: boolean;
  took: number;
}

/**
 * Elasticsearch field mapping
 */
export interface FieldMapping {
  type: string;
  analyzer?: string;
  fields?: Record<string, FieldMapping>;
  properties?: Record<string, FieldMapping>;
  [key: string]: unknown;
}

/**
 * Index creation/update configuration
 */
export interface IndexConfiguration {
  settings?: {
    number_of_shards?: number;
    number_of_replicas?: number;
    analysis?: {
      analyzer?: Record<string, unknown>;
      tokenizer?: Record<string, unknown>;
      filter?: Record<string, unknown>;
    };
    refresh_interval?: string;
    [key: string]: unknown;
  };
  mappings?: {
    properties: Record<string, FieldMapping>;
    [key: string]: unknown;
  };
  aliases?: Record<string, unknown>;
}

/**
 * Elasticsearch Client Interface
 *
 * Provides methods for all low-level Elasticsearch operations
 * with proper error handling and retry logic.
 */
export interface IElasticsearchClient {
  /**
   * Index a single document
   *
   * @param index - Index name
   * @param id - Document ID
   * @param document - Document to index
   * @param options - Additional indexing options
   * @returns Promise resolving when document is indexed
   * @throws ExternalServiceError if operation fails
   */
  index<T = SearchDocument>(
    index: string,
    id: string,
    document: T,
    options?: {
      refresh?: 'true' | 'false' | 'wait_for';
      routing?: string;
      version?: number;
      version_type?: 'internal' | 'external' | 'external_gte';
    }
  ): Promise<{
    _id: string;
    _index: string;
    _version: number;
    result: 'created' | 'updated';
  }>;

  /**
   * Bulk index multiple documents
   *
   * @param operations - Array of bulk operations
   * @returns Promise resolving to bulk operation result
   * @throws ExternalServiceError if operation fails
   */
  bulkIndex<T = SearchDocument>(
    operations: Array<{
      index: string;
      id: string;
      document: T;
    }>
  ): Promise<BulkOperationResult>;

  /**
   * Search documents with query DSL
   *
   * @param index - Index name or pattern
   * @param query - Elasticsearch query DSL
   * @param options - Search options
   * @returns Promise resolving to search response
   * @throws ExternalServiceError if operation fails
   */
  search<T = SearchDocument>(
    index: string,
    query: Record<string, unknown>,
    options?: {
      from?: number;
      size?: number;
      sort?: Array<Record<string, unknown>>;
      highlight?: Record<string, unknown>;
      aggregations?: Record<string, unknown>;
      source?: string[] | boolean;
      timeout?: string;
    }
  ): Promise<SearchResponse<T>>;

  /**
   * Delete an index
   *
   * @param index - Index name
   * @returns Promise resolving when index is deleted
   * @throws ExternalServiceError if operation fails
   */
  deleteIndex(index: string): Promise<{
    acknowledged: boolean;
  }>;

  /**
   * Create an index with mappings and settings
   *
   * @param index - Index name
   * @param configuration - Index configuration
   * @returns Promise resolving when index is created
   * @throws ExternalServiceError if operation fails
   */
  createIndex(
    index: string,
    configuration: IndexConfiguration
  ): Promise<{
    acknowledged: boolean;
    shards_acknowledged: boolean;
    index: string;
  }>;

  /**
   * Check if an index exists
   *
   * @param index - Index name
   * @returns Promise resolving to existence status
   * @throws ExternalServiceError if operation fails
   */
  indexExists(index: string): Promise<boolean>;

  /**
   * Delete a document by ID
   *
   * @param index - Index name
   * @param id - Document ID
   * @param options - Delete options
   * @returns Promise resolving to delete result
   * @throws ExternalServiceError if operation fails
   */
  deleteDocument(
    index: string,
    id: string,
    options?: {
      refresh?: 'true' | 'false' | 'wait_for';
      routing?: string;
    }
  ): Promise<{
    _id: string;
    _index: string;
    _version: number;
    result: 'deleted' | 'not_found';
  }>;

  /**
   * Delete documents by query
   *
   * @param index - Index name
   * @param query - Query to match documents for deletion
   * @returns Promise resolving to delete result
   * @throws ExternalServiceError if operation fails
   */
  deleteByQuery(
    index: string,
    query: Record<string, unknown>
  ): Promise<{
    took: number;
    timed_out: boolean;
    total: number;
    deleted: number;
    failures: unknown[];
  }>;

  /**
   * Refresh one or more indices
   *
   * @param indices - Index names (optional, defaults to all)
   * @returns Promise resolving when refresh is complete
   * @throws ExternalServiceError if operation fails
   */
  refresh(indices?: string[]): Promise<{
    _shards: {
      total: number;
      successful: number;
      failed: number;
    };
  }>;

  /**
   * Get cluster health information
   *
   * @returns Promise resolving to cluster health
   * @throws ExternalServiceError if operation fails
   */
  getClusterHealth(): Promise<{
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
  }>;

  /**
   * Get index statistics
   *
   * @param index - Index name
   * @returns Promise resolving to index stats
   * @throws ExternalServiceError if operation fails
   */
  getIndexStats(index: string): Promise<{
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
  }>;
}
