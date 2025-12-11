/**
 * Search Repository Implementation
 * 
 * Implements search operations using Elasticsearch client.
 * Provides methods for indexing, searching, and managing documents
 * with proper error handling and performance optimization.
 * 
 * Requirements: 8.1, 8.7
 */

import type { 
  ISearchRepository,
  CourseSearchDocument,
  LessonSearchDocument,
  BulkIndexResult,
  SearchResult,
  IndexStats
} from './ISearchRepository.js';
import { 
  elasticsearch,
  ElasticsearchIndex,
  ElasticsearchAlias,
  bulkIndex,
  deleteByQuery,
  refreshIndices,
  getIndexStats,
  checkElasticsearchHealth
} from './index.js';
import { ExternalServiceError } from '../../shared/errors/index.js';

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
      const bulkDocs = documents.map(doc => ({
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
        { documentCount: documents.length, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Bulk index multiple lesson documents
   */
  async bulkIndexLessons(documents: LessonSearchDocument[]): Promise<BulkIndexResult> {
    try {
      const bulkDocs = documents.map(doc => ({
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
        { documentCount: documents.length, error: error instanceof Error ? error.message : 'Unknown error' }
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

      // Build the search query
      const searchQuery: any = {
        bool: {
          must: [],
          filter: [],
        },
      };

      // Add text search query
      if (query.trim()) {
        searchQuery.bool.must.push({
          multi_match: {
            query: query.trim(),
            fields: [
              'title^3',
              'description^2',
              'instructorName^2',
              'category',
              'lessonContent',
              'modules.title',
              'modules.description',
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      } else {
        searchQuery.bool.must.push({
          match_all: {},
        });
      }

      // Add filters
      if (filters.category?.length) {
        searchQuery.bool.filter.push({
          terms: { category: filters.category },
        });
      }

      if (filters.difficulty?.length) {
        searchQuery.bool.filter.push({
          terms: { difficulty: filters.difficulty },
        });
      }

      if (filters.status?.length) {
        searchQuery.bool.filter.push({
          terms: { status: filters.status },
        });
      }

      if (filters.priceRange) {
        const priceFilter: any = {};
        if (filters.priceRange.min !== undefined) {
          priceFilter.gte = filters.priceRange.min;
        }
        if (filters.priceRange.max !== undefined) {
          priceFilter.lte = filters.priceRange.max;
        }
        if (Object.keys(priceFilter).length > 0) {
          searchQuery.bool.filter.push({
            range: { price: priceFilter },
          });
        }
      }

      if (filters.rating?.min !== undefined) {
        searchQuery.bool.filter.push({
          range: { averageRating: { gte: filters.rating.min } },
        });
      }

      // Build sort configuration
      const sortConfig: any[] = [];
      
      if (sort.field === 'relevance') {
        sortConfig.push('_score');
      } else {
        const sortField = {
          popularity: 'popularityScore',
          rating: 'averageRating',
          price: 'price',
          created: 'createdAt',
          updated: 'updatedAt',
        }[sort.field] || sort.field;

        sortConfig.push({
          [sortField]: { order: sort.order },
        });
      }

      // Add secondary sort by relevance score
      if (sort.field !== 'relevance') {
        sortConfig.push('_score');
      }

      // Build highlight configuration
      const highlightConfig = highlight ? {
        fields: {
          title: {},
          description: {},
          'modules.title': {},
          'modules.description': {},
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      } : undefined;

      // Execute search
      const response = await elasticsearch.search({
        index: ElasticsearchAlias.COURSES,
        body: {
          query: searchQuery,
          sort: sortConfig,
          from: pagination.from,
          size: pagination.size,
          highlight: highlightConfig,
        },
      });

      // Process results
      const documents = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _highlight: hit.highlight,
      }));

      return {
        documents,
        total: typeof response.hits.total === 'number' 
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

      // Build the search query
      const searchQuery: any = {
        bool: {
          must: [],
          filter: [],
        },
      };

      // Add text search query
      if (query.trim()) {
        searchQuery.bool.must.push({
          multi_match: {
            query: query.trim(),
            fields: [
              'title^3',
              'description^2',
              'contentText^2',
              'courseTitle',
            ],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        });
      } else {
        searchQuery.bool.must.push({
          match_all: {},
        });
      }

      // Add filters
      if (filters.courseId) {
        searchQuery.bool.filter.push({
          term: { courseId: filters.courseId },
        });
      }

      if (filters.lessonType?.length) {
        searchQuery.bool.filter.push({
          terms: { lessonType: filters.lessonType },
        });
      }

      if (filters.isPreview !== undefined) {
        searchQuery.bool.filter.push({
          term: { isPreview: filters.isPreview },
        });
      }

      // Build sort configuration
      const sortConfig: any[] = [];
      
      if (sort.field === 'relevance') {
        sortConfig.push('_score');
      } else {
        const sortField = {
          order: 'orderNumber',
          created: 'createdAt',
          updated: 'updatedAt',
        }[sort.field] || sort.field;

        sortConfig.push({
          [sortField]: { order: sort.order },
        });
      }

      // Add secondary sort by order number for consistency
      if (sort.field !== 'order') {
        sortConfig.push({
          orderNumber: { order: 'asc' },
        });
      }

      // Build highlight configuration
      const highlightConfig = highlight ? {
        fields: {
          title: {},
          description: {},
          contentText: {},
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
      } : undefined;

      // Execute search
      const response = await elasticsearch.search({
        index: ElasticsearchAlias.LESSONS,
        body: {
          query: searchQuery,
          sort: sortConfig,
          from: pagination.from,
          size: pagination.size,
          highlight: highlightConfig,
        },
      });

      // Process results
      const documents = response.hits.hits.map((hit: any) => ({
        ...hit._source,
        _highlight: hit.highlight,
      }));

      return {
        documents,
        total: typeof response.hits.total === 'number' 
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