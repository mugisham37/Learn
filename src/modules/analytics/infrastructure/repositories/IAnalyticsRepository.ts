/**
 * Analytics Repository Interface
 *
 * Defines the contract for analytics data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 *
 * Requirements: 12.1, 12.2, 12.7
 */

import type {
  CourseAnalytics,
  NewCourseAnalytics,
  StudentAnalytics,
  NewStudentAnalytics,
  AnalyticsEvent,
  NewAnalyticsEvent,
} from '../../../../infrastructure/database/schema/analytics.schema.js';

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Date range filter for analytics queries
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Analytics event filter parameters
 */
export interface EventFilters {
  eventType?: string;
  userId?: string;
  dateRange?: DateRange;
}

/**
 * Course analytics aggregation data
 */
export interface CourseAnalyticsAggregation {
  totalEnrollments: number;
  activeEnrollments: number;
  completionCount: number;
  completionRate: number;
  averageRating?: number;
  totalRevenue: number;
  averageTimeToCompletionDays?: number;
  dropoutRate: number;
  mostDifficultLessonId?: string;
  engagementMetrics: Record<string, any>;
}

/**
 * Student analytics aggregation data
 */
export interface StudentAnalyticsAggregation {
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  averageQuizScore?: number;
  totalTimeInvestedMinutes: number;
  currentStreakDays: number;
  longestStreakDays: number;
  badgesEarned: any[];
  skillRatings: Record<string, any>;
}

/**
 * Course Analytics Repository Interface
 *
 * Provides methods for course analytics data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface ICourseAnalyticsRepository {
  /**
   * Creates or updates course analytics record
   *
   * @param courseId - Course ID
   * @param data - Analytics data
   * @returns The created/updated course analytics
   * @throws DatabaseError if database operation fails
   */
  upsert(courseId: string, data: CourseAnalyticsAggregation): Promise<CourseAnalytics>;

  /**
   * Finds course analytics by course ID
   *
   * @param courseId - Course ID
   * @returns The course analytics if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByCourseId(courseId: string): Promise<CourseAnalytics | null>;

  /**
   * Finds course analytics for multiple courses
   *
   * @param courseIds - Array of course IDs
   * @returns Array of course analytics
   * @throws DatabaseError if database operation fails
   */
  findByCourseIds(courseIds: string[]): Promise<CourseAnalytics[]>;

  /**
   * Finds all course analytics with pagination
   *
   * @param pagination - Pagination parameters
   * @returns Paginated course analytics results
   * @throws DatabaseError if database operation fails
   */
  findAll(pagination: PaginationParams): Promise<PaginatedResult<CourseAnalytics>>;

  /**
   * Finds course analytics by instructor
   *
   * @param instructorId - Instructor user ID
   * @param pagination - Pagination parameters
   * @returns Paginated course analytics results
   * @throws DatabaseError if database operation fails
   */
  findByInstructor(
    instructorId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<CourseAnalytics>>;

  /**
   * Updates course analytics last updated timestamp
   *
   * @param courseId - Course ID
   * @returns The updated course analytics
   * @throws NotFoundError if course analytics doesn't exist
   * @throws DatabaseError if database operation fails
   */
  updateLastUpdated(courseId: string): Promise<CourseAnalytics>;

  /**
   * Deletes course analytics record
   *
   * @param courseId - Course ID
   * @returns void
   * @throws DatabaseError if database operation fails
   */
  delete(courseId: string): Promise<void>;

  /**
   * Invalidates cache for course analytics
   *
   * @param courseId - Course ID
   * @returns void
   */
  invalidateCache(courseId: string): Promise<void>;

  /**
   * Invalidates cache for instructor course analytics
   *
   * @param instructorId - Instructor user ID
   * @returns void
   */
  invalidateCacheByInstructor(instructorId: string): Promise<void>;
}

