/**
 * Assignment Service Interface
 *
 * Defines the contract for assignment business operations in the application layer.
 * Orchestrates domain entities and infrastructure repositories to implement
 * assignment management use cases including creation, submission, grading, and revision workflows.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import { Assignment } from '../../domain/entities/Assignment.js';
import { AssignmentSubmission } from '../../domain/entities/AssignmentSubmission.js';

/**
 * Data Transfer Object for creating a new assignment
 */
export interface CreateAssignmentDTO {
  lessonId: string;
  title: string;
  description?: string;
  instructions: string;
  dueDate: Date;
  lateSubmissionAllowed?: boolean;
  latePenaltyPercentage?: number;
  maxPoints: number;
  requiresFileUpload?: boolean;
  allowedFileTypes: string[];
  maxFileSizeMb?: number;
  rubric?: Record<string, any>;
}

/**
 * Data Transfer Object for submitting an assignment
 */
export interface SubmitAssignmentDTO {
  assignmentId: string;
  studentId: string;
  enrollmentId: string;
  file?: {
    buffer: Buffer;
    fileName: string;
    contentType: string;
  };
  submissionText?: string;
  parentSubmissionId?: string; // For revisions
}

/**
 * Data Transfer Object for grading an assignment
 */
export interface GradeAssignmentDTO {
  submissionId: string;
  gradedBy: string;
  pointsAwarded: number;
  feedback?: string;
  rubricScores?: Record<string, number>;
}

/**
 * Data Transfer Object for requesting revision
 */
export interface RequestRevisionDTO {
  submissionId: string;
  gradedBy: string;
  feedback: string;
}

/**
 * Assignment submission result with file upload details
 */
export interface AssignmentSubmissionResult {
  submission: AssignmentSubmission;
  fileUploadUrl?: string;
}

/**
 * Assignment submission summary for a student
 */
export interface StudentAssignmentSummary {
  assignmentId: string;
  studentId: string;
  totalSubmissions: number;
  latestSubmission?: AssignmentSubmission;
  bestScore?: number;
  hasRevisionRequested: boolean;
  canSubmit: boolean;
}

/**
 * Assignment Service Interface
 *
 * Provides methods for all assignment business operations including creation,
 * submission handling, grading workflows, and revision management.
 */
export interface IAssignmentService {
  /**
   * Creates a new assignment with validation
   *
   * @param educatorId - ID of the educator creating the assignment
   * @param data - Assignment creation data
   * @returns The created assignment
   * @throws ValidationError if lesson doesn't exist or data is invalid
   * @throws AuthorizationError if educator doesn't own the lesson
   * @throws DatabaseError if database operation fails
   */
  createAssignment(educatorId: string, data: CreateAssignmentDTO): Promise<Assignment>;

  /**
   * Submits an assignment with file validation and S3 upload
   *
   * @param data - Assignment submission data
   * @returns Submission result with upload details
   * @throws ValidationError if assignment, student, or enrollment doesn't exist
   * @throws ConflictError if assignment no longer accepts submissions
   * @throws ExternalServiceError if file upload fails
   * @throws DatabaseError if database operation fails
   */
  submitAssignment(data: SubmitAssignmentDTO): Promise<AssignmentSubmissionResult>;

  /**
   * Grades an assignment submission with rubric support
   *
   * @param data - Grading data
   * @returns Updated submission with grades and feedback
   * @throws ValidationError if submission doesn't exist
   * @throws AuthorizationError if grader doesn't have permission
   * @throws ConflictError if submission not in gradable state
   * @throws DatabaseError if database operation fails
   */
  gradeAssignment(data: GradeAssignmentDTO): Promise<AssignmentSubmission>;

  /**
   * Requests revision for an assignment submission
   *
   * @param data - Revision request data
   * @returns Updated submission with revision request
   * @throws ValidationError if submission doesn't exist
   * @throws AuthorizationError if requester doesn't have permission
   * @throws ConflictError if submission not in revisable state
   * @throws DatabaseError if database operation fails
   */
  requestRevision(data: RequestRevisionDTO): Promise<AssignmentSubmission>;

  /**
   * Gets assignment by ID with authorization check
   *
   * @param assignmentId - Assignment ID
   * @param userId - User requesting the assignment
   * @param userRole - Role of the requesting user
   * @returns Assignment if found and authorized
   * @throws NotFoundError if assignment doesn't exist
   * @throws AuthorizationError if user doesn't have access
   * @throws DatabaseError if database operation fails
   */
  getAssignment(assignmentId: string, userId: string, userRole: string): Promise<Assignment>;

  /**
   * Gets assignment submission by ID with authorization check
   *
   * @param submissionId - Submission ID
   * @param userId - User requesting the submission
   * @param userRole - Role of the requesting user
   * @returns Submission if found and authorized
   * @throws NotFoundError if submission doesn't exist
   * @throws AuthorizationError if user doesn't have access
   * @throws DatabaseError if database operation fails
   */
  getSubmission(
    submissionId: string,
    userId: string,
    userRole: string
  ): Promise<AssignmentSubmission>;

  /**
   * Gets student's assignment summary
   *
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns Assignment summary with submission statistics
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  getStudentAssignmentSummary(
    assignmentId: string,
    studentId: string
  ): Promise<StudentAssignmentSummary>;

  /**
   * Checks if a student can submit to an assignment
   *
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns True if student can submit, false otherwise
   * @throws NotFoundError if assignment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  canSubmitAssignment(assignmentId: string, studentId: string): Promise<boolean>;

  /**
   * Updates progress when assignment grading is completed
   * This method is called internally after grading to update student progress
   *
   * @param submissionId - Submission ID that was graded
   * @returns void
   * @throws DatabaseError if progress update fails
   */
  updateProgressOnGradingCompletion(submissionId: string): Promise<void>;
}
