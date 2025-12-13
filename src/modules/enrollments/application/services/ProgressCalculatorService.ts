/**
 * Progress Calculator Service Implementation
 *
 * Implements progress calculation operations including course progress calculation,
 * time estimation, and struggling area identification using historical data analysis.
 *
 * Requirements: 5.4
 */

import { NotFoundError, ValidationError } from '../../../../shared/errors/index.js';

import { ILessonRepository } from '../../../courses/infrastructure/repositories/ILessonRepository.js';

import { Enrollment } from '../../domain/entities/Enrollment.js';

import { IEnrollmentRepository } from '../../infrastructure/repositories/IEnrollmentRepository.js';
import { ILessonProgressRepository } from '../../infrastructure/repositories/ILessonProgressRepository.js';
import {
  IProgressCalculator,
  StrugglingArea,
  ProgressCalculationResult,
  TimeEstimationResult,
} from './IProgressCalculator.js';
import { LessonProgressRecord, LessonData, LessonTypeMultipliers, DefaultLessonDurations } from './types/progress.types.js';

/**
 * Progress Calculator Service Implementation
 *
 * Provides comprehensive progress analysis using statistical methods
 * and historical data patterns to generate insights and predictions.
 */
export class ProgressCalculatorService implements IProgressCalculator {
  constructor(
    private readonly lessonProgressRepository: ILessonProgressRepository,
    private readonly lessonRepository: ILessonRepository,
    private readonly _enrollmentRepository: IEnrollmentRepository
  ) {}

  /**
   * Calculates comprehensive course progress for an enrollment
   *
   * Requirements: 5.4 - Progress percentage calculation
   */
  async calculateCourseProgress(enrollment: Enrollment): Promise<ProgressCalculationResult> {
    if (!enrollment.id) {
      throw new ValidationError('Enrollment must have a valid ID', [
        { field: 'enrollment.id', message: 'Enrollment ID is required' },
      ]);
    }

    // Get all lesson progress records for this enrollment
    const progressRecords = await this.lessonProgressRepository.findByEnrollment(enrollment.id);

    if (progressRecords.length === 0) {
      throw new NotFoundError('No lesson progress records found for enrollment');
    }

    // Calculate progress statistics
    const totalLessons = progressRecords.length;
    const completedLessons = progressRecords.filter((p) => p.status === 'completed').length;
    const inProgressLessons = progressRecords.filter((p) => p.status === 'in_progress').length;
    const notStartedLessons = progressRecords.filter((p) => p.status === 'not_started').length;

    // Calculate progress percentage
    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Find the most recent update
    const lastUpdated = progressRecords.reduce((latest, record) => {
      const recordDate = new Date(record.updatedAt);
      return recordDate > latest ? recordDate : latest;
    }, new Date(0));

    return {
      progressPercentage,
      completedLessons,
      totalLessons,
      inProgressLessons,
      notStartedLessons,
      lastUpdated,
    };
  }

  /**
   * Estimates time remaining for course completion
   *
   * Requirements: 5.4 - Time estimation for course completion
   */
  async estimateTimeRemaining(enrollment: Enrollment): Promise<TimeEstimationResult> {
    if (!enrollment.id) {
      throw new ValidationError('Enrollment must have a valid ID', [
        { field: 'enrollment.id', message: 'Enrollment ID is required' },
      ]);
    }

    if (enrollment.status === 'completed') {
      throw new ValidationError('Cannot estimate time for completed enrollment', [
        { field: 'enrollment.status', message: 'Enrollment is already completed' },
      ]);
    }

    // Get progress records and lesson data
    const progressRecords = await this.lessonProgressRepository.findByEnrollment(enrollment.id);
    const lessons = await this.lessonRepository.findByCourse(enrollment.courseId);

    if (progressRecords.length === 0 || lessons.length === 0) {
      throw new NotFoundError('Insufficient data for time estimation');
    }

    // Filter completed lessons with time data
    const completedWithTime = progressRecords.filter(
      (p) => p.status === 'completed' && p.timeSpentSeconds > 0
    );

    if (completedWithTime.length === 0) {
      // No historical data, use lesson duration estimates
      return this.estimateFromLessonDurations(progressRecords, lessons);
    }

    // Calculate average time per completed lesson
    const totalTimeSpent = completedWithTime.reduce((sum, p) => sum + p.timeSpentSeconds, 0);
    const averageTimePerLesson = totalTimeSpent / completedWithTime.length;

    // Count remaining lessons
    const remainingLessons = progressRecords.filter((p) => p.status !== 'completed').length;

    // Apply lesson type weighting
    const weightedEstimate = await this.applyLessonTypeWeighting(
      remainingLessons,
      averageTimePerLesson,
      progressRecords,
      lessons
    );

    // Determine confidence level based on data quality
    const confidenceLevel = this.determineConfidenceLevel(
      completedWithTime.length,
      progressRecords.length
    );

    return {
      estimatedMinutesRemaining: Math.round(weightedEstimate / 60),
      confidenceLevel,
      basedOnLessons: completedWithTime.length,
      averageTimePerLesson: Math.round(averageTimePerLesson / 60),
      methodology: 'historical_data_with_type_weighting',
    };
  }

