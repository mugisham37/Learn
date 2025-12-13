/**
 * AnalyticsEvent Domain Entity
 *
 * Represents a single analytics event capturing user actions and system events
 * for tracking and analysis purposes.
 *
 * Requirements:
 * - 12.7: Analytics event logging with timestamp, user, event type, and contextual data
 */

export interface AnalyticsEventData {
  id?: string;
  userId?: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
}

export interface EventContext {
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  courseId?: string;
  lessonId?: string;
  moduleId?: string;
  enrollmentId?: string;
}

export interface LearningEventData extends EventContext {
  duration?: number;
  progress?: number;
  score?: number;
  attemptNumber?: number;
  completionStatus?: 'started' | 'in_progress' | 'completed' | 'failed';
}

export interface EngagementEventData extends EventContext {
  interactionType?: 'click' | 'scroll' | 'hover' | 'focus' | 'blur';
  elementId?: string;
  elementType?: string;
  value?: string | number;
}

export interface SystemEventData extends EventContext {
  component?: string;
  action?: string;
  result?: 'success' | 'error' | 'warning';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export type EventType =
  // Learning Events
  | 'lesson_started'
  | 'lesson_completed'
  | 'lesson_paused'
  | 'lesson_resumed'
  | 'video_watched'
  | 'quiz_started'
  | 'quiz_completed'
  | 'quiz_submitted'
  | 'assignment_started'
  | 'assignment_submitted'
  | 'course_enrolled'
  | 'course_completed'
  | 'module_completed'
  // Engagement Events
  | 'page_view'
  | 'button_click'
  | 'link_click'
  | 'search_performed'
  | 'filter_applied'
  | 'discussion_post_created'
  | 'discussion_post_replied'
  | 'message_sent'
  | 'notification_clicked'
  // System Events
  | 'user_login'
  | 'user_logout'
  | 'user_registered'
  | 'payment_completed'
  | 'error_occurred'
  | 'api_request'
  | 'cache_hit'
  | 'cache_miss';

export class AnalyticsEvent {
  private readonly _id?: string;
  private readonly _userId?: string;
  private readonly _eventType: EventType;
  private readonly _eventData: Record<string, any>;
  private readonly _timestamp: Date;

  constructor(data: AnalyticsEventData) {
    this._id = data.id;
    this._userId = data.userId;
    this._eventType = data.eventType as EventType;
    this._eventData = data.eventData;
    this._timestamp = data.timestamp;

    this.validate();
  }

  // Getters
  get id(): string | undefined {
    return this._id;
  }

  get userId(): string | undefined {
    return this._userId;
  }

  get eventType(): EventType {
    return this._eventType;
  }

