/**
 * CourseAnalytics Domain Entity
 * 
 * Represents aggregated analytics data for a course including enrollment metrics,
 * completion rates, revenue, and engagement data.
 * 
 * Requirements:
 * - 12.1: Course analytics aggregation with enrollment, completion, and revenue metrics
 */

export interface CourseAnalyticsData {
  courseId: string;
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
  lastUpdated: Date;
}

export interface EngagementMetrics {
  averageSessionDuration: number;
  totalVideoWatchTime: number;
  discussionParticipationRate: number;
  assignmentSubmissionRate: number;
  quizAttemptRate: number;
  averageQuizScore: number;
  lessonCompletionVelocity: number;
  studentRetentionRate: number;
}

export class CourseAnalytics {
  private readonly _courseId: string;
  private _totalEnrollments: number;
  private _activeEnrollments: number;
  private _completionCount: number;
  private _completionRate: number;
  private _averageRating?: number;
  private _totalRevenue: number;
  private _averageTimeToCompletionDays?: number;
  private _dropoutRate: number;
  private _mostDifficultLessonId?: string;
  private _engagementMetrics: EngagementMetrics;
  private _lastUpdated: Date;

  constructor(data: CourseAnalyticsData) {
    this._courseId = data.courseId;
    this._totalEnrollments = data.totalEnrollments;
    this._activeEnrollments = data.activeEnrollments;
    this._completionCount = data.completionCount;
    this._completionRate = data.completionRate;
    this._averageRating = data.averageRating;
    this._totalRevenue = data.totalRevenue;
    this._averageTimeToCompletionDays = data.averageTimeToCompletionDays;
    this._dropoutRate = data.dropoutRate;
    this._mostDifficultLessonId = data.mostDifficultLessonId;
    this._engagementMetrics = this.parseEngagementMetrics(data.engagementMetrics);
    this._lastUpdated = data.lastUpdated;

    this.validate();
  }

  // Getters
  get courseId(): string {
    return this._courseId;
  }

  get totalEnrollments(): number {
    return this._totalEnrollments;
  }

  get activeEnrollments(): number {
    return this._activeEnrollments;
  }

  get completionCount(): number {
    return this._completionCount;
  }

  get completionRate(): number {
    return this._completionRate;
  }

  get averageRating(): number | undefined {
    return this._averageRating;
  }

  get totalRevenue(): number {
    return this._totalRevenue;
  }

  get averageTimeToCompletionDays(): number | undefined {
    return this._averageTimeToCompletionDays;
  }

  get dropoutRate(): number {
    return this._dropoutRate;
  }

  get mostDifficultLessonId(): string | undefined {
    return this._mostDifficultLessonId;
  }

  get engagementMetrics(): EngagementMetrics {
    return this._engagementMetrics;
  }

  get lastUpdated(): Date {
    return this._lastUpdated;
  }

  /**
   * Calculate completion rate based on enrollments and completions
   */
  public calculateCompletionRate(): number {
    if (this._totalEnrollments === 0) {
      return 0;
    }
    return Math.round((this._completionCount / this._totalEnrollments) * 100 * 100) / 100;
  }

  /**
   * Calculate dropout rate based on active enrollments and total enrollments
   */
  public calculateDropoutRate(): number {
    if (this._totalEnrollments === 0) {
      return 0;
    }
    const droppedEnrollments = this._totalEnrollments - this._activeEnrollments - this._completionCount;
    return Math.round((droppedEnrollments / this._totalEnrollments) * 100 * 100) / 100;
  }

  /**
   * Update enrollment metrics
   */
  public updateEnrollmentMetrics(
    totalEnrollments: number,
    activeEnrollments: number,
    completionCount: number
  ): void {
    this._totalEnrollments = totalEnrollments;
    this._activeEnrollments = activeEnrollments;
    this._completionCount = completionCount;
    this._completionRate = this.calculateCompletionRate();
    this._dropoutRate = this.calculateDropoutRate();
    this._lastUpdated = new Date();
  }

  /**
   * Update revenue metrics
   */
  public updateRevenue(totalRevenue: number): void {
    this._totalRevenue = totalRevenue;
    this._lastUpdated = new Date();
  }

  /**
   * Update rating metrics
   */
  public updateRating(averageRating: number): void {
    this._averageRating = averageRating;
    this._lastUpdated = new Date();
  }

  /**
   * Update engagement metrics
   */
  public updateEngagementMetrics(metrics: Partial<EngagementMetrics>): void {
    this._engagementMetrics = {
      ...this._engagementMetrics,
      ...metrics
    };
    this._lastUpdated = new Date();
  }