  /**
   * Identifies areas where the student may be struggling
   *
   * Requirements: 5.4 - Struggling area identification
   */
  async identifyStrugglingAreas(enrollment: Enrollment): Promise<StrugglingArea[]> {
    if (!enrollment.id) {
      throw new ValidationError('Enrollment must have a valid ID', [
        { field: 'enrollment.id', message: 'Enrollment ID is required' },
      ]);
    }

    const progressRecords = await this.lessonProgressRepository.findByEnrollment(enrollment.id);

    if (progressRecords.length === 0) {
      throw new NotFoundError('No lesson progress data found for analysis');
    }

    const strugglingAreas: StrugglingArea[] = [];

    // Analyze quiz performance
    const quizStruggles = this.analyzeQuizPerformance(progressRecords);
    strugglingAreas.push(...quizStruggles);

    // Analyze time spent patterns
    const timeStruggles = this.analyzeTimeSpentPatterns(progressRecords);
    strugglingAreas.push(...timeStruggles);

    // Analyze completion patterns
    const completionStruggles = this.analyzeCompletionPatterns(progressRecords);
    strugglingAreas.push(...completionStruggles);

    // Analyze attempt patterns
    const attemptStruggles = this.analyzeAttemptPatterns(progressRecords);
    strugglingAreas.push(...attemptStruggles);

    // Analyze engagement patterns
    const engagementStruggles = this.analyzeEngagementPatterns(progressRecords, enrollment);
    strugglingAreas.push(...engagementStruggles);

    return strugglingAreas;
  }

  /**
   * Calculates learning velocity for a student
   */
  async calculateLearningVelocity(enrollment: Enrollment): Promise<{
    lessonsPerWeek: number;
    minutesPerWeek: number;
    velocityTrend: 'increasing' | 'stable' | 'decreasing';
    comparedToAverage: 'faster' | 'average' | 'slower';
  }> {
    const progressRecords = await this.lessonProgressRepository.findByEnrollment(enrollment.id);
    const completedLessons = progressRecords.filter((p) => p.status === 'completed');

    if (completedLessons.length === 0) {
      return {
        lessonsPerWeek: 0,
        minutesPerWeek: 0,
        velocityTrend: 'stable',
        comparedToAverage: 'average',
      };
    }

    // Calculate time since enrollment
    const enrollmentDays = Math.max(
      1,
      Math.ceil((Date.now() - enrollment.enrolledAt.getTime()) / (1000 * 60 * 60 * 24))
    );
    const weeks = enrollmentDays / 7;

    // Calculate current velocity
    const lessonsPerWeek = completedLessons.length / weeks;
    const totalMinutes = completedLessons.reduce((sum, p) => sum + p.timeSpentSeconds / 60, 0);
    const minutesPerWeek = totalMinutes / weeks;

    // Analyze trend (compare first half vs second half)
    const velocityTrend = this.calculateVelocityTrend(completedLessons);

    // Compare to course average (simplified - would use historical data in production)
    const courseAverageVelocity = await this.getCourseAverageVelocity(enrollment.courseId);
    const comparedToAverage =
      lessonsPerWeek > courseAverageVelocity * 1.2
        ? 'faster'
        : lessonsPerWeek < courseAverageVelocity * 0.8
          ? 'slower'
          : 'average';

    return {
      lessonsPerWeek: Math.round(lessonsPerWeek * 10) / 10,
      minutesPerWeek: Math.round(minutesPerWeek),
      velocityTrend,
      comparedToAverage,
    };
  }

