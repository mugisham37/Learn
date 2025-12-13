/**
 * Assessments Infrastructure Repositories
 *
 * Exports all repository interfaces and implementations for the assessments module.
 * Provides data access layer for quizzes, questions, quiz submissions, assignments, and assignment submissions.
 *
 * Requirements: 6.1, 6.2, 6.3, 7.1, 7.2
 */

// Quiz Repository
export type { IQuizRepository } from './IQuizRepository.js';
export { QuizRepository } from './QuizRepository.js';
export type {
  CreateQuizDTO,
  UpdateQuizDTO,
  QuizFilters,
  QuizWithQuestions,
} from './IQuizRepository.js';

// Question Repository
export type { IQuestionRepository } from './IQuestionRepository.js';
export { QuestionRepository } from './QuestionRepository.js';
export type {
  CreateQuestionDTO,
  UpdateQuestionDTO,
  QuestionFilters,
} from './IQuestionRepository.js';

// Quiz Submission Repository
export type { IQuizSubmissionRepository } from './IQuizSubmissionRepository.js';
export { QuizSubmissionRepository } from './QuizSubmissionRepository.js';
export type {
  CreateQuizSubmissionDTO,
  UpdateQuizSubmissionDTO,
  QuizSubmissionFilters,
  QuizSubmissionWithDetails,
  StudentAttemptSummary,
} from './IQuizSubmissionRepository.js';

// Assignment Repository
export type { IAssignmentRepository } from './IAssignmentRepository.js';
export { AssignmentRepository } from './AssignmentRepository.js';
export type {
  CreateAssignmentDTO,
  UpdateAssignmentDTO,
  AssignmentFilters,
} from './IAssignmentRepository.js';

// Assignment Submission Repository
export type { IAssignmentSubmissionRepository } from './IAssignmentSubmissionRepository.js';
export { AssignmentSubmissionRepository } from './AssignmentSubmissionRepository.js';
export type {
  CreateAssignmentSubmissionDTO,
  UpdateAssignmentSubmissionDTO,
  AssignmentSubmissionFilters,
  AssignmentSubmissionWithRevisions,
  StudentSubmissionSummary,
} from './IAssignmentSubmissionRepository.js';

// Common types
export type { PaginationParams, PaginatedResult } from './IQuizRepository.js';
