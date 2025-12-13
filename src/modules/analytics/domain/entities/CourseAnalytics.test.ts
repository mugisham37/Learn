/**
 * CourseAnalytics Entity Tests
 *
 * Tests for the CourseAnalytics domain entity
 */

import { describe, it, expect } from 'vitest';
import { CourseAnalytics, type CourseAnalyticsData } from './CourseAnalytics.js';

describe('CourseAnalytics', () => {
  const validData: CourseAnalyticsData = {
    courseId: 'course-123',
    totalEnrollments: 100,
    activeEnrollments: 60,
    completionCount: 20,
    completionRate: 20.0,
    averageRating: 4.5,
    totalRevenue: 5000.0,
    averageTimeToCompletionDays: 30,
    dropoutRate: 20.0,
    mostDifficultLessonId: 'lesson-456',
    engagementMetrics: {
      averageSessionDuration: 45,
      totalVideoWatchTime: 1200,
      discussionParticipationRate: 75,
      assignmentSubmissionRate: 85,
      quizAttemptRate: 90,
      averageQuizScore: 82,
      lessonCompletionVelocity: 2.5,
      studentRetentionRate: 80,
    },
    lastUpdated: new Date(),
  };

  it('should create a valid CourseAnalytics instance', () => {
    const analytics = new CourseAnalytics(validData);

    expect(analytics.courseId).toBe(validData.courseId);
    expect(analytics.totalEnrollments).toBe(validData.totalEnrollments);
    expect(analytics.completionRate).toBe(validData.completionRate);
  });

  it('should calculate completion rate correctly', () => {
    const analytics = new CourseAnalytics(validData);
    const calculatedRate = analytics.calculateCompletionRate();

    expect(calculatedRate).toBe(20.0); // 20/100 * 100
  });

  it('should calculate dropout rate correctly', () => {
    const analytics = new CourseAnalytics(validData);
    const calculatedRate = analytics.calculateDropoutRate();

    expect(calculatedRate).toBe(20.0); // (100 - 60 - 20) / 100 * 100
  });

  it('should update enrollment metrics', () => {
    const analytics = new CourseAnalytics(validData);

    analytics.updateEnrollmentMetrics(150, 120, 90);

    expect(analytics.totalEnrollments).toBe(150);
    expect(analytics.activeEnrollments).toBe(120);
    expect(analytics.completionCount).toBe(90);
    expect(analytics.completionRate).toBe(60.0); // 90/150 * 100
  });

  it('should throw error for invalid courseId', () => {
    const invalidData = { ...validData, courseId: '' };

    expect(() => new CourseAnalytics(invalidData)).toThrow('CourseAnalytics: courseId is required');
  });

  it('should throw error for negative enrollments', () => {
    const invalidData = { ...validData, totalEnrollments: -1 };

    expect(() => new CourseAnalytics(invalidData)).toThrow(
      'CourseAnalytics: totalEnrollments cannot be negative'
    );
  });

  it('should throw error for invalid completion rate', () => {
    const invalidData = { ...validData, completionRate: 150 };

    expect(() => new CourseAnalytics(invalidData)).toThrow(
      'CourseAnalytics: completionRate must be between 0 and 100'
    );
  });

  it('should get performance summary', () => {
    const analytics = new CourseAnalytics(validData);
    const summary = analytics.getPerformanceSummary();

    expect(summary).toHaveProperty('enrollmentHealth');
    expect(summary).toHaveProperty('completionHealth');
    expect(summary).toHaveProperty('engagementHealth');
    expect(summary).toHaveProperty('revenuePerEnrollment');
    expect(summary.revenuePerEnrollment).toBe(50); // 5000/100
  });

  it('should convert to data object', () => {
    const analytics = new CourseAnalytics(validData);
    const data = analytics.toData();

    expect(data.courseId).toBe(validData.courseId);
    expect(data.totalEnrollments).toBe(validData.totalEnrollments);
    expect(data.engagementMetrics).toEqual(validData.engagementMetrics);
  });
});