  /**
   * Predicts likelihood of course completion
   */
  async predictCompletionLikelihood(enrollment: Enrollment): Promise<{
    completionProbability: number;
    confidenceLevel: 'low' | 'medium' | 'high';
    keyFactors: string[];
    recommendedActions: string[];
  }> {
    const progressRecords = await this.lessonProgressRepository.findByEnrollment(enrollment.id);
    const progress = await this.calculateCourseProgress(enrollment);

    let completionProbability = 0.5; // Base probability
    const keyFactors: string[] = [];
    const recommendedActions: string[] = [];

    // Factor 1: Current progress
    if (progress.progressPercentage > 75) {
      completionProbability += 0.3;
      keyFactors.push('High progress completion (>75%)');
    } else if (progress.progressPercentage > 50) {
      completionProbability += 0.1;
      keyFactors.push('Moderate progress completion (>50%)');
    } else if (progress.progressPercentage < 25) {
      completionProbability -= 0.2;
      keyFactors.push('Low progress completion (<25%)');
      recommendedActions.push('Set daily study goals to increase momentum');
    }

    // Factor 2: Recent activity
    const recentActivity = this.hasRecentActivity(progressRecords, 7); // Last 7 days
    if (recentActivity) {
      completionProbability += 0.15;
      keyFactors.push('Recent learning activity');
    } else {
      completionProbability -= 0.15;
      keyFactors.push('No recent activity');
      recommendedActions.push('Resume regular study schedule');
    }

    // Factor 3: Quiz performance
    const avgQuizScore = this.calculateAverageQuizScore(progressRecords);
    if (avgQuizScore > 80) {
      completionProbability += 0.1;
      keyFactors.push('Strong quiz performance');
    } else if (avgQuizScore < 60) {
      completionProbability -= 0.1;
      keyFactors.push('Struggling with assessments');
      recommendedActions.push('Review lesson materials before taking quizzes');
    }

    // Factor 4: Time since enrollment
    const daysSinceEnrollment =
      (Date.now() - enrollment.enrolledAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceEnrollment > 90 && progress.progressPercentage < 50) {
      completionProbability -= 0.1;
      keyFactors.push('Extended enrollment with low progress');
      recommendedActions.push('Consider setting a completion deadline');
    }

    // Clamp probability between 0 and 1
    completionProbability = Math.max(0, Math.min(1, completionProbability));

    // Determine confidence level
    const confidenceLevel =
      progressRecords.length > 10 ? 'high' : progressRecords.length > 5 ? 'medium' : 'low';

    return {
      completionProbability: Math.round(completionProbability * 100) / 100,
      confidenceLevel,
      keyFactors,
      recommendedActions,
    };
  }

  /**
   * Gets personalized learning recommendations
   */
  async getPersonalizedRecommendations(enrollment: Enrollment): Promise<{
    studySchedule: {
      recommendedSessionLength: number;
      recommendedFrequency: number;
      bestTimeOfDay?: 'morning' | 'afternoon' | 'evening';
    };
    focusAreas: string[];
    nextSteps: string[];
    motivationalTips: string[];
  }> {
    const progressRecords = await this.lessonProgressRepository.findByEnrollment(enrollment.id);
    const strugglingAreas = await this.identifyStrugglingAreas(enrollment);

    // Analyze study patterns
    const studyPatterns = this.analyzeStudyPatterns(progressRecords);

    // Generate recommendations based on analysis
    const focusAreas = strugglingAreas.map((area) => area.area);
    const nextSteps = await this.generateNextSteps(enrollment, progressRecords);
    const motivationalTips = this.generateMotivationalTips(enrollment, progressRecords);

    return {
      studySchedule: {
        recommendedSessionLength: studyPatterns.optimalSessionLength,
        recommendedFrequency: studyPatterns.optimalFrequency,
        bestTimeOfDay: studyPatterns.bestTimeOfDay,
      },
      focusAreas,
      nextSteps,
      motivationalTips,
    };
  }

  // Private helper methods

