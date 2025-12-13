/**
 * Enrollment Domain Entity
 *
 * Represents the relationship between a student and a course.
 * Manages enrollment status, progress tracking, and completion detection.
 *
 * Requirements: 5.1, 5.4, 5.5, 5.6
 */

import { LessonProgress } from './LessonProgress';
import { Certificate } from './Certificate';
import {
  EnrollmentCreatedEvent,
  CourseProgressUpdatedEvent,
  CourseCompletedEvent,
  EnrollmentWithdrawnEvent,
} from '../events/EnrollmentEvents';

export type EnrollmentStatus = 'active' | 'completed' | 'dropped';

export interface EnrollmentProps {
  id: string;
  studentId: string;
  courseId: string;
  enrolledAt: Date;
  completedAt?: Date;
  progressPercentage: number;
  lastAccessedAt?: Date;
  paymentId?: string;
  certificateId?: string;
  status: EnrollmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Enrollment {
  private _props: EnrollmentProps;
  private _lessonProgress: LessonProgress[] = [];
  private _certificate?: Certificate;
  private _domainEvents: any[] = [];

  constructor(props: EnrollmentProps) {
    this.validateProps(props);
    this._props = { ...props };
  }

  // Getters
  get id(): string {
    return this._props.id;
  }
  get studentId(): string {
    return this._props.studentId;
  }
  get courseId(): string {
    return this._props.courseId;
  }
  get enrolledAt(): Date {
    return this._props.enrolledAt;
  }
  get completedAt(): Date | undefined {
    return this._props.completedAt;
  }
  get progressPercentage(): number {
    return this._props.progressPercentage;
  }
  get lastAccessedAt(): Date | undefined {
    return this._props.lastAccessedAt;
  }
  get paymentId(): string | undefined {
    return this._props.paymentId;
  }
  get certificateId(): string | undefined {
    return this._props.certificateId;
  }
  get status(): EnrollmentStatus {
    return this._props.status;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get updatedAt(): Date {
    return this._props.updatedAt;
  }
  get lessonProgress(): LessonProgress[] {
    return [...this._lessonProgress];
  }
  get certificate(): Certificate | undefined {
    return this._certificate;
  }
  get domainEvents(): any[] {
    return [...this._domainEvents];
  }

  // Static factory method for creating new enrollment
  static create(props: { studentId: string; courseId: string; paymentId?: string }): Enrollment {
    const now = new Date();
    const enrollmentProps: EnrollmentProps = {
      id: `enrollment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      studentId: props.studentId,
      courseId: props.courseId,
      enrolledAt: now,
      progressPercentage: 0,
      paymentId: props.paymentId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const enrollment = new Enrollment(enrollmentProps);

    enrollment.addDomainEvent(
      new EnrollmentCreatedEvent(enrollment.id, {
        studentId: props.studentId,
        courseId: props.courseId,
        enrolledAt: now,
        paymentId: props.paymentId,
      })
    );

    return enrollment;
  }

  // Static factory method for creating from database record
  static fromDatabase(props: EnrollmentProps): Enrollment {
    return new Enrollment(props);
  }

  /**
   * Initialize lesson progress records for all lessons in the course
   * Called after enrollment creation
   */
  initializeLessonProgress(lessonIds: string[]): void {
    if (this._lessonProgress.length > 0) {
      throw new Error('Lesson progress already initialized');
    }

    this._lessonProgress = lessonIds.map((lessonId) =>
      LessonProgress.create({
        enrollmentId: this.id,
        lessonId,
        status: 'not_started',
        timeSpentSeconds: 0,
        attemptsCount: 0,
      })
    );

    this._props.updatedAt = new Date();
  }

  /**
   * Add lesson progress records (for loading from database)
   */
  addLessonProgress(progress: LessonProgress[]): void {
    this._lessonProgress = [...progress];
  }

  /**
   * Update progress for a specific lesson
   */
  updateLessonProgress(lessonId: string, updateFn: (progress: LessonProgress) => void): void {
    const progress = this._lessonProgress.find((p) => p.lessonId === lessonId);
    if (!progress) {
      throw new Error(`Lesson progress not found for lesson ${lessonId}`);
    }

    updateFn(progress);

    // Recalculate overall progress
    this.recalculateProgress();

    // Check for course completion
    if (this.isAllLessonsCompleted() && this._props.status === 'active') {
      this.completeCourse();
    }

    this._props.lastAccessedAt = new Date();
    this._props.updatedAt = new Date();
  }

  /**
   * Calculate and update overall course progress percentage
   * Requirements: 5.4 - Progress percentage calculation
   */
  recalculateProgress(): void {
    if (this._lessonProgress.length === 0) {
      this._props.progressPercentage = 0;
      return;
    }

    const completedLessons = this._lessonProgress.filter((p) => p.isCompleted()).length;
    const totalLessons = this._lessonProgress.length;
    const previousProgress = this._props.progressPercentage;

    this._props.progressPercentage = Math.round((completedLessons / totalLessons) * 100);

    // Emit progress update event if progress changed
    if (previousProgress !== this._props.progressPercentage) {
      this.addDomainEvent(
        new CourseProgressUpdatedEvent(this.id, {
          studentId: this.studentId,
          courseId: this.courseId,
          previousProgressPercentage: previousProgress,
          newProgressPercentage: this._props.progressPercentage,
          completedLessons,
          totalLessons,
        })
      );
    }
  }

  /**
   * Check if all lessons are completed
   * Requirements: 5.5 - Module completion detection
   */
  isAllLessonsCompleted(): boolean {
    if (this._lessonProgress.length === 0) {
      return false;
    }
    return this._lessonProgress.every((p) => p.isCompleted());
  }

  /**
   * Complete the course
   * Requirements: 5.6 - Certificate generation on completion
   */
  completeCourse(): void {
    if (this._props.status === 'completed') {
      return; // Already completed
    }

    if (!this.isAllLessonsCompleted()) {
      throw new Error('Cannot complete course: not all lessons are completed');
    }

    const now = new Date();
    this._props.status = 'completed';
    this._props.completedAt = now;
    this._props.progressPercentage = 100;
    this._props.updatedAt = now;

    const timeToCompletionDays = Math.ceil(
      (now.getTime() - this._props.enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    this.addDomainEvent(
      new CourseCompletedEvent(this.id, {
        studentId: this.studentId,
        courseId: this.courseId,
        completedAt: now,
        finalProgressPercentage: this._props.progressPercentage,
        timeToCompletionDays,
      })
    );
  }

  /**
   * Generate certificate for completed course
   * Requirements: 5.6 - Certificate generation
   */
  generateCertificate(certificateData: {
    studentName: string;
    courseTitle: string;
    instructorName: string;
    grade?: string;
    creditsEarned?: number;
  }): Certificate {
    if (this._props.status !== 'completed') {
      throw new Error('Cannot generate certificate: course not completed');
    }

    if (this._certificate) {
      throw new Error('Certificate already generated for this enrollment');
    }

    this._certificate = Certificate.create({
      enrollmentId: this.id,
      studentId: this.studentId,
      courseId: this.courseId,
      studentName: certificateData.studentName,
      courseTitle: certificateData.courseTitle,
      instructorName: certificateData.instructorName,
      completionDate: this._props.completedAt!,
      grade: certificateData.grade,
      creditsEarned: certificateData.creditsEarned,
    });

    this._props.certificateId = this._certificate.id;
    this._props.updatedAt = new Date();

    return this._certificate;
  }

  /**
   * Attach existing certificate (for loading from database)
   */
  attachCertificate(certificate: Certificate): void {
    this._certificate = certificate;
    this._props.certificateId = certificate.id;
  }

  /**
   * Withdraw from course
   */
  withdraw(reason?: string): void {
    if (this._props.status === 'dropped') {
      return; // Already withdrawn
    }

    if (this._props.status === 'completed') {
      throw new Error('Cannot withdraw from completed course');
    }

    const now = new Date();
    this._props.status = 'dropped';
    this._props.updatedAt = now;

    this.addDomainEvent(
      new EnrollmentWithdrawnEvent(this.id, {
        studentId: this.studentId,
        courseId: this.courseId,
        withdrawnAt: now,
        reason,
        progressAtWithdrawal: this._props.progressPercentage,
      })
    );
  }

  /**
   * Get completed lessons count
   */
  getCompletedLessonsCount(): number {
    return this._lessonProgress.filter((p) => p.isCompleted()).length;
  }

  /**
   * Get total lessons count
   */
  getTotalLessonsCount(): number {
    return this._lessonProgress.length;
  }

  /**
   * Get total time spent across all lessons (in seconds)
   */
  getTotalTimeSpentSeconds(): number {
    return this._lessonProgress.reduce((total, p) => total + p.timeSpentSeconds, 0);
  }

  /**
   * Get average quiz score across all lessons with quizzes
   */
  getAverageQuizScore(): number | undefined {
    const scoresWithQuizzes = this._lessonProgress
      .filter((p) => p.quizScore !== undefined)
      .map((p) => p.quizScore!);

    if (scoresWithQuizzes.length === 0) {
      return undefined;
    }

    return scoresWithQuizzes.reduce((sum, score) => sum + score, 0) / scoresWithQuizzes.length;
  }

  /**
   * Get lessons that are in progress but not completed
   */
  getInProgressLessons(): LessonProgress[] {
    return this._lessonProgress.filter((p) => p.isInProgress());
  }

  /**
   * Get next lesson to complete (first not completed lesson)
   */
  getNextLesson(): LessonProgress | undefined {
    return this._lessonProgress.find((p) => !p.isCompleted());
  }

  /**
   * Check if enrollment is active
   */
  isActive(): boolean {
    return this._props.status === 'active';
  }

  /**
   * Check if enrollment is completed
   */
  isCompleted(): boolean {
    return this._props.status === 'completed';
  }

  /**
   * Check if enrollment is dropped/withdrawn
   */
  isDropped(): boolean {
    return this._props.status === 'dropped';
  }

  /**
   * Check if certificate is available
   */
  hasCertificate(): boolean {
    return !!this._certificate;
  }

  // Clear domain events
  clearDomainEvents(): void {
    this._domainEvents = [];
    this._lessonProgress.forEach((p) => p.clearDomainEvents());
    this._certificate?.clearDomainEvents();
  }

  // Convert to database format
  toDatabase(): Omit<EnrollmentProps, 'id'> {
    return {
      studentId: this._props.studentId,
      courseId: this._props.courseId,
      enrolledAt: this._props.enrolledAt,
      completedAt: this._props.completedAt,
      progressPercentage: this._props.progressPercentage,
      lastAccessedAt: this._props.lastAccessedAt,
      paymentId: this._props.paymentId,
      certificateId: this._props.certificateId,
      status: this._props.status,
      createdAt: this._props.createdAt,
      updatedAt: this._props.updatedAt,
    };
  }

  private validateProps(props: EnrollmentProps): void {
    if (!props.studentId?.trim()) {
      throw new Error('Student ID is required');
    }
    if (!props.courseId?.trim()) {
      throw new Error('Course ID is required');
    }
    if (props.progressPercentage < 0 || props.progressPercentage > 100) {
      throw new Error('Progress percentage must be between 0 and 100');
    }
    if (!['active', 'completed', 'dropped'].includes(props.status)) {
      throw new Error('Invalid enrollment status');
    }
    if (!props.enrolledAt) {
      throw new Error('Enrolled date is required');
    }
    if (props.completedAt && props.completedAt < props.enrolledAt) {
      throw new Error('Completion date cannot be before enrollment date');
    }
  }

  private addDomainEvent(event: any): void {
    this._domainEvents.push(event);
  }
}
