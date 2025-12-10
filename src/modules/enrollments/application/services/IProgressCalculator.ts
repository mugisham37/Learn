/**
 * Progress Calculator Service Interface
 * 
 * Defines the contract for progress calculation operations.
 * Provides methods for calculating course progress, estimating time remaining,
 * and identifying struggling areas based on historical data.
 * 
 * Requirements: 5.4
 */

import { Enrollment } from '../../domain/entities/Enrollment.js';

/**
 * Struggling area analysis result
 */
export interface StrugglingArea {
  area: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestions: string[];
}

/**
 * Progress calculation result
 */
export interface ProgressCalculationResult {
  progressPercentage: number;
  completedLessons: number;
  totalLessons: number;
  inProgressLessons: number;
  notStartedLessons: number;
  lastUpdated: Date;
}

/**
 * Time estimation result
 */
export interface TimeEstimationResult {
  estimatedMinutesRemaining: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  basedOnLessons: number;
  averageTimePerLesson: number;
  methodology: string;
}

/**
 * Progress Calculator Service Interface
 * 
 * Provides methods for calculating progress metrics, time estimations,
 * and identifying areas where students may be struggling.
 */
export interface IProgressCalculator {
  /**
   * Calculates comprehensive course progress for an enrollment
   * 
   * Uses lesson completion status, time spent, and quiz scores to determine
   * overall progress percentage and detailed completion statistics.
   * 
   * Requirements: 5.4 - Progress percentage calculation
   * 
   * @param enrollment - The enrollment to calculate progress for
   * @returns Detailed progress calculation result
   * @throws NotFoundError if enrollment data is incomplete
   * @throws ValidationError if enrollment is in invalid state
   */
  calculateCourseProgress(enrollment: Enrollment): Promise<ProgressCalculationResult>;

  /**
   * Estimates time remaining for course completion
   * 
   * Uses historical data from completed lessons to predict time needed
   * for remaining lessons. Considers lesson types, difficulty, and
   * student's learning pace patterns.
   * 
   * Requirements: 5.4 - Time estimation for course completion
   * 
   * @param enrollment - The enrollment to estimate time for
   * @returns Time estimation result with confidence level
   * @throws NotFoundError if insufficient historical data
   * @throws ValidationError if enrollment is already completed
   */
  estimateTimeRemaining(enrollment: Enrollment): Promise<TimeEstimationResult>;

  /**
   * Identifies areas where the student may be struggling
   * 
   * Analyzes patterns in quiz scores, time spent, attempt counts,
   * and completion rates to identify potential learning difficulties.
   * Uses historical data to compare against typical student patterns.
   * 
   * Requirements: 5.4 - Struggling area identification
   * 
   * @param enrollment - The enrollment to analyze
   * @returns Array of identified struggling areas with suggestions
   * @throws NotFoundError if enrollment data is incomplete
   */
  identifyStrugglingAreas(enrollment: Enrollment): Promise<StrugglingArea[]>;

  /**
   * Calculates learning velocity for a student
   * 
   * Determines how quickly the student is progressing through
   * the course compared to typical completion patterns.
   * 
   * @param enrollment - The enrollment to analyze
   * @returns Learning velocity metrics
   */
  calculateLearningVelocity(enrollment: Enrollment): Promise<{
    lessonsPerWeek: number;
    minutesPerWeek: number;
    velocityTrend: 'increasing' | 'stable' | 'decreasing';
    comparedToAverage: 'faster' | 'average' | 'slower';
  }>;

  /**
   * Predicts likelihood of course completion
   * 
   * Uses current progress patterns and historical data to predict
   * the probability that the student will complete the course.
   * 
   * @param enrollment - The enrollment to analyze
   * @returns Completion prediction with confidence
   */
  predictCompletionLikelihood(enrollment: Enrollment): Promise<{
    completionProbability: number; // 0-1
    confidenceLevel: 'low' | 'medium' | 'high';
    keyFactors: string[];
    recommendedActions: string[];
  }>;

  /**
   * Gets personalized learning recommendations
   * 
   * Analyzes student's learning patterns to provide personalized
   * recommendations for improving learning outcomes.
   * 
   * @param enrollment - The enrollment to analyze
   * @returns Personalized learning recommendations
   */
  getPersonalizedRecommendations(enrollment: Enrollment): Promise<{
    studySchedule: {
      recommendedSessionLength: number; // minutes
      recommendedFrequency: number; // sessions per week
      bestTimeOfDay?: 'morning' | 'afternoon' | 'evening';
    };
    focusAreas: string[];
    nextSteps: string[];
    motivationalTips: string[];
  }>;
}