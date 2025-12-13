/**
 * Search Service Interface
 *
 * Defines the contract for search operations in the application layer.
 * Provides methods for indexing content and performing searches with
 * filters, facets, autocomplete, and trending functionality.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

import type { Course } from '../../../courses/domain/entities/Course.js';
import type { Lesson } from '../../../courses/domain/entities/Lesson.js';

/**
 * Search filters for course search
 */
export interface SearchFilters {
  category?: string[];
  difficulty?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  rating?: {
    min?: number;
  };
  status?: string[];
  language?: string[];
}

/**
 * Pagination parameters for search results
 */
export interface PaginationDTO {
  from?: number;
  size?: number;
}

/**
 * Sort options for search results
 */
export interface SortOptions {
  field: 'relevance' | 'popularity' | 'rating' | 'price' | 'created' | 'updated' | 'trending';
  order: 'asc' | 'desc';
}

/**
 * Search result with metadata and facets
 */
export interface SearchResults<T = any> {
  documents: T[];
  total: number;
  took: number; // Query execution time in milliseconds
  maxScore?: number;
  facets?: SearchFacets;
  suggestions?: string[];
}

/**
 * Search facets for filtering
 */
export interface SearchFacets {
  categories: Array<{ key: string; count: number }>;
  difficulties: Array<{ key: string; count: number }>;
  priceRanges: Array<{ key: string; count: number; from?: number; to?: number }>;
  ratings: Array<{ key: string; count: number; from?: number }>;
  languages: Array<{ key: string; count: number }>;
}

/**
 * Course search document with enriched data
 */
export interface CourseSearchResult {
  id: string;
  title: string;
  description: string;
  slug: string;
  instructorId: string;
  instructorName: string;
  category: string;
  difficulty: string;
  price: number;
  currency: string;
  status: string;
  enrollmentCount: number;
  averageRating?: number;
  totalReviews: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  modules: Array<{
    id: string;
    title: string;
    description?: string;
    orderNumber: number;
    durationMinutes: number;
  }>;
  lessonContent: string; // Aggregated lesson content for search
  searchBoost?: number;
  popularityScore?: number;
  recentEnrollmentVelocity?: number;
  _highlight?: Record<string, string[]>; // Search highlighting
}

/**
 * Lesson search document with course context
 */
export interface LessonSearchResult {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description?: string;
  lessonType: string;
  contentText?: string;
  durationMinutes?: number;
  orderNumber: number;
  isPreview: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Course context for search
  courseTitle: string;
  courseCategory: string;
  courseDifficulty: string;
  _highlight?: Record<string, string[]>; // Search highlighting
}

/**
 * Search Service Interface
 *
 * Provides methods for indexing content and performing searches.
 * Implementations should handle search operations with proper error
 * handling and performance optimization.
 */
export interface ISearchService {
  // Content indexing operations

  /**
   * Index a course for full-text search
   *
   * @param course - Course entity to index
   * @returns Promise resolving when indexing is complete
   * @throws ExternalServiceError if indexing fails
   */
  indexCourse(course: Course): Promise<void>;

  /**
   * Index a lesson for full-text search
   *
   * @param lesson - Lesson entity to index
   * @returns Promise resolving when indexing is complete
   * @throws ExternalServiceError if indexing fails
   */
  indexLesson(lesson: Lesson): Promise<void>;

  // Search operations

  /**
   * Search courses with filters and facets
   *
   * @param query - Search query string
   * @param filters - Optional filters to apply
   * @param pagination - Optional pagination parameters
   * @param sort - Optional sort configuration
   * @param includeFacets - Whether to include facet counts
   * @returns Promise resolving to search results with facets
   * @throws ExternalServiceError if search fails
   */
  searchCourses(
    query: string,
    filters?: SearchFilters,
    pagination?: PaginationDTO,
    sort?: SortOptions,
    includeFacets?: boolean
  ): Promise<SearchResults<CourseSearchResult>>;

  /**
   * Search lessons within a specific course or across all courses
   *
   * @param query - Search query string
   * @param courseId - Optional course ID to limit search scope
   * @param pagination - Optional pagination parameters
   * @returns Promise resolving to lesson search results
   * @throws ExternalServiceError if search fails
   */
  searchLessons(
    query: string,
    courseId?: string,
    pagination?: PaginationDTO
  ): Promise<SearchResults<LessonSearchResult>>;

  /**
   * Get autocomplete suggestions for search queries
   *
   * @param query - Partial search query
   * @param limit - Maximum number of suggestions (default: 10)
   * @returns Promise resolving to array of suggestion strings
   * @throws ExternalServiceError if autocomplete fails
   */
  autocomplete(query: string, limit?: number): Promise<string[]>;

  /**
   * Get trending search terms based on recent search activity
   *
   * @param limit - Maximum number of trending searches (default: 10)
   * @returns Promise resolving to array of trending search terms
   * @throws ExternalServiceError if trending search retrieval fails
   */
  getTrendingSearches(limit?: number): Promise<string[]>;

  // Index management operations

  /**
   * Remove a course from the search index
   *
   * @param courseId - Course ID to remove
   * @returns Promise resolving when removal is complete
   * @throws ExternalServiceError if removal fails
   */
  removeCourse(courseId: string): Promise<void>;

  /**
   * Remove a lesson from the search index
   *
   * @param lessonId - Lesson ID to remove
   * @returns Promise resolving when removal is complete
   * @throws ExternalServiceError if removal fails
   */
  removeLesson(lessonId: string): Promise<void>;

  /**
   * Remove all lessons for a specific course from the search index
   *
   * @param courseId - Course ID
   * @returns Promise resolving to number of removed lessons
   * @throws ExternalServiceError if removal fails
   */
  removeLessonsByCourse(courseId: string): Promise<number>;

  /**
   * Refresh search indices to make recent changes searchable
   *
   * @returns Promise resolving when refresh is complete
   * @throws ExternalServiceError if refresh fails
   */
  refreshIndices(): Promise<void>;

  /**
   * Get search index health and statistics
   *
   * @returns Promise resolving to health status and statistics
   * @throws ExternalServiceError if health check fails
   */
  getSearchHealth(): Promise<{
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
  }>;
}
