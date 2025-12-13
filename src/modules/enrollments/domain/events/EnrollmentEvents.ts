/**
 * Domain Events for Enrollment Lifecycle
 *
 * These events are published when significant enrollment-related actions occur
 * Requirements: 5.1, 5.4, 5.5, 5.6
 */

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export class EnrollmentCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'EnrollmentCreated';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      studentId: string;
      courseId: string;
      enrolledAt: Date;
      paymentId?: string;
    }
  ) {
    this.eventId = `enrollment-created-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.occurredAt = new Date();
  }
}

export class LessonProgressUpdatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'LessonProgressUpdated';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      enrollmentId: string;
      lessonId: string;
      previousStatus: string;
      newStatus: string;
      timeSpentSeconds: number;
      completedAt?: Date;
    }
  ) {
    this.eventId = `lesson-progress-updated-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.occurredAt = new Date();
  }
}

export class CourseProgressUpdatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'CourseProgressUpdated';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      studentId: string;
      courseId: string;
      previousProgressPercentage: number;
      newProgressPercentage: number;
      completedLessons: number;
      totalLessons: number;
    }
  ) {
    this.eventId = `course-progress-updated-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.occurredAt = new Date();
  }
}

export class CourseCompletedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'CourseCompleted';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      studentId: string;
      courseId: string;
      completedAt: Date;
      finalProgressPercentage: number;
      timeToCompletionDays: number;
    }
  ) {
    this.eventId = `course-completed-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.occurredAt = new Date();
  }
}

export class CertificateGeneratedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'CertificateGenerated';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      enrollmentId: string;
      certificateId: string;
      studentId: string;
      courseId: string;
      issuedAt: Date;
      verificationUrl: string;
    }
  ) {
    this.eventId = `certificate-generated-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.occurredAt = new Date();
  }
}

export class EnrollmentWithdrawnEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType = 'EnrollmentWithdrawn';
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      studentId: string;
      courseId: string;
      withdrawnAt: Date;
      reason?: string;
      progressAtWithdrawal: number;
    }
  ) {
    this.eventId = `enrollment-withdrawn-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.occurredAt = new Date();
  }
}
