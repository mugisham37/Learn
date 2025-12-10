/**
 * Assignment Submission Repository Interface
 * 
 * Defines the contract for assignment submission data access operations.
 * Handles submission tracking with revision history and parent linking.
 * 
 * Requirements: 7.1, 7.2
 */

import { 
  AssignmentSubmission
} from '../../../../infrastructure/database/schema/assessments.schema.js';

/**
 * Pagination parameters for list queries
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Assignment submission filter parameters
 */
export interface AssignmentSubmissionFilters {
  assignmentId?: string;
  studentId?: string;
  gradingStatus?: 'submitted' | 'under_review' | 'graded' | 'revision_requested';
  isLate?: boolean;
  submittedAfter?: Date;
  submittedBefore?: Date;
}

/**
 * Data Transfer Object for creating a new assignment submission
 */
export interface CreateAssignmentSubmissionDTO {
  assignmentId: string;
  studentId: string;
  enrollmentId: string;
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  submissionText?: string;
  isLate?: boolean;
  revisionNumber?: number;
  parentSubmissionId?: string;
}

/**
 * Data Transfer Object for updating an assignment submission
 */
export interface UpdateAssignmentSubmissionDTO {
  fileUrl?: string;
  fileName?: string;
  fileSizeBytes?: number;
  submissionText?: string;
  isLate?: boolean;
  pointsAwarded?: string;
  feedback?: string;
  gradingStatus?: 'submitted' | 'under_review' | 'graded' | 'revision_requested';
  gradedAt?: Date;
  gradedBy?: string;
  revisionNumber?: number;
  parentSubmissionId?: string;
}

/**
 * Assignment submission with revision history
 */
export interface AssignmentSubmissionWithRevisions extends AssignmentSubmission {
  revisions: AssignmentSubmission[];
  parentSubmission?: AssignmentSubmission;
}

/**
 * Student submission summary for an assignment
 */
export interface StudentSubmissionSummary {
  assignmentId: string;
  studentId: string;
  totalSubmissions: number;
  latestSubmission?: AssignmentSubmission;
  bestScore?: number;
  hasRevisionRequested: boolean;
}

/**
 * Assignment Submission Repository Interface
 * 
 * Provides methods for all assignment submission data access operations
 * with support for revision tracking and parent linking.
 */
export interface IAssignmentSubmissionRepository {
  /**
   * Creates a new assignment submission in the database
   * 
   * @param data - Assignment submission creation data
   * @returns The created assignment submission
   * @throws ValidationError if assignment, student, or enrollment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateAssignmentSubmissionDTO): Promise<AssignmentSubmission>;

  /**
   * Finds an assignment submission by its unique ID
   * 
   * @param id - Assignment submission ID
   * @returns The assignment submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<AssignmentSubmission | null>;

  /**
   * Finds an assignment submission by ID with revision history
   * 
   * @param id - Assignment submission ID
   * @returns The assignment submission with revisions if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByIdWithRevisions(id: string): Promise<AssignmentSubmissionWithRevisions | null>;

  /**
   * Finds assignment submissions by assignment with pagination
   * 
   * @param assignmentId - Assignment ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment submission results
   * @throws DatabaseError if database operation fails
   */
  findByAssignment(
    assignmentId: string,
    pagination: PaginationParams,
    filters?: AssignmentSubmissionFilters
  ): Promise<PaginatedResult<AssignmentSubmission>>;

  /**
   * Finds assignment submissions by student with pagination
   * 
   * @param studentId - Student ID
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment submission results
   * @throws DatabaseError if database operation fails
   */
  findByStudent(
    studentId: string,
    pagination: PaginationParams,
    filters?: AssignmentSubmissionFilters
  ): Promise<PaginatedResult<AssignmentSubmission>>;

  /**
   * Finds the latest submission for a student and assignment
   * 
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns The latest submission if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findLatestByStudentAndAssignment(
    assignmentId: string,
    studentId: string
  ): Promise<AssignmentSubmission | null>;

  /**
   * Gets submission summary for a student and assignment
   * 
   * @param assignmentId - Assignment ID
   * @param studentId - Student ID
   * @returns Submission summary
   * @throws DatabaseError if database operation fails
   */
  getStudentSubmissionSummary(
    assignmentId: string,
    studentId: string
  ): Promise<StudentSubmissionSummary>;

  /**
   * Finds all assignment submissions with pagination and filtering
   * 
   * @param pagination - Pagination parameters
   * @param filters - Optional filters
   * @returns Paginated assignment submission results
   * @throws DatabaseError if database operation fails
   */
  findAll(
    pagination: PaginationParams,
    filters?: AssignmentSubmissionFilters
  ): Promise<PaginatedResult<AssignmentSubmission>>;

  /**
   * Updates an assignment submission's data
   * 
   * @param id - Assignment submission ID
   * @param data - Update data
   * @returns The updated assignment submission
   * @throws NotFoundError if assignment submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateAssignmentSubmissionDTO): Promise<AssignmentSubmission>;

  /**
   * Deletes an assignment submission from the database
   * This also deletes any child revisions
   * 
   * @param id - Assignment submission ID
   * @returns void
   * @throws NotFoundError if assignment submission doesn't exist
   * @throws DatabaseError if database operation fails
   */
  delete(id: string): Promise<void>;

  /**
   * Checks if an assignment submission exists
   * 
   * @param id - Assignment submission ID
   * @returns True if assignment submission exists, false otherwise
   * @throws DatabaseError if database operation fails
   */
  exists(id: string): Promise<boolean>;

  /**
   * Gets the revision count for a submission chain
   * 
   * @param parentSubmissionId - Parent submission ID (or any submission in the chain)
   * @returns Number of revisions in the chain
   * @throws DatabaseError if database operation fails
   */
  getRevisionCount(parentSubmissionId: string): Promise<number>;

  /**
   * Finds all revisions for a submission
   * 
   * @param parentSubmissionId - Parent submission ID
   * @returns Array of revisions ordered by revision number
   * @throws DatabaseError if database operation fails
   */
  findRevisions(parentSubmissionId: string): Promise<AssignmentSubmission[]>;

  /**
   * Invalidates cache for a specific assignment submission
   * Should be called after any update operation
   * 
   * @param id - Assignment submission ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;

  /**
   * Invalidates cache for assignment submissions by assignment
   * Should be called after operations that affect assignment submission lists
   * 
   * @param assignmentId - Assignment ID
   * @returns void
   */
  invalidateCacheByAssignment(assignmentId: string): Promise<void>;

  /**
   * Invalidates cache for assignment submissions by student
   * Should be called after operations that affect student submission lists
   * 
   * @param studentId - Student ID
   * @returns void
   */
  invalidateCacheByStudent(studentId: string): Promise<void>;
}