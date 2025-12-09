/**
 * Assessments Schema Tests
 * 
 * Tests to verify the assessments schema definitions are correctly structured
 */

import { describe, it, expect } from 'vitest';
import {
  quizzes,
  questions,
  quizSubmissions,
  assignments,
  assignmentSubmissions,
  quizTypeEnum,
  questionTypeEnum,
  questionDifficultyEnum,
  gradingStatusEnum,
  assignmentGradingStatusEnum,
  type Quiz,
  type NewQuiz,
  type Question,
  type NewQuestion,
  type QuizSubmission,
  type NewQuizSubmission,
  type Assignment,
  type NewAssignment,
  type AssignmentSubmission,
  type NewAssignmentSubmission,
} from './assessments.schema';

describe('Assessments Schema', () => {
  describe('Table Definitions', () => {
    it('should export quizzes table', () => {
      expect(quizzes).toBeDefined();
      expect(typeof quizzes).toBe('object');
    });

    it('should export questions table', () => {
      expect(questions).toBeDefined();
      expect(typeof questions).toBe('object');
    });

    it('should export quizSubmissions table', () => {
      expect(quizSubmissions).toBeDefined();
      expect(typeof quizSubmissions).toBe('object');
    });

    it('should export assignments table', () => {
      expect(assignments).toBeDefined();
      expect(typeof assignments).toBe('object');
    });

    it('should export assignmentSubmissions table', () => {
      expect(assignmentSubmissions).toBeDefined();
      expect(typeof assignmentSubmissions).toBe('object');
    });
  });

  describe('Enum Definitions', () => {
    it('should export quizTypeEnum', () => {
      expect(quizTypeEnum).toBeDefined();
      expect(quizTypeEnum.enumName).toBe('quiz_type');
    });

    it('should export questionTypeEnum', () => {
      expect(questionTypeEnum).toBeDefined();
      expect(questionTypeEnum.enumName).toBe('question_type');
    });

    it('should export questionDifficultyEnum', () => {
      expect(questionDifficultyEnum).toBeDefined();
      expect(questionDifficultyEnum.enumName).toBe('question_difficulty');
    });

    it('should export gradingStatusEnum', () => {
      expect(gradingStatusEnum).toBeDefined();
      expect(gradingStatusEnum.enumName).toBe('grading_status');
    });

    it('should export assignmentGradingStatusEnum', () => {
      expect(assignmentGradingStatusEnum).toBeDefined();
      expect(assignmentGradingStatusEnum.enumName).toBe('assignment_grading_status');
    });
  });

  describe('Type Exports', () => {
    it('should export Quiz and NewQuiz types', () => {
      // Type check - these will fail at compile time if types don't exist
      const quiz: Quiz = {} as Quiz;
      const newQuiz: NewQuiz = {} as NewQuiz;
      
      expect(quiz).toBeDefined();
      expect(newQuiz).toBeDefined();
    });

    it('should export Question and NewQuestion types', () => {
      const question: Question = {} as Question;
      const newQuestion: NewQuestion = {} as NewQuestion;
      
      expect(question).toBeDefined();
      expect(newQuestion).toBeDefined();
    });

    it('should export QuizSubmission and NewQuizSubmission types', () => {
      const submission: QuizSubmission = {} as QuizSubmission;
      const newSubmission: NewQuizSubmission = {} as NewQuizSubmission;
      
      expect(submission).toBeDefined();
      expect(newSubmission).toBeDefined();
    });

    it('should export Assignment and NewAssignment types', () => {
      const assignment: Assignment = {} as Assignment;
      const newAssignment: NewAssignment = {} as NewAssignment;
      
      expect(assignment).toBeDefined();
      expect(newAssignment).toBeDefined();
    });

    it('should export AssignmentSubmission and NewAssignmentSubmission types', () => {
      const submission: AssignmentSubmission = {} as AssignmentSubmission;
      const newSubmission: NewAssignmentSubmission = {} as NewAssignmentSubmission;
      
      expect(submission).toBeDefined();
      expect(newSubmission).toBeDefined();
    });
  });

  describe('Schema Structure', () => {
    it('should have correct quiz table columns', () => {
      const columns = Object.keys(quizzes);
      
      expect(columns).toContain('id');
      expect(columns).toContain('lessonId');
      expect(columns).toContain('title');
      expect(columns).toContain('description');
      expect(columns).toContain('quizType');
      expect(columns).toContain('timeLimitMinutes');
      expect(columns).toContain('passingScorePercentage');
      expect(columns).toContain('maxAttempts');
      expect(columns).toContain('randomizeQuestions');
      expect(columns).toContain('randomizeOptions');
      expect(columns).toContain('availableFrom');
      expect(columns).toContain('availableUntil');
    });

    it('should have correct question table columns', () => {
      const columns = Object.keys(questions);
      
      expect(columns).toContain('id');
      expect(columns).toContain('quizId');
      expect(columns).toContain('questionType');
      expect(columns).toContain('questionText');
      expect(columns).toContain('questionMediaUrl');
      expect(columns).toContain('options');
      expect(columns).toContain('correctAnswer');
      expect(columns).toContain('explanation');
      expect(columns).toContain('points');
      expect(columns).toContain('orderNumber');
      expect(columns).toContain('difficulty');
    });

    it('should have correct quiz submission table columns', () => {
      const columns = Object.keys(quizSubmissions);
      
      expect(columns).toContain('id');
      expect(columns).toContain('quizId');
      expect(columns).toContain('studentId');
      expect(columns).toContain('enrollmentId');
      expect(columns).toContain('attemptNumber');
      expect(columns).toContain('startedAt');
      expect(columns).toContain('submittedAt');
      expect(columns).toContain('timeTakenSeconds');
      expect(columns).toContain('scorePercentage');
      expect(columns).toContain('pointsEarned');
      expect(columns).toContain('answers');
      expect(columns).toContain('gradingStatus');
      expect(columns).toContain('feedback');
      expect(columns).toContain('gradedBy');
    });

    it('should have correct assignment table columns', () => {
      const columns = Object.keys(assignments);
      
      expect(columns).toContain('id');
      expect(columns).toContain('lessonId');
      expect(columns).toContain('title');
      expect(columns).toContain('description');
      expect(columns).toContain('instructions');
      expect(columns).toContain('dueDate');
      expect(columns).toContain('lateSubmissionAllowed');
      expect(columns).toContain('latePenaltyPercentage');
      expect(columns).toContain('maxPoints');
      expect(columns).toContain('allowedFileTypes');
      expect(columns).toContain('rubric');
    });

    it('should have correct assignment submission table columns', () => {
      const columns = Object.keys(assignmentSubmissions);
      
      expect(columns).toContain('id');
      expect(columns).toContain('assignmentId');
      expect(columns).toContain('studentId');
      expect(columns).toContain('enrollmentId');
      expect(columns).toContain('fileUrl');
      expect(columns).toContain('fileName');
      expect(columns).toContain('fileSizeBytes');
      expect(columns).toContain('submissionText');
      expect(columns).toContain('submittedAt');
      expect(columns).toContain('isLate');
      expect(columns).toContain('pointsAwarded');
      expect(columns).toContain('feedback');
      expect(columns).toContain('gradingStatus');
      expect(columns).toContain('gradedBy');
      expect(columns).toContain('revisionNumber');
      expect(columns).toContain('parentSubmissionId');
    });
  });
});
