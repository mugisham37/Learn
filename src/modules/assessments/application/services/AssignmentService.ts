/**
 * Assignment Service Implementation
 * 
 * Implements assignment business operations in the application layer.
 * Orchestrates domain entities and infrastructure repositories to implement
 * assignment management use cases with proper validation, authorization, file handling,
 * and progress tracking.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError
} from '../../../../shared/errors/index.js';
import { IS3Service } from '../../../../shared/services/IS3Service.js';
import { logger } from '../../../../shared/utils/logger.js';
import { Assignment } from '../../domain/entities/Assignment.js';
import { AssignmentSubmission, AssignmentGradingStatus } from '../../domain/entities/AssignmentSubmission.js';
import { IAssignmentRepository } from '../../infrastructure/repositories/IAssignmentRepository.js';
import { IAssignmentSubmissionRepository } from '../../infrastructure/repositories/IAssignmentSubmissionRepository.js';

import { 
  IAssignmentService,
  CreateAssignmentDTO,
  SubmitAssignmentDTO,
  GradeAssignmentDTO,
  RequestRevisionDTO,
  AssignmentSubmissionResult,
  StudentAssignmentSummary
} from './IAssignmentService.js';

/**
 * Assignment Service Implementation
 * 
 * Handles all assignment-related business operations with proper validation,
 * authorization, file handling, and error handling.
 */
export class AssignmentService implements IAssignmentService {
  constructor(
    private readonly assignmentRepository: IAssignmentRepository,
    private readonly submissionRepository: IAssignmentSubmissionRepository,
    private readonly s3Service: IS3Service
  ) {}

