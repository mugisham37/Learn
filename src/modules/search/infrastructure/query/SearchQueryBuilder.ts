/**
 * Search Query Builder
 * 
 * Provides a fluent interface for building Elasticsearch queries with
 * full-text search, filters, facets, sorting, highlighting, and pagination.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

/**
 * Search query configuration options
 */
export interface SearchQueryOptions {
  // Full-text search
  query?: string;
  fields?: string[];
  fuzziness?: 'AUTO' | '0' | '1' | '2';
  
  // Filters
  filters?: {
    terms?: Record<string, string[]>;
    range?: Record<string, { gte?: number; lte?: number; gt?: number; lt?: number }>;
    bool?: Record<string, boolean>;
    exists?: string[];
    missing?: string[];
  };
  
  // Sorting
  sort?: Array<{
    field: string;
    order: 'asc' | 'desc';
    mode?: 'min' | 'max' | 'sum' | 'avg' | 'median';
  }>;
  
  // Pagination
  from?: number;
  size?: number;
  
  // Highlighting
  highlight?: {
    fields: string[];
    preTags?: string[];
    postTags?: string[];
    fragmentSize?: number;
    numberOfFragments?: number;
  };
  
  // Aggregations/Facets
  aggregations?: Record<string, {
    type: 'terms' | 'range' | 'date_histogram' | 'stats';
    field: string;
    size?: number;
    ranges?: Array<{ from?: number; to?: number; key?: string }>;
    interval?: string;
  }>;
  
  // Source filtering
  source?: string[] | boolean;
  
  // Query boost
  boost?: number;
  
  // Minimum should match for boolean queries
  minimumShouldMatch?: string | number;
}

/**
 * Built Elasticsearch query structure
 */
export interface BuiltQuery {
  query: any;
  sort?: any[];
  from?: number;
  size?: number;
  highlight?: any;
  aggs?: any;
  _source?: string[] | boolean;
}

/**
 * Search Query Builder
 * 
 * Fluent interface for building complex Elasticsearch queries with
 * proper query structure, filters, aggregations, and search features.
 */
export class SearchQueryBuilder {
  private options: SearchQueryOptions = {};

  /**
   * Set the main search query text
   */
  query(text: string, fields?: string[], fuzziness: 'AUTO' | '0' | '1' | '2' = 'AUTO'): this {
    this.options.query = text;
    this.options.fields = fields;
    this.options.fuzziness = fuzziness;
    return this;
  }

  /**
   * Add term filters (exact matches)
   */
  filterTerms(field: string, values: string[]): this {
    if (!this.options.filters) {
      this.options.filters = {};
    }
    if (!this.options.filters.terms) {
      this.options.filters.terms = {};
    }
    this.options.filters.terms[field] = values;
    return this;
  }

  /**
   * Add range filters (numeric or date ranges)
   */
  filterRange(field: string, range: { gte?: number; lte?: number; gt?: number; lt?: number }): this {
    if (!this.options.filters) {
      this.options.filters = {};
    }
    if (!this.options.filters.range) {
      this.options.filters.range = {};
    }
    this.options.filters.range[field] = range;
    return this;
  }

  /**
   * Add boolean filters (true/false values)
   */
  filterBool(field: string, value: boolean): this {
    if (!this.options.filters) {
      this.options.filters = {};
    }
    if (!this.options.filters.bool) {
      this.options.filters.bool = {};
    }
    this.options.filters.bool[field] = value;
    return this;
  }

  /**
   * Add exists filters (field must have a value)
   */
  filterExists(fields: string[]): this {
    if (!this.options.filters) {
      this.options.filters = {};
    }
    this.options.filters.exists = [...(this.options.filters.exists || []), ...fields];
    return this;
  }

  /**
   * Add missing filters (field must not have a value)
   */
  filterMissing(fields: string[]): this {
    if (!this.options.filters) {
      this.options.filters = {};
    }
    this.options.filters.missing = [...(this.options.filters.missing || []), ...fields];
    return this;
  }

  /**
   * Add sorting configuration
   */
  sortBy(field: string, order: 'asc' | 'desc' = 'desc', mode?: 'min' | 'max' | 'sum' | 'avg' | 'median'): this {
    if (!this.options.sort) {
      this.options.sort = [];
    }
    this.options.sort.push({ field, order, mode });
    return this;
  }