  private estimateFromLessonDurations(
    progressRecords: LessonProgressRecord[],
    lessons: LessonData[]
  ): Promise<TimeEstimationResult> {
    const remainingLessons = progressRecords.filter((p) => p.status !== 'completed');

    // Use lesson duration metadata if available
    let totalEstimatedMinutes = 0;
    for (const progress of remainingLessons) {
      const lesson = lessons.find((l) => l.id === progress.lessonId);
      if (lesson?.durationMinutes) {
        totalEstimatedMinutes += lesson.durationMinutes;
      } else {
        // Default estimates by lesson type
        totalEstimatedMinutes += this.getDefaultLessonDuration(lesson?.lessonType || 'text');
      }
    }

    return {
      estimatedMinutesRemaining: totalEstimatedMinutes,
      confidenceLevel: 'low',
      basedOnLessons: 0,
      averageTimePerLesson: totalEstimatedMinutes / Math.max(1, remainingLessons.length),
      methodology: 'lesson_duration_estimates',
    };
  }

  private applyLessonTypeWeighting(
    _remainingLessons: number,
    averageTimePerLesson: number,
    progressRecords: LessonProgressRecord[],
    lessons: LessonData[]
  ): Promise<number> {
    let weightedTime = 0;

    const remainingProgress = progressRecords.filter((p) => p.status !== 'completed');

    for (const progress of remainingProgress) {
      const lesson = lessons.find((l) => l.id === progress.lessonId);
      const lessonType = lesson?.lessonType || 'text';

      // Apply type-specific multipliers
      const multiplier = this.getLessonTypeMultiplier(lessonType);
      weightedTime += averageTimePerLesson * multiplier;
    }

    return weightedTime;
  }

  private getLessonTypeMultiplier(lessonType: string): number {
    const multipliers: LessonTypeMultipliers = {
      video: 1.0, // Base time
      text: 0.7, // Usually faster to read
      quiz: 1.2, // May need multiple attempts
      assignment: 1.8, // Usually takes longer
    };

    return multipliers[lessonType as keyof LessonTypeMultipliers] || 1.0;
  }

  private getDefaultLessonDuration(lessonType: string): number {
    const defaults: DefaultLessonDurations = {
      video: 15, // 15 minutes
      text: 10, // 10 minutes
      quiz: 20, // 20 minutes
      assignment: 45, // 45 minutes
    };

    return defaults[lessonType as keyof DefaultLessonDurations] || 15;
  }

