/**
 * Assessment Application Services
 *
 * Exports all application layer services for the assessments module.
 * These services implement business logic and orchestrate domain entities
 * with infrastructure repositories.
 */

// Quiz Service
export type { IQuizService } from './IQuizService.js';
export { QuizService } from './QuizService.js';

// Assignment Service
export type { IAssignmentService } from './IAssignmentService.js';
export { AssignmentService } from './AssignmentService.js';

// Export DTOs for external use
export type {
  CreateQuizDTO,
  CreateQuestionDTO,
  StartAttemptDTO,
  SubmitAnswerDTO,
  SubmitQuizDTO,
  GradeSubmissionDTO,
  QuizAttemptResult,
  GradingResult,
} from './IQuizService.js';

export type {
  CreateAssignmentDTO,
  SubmitAssignmentDTO,
  GradeAssignmentDTO,
  RequestRevisionDTO,
  AssignmentSubmissionResult,
  StudentAssignmentSummary,
} from './IAssignmentService.js';