  /**
   * Set pagination parameters
   */
  paginate(from: number = 0, size: number = 20): this {
    this.options.from = from;
    this.options.size = size;
    return this;
  }

  /**
   * Configure result highlighting
   */
  highlightFields(
    fields: string[],
    options: {
      preTags?: string[];
      postTags?: string[];
      fragmentSize?: number;
      numberOfFragments?: number;
    } = {}
  ): this {
    this.options.highlight = {
      fields,
      preTags: options.preTags || ['<mark>'],
      postTags: options.postTags || ['</mark>'],
      fragmentSize: options.fragmentSize || 150,
      numberOfFragments: options.numberOfFragments || 3,
    };
    return this;
  }

  /**
   * Add terms aggregation for faceted search
   */
  aggregateTerms(name: string, field: string, size: number = 10): this {
    if (!this.options.aggregations) {
      this.options.aggregations = {};
    }
    this.options.aggregations[name] = {
      type: 'terms',
      field,
      size,
    };
    return this;
  }

  /**
   * Add range aggregation for numeric facets
   */
  aggregateRange(
    name: string,
    field: string,
    ranges: Array<{ from?: number; to?: number; key?: string }>
  ): this {
    if (!this.options.aggregations) {
      this.options.aggregations = {};
    }
    this.options.aggregations[name] = {
      type: 'range',
      field,
      ranges,
    };
    return this;
  }

  /**
   * Add date histogram aggregation for time-based facets
   */
  aggregateDateHistogram(name: string, field: string, interval: string): this {
    if (!this.options.aggregations) {
      this.options.aggregations = {};
    }
    this.options.aggregations[name] = {
      type: 'date_histogram',
      field,
      interval,
    };
    return this;
  }

  /**
   * Add stats aggregation for numeric statistics
   */
  aggregateStats(name: string, field: string): this {
    if (!this.options.aggregations) {
      this.options.aggregations = {};
    }
    this.options.aggregations[name] = {
      type: 'stats',
      field,
    };
    return this;
  }

  /**
   * Set source field filtering
   */
  source(fields: string[] | boolean): this {
    this.options.source = fields;
    return this;
  }

  /**
   * Set query boost factor
   */
  boost(factor: number): this {
    this.options.boost = factor;
    return this;
  }

  /**
   * Set minimum should match for boolean queries
   */
  minimumShouldMatch(value: string | number): this {
    this.options.minimumShouldMatch = value;
    return this;
  }

  /**
   * Build the final Elasticsearch query
   */
  build(): BuiltQuery {
    const query = this.buildQuery();
    const sort = this.buildSort();
    const highlight = this.buildHighlight();
    const aggs = this.buildAggregations();

    const result: BuiltQuery = { query };

    if (sort && sort.length > 0) {
      result.sort = sort;
    }

    if (this.options.from !== undefined) {
      result.from = this.options.from;
    }

    if (this.options.size !== undefined) {
      result.size = this.options.size;
    }

    if (highlight) {
      result.highlight = highlight;
    }

    if (aggs && Object.keys(aggs).length > 0) {
      result.aggs = aggs;
    }

    if (this.options.source !== undefined) {
      result._source = this.options.source;
    }

    return result;
  }

