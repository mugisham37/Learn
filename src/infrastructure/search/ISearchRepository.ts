/**
 * Search Repository Interface
 *
 * Defines the contract for search operations using Elasticsearch.
 * Abstracts search operations behind a clean interface following
 * the Repository pattern for infrastructure independence.
 *
 * Requirements: 8.1, 8.7
 */

// Types are defined inline to avoid unused imports

/**
 * Search document for courses with enriched data for search
 */
export interface CourseSearchDocument {
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
}

/**
 * Search document for lessons with course context
 */
export interface LessonSearchDocument {
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
}

/**
 * Bulk indexing result
 */
export interface BulkIndexResult {
  success: boolean;
  indexed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

/**
 * Search result with metadata
 */
export interface SearchResult<T> {
  documents: T[];
  total: number;
  took: number; // Query execution time in milliseconds
  maxScore?: number;
}

/**
 * Index statistics
 */
export interface IndexStats {
  documentCount: number;
  storeSize: string;
  indexingRate: number;
  searchRate: number;
}

/**
 * Search Repository Interface
 *
 * Provides methods for all search operations with Elasticsearch.
 * Implementations must handle Elasticsearch errors and provide
 * appropriate fallbacks or error mapping.
 */
export interface ISearchRepository {
  // Document indexing operations

  /**
   * Index a single course document
   *
   * @param document - Course search document
   * @returns Promise resolving to success status
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  indexCourse(document: CourseSearchDocument): Promise<boolean>;

  /**
   * Index a single lesson document
   *
   * @param document - Lesson search document
   * @returns Promise resolving to success status
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  indexLesson(document: LessonSearchDocument): Promise<boolean>;

  /**
   * Bulk index multiple course documents
   *
   * @param documents - Array of course search documents
   * @returns Promise resolving to bulk indexing result
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  bulkIndexCourses(documents: CourseSearchDocument[]): Promise<BulkIndexResult>;

  /**
   * Bulk index multiple lesson documents
   *
   * @param documents - Array of lesson search documents
   * @returns Promise resolving to bulk indexing result
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  bulkIndexLessons(documents: LessonSearchDocument[]): Promise<BulkIndexResult>;

  // Document search operations

  /**
   * Search courses with query and filters
   *
   * @param query - Search query string
   * @param options - Search options (filters, pagination, sorting)
   * @returns Promise resolving to search results
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  searchCourses(
    query: string,
    options?: {
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
    }
  ): Promise<SearchResult<CourseSearchDocument>>;

  /**
   * Search lessons with query and filters
   *
   * @param query - Search query string
   * @param options - Search options (filters, pagination, sorting)
   * @returns Promise resolving to search results
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  searchLessons(
    query: string,
    options?: {
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
    }
  ): Promise<SearchResult<LessonSearchDocument>>;

  // Document deletion operations

  /**
   * Delete a course document by ID
   *
   * @param courseId - Course ID to delete
   * @returns Promise resolving to success status
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  deleteCourse(courseId: string): Promise<boolean>;

  /**
   * Delete a lesson document by ID
   *
   * @param lessonId - Lesson ID to delete
   * @returns Promise resolving to success status
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  deleteLesson(lessonId: string): Promise<boolean>;

  /**
   * Delete all lessons for a specific course
   *
   * @param courseId - Course ID
   * @returns Promise resolving to number of deleted documents
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  deleteLessonsByCourse(courseId: string): Promise<number>;

  // Index management operations

  /**
   * Refresh indices to make recent changes searchable
   *
   * @param indices - Optional array of index names to refresh
   * @returns Promise resolving when refresh is complete
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  refreshIndices(indices?: string[]): Promise<void>;

  /**
   * Get statistics for a specific index
   *
   * @param indexName - Name of the index
   * @returns Promise resolving to index statistics
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  getIndexStats(indexName: string): Promise<IndexStats>;

  /**
   * Check if indices exist and are healthy
   *
   * @returns Promise resolving to health status
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  checkHealth(): Promise<{
    healthy: boolean;
    indices: {
      courses: boolean;
      lessons: boolean;
    };
    error?: string;
  }>;

  /**
   * Perform bulk reindexing for initial data load
   * This method should handle large datasets efficiently
   *
   * @param type - Type of documents to reindex ('courses' | 'lessons' | 'all')
   * @returns Promise resolving to reindexing result
   * @throws ExternalServiceError if Elasticsearch operation fails
   */
  bulkReindex(type: 'courses' | 'lessons' | 'all'): Promise<{
    success: boolean;
    coursesIndexed?: number;
    lessonsIndexed?: number;
    errors: string[];
  }>;
}
