/**
 * Analytics Cache Invalidation Service
 * 
 * Handles cache invalidation when data changes to ensure cache consistency.
 * Implements event-driven cache invalidation patterns.
 * 
 * Requirements: 12.6, 15.2
 */

import { analyticsCacheService, AnalyticsCacheKeys } from './AnalyticsCacheService.js';
import { buildCacheKey, CachePrefix } from '../../../../infrastructure/cache/index.js';

/**
 * Event types that trigger cache invalidation
 */
export enum CacheInvalidationEvent {
  // Course events
  COURSE_CREATED = 'course.created',
  COURSE_UPDATED = 'course.updated',
  COURSE_PUBLISHED = 'course.published',
  COURSE_DELETED = 'course.deleted',
  
  // Enrollment events
  STUDENT_ENROLLED = 'enrollment.created',
  ENROLLMENT_COMPLETED = 'enrollment.completed',
  ENROLLMENT_WITHDRAWN = 'enrollment.withdrawn',
  LESSON_PROGRESS_UPDATED = 'lesson.progress.updated',
  
  // Assessment events
  QUIZ_SUBMITTED = 'quiz.submitted',
  QUIZ_GRADED = 'quiz.graded',
  ASSIGNMENT_SUBMITTED = 'assignment.submitted',
  ASSIGNMENT_GRADED = 'assignment.graded',
  
  // Payment events
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  REFUND_PROCESSED = 'refund.processed',
  
  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  
  // Communication events
  DISCUSSION_POST_CREATED = 'discussion.post.created',
  MESSAGE_SENT = 'message.sent',
  ANNOUNCEMENT_CREATED = 'announcement.created',
}

/**
 * Event data structure for cache invalidation
 */
export interface CacheInvalidationEventData {
  eventType: CacheInvalidationEvent;
  timestamp: Date;
  userId?: string;
  courseId?: string;
  enrollmentId?: string;
  lessonId?: string;
  quizId?: string;
  assignmentId?: string;
  paymentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Analytics Cache Invalidation Service
 * 
 * Provides intelligent cache invalidation based on data change events.
 * Ensures cache consistency while minimizing unnecessary invalidations.
 */
export class AnalyticsCacheInvalidationService {
  /**
   * Handles cache invalidation for a specific event
   * 
   * @param eventData - Event data containing information about what changed
   */
  async handleCacheInvalidation(eventData: CacheInvalidationEventData): Promise<void> {
    try {
      console.log(`Handling cache invalidation for event: ${eventData.eventType}`);

      switch (eventData.eventType) {
        // Course events
        case CacheInvalidationEvent.COURSE_CREATED:
        case CacheInvalidationEvent.COURSE_UPDATED:
        case CacheInvalidationEvent.COURSE_PUBLISHED:
          await this.handleCourseEvent(eventData);
          break;
        
        case CacheInvalidationEvent.COURSE_DELETED:
          await this.handleCourseDeletedEvent(eventData);
          break;

        // Enrollment events
        case CacheInvalidationEvent.STUDENT_ENROLLED:
        case CacheInvalidationEvent.ENROLLMENT_COMPLETED:
        case CacheInvalidationEvent.ENROLLMENT_WITHDRAWN:
          await this.handleEnrollmentEvent(eventData);
          break;
        
        case CacheInvalidationEvent.LESSON_PROGRESS_UPDATED:
          await this.handleLessonProgressEvent(eventData);
          break;

        // Assessment events
        case CacheInvalidationEvent.QUIZ_SUBMITTED:
        case CacheInvalidationEvent.QUIZ_GRADED:
        case CacheInvalidationEvent.ASSIGNMENT_SUBMITTED:
        case CacheInvalidationEvent.ASSIGNMENT_GRADED:
          await this.handleAssessmentEvent(eventData);
          break;

        // Payment events
        case CacheInvalidationEvent.PAYMENT_COMPLETED:
        case CacheInvalidationEvent.PAYMENT_FAILED:
        case CacheInvalidationEvent.REFUND_PROCESSED:
          await this.handlePaymentEvent(eventData);
          break;

        // User events
        case CacheInvalidationEvent.USER_CREATED:
        case CacheInvalidationEvent.USER_UPDATED:
          await this.handleUserEvent(eventData);
          break;
        
        case CacheInvalidationEvent.USER_DELETED:
          await this.handleUserDeletedEvent(eventData);
          break;

        // Communication events
        case CacheInvalidationEvent.DISCUSSION_POST_CREATED:
        case CacheInvalidationEvent.MESSAGE_SENT:
        case CacheInvalidationEvent.ANNOUNCEMENT_CREATED:
          await this.handleCommunicationEvent(eventData);
          break;

        default:
          console.warn(`Unknown cache invalidation event type: ${eventData.eventType}`);
      }

      console.log(`Cache invalidation completed for event: ${eventData.eventType}`);
    } catch (error) {
      console.error(`Cache invalidation failed for event ${eventData.eventType}:`, error);
      // Don't throw - cache invalidation failures shouldn't break the main flow
    }
  }