  get eventData(): Record<string, any> {
    return { ...this._eventData };
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  /**
   * Check if this is a learning-related event
   */
  public isLearningEvent(): boolean {
    const learningEvents: EventType[] = [
      'lesson_started',
      'lesson_completed',
      'lesson_paused',
      'lesson_resumed',
      'video_watched',
      'quiz_started',
      'quiz_completed',
      'quiz_submitted',
      'assignment_started',
      'assignment_submitted',
      'course_enrolled',
      'course_completed',
      'module_completed',
    ];
    return learningEvents.includes(this._eventType);
  }

  /**
   * Check if this is an engagement-related event
   */
  public isEngagementEvent(): boolean {
    const engagementEvents: EventType[] = [
      'page_view',
      'button_click',
      'link_click',
      'search_performed',
      'filter_applied',
      'discussion_post_created',
      'discussion_post_replied',
      'message_sent',
      'notification_clicked',
    ];
    return engagementEvents.includes(this._eventType);
  }

  /**
   * Check if this is a system-related event
   */
  public isSystemEvent(): boolean {
    const systemEvents: EventType[] = [
      'user_login',
      'user_logout',
      'user_registered',
      'payment_completed',
      'error_occurred',
      'api_request',
      'cache_hit',
      'cache_miss',
    ];
    return systemEvents.includes(this._eventType);
  }

  /**
   * Get event category
   */
  public getCategory(): 'learning' | 'engagement' | 'system' | 'unknown' {
    if (this.isLearningEvent()) return 'learning';
    if (this.isEngagementEvent()) return 'engagement';
    if (this.isSystemEvent()) return 'system';
    return 'unknown';
  }

  /**
   * Get event severity for system events
   */
  public getSeverity(): 'info' | 'warning' | 'error' | 'critical' {
    if (this._eventType === 'error_occurred') {
      const errorLevel = this._eventData.errorLevel;
      if (errorLevel === 'critical') return 'critical';
      if (errorLevel === 'error') return 'error';
      if (errorLevel === 'warning') return 'warning';
    }
    return 'info';
  }

  /**
   * Extract course context from event data
   */
  public getCourseContext(): {
    courseId?: string;
    moduleId?: string;
    lessonId?: string;
    enrollmentId?: string;
  } {
    return {
      courseId: this._eventData.courseId,
      moduleId: this._eventData.moduleId,
      lessonId: this._eventData.lessonId,
      enrollmentId: this._eventData.enrollmentId,
    };
  }

  /**
   * Extract session context from event data
   */
  public getSessionContext(): {
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
  } {
    return {
      sessionId: this._eventData.sessionId,
      userAgent: this._eventData.userAgent,
      ipAddress: this._eventData.ipAddress,
      referrer: this._eventData.referrer,
    };
  }

  /**
   * Get duration if available (for time-based events)
   */
  public getDuration(): number | undefined {
    return this._eventData.duration;
  }

  /**
   * Get progress if available (for progress-based events)
   */
  public getProgress(): number | undefined {
    return this._eventData.progress;
  }

  /**
   * Get score if available (for assessment events)
   */
  public getScore(): number | undefined {
    return this._eventData.score;
  }

  /**
   * Check if event indicates completion
   */
  public isCompletionEvent(): boolean {
    const completionEvents: EventType[] = [
      'lesson_completed',
      'quiz_completed',
      'assignment_submitted',
      'course_completed',
      'module_completed',
    ];
    return completionEvents.includes(this._eventType);
  }

  /**
   * Check if event indicates start of activity
   */
  public isStartEvent(): boolean {
    const startEvents: EventType[] = [
      'lesson_started',
      'quiz_started',
      'assignment_started',
      'course_enrolled',
    ];
    return startEvents.includes(this._eventType);
  }

  /**
   * Get event age in minutes
   */
  public getAgeInMinutes(): number {
    const now = new Date();
    const diffMs = now.getTime() - this._timestamp.getTime();
    return Math.floor(diffMs / (1000 * 60));
  }

  /**
   * Check if event is recent (within last hour)
   */
  public isRecent(): boolean {
    return this.getAgeInMinutes() <= 60;
  }

  /**
   * Create a sanitized version for logging (removes sensitive data)
   */
  public toSanitizedData(): AnalyticsEventData {
    const sanitizedEventData = { ...this._eventData };

    // Remove sensitive fields
    delete sanitizedEventData.password;
    delete sanitizedEventData.token;
    delete sanitizedEventData.apiKey;
    delete sanitizedEventData.creditCard;
    delete sanitizedEventData.ssn;
    delete sanitizedEventData.personalInfo;

    // Mask IP address (keep first 3 octets)
    if (sanitizedEventData.ipAddress) {
      const parts = sanitizedEventData.ipAddress.split('.');
      if (parts.length === 4) {
        sanitizedEventData.ipAddress = `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }

    return {
      id: this._id,
      userId: this._userId,
      eventType: this._eventType,
      eventData: sanitizedEventData,
      timestamp: this._timestamp,
    };
  }

  /**
   * Convert to plain object for persistence
   */
  public toData(): AnalyticsEventData {
    return {
      id: this._id,
      userId: this._userId,
      eventType: this._eventType,
      eventData: this._eventData,
      timestamp: this._timestamp,
    };
  }

  /**
   * Create a learning event
   */
  public static createLearningEvent(
    userId: string,
    eventType: EventType,
    data: LearningEventData
  ): AnalyticsEvent {
    return new AnalyticsEvent({
      userId,
      eventType,
      eventData: data,
      timestamp: new Date(),
    });
  }

  /**
   * Create an engagement event
   */
  public static createEngagementEvent(
    userId: string | undefined,
    eventType: EventType,
    data: EngagementEventData
  ): AnalyticsEvent {
    return new AnalyticsEvent({
      userId,
      eventType,
      eventData: data,
      timestamp: new Date(),
    });
  }

  /**
   * Create a system event
   */
  public static createSystemEvent(
    eventType: EventType,
    data: SystemEventData,
    userId?: string
  ): AnalyticsEvent {
    return new AnalyticsEvent({
      userId,
      eventType,
      eventData: data,
      timestamp: new Date(),
    });
  }

  private validate(): void {
    if (!this._eventType) {
      throw new Error('AnalyticsEvent: eventType is required');
    }

    if (!this._eventData) {
      throw new Error('AnalyticsEvent: eventData is required');
    }

    if (!this._timestamp) {
      throw new Error('AnalyticsEvent: timestamp is required');
    }

    if (this._timestamp > new Date()) {
      throw new Error('AnalyticsEvent: timestamp cannot be in the future');
    }

    // Validate event type is supported
    const validEventTypes: EventType[] = [
      'lesson_started',
      'lesson_completed',
      'lesson_paused',
      'lesson_resumed',
      'video_watched',
      'quiz_started',
      'quiz_completed',
      'quiz_submitted',
      'assignment_started',
      'assignment_submitted',
      'course_enrolled',
      'course_completed',
      'module_completed',
      'page_view',
      'button_click',
      'link_click',
      'search_performed',
      'filter_applied',
      'discussion_post_created',
      'discussion_post_replied',
      'message_sent',
      'notification_clicked',
      'user_login',
      'user_logout',
      'user_registered',
      'payment_completed',
      'error_occurred',
      'api_request',
      'cache_hit',
      'cache_miss',
    ];

    if (!validEventTypes.includes(this._eventType)) {
      throw new Error(`AnalyticsEvent: unsupported eventType: ${this._eventType}`);
    }

    // Validate required fields for specific event types
    if (this.isLearningEvent() && !this._userId) {
      throw new Error('AnalyticsEvent: userId is required for learning events');
    }

    // Validate numeric fields
    if (this._eventData.duration !== undefined && this._eventData.duration < 0) {
      throw new Error('AnalyticsEvent: duration cannot be negative');
    }

    if (
      this._eventData.progress !== undefined &&
      (this._eventData.progress < 0 || this._eventData.progress > 100)
    ) {
      throw new Error('AnalyticsEvent: progress must be between 0 and 100');
    }

    if (this._eventData.score !== undefined && this._eventData.score < 0) {
      throw new Error('AnalyticsEvent: score cannot be negative');
    }
  }
}
