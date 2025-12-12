/**
 * Search Service Implementation
 * 
 * Implements search operations using Elasticsearch through the search repository.
 * Provides methods for indexing content, performing searches with filters and facets,
 * autocomplete functionality, and trending search management.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import type { ISearchRepository, CourseSearchDocument, LessonSearchDocument, SearchResult } from '../../../../infrastructure/search/ISearchRepository.js';
import { ExternalServiceError } from '../../../../shared/errors/index.js';
import { comprehensiveCacheService } from '../../../../shared/services/ComprehensiveCacheService.js';
import type { Course } from '../../../courses/domain/entities/Course.js';
import type { Lesson } from '../../../courses/domain/entities/Lesson.js';

import type {
  ISearchService,
  SearchFilters,
  PaginationDTO,
  SortOptions,
  SearchResults,
  SearchFacets,
  CourseSearchResult,
  LessonSearchResult,
} from './ISearchService.js';

/**
 * Search Service Implementation
 * 
 * Concrete implementation of ISearchService that orchestrates search operations
 * through the search repository and provides business logic for search features.
 */
export class SearchService implements ISearchService {
  constructor(
    private readonly searchRepository: ISearchRepository
  ) {}

  // Content indexing operations

  /**
   * Index a course for full-text search
   */
  async indexCourse(course: Course): Promise<void> {
    try {
      // Transform course entity to search document
      const searchDocument = this.transformCourseToSearchDocument(course);
      
      // Index the document
      const success = await this.searchRepository.indexCourse(searchDocument);
      
      if (!success) {
        throw new ExternalServiceError(
          'Elasticsearch',
          'Failed to index course document'
        );
      }
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to index course',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Index a lesson for full-text search
   */
  async indexLesson(lesson: Lesson): Promise<void> {
    try {
      // Transform lesson entity to search document
      const searchDocument = this.transformLessonToSearchDocument(lesson);
      
      // Index the document
      const success = await this.searchRepository.indexLesson(searchDocument);
      
      if (!success) {
        throw new ExternalServiceError(
          'Elasticsearch',
          'Failed to index lesson document'
        );
      }
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to index lesson',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  // Search operations

  /**
   * Search courses with filters and facets
   * 
   * Implements caching with 5-minute TTL and cache stampede prevention
   */
  async searchCourses(
    query: string,
    filters: SearchFilters = {},
    pagination: PaginationDTO = { from: 0, size: 20 },
    sort: SortOptions = { field: 'relevance', order: 'desc' },
    includeFacets: boolean = true
  ): Promise<SearchResults<CourseSearchResult>> {
    try {
      // Create cache key from search parameters
      const filtersKey = JSON.stringify({ filters, sort, includeFacets });
      const page = Math.floor((pagination.from || 0) / (pagination.size || 20)) + 1;
      
      // Check cache first
      const cached = await comprehensiveCacheService.getCachedSearchResults<SearchResults<CourseSearchResult>>(
        query, 
        filtersKey, 
        page
      );
      
      if (cached) {
        return cached;
      }

      // Use cache stampede prevention for expensive search operations
      const searchResult = await comprehensiveCacheService.withStampedePrevention(
        `search:courses:${query}:${filtersKey}:${page}`,
        async () => {
          // Build search options for repository
          const searchOptions = {
            filters: {
              category: filters.category,
              difficulty: filters.difficulty,
              priceRange: filters.priceRange,
              rating: filters.rating,
              status: filters.status || ['published'], // Default to published courses only
            },
            sort: {
              field: this.mapSortField(sort.field),
              order: sort.order,
            },
            pagination,
            highlight: true, // Enable highlighting for better UX
            includeFacets, // Pass facets flag to repository
          };

          // Perform search with facets
          const result = await this.searchCoursesWithFacets(query, searchOptions);

          // Transform results
          const transformedResults: SearchResults<CourseSearchResult> = {
            documents: result.documents.map((doc: CourseSearchDocument & { _highlight?: Record<string, string[]> }) => this.transformCourseSearchDocument(doc)),
            total: result.total,
            took: result.took,
            maxScore: result.maxScore,
            facets: result.facets,
          };

          // Add autocomplete suggestions for empty or short queries
          if (query.trim().length <= 2) {
            transformedResults.suggestions = await this.autocomplete(query, 5);
          }

          return transformedResults;
        }
      );

      // Cache the result
      await comprehensiveCacheService.cacheSearchResults(query, filtersKey, page, searchResult);

      return searchResult;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to search courses',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Search lessons within a specific course or across all courses
   */
  async searchLessons(
    query: string,
    courseId?: string,
    pagination: PaginationDTO = { from: 0, size: 20 }
  ): Promise<SearchResults<LessonSearchResult>> {
    try {
      // Build search options for repository
      const searchOptions = {
        filters: {
          courseId,
          // Only include non-preview lessons unless specifically searching within a course
          isPreview: courseId ? undefined : false,
        },
        sort: {
          field: 'relevance' as const,
          order: 'desc' as const,
        },
        pagination,
        highlight: true,
      };

      // Perform search
      const searchResult = await this.searchRepository.searchLessons(query, searchOptions);

      // Transform results
      return {
        documents: searchResult.documents.map((doc: LessonSearchDocument & { _highlight?: Record<string, string[]> }) => this.transformLessonSearchDocument(doc)),
        total: searchResult.total,
        took: searchResult.took,
        maxScore: searchResult.maxScore,
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to search lessons',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Get autocomplete suggestions for search queries
   * 
   * Implements caching with 5-minute TTL for better performance
   */
  async autocomplete(query: string, limit: number = 10): Promise<string[]> {
    try {
      if (!query.trim()) {
        return [];
      }

      // Check cache first
      const cached = await comprehensiveCacheService.getCachedAutocomplete(query);
      if (cached) {
        return cached.slice(0, limit);
      }

      // Use course search with completion suggester
      // This is a simplified implementation - in production, you might want
      // to use Elasticsearch's completion suggester or maintain a separate
      // suggestions index
      const searchResult = await this.searchRepository.searchCourses(query, {
        pagination: { from: 0, size: limit },
        sort: { field: 'popularity', order: 'desc' },
      });

      // Extract unique suggestions from course titles and categories
      const suggestions = new Set<string>();
      
      searchResult.documents.forEach(course => {
        // Add course title words
        const titleWords = course.title.toLowerCase().split(/\s+/);
        titleWords.forEach(word => {
          if (word.startsWith(query.toLowerCase()) && word.length > query.length) {
            suggestions.add(word);
          }
        });
        
        // Add category if it matches
        if (course.category.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(course.category);
        }
        
        // Add instructor name if it matches
        if (course.instructorName.toLowerCase().includes(query.toLowerCase())) {
          suggestions.add(course.instructorName);
        }
      });

      const result = Array.from(suggestions).slice(0, limit);
      
      // Cache the result
      await comprehensiveCacheService.cacheAutocomplete(query, result);

      return result;
    } catch (error) {
      // Don't throw errors for autocomplete - return empty array instead
      console.error('Autocomplete failed:', error);
      return [];
    }
  }

  /**
   * Get trending search terms based on recent search activity
   * 
   * Implements caching with 30-minute TTL for trending data
   */
  async getTrendingSearches(limit: number = 10): Promise<string[]> {
    try {
      // Check cache first
      const cached = await comprehensiveCacheService.getCachedTrendingSearches();
      if (cached) {
        return cached.slice(0, limit);
      }

      // This is a simplified implementation
      // In production, you would track search queries and their frequency
      // For now, return popular course categories and trending topics
      
      const trendingTerms = [
        'javascript',
        'python',
        'react',
        'machine learning',
        'web development',
        'data science',
        'nodejs',
        'typescript',
        'artificial intelligence',
        'cloud computing',
        'cybersecurity',
        'mobile development',
        'devops',
        'blockchain',
        'ui/ux design',
      ];

      const result = trendingTerms.slice(0, limit);
      
      // Cache the result
      await comprehensiveCacheService.cacheTrendingSearches(result);

      return result;
    } catch (error) {
      console.error('Failed to get trending searches:', error);
      // Return fallback data
      return [
        'javascript',
        'python',
        'react',
        'machine learning',
        'web development',
      ].slice(0, limit);
    }
  }

  // Index management operations

  /**
   * Remove a course from the search index
   */
  async removeCourse(courseId: string): Promise<void> {
    try {
      await this.searchRepository.deleteCourse(courseId);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to remove course from search index',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Remove a lesson from the search index
   */
  async removeLesson(lessonId: string): Promise<void> {
    try {
      await this.searchRepository.deleteLesson(lessonId);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to remove lesson from search index',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Remove all lessons for a specific course from the search index
   */
  async removeLessonsByCourse(courseId: string): Promise<number> {
    try {
      return await this.searchRepository.deleteLessonsByCourse(courseId);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to remove lessons from search index',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Refresh search indices to make recent changes searchable
   */
  async refreshIndices(): Promise<void> {
    try {
      await this.searchRepository.refreshIndices();
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError(
        'SearchService',
        'Failed to refresh search indices',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Get search index health and statistics
   */
  async getSearchHealth(): Promise<{
    healthy: boolean;
    indices: {
      courses: boolean;
      lessons: boolean;
    };
    statistics?: {
      coursesIndexed: number;
      lessonsIndexed: number;
    };
    error?: string;
  }> {
    try {
      const health = await this.searchRepository.checkHealth();
      
      // Get index statistics if healthy
      let statistics;
      if (health.healthy) {
        try {
          const [courseStats, lessonStats] = await Promise.all([
            this.searchRepository.getIndexStats('courses'),
            this.searchRepository.getIndexStats('lessons'),
          ]);
          
          statistics = {
            coursesIndexed: courseStats.documentCount,
            lessonsIndexed: lessonStats.documentCount,
          };
        } catch (statsError) {
          // Don't fail health check if stats retrieval fails
          console.warn('Failed to get index statistics:', statsError);
        }
      }

      return {
        healthy: health.healthy,
        indices: health.indices,
        statistics,
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

  // Private helper methods

  /**
   * Transform course entity to search document
   */
  private transformCourseToSearchDocument(course: Course): CourseSearchDocument {
    // This would typically involve fetching additional data like instructor name,
    // aggregating lesson content, calculating popularity scores, etc.
    // For now, we'll create a basic transformation
    
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      slug: course.slug,
      instructorId: course.instructorId,
      instructorName: 'Instructor Name', // TODO: Fetch from user service
      category: course.category,
      difficulty: course.difficulty,
      price: parseFloat(course.price.toString()),
      currency: course.currency,
      status: course.status,
      enrollmentCount: course.enrollmentCount,
      averageRating: course.averageRating ? parseFloat(course.averageRating.toString()) : undefined,
      totalReviews: course.totalReviews,
      publishedAt: course.publishedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      modules: [], // TODO: Fetch and transform modules
      lessonContent: '', // TODO: Aggregate lesson content
      searchBoost: 1.0,
      popularityScore: course.enrollmentCount * (course.averageRating ? parseFloat(course.averageRating.toString()) : 1),
      recentEnrollmentVelocity: 0, // TODO: Calculate based on recent enrollments
    };
  }

  /**
   * Transform lesson entity to search document
   */
  private transformLessonToSearchDocument(lesson: Lesson): LessonSearchDocument {
    // This would typically involve fetching course context data
    // For now, we'll create a basic transformation
    
    return {
      id: lesson.id,
      moduleId: lesson.moduleId,
      courseId: 'course-id', // TODO: Fetch from module relationship
      title: lesson.title,
      description: lesson.description,
      lessonType: lesson.type,
      contentText: lesson.contentText,
      durationMinutes: lesson.durationMinutes,
      orderNumber: lesson.orderNumber,
      isPreview: lesson.isPreview,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
      courseTitle: 'Course Title', // TODO: Fetch from course
      courseCategory: 'Category', // TODO: Fetch from course
      courseDifficulty: 'beginner', // TODO: Fetch from course
    };
  }

  /**
   * Transform course search document to result
   */
  private transformCourseSearchDocument(doc: CourseSearchDocument & { _highlight?: Record<string, string[]> }): CourseSearchResult {
    return {
      ...doc,
      _highlight: doc._highlight,
    };
  }

  /**
   * Transform lesson search document to result
   */
  private transformLessonSearchDocument(doc: LessonSearchDocument & { _highlight?: Record<string, string[]> }): LessonSearchResult {
    return {
      ...doc,
      _highlight: doc._highlight,
    };
  }

  /**
   * Map sort field from service interface to repository interface
   */
  private mapSortField(field: string): 'relevance' | 'popularity' | 'rating' | 'price' | 'created' | 'updated' {
    switch (field) {
      case 'trending':
        return 'popularity'; // Map trending to popularity for now
      default:
        return field as 'relevance' | 'popularity' | 'rating' | 'price' | 'created' | 'updated';
    }
  }

  /**
   * Search courses with facets using query builder
   */
  private async searchCoursesWithFacets(
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
      includeFacets?: boolean;
    }
  ): Promise<SearchResult<CourseSearchDocument> & { facets?: SearchFacets }> {
    // If facets are not requested, use the regular search
    if (!options.includeFacets) {
      return await this.searchRepository.searchCourses(query, options);
    }

    // Use the repository's faceted search method
    const searchResult = await (this.searchRepository as any).searchCoursesWithFacets(query, options);
    
    // Transform facets to the expected format
    const facets: SearchFacets = {
      categories: searchResult.facets.categories,
      difficulties: searchResult.facets.difficulties,
      priceRanges: searchResult.facets.priceRanges,
      ratings: searchResult.facets.ratings,
      languages: [
        { key: 'English', count: 350 },
        { key: 'Spanish', count: 45 },
        { key: 'French', count: 23 },
        { key: 'German', count: 18 },
        { key: 'Portuguese', count: 12 },
        { key: 'Italian', count: 8 },
      ], // Static for now, would be from aggregations in real implementation
    };

    return {
      ...searchResult,
      facets,
    };
  }

  /**
   * Generate facets for course search using aggregations
   */
  private async generateCourseFacets(
    _query: string, 
    _currentFilters: {
      category?: string[];
      difficulty?: string[];
      priceRange?: { min?: number; max?: number };
      rating?: { min?: number };
      status?: string[];
    }
  ): Promise<SearchFacets> {
    // This is a simplified implementation that returns static facets
    // In a production system, you would:
    // 1. Execute a separate aggregation query to get real facet counts
    // 2. Use the SearchQueryBuilder to build faceted queries
    // 3. Parse Elasticsearch aggregation results
    
    // For now, return realistic static facets
    return {
      categories: [
        { key: 'Web Development', count: 150 },
        { key: 'Data Science', count: 89 },
        { key: 'Mobile Development', count: 67 },
        { key: 'Machine Learning', count: 45 },
        { key: 'DevOps', count: 34 },
        { key: 'Design', count: 28 },
        { key: 'Business', count: 22 },
        { key: 'Marketing', count: 18 },
      ],
      difficulties: [
        { key: 'beginner', count: 200 },
        { key: 'intermediate', count: 120 },
        { key: 'advanced', count: 65 },
      ],
      priceRanges: [
        { key: 'Free', count: 85, from: 0, to: 0 },
        { key: '$1-$50', count: 120, from: 1, to: 50 },
        { key: '$51-$100', count: 95, from: 51, to: 100 },
        { key: '$101-$200', count: 65, from: 101, to: 200 },
        { key: '$201+', count: 20, from: 201 },
      ],
      ratings: [
        { key: '4+ stars', count: 250, from: 4 },
        { key: '3+ stars', count: 320, from: 3 },
        { key: '2+ stars', count: 365, from: 2 },
        { key: '1+ stars', count: 385, from: 1 },
      ],
      languages: [
        { key: 'English', count: 350 },
        { key: 'Spanish', count: 45 },
        { key: 'French', count: 23 },
        { key: 'German', count: 18 },
        { key: 'Portuguese', count: 12 },
        { key: 'Italian', count: 8 },
      ],
    };
  }
}