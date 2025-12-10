/**
 * Assessments Infrastructure Repositories
 * 
 * Exports all repository interfaces and implementations for the assessments module.
 * Provides data access layer for quizzes, questions, and quiz submissions.
 * 
 * Requirements: 6.1, 6.2, 6.3
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

// Common types
export type {
  PaginationParams,
  PaginatedResult,
} from './IQuizRepository.js';