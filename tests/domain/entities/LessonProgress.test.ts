/**
 * LessonProgress Domain Entity Tests
 * 
 * Tests for the LessonProgress domain entity including status transitions,
 * time tracking, and quiz score recording.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LessonProgress } from '../../../src/modules/enrollments/domain/entities';

describe('LessonProgress Entity', () => {
  let lessonProgress: LessonProgress;
  const enrollmentId = 'enrollment-123';
  const lessonId = 'lesson-456';

  beforeEach(() => {
    lessonProgress = LessonProgress.create({
      enrollmentId,
      lessonId,
      status: 'not_started',
      timeSpentSeconds: 0,
      attemptsCount: 0,
    });
  });

  describe('Creation', () => {
    it('should create lesson progress with correct properties', () => {
      expect(lessonProgress.enrollmentId).toBe(enrollmentId);
      expect(lessonProgress.lessonId).toBe(lessonId);
      expect(lessonProgress.status).toBe('not_started');
      expect(lessonProgress.timeSpentSeconds).toBe(0);
      expect(lessonProgress.attemptsCount).toBe(0);
      expect(lessonProgress.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Status Transitions', () => {
    it('should start lesson from not_started status', () => {
      lessonProgress.startLesson();

      expect(lessonProgress.status).toBe('in_progress');
      expect(lessonProgress.lastAccessedAt).toBeInstanceOf(Date);
      expect(lessonProgress.domainEvents).toHaveLength(1);
      expect(lessonProgress.domainEvents[0].eventType).toBe('LessonProgressUpdated');
    });

    it('should throw error when starting lesson not in not_started status', () => {
      lessonProgress.startLesson();

      expect(() => lessonProgress.startLesson()).toThrow(
        'Lesson can only be started from not_started status'
      );
    });

    it('should complete lesson', () => {
      lessonProgress.completeLesson();

      expect(lessonProgress.status).toBe('completed');
      expect(lessonProgress.completedAt).toBeInstanceOf(Date);
      expect(lessonProgress.isCompleted()).toBe(true);
    });

    it('should be idempotent when completing already completed lesson', () => {
      lessonProgress.completeLesson();
      const firstCompletedAt = lessonProgress.completedAt;

      lessonProgress.completeLesson();

      expect(lessonProgress.completedAt).toBe(firstCompletedAt);
    });
  });

  describe('Time Tracking', () => {
    it('should add time spent and auto-start lesson', () => {
      lessonProgress.addTimeSpent(300); // 5 minutes

      expect(lessonProgress.status).toBe('in_progress');
      expect(lessonProgress.timeSpentSeconds).toBe(300);
      expect(lessonProgress.lastAccessedAt).toBeInstanceOf(Date);
    });

    it('should accumulate time spent', () => {
      lessonProgress.addTimeSpent(300);
      lessonProgress.addTimeSpent(200);

      expect(lessonProgress.timeSpentSeconds).toBe(500);
    });

    it('should throw error for negative time', () => {
      expect(() => lessonProgress.addTimeSpent(-100)).toThrow(
        'Additional time cannot be negative'
      );
    });
  });

  describe('Quiz Score Recording', () => {
    it('should record quiz score and increment attempts', () => {
      lessonProgress.recordQuizScore(85);

      expect(lessonProgress.quizScore).toBe(85);
      expect(lessonProgress.attemptsCount).toBe(1);
      expect(lessonProgress.status).toBe('in_progress');
    });

    it('should increment attempts on multiple quiz attempts', () => {
      lessonProgress.recordQuizScore(75);
      lessonProgress.recordQuizScore(85);

      expect(lessonProgress.quizScore).toBe(85);
      expect(lessonProgress.attemptsCount).toBe(2);
    });

    it('should throw error for invalid quiz score', () => {
      expect(() => lessonProgress.recordQuizScore(-10)).toThrow(
        'Quiz score must be between 0 and 100'
      );

      expect(() => lessonProgress.recordQuizScore(110)).toThrow(
        'Quiz score must be between 0 and 100'
      );
    });
  });

  describe('Progress Reset', () => {
    it('should reset progress to initial state', () => {
      lessonProgress.startLesson();
      lessonProgress.addTimeSpent(300);
      lessonProgress.recordQuizScore(85);
      lessonProgress.completeLesson();

      lessonProgress.resetProgress();

      expect(lessonProgress.status).toBe('not_started');
      expect(lessonProgress.timeSpentSeconds).toBe(0);
      expect(lessonProgress.completedAt).toBeUndefined();
      expect(lessonProgress.quizScore).toBeUndefined();
      expect(lessonProgress.attemptsCount).toBe(0);
      expect(lessonProgress.lastAccessedAt).toBeUndefined();
    });
  });

  describe('Progress Percentage', () => {
    it('should return 0% for not started', () => {
      expect(lessonProgress.getProgressPercentage()).toBe(0);
    });

    it('should return 50% for in progress', () => {
      lessonProgress.startLesson();
      expect(lessonProgress.getProgressPercentage()).toBe(50);
    });

    it('should return 100% for completed', () => {
      lessonProgress.completeLesson();
      expect(lessonProgress.getProgressPercentage()).toBe(100);
    });
  });

  describe('Status Checks', () => {
    it('should correctly identify status states', () => {
      expect(lessonProgress.isNotStarted()).toBe(true);
      expect(lessonProgress.isInProgress()).toBe(false);
      expect(lessonProgress.isCompleted()).toBe(false);

      lessonProgress.startLesson();
      expect(lessonProgress.isNotStarted()).toBe(false);
      expect(lessonProgress.isInProgress()).toBe(true);
      expect(lessonProgress.isCompleted()).toBe(false);

      lessonProgress.completeLesson();
      expect(lessonProgress.isNotStarted()).toBe(false);
      expect(lessonProgress.isInProgress()).toBe(false);
      expect(lessonProgress.isCompleted()).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should throw error for invalid enrollment ID', () => {
      expect(() => LessonProgress.create({
        enrollmentId: '',
        lessonId: 'lesson-123',
        status: 'not_started',
        timeSpentSeconds: 0,
        attemptsCount: 0,
      })).toThrow('Enrollment ID is required');
    });

    it('should throw error for invalid lesson ID', () => {
      expect(() => LessonProgress.create({
        enrollmentId: 'enrollment-123',
        lessonId: '',
        status: 'not_started',
        timeSpentSeconds: 0,
        attemptsCount: 0,
      })).toThrow('Lesson ID is required');
    });

    it('should throw error for negative time spent', () => {
      expect(() => LessonProgress.create({
        enrollmentId: 'enrollment-123',
        lessonId: 'lesson-123',
        status: 'not_started',
        timeSpentSeconds: -100,
        attemptsCount: 0,
      })).toThrow('Time spent cannot be negative');
    });

    it('should throw error for invalid status', () => {
      expect(() => LessonProgress.create({
        enrollmentId: 'enrollment-123',
        lessonId: 'lesson-123',
        status: 'invalid' as any,
        timeSpentSeconds: 0,
        attemptsCount: 0,
      })).toThrow('Invalid progress status');
    });
  });
});