  /**
   * Handles course-related events
   */
  private async handleCourseEvent(eventData: CacheInvalidationEventData): Promise<void> {
    if (!eventData.courseId) {
      console.warn('Course event missing courseId');
      return;
    }

    await Promise.all([
      // Invalidate course-specific caches
      analyticsCacheService.invalidateCourseCache(eventData.courseId),
      
      // Invalidate platform-wide caches that include course data
      this.invalidatePlatformCaches(),
      
      // Invalidate trending courses (course changes might affect trending)
      this.invalidateTrendingCaches(),
    ]);
  }

  /**
   * Handles course deletion events
   */
  private async handleCourseDeletedEvent(eventData: CacheInvalidationEventData): Promise<void> {
    if (!eventData.courseId) {
      console.warn('Course deleted event missing courseId');
      return;
    }

    await Promise.all([
      // Invalidate all course-related caches
      analyticsCacheService.invalidateCourseCache(eventData.courseId),
      
      // Invalidate all dashboard caches (course deletion affects all dashboards)
      analyticsCacheService.invalidateAllAnalyticsCache(),
    ]);
  }

  /**
   * Handles enrollment-related events
   */
  private async handleEnrollmentEvent(eventData: CacheInvalidationEventData): Promise<void> {
    const promises = [];

    if (eventData.courseId) {
      promises.push(analyticsCacheService.invalidateCourseCache(eventData.courseId));
    }

    if (eventData.userId) {
      promises.push(analyticsCacheService.invalidateStudentCache(eventData.userId));
    }

    if (eventData.courseId && eventData.userId) {
      promises.push(analyticsCacheService.invalidateEnrollmentCache(eventData.courseId, eventData.userId));
    }

    // Enrollment changes affect platform metrics and trending data
    promises.push(
      this.invalidatePlatformCaches(),
      this.invalidateTrendingCaches()
    );

    await Promise.all(promises);
  }

  /**
   * Handles lesson progress events
   */
  private async handleLessonProgressEvent(eventData: CacheInvalidationEventData): Promise<void> {
    const promises = [];

    if (eventData.courseId) {
      promises.push(analyticsCacheService.invalidateCourseCache(eventData.courseId));
    }

    if (eventData.userId) {
      promises.push(analyticsCacheService.invalidateStudentCache(eventData.userId));
    }

    // Progress changes affect dashboards
    promises.push(this.invalidateDashboardCaches());

    await Promise.all(promises);
  }

  /**
   * Handles assessment-related events
   */
  private async handleAssessmentEvent(eventData: CacheInvalidationEventData): Promise<void> {
    const promises = [];

    if (eventData.courseId && eventData.userId) {
      promises.push(analyticsCacheService.invalidateAssessmentCache(eventData.courseId, eventData.userId));
    }

    // Assessment changes affect performance metrics
    promises.push(this.invalidateDashboardCaches());

    await Promise.all(promises);
  }

  /**
   * Handles payment-related events
   */
  private async handlePaymentEvent(eventData: CacheInvalidationEventData): Promise<void> {
    const promises = [];

    if (eventData.courseId) {
      promises.push(analyticsCacheService.invalidatePaymentCache(eventData.courseId));
    } else {
      promises.push(analyticsCacheService.invalidatePaymentCache());
    }

    // Payment changes affect revenue metrics
    promises.push(this.invalidatePlatformCaches());

    await Promise.all(promises);
  }

  /**
   * Handles user-related events
   */
  private async handleUserEvent(eventData: CacheInvalidationEventData): Promise<void> {
    if (!eventData.userId) {
      console.warn('User event missing userId');
      return;
    }

    await Promise.all([
      // Invalidate user-specific caches
      analyticsCacheService.invalidateStudentCache(eventData.userId),
      
      // User changes might affect platform metrics
      this.invalidatePlatformCaches(),
    ]);
  }

  /**
   * Handles user deletion events
   */
  private async handleUserDeletedEvent(eventData: CacheInvalidationEventData): Promise<void> {
    if (!eventData.userId) {
      console.warn('User deleted event missing userId');
      return;
    }

    await Promise.all([
      // Invalidate all user-related caches
      analyticsCacheService.invalidateStudentCache(eventData.userId),
      
      // User deletion affects platform-wide metrics
      analyticsCacheService.invalidateAllAnalyticsCache(),
    ]);
  }