  /**
   * Build the main query structure
   */
  private buildQuery(): any {
    const boolQuery: any = {
      bool: {
        must: [],
        filter: [],
        should: [],
        must_not: [],
      },
    };

    // Add full-text search query
    if (this.options.query && this.options.query.trim()) {
      const multiMatchQuery: any = {
        multi_match: {
          query: this.options.query.trim(),
          type: 'best_fields',
          fuzziness: this.options.fuzziness || 'AUTO',
        },
      };

      if (this.options.fields && this.options.fields.length > 0) {
        multiMatchQuery.multi_match.fields = this.options.fields;
      }

      if (this.options.boost) {
        multiMatchQuery.multi_match.boost = this.options.boost;
      }

      boolQuery.bool.must.push(multiMatchQuery);
    } else {
      // If no query text, use match_all
      boolQuery.bool.must.push({ match_all: {} });
    }

    // Add filters
    if (this.options.filters) {
      // Term filters
      if (this.options.filters.terms) {
        Object.entries(this.options.filters.terms).forEach(([field, values]) => {
          if (values.length === 1) {
            boolQuery.bool.filter.push({ term: { [field]: values[0] } });
          } else if (values.length > 1) {
            boolQuery.bool.filter.push({ terms: { [field]: values } });
          }
        });
      }

      // Range filters
      if (this.options.filters.range) {
        Object.entries(this.options.filters.range).forEach(([field, range]) => {
          boolQuery.bool.filter.push({ range: { [field]: range } });
        });
      }

      // Boolean filters
      if (this.options.filters.bool) {
        Object.entries(this.options.filters.bool).forEach(([field, value]) => {
          boolQuery.bool.filter.push({ term: { [field]: value } });
        });
      }

      // Exists filters
      if (this.options.filters.exists) {
        this.options.filters.exists.forEach((field) => {
          boolQuery.bool.filter.push({ exists: { field } });
        });
      }

      // Missing filters (must_not exists)
      if (this.options.filters.missing) {
        this.options.filters.missing.forEach((field) => {
          boolQuery.bool.must_not.push({ exists: { field } });
        });
      }
    }

    // Set minimum should match if specified
    if (this.options.minimumShouldMatch !== undefined) {
      boolQuery.bool.minimum_should_match = this.options.minimumShouldMatch;
    }

    // Clean up empty arrays
    Object.keys(boolQuery.bool).forEach((key) => {
      if (Array.isArray(boolQuery.bool[key]) && boolQuery.bool[key].length === 0) {
        delete boolQuery.bool[key];
      }
    });

    return boolQuery;
  }

  /**
   * Build sort configuration
   */
  private buildSort(): any[] | undefined {
    if (!this.options.sort || this.options.sort.length === 0) {
      return undefined;
    }

    return this.options.sort.map((sortConfig) => {
      if (sortConfig.field === '_score' || sortConfig.field === 'relevance') {
        return '_score';
      }

      const sortObj: any = {
        [sortConfig.field]: {
          order: sortConfig.order,
        },
      };

      if (sortConfig.mode) {
        sortObj[sortConfig.field].mode = sortConfig.mode;
      }

      return sortObj;
    });
  }

  /**
   * Build highlight configuration
   */
  private buildHighlight(): any | undefined {
    if (!this.options.highlight) {
      return undefined;
    }

    const highlightConfig: any = {
      pre_tags: this.options.highlight.preTags,
      post_tags: this.options.highlight.postTags,
      fields: {},
    };

    this.options.highlight.fields.forEach((field) => {
      highlightConfig.fields[field] = {
        fragment_size: this.options.highlight!.fragmentSize,
        number_of_fragments: this.options.highlight!.numberOfFragments,
      };
    });

    return highlightConfig;
  }

  /**
   * Build aggregations configuration
   */
  private buildAggregations(): any | undefined {
    if (!this.options.aggregations || Object.keys(this.options.aggregations).length === 0) {
      return undefined;
    }

    const aggs: any = {};

    Object.entries(this.options.aggregations).forEach(([name, aggConfig]) => {
      switch (aggConfig.type) {
        case 'terms':
          aggs[name] = {
            terms: {
              field: aggConfig.field,
              size: aggConfig.size || 10,
            },
          };
          break;

        case 'range':
          aggs[name] = {
            range: {
              field: aggConfig.field,
              ranges: aggConfig.ranges || [],
            },
          };
          break;

        case 'date_histogram':
          aggs[name] = {
            date_histogram: {
              field: aggConfig.field,
              calendar_interval: aggConfig.interval || '1d',
            },
          };
          break;

        case 'stats':
          aggs[name] = {
            stats: {
              field: aggConfig.field,
            },
          };
          break;
      }
    });

    return aggs;
  }

  /**
   * Reset the builder to start fresh
   */
  reset(): this {
    this.options = {};
    return this;
  }

  /**
   * Clone the current builder state
   */
  clone(): SearchQueryBuilder {
    const cloned = new SearchQueryBuilder();
    cloned.options = JSON.parse(JSON.stringify(this.options));
    return cloned;
  }
}

