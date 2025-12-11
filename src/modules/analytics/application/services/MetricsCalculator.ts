/**
 * Metrics Calculator Service Implementation
 * 
 * Implements metrics calculation services using efficient SQL aggregations
 * and time-series analysis. Provides comprehensive analytics calculations
 * for completion rates, scores, engagement, and trends.
 * 
 * Requirements: 12.1, 12.2
 */

import { 
  eq, 
  and, 
  gte, 
  lte, 
  count, 
  avg, 
  sum,
  sql,
  inArray,
  isNotNull,
  countDistinct
} from 'drizzle-orm';

import { getReadDb } from '../../../../infrastructure/database/index.js';
import { 
  analyticsEvents 
} from '../../../../infrastructure/database/schema/analytics.schema.js';
import { 
  quizSubmissions,
  assignmentSubmissions
} from '../../../../infrastructure/database/schema/assessments.schema.js';
import { 
  discussionPosts 
} from '../../../../infrastructure/database/schema/communication.schema.js';
import { 
  courses 
} from '../../../../infrastructure/database/schema/courses.schema.js';
import { 
  enrollments, 
  lessonProgress 
} from '../../../../infrastructure/database/schema/enrollments.schema.js';
import { 
  NotFoundError, 
  DatabaseError, 
  ValidationError 
} from '../../../../shared/errors/index.js';

import type { DateRange } from '../../../../shared/types/index.js';
import type { 
  IMetricsCalculator, 
  TrendData, 
  EngagementComponents 
} from './IMetricsCalculator.js';

/**
 * Metrics Calculator Service Implementation
 * 
 * Provides efficient SQL-based calculations for various analytics metrics
 * including completion rates, scores, engagement, and trend analysis.
 */
export class MetricsCalculator implements IMetricsCalculator {
  private readonly db = getReadDb();

