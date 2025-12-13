/**
 * Search Repository Implementation
 *
 * Implements search operations using Elasticsearch client.
 * Provides methods for indexing, searching, and managing documents
 * with proper error handling and performance optimization.
 *
 * Requirements: 8.1, 8.7
 */

import {
  elasticsearch,
  ElasticsearchIndex,
  ElasticsearchAlias,
  bulkIndex,
  deleteByQuery,
  refreshIndices,
  getIndexStats,
  checkElasticsearchHealth,
} from './index.js';

import { ExternalServiceError } from '../../shared/errors/index.js';
import { createSearchQueryBuilder } from '../../modules/search/infrastructure/query/SearchQueryBuilder.js';

import type {
  ISearchRepository,
  CourseSearchDocument,
  LessonSearchDocument,
  BulkIndexResult,
  SearchResult,
  IndexStats,
} from './ISearchRepository.js';

/**
 * Search Repository Implementation
 *
 * Concrete implementation of ISearchRepository using Elasticsearch.
 * Handles all search operations with proper error handling and logging.
 */
export class SearchRepository implements ISearchRepository {
  // Document indexing operations

  /**
   * Index a single course document
   */
  async indexCourse(document: CourseSearchDocument): Promise<boolean> {
    try {
      const response = await elasticsearch.index({
        index: ElasticsearchAlias.COURSES,
        id: document.id,
        body: document,
        refresh: 'wait_for',
      });

      return response.result === 'created' || response.result === 'updated';
    } catch (error) {
      console.error('Failed to index course:', error);
      throw new ExternalServiceError(
        'Failed to index course document',
        'ELASTICSEARCH_INDEX_ERROR',
        { courseId: document.id, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Index a single lesson document
   */
  async indexLesson(document: LessonSearchDocument): Promise<boolean> {
    try {
      const response = await elasticsearch.index({
        index: ElasticsearchAlias.LESSONS,
        id: document.id,
        body: document,
        refresh: 'wait_for',
      });

      return response.result === 'created' || response.result === 'updated';
    } catch (error) {
      console.error('Failed to index lesson:', error);
      throw new ExternalServiceError(
        'Failed to index lesson document',
        'ELASTICSEARCH_INDEX_ERROR',
        { lessonId: document.id, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Bulk index multiple course documents
   */
  async bulkIndexCourses(documents: CourseSearchDocument[]): Promise<BulkIndexResult> {
    try {
      const bulkDocs = documents.map((doc) => ({
        id: doc.id,
        body: doc,
      }));

      const result = await bulkIndex(ElasticsearchAlias.COURSES, bulkDocs);

      return {
        success: result.success,
        indexed: result.indexed,
        errors: result.errors.map((error, index) => ({
          id: documents[index]?.id || 'unknown',
          error: typeof error === 'string' ? error : JSON.stringify(error),
        })),
      };
    } catch (error) {
      console.error('Failed to bulk index courses:', error);
      throw new ExternalServiceError(
        'Failed to bulk index course documents',
        'ELASTICSEARCH_BULK_INDEX_ERROR',
        {
          documentCount: documents.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Bulk index multiple lesson documents
   */
  async bulkIndexLessons(documents: LessonSearchDocument[]): Promise<BulkIndexResult> {
    try {
      const bulkDocs = documents.map((doc) => ({
        id: doc.id,
        body: doc,
      }));

      const result = await bulkIndex(ElasticsearchAlias.LESSONS, bulkDocs);

      return {
        success: result.success,
        indexed: result.indexed,
        errors: result.errors.map((error, index) => ({
          id: documents[index]?.id || 'unknown',
          error: typeof error === 'string' ? error : JSON.stringify(error),
        })),
      };
    } catch (error) {
      console.error('Failed to bulk index lessons:', error);
      throw new ExternalServiceError(
        'Failed to bulk index lesson documents',
        'ELASTICSEARCH_BULK_INDEX_ERROR',
        {
          documentCount: documents.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  // Document search operations

  /**
   * Search courses with query and filters
   */
  async searchCourses(
    query: string,
    options: {
      filters?: {
        category?: string[];
        difficulty?: string[];
        priceRange?: { min?: number; max?: number };
        rating?: { min?: number };
        status?: string[];
      };
      sort?: {
        field: 'relevance' | 'popularity' | 'rating' | 'price' | 'created' | 'updated';
        order: 'asc' | 'desc';
      };
      pagination?: {
        from?: number;
        size?: number;
      };
      highlight?: boolean;
    } = {}
  ): Promise<SearchResult<CourseSearchDocument>> {
    try {
      const {
        filters = {},
        sort = { field: 'relevance', order: 'desc' },
        pagination = { from: 0, size: 20 },
        highlight = false,
      } = options;

      // Build query using SearchQueryBuilder
      const queryBuilder = createSearchQueryBuilder();

      // Set main search query with boosted fields
      const searchFields = [
        'title^3',
        'description^2',
        'instructorName^2',
        'category',
        'lessonContent',
        'modules.title',
        'modules.description',
      ];

      if (query.trim()) {
        queryBuilder.query(query.trim(), searchFields, 'AUTO');
      } else {
        queryBuilder.query('', searchFields); // Will use match_all internally
      }

      // Add filters
      if (filters.category?.length) {
        queryBuilder.filterTerms('category', filters.category);
      }

      if (filters.difficulty?.length) {
        queryBuilder.filterTerms('difficulty', filters.difficulty);
      }

      if (filters.status?.length) {
        queryBuilder.filterTerms('status', filters.status);
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
          queryBuilder.filterRange('price', priceRange);
        }
      }

      if (filters.rating?.min !== undefined) {
        queryBuilder.filterRange('averageRating', { gte: filters.rating.min });
      }

      // Add sorting
      if (sort.field === 'relevance') {
        queryBuilder.sortBy('_score', sort.order);
      } else {
        const sortField =
          {
            popularity: 'popularityScore',
            rating: 'averageRating',
            price: 'price',
            created: 'createdAt',
            updated: 'updatedAt',
          }[sort.field] || sort.field;

        queryBuilder.sortBy(sortField, sort.order);

        // Add secondary sort by relevance score
        queryBuilder.sortBy('_score', 'desc');
      }

      // Add pagination
      queryBuilder.paginate(pagination.from || 0, pagination.size || 20);

      // Add highlighting
      if (highlight) {
        queryBuilder.highlightFields(
          ['title', 'description', 'modules.title', 'modules.description'],
          {
            preTags: ['<mark>'],
            postTags: ['</mark>'],
            fragmentSize: 150,
            numberOfFragments: 3,
          }
        );
      }

      // Build the final query
      const builtQuery = queryBuilder.build();

      // Execute search
      const response = await elasticsearch.search({
        index: ElasticsearchAlias.COURSES,
        body: builtQuery,
      });

      // Process results
      const documents = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _highlight: hit.highlight,
      }));

      return {
        documents,
        total:
          typeof response.hits.total === 'number'
            ? response.hits.total
            : response.hits.total?.value || 0,
        took: response.took,
        maxScore: response.hits.max_score,
      };
    } catch (error) {
      console.error('Failed to search courses:', error);
      throw new ExternalServiceError(
        'Failed to search course documents',
        'ELASTICSEARCH_SEARCH_ERROR',
        { query, options, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Search lessons with query and filters
   */
  async searchLessons(
    query: string,
    options: {
      filters?: {
        courseId?: string;
        lessonType?: string[];
        isPreview?: boolean;
      };
      sort?: {
        field: 'relevance' | 'order' | 'created' | 'updated';
        order: 'asc' | 'desc';
      };
      pagination?: {
        from?: number;
        size?: number;
      };
      highlight?: boolean;
    } = {}
  ): Promise<SearchResult<LessonSearchDocument>> {
    try {
      const {
        filters = {},
        sort = { field: 'relevance', order: 'desc' },
        pagination = { from: 0, size: 20 },
        highlight = false,
      } = options;

      // Build query using SearchQueryBuilder
      const queryBuilder = createSearchQueryBuilder();

      // Set main search query with boosted fields
      const searchFields = ['title^3', 'description^2', 'contentText^2', 'courseTitle'];

      if (query.trim()) {
        queryBuilder.query(query.trim(), searchFields, 'AUTO');
      } else {
        queryBuilder.query('', searchFields); // Will use match_all internally
      }

      // Add filters
      if (filters.courseId) {
        queryBuilder.filterTerms('courseId', [filters.courseId]);
      }

      if (filters.lessonType?.length) {
        queryBuilder.filterTerms('lessonType', filters.lessonType);
      }

      if (filters.isPreview !== undefined) {
        queryBuilder.filterBool('isPreview', filters.isPreview);
      }

      // Add sorting
      if (sort.field === 'relevance') {
        queryBuilder.sortBy('_score', sort.order);
      } else {
        const sortField =
          {
            order: 'orderNumber',
            created: 'createdAt',
            updated: 'updatedAt',
          }[sort.field] || sort.field;

        queryBuilder.sortBy(sortField, sort.order);
      }

      // Add secondary sort by order number for consistency
      if (sort.field !== 'order') {
        queryBuilder.sortBy('orderNumber', 'asc');
      }

      // Add pagination
      queryBuilder.paginate(pagination.from || 0, pagination.size || 20);

      // Add highlighting
      if (highlight) {
        queryBuilder.highlightFields(['title', 'description', 'contentText'], {
          preTags: ['<mark>'],
          postTags: ['</mark>'],
          fragmentSize: 150,
          numberOfFragments: 3,
        });
      }

      // Build the final query
      const builtQuery = queryBuilder.build();

      // Execute search
      const response = await elasticsearch.search({
        index: ElasticsearchAlias.LESSONS,
        body: builtQuery,
      });

      // Process results
      const documents = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _highlight: hit.highlight,
      }));

      return {
        documents,
        total:
          typeof response.hits.total === 'number'
            ? response.hits.total
            : response.hits.total?.value || 0,
        took: response.took,
        maxScore: response.hits.max_score,
      };
    } catch (error) {
      console.error('Failed to search lessons:', error);
      throw new ExternalServiceError(
        'Failed to search lesson documents',
        'ELASTICSEARCH_SEARCH_ERROR',
        { query, options, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // Document deletion operations

  /**
   * Delete a course document by ID
   */
  async deleteCourse(courseId: string): Promise<boolean> {
    try {
      const response = await elasticsearch.delete({
        index: ElasticsearchAlias.COURSES,
        id: courseId,
        refresh: 'wait_for',
      });

      return response.result === 'deleted';
    } catch (error: any) {
      // Handle case where document doesn't exist
      if (error.statusCode === 404) {
        return false;
      }

      console.error('Failed to delete course:', error);
      throw new ExternalServiceError(
        'Failed to delete course document',
        'ELASTICSEARCH_DELETE_ERROR',
        { courseId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Delete a lesson document by ID
   */
  async deleteLesson(lessonId: string): Promise<boolean> {
    try {
      const response = await elasticsearch.delete({
        index: ElasticsearchAlias.LESSONS,
        id: lessonId,
        refresh: 'wait_for',
      });

      return response.result === 'deleted';
    } catch (error: any) {
      // Handle case where document doesn't exist
      if (error.statusCode === 404) {
        return false;
      }

      console.error('Failed to delete lesson:', error);
      throw new ExternalServiceError(
        'Failed to delete lesson document',
        'ELASTICSEARCH_DELETE_ERROR',
        { lessonId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Delete all lessons for a specific course
   */
  async deleteLessonsByCourse(courseId: string): Promise<number> {
    try {
      const result = await deleteByQuery(ElasticsearchAlias.LESSONS, {
        term: { courseId },
      });

      if (!result.success) {
        throw new Error(result.error || 'Delete by query failed');
      }

      return result.deleted;
    } catch (error) {
      console.error('Failed to delete lessons by course:', error);
      throw new ExternalServiceError(
        'Failed to delete lessons for course',
        'ELASTICSEARCH_DELETE_ERROR',
        { courseId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  // Index management operations

  /**
   * Refresh indices to make recent changes searchable
   */
  async refreshIndices(indices?: string[]): Promise<void> {
    try {
      await refreshIndices(indices);
    } catch (error) {
      console.error('Failed to refresh indices:', error);
      throw new ExternalServiceError(
        'Failed to refresh search indices',
        'ELASTICSEARCH_REFRESH_ERROR',
        { indices, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get statistics for a specific index
   */
  async getIndexStats(indexName: string): Promise<IndexStats> {
    try {
      return await getIndexStats(indexName);
    } catch (error) {
      console.error('Failed to get index stats:', error);
      throw new ExternalServiceError(
        'Failed to get index statistics',
        'ELASTICSEARCH_STATS_ERROR',
        { indexName, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Check if indices exist and are healthy
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    indices: {
      courses: boolean;
      lessons: boolean;
    };
    error?: string;
  }> {
    try {
      const health = await checkElasticsearchHealth();

      return {
        healthy: health.healthy,
        indices: health.indices || { courses: false, lessons: false },
        error: health.error,
      };
    } catch (error) {
      return {
        healthy: false,
        indices: { courses: false, lessons: false },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search courses with faceted aggregations
   */
  async searchCoursesWithFacets(
    query: string,
    options: {
      filters?: {
        category?: string[];
        difficulty?: string[];
        priceRange?: { min?: number; max?: number };
        rating?: { min?: number };
        status?: string[];
      };
      sort?: {
        field: 'relevance' | 'popularity' | 'rating' | 'price' | 'created' | 'updated';
        order: 'asc' | 'desc';
      };
      pagination?: {
        from?: number;
        size?: number;
      };
      highlight?: boolean;
    } = {}
  ): Promise<
    SearchResult<CourseSearchDocument> & {
      facets: {
        categories: Array<{ key: string; count: number }>;
        difficulties: Array<{ key: string; count: number }>;
        priceRanges: Array<{ key: string; count: number; from?: number; to?: number }>;
        ratings: Array<{ key: string; count: number; from?: number }>;
      };
    }
  > {
    try {
      const {
        filters = {},
        sort = { field: 'relevance', order: 'desc' },
        pagination = { from: 0, size: 20 },
        highlight = false,
      } = options;

      // Build query using SearchQueryBuilder with facets
      const queryBuilder = createSearchQueryBuilder();

      // Set main search query with boosted fields
      const searchFields = [
        'title^3',
        'description^2',
        'instructorName^2',
        'category',
        'lessonContent',
        'modules.title',
        'modules.description',
      ];

      if (query.trim()) {
        queryBuilder.query(query.trim(), searchFields, 'AUTO');
      } else {
        queryBuilder.query('', searchFields);
      }

      // Add filters
      if (filters.category?.length) {
        queryBuilder.filterTerms('category', filters.category);
      }

      if (filters.difficulty?.length) {
        queryBuilder.filterTerms('difficulty', filters.difficulty);
      }

      if (filters.status?.length) {
        queryBuilder.filterTerms('status', filters.status);
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
          queryBuilder.filterRange('price', priceRange);
        }
      }

      if (filters.rating?.min !== undefined) {
        queryBuilder.filterRange('averageRating', { gte: filters.rating.min });
      }

      // Add sorting
      if (sort.field === 'relevance') {
        queryBuilder.sortBy('_score', sort.order);
      } else {
        const sortField =
          {
            popularity: 'popularityScore',
            rating: 'averageRating',
            price: 'price',
            created: 'createdAt',
            updated: 'updatedAt',
          }[sort.field] || sort.field;

        queryBuilder.sortBy(sortField, sort.order);
        queryBuilder.sortBy('_score', 'desc');
      }

      // Add pagination
      queryBuilder.paginate(pagination.from || 0, pagination.size || 20);

      // Add highlighting
      if (highlight) {
        queryBuilder.highlightFields(
          ['title', 'description', 'modules.title', 'modules.description'],
          {
            preTags: ['<mark>'],
            postTags: ['</mark>'],
            fragmentSize: 150,
            numberOfFragments: 3,
          }
        );
      }

      // Add facet aggregations
      queryBuilder
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

      // Build the final query
      const builtQuery = queryBuilder.build();

      // Execute search
      const response = await elasticsearch.search({
        index: ElasticsearchAlias.COURSES,
        body: builtQuery,
      });

      // Process results
      const documents = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _highlight: hit.highlight,
      }));

      // Process facets from aggregations
      const facets = {
        categories: this.processFacetAggregation(response.aggregations?.categories),
        difficulties: this.processFacetAggregation(response.aggregations?.difficulties),
        priceRanges: this.processRangeFacetAggregation(response.aggregations?.priceRanges),
        ratings: this.processRangeFacetAggregation(response.aggregations?.ratings),
      };

      return {
        documents,
        total:
          typeof response.hits.total === 'number'
            ? response.hits.total
            : response.hits.total?.value || 0,
        took: response.took,
        maxScore: response.hits.max_score,
        facets,
      };
    } catch (error) {
      console.error('Failed to search courses with facets:', error);
      throw new ExternalServiceError(
        'Failed to search course documents with facets',
        'ELASTICSEARCH_SEARCH_ERROR',
        { query, options, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Process terms aggregation into facet format
   */
  private processFacetAggregation(aggregation: any): Array<{ key: string; count: number }> {
    if (!aggregation?.buckets) {
      return [];
    }

    return aggregation.buckets.map((bucket: any) => ({
      key: bucket.key,
      count: bucket.doc_count,
    }));
  }

  /**
   * Process range aggregation into facet format
   */
  private processRangeFacetAggregation(
    aggregation: any
  ): Array<{ key: string; count: number; from?: number; to?: number }> {
    if (!aggregation?.buckets) {
      return [];
    }

    return aggregation.buckets.map((bucket: unknown) => ({
      key: bucket.key,
      count: bucket.doc_count,
      from: bucket.from,
      to: bucket.to,
    }));
  }

  /**
   * Perform bulk reindexing for initial data load
   */
  async bulkReindex(type: 'courses' | 'lessons' | 'all'): Promise<{
    success: boolean;
    coursesIndexed?: number;
    lessonsIndexed?: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let coursesIndexed = 0;
    let lessonsIndexed = 0;

    try {
      // This is a placeholder implementation
      // In a real implementation, this would:
      // 1. Query the database for all courses/lessons
      // 2. Transform them to search documents
      // 3. Bulk index them in batches
      // 4. Handle errors and retries

      console.log(`Starting bulk reindex for: ${type}`);

      if (type === 'courses' || type === 'all') {
        // TODO: Implement course reindexing
        // This would typically involve:
        // - Querying all published courses from database
        // - Transforming to CourseSearchDocument format
        // - Bulk indexing in batches of 100-500 documents
        console.log('Course reindexing not yet implemented');
        errors.push('Course reindexing not yet implemented');
      }

      if (type === 'lessons' || type === 'all') {
        // TODO: Implement lesson reindexing
        // This would typically involve:
        // - Querying all lessons from database with course context
        // - Transforming to LessonSearchDocument format
        // - Bulk indexing in batches of 100-500 documents
        console.log('Lesson reindexing not yet implemented');
        errors.push('Lesson reindexing not yet implemented');
      }

      return {
        success: errors.length === 0,
        coursesIndexed,
        lessonsIndexed,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Bulk reindex failed:', error);
      errors.push(errorMessage);

      return {
        success: false,
        coursesIndexed,
        lessonsIndexed,
        errors,
      };
    }
  }
}
