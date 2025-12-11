/**
 * StudentAnalytics Entity Tests
 * 
 * Tests for the StudentAnalytics domain entity
 */

import { describe, it, expect } from 'vitest';
import { StudentAnalytics, type StudentAnalyticsData } from './StudentAnalytics.js';

describe('StudentAnalytics', () => {
  const validData: StudentAnalyticsData = {
    userId: 'user-123',
    totalCoursesEnrolled: 10,
    coursesCompleted: 6,
    coursesInProgress: 3,
    averageQuizScore: 85.5,
    totalTimeInvestedMinutes: 1200,
    currentStreakDays: 7,
    longestStreakDays: 15,
    badgesEarned: ['first_completion', 'streak_7'],
    skillRatings: {
      'javascript': 85,
      'typescript': 75,
      'react': 90
    },
    lastUpdated: new Date()
  };

  it('should create a valid StudentAnalytics instance', () => {
    const analytics = new StudentAnalytics(validData);
    
    expect(analytics.userId).toBe(validData.userId);
    expect(analytics.totalCoursesEnrolled).toBe(validData.totalCoursesEnrolled);
    expect(analytics.coursesCompleted).toBe(validData.coursesCompleted);
  });

  it('should calculate completion rate correctly', () => {
    const analytics = new StudentAnalytics(validData);
    const completionRate = analytics.calculateCompletionRate();
    
    expect(completionRate).toBe(60.0); // 6/10 * 100
  });

  it('should calculate average time per course', () => {
    const analytics = new StudentAnalytics(validData);
    const avgTime = analytics.calculateAverageTimePerCourse();
    
    expect(avgTime).toBe(200); // 1200/6
  });

  it('should update course metrics', () => {
    const analytics = new StudentAnalytics(validData);
    
    analytics.updateCourseMetrics(15, 8, 5);
    
    expect(analytics.totalCoursesEnrolled).toBe(15);
    expect(analytics.coursesCompleted).toBe(8);
    expect(analytics.coursesInProgress).toBe(5);
  });

  it('should update streak correctly', () => {
    const analytics = new StudentAnalytics(validData);
    
    analytics.updateStreak(20);
    
    expect(analytics.currentStreakDays).toBe(20);
    expect(analytics.longestStreakDays).toBe(20); // Should update longest since 20 > 15
  });

  it('should award badges', () => {
    const analytics = new StudentAnalytics(validData);
    
    analytics.awardBadge('high_performer');
    
    expect(analytics.badgesEarned).toContain('high_performer');
    expect(analytics.badgesEarned).toHaveLength(3);
  });

  it('should not award duplicate badges', () => {
    const freshData = { ...validData, badgesEarned: ['first_completion', 'streak_7'] };
    const analytics = new StudentAnalytics(freshData);
    
    analytics.awardBadge('streak_7'); // Already exists
    
    expect(analytics.badgesEarned).toHaveLength(2); // Should remain 2
  });

  it('should update skill ratings', () => {
    const analytics = new StudentAnalytics(validData);
    
    analytics.updateSkillRating('python', 80);
    
    expect(analytics.skillRatings['python']).toBe(80);
  });

  it('should throw error for invalid skill rating', () => {
    const analytics = new StudentAnalytics(validData);
    
    expect(() => analytics.updateSkillRating('python', 150)).toThrow('Skill rating must be between 0 and 100');
  });

  it('should check badge qualifications', () => {
    const analytics = new StudentAnalytics(validData);
    
    expect(analytics.qualifiesForBadge('first_completion')).toBe(false); // Already has it
    expect(analytics.qualifiesForBadge('high_performer')).toBe(false); // Score is 85.5, needs 90
    expect(analytics.qualifiesForBadge('streak_30')).toBe(false); // Current streak is 7, needs 30
  });

  it('should get performance summary', () => {
    const analytics = new StudentAnalytics(validData);
    const summary = analytics.getPerformanceSummary();
    
    expect(summary).toHaveProperty('completionRate');
    expect(summary).toHaveProperty('performanceLevel');
    expect(summary).toHaveProperty('engagementLevel');
    expect(summary).toHaveProperty('learningConsistency');
    expect(summary.completionRate).toBe(60.0);
    expect(summary.performanceLevel).toBe('good'); // 85.5 score
  });

  it('should throw error for invalid userId', () => {
    const invalidData = { ...validData, userId: '' };
    
    expect(() => new StudentAnalytics(invalidData)).toThrow('StudentAnalytics: userId is required');
  });

  it('should throw error for negative values', () => {
    const invalidData = { ...validData, totalCoursesEnrolled: -1 };
    
    expect(() => new StudentAnalytics(invalidData)).toThrow('StudentAnalytics: totalCoursesEnrolled cannot be negative');
  });
});