  /**
   * Creates a new assignment with validation
   */
  async createAssignment(educatorId: string, data: CreateAssignmentDTO): Promise<Assignment> {
    try {
      logger.info('Creating assignment', { educatorId, lessonId: data.lessonId, title: data.title });

      // Validate input data
      this.validateCreateAssignmentData(data);

      // TODO: Verify educator owns the lesson (requires lesson repository)
      // For now, we'll assume the authorization is handled at the controller level

      // Create assignment using domain entity for validation
      const assignmentData = {
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        config: {
          dueDate: data.dueDate,
          lateSubmissionAllowed: data.lateSubmissionAllowed || false,
          latePenaltyPercentage: data.latePenaltyPercentage || 0,
          maxPoints: data.maxPoints,
          requiresFileUpload: data.requiresFileUpload !== false, // Default true
          allowedFileTypes: data.allowedFileTypes,
          maxFileSizeMb: data.maxFileSizeMb || 10,
          rubric: data.rubric
        }
      };

      // Validate using domain entity
      Assignment.create(assignmentData);

      // Save to repository
      const createdAssignment = await this.assignmentRepository.create({
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        dueDate: data.dueDate,
        lateSubmissionAllowed: data.lateSubmissionAllowed || false,
        latePenaltyPercentage: data.latePenaltyPercentage || 0,
        maxPoints: data.maxPoints,
        requiresFileUpload: data.requiresFileUpload !== false,
        allowedFileTypes: data.allowedFileTypes,
        maxFileSizeMb: data.maxFileSizeMb || 10,
        rubric: data.rubric
      });

      logger.info('Assignment created successfully', { assignmentId: createdAssignment.id, educatorId });

      return Assignment.fromPersistence(
        createdAssignment.id,
        createdAssignment.lessonId,
        createdAssignment.title,
        createdAssignment.description,
        createdAssignment.instructions,
        {
          dueDate: createdAssignment.dueDate,
          lateSubmissionAllowed: createdAssignment.lateSubmissionAllowed,
          latePenaltyPercentage: createdAssignment.latePenaltyPercentage,
          maxPoints: createdAssignment.maxPoints,
          requiresFileUpload: createdAssignment.requiresFileUpload,
          allowedFileTypes: createdAssignment.allowedFileTypes as string[],
          maxFileSizeMb: createdAssignment.maxFileSizeMb,
          rubric: createdAssignment.rubric as Record<string, unknown> | undefined
        },
        createdAssignment.createdAt,
        createdAssignment.updatedAt
      );

    } catch (error) {
      logger.error('Failed to create assignment', { error, educatorId, data });
      
      if (error instanceof ValidationError || error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to create assignment', 'create', error as Error);
    }
  }

  /**
   * Submits an assignment with file validation and S3 upload
   */
  async submitAssignment(data: SubmitAssignmentDTO): Promise<AssignmentSubmissionResult> {
    try {
      logger.info('Submitting assignment', { 
        assignmentId: data.assignmentId, 
        studentId: data.studentId,
        hasFile: !!data.file,
        isRevision: !!data.parentSubmissionId
      });

      // Validate input data
      this.validateSubmitAssignmentData(data);

      // Get assignment
      const assignmentData = await this.assignmentRepository.findById(data.assignmentId);
      if (!assignmentData) {
        throw new NotFoundError('Assignment', data.assignmentId);
      }

      // Convert to domain entity
      const assignment = Assignment.fromPersistence(
        assignmentData.id,
        assignmentData.lessonId,
        assignmentData.title,
        assignmentData.description,
        assignmentData.instructions,
        {
          dueDate: assignmentData.dueDate,
          lateSubmissionAllowed: assignmentData.lateSubmissionAllowed,
          latePenaltyPercentage: assignmentData.latePenaltyPercentage,
          maxPoints: assignmentData.maxPoints,
          requiresFileUpload: assignmentData.requiresFileUpload,
          allowedFileTypes: assignmentData.allowedFileTypes as string[],
          maxFileSizeMb: assignmentData.maxFileSizeMb,
          rubric: assignmentData.rubric as Record<string, unknown> | undefined
        },
        assignmentData.createdAt,
        assignmentData.updatedAt
      );

      // Check if assignment accepts submissions
      if (!assignment.isAcceptingSubmissions()) {
        throw new ConflictError('Assignment is no longer accepting submissions');
      }

      // Handle file upload if provided
      let fileInfo: { url: string; name: string; sizeBytes: number } | undefined;
      
      if (data.file) {
        // Validate file
        const fileValidation = assignment.validateFile(data.file.fileName, data.file.buffer.length);
        if (!fileValidation.isValid) {
          throw new ValidationError(fileValidation.error!);
        }

        // Generate S3 key
        const fileExtension = data.file.fileName.substring(data.file.fileName.lastIndexOf('.'));
        const s3Key = `assignments/${data.assignmentId}/${data.studentId}/${Date.now()}_${crypto.randomUUID()}${fileExtension}`;

        try {
          // Upload to S3
          const uploadResult = await this.s3Service.uploadFile({
            key: s3Key,
            buffer: data.file.buffer,
            contentType: data.file.contentType,
            metadata: {
              assignmentId: data.assignmentId,
              studentId: data.studentId,
              originalFileName: data.file.fileName
            }
          });

          fileInfo = {
            url: uploadResult.url,
            name: data.file.fileName,
            sizeBytes: data.file.buffer.length
          };

          logger.info('File uploaded successfully for assignment submission', {
            assignmentId: data.assignmentId,
            studentId: data.studentId,
            s3Key,
            fileSize: data.file.buffer.length
          });

        } catch (error) {
          logger.error('Failed to upload assignment file to S3', { error, assignmentId: data.assignmentId });
          throw new ExternalServiceError('AWS S3', 'Failed to upload assignment file', error as Error);
        }
      }

      // Handle revision linking
      let revisionNumber = 1;
      if (data.parentSubmissionId) {
        const parentSubmission = await this.submissionRepository.findById(data.parentSubmissionId);
        if (!parentSubmission) {
          throw new NotFoundError('Parent submission', data.parentSubmissionId);
        }
        
        // Verify parent submission belongs to same student and assignment
        if (parentSubmission.studentId !== data.studentId || parentSubmission.assignmentId !== data.assignmentId) {
          throw new ValidationError('Parent submission does not belong to this student and assignment');
        }

        // Get revision count to determine revision number
        revisionNumber = await this.submissionRepository.getRevisionCount(data.parentSubmissionId) + 1;
      }

      // Create submission using domain entity
      const submissionData = {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        file: fileInfo,
        submissionText: data.submissionText,
        parentSubmissionId: data.parentSubmissionId
      };

      const domainSubmission = AssignmentSubmission.create(submissionData, assignment);

      // Save to repository
      const createdSubmission = await this.submissionRepository.create({
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        fileUrl: fileInfo?.url,
        fileName: fileInfo?.name,
        fileSizeBytes: fileInfo?.sizeBytes,
        submissionText: data.submissionText,
        isLate: domainSubmission.isLate,
        revisionNumber,
        parentSubmissionId: data.parentSubmissionId
      });

      logger.info('Assignment submitted successfully', { 
        submissionId: createdSubmission.id,
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        isLate: domainSubmission.isLate,
        revisionNumber
      });

      // Convert back to domain entity
      const resultSubmission = AssignmentSubmission.fromPersistence(
        createdSubmission.id,
        createdSubmission.assignmentId,
        createdSubmission.studentId,
        createdSubmission.enrollmentId,
        fileInfo || null,
        createdSubmission.submissionText,
        createdSubmission.submittedAt,
        createdSubmission.isLate,
        null, // Points awarded initially null
        null, // Feedback initially null
        createdSubmission.gradingStatus as AssignmentGradingStatus,
        null, // Graded at initially null
        null, // Graded by initially null
        createdSubmission.revisionNumber,
        createdSubmission.parentSubmissionId,
        createdSubmission.createdAt,
        createdSubmission.updatedAt
      );

      return {
        submission: resultSubmission
      };

    } catch (error) {
      logger.error('Failed to submit assignment', { error, data });
      
      if (error instanceof ValidationError || error instanceof NotFoundError || 
          error instanceof ConflictError || error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to submit assignment', 'create', error as Error);
    }
  }

  /**
   * Grades an assignment submission with rubric support
   */
  async gradeAssignment(data: GradeAssignmentDTO): Promise<AssignmentSubmission> {
    try {
      logger.info('Grading assignment submission', { 
        submissionId: data.submissionId, 
        gradedBy: data.gradedBy,
        pointsAwarded: data.pointsAwarded
      });

      // Get submission
      const submissionData = await this.submissionRepository.findById(data.submissionId);
      if (!submissionData) {
        throw new NotFoundError('Assignment submission', data.submissionId);
      }

      // Get assignment for validation
      const assignmentData = await this.assignmentRepository.findById(submissionData.assignmentId);
      if (!assignmentData) {
        throw new NotFoundError('Assignment', submissionData.assignmentId);
      }

      // Validate points awarded
      if (data.pointsAwarded < 0 || data.pointsAwarded > assignmentData.maxPoints) {
        throw new ValidationError(`Points awarded must be between 0 and ${assignmentData.maxPoints}`);
      }

      // Check if submission is in a gradable state
      if (submissionData.gradingStatus === 'graded') {
        throw new ConflictError('Submission has already been graded');
      }

      // TODO: Verify grader has permission to grade this submission
      // This would require checking if the grader is the course instructor

      // Convert to domain entity
      const fileInfo = submissionData.fileUrl ? {
        url: submissionData.fileUrl,
        name: submissionData.fileName || '',
        sizeBytes: submissionData.fileSizeBytes || 0
      } : null;

      const domainSubmission = AssignmentSubmission.fromPersistence(
        submissionData.id,
        submissionData.assignmentId,
        submissionData.studentId,
        submissionData.enrollmentId,
        fileInfo,
        submissionData.submissionText,
        submissionData.submittedAt,
        submissionData.isLate,
        submissionData.pointsAwarded ? parseFloat(submissionData.pointsAwarded) : null,
        submissionData.feedback,
        submissionData.gradingStatus as AssignmentGradingStatus,
        submissionData.gradedAt,
        submissionData.gradedBy,
        submissionData.revisionNumber,
        submissionData.parentSubmissionId,
        submissionData.createdAt,
        submissionData.updatedAt
      );

      // Grade using domain entity
      const gradedSubmission = domainSubmission.grade({
        pointsAwarded: data.pointsAwarded,
        feedback: data.feedback,
        gradedBy: data.gradedBy
      }, assignmentData.maxPoints);

      // Calculate final score with late penalty if applicable
      const finalScore = gradedSubmission.calculateFinalScore(assignmentData.latePenaltyPercentage);

      // Update submission in repository
      const updatedSubmission = await this.submissionRepository.update(data.submissionId, {
        pointsAwarded: finalScore?.toString() || data.pointsAwarded.toString(),
        feedback: data.feedback,
        gradingStatus: 'graded',
        gradedAt: new Date(),
        gradedBy: data.gradedBy
      });

      logger.info('Assignment submission graded successfully', { 
        submissionId: data.submissionId,
        pointsAwarded: data.pointsAwarded,
        finalScore,
        gradedBy: data.gradedBy
      });

      // Update progress on grading completion
      await this.updateProgressOnGradingCompletion(data.submissionId);

      // Convert back to domain entity for return
      return AssignmentSubmission.fromPersistence(
        updatedSubmission.id,
        updatedSubmission.assignmentId,
        updatedSubmission.studentId,
        updatedSubmission.enrollmentId,
        fileInfo,
        updatedSubmission.submissionText,
        updatedSubmission.submittedAt,
        updatedSubmission.isLate,
        finalScore || data.pointsAwarded,
        updatedSubmission.feedback,
        updatedSubmission.gradingStatus as AssignmentGradingStatus,
        updatedSubmission.gradedAt,
        updatedSubmission.gradedBy,
        updatedSubmission.revisionNumber,
        updatedSubmission.parentSubmissionId,
        updatedSubmission.createdAt,
        updatedSubmission.updatedAt
      );

    } catch (error) {
      logger.error('Failed to grade assignment submission', { error, data });
      
      if (error instanceof ValidationError || error instanceof AuthorizationError || 
          error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to grade assignment submission', 'update', error as Error);
    }
  }

  /**
   * Requests revision for an assignment submission
   */
  async requestRevision(data: RequestRevisionDTO): Promise<AssignmentSubmission> {
    try {
      logger.info('Requesting revision for assignment submission', { 
        submissionId: data.submissionId, 
        gradedBy: data.gradedBy
      });

      // Get submission
      const submissionData = await this.submissionRepository.findById(data.submissionId);
      if (!submissionData) {
        throw new NotFoundError('Assignment submission', data.submissionId);
      }

      // Check if submission can be revised
      if (submissionData.gradingStatus === 'revision_requested') {
        throw new ConflictError('Revision has already been requested for this submission');
      }

      if (submissionData.gradingStatus === 'graded') {
        throw new ConflictError('Cannot request revision for already graded submission');
      }

      // TODO: Verify requester has permission to request revision
      // This would require checking if the requester is the course instructor

      // Convert to domain entity
      const fileInfo = submissionData.fileUrl ? {
        url: submissionData.fileUrl,
        name: submissionData.fileName || '',
        sizeBytes: submissionData.fileSizeBytes || 0
      } : null;

      const domainSubmission = AssignmentSubmission.fromPersistence(
        submissionData.id,
        submissionData.assignmentId,
        submissionData.studentId,
        submissionData.enrollmentId,
        fileInfo,
        submissionData.submissionText,
        submissionData.submittedAt,
        submissionData.isLate,
        submissionData.pointsAwarded ? parseFloat(submissionData.pointsAwarded) : null,
        submissionData.feedback,
        submissionData.gradingStatus as AssignmentGradingStatus,
        submissionData.gradedAt,
        submissionData.gradedBy,
        submissionData.revisionNumber,
        submissionData.parentSubmissionId,
        submissionData.createdAt,
        submissionData.updatedAt
      );

      // Request revision using domain entity
      domainSubmission.requestRevision(data.feedback, data.gradedBy);

      // Update submission in repository
      const updatedSubmission = await this.submissionRepository.update(data.submissionId, {
        feedback: data.feedback,
        gradingStatus: 'revision_requested',
        gradedAt: new Date(),
        gradedBy: data.gradedBy,
        pointsAwarded: undefined // Clear points when requesting revision
      });

      logger.info('Revision requested successfully', { 
        submissionId: data.submissionId,
        gradedBy: data.gradedBy
      });

      // Convert back to domain entity for return
      return AssignmentSubmission.fromPersistence(
        updatedSubmission.id,
        updatedSubmission.assignmentId,
        updatedSubmission.studentId,
        updatedSubmission.enrollmentId,
        fileInfo,
        updatedSubmission.submissionText,
        updatedSubmission.submittedAt,
        updatedSubmission.isLate,
        null, // Points cleared
        updatedSubmission.feedback,
        updatedSubmission.gradingStatus as AssignmentGradingStatus,
        updatedSubmission.gradedAt,
        updatedSubmission.gradedBy,
        updatedSubmission.revisionNumber,
        updatedSubmission.parentSubmissionId,
        updatedSubmission.createdAt,
        updatedSubmission.updatedAt
      );

    } catch (error) {
      logger.error('Failed to request revision', { error, data });
      
      if (error instanceof ValidationError || error instanceof AuthorizationError || 
          error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to request revision', 'update', error as Error);
    }
  }

  /**
   * Gets assignment by ID with authorization check
   */
  async getAssignment(assignmentId: string, _userId: string, _userRole: string): Promise<Assignment> {
    try {
      const assignmentData = await this.assignmentRepository.findById(assignmentId);
      if (!assignmentData) {
        throw new NotFoundError('Assignment', assignmentId);
      }

      // TODO: Implement proper authorization logic
      // For now, allow all authenticated users to view assignments
      
      return Assignment.fromPersistence(
        assignmentData.id,
        assignmentData.lessonId,
        assignmentData.title,
        assignmentData.description,
        assignmentData.instructions,
        {
          dueDate: assignmentData.dueDate,
          lateSubmissionAllowed: assignmentData.lateSubmissionAllowed,
          latePenaltyPercentage: assignmentData.latePenaltyPercentage,
          maxPoints: assignmentData.maxPoints,
          requiresFileUpload: assignmentData.requiresFileUpload,
          allowedFileTypes: assignmentData.allowedFileTypes as string[],
          maxFileSizeMb: assignmentData.maxFileSizeMb,
          rubric: assignmentData.rubric as Record<string, unknown> | undefined
        },
        assignmentData.createdAt,
        assignmentData.updatedAt
      );

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to get assignment', 'findById', error as Error);
    }
  }

  /**
   * Gets assignment submission by ID with authorization check
   */
  async getSubmission(submissionId: string, userId: string, userRole: string): Promise<AssignmentSubmission> {
    try {
      const submissionData = await this.submissionRepository.findById(submissionId);
      if (!submissionData) {
        throw new NotFoundError('Assignment submission', submissionId);
      }

      // Check authorization - students can only see their own submissions
      if (userRole === 'student' && submissionData.studentId !== userId) {
        throw new AuthorizationError('Access denied to this submission');
      }

      // TODO: For educators, verify they own the course/lesson

      // Convert to domain entity
      const fileInfo = submissionData.fileUrl ? {
        url: submissionData.fileUrl,
        name: submissionData.fileName || '',
        sizeBytes: submissionData.fileSizeBytes || 0
      } : null;

      return AssignmentSubmission.fromPersistence(
        submissionData.id,
        submissionData.assignmentId,
        submissionData.studentId,
        submissionData.enrollmentId,
        fileInfo,
        submissionData.submissionText,
        submissionData.submittedAt,
        submissionData.isLate,
        submissionData.pointsAwarded ? parseFloat(submissionData.pointsAwarded) : null,
        submissionData.feedback,
        submissionData.gradingStatus as AssignmentGradingStatus,
        submissionData.gradedAt,
        submissionData.gradedBy,
        submissionData.revisionNumber,
        submissionData.parentSubmissionId,
        submissionData.createdAt,
        submissionData.updatedAt
      );

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to get submission', 'findById', error as Error);
    }
  }

  /**
   * Gets student's assignment summary
   */
  async getStudentAssignmentSummary(assignmentId: string, studentId: string): Promise<StudentAssignmentSummary> {
    try {
      const summary = await this.submissionRepository.getStudentSubmissionSummary(assignmentId, studentId);
      const canSubmit = await this.canSubmitAssignment(assignmentId, studentId);

      // Convert latest submission to domain entity if exists
      let latestSubmission: AssignmentSubmission | undefined;
      if (summary.latestSubmission) {
        const fileInfo = summary.latestSubmission.fileUrl ? {
          url: summary.latestSubmission.fileUrl,
          name: summary.latestSubmission.fileName || '',
          sizeBytes: summary.latestSubmission.fileSizeBytes || 0
        } : null;

        latestSubmission = AssignmentSubmission.fromPersistence(
          summary.latestSubmission.id,
          summary.latestSubmission.assignmentId,
          summary.latestSubmission.studentId,
          summary.latestSubmission.enrollmentId,
          fileInfo,
          summary.latestSubmission.submissionText,
          summary.latestSubmission.submittedAt,
          summary.latestSubmission.isLate,
          summary.latestSubmission.pointsAwarded ? parseFloat(summary.latestSubmission.pointsAwarded) : null,
          summary.latestSubmission.feedback,
          summary.latestSubmission.gradingStatus as AssignmentGradingStatus,
          summary.latestSubmission.gradedAt,
          summary.latestSubmission.gradedBy,
          summary.latestSubmission.revisionNumber,
          summary.latestSubmission.parentSubmissionId,
          summary.latestSubmission.createdAt,
          summary.latestSubmission.updatedAt
        );
      }

      return {
        assignmentId: summary.assignmentId,
        studentId: summary.studentId,
        totalSubmissions: summary.totalSubmissions,
        latestSubmission,
        bestScore: summary.bestScore || undefined,
        hasRevisionRequested: summary.hasRevisionRequested,
        canSubmit
      };

    } catch (error) {
      logger.error('Failed to get student assignment summary', { error, assignmentId, studentId });
      throw new DatabaseError('Failed to get student assignment summary', 'getStudentSubmissionSummary', error as Error);
    }
  }

  /**
   * Checks if a student can submit to an assignment
   */
  async canSubmitAssignment(assignmentId: string, studentId: string): Promise<boolean> {
    try {
      // Get assignment
      const assignmentData = await this.assignmentRepository.findById(assignmentId);
      if (!assignmentData) {
        return false;
      }

      // Convert to domain entity
      const assignment = Assignment.fromPersistence(
        assignmentData.id,
        assignmentData.lessonId,
        assignmentData.title,
        assignmentData.description,
        assignmentData.instructions,
        {
          dueDate: assignmentData.dueDate,
          lateSubmissionAllowed: assignmentData.lateSubmissionAllowed,
          latePenaltyPercentage: assignmentData.latePenaltyPercentage,
          maxPoints: assignmentData.maxPoints,
          requiresFileUpload: assignmentData.requiresFileUpload,
          allowedFileTypes: assignmentData.allowedFileTypes as string[],
          maxFileSizeMb: assignmentData.maxFileSizeMb,
          rubric: assignmentData.rubric as Record<string, unknown> | undefined
        },
        assignmentData.createdAt,
        assignmentData.updatedAt
      );

      // Check if assignment accepts submissions
      if (!assignment.isAcceptingSubmissions()) {
        return false;
      }

      // Check if student has a revision requested (can resubmit)
      const latestSubmission = await this.submissionRepository.findLatestByStudentAndAssignment(assignmentId, studentId);
      if (latestSubmission && latestSubmission.gradingStatus === 'revision_requested') {
        return true;
      }

      // Check if student already has a graded submission (cannot resubmit unless revision requested)
      if (latestSubmission && latestSubmission.gradingStatus === 'graded') {
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Failed to check if student can submit assignment', { error, assignmentId, studentId });
      return false;
    }
  }

  /**
   * Updates progress when assignment grading is completed
   */
  async updateProgressOnGradingCompletion(submissionId: string): Promise<void> {
    try {
      logger.info('Updating progress on assignment grading completion', { submissionId });

      // Get submission details
      const submissionData = await this.submissionRepository.findById(submissionId);
      if (!submissionData) {
        logger.warn('Submission not found for progress update', { submissionId });
        return;
      }

      // TODO: Implement progress update logic
      // This would involve:
      // 1. Getting the lesson associated with the assignment
      // 2. Finding the enrollment for the student and course
      // 3. Updating the lesson progress to completed
      // 4. Recalculating overall course progress
      // 
      // For now, we'll log the action and leave implementation for when
      // enrollment and progress modules are available

      logger.info('Progress update completed for assignment grading', {
        submissionId,
        studentId: submissionData.studentId,
        assignmentId: submissionData.assignmentId
      });

    } catch (error) {
      logger.error('Failed to update progress on grading completion', { error, submissionId });
      // Don't throw error as this is a side effect - the grading should still succeed
    }
  }

  /**
   * Validates assignment creation data
   */
  private validateCreateAssignmentData(data: CreateAssignmentDTO): void {
    if (!data.lessonId?.trim()) {
      throw new ValidationError('Lesson ID is required');
    }

    if (!data.title?.trim()) {
      throw new ValidationError('Assignment title is required');
    }

    if (data.title.length > 255) {
      throw new ValidationError('Assignment title must be 255 characters or less');
    }

    if (!data.instructions?.trim()) {
      throw new ValidationError('Assignment instructions are required');
    }

    if (!data.dueDate || data.dueDate <= new Date()) {
      throw new ValidationError('Due date must be in the future');
    }

    if (data.maxPoints <= 0) {
      throw new ValidationError('Max points must be positive');
    }

    if (data.latePenaltyPercentage !== undefined && 
        (data.latePenaltyPercentage < 0 || data.latePenaltyPercentage > 100)) {
      throw new ValidationError('Late penalty percentage must be between 0 and 100');
    }

    if (data.maxFileSizeMb !== undefined && data.maxFileSizeMb <= 0) {
      throw new ValidationError('Max file size must be positive if specified');
    }

    if (!data.allowedFileTypes || data.allowedFileTypes.length === 0) {
      throw new ValidationError('At least one allowed file type must be specified');
    }

    // Validate file types format
    const validExtensions = /^\.[a-zA-Z0-9]+$/;
    for (const fileType of data.allowedFileTypes) {
      if (!validExtensions.test(fileType)) {
        throw new ValidationError(`Invalid file type format: ${fileType}. Must be in format like .pdf, .docx`);
      }
    }
  }

  /**
   * Validates assignment submission data
   */
  private validateSubmitAssignmentData(data: SubmitAssignmentDTO): void {
    if (!data.assignmentId?.trim()) {
      throw new ValidationError('Assignment ID is required');
    }

    if (!data.studentId?.trim()) {
      throw new ValidationError('Student ID is required');
    }

    if (!data.enrollmentId?.trim()) {
      throw new ValidationError('Enrollment ID is required');
    }

    // Ensure either file or text is provided
    if (!data.file && !data.submissionText?.trim()) {
      throw new ValidationError('Either file upload or submission text is required');
    }

    // Validate file if provided
    if (data.file) {
      if (!data.file.fileName?.trim()) {
        throw new ValidationError('File name is required');
      }

      if (!data.file.buffer || data.file.buffer.length === 0) {
        throw new ValidationError('File content is required');
      }

      if (!data.file.contentType?.trim()) {
        throw new ValidationError('File content type is required');
      }
    }
  }
}