  /**
   * Update time to completion metrics
   */
  public updateTimeToCompletion(averageDays: number): void {
    this._averageTimeToCompletionDays = averageDays;
    this._lastUpdated = new Date();
  }

  /**
   * Update most difficult lesson
   */
  public updateMostDifficultLesson(lessonId: string): void {
    this._mostDifficultLessonId = lessonId;
    this._lastUpdated = new Date();
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    enrollmentHealth: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    completionHealth: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    engagementHealth: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    revenuePerEnrollment: number;
  } {
    const enrollmentHealth = this.getEnrollmentHealth();
    const completionHealth = this.getCompletionHealth();
    const engagementHealth = this.getEngagementHealth();
    const revenuePerEnrollment = this._totalEnrollments > 0 
      ? this._totalRevenue / this._totalEnrollments 
      : 0;

    return {
      enrollmentHealth,
      completionHealth,
      engagementHealth,
      revenuePerEnrollment
    };
  }

  /**
   * Convert to plain object for persistence
   */
  public toData(): CourseAnalyticsData {
    return {
      courseId: this._courseId,
      totalEnrollments: this._totalEnrollments,
      activeEnrollments: this._activeEnrollments,
      completionCount: this._completionCount,
      completionRate: this._completionRate,
      averageRating: this._averageRating,
      totalRevenue: this._totalRevenue,
      averageTimeToCompletionDays: this._averageTimeToCompletionDays,
      dropoutRate: this._dropoutRate,
      mostDifficultLessonId: this._mostDifficultLessonId,
      engagementMetrics: this._engagementMetrics,
      lastUpdated: this._lastUpdated
    };
  }

  private validate(): void {
    if (!this._courseId) {
      throw new Error('CourseAnalytics: courseId is required');
    }

    if (this._totalEnrollments < 0) {
      throw new Error('CourseAnalytics: totalEnrollments cannot be negative');
    }

    if (this._activeEnrollments < 0) {
      throw new Error('CourseAnalytics: activeEnrollments cannot be negative');
    }

    if (this._completionCount < 0) {
      throw new Error('CourseAnalytics: completionCount cannot be negative');
    }

    if (this._completionRate < 0 || this._completionRate > 100) {
      throw new Error('CourseAnalytics: completionRate must be between 0 and 100');
    }

    if (this._averageRating !== undefined && (this._averageRating < 0 || this._averageRating > 5)) {
      throw new Error('CourseAnalytics: averageRating must be between 0 and 5');
    }

    if (this._totalRevenue < 0) {
      throw new Error('CourseAnalytics: totalRevenue cannot be negative');
    }

    if (this._dropoutRate < 0 || this._dropoutRate > 100) {
      throw new Error('CourseAnalytics: dropoutRate must be between 0 and 100');
    }
  }

  private parseEngagementMetrics(metrics: Record<string, any>): EngagementMetrics {
    return {
      averageSessionDuration: metrics.averageSessionDuration || 0,
      totalVideoWatchTime: metrics.totalVideoWatchTime || 0,
      discussionParticipationRate: metrics.discussionParticipationRate || 0,
      assignmentSubmissionRate: metrics.assignmentSubmissionRate || 0,
      quizAttemptRate: metrics.quizAttemptRate || 0,
      averageQuizScore: metrics.averageQuizScore || 0,
      lessonCompletionVelocity: metrics.lessonCompletionVelocity || 0,
      studentRetentionRate: metrics.studentRetentionRate || 0
    };
  }

  private getEnrollmentHealth(): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    if (this._totalEnrollments >= 100) return 'excellent';
    if (this._totalEnrollments >= 50) return 'good';
    if (this._totalEnrollments >= 10) return 'needs_improvement';
    return 'poor';
  }

  private getCompletionHealth(): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    if (this._completionRate >= 80) return 'excellent';
    if (this._completionRate >= 60) return 'good';
    if (this._completionRate >= 40) return 'needs_improvement';
    return 'poor';
  }

  private getEngagementHealth(): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    const avgEngagement = (
      this._engagementMetrics.discussionParticipationRate +
      this._engagementMetrics.assignmentSubmissionRate +
      this._engagementMetrics.quizAttemptRate +
      this._engagementMetrics.studentRetentionRate
    ) / 4;

    if (avgEngagement >= 80) return 'excellent';
    if (avgEngagement >= 60) return 'good';
    if (avgEngagement >= 40) return 'needs_improvement';
    return 'poor';
  }
}