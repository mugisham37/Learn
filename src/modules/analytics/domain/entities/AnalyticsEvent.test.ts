/**
 * AnalyticsEvent Entity Tests
 *
 * Tests for the AnalyticsEvent domain entity
 */

import { describe, it, expect } from 'vitest';
import { AnalyticsEvent, type AnalyticsEventData } from './AnalyticsEvent.js';

describe('AnalyticsEvent', () => {
  const validEventData: AnalyticsEventData = {
    id: 'event-123',
    userId: 'user-456',
    eventType: 'lesson_completed',
    eventData: {
      courseId: 'course-789',
      lessonId: 'lesson-101',
      duration: 1800, // 30 minutes
      progress: 100,
      sessionId: 'session-abc',
    },
    timestamp: new Date(),
  };

  it('should create a valid AnalyticsEvent instance', () => {
    const event = new AnalyticsEvent(validEventData);

    expect(event.id).toBe(validEventData.id);
    expect(event.userId).toBe(validEventData.userId);
    expect(event.eventType).toBe(validEventData.eventType);
  });

  it('should identify learning events correctly', () => {
    const learningEvent = new AnalyticsEvent(validEventData);
    const engagementEvent = new AnalyticsEvent({
      ...validEventData,
      eventType: 'page_view',
    });
    const systemEvent = new AnalyticsEvent({
      ...validEventData,
      eventType: 'user_login',
    });

    expect(learningEvent.isLearningEvent()).toBe(true);
    expect(engagementEvent.isLearningEvent()).toBe(false);
    expect(systemEvent.isLearningEvent()).toBe(false);
  });

  it('should identify engagement events correctly', () => {
    const engagementEvent = new AnalyticsEvent({
      ...validEventData,
      eventType: 'button_click',
    });

    expect(engagementEvent.isEngagementEvent()).toBe(true);
    expect(engagementEvent.isLearningEvent()).toBe(false);
    expect(engagementEvent.isSystemEvent()).toBe(false);
  });

  it('should identify system events correctly', () => {
    const systemEvent = new AnalyticsEvent({
      ...validEventData,
      eventType: 'error_occurred',
    });

    expect(systemEvent.isSystemEvent()).toBe(true);
    expect(systemEvent.isLearningEvent()).toBe(false);
    expect(systemEvent.isEngagementEvent()).toBe(false);
  });

  it('should get correct category', () => {
    const learningEvent = new AnalyticsEvent(validEventData);
    const engagementEvent = new AnalyticsEvent({
      ...validEventData,
      eventType: 'page_view',
    });

    expect(learningEvent.getCategory()).toBe('learning');
    expect(engagementEvent.getCategory()).toBe('engagement');
  });

  it('should identify completion events', () => {
    const completionEvent = new AnalyticsEvent(validEventData); // lesson_completed
    const startEvent = new AnalyticsEvent({
      ...validEventData,
      eventType: 'lesson_started',
    });

    expect(completionEvent.isCompletionEvent()).toBe(true);
    expect(startEvent.isCompletionEvent()).toBe(false);
  });

  it('should identify start events', () => {
    const startEvent = new AnalyticsEvent({
      ...validEventData,
      eventType: 'lesson_started',
    });
    const completionEvent = new AnalyticsEvent(validEventData); // lesson_completed

    expect(startEvent.isStartEvent()).toBe(true);
    expect(completionEvent.isStartEvent()).toBe(false);
  });

  it('should extract course context', () => {
    const event = new AnalyticsEvent(validEventData);
    const context = event.getCourseContext();

    expect(context.courseId).toBe('course-789');
    expect(context.lessonId).toBe('lesson-101');
  });

  it('should extract session context', () => {
    const event = new AnalyticsEvent(validEventData);
    const context = event.getSessionContext();

    expect(context.sessionId).toBe('session-abc');
  });

  it('should get duration', () => {
    const event = new AnalyticsEvent(validEventData);

    expect(event.getDuration()).toBe(1800);
  });

  it('should get progress', () => {
    const event = new AnalyticsEvent(validEventData);

    expect(event.getProgress()).toBe(100);
  });

  it('should create learning event using static method', () => {
    const event = AnalyticsEvent.createLearningEvent('user-123', 'quiz_completed', {
      courseId: 'course-456',
      score: 85,
      duration: 600,
    });

    expect(event.userId).toBe('user-123');
    expect(event.eventType).toBe('quiz_completed');
    expect(event.isLearningEvent()).toBe(true);
    expect(event.getScore()).toBe(85);
  });

  it('should create engagement event using static method', () => {
    const event = AnalyticsEvent.createEngagementEvent('user-123', 'button_click', {
      elementId: 'submit-btn',
      interactionType: 'click',
    });

    expect(event.userId).toBe('user-123');
    expect(event.eventType).toBe('button_click');
    expect(event.isEngagementEvent()).toBe(true);
  });

  it('should create system event using static method', () => {
    const event = AnalyticsEvent.createSystemEvent('error_occurred', {
      component: 'payment-service',
      errorMessage: 'Payment failed',
    });

    expect(event.eventType).toBe('error_occurred');
    expect(event.isSystemEvent()).toBe(true);
  });

  it('should sanitize sensitive data', () => {
    const eventWithSensitiveData = new AnalyticsEvent({
      ...validEventData,
      eventData: {
        ...validEventData.eventData,
        password: 'secret123',
        token: 'jwt-token',
        ipAddress: '192.168.1.100',
      },
    });

    const sanitized = eventWithSensitiveData.toSanitizedData();

    expect(sanitized.eventData.password).toBeUndefined();
    expect(sanitized.eventData.token).toBeUndefined();
    expect(sanitized.eventData.ipAddress).toBe('192.168.1.xxx');
  });

  it('should throw error for missing eventType', () => {
    const invalidData = { ...validEventData, eventType: '' };

    expect(() => new AnalyticsEvent(invalidData as any)).toThrow(
      'AnalyticsEvent: eventType is required'
    );
  });

  it('should throw error for future timestamp', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const invalidData = { ...validEventData, timestamp: futureDate };

    expect(() => new AnalyticsEvent(invalidData)).toThrow(
      'AnalyticsEvent: timestamp cannot be in the future'
    );
  });

  it('should throw error for unsupported event type', () => {
    const invalidData = { ...validEventData, eventType: 'invalid_event_type' };

    expect(() => new AnalyticsEvent(invalidData as any)).toThrow(
      'AnalyticsEvent: unsupported eventType: invalid_event_type'
    );
  });

  it('should require userId for learning events', () => {
    const invalidData = { ...validEventData, userId: undefined };

    expect(() => new AnalyticsEvent(invalidData)).toThrow(
      'AnalyticsEvent: userId is required for learning events'
    );
  });
});