  /**
   * Calculates completion rate for a specific course
   * 
   * @param courseId - Course ID to calculate completion rate for
   * @returns Completion rate as a percentage (0-100)
   */
  async calculateCompletionRate(courseId: string): Promise<number> {
    try {
      // First verify the course exists
      const courseExists = await this.db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (courseExists.length === 0) {
        throw new NotFoundError('Course', courseId);
      }

      // Get total enrollments and completed enrollments
      const result = await this.db
        .select({
          totalEnrollments: count(),
          completedEnrollments: sum(
            sql`CASE WHEN ${enrollments.status} = 'completed' THEN 1 ELSE 0 END`
          ).mapWith(Number)
        })
        .from(enrollments)
        .where(eq(enrollments.courseId, courseId));

      const data = result[0];
      if (!data) {
        return 0;
      }

      const { totalEnrollments, completedEnrollments } = data;

      if (totalEnrollments === 0) {
        return 0;
      }

      return Math.round((completedEnrollments / totalEnrollments) * 100 * 100) / 100;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        'Failed to calculate completion rate',
        'calculateCompletionRate',
        error as Error
      );
    }
  }

  /**
   * Calculates average quiz score for a specific user across all courses
   * 
   * @param userId - User ID to calculate average score for
   * @returns Average score as a percentage (0-100)
   */
  async calculateAverageScore(userId: string): Promise<number> {
    try {
      // Get average score from quiz submissions
      const result = await this.db
        .select({
          averageScore: avg(quizSubmissions.scorePercentage)
        })
        .from(quizSubmissions)
        .where(
          and(
            eq(quizSubmissions.studentId, userId),
            isNotNull(quizSubmissions.scorePercentage),
            eq(quizSubmissions.gradingStatus, 'graded')
          )
        );

      const averageScore = result[0]?.averageScore;
      
      if (averageScore === null || averageScore === undefined) {
        return 0;
      }

      return Math.round(Number(averageScore) * 100) / 100;
    } catch (error) {
      throw new DatabaseError(
        'Failed to calculate average score',
        'calculateAverageScore',
        error as Error
      );
    }
  }

  /**
   * Calculates engagement score for a specific user based on multiple factors
   * 
   * @param userId - User ID to calculate engagement score for
   * @returns Engagement score components and overall score (0-100)
   */
  async calculateEngagementScore(userId: string): Promise<EngagementComponents> {
    try {
      // Get video watch time (from lesson progress)
      const videoTimeResult = await this.db
        .select({
          totalVideoTime: sum(lessonProgress.timeSpentSeconds)
        })
        .from(lessonProgress)
        .innerJoin(enrollments, eq(lessonProgress.enrollmentId, enrollments.id))
        .where(eq(enrollments.studentId, userId));

      const totalVideoTime = Number(videoTimeResult[0]?.totalVideoTime || 0);

      // Get discussion participation (posts count)
      const discussionResult = await this.db
        .select({
          postCount: count()
        })
        .from(discussionPosts)
        .where(eq(discussionPosts.authorId, userId));

      const discussionParticipation = Number(discussionResult[0]?.postCount || 0);

      // Get assignment submissions count
      const assignmentResult = await this.db
        .select({
          submissionCount: count()
        })
        .from(assignmentSubmissions)
        .where(eq(assignmentSubmissions.studentId, userId));

      const assignmentSubmissionCount = Number(assignmentResult[0]?.submissionCount || 0);

      // Get quiz attempts count
      const quizResult = await this.db
        .select({
          attemptCount: count()
        })
        .from(quizSubmissions)
        .where(eq(quizSubmissions.studentId, userId));

      const quizAttempts = Number(quizResult[0]?.attemptCount || 0);

      // Get session frequency (unique days with activity in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const sessionResult = await this.db
        .select({
          uniqueDays: countDistinct(sql`DATE(${analyticsEvents.timestamp})`)
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.userId, userId),
            gte(analyticsEvents.timestamp, thirtyDaysAgo)
          )
        );

      const sessionFrequency = Number(sessionResult[0]?.uniqueDays || 0);

      // Calculate normalized scores (0-100)
      const videoWatchTime = Math.min((totalVideoTime / 3600) * 10, 100); // 1 hour = 10 points, max 100
      const discussionScore = Math.min(discussionParticipation * 5, 100); // 1 post = 5 points, max 100
      const assignmentScore = Math.min(assignmentSubmissionCount * 10, 100); // 1 submission = 10 points, max 100
      const quizScore = Math.min(quizAttempts * 5, 100); // 1 attempt = 5 points, max 100
      const sessionScore = Math.min(sessionFrequency * 3.33, 100); // 30 days = 100 points

      // Calculate weighted overall score
      const overallScore = Math.round(
        (videoWatchTime * 0.3 + 
         discussionScore * 0.2 + 
         assignmentScore * 0.25 + 
         quizScore * 0.15 + 
         sessionScore * 0.1) * 100
      ) / 100;

      return {
        videoWatchTime: Math.round(videoWatchTime * 100) / 100,
        discussionParticipation: Math.round(discussionScore * 100) / 100,
        assignmentSubmissions: Math.round(assignmentScore * 100) / 100,
        quizAttempts: Math.round(quizScore * 100) / 100,
        sessionFrequency: Math.round(sessionScore * 100) / 100,
        overallScore
      };
    } catch (error) {
      throw new DatabaseError(
        'Failed to calculate engagement score',
        'calculateEngagementScore',
        error as Error
      );
    }
  }

  /**
   * Identifies trends for a specific metric over a date range using time-series analysis
   * 
   * @param metric - Metric name to analyze
   * @param dateRange - Date range for trend analysis
   * @returns Trend data with time-series points and analysis
   */
  async identifyTrends(metric: string, dateRange: DateRange): Promise<TrendData> {
    const supportedMetrics = ['enrollments', 'completions', 'revenue', 'quiz_attempts', 'discussion_posts'];
    
    if (!supportedMetrics.includes(metric)) {
      throw new ValidationError(`Unsupported metric: ${metric}. Supported metrics: ${supportedMetrics.join(', ')}`);
    }

    try {
      let dataPoints: Array<{ date: Date; value: number }> = [];

      switch (metric) {
        case 'enrollments':
          dataPoints = await this.getEnrollmentTrends(dateRange);
          break;
        case 'completions':
          dataPoints = await this.getCompletionTrends(dateRange);
          break;
        case 'revenue':
          dataPoints = await this.getRevenueTrends(dateRange);
          break;
        case 'quiz_attempts':
          dataPoints = await this.getQuizAttemptTrends(dateRange);
          break;
        case 'discussion_posts':
          dataPoints = await this.getDiscussionPostTrends(dateRange);
          break;
      }

      // Calculate trend analysis
      const values = dataPoints.map(point => point.value);
      const averageValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const minValue = values.length > 0 ? Math.min(...values) : 0;
      const maxValue = values.length > 0 ? Math.max(...values) : 0;

      // Calculate trend direction using linear regression
      const trend = this.calculateTrendDirection(dataPoints);
      const changePercentage = this.calculateChangePercentage(dataPoints);

      return {
        metric,
        dateRange,
        dataPoints,
        trend,
        changePercentage: Math.round(changePercentage * 100) / 100,
        averageValue: Math.round(averageValue * 100) / 100,
        minValue,
        maxValue
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError(
        'Failed to identify trends',
        'identifyTrends',
        error as Error
      );
    }
  }

  /**
   * Calculates completion rates for multiple courses in batch
   */
  async batchCalculateCompletionRates(courseIds: string[]): Promise<Map<string, number>> {
    if (courseIds.length === 0) {
      return new Map();
    }

    try {
      const results = await this.db
        .select({
          courseId: enrollments.courseId,
          totalEnrollments: count(),
          completedEnrollments: sum(
            sql`CASE WHEN ${enrollments.status} = 'completed' THEN 1 ELSE 0 END`
          ).mapWith(Number)
        })
        .from(enrollments)
        .where(inArray(enrollments.courseId, courseIds))
        .groupBy(enrollments.courseId);

      const completionRates = new Map<string, number>();

      for (const result of results) {
        const rate = result.totalEnrollments > 0 
          ? Math.round((result.completedEnrollments / result.totalEnrollments) * 100 * 100) / 100
          : 0;
        completionRates.set(result.courseId, rate);
      }

      // Set 0 for courses with no enrollments
      for (const courseId of courseIds) {
        if (!completionRates.has(courseId)) {
          completionRates.set(courseId, 0);
        }
      }

      return completionRates;
    } catch (error) {
      throw new DatabaseError(
        'Failed to batch calculate completion rates',
        'batchCalculateCompletionRates',
        error as Error
      );
    }
  }

  /**
   * Calculates average scores for multiple users in batch
   */
  async batchCalculateAverageScores(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) {
      return new Map();
    }

    try {
      const results = await this.db
        .select({
          studentId: quizSubmissions.studentId,
          averageScore: avg(quizSubmissions.scorePercentage)
        })
        .from(quizSubmissions)
        .where(
          and(
            inArray(quizSubmissions.studentId, userIds),
            isNotNull(quizSubmissions.scorePercentage),
            eq(quizSubmissions.gradingStatus, 'graded')
          )
        )
        .groupBy(quizSubmissions.studentId);

      const averageScores = new Map<string, number>();

      for (const result of results) {
        const score = result.averageScore ? Math.round(Number(result.averageScore) * 100) / 100 : 0;
        averageScores.set(result.studentId, score);
      }

      // Set 0 for users with no quiz submissions
      for (const userId of userIds) {
        if (!averageScores.has(userId)) {
          averageScores.set(userId, 0);
        }
      }

      return averageScores;
    } catch (error) {
      throw new DatabaseError(
        'Failed to batch calculate average scores',
        'batchCalculateAverageScores',
        error as Error
      );
    }
  }

  /**
   * Calculates engagement scores for multiple users in batch
   */
  async batchCalculateEngagementScores(userIds: string[]): Promise<Map<string, EngagementComponents>> {
    const engagementScores = new Map<string, EngagementComponents>();

    // For batch processing, we'll calculate each user individually
    // In a production system, this could be optimized with more complex SQL
    for (const userId of userIds) {
      try {
        const engagement = await this.calculateEngagementScore(userId);
        engagementScores.set(userId, engagement);
      } catch (error) {
        // Set default engagement for users with errors
        engagementScores.set(userId, {
          videoWatchTime: 0,
          discussionParticipation: 0,
          assignmentSubmissions: 0,
          quizAttempts: 0,
          sessionFrequency: 0,
          overallScore: 0
        });
      }
    }

    return engagementScores;
  }

  /**
   * Calculates course difficulty score based on completion rates and quiz scores
   */
  async calculateCourseDifficulty(courseId: string): Promise<number> {
    try {
      // Verify course exists
      const courseExists = await this.db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (courseExists.length === 0) {
        throw new NotFoundError('Course', courseId);
      }

      // Get completion rate (lower completion = higher difficulty)
      const completionRate = await this.calculateCompletionRate(courseId);

      // Get average quiz score for the course
      const quizScoreResult = await this.db
        .select({
          averageScore: avg(quizSubmissions.scorePercentage)
        })
        .from(quizSubmissions)
        .innerJoin(enrollments, eq(quizSubmissions.enrollmentId, enrollments.id))
        .where(
          and(
            eq(enrollments.courseId, courseId),
            isNotNull(quizSubmissions.scorePercentage),
            eq(quizSubmissions.gradingStatus, 'graded')
          )
        );

      const averageQuizScore = Number(quizScoreResult[0]?.averageScore || 75); // Default to 75 if no data

      // Calculate difficulty score (0-100, higher = more difficult)
      // Lower completion rate and lower quiz scores indicate higher difficulty
      const completionDifficulty = 100 - completionRate; // Invert completion rate
      const quizDifficulty = 100 - averageQuizScore; // Invert quiz score

      const difficultyScore = Math.round((completionDifficulty * 0.6 + quizDifficulty * 0.4) * 100) / 100;

      return Math.max(0, Math.min(100, difficultyScore));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(
        'Failed to calculate course difficulty',
        'calculateCourseDifficulty',
        error as Error
      );
    }
  }

  /**
   * Calculates student retention rate for a course over time
   */
  async calculateRetentionRate(courseId: string, dateRange: DateRange): Promise<number> {
    try {
      // Get enrollments at the start of the period
      const initialEnrollments = await this.db
        .select({
          count: count()
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            lte(enrollments.enrolledAt, dateRange.startDate)
          )
        );

      // Get enrollments still active at the end of the period
      const retainedEnrollments = await this.db
        .select({
          count: count()
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            lte(enrollments.enrolledAt, dateRange.startDate),
            sql`(${enrollments.status} = 'active' OR ${enrollments.status} = 'completed' OR ${enrollments.completedAt} > ${dateRange.endDate})`
          )
        );

      const initialData = initialEnrollments[0];
      const retainedData = retainedEnrollments[0];
      
      const initial = initialData ? Number(initialData.count) : 0;
      const retained = retainedData ? Number(retainedData.count) : 0;

      if (initial === 0) {
        return 0;
      }

      return Math.round((retained / initial) * 100 * 100) / 100;
    } catch (error) {
      throw new DatabaseError(
        'Failed to calculate retention rate',
        'calculateRetentionRate',
        error as Error
      );
    }
  }

  /**
   * Calculates time-to-completion statistics for a course
   */
  async calculateTimeToCompletion(courseId: string): Promise<{
    averageDays: number;
    medianDays: number;
    minDays: number;
    maxDays: number;
    completionCount: number;
  }> {
    try {
      // Get completion times for the course
      const completions = await this.db
        .select({
          enrolledAt: enrollments.enrolledAt,
          completedAt: enrollments.completedAt
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            eq(enrollments.status, 'completed'),
            isNotNull(enrollments.completedAt)
          )
        );

      if (completions.length === 0) {
        return {
          averageDays: 0,
          medianDays: 0,
          minDays: 0,
          maxDays: 0,
          completionCount: 0
        };
      }

      // Calculate completion times in days
      const completionTimes = completions.map(completion => {
        const enrolled = new Date(completion.enrolledAt);
        const completed = new Date(completion.completedAt!);
        return Math.ceil((completed.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24));
      });

      completionTimes.sort((a, b) => a - b);

      const averageDays = Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length * 100) / 100;
      
      let medianDays = 0;
      if (completionTimes.length > 0) {
        if (completionTimes.length % 2 === 0) {
          const mid1 = completionTimes[completionTimes.length / 2 - 1] || 0;
          const mid2 = completionTimes[completionTimes.length / 2] || 0;
          medianDays = (mid1 + mid2) / 2;
        } else {
          medianDays = completionTimes[Math.floor(completionTimes.length / 2)] || 0;
        }
      }
      
      const minDays = completionTimes.length > 0 ? completionTimes[0] : 0;
      const maxDays = completionTimes.length > 0 ? completionTimes[completionTimes.length - 1] : 0;

      return {
        averageDays: Number(averageDays) || 0,
        medianDays: Number(medianDays) || 0,
        minDays: Number(minDays) || 0,
        maxDays: Number(maxDays) || 0,
        completionCount: completions.length
      };
    } catch (error) {
      throw new DatabaseError(
        'Failed to calculate time to completion',
        'calculateTimeToCompletion',
        error as Error
      );
    }
  }

  // Private helper methods for trend analysis

  private async getEnrollmentTrends(dateRange: DateRange): Promise<Array<{ date: Date; value: number }>> {
    const result = await this.db
      .select({
        date: sql<string>`DATE(${enrollments.enrolledAt})`,
        count: count()
      })
      .from(enrollments)
      .where(
        and(
          gte(enrollments.enrolledAt, dateRange.startDate),
          lte(enrollments.enrolledAt, dateRange.endDate)
        )
      )
      .groupBy(sql`DATE(${enrollments.enrolledAt})`)
      .orderBy(sql`DATE(${enrollments.enrolledAt})`);

    return result.map(row => ({
      date: new Date(row.date),
      value: Number(row.count)
    }));
  }

  private async getCompletionTrends(dateRange: DateRange): Promise<Array<{ date: Date; value: number }>> {
    const result = await this.db
      .select({
        date: sql<string>`DATE(${enrollments.completedAt})`,
        count: count()
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.status, 'completed'),
          isNotNull(enrollments.completedAt),
          gte(enrollments.completedAt, dateRange.startDate),
          lte(enrollments.completedAt, dateRange.endDate)
        )
      )
      .groupBy(sql`DATE(${enrollments.completedAt})`)
      .orderBy(sql`DATE(${enrollments.completedAt})`);

    return result.map(row => ({
      date: new Date(row.date),
      value: Number(row.count)
    }));
  }

  private getRevenueTrends(_dateRange: DateRange): Promise<Array<{ date: Date; value: number }>> {
    // This would require joining with payments table when it's implemented
    // For now, return empty array
    return Promise.resolve([]);
  }

  private async getQuizAttemptTrends(dateRange: DateRange): Promise<Array<{ date: Date; value: number }>> {
    const result = await this.db
      .select({
        date: sql<string>`DATE(${quizSubmissions.startedAt})`,
        count: count()
      })
      .from(quizSubmissions)
      .where(
        and(
          gte(quizSubmissions.startedAt, dateRange.startDate),
          lte(quizSubmissions.startedAt, dateRange.endDate)
        )
      )
      .groupBy(sql`DATE(${quizSubmissions.startedAt})`)
      .orderBy(sql`DATE(${quizSubmissions.startedAt})`);

    return result.map(row => ({
      date: new Date(row.date),
      value: Number(row.count)
    }));
  }

  private async getDiscussionPostTrends(dateRange: DateRange): Promise<Array<{ date: Date; value: number }>> {
    const result = await this.db
      .select({
        date: sql<string>`DATE(${discussionPosts.createdAt})`,
        count: count()
      })
      .from(discussionPosts)
      .where(
        and(
          gte(discussionPosts.createdAt, dateRange.startDate),
          lte(discussionPosts.createdAt, dateRange.endDate)
        )
      )
      .groupBy(sql`DATE(${discussionPosts.createdAt})`)
      .orderBy(sql`DATE(${discussionPosts.createdAt})`);

    return result.map(row => ({
      date: new Date(row.date),
      value: Number(row.count)
    }));
  }

  private calculateTrendDirection(dataPoints: Array<{ date: Date; value: number }>): 'increasing' | 'decreasing' | 'stable' {
    if (dataPoints.length < 2) {
      return 'stable';
    }

    // Simple linear regression to determine trend
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, _, index) => sum + index, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
    const sumXY = dataPoints.reduce((sum, point, index) => sum + index * point.value, 0);
    const sumXX = dataPoints.reduce((sum, _, index) => sum + index * index, 0);

    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

    if (Math.abs(slope) < 0.1) {
      return 'stable';
    }

    return slope > 0 ? 'increasing' : 'decreasing';
  }

  private calculateChangePercentage(dataPoints: Array<{ date: Date; value: number }>): number {
    if (dataPoints.length < 2) {
      return 0;
    }

    const firstValue = dataPoints[0]?.value || 0;
    const lastValue = dataPoints[dataPoints.length - 1]?.value || 0;

    if (firstValue === 0) {
      return lastValue > 0 ? 100 : 0;
    }

    return ((lastValue - firstValue) / firstValue) * 100;
  }
}