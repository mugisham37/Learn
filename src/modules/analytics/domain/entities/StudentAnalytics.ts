/**
 * StudentAnalytics Domain Entity
 *
 * Represents aggregated analytics data for a student including course progress,
 * performance metrics, learning streaks, and skill development.
 *
 * Requirements:
 * - 12.2: Student analytics aggregation with course progress, scores, and engagement metrics
 */

export interface StudentAnalyticsData {
  userId: string;
  totalCoursesEnrolled: number;
  coursesCompleted: number;
  coursesInProgress: number;
  averageQuizScore?: number;
  totalTimeInvestedMinutes: number;
  currentStreakDays: number;
  longestStreakDays: number;
  badgesEarned: string[];
  skillRatings: Record<string, number>;
  lastUpdated: Date;
}

export interface LearningStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakStartDate?: Date;
}

export interface SkillProgress {
  skillName: string;
  currentRating: number;
  previousRating: number;
  improvement: number;
  coursesContributing: string[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  earnedAt: Date;
  category: 'completion' | 'performance' | 'engagement' | 'streak' | 'skill';
}

export class StudentAnalytics {
  private readonly _userId: string;
  private _totalCoursesEnrolled: number;
  private _coursesCompleted: number;
  private _coursesInProgress: number;
  private _averageQuizScore?: number;
  private _totalTimeInvestedMinutes: number;
  private _currentStreakDays: number;
  private _longestStreakDays: number;
  private _badgesEarned: string[];
  private _skillRatings: Record<string, number>;
  private _lastUpdated: Date;

  constructor(data: StudentAnalyticsData) {
    this._userId = data.userId;
    this._totalCoursesEnrolled = data.totalCoursesEnrolled;
    this._coursesCompleted = data.coursesCompleted;
    this._coursesInProgress = data.coursesInProgress;
    this._averageQuizScore = data.averageQuizScore;
    this._totalTimeInvestedMinutes = data.totalTimeInvestedMinutes;
    this._currentStreakDays = data.currentStreakDays;
    this._longestStreakDays = data.longestStreakDays;
    this._badgesEarned = data.badgesEarned;
    this._skillRatings = data.skillRatings;
    this._lastUpdated = data.lastUpdated;

    this.validate();
  }

  // Getters
  get userId(): string {
    return this._userId;
  }

  get totalCoursesEnrolled(): number {
    return this._totalCoursesEnrolled;
  }

  get coursesCompleted(): number {
    return this._coursesCompleted;
  }

  get coursesInProgress(): number {
    return this._coursesInProgress;
  }

  get averageQuizScore(): number | undefined {
    return this._averageQuizScore;
  }

  get totalTimeInvestedMinutes(): number {
    return this._totalTimeInvestedMinutes;
  }

  get currentStreakDays(): number {
    return this._currentStreakDays;
  }

  get longestStreakDays(): number {
    return this._longestStreakDays;
  }

  get badgesEarned(): string[] {
    return [...this._badgesEarned];
  }

  get skillRatings(): Record<string, number> {
    return { ...this._skillRatings };
  }

  get lastUpdated(): Date {
    return this._lastUpdated;
  }

  /**
   * Calculate completion rate based on enrolled and completed courses
   */
  public calculateCompletionRate(): number {
    if (this._totalCoursesEnrolled === 0) {
      return 0;
    }
    return Math.round((this._coursesCompleted / this._totalCoursesEnrolled) * 100 * 100) / 100;
  }

  /**
   * Calculate average time per course completion
   */
  public calculateAverageTimePerCourse(): number {
    if (this._coursesCompleted === 0) {
      return 0;
    }
    return Math.round(this._totalTimeInvestedMinutes / this._coursesCompleted);
  }

  /**
   * Get learning velocity (courses completed per month)
   */
  public calculateLearningVelocity(enrollmentStartDate: Date): number {
    const monthsSinceStart = this.getMonthsDifference(enrollmentStartDate, new Date());
    if (monthsSinceStart === 0) {
      return 0;
    }
    return Math.round((this._coursesCompleted / monthsSinceStart) * 100) / 100;
  }

  /**
   * Update course enrollment metrics
   */
  public updateCourseMetrics(totalEnrolled: number, completed: number, inProgress: number): void {
    this._totalCoursesEnrolled = totalEnrolled;
    this._coursesCompleted = completed;
    this._coursesInProgress = inProgress;
    this._lastUpdated = new Date();
  }

  /**
   * Update quiz performance
   */
  public updateQuizPerformance(averageScore: number): void {
    this._averageQuizScore = averageScore;
    this._lastUpdated = new Date();
  }

  /**
   * Add time invested
   */
  public addTimeInvested(minutes: number): void {
    this._totalTimeInvestedMinutes += minutes;
    this._lastUpdated = new Date();
  }

  /**
   * Update learning streak
   */
  public updateStreak(currentStreak: number): void {
    this._currentStreakDays = currentStreak;
    if (currentStreak > this._longestStreakDays) {
      this._longestStreakDays = currentStreak;
    }
    this._lastUpdated = new Date();
  }

  /**
   * Award a badge
   */
  public awardBadge(badgeId: string): void {
    if (!this._badgesEarned.includes(badgeId)) {
      this._badgesEarned.push(badgeId);
      this._lastUpdated = new Date();
    }
  }

  /**
   * Update skill rating
   */
  public updateSkillRating(skillName: string, rating: number): void {
    if (rating < 0 || rating > 100) {
      throw new Error('Skill rating must be between 0 and 100');
    }
    this._skillRatings[skillName] = rating;
    this._lastUpdated = new Date();
  }

