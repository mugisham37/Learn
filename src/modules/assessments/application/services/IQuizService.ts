/**
 * Quiz Service Interface
 *
 * Defines the contract for quiz business operations in the application layer.
 * Orchestrates domain entities and infrastructure repositories to implement
 * quiz management use cases.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import { QuizSubmission } from '../../../../infrastructure/database/schema/assessments.schema.js';

import { Question } from '../../domain/entities/Question.js';
import { Quiz } from '../../domain/entities/Quiz.js';

/**
 * Data Transfer Object for creating a new quiz
 */
export interface CreateQuizDTO {
  lessonId: string;
  title: string;
  description?: string;
  quizType: 'formative' | 'summative' | 'practice';
  timeLimitMinutes?: number;
  passingScorePercentage: number;
  maxAttempts?: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showCorrectAnswers?: boolean;
  showExplanations?: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
}

/**
 * Data Transfer Object for creating a new question
 */
export interface CreateQuestionDTO {
  questionType:
    | 'multiple_choice'
    | 'true_false'
    | 'short_answer'
    | 'essay'
    | 'fill_blank'
    | 'matching';
  questionText: string;
  questionMediaUrl?: string;
  options?: unknown; // Type-specific options (e.g., multiple choice options)
  correctAnswer: unknown; // Type-specific correct answer
  explanation?: string;
  points?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Data Transfer Object for starting a quiz attempt
 */
export interface StartAttemptDTO {
  quizId: string;
  studentId: string;
  enrollmentId: string;
}

/**
 * Data Transfer Object for submitting an answer
 */
export interface SubmitAnswerDTO {
  submissionId: string;
  questionId: string;
  answer: unknown; // Type-specific answer format
}

/**
 * Data Transfer Object for submitting a complete quiz
 */
export interface SubmitQuizDTO {
  submissionId: string;
}

/**
 * Data Transfer Object for manual grading
 */
export interface GradeSubmissionDTO {
  submissionId: string;
  gradedBy: string;
  pointsAwarded?: number;
  feedback?: string;
  questionGrades?: Array<{
    questionId: string;
    points: number;
    feedback?: string;
  }>;
}

/**
 * Quiz attempt result with questions
 */
export interface QuizAttemptResult {
  submission: QuizSubmission;
  questions: Question[];
}

/**
 * Grading result for auto-graded questions
 */
export interface GradingResult {
  totalPoints: number;
  earnedPoints: number;
  scorePercentage: number;
  questionResults: Array<{
    questionId: string;
    isCorrect: boolean;
    points: number;
    feedback?: string;
  }>;
}

/**
 * Quiz Service Interface
 *
 * Provides methods for all quiz business operations including creation,
 * question management, attempt handling, and grading workflows.
 */
export interface IQuizService {
  /**
   * Creates a new quiz with validation
   *
   * @param educatorId - ID of the educator creating the quiz
   * @param data - Quiz creation data
   * @returns The created quiz
   * @throws ValidationError if lesson doesn't exist or data is invalid
   * @throws AuthorizationError if educator doesn't own the lesson
   * @throws DatabaseError if database operation fails
   */
  createQuiz(educatorId: string, data: CreateQuizDTO): Promise<Quiz>;

  /**
   * Adds a question to an existing quiz with validation
   *
   * @param educatorId - ID of the educator adding the question
   * @param quizId - ID of the quiz to add question to
   * @param data - Question creation data
   * @returns The created question
   * @throws ValidationError if quiz doesn't exist or question data is invalid
   * @throws AuthorizationError if educator doesn't own the quiz
   * @throws DatabaseError if database operation fails
   */
  addQuestion(educatorId: string, quizId: string, data: CreateQuestionDTO): Promise<Question>;

  /**
   * Starts a new quiz attempt with randomization if configured
   *
   * @param data - Attempt start data
   * @returns Quiz attempt result with questions
   * @throws ValidationError if quiz, student, or enrollment doesn't exist
   * @throws ConflictError if max attempts exceeded or quiz not available
   * @throws DatabaseError if database operation fails
   */
  startAttempt(data: StartAttemptDTO): Promise<QuizAttemptResult>;

  /**
   * Submits an answer for progressive submission
   *
   * @param data - Answer submission data
   * @returns Updated submission
   * @throws ValidationError if submission or question doesn't exist
   * @throws ConflictError if submission already completed
   * @throws DatabaseError if database operation fails
   */
  submitAnswer(data: SubmitAnswerDTO): Promise<QuizSubmission>;

  /**
   * Submits a complete quiz with auto-grading
   *
   * @param data - Quiz submission data
   * @returns Graded submission with results
   * @throws ValidationError if submission doesn't exist
   * @throws ConflictError if submission already completed
   * @throws DatabaseError if database operation fails
   */
  submitQuiz(data: SubmitQuizDTO): Promise<QuizSubmission>;

  /**
   * Manually grades a quiz submission
   *
   * @param data - Grading data
   * @returns Updated submission with grades
   * @throws ValidationError if submission doesn't exist
   * @throws AuthorizationError if grader doesn't have permission
   * @throws ConflictError if submission not in gradable state
   * @throws DatabaseError if database operation fails
   */
  gradeSubmission(data: GradeSubmissionDTO): Promise<QuizSubmission>;

  /**
   * Gets quiz by ID with authorization check
   *
   * @param quizId - Quiz ID
   * @param userId - User requesting the quiz
   * @param userRole - Role of the requesting user
   * @returns Quiz if found and authorized
   * @throws NotFoundError if quiz doesn't exist
   * @throws AuthorizationError if user doesn't have access
   * @throws DatabaseError if database operation fails
   */
  getQuiz(quizId: string, userId: string, userRole: string): Promise<Quiz>;

  /**
   * Gets quiz submission by ID with authorization check
   *
   * @param submissionId - Submission ID
   * @param userId - User requesting the submission
   * @param userRole - Role of the requesting user
   * @returns Submission if found and authorized
   * @throws NotFoundError if submission doesn't exist
   * @throws AuthorizationError if user doesn't have access
   * @throws DatabaseError if database operation fails
   */
  getSubmission(submissionId: string, userId: string, userRole: string): Promise<QuizSubmission>;

  /**
   * Checks if a student can start a new attempt
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns True if student can start attempt, false otherwise
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  canStartAttempt(quizId: string, studentId: string): Promise<boolean>;

  /**
   * Gets student's attempt summary for a quiz
   *
   * @param quizId - Quiz ID
   * @param studentId - Student ID
   * @returns Attempt summary with statistics
   * @throws NotFoundError if quiz doesn't exist
   * @throws DatabaseError if database operation fails
   */
  getAttemptSummary(
    quizId: string,
    studentId: string
  ): Promise<{
    totalAttempts: number;
    bestScore: number | null;
    hasPassingScore: boolean;
    canStartNewAttempt: boolean;
  }>;
}