  /**
   * Handles communication-related events
   */
  private async handleCommunicationEvent(eventData: CacheInvalidationEventData): Promise<void> {
    const promises = [];

    if (eventData.courseId) {
      // Communication affects course engagement metrics
      promises.push(analyticsCacheService.invalidateCourseCache(eventData.courseId));
    }

    if (eventData.userId) {
      // Communication affects student engagement metrics
      promises.push(analyticsCacheService.invalidateStudentCache(eventData.userId));
    }

    await Promise.all(promises);
  }

  /**
   * Invalidates all dashboard caches
   */
  private async invalidateDashboardCaches(): Promise<void> {
    const pattern = AnalyticsCacheKeys.allDashboardPattern();
    await analyticsCacheService.deletePattern(pattern);
  }

  /**
   * Invalidates platform-wide caches
   */
  private async invalidatePlatformCaches(): Promise<void> {
    const patterns = [
      buildCacheKey(CachePrefix.ANALYTICS, 'platform', '*'),
      AnalyticsCacheKeys.allDashboardPattern(),
    ];

    await Promise.all(
      patterns.map(pattern => analyticsCacheService.deletePattern(pattern))
    );
  }

  /**
   * Invalidates trending data caches
   */
  private async invalidateTrendingCaches(): Promise<void> {
    const patterns = [
      AnalyticsCacheKeys.allTrendingPattern(),
      buildCacheKey(CachePrefix.ANALYTICS, 'top-performers', '*'),
    ];

    await Promise.all(
      patterns.map(pattern => analyticsCacheService.deletePattern(pattern))
    );
  }

  /**
   * Batch processes multiple cache invalidation events
   * 
   * @param events - Array of cache invalidation events
   */
  async handleBatchCacheInvalidation(events: CacheInvalidationEventData[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    console.log(`Processing batch cache invalidation for ${events.length} events`);

    // Group events by type for more efficient processing
    const eventGroups = this.groupEventsByType(events);

    // Process each group
    const promises = Object.entries(eventGroups).map(([eventType, eventList]) =>
      this.processBatchEventGroup(eventType as CacheInvalidationEvent, eventList)
    );

    await Promise.allSettled(promises);
    console.log(`Batch cache invalidation completed for ${events.length} events`);
  }

  /**
   * Groups events by type for batch processing
   */
  private groupEventsByType(events: CacheInvalidationEventData[]): Record<string, CacheInvalidationEventData[]> {
    return events.reduce((groups, event) => {
      const key = event.eventType;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
      return groups;
    }, {} as Record<string, CacheInvalidationEventData[]>);
  }

  /**
   * Processes a batch of events of the same type
   */
  private async processBatchEventGroup(
    eventType: CacheInvalidationEvent,
    events: CacheInvalidationEventData[]
  ): Promise<void> {
    try {
      // Extract unique IDs from events
      const courseIds = new Set<string>();
      const userIds = new Set<string>();

      for (const event of events) {
        if (event.courseId) courseIds.add(event.courseId);
        if (event.userId) userIds.add(event.userId);
      }

      // Invalidate caches based on event type and collected IDs
      const promises = [];

      switch (eventType) {
        case CacheInvalidationEvent.COURSE_UPDATED:
        case CacheInvalidationEvent.COURSE_PUBLISHED:
          for (const courseId of courseIds) {
            promises.push(analyticsCacheService.invalidateCourseCache(courseId));
          }
          promises.push(this.invalidatePlatformCaches());
          break;

        case CacheInvalidationEvent.STUDENT_ENROLLED:
        case CacheInvalidationEvent.ENROLLMENT_COMPLETED:
          for (const courseId of courseIds) {
            promises.push(analyticsCacheService.invalidateCourseCache(courseId));
          }
          for (const userId of userIds) {
            promises.push(analyticsCacheService.invalidateStudentCache(userId));
          }
          promises.push(this.invalidatePlatformCaches(), this.invalidateTrendingCaches());
          break;

        default:
          // For other event types, process individually
          for (const event of events) {
            promises.push(this.handleCacheInvalidation(event));
          }
      }

      await Promise.all(promises);
    } catch (error) {
      console.error(`Batch event group processing failed for ${eventType}:`, error);
    }
  }
}

/**
 * Singleton instance of the cache invalidation service
 */
export const analyticsCacheInvalidationService = new AnalyticsCacheInvalidationService();