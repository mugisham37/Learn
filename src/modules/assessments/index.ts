/**
 * Assessments Module
 * 
 * Main entry point for the assessments module.
 * Provides quiz and assignment functionality including creation, management,
 * submission tracking, and grading workflows.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

// Domain layer exports
export * from './domain/entities/Quiz.js';
export * from './domain/entities/Question.js';
export * from './domain/events/QuizEvents.js';

// Application layer exports
export type { 
  IQuizService,
  QuizAttemptResult,
  GradingResult
} from './application/index.js';
export { QuizService } from './application/index.js';

// Infrastructure layer exports
export * from './infrastructure/index.js';

// Presentation layer exports
export * from './presentation/index.js';