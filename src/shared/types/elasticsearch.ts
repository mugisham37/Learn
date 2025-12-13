/**
 * Elasticsearch Type Definitions
 *
 * Proper type definitions for Elasticsearch operations to avoid 'any' types
 */

/**
 * Elasticsearch query result row
 */
export interface ElasticsearchHit<T = Record<string, unknown>> {
  _index: string;
  _id: string;
  _score: number | null;
  _source: T;
  highlight?: Record<string, string[]>;
}

/**
 * Elasticsearch search response
 */
export interface ElasticsearchResponse<T = Record<string, unknown>> {
  took: number;
  timed_out: boolean;
  hits: {
    total: number | { value: number; relation: string };
    max_score: number | null;
    hits: ElasticsearchHit<T>[];
  };
  aggregations?: Record<string, ElasticsearchAggregation>;
}

/**
 * Elasticsearch aggregation result
 */
export interface ElasticsearchAggregation {
  buckets?: Array<{
    key: string | number;
    doc_count: number;
    from?: number;
    to?: number;
    [key: string]: unknown;
  }>;
  value?: number;
  [key: string]: unknown;
}

/**
 * Elasticsearch bulk operation item
 */
export interface ElasticsearchBulkItem {
  index?: {
    _id: string;
    status: number;
    error?: {
      type: string;
      reason: string;
    };
  };
  delete?: {
    _id: string;
    status: number;
    error?: {
      type: string;
      reason: string;
    };
  };
}

/**
 * Elasticsearch bulk response
 */
export interface ElasticsearchBulkResponse {
  took: number;
  errors: boolean;
  items: ElasticsearchBulkItem[];
}

/**
 * Elasticsearch index statistics
 */
export interface ElasticsearchIndexStats {
  indexname: string;
  size: string;
  tablename: string;
}

/**
 * Database connection client interface
 */
export interface DatabaseClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  release: () => void;
}