  /**
   * Get skill progress for a specific skill
   */
  public getSkillProgress(skillName: string, previousRating?: number): SkillProgress {
    const currentRating = this._skillRatings[skillName] || 0;
    const prevRating = previousRating || 0;
    const improvement = currentRating - prevRating;

    return {
      skillName,
      currentRating,
      previousRating: prevRating,
      improvement,
      coursesContributing: [], // This would be populated by the service layer
    };
  }

  /**
   * Get learning streak information
   */
  public getLearningStreak(): LearningStreak {
    return {
      currentStreak: this._currentStreakDays,
      longestStreak: this._longestStreakDays,
      lastActivityDate: this._lastUpdated,
      streakStartDate: this.calculateStreakStartDate(),
    };
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    completionRate: number;
    performanceLevel: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    engagementLevel: 'high' | 'medium' | 'low';
    learningConsistency: 'consistent' | 'irregular' | 'inactive';
    totalBadges: number;
    averageSkillRating: number;
  } {
    const completionRate = this.calculateCompletionRate();
    const performanceLevel = this.getPerformanceLevel();
    const engagementLevel = this.getEngagementLevel();
    const learningConsistency = this.getLearningConsistency();
    const totalBadges = this._badgesEarned.length;
    const averageSkillRating = this.calculateAverageSkillRating();

    return {
      completionRate,
      performanceLevel,
      engagementLevel,
      learningConsistency,
      totalBadges,
      averageSkillRating,
    };
  }

  /**
   * Check if student qualifies for a specific badge
   */
  public qualifiesForBadge(badgeType: string): boolean {
    switch (badgeType) {
      case 'first_completion':
        return this._coursesCompleted >= 1 && !this._badgesEarned.includes('first_completion');
      case 'streak_7':
        return this._currentStreakDays >= 7 && !this._badgesEarned.includes('streak_7');
      case 'streak_30':
        return this._currentStreakDays >= 30 && !this._badgesEarned.includes('streak_30');
      case 'high_performer':
        return (
          (this._averageQuizScore || 0) >= 90 && !this._badgesEarned.includes('high_performer')
        );
      case 'course_completionist':
        return this._coursesCompleted >= 10 && !this._badgesEarned.includes('course_completionist');
      default:
        return false;
    }
  }

  /**
   * Convert to plain object for persistence
   */
  public toData(): StudentAnalyticsData {
    return {
      userId: this._userId,
      totalCoursesEnrolled: this._totalCoursesEnrolled,
      coursesCompleted: this._coursesCompleted,
      coursesInProgress: this._coursesInProgress,
      averageQuizScore: this._averageQuizScore,
      totalTimeInvestedMinutes: this._totalTimeInvestedMinutes,
      currentStreakDays: this._currentStreakDays,
      longestStreakDays: this._longestStreakDays,
      badgesEarned: this._badgesEarned,
      skillRatings: this._skillRatings,
      lastUpdated: this._lastUpdated,
    };
  }

  private validate(): void {
    if (!this._userId) {
      throw new Error('StudentAnalytics: userId is required');
    }

    if (this._totalCoursesEnrolled < 0) {
      throw new Error('StudentAnalytics: totalCoursesEnrolled cannot be negative');
    }

    if (this._coursesCompleted < 0) {
      throw new Error('StudentAnalytics: coursesCompleted cannot be negative');
    }

    if (this._coursesInProgress < 0) {
      throw new Error('StudentAnalytics: coursesInProgress cannot be negative');
    }

    if (
      this._averageQuizScore !== undefined &&
      (this._averageQuizScore < 0 || this._averageQuizScore > 100)
    ) {
      throw new Error('StudentAnalytics: averageQuizScore must be between 0 and 100');
    }

    if (this._totalTimeInvestedMinutes < 0) {
      throw new Error('StudentAnalytics: totalTimeInvestedMinutes cannot be negative');
    }

    if (this._currentStreakDays < 0) {
      throw new Error('StudentAnalytics: currentStreakDays cannot be negative');
    }

    if (this._longestStreakDays < 0) {
      throw new Error('StudentAnalytics: longestStreakDays cannot be negative');
    }

    // Validate skill ratings
    for (const [skill, rating] of Object.entries(this._skillRatings)) {
      if (rating < 0 || rating > 100) {
        throw new Error(`StudentAnalytics: skill rating for ${skill} must be between 0 and 100`);
      }
    }
  }

  private getMonthsDifference(startDate: Date, endDate: Date): number {
    const yearDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthDiff = endDate.getMonth() - startDate.getMonth();
    return Math.max(1, yearDiff * 12 + monthDiff);
  }

  private calculateStreakStartDate(): Date | undefined {
    if (this._currentStreakDays === 0) {
      return undefined;
    }
    const startDate = new Date(this._lastUpdated);
    startDate.setDate(startDate.getDate() - this._currentStreakDays);
    return startDate;
  }

  private getPerformanceLevel(): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    const score = this._averageQuizScore || 0;
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'needs_improvement';
    return 'poor';
  }

  private getEngagementLevel(): 'high' | 'medium' | 'low' {
    const completionRate = this.calculateCompletionRate();
    if (completionRate >= 80 && this._currentStreakDays >= 7) return 'high';
    if (completionRate >= 50 && this._currentStreakDays >= 3) return 'medium';
    return 'low';
  }

  private getLearningConsistency(): 'consistent' | 'irregular' | 'inactive' {
    if (this._currentStreakDays >= 7) return 'consistent';
    if (this._currentStreakDays >= 1) return 'irregular';
    return 'inactive';
  }

  private calculateAverageSkillRating(): number {
    const ratings = Object.values(this._skillRatings);
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, rating) => acc + rating, 0);
    return Math.round((sum / ratings.length) * 100) / 100;
  }
}