/**
 * Student Analytics Repository Interface
 *
 * Provides methods for student analytics data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IStudentAnalyticsRepository {
  /**
   * Creates or updates student analytics record
   *
   * @param userId - User ID
   * @param data - Analytics data
   * @returns The created/updated student analytics
   * @throws DatabaseError if database operation fails
   */
  upsert(userId: string, data: StudentAnalyticsAggregation): Promise<StudentAnalytics>;

  /**
   * Finds student analytics by user ID
   *
   * @param userId - User ID
   * @returns The student analytics if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByUserId(userId: string): Promise<StudentAnalytics | null>;

  /**
   * Finds student analytics for multiple users
   *
   * @param userIds - Array of user IDs
   * @returns Array of student analytics
   * @throws DatabaseError if database operation fails
   */
  findByUserIds(userIds: string[]): Promise<StudentAnalytics[]>;

  /**
   * Finds all student analytics with pagination
   *
   * @param pagination - Pagination parameters
   * @returns Paginated student analytics results
   * @throws DatabaseError if database operation fails
   */
  findAll(pagination: PaginationParams): Promise<PaginatedResult<StudentAnalytics>>;

  /**
   * Finds top performing students by completion rate
   *
   * @param limit - Number of students to return
   * @returns Array of student analytics ordered by performance
   * @throws DatabaseError if database operation fails
   */
  findTopPerformers(limit: number): Promise<StudentAnalytics[]>;

  /**
   * Updates student analytics last updated timestamp
   *
   * @param userId - User ID
   * @returns The updated student analytics
   * @throws NotFoundError if student analytics doesn't exist
   * @throws DatabaseError if database operation fails
   */
  updateLastUpdated(userId: string): Promise<StudentAnalytics>;

  /**
   * Deletes student analytics record
   *
   * @param userId - User ID
   * @returns void
   * @throws DatabaseError if database operation fails
   */
  delete(userId: string): Promise<void>;

  /**
   * Invalidates cache for student analytics
   *
   * @param userId - User ID
   * @returns void
   */
  invalidateCache(userId: string): Promise<void>;
}

/**
 * Analytics Events Repository Interface
 *
 * Provides methods for analytics event data access operations with efficient querying.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IAnalyticsEventsRepository {
  /**
   * Creates a new analytics event
   *
   * @param data - Event data
   * @returns The created analytics event
   * @throws DatabaseError if database operation fails
   */
  create(data: NewAnalyticsEvent): Promise<AnalyticsEvent>;

  /**
   * Creates multiple analytics events in batch
   *
   * @param events - Array of event data
   * @returns Array of created analytics events
   * @throws DatabaseError if database operation fails
   */
  createBatch(events: NewAnalyticsEvent[]): Promise<AnalyticsEvent[]>;

  /**
   * Finds analytics events by user ID with pagination
   *
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated analytics events results
   * @throws DatabaseError if database operation fails
   */
  findByUserId(
    userId: string,
    pagination: PaginationParams,
    filters?: EventFilters
  ): Promise<PaginatedResult<AnalyticsEvent>>;

  /**
   * Finds analytics events by event type with pagination
   *
   * @param eventType - Event type
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated analytics events results
   * @throws DatabaseError if database operation fails
   */
  findByEventType(
    eventType: string,
    pagination: PaginationParams,
    filters?: EventFilters
  ): Promise<PaginatedResult<AnalyticsEvent>>;

  /**
   * Finds analytics events within date range
   *
   * @param dateRange - Date range filter
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated analytics events results
   * @throws DatabaseError if database operation fails
   */
  findByDateRange(
    dateRange: DateRange,
    pagination: PaginationParams,
    filters?: EventFilters
  ): Promise<PaginatedResult<AnalyticsEvent>>;

  /**
   * Counts events by event type within date range
   *
   * @param eventType - Event type
   * @param dateRange - Date range filter
   * @returns Event count
   * @throws DatabaseError if database operation fails
   */
  countByEventType(eventType: string, dateRange?: DateRange): Promise<number>;

  /**
   * Counts events by user within date range
   *
   * @param userId - User ID
   * @param dateRange - Date range filter
   * @returns Event count
   * @throws DatabaseError if database operation fails
   */
  countByUser(userId: string, dateRange?: DateRange): Promise<number>;

  /**
   * Gets event type distribution within date range
   *
   * @param dateRange - Date range filter
   * @returns Object with event types as keys and counts as values
   * @throws DatabaseError if database operation fails
   */
  getEventTypeDistribution(dateRange?: DateRange): Promise<Record<string, number>>;

  /**
   * Gets hourly event counts for a specific date
   *
   * @param date - Date to analyze
   * @param eventType - Optional event type filter
   * @returns Array of hourly counts
   * @throws DatabaseError if database operation fails
   */
  getHourlyEventCounts(
    date: Date,
    eventType?: string
  ): Promise<Array<{ hour: number; count: number }>>;

  /**
   * Deletes old analytics events beyond retention period
   *
   * @param retentionDays - Number of days to retain
   * @returns Number of deleted events
   * @throws DatabaseError if database operation fails
   */
  deleteOldEvents(retentionDays: number): Promise<number>;
}

/**
 * Main Analytics Repository Interface
 *
 * Aggregates all analytics repository interfaces for convenience
 */
export interface IAnalyticsRepository {
  courseAnalytics: ICourseAnalyticsRepository;
  studentAnalytics: IStudentAnalyticsRepository;
  events: IAnalyticsEventsRepository;
}