  private determineConfidenceLevel(
    completedLessons: number,
    totalLessons: number
  ): 'low' | 'medium' | 'high' {
    const completionRatio = completedLessons / totalLessons;

    if (completedLessons >= 10 && completionRatio >= 0.3) {
      return 'high';
    } else if (completedLessons >= 5 && completionRatio >= 0.2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private analyzeQuizPerformance(progressRecords: LessonProgressRecord[]): StrugglingArea[] {
    const areas: StrugglingArea[] = [];

    const quizScores = progressRecords
      .filter((p) => p.quizScore !== undefined && p.quizScore !== null)
      .map((p) => p.quizScore);

    if (quizScores.length === 0) {
      return areas;
    }

    const averageScore = quizScores.reduce((sum, score) => (sum || 0) + (score || 0), 0) / quizScores.length;
    const lowScores = quizScores.filter((score) => (score || 0) < 70).length;
    const lowScoreRatio = lowScores / quizScores.length;

    if (averageScore < 70) {
      areas.push({
        area: 'Quiz Performance',
        severity: averageScore < 50 ? 'high' : 'medium',
        description: `Average quiz score is ${Math.round(averageScore)}%, which is below the recommended 70%`,
        suggestions: [
          'Review lesson materials more thoroughly before taking quizzes',
          'Take notes while studying to improve retention',
          'Consider retaking lessons with low quiz scores',
        ],
      });
    }

    if (lowScoreRatio > 0.4) {
      areas.push({
        area: 'Consistent Assessment Struggles',
        severity: 'medium',
        description: `${Math.round(lowScoreRatio * 100)}% of quiz attempts scored below 70%`,
        suggestions: [
          'Slow down and read questions more carefully',
          'Practice active recall techniques while studying',
          'Seek help from instructors or study groups',
        ],
      });
    }

    return areas;
  }

  private analyzeTimeSpentPatterns(progressRecords: LessonProgressRecord[]): StrugglingArea[] {
    const areas: StrugglingArea[] = [];

    const timeRecords = progressRecords.filter((p) => p.timeSpentSeconds > 0);
    if (timeRecords.length === 0) {
      return areas;
    }

    const averageTime =
      timeRecords.reduce((sum, p) => sum + p.timeSpentSeconds, 0) / timeRecords.length;
    const highTimeRecords = timeRecords.filter((p) => p.timeSpentSeconds > averageTime * 2);
    const highTimeRatio = highTimeRecords.length / timeRecords.length;

    if (highTimeRatio > 0.3) {
      areas.push({
        area: 'Learning Pace',
        severity: 'medium',
        description: 'Taking significantly longer than average on many lessons',
        suggestions: [
          'Break study sessions into smaller chunks',
          'Eliminate distractions during study time',
          'Consider adjusting study environment for better focus',
        ],
      });
    }

    // Check for very short sessions that might indicate lack of engagement
    const shortSessions = timeRecords.filter((p) => p.timeSpentSeconds < 300); // Less than 5 minutes
    const shortSessionRatio = shortSessions.length / timeRecords.length;

    if (shortSessionRatio > 0.4) {
      areas.push({
        area: 'Study Engagement',
        severity: 'medium',
        description: 'Many lessons completed in very short time periods',
        suggestions: [
          'Spend more time engaging with lesson content',
          'Take notes to improve comprehension and retention',
          'Avoid rushing through materials',
        ],
      });
    }

    return areas;
  }

  private analyzeCompletionPatterns(progressRecords: LessonProgressRecord[]): StrugglingArea[] {
    const areas: StrugglingArea[] = [];

    const inProgressCount = progressRecords.filter((p) => p.status === 'in_progress').length;
    const totalCount = progressRecords.length;
    const inProgressRatio = inProgressCount / totalCount;

    if (inProgressRatio > 0.4) {
      areas.push({
        area: 'Lesson Completion',
        severity: 'medium',
        description: 'Many lessons started but not completed',
        suggestions: [
          'Focus on completing one lesson at a time',
          'Set specific goals for lesson completion',
          'Review and finish in-progress lessons before starting new ones',
        ],
      });
    }

    return areas;
  }

  private analyzeAttemptPatterns(progressRecords: LessonProgressRecord[]): StrugglingArea[] {
    const areas: StrugglingArea[] = [];

    const highAttemptRecords = progressRecords.filter((p) => p.attemptsCount > 3);
    const highAttemptRatio = highAttemptRecords.length / progressRecords.length;

    if (highAttemptRatio > 0.2) {
      areas.push({
        area: 'Content Mastery',
        severity: 'medium',
        description: 'Requiring multiple attempts on many lessons',
        suggestions: [
          'Review prerequisite materials before attempting lessons',
          'Take more time to understand concepts before moving forward',
          'Consider seeking additional help or resources',
        ],
      });
    }

    return areas;
  }

  private analyzeEngagementPatterns(
    progressRecords: LessonProgressRecord[],
    enrollment: Enrollment
  ): Promise<StrugglingArea[]> {
    const areas: StrugglingArea[] = [];

    // Check for long gaps in activity
    const recentActivity = this.hasRecentActivity(progressRecords, 14); // Last 14 days
    if (!recentActivity && enrollment.status === 'active') {
      areas.push({
        area: 'Study Consistency',
        severity: 'high',
        description: 'No recent learning activity in the past 2 weeks',
        suggestions: [
          'Set a regular study schedule',
          'Use calendar reminders to maintain consistency',
          'Start with shorter, more frequent study sessions',
        ],
      });
    }

    return areas;
  }

  private calculateVelocityTrend(completedLessons: any[]): 'increasing' | 'stable' | 'decreasing' {
    if (completedLessons.length < 4) {
      return 'stable';
    }

    // Sort by completion date
    const sorted = completedLessons
      .filter((l) => l.completedAt)
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);

    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return 'stable';
    }

    // Calculate lessons per day for each half
    const firstHalfDays = this.calculateDaySpan(firstHalf);
    const secondHalfDays = this.calculateDaySpan(secondHalf);

    const firstHalfRate = firstHalf.length / Math.max(1, firstHalfDays);
    const secondHalfRate = secondHalf.length / Math.max(1, secondHalfDays);

    const changeRatio = secondHalfRate / firstHalfRate;

    if (changeRatio > 1.2) {
      return 'increasing';
    } else if (changeRatio < 0.8) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  private calculateDaySpan(lessons: any[]): number {
    if (lessons.length === 0) return 1;

    const dates = lessons.map((l) => new Date(l.completedAt).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);

    return Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)));
  }

  private async getCourseAverageVelocity(_courseId: string): Promise<number> {
    // In a real implementation, this would query historical data
    // For now, return a reasonable default
    return 2.5; // 2.5 lessons per week average
  }

  private hasRecentActivity(progressRecords: LessonProgressRecord[], days: number): boolean {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return progressRecords.some((p) => {
      const lastAccessed = p.lastAccessedAt ? new Date(p.lastAccessedAt) : new Date(p.updatedAt);
      return lastAccessed > cutoffDate;
    });
  }

  private calculateAverageQuizScore(progressRecords: LessonProgressRecord[]): number {
    const scores = progressRecords
      .filter((p) => p.quizScore !== undefined && p.quizScore !== null)
      .map((p) => p.quizScore);

    if (scores.length === 0) return 0;

    return scores.reduce((sum, score) => (sum || 0) + (score || 0), 0) / scores.length;
  }

  private analyzeStudyPatterns(progressRecords: LessonProgressRecord[]): {
    optimalSessionLength: number;
    optimalFrequency: number;
    bestTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  } {
    // Analyze current patterns and suggest improvements
    const completedLessons = progressRecords.filter((p) => p.status === 'completed');

    if (completedLessons.length === 0) {
      return {
        optimalSessionLength: 30, // Default 30 minutes
        optimalFrequency: 3, // Default 3 times per week
      };
    }

    // Calculate average session length based on time spent
    const avgTimePerLesson =
      completedLessons.reduce((sum, p) => sum + p.timeSpentSeconds, 0) / completedLessons.length;
    const avgMinutesPerLesson = Math.round(avgTimePerLesson / 60);

    // Suggest optimal session length (aim for 2-3 lessons per session)
    const optimalSessionLength = Math.max(20, Math.min(60, avgMinutesPerLesson * 2.5));

    // Calculate current frequency and suggest improvement
    const enrollmentDays = Math.max(
      1,
      Math.ceil(
        (Date.now() - new Date(completedLessons[0]?.createdAt || Date.now()).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const currentFrequency = (completedLessons.length / enrollmentDays) * 7;
    const optimalFrequency = Math.max(2, Math.min(5, Math.ceil(currentFrequency * 1.2)));

    return {
      optimalSessionLength,
      optimalFrequency,
    };
  }

  private async generateNextSteps(
    enrollment: Enrollment,
    progressRecords: LessonProgressRecord[]
  ): Promise<string[]> {
    const nextSteps: string[] = [];

    // Find next lesson to complete
    const nextLesson = progressRecords.find((p) => p.status !== 'completed');
    if (nextLesson) {
      nextSteps.push(`Continue with the next lesson in your course`);
    }

    // Check for in-progress lessons
    const inProgress = progressRecords.filter((p) => p.status === 'in_progress');
    if (inProgress.length > 0) {
      nextSteps.push(`Complete ${inProgress.length} lesson(s) you've already started`);
    }

    // Check for low quiz scores to review
    const lowScoreLessons = progressRecords.filter((p) => p.quizScore && p.quizScore < 70);
    if (lowScoreLessons.length > 0) {
      nextSteps.push(`Review and retake ${lowScoreLessons.length} lesson(s) with low quiz scores`);
    }

    // General progress recommendations
    const progress = await this.calculateCourseProgress(enrollment);
    if (progress.progressPercentage < 25) {
      nextSteps.push('Set a daily study goal to build momentum');
    } else if (progress.progressPercentage > 75) {
      nextSteps.push("You're almost done! Focus on completing the remaining lessons");
    }

    return nextSteps;
  }

  private generateMotivationalTips(_enrollment: Enrollment, progressRecords: LessonProgressRecord[]): string[] {
    const tips: string[] = [];

    const completedCount = progressRecords.filter((p) => p.status === 'completed').length;
    const totalCount = progressRecords.length;
    const progressPercentage = (completedCount / totalCount) * 100;

    if (progressPercentage > 50) {
      tips.push("Great progress! You're more than halfway through the course.");
    }

    if (completedCount > 0) {
      tips.push(`You've already completed ${completedCount} lesson(s). Keep up the momentum!`);
    }

    // Add general motivational tips
    tips.push('Remember: consistent small steps lead to big achievements.');
    tips.push('Every lesson completed brings you closer to your learning goals.');

    if (progressPercentage < 25) {
      tips.push("Starting is often the hardest part. You've got this!");
    }

    return tips;
  }
}
