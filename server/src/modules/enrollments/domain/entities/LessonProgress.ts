/**
 * LessonProgress Domain Entity
 *
 * Represents the progress of a student on a specific lesson within an enrollment.
 * Tracks completion status, time spent, quiz scores, and attempts.
 *
 * Requirements: 5.3, 5.4, 5.5
 */

import { LessonProgressUpdatedEvent } from '../events/EnrollmentEvents';
import { DomainEventList } from '../types/DomainEvent.js';

export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface LessonProgressProps {
  id: string;
  enrollmentId: string;
  lessonId: string;
  status: ProgressStatus;
  timeSpentSeconds: number;
  completedAt?: Date;
  quizScore?: number;
  attemptsCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class LessonProgress {
  private _props: LessonProgressProps;
  private _domainEvents: DomainEventList = [];

  constructor(props: LessonProgressProps) {
    this.validateProps(props);
    this._props = { ...props };
  }

  // Getters
  get id(): string {
    return this._props.id;
  }
  get enrollmentId(): string {
    return this._props.enrollmentId;
  }
  get lessonId(): string {
    return this._props.lessonId;
  }
  get status(): ProgressStatus {
    return this._props.status;
  }
  get timeSpentSeconds(): number {
    return this._props.timeSpentSeconds;
  }
  get completedAt(): Date | undefined {
    return this._props.completedAt;
  }
  get quizScore(): number | undefined {
    return this._props.quizScore;
  }
  get attemptsCount(): number {
    return this._props.attemptsCount;
  }
  get lastAccessedAt(): Date | undefined {
    return this._props.lastAccessedAt;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get updatedAt(): Date {
    return this._props.updatedAt;
  }
  get domainEvents(): DomainEventList {
    return [...this._domainEvents];
  }

  // Static factory method for creating new lesson progress
  static create(
    props: Omit<LessonProgressProps, 'id' | 'createdAt' | 'updatedAt'>
  ): LessonProgress {
    const now = new Date();
    const progressProps: LessonProgressProps = {
      ...props,
      id: `lesson-progress-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      createdAt: now,
      updatedAt: now,
    };

    return new LessonProgress(progressProps);
  }

  // Static factory method for creating from database record
  static fromDatabase(props: LessonProgressProps): LessonProgress {
    return new LessonProgress(props);
  }

  /**
   * Start lesson progress
   * Transitions from not_started to in_progress
   */
  startLesson(): void {
    if (this._props.status !== 'not_started') {
      throw new Error('Lesson can only be started from not_started status');
    }

    const previousStatus = this._props.status;
    this._props.status = 'in_progress';
    this._props.lastAccessedAt = new Date();
    this._props.updatedAt = new Date();

    this.addDomainEvent(
      new LessonProgressUpdatedEvent(this.id, {
        enrollmentId: this.enrollmentId,
        lessonId: this.lessonId,
        previousStatus,
        newStatus: this._props.status,
        timeSpentSeconds: this._props.timeSpentSeconds,
      })
    );
  }

  /**
   * Update time spent on lesson
   * Adds additional time to the total time spent
   */
  addTimeSpent(additionalSeconds: number): void {
    if (additionalSeconds < 0) {
      throw new Error('Additional time cannot be negative');
    }

    if (this._props.status === 'not_started') {
      this.startLesson();
    }

    const previousStatus = this._props.status;
    this._props.timeSpentSeconds += additionalSeconds;
    this._props.lastAccessedAt = new Date();
    this._props.updatedAt = new Date();

    this.addDomainEvent(
      new LessonProgressUpdatedEvent(this.id, {
        enrollmentId: this.enrollmentId,
        lessonId: this.lessonId,
        previousStatus,
        newStatus: this._props.status,
        timeSpentSeconds: this._props.timeSpentSeconds,
      })
    );
  }

  /**
   * Complete the lesson
   * Transitions to completed status and sets completion timestamp
   */
  completeLesson(): void {
    if (this._props.status === 'completed') {
      return; // Already completed, no-op
    }

    const previousStatus = this._props.status;
    this._props.status = 'completed';
    this._props.completedAt = new Date();
    this._props.lastAccessedAt = new Date();
    this._props.updatedAt = new Date();

    this.addDomainEvent(
      new LessonProgressUpdatedEvent(this.id, {
        enrollmentId: this.enrollmentId,
        lessonId: this.lessonId,
        previousStatus,
        newStatus: this._props.status,
        timeSpentSeconds: this._props.timeSpentSeconds,
        completedAt: this._props.completedAt,
      })
    );
  }

  /**
   * Record quiz score for this lesson
   * Increments attempt count and updates score
   */
  recordQuizScore(score: number): void {
    if (score < 0 || score > 100) {
      throw new Error('Quiz score must be between 0 and 100');
    }

    const previousStatus = this._props.status;
    this._props.quizScore = score;
    this._props.attemptsCount += 1;
    this._props.lastAccessedAt = new Date();
    this._props.updatedAt = new Date();

    // If lesson wasn't started, start it
    if (this._props.status === 'not_started') {
      this._props.status = 'in_progress';
    }

    this.addDomainEvent(
      new LessonProgressUpdatedEvent(this.id, {
        enrollmentId: this.enrollmentId,
        lessonId: this.lessonId,
        previousStatus,
        newStatus: this._props.status,
        timeSpentSeconds: this._props.timeSpentSeconds,
      })
    );
  }

  /**
   * Reset progress to not started
   * Used for retaking lessons or resetting progress
   */
  resetProgress(): void {
    const previousStatus = this._props.status;
    this._props.status = 'not_started';
    this._props.timeSpentSeconds = 0;
    this._props.completedAt = undefined;
    this._props.quizScore = undefined;
    this._props.attemptsCount = 0;
    this._props.lastAccessedAt = undefined;
    this._props.updatedAt = new Date();

    this.addDomainEvent(
      new LessonProgressUpdatedEvent(this.id, {
        enrollmentId: this.enrollmentId,
        lessonId: this.lessonId,
        previousStatus,
        newStatus: this._props.status,
        timeSpentSeconds: this._props.timeSpentSeconds,
      })
    );
  }

  /**
   * Check if lesson is completed
   */
  isCompleted(): boolean {
    return this._props.status === 'completed';
  }

  /**
   * Check if lesson is in progress
   */
  isInProgress(): boolean {
    return this._props.status === 'in_progress';
  }

  /**
   * Check if lesson is not started
   */
  isNotStarted(): boolean {
    return this._props.status === 'not_started';
  }

  /**
   * Get progress percentage (0-100)
   * Based on completion status
   */
  getProgressPercentage(): number {
    switch (this._props.status) {
      case 'not_started':
        return 0;
      case 'in_progress':
        return 50; // Arbitrary value for in-progress
      case 'completed':
        return 100;
      default:
        return 0;
    }
  }

  // Clear domain events
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  // Convert to database format
  toDatabase(): Omit<LessonProgressProps, 'id'> {
    return {
      enrollmentId: this._props.enrollmentId,
      lessonId: this._props.lessonId,
      status: this._props.status,
      timeSpentSeconds: this._props.timeSpentSeconds,
      completedAt: this._props.completedAt,
      quizScore: this._props.quizScore,
      attemptsCount: this._props.attemptsCount,
      lastAccessedAt: this._props.lastAccessedAt,
      createdAt: this._props.createdAt,
      updatedAt: this._props.updatedAt,
    };
  }

  private validateProps(props: LessonProgressProps): void {
    if (!props.enrollmentId?.trim()) {
      throw new Error('Enrollment ID is required');
    }
    if (!props.lessonId?.trim()) {
      throw new Error('Lesson ID is required');
    }
    if (props.timeSpentSeconds < 0) {
      throw new Error('Time spent cannot be negative');
    }
    if (props.attemptsCount < 0) {
      throw new Error('Attempts count cannot be negative');
    }
    if (props.quizScore !== undefined && (props.quizScore < 0 || props.quizScore > 100)) {
      throw new Error('Quiz score must be between 0 and 100');
    }
    if (!['not_started', 'in_progress', 'completed'].includes(props.status)) {
      throw new Error('Invalid progress status');
    }
  }

  private addDomainEvent(event: LessonProgressUpdatedEvent): void {
    this._domainEvents.push(event);
  }
}
