/**
 * AssignmentSubmission Domain Entity
 *
 * Represents a student's submission for an assignment with file uploads, grading, and revision tracking.
 * Implements business logic for submission validation, late detection, penalty calculation, and revision linking.
 *
 * Requirements: 7.1, 7.3, 7.6
 */

export type AssignmentGradingStatus =
  | 'submitted'
  | 'under_review'
  | 'graded'
  | 'revision_requested';

export interface AssignmentForSubmission {
  id: string;
  config: {
    requiresFileUpload: boolean;
    allowedFileTypes: string[];
    maxFileSizeMb: number;
  };
  isAcceptingSubmissions(): boolean;
  isSubmissionLate(date: Date): boolean;
  validateFile(fileName: string, fileSizeBytes: number): { isValid: boolean; error?: string };
}

export interface SubmissionFile {
  url: string;
  name: string;
  sizeBytes: number;
}

export interface GradingData {
  pointsAwarded: number;
  feedback?: string;
  gradedBy: string;
}

export interface CreateSubmissionData {
  assignmentId: string;
  studentId: string;
  enrollmentId: string;
  file?: SubmissionFile;
  submissionText?: string;
  submittedAt?: Date;
  parentSubmissionId?: string;
}

export class AssignmentSubmission {
  private constructor(
    public readonly id: string,
    public readonly assignmentId: string,
    public readonly studentId: string,
    public readonly enrollmentId: string,
    public readonly file: SubmissionFile | null,
    public readonly submissionText: string | null,
    public readonly submittedAt: Date,
    public readonly isLate: boolean,
    public readonly pointsAwarded: number | null,
    public readonly feedback: string | null,
    public readonly gradingStatus: AssignmentGradingStatus,
    public readonly gradedAt: Date | null,
    public readonly gradedBy: string | null,
    public readonly revisionNumber: number,
    public readonly parentSubmissionId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    private _domainEvents: any[] = []
  ) {}

  static create(
    data: CreateSubmissionData,
    assignment: AssignmentForSubmission
  ): AssignmentSubmission {
    // Validate submission data
    this.validateSubmissionData(data, assignment);

    const submittedAt = data.submittedAt || new Date();
    const isLate = assignment.isSubmissionLate(submittedAt);

    // Determine revision number
    const revisionNumber = data.parentSubmissionId ? 1 : 1; // Will be updated by service layer with actual count

    const submission = new AssignmentSubmission(
      crypto.randomUUID(),
      data.assignmentId,
      data.studentId,
      data.enrollmentId,
      data.file || null,
      data.submissionText || null,
      submittedAt,
      isLate,
      null, // Points awarded initially null
      null, // Feedback initially null
      'submitted',
      null, // Graded at initially null
      null, // Graded by initially null
      revisionNumber,
      data.parentSubmissionId || null,
      new Date(),
      new Date()
    );

    return submission;
  }
  static fromPersistence(
    id: string,
    assignmentId: string,
    studentId: string,
    enrollmentId: string,
    file: SubmissionFile | null,
    submissionText: string | null,
    submittedAt: Date,
    isLate: boolean,
    pointsAwarded: number | null,
    feedback: string | null,
    gradingStatus: AssignmentGradingStatus,
    gradedAt: Date | null,
    gradedBy: string | null,
    revisionNumber: number,
    parentSubmissionId: string | null,
    createdAt: Date,
    updatedAt: Date
  ): AssignmentSubmission {
    return new AssignmentSubmission(
      id,
      assignmentId,
      studentId,
      enrollmentId,
      file,
      submissionText,
      submittedAt,
      isLate,
      pointsAwarded,
      feedback,
      gradingStatus,
      gradedAt,
      gradedBy,
      revisionNumber,
      parentSubmissionId,
      createdAt,
      updatedAt
    );
  }

