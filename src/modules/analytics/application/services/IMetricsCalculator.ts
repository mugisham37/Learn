/**
 * Metrics Calculator Service Interface
 *
 * Defines the contract for metrics calculation services.
 * Provides methods for calculating completion rates, average scores, engagement metrics,
 * and trend analysis using efficient SQL aggregations.
 *
 * Requirements: 12.1, 12.2
 */

import type { DateRange } from '../../../../shared/types/index.js';

/**
 * Trend data structure for time-series analysis
 */
export interface TrendData {
  metric: string;
  dateRange: DateRange;
  dataPoints: Array<{
    date: Date;
    value: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercentage: number;
  averageValue: number;
  minValue: number;
  maxValue: number;
}

/**
 * Engagement score components
 */
export interface EngagementComponents {
  videoWatchTime: number;
  discussionParticipation: number;
  assignmentSubmissions: number;
  quizAttempts: number;
  sessionFrequency: number;
  overallScore: number;
}

/**
 * Metrics Calculator Service Interface
 *
 * Provides methods for calculating various analytics metrics using efficient
 * SQL aggregations and time-series analysis.
 */
export interface IMetricsCalculator {
  /**
   * Calculates completion rate for a specific course
   *
   * @param courseId - Course ID to calculate completion rate for
   * @returns Completion rate as a percentage (0-100)
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if calculation fails
   */
  calculateCompletionRate(courseId: string): Promise<number>;

  /**
   * Calculates average quiz score for a specific user across all courses
   *
   * @param userId - User ID to calculate average score for
   * @returns Average score as a percentage (0-100)
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if calculation fails
   */
  calculateAverageScore(userId: string): Promise<number>;

  /**
   * Calculates engagement score for a specific user based on multiple factors
   *
   * @param userId - User ID to calculate engagement score for
   * @returns Engagement score components and overall score (0-100)
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if calculation fails
   */
  calculateEngagementScore(userId: string): Promise<EngagementComponents>;

  /**
   * Identifies trends for a specific metric over a date range using time-series analysis
   *
   * @param metric - Metric name to analyze (e.g., 'enrollments', 'completions', 'revenue')
   * @param dateRange - Date range for trend analysis
   * @returns Trend data with time-series points and analysis
   * @throws ValidationError if metric is not supported
   * @throws DatabaseError if trend calculation fails
   */
  identifyTrends(metric: string, dateRange: DateRange): Promise<TrendData>;

  /**
   * Calculates completion rate for multiple courses in batch
   *
   * @param courseIds - Array of course IDs to calculate completion rates for
   * @returns Map of course ID to completion rate
   * @throws DatabaseError if batch calculation fails
   */
  batchCalculateCompletionRates(courseIds: string[]): Promise<Map<string, number>>;

  /**
   * Calculates average scores for multiple users in batch
   *
   * @param userIds - Array of user IDs to calculate average scores for
   * @returns Map of user ID to average score
   * @throws DatabaseError if batch calculation fails
   */
  batchCalculateAverageScores(userIds: string[]): Promise<Map<string, number>>;

  /**
   * Calculates engagement scores for multiple users in batch
   *
   * @param userIds - Array of user IDs to calculate engagement scores for
   * @returns Map of user ID to engagement components
   * @throws DatabaseError if batch calculation fails
   */
  batchCalculateEngagementScores(userIds: string[]): Promise<Map<string, EngagementComponents>>;

  /**
   * Calculates course difficulty score based on completion rates and quiz scores
   *
   * @param courseId - Course ID to calculate difficulty for
   * @returns Difficulty score (0-100, higher = more difficult)
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if calculation fails
   */
  calculateCourseDifficulty(courseId: string): Promise<number>;

  /**
   * Calculates student retention rate for a course over time
   *
   * @param courseId - Course ID to calculate retention for
   * @param dateRange - Date range for retention analysis
   * @returns Retention rate as a percentage (0-100)
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if calculation fails
   */
  calculateRetentionRate(courseId: string, dateRange: DateRange): Promise<number>;

  /**
   * Calculates time-to-completion statistics for a course
   *
   * @param courseId - Course ID to calculate statistics for
   * @returns Statistics including average, median, min, max completion times in days
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if calculation fails
   */
  calculateTimeToCompletion(courseId: string): Promise<{
    averageDays: number;
    medianDays: number;
    minDays: number;
    maxDays: number;
    completionCount: number;
  }>;
}
