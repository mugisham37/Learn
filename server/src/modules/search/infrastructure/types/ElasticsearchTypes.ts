/**
 * Elasticsearch Type Definitions
 * 
 * Proper TypeScript types for Elasticsearch query structures
 * to replace unsafe 'any' types throughout the search module.
 */

/**
 * Elasticsearch query clause types
 */
export interface BoolQuery {
  must?: QueryClause[];
  should?: QueryClause[];
  must_not?: QueryClause[];
  filter?: QueryClause[];
  minimum_should_match?: number | string;
}

export interface MultiMatchQuery {
  query: string;
  fields: string[];
  type?: 'best_fields' | 'most_fields' | 'cross_fields' | 'phrase' | 'phrase_prefix' | 'bool_prefix';
  operator?: 'and' | 'or';
  fuzziness?: string | number;
  prefix_length?: number;
  max_expansions?: number;
  boost?: number;
}

export interface TermQuery {
  [field: string]: string | number | boolean;
}

export interface RangeQuery {
  [field: string]: {
    gte?: number | string;
    lte?: number | string;
    gt?: number | string;
    lt?: number | string;
  };
}

export interface MatchQuery {
  [field: string]: {
    query: string;
    operator?: 'and' | 'or';
    fuzziness?: string | number;
  } | string;
}

export type QueryClause = 
  | { bool: BoolQuery }
  | { multi_match: MultiMatchQuery }
  | { term: TermQuery }
  | { terms: { [field: string]: (string | number)[] } }
  | { range: RangeQuery }
  | { match: MatchQuery }
  | { match_all: Record<string, never> }
  | { exists: { field: string } };

/**
 * Elasticsearch aggregation types
 */
export interface TermsAggregation {
  field: string;
  size?: number;
  order?: { [key: string]: 'asc' | 'desc' };
}

export interface RangeAggregation {
  field: string;
  ranges: Array<{
    key?: string;
    from?: number;
    to?: number;
  }>;
}

export interface DateHistogramAggregation {
  field: string;
  calendar_interval?: string;
  fixed_interval?: string;
  format?: string;
}

export interface StatsAggregation {
  field: string;
}

export type AggregationClause = 
  | { terms: TermsAggregation }
  | { range: RangeAggregation }
  | { date_histogram: DateHistogramAggregation }
  | { stats: StatsAggregation };

/**
 * Elasticsearch sort configuration
 */
export interface SortClause {
  [field: string]: {
    order: 'asc' | 'desc';
    mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
    missing?: string | number;
  } | 'asc' | 'desc';
}

/**
 * Elasticsearch highlight configuration
 */
export interface HighlightConfig {
  fields: {
    [field: string]: {
      fragment_size?: number;
      number_of_fragments?: number;
      pre_tags?: string[];
      post_tags?: string[];
    };
  };
  pre_tags?: string[];
  post_tags?: string[];
}

/**
 * Complete Elasticsearch query structure
 */
export interface ElasticsearchQuery {
  query?: QueryClause;
  sort?: SortClause[];
  from?: number;
  size?: number;
  highlight?: HighlightConfig;
  aggs?: { [name: string]: AggregationClause };
  _source?: string[] | boolean;
}

/**
 * Elasticsearch search response structure
 */
export interface ElasticsearchHit<T = Record<string, unknown>> {
  _index: string;
  _type?: string;
  _id: string;
  _score: number;
  _source: T;
  highlight?: { [field: string]: string[] };
}

export interface ElasticsearchResponse<T = Record<string, unknown>> {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: 'eq' | 'gte';
    };
    max_score: number | null;
    hits: ElasticsearchHit<T>[];
  };
  aggregations?: { [name: string]: AggregationResult };
}

/**
 * Elasticsearch aggregation result types
 */
export interface TermsAggregationResult {
  doc_count_error_upper_bound: number;
  sum_other_doc_count: number;
  buckets: Array<{
    key: string | number;
    doc_count: number;
  }>;
}

export interface RangeAggregationResult {
  buckets: Array<{
    key: string;
    from?: number;
    to?: number;
    doc_count: number;
  }>;
}

export type AggregationResult = 
  | TermsAggregationResult 
  | RangeAggregationResult 
  | { [key: string]: unknown };

/**
 * Search repository method signatures with proper types
 */
export interface SearchRepositoryWithFacets {
  searchCoursesWithFacets(
    query: string,
    options: SearchOptions
  ): Promise<SearchResponseWithFacets>;
}

export interface SearchOptions {
  filters?: {
    category?: string[];
    difficulty?: string[];
    priceRange?: { min?: number; max?: number };
    rating?: { min?: number };
    status?: string[];
    language?: string[];
  };
  pagination?: {
    from?: number;
    size?: number;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  includeFacets?: boolean;
}

export interface SearchResponseWithFacets {
  documents: unknown[];
  total: number;
  took: number;
  maxScore?: number;
  facets: {
    categories: Array<{ key: string; count: number }>;
    difficulties: Array<{ key: string; count: number }>;
    priceRanges: Array<{ key: string; count: number; from?: number; to?: number }>;
    ratings: Array<{ key: string; count: number; from?: number }>;
  };
}