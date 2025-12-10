/**
 * Enrollment Service Interface
 * 
 * Defines the contract for enrollment business operations.
 * Handles student enrollment, progress tracking, and course completion.
 * 
 * Requirements: 5.1, 5.3, 5.4, 5.5, 5.7
 */

import { Certificate } from '../../domain/entities/Certificate.js';
import { Enrollment } from '../../domain/entities/Enrollment.js';
import { LessonProgress } from '../../domain/entities/LessonProgress.js';

/**
 * Data Transfer Object for enrollment creation
 */
export interface EnrollStudentDTO {
  studentId: string;
  courseId: string;
  paymentInfo?: {
    paymentId: string;
    amount: number;
    currency: string;
  };
}

/**
 * Data Transfer Object for lesson progress updates
 */
export interface UpdateLessonProgressRequestDTO {
  enrollmentId: string;
  lessonId: string;
  progressUpdate: {
    status?: 'not_started' | 'in_progress' | 'completed';
    timeSpentSeconds?: number;
    quizScore?: number;
    attemptsCount?: number;
  };
}

/**
 * Data Transfer Object for course completion
 */
export interface CompleteCourseDTO {
  enrollmentId: string;
  certificateData: {
    studentName: string;
    courseTitle: string;
    instructorName: string;
    grade?: string;
    creditsEarned?: number;
  };
}

/**
 * Data Transfer Object for enrollment withdrawal
 */
export interface WithdrawEnrollmentDTO {
  enrollmentId: string;
  reason?: string;
}

/**
 * Progress summary for an enrollment
 */
export interface EnrollmentProgressSummary {
  enrollment: Enrollment;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  notStartedLessons: number;
  progressPercentage: number;
  totalTimeSpentSeconds: number;
  averageQuizScore?: number;
  nextRecommendedLesson?: {
    lessonId: string;
    lessonTitle: string;
    moduleTitle: string;
  };
  strugglingAreas: string[];
  estimatedTimeRemaining?: number;
}

/**
 * Payment information for enrollment
 */
export interface PaymentInfo {
  paymentId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
}

/**
 * Enrollment Service Interface
 * 
 * Provides methods for all enrollment business operations.
 * Orchestrates between domain entities and infrastructure services.
 */
export interface IEnrollmentService {
  /**
   * Enrolls a student in a course
   * 
   * Requirements: 5.1 - Student enrollment with duplicate check and limit validation
   * 
   * @param data - Enrollment data
   * @returns The created enrollment with initialized progress
   * @throws ConflictError if student is already enrolled
   * @throws ValidationError if enrollment limit is exceeded
   * @throws NotFoundError if student or course doesn't exist
   * @throws PaymentError if payment processing fails
   */
  enrollStudent(data: EnrollStudentDTO): Promise<Enrollment>;

  /**
   * Updates lesson progress for a student
   * 
   * Requirements: 5.3, 5.4 - Progress tracking and calculation
   * 
   * @param data - Progress update data
   * @returns The updated lesson progress
   * @throws NotFoundError if enrollment or lesson doesn't exist
   * @throws ValidationError if progress update is invalid
   * @throws AuthorizationError if student doesn't own the enrollment
   */
  updateLessonProgress(data: UpdateLessonProgressRequestDTO): Promise<LessonProgress>;

  /**
   * Completes a course and generates certificate
   * 
   * Requirements: 5.5, 5.6 - Course completion and certificate generation
   * 
   * @param data - Course completion data
   * @returns The generated certificate
   * @throws NotFoundError if enrollment doesn't exist
   * @throws ValidationError if course is not eligible for completion
   * @throws ConflictError if course is already completed
   */
  completeCourse(data: CompleteCourseDTO): Promise<Certificate>;

  /**
   * Withdraws a student from a course
   * 
   * Requirements: 5.7 - Enrollment withdrawal
   * 
   * @param data - Withdrawal data
   * @returns void
   * @throws NotFoundError if enrollment doesn't exist
   * @throws ValidationError if enrollment cannot be withdrawn
   * @throws AuthorizationError if student doesn't own the enrollment
   */
  withdrawEnrollment(data: WithdrawEnrollmentDTO): Promise<void>;

  /**
   * Gets comprehensive progress summary for an enrollment
   * 
   * Requirements: 5.4 - Progress tracking and reporting
   * 
   * @param enrollmentId - Enrollment ID
   * @returns Detailed progress summary
   * @throws NotFoundError if enrollment doesn't exist
   */
  getEnrollmentProgress(enrollmentId: string): Promise<EnrollmentProgressSummary>;

  /**
   * Initializes lesson progress records for all lessons in a course
   * Called internally after enrollment creation
   * 
   * Requirements: 5.3 - Progress record initialization
   * 
   * @param enrollmentId - Enrollment ID
   * @param courseId - Course ID
   * @returns Array of created lesson progress records
   * @throws NotFoundError if enrollment or course doesn't exist
   */
  initializeLessonProgress(enrollmentId: string, courseId: string): Promise<LessonProgress[]>;

  /**
   * Checks if a student can enroll in a course
   * Validates enrollment limits, prerequisites, and payment requirements
   * 
   * @param studentId - Student ID
   * @param courseId - Course ID
   * @returns Enrollment eligibility result
   */
  checkEnrollmentEligibility(studentId: string, courseId: string): Promise<{
    eligible: boolean;
    reasons: string[];
    requiresPayment: boolean;
    paymentAmount?: number;
    enrollmentLimit?: number;
    currentEnrollments?: number;
  }>;

  /**
   * Gets all enrollments for a student
   * 
   * @param studentId - Student ID
   * @param filters - Optional filters
   * @returns Array of enrollments
   */
  getStudentEnrollments(
    studentId: string,
    filters?: {
      status?: 'active' | 'completed' | 'dropped';
      courseId?: string;
    }
  ): Promise<Enrollment[]>;

  /**
   * Gets all enrollments for a course
   * 
   * @param courseId - Course ID
   * @param filters - Optional filters
   * @returns Array of enrollments
   */
  getCourseEnrollments(
    courseId: string,
    filters?: {
      status?: 'active' | 'completed' | 'dropped';
      studentId?: string;
    }
  ): Promise<Enrollment[]>;

  /**
   * Processes enrollment completion for eligible enrollments
   * Background job to check and complete courses automatically
   * 
   * @param limit - Maximum number of enrollments to process
   * @returns Number of enrollments processed
   */
  processEligibleCompletions(limit?: number): Promise<number>;

  /**
   * Calculates estimated time remaining for course completion
   * 
   * @param enrollmentId - Enrollment ID
   * @returns Estimated time in minutes
   */
  calculateEstimatedTimeRemaining(enrollmentId: string): Promise<number>;

  /**
   * Identifies struggling areas for a student based on progress patterns
   * 
   * @param enrollmentId - Enrollment ID
   * @returns Array of struggling area descriptions
   */
  identifyStrugglingAreas(enrollmentId: string): Promise<string[]>;

  /**
   * Checks if a lesson can be accessed based on prerequisites
   * 
   * Requirements: 5.8 - Prerequisite enforcement for lesson access
   * 
   * @param enrollmentId - Enrollment ID
   * @param lessonId - Lesson ID to check access for
   * @returns Access result with eligibility and reasons
   * @throws NotFoundError if enrollment or lesson doesn't exist
   */
  checkLessonAccess(enrollmentId: string, lessonId: string): Promise<{
    canAccess: boolean;
    reasons: string[];
    prerequisiteModules?: {
      moduleId: string;
      moduleTitle: string;
      isCompleted: boolean;
    }[];
  }>;
}