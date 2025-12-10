/**
 * Assignment Domain Entity Tests
 * 
 * Tests for Assignment and AssignmentSubmission domain entities
 */

import { describe, it, expect } from 'vitest';
import { Assignment, AssignmentSubmission } from '../../../src/modules/assessments/domain/entities/index.js';

describe('Assignment Entity', () => {
  const validAssignmentData = {
    lessonId: 'lesson-123',
    title: 'Test Assignment',
    description: 'A test assignment',
    instructions: 'Complete the assignment by the due date',
    config: {
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      lateSubmissionAllowed: true,
      latePenaltyPercentage: 10,
      maxPoints: 100,
      requiresFileUpload: true,
      allowedFileTypes: ['.pdf', '.docx'],
      maxFileSizeMb: 5,
      rubric: { criteria1: 'Good work', criteria2: 'Needs improvement' }
    }
  };

  describe('create', () => {
    it('should create assignment with valid data', () => {
      const assignment = Assignment.create(validAssignmentData);
      
      expect(assignment.id).toBeDefined();
      expect(assignment.lessonId).toBe(validAssignmentData.lessonId);
      expect(assignment.title).toBe(validAssignmentData.title);
      expect(assignment.instructions).toBe(validAssignmentData.instructions);
      expect(assignment.config).toEqual(validAssignmentData.config);
    });

    it('should reject assignment with due date in the past', () => {
      const invalidData = {
        ...validAssignmentData,
        config: {
          ...validAssignmentData.config,
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }
      };

      expect(() => Assignment.create(invalidData)).toThrow('Due date must be in the future');
    });

    it('should reject assignment with invalid file types', () => {
      const invalidData = {
        ...validAssignmentData,
        config: {
          ...validAssignmentData.config,
          allowedFileTypes: ['pdf', 'docx'] // Missing dots
        }
      };

      expect(() => Assignment.create(invalidData)).toThrow('Invalid file type format');
    });
  });

  describe('late submission detection', () => {
    it('should detect late submissions correctly', () => {
      const assignment = Assignment.create(validAssignmentData);
      const futureDate = new Date(assignment.config.dueDate.getTime() + 60 * 60 * 1000); // 1 hour after due date
      
      expect(assignment.isSubmissionLate(futureDate)).toBe(true);
      expect(assignment.isSubmissionLate(assignment.config.dueDate)).toBe(false);
    });

    it('should calculate late penalty correctly', () => {
      const assignment = Assignment.create(validAssignmentData);
      const lateDate = new Date(assignment.config.dueDate.getTime() + 60 * 60 * 1000);
      
      expect(assignment.calculateLatePenalty(lateDate)).toBe(10);
      expect(assignment.calculateLatePenalty(assignment.config.dueDate)).toBe(0);
    });
  });
});
describe('AssignmentSubmission Entity', () => {
  const mockAssignment = {
    id: 'assignment-123',
    config: {
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lateSubmissionAllowed: true,
      latePenaltyPercentage: 10,
      maxPoints: 100,
      requiresFileUpload: true,
      allowedFileTypes: ['.pdf', '.docx'],
      maxFileSizeMb: 5
    },
    isAcceptingSubmissions: () => true,
    isSubmissionLate: (date: Date) => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return date > dueDate;
    },
    validateFile: (name: string, size: number) => ({ isValid: true })
  };

  const validSubmissionData = {
    assignmentId: 'assignment-123',
    studentId: 'student-123',
    enrollmentId: 'enrollment-123',
    file: {
      url: 'https://example.com/file.pdf',
      name: 'submission.pdf',
      sizeBytes: 1024 * 1024 // 1MB
    },
    submissionText: 'This is my submission text'
  };

  describe('create', () => {
    it('should create submission with valid data', () => {
      const submission = AssignmentSubmission.create(validSubmissionData, mockAssignment);
      
      expect(submission.id).toBeDefined();
      expect(submission.assignmentId).toBe(validSubmissionData.assignmentId);
      expect(submission.studentId).toBe(validSubmissionData.studentId);
      expect(submission.file).toEqual(validSubmissionData.file);
      expect(submission.gradingStatus).toBe('submitted');
      expect(submission.revisionNumber).toBe(1);
    });

    it('should detect late submission', () => {
      const lateDate = new Date(mockAssignment.config.dueDate.getTime() + 60 * 60 * 1000);
      const lateSubmissionData = {
        ...validSubmissionData,
        submittedAt: lateDate
      };

      const submission = AssignmentSubmission.create(lateSubmissionData, mockAssignment);
      expect(submission.isLate).toBe(true);
    });
  });

  describe('grading', () => {
    it('should grade submission correctly', () => {
      const submission = AssignmentSubmission.create(validSubmissionData, mockAssignment);
      const gradingData = {
        pointsAwarded: 85,
        feedback: 'Good work!',
        gradedBy: 'instructor-123'
      };

      const gradedSubmission = submission.grade(gradingData, 100);
      
      expect(gradedSubmission.pointsAwarded).toBe(85);
      expect(gradedSubmission.feedback).toBe('Good work!');
      expect(gradedSubmission.gradingStatus).toBe('graded');
      expect(gradedSubmission.gradedBy).toBe('instructor-123');
    });

    it('should calculate final score with late penalty', () => {
      const lateSubmission = new (AssignmentSubmission as any)(
        'sub-123', 'assignment-123', 'student-123', 'enrollment-123',
        null, null, new Date(), true, 90, null, 'graded', 
        new Date(), 'instructor-123', 1, null, new Date(), new Date()
      );

      const finalScore = lateSubmission.calculateFinalScore(10);
      expect(finalScore).toBe(81); // 90 - (90 * 10 / 100) = 81
    });
  });

  describe('revision workflow', () => {
    it('should request revision correctly', () => {
      const submission = AssignmentSubmission.create(validSubmissionData, mockAssignment);
      const revisedSubmission = submission.requestRevision('Please improve section 2', 'instructor-123');
      
      expect(revisedSubmission.gradingStatus).toBe('revision_requested');
      expect(revisedSubmission.feedback).toBe('Please improve section 2');
      expect(revisedSubmission.pointsAwarded).toBe(null);
    });

    it('should create revision with correct linking', () => {
      const originalSubmission = AssignmentSubmission.create(validSubmissionData, mockAssignment);
      const revisionRequested = originalSubmission.requestRevision('Needs work', 'instructor-123');
      
      const revisionData = {
        ...validSubmissionData,
        file: {
          url: 'https://example.com/revised.pdf',
          name: 'revised.pdf',
          sizeBytes: 2048
        }
      };

      const revision = revisionRequested.createRevision(revisionData, mockAssignment);
      
      expect(revision.parentSubmissionId).toBe(originalSubmission.id);
      expect(revision.revisionNumber).toBe(2);
      expect(revision.isRevision()).toBe(true);
    });
  });
});