  /**
   * Validates submission data according to business rules
   */
  private static validateSubmissionData(
    data: CreateSubmissionData,
    assignment: AssignmentForSubmission
  ): void {
    if (!data.assignmentId?.trim()) {
      throw new Error('Assignment ID is required');
    }

    if (!data.studentId?.trim()) {
      throw new Error('Student ID is required');
    }

    if (!data.enrollmentId?.trim()) {
      throw new Error('Enrollment ID is required');
    }

    // Check if assignment accepts submissions
    if (!assignment.isAcceptingSubmissions()) {
      throw new Error('Assignment is no longer accepting submissions');
    }

    // Validate file if required
    if (assignment.config.requiresFileUpload && !data.file) {
      throw new Error('File upload is required for this assignment');
    }

    // Validate file if provided
    if (data.file && assignment.config.requiresFileUpload) {
      const validation = assignment.validateFile(data.file.name, data.file.sizeBytes);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    // Ensure either file or text is provided
    if (!data.file && !data.submissionText?.trim()) {
      throw new Error('Either file upload or submission text is required');
    }
  }
  /**
   * Calculates the final score after applying late penalty
   */
  calculateFinalScore(latePenaltyPercentage: number): number | null {
    if (this.pointsAwarded === null) {
      return null;
    }

    if (!this.isLate || latePenaltyPercentage === 0) {
      return this.pointsAwarded;
    }

    const penalty = (this.pointsAwarded * latePenaltyPercentage) / 100;
    const finalScore = Math.max(0, this.pointsAwarded - penalty);

    return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Grades the submission with points and feedback
   */
  grade(gradingData: GradingData, maxPoints: number): AssignmentSubmission {
    if (gradingData.pointsAwarded < 0 || gradingData.pointsAwarded > maxPoints) {
      throw new Error(`Points awarded must be between 0 and ${maxPoints}`);
    }

    return new AssignmentSubmission(
      this.id,
      this.assignmentId,
      this.studentId,
      this.enrollmentId,
      this.file,
      this.submissionText,
      this.submittedAt,
      this.isLate,
      gradingData.pointsAwarded,
      gradingData.feedback || null,
      'graded',
      new Date(),
      gradingData.gradedBy,
      this.revisionNumber,
      this.parentSubmissionId,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Requests revision with feedback
   */
  requestRevision(feedback: string, gradedBy: string): AssignmentSubmission {
    if (!feedback?.trim()) {
      throw new Error('Feedback is required when requesting revision');
    }

    return new AssignmentSubmission(
      this.id,
      this.assignmentId,
      this.studentId,
      this.enrollmentId,
      this.file,
      this.submissionText,
      this.submittedAt,
      this.isLate,
      null, // Clear points when requesting revision
      feedback,
      'revision_requested',
      new Date(),
      gradedBy,
      this.revisionNumber,
      this.parentSubmissionId,
      this.createdAt,
      new Date()
    );
  }
  /**
   * Creates a revision submission linked to this submission
   */
  createRevision(
    revisionData: CreateSubmissionData,
    assignment: AssignmentForSubmission
  ): AssignmentSubmission {
    if (this.gradingStatus !== 'revision_requested') {
      throw new Error('Can only create revision for submissions with revision_requested status');
    }

    // Ensure the revision data references this submission as parent
    const revisionSubmissionData = {
      ...revisionData,
      parentSubmissionId: this.id,
      assignmentId: this.assignmentId,
      studentId: this.studentId,
      enrollmentId: this.enrollmentId,
    };

    const revision = AssignmentSubmission.create(revisionSubmissionData, assignment);

    // Set the correct revision number (parent's revision number + 1)
    return new AssignmentSubmission(
      revision.id,
      revision.assignmentId,
      revision.studentId,
      revision.enrollmentId,
      revision.file,
      revision.submissionText,
      revision.submittedAt,
      revision.isLate,
      revision.pointsAwarded,
      revision.feedback,
      revision.gradingStatus,
      revision.gradedAt,
      revision.gradedBy,
      this.revisionNumber + 1,
      this.id,
      revision.createdAt,
      revision.updatedAt
    );
  }

  /**
   * Checks if this submission is a revision of another submission
   */
  isRevision(): boolean {
    return this.parentSubmissionId !== null;
  }

  /**
   * Checks if this submission can be revised
   */
  canBeRevised(): boolean {
    return this.gradingStatus === 'revision_requested';
  }

  /**
   * Updates grading status (for workflow management)
   */
  updateStatus(newStatus: AssignmentGradingStatus): AssignmentSubmission {
    const validTransitions: Record<AssignmentGradingStatus, AssignmentGradingStatus[]> = {
      submitted: ['under_review', 'graded', 'revision_requested'],
      under_review: ['graded', 'revision_requested'],
      graded: [], // Final state
      revision_requested: [], // Student creates new revision
    };

    if (!validTransitions[this.gradingStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.gradingStatus} to ${newStatus}`);
    }

    return new AssignmentSubmission(
      this.id,
      this.assignmentId,
      this.studentId,
      this.enrollmentId,
      this.file,
      this.submissionText,
      this.submittedAt,
      this.isLate,
      this.pointsAwarded,
      this.feedback,
      newStatus,
      this.gradedAt,
      this.gradedBy,
      this.revisionNumber,
      this.parentSubmissionId,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Gets domain events and clears them
   */
  getDomainEvents(): any[] {
    const events = [...this._domainEvents];
    this._domainEvents.length = 0;
    return events;
  }
}
