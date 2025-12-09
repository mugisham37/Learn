/**
 * Analytics Schema Tests
 * 
 * Tests to verify the analytics schema structure and exports
 */

import { describe, it, expect } from 'vitest';
import {
  courseAnalytics,
  studentAnalytics,
  analyticsEvents,
  type CourseAnalytics,
  type NewCourseAnalytics,
  type StudentAnalytics,
  type NewStudentAnalytics,
  type AnalyticsEvent,
  type NewAnalyticsEvent,
} from './analytics.schema';

describe('Analytics Schema', () => {
  describe('Table Definitions', () => {
    it('should export courseAnalytics table', () => {
      expect(courseAnalytics).toBeDefined();
      expect(typeof courseAnalytics).toBe('object');
    });

    it('should export studentAnalytics table', () => {
      expect(studentAnalytics).toBeDefined();
      expect(typeof studentAnalytics).toBe('object');
    });

    it('should export analyticsEvents table', () => {
      expect(analyticsEvents).toBeDefined();
      expect(typeof analyticsEvents).toBe('object');
    });
  });

  describe('Course Analytics Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(courseAnalytics);
      
      expect(columns).toContain('courseId');
      expect(columns).toContain('totalEnrollments');
      expect(columns).toContain('activeEnrollments');
      expect(columns).toContain('completionCount');
      expect(columns).toContain('completionRate');
      expect(columns).toContain('averageRating');
      expect(columns).toContain('totalRevenue');
      expect(columns).toContain('averageTimeToCompletionDays');
      expect(columns).toContain('dropoutRate');
      expect(columns).toContain('mostDifficultLessonId');
      expect(columns).toContain('engagementMetrics');
      expect(columns).toContain('lastUpdated');
    });
  });

  describe('Student Analytics Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(studentAnalytics);
      
      expect(columns).toContain('userId');
      expect(columns).toContain('totalCoursesEnrolled');
      expect(columns).toContain('coursesCompleted');
      expect(columns).toContain('coursesInProgress');
      expect(columns).toContain('averageQuizScore');
      expect(columns).toContain('totalTimeInvestedMinutes');
      expect(columns).toContain('currentStreakDays');
      expect(columns).toContain('longestStreakDays');
      expect(columns).toContain('badgesEarned');
      expect(columns).toContain('skillRatings');
      expect(columns).toContain('lastUpdated');
    });
  });

  describe('Analytics Events Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(analyticsEvents);
      
      expect(columns).toContain('id');
      expect(columns).toContain('userId');
      expect(columns).toContain('eventType');
      expect(columns).toContain('eventData');
      expect(columns).toContain('timestamp');
    });
  });

  describe('Type Exports', () => {
    it('should export CourseAnalytics types', () => {
      // Type check - will fail at compile time if types don't exist
      const courseAnalytics: CourseAnalytics = {} as CourseAnalytics;
      const newCourseAnalytics: NewCourseAnalytics = {} as NewCourseAnalytics;
      
      expect(courseAnalytics).toBeDefined();
      expect(newCourseAnalytics).toBeDefined();
    });

    it('should export StudentAnalytics types', () => {
      // Type check - will fail at compile time if types don't exist
      const studentAnalytics: StudentAnalytics = {} as StudentAnalytics;
      const newStudentAnalytics: NewStudentAnalytics = {} as NewStudentAnalytics;
      
      expect(studentAnalytics).toBeDefined();
      expect(newStudentAnalytics).toBeDefined();
    });

    it('should export AnalyticsEvent types', () => {
      // Type check - will fail at compile time if types don't exist
      const analyticsEvent: AnalyticsEvent = {} as AnalyticsEvent;
      const newAnalyticsEvent: NewAnalyticsEvent = {} as NewAnalyticsEvent;
      
      expect(analyticsEvent).toBeDefined();
      expect(newAnalyticsEvent).toBeDefined();
    });
  });
});