/**
 * Factory function to create a new query builder instance
 */
export function createSearchQueryBuilder(): SearchQueryBuilder {
  return new SearchQueryBuilder();
}

/**
 * Utility function to build a simple full-text search query
 */
export function buildFullTextQuery(
  query: string,
  fields: string[],
  options: {
    fuzziness?: 'AUTO' | '0' | '1' | '2';
    boost?: number;
    from?: number;
    size?: number;
  } = {}
): BuiltQuery {
  return createSearchQueryBuilder()
    .query(query, fields, options.fuzziness)
    .boost(options.boost || 1.0)
    .paginate(options.from || 0, options.size || 20)
    .build();
}

/**
 * Utility function to build a filtered search query
 */
export function buildFilteredQuery(
  query: string,
  fields: string[],
  filters: {
    terms?: Record<string, string[]>;
    range?: Record<string, { gte?: number; lte?: number }>;
    bool?: Record<string, boolean>;
  },
  options: {
    from?: number;
    size?: number;
    sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  } = {}
): BuiltQuery {
  const builder = createSearchQueryBuilder()
    .query(query, fields)
    .paginate(options.from || 0, options.size || 20);

  // Add term filters
  if (filters.terms) {
    Object.entries(filters.terms).forEach(([field, values]) => {
      builder.filterTerms(field, values);
    });
  }

  // Add range filters
  if (filters.range) {
    Object.entries(filters.range).forEach(([field, range]) => {
      builder.filterRange(field, range);
    });
  }

  // Add boolean filters
  if (filters.bool) {
    Object.entries(filters.bool).forEach(([field, value]) => {
      builder.filterBool(field, value);
    });
  }

  // Add sorting
  if (options.sort) {
    options.sort.forEach(({ field, order }) => {
      builder.sortBy(field, order);
    });
  }

  return builder.build();
}

/**
 * Utility function to build a faceted search query with aggregations
 */
export function buildFacetedQuery(
  query: string,
  fields: string[],
  facets: {
    terms?: Array<{ name: string; field: string; size?: number }>;
    ranges?: Array<{ name: string; field: string; ranges: Array<{ from?: number; to?: number; key?: string }> }>;
  },
  options: {
    from?: number;
    size?: number;
    highlight?: string[];
  } = {}
): BuiltQuery {
  const builder = createSearchQueryBuilder()
    .query(query, fields)
    .paginate(options.from || 0, options.size || 20);

  // Add term facets
  if (facets.terms) {
    facets.terms.forEach(({ name, field, size }) => {
      builder.aggregateTerms(name, field, size);
    });
  }

  // Add range facets
  if (facets.ranges) {
    facets.ranges.forEach(({ name, field, ranges }) => {
      builder.aggregateRange(name, field, ranges);
    });
  }

  // Add highlighting
  if (options.highlight) {
    builder.highlightFields(options.highlight);
  }

  return builder.build();
}

/**
 * Utility function to build a course search query with common facets
 */
export function buildCourseSearchQuery(
  query: string,
  filters: {
    category?: string[];
    difficulty?: string[];
    priceRange?: { min?: number; max?: number };
    rating?: { min?: number };
    status?: string[];
  } = {},
  options: {
    from?: number;
    size?: number;
    sort?: { field: string; order: 'asc' | 'desc' };
    includeFacets?: boolean;
    highlight?: boolean;
  } = {}
): BuiltQuery {
  const builder = createSearchQueryBuilder();

  // Set search fields with boosting
  const searchFields = [
    'title^3',
    'description^2',
    'instructorName^2',
    'category',
    'lessonContent',
    'modules.title',
    'modules.description',
  ];

  // Add main query
  if (query.trim()) {
    builder.query(query.trim(), searchFields, 'AUTO');
  } else {
    builder.query('', searchFields);
  }

  // Add filters
  if (filters.category?.length) {
    builder.filterTerms('category', filters.category);
  }

  if (filters.difficulty?.length) {
    builder.filterTerms('difficulty', filters.difficulty);
  }

  if (filters.status?.length) {
    builder.filterTerms('status', filters.status);
  }

  if (filters.priceRange) {
    const priceRange: { gte?: number; lte?: number } = {};
    if (filters.priceRange.min !== undefined) {
      priceRange.gte = filters.priceRange.min;
    }
    if (filters.priceRange.max !== undefined) {
      priceRange.lte = filters.priceRange.max;
    }
    if (Object.keys(priceRange).length > 0) {
      builder.filterRange('price', priceRange);
    }
  }

  if (filters.rating?.min !== undefined) {
    builder.filterRange('averageRating', { gte: filters.rating.min });
  }

  // Add sorting
  if (options.sort) {
    if (options.sort.field === 'relevance') {
      builder.sortBy('_score', options.sort.order);
    } else {
      const sortField = {
        popularity: 'popularityScore',
        rating: 'averageRating',
        price: 'price',
        created: 'createdAt',
        updated: 'updatedAt',
      }[options.sort.field] || options.sort.field;

      builder.sortBy(sortField, options.sort.order);
      builder.sortBy('_score', 'desc'); // Secondary sort by relevance
    }
  }

  // Add pagination
  builder.paginate(options.from || 0, options.size || 20);

  // Add highlighting
  if (options.highlight) {
    builder.highlightFields([
      'title',
      'description',
      'modules.title',
      'modules.description',
    ], {
      preTags: ['<mark>'],
      postTags: ['</mark>'],
      fragmentSize: 150,
      numberOfFragments: 3,
    });
  }

  // Add facets if requested
  if (options.includeFacets) {
    builder
      .aggregateTerms('categories', 'category.keyword', 20)
      .aggregateTerms('difficulties', 'difficulty', 10)
      .aggregateRange('priceRanges', 'price', [
        { key: 'Free', from: 0, to: 0 },
        { key: '$1-$50', from: 1, to: 50 },
        { key: '$51-$100', from: 51, to: 100 },
        { key: '$101-$200', from: 101, to: 200 },
        { key: '$201+', from: 201 },
      ])
      .aggregateRange('ratings', 'averageRating', [
        { key: '4+ stars', from: 4 },
        { key: '3+ stars', from: 3 },
        { key: '2+ stars', from: 2 },
        { key: '1+ stars', from: 1 },
      ]);
  }

  return builder.build();
}

/**
 * Utility function to build a lesson search query
 */
export function buildLessonSearchQuery(
  query: string,
  filters: {
    courseId?: string;
    lessonType?: string[];
    isPreview?: boolean;
  } = {},
  options: {
    from?: number;
    size?: number;
    sort?: { field: string; order: 'asc' | 'desc' };
    highlight?: boolean;
  } = {}
): BuiltQuery {
  const builder = createSearchQueryBuilder();

  // Set search fields with boosting
  const searchFields = [
    'title^3',
    'description^2',
    'contentText^2',
    'courseTitle',
  ];

  // Add main query
  if (query.trim()) {
    builder.query(query.trim(), searchFields, 'AUTO');
  } else {
    builder.query('', searchFields);
  }

  // Add filters
  if (filters.courseId) {
    builder.filterTerms('courseId', [filters.courseId]);
  }

  if (filters.lessonType?.length) {
    builder.filterTerms('lessonType', filters.lessonType);
  }

  if (filters.isPreview !== undefined) {
    builder.filterBool('isPreview', filters.isPreview);
  }

  // Add sorting
  if (options.sort) {
    if (options.sort.field === 'relevance') {
      builder.sortBy('_score', options.sort.order);
    } else {
      const sortField = {
        order: 'orderNumber',
        created: 'createdAt',
        updated: 'updatedAt',
      }[options.sort.field] || options.sort.field;

      builder.sortBy(sortField, options.sort.order);
    }
  }

  // Add secondary sort by order number for consistency
  if (!options.sort || options.sort.field !== 'order') {
    builder.sortBy('orderNumber', 'asc');
  }

  // Add pagination
  builder.paginate(options.from || 0, options.size || 20);

  // Add highlighting
  if (options.highlight) {
    builder.highlightFields([
      'title',
      'description',
      'contentText',
    ], {
      preTags: ['<mark>'],
      postTags: ['</mark>'],
      fragmentSize: 150,
      numberOfFragments: 3,
    });
  }

  return builder.build();
}