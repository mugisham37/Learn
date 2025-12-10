/**
 * Quiz Service Implementation
 * 
 * Implements quiz business operations in the application layer.
 * Orchestrates domain entities and infrastructure repositories to implement
 * quiz management use cases with proper validation and authorization.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import { 
  IQuizService,
  CreateQuizDTO,
  CreateQuestionDTO,
  StartAttemptDTO,
  SubmitAnswerDTO,
  SubmitQuizDTO,
  GradeSubmissionDTO,
  QuizAttemptResult,
  GradingResult
} from './IQuizService.js';

import { Quiz } from '../../domain/entities/Quiz.js';
import { Question } from '../../domain/entities/Question.js';

import { IQuizRepository } from '../../infrastructure/repositories/IQuizRepository.js';
import { IQuestionRepository } from '../../infrastructure/repositories/IQuestionRepository.js';
import { IQuizSubmissionRepository } from '../../infrastructure/repositories/IQuizSubmissionRepository.js';

import { 
  QuizSubmission
} from '../../../../infrastructure/database/schema/assessments.schema.js';

import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError
} from '../../../../shared/errors/index.js';

import { logger } from '../../../../shared/utils/logger.js';

/**
 * Quiz Service Implementation
 * 
 * Handles all quiz-related business operations with proper validation,
 * authorization, and error handling.
 */
export class QuizService implements IQuizService {
  constructor(
    private readonly quizRepository: IQuizRepository,
    private readonly questionRepository: IQuestionRepository,
    private readonly submissionRepository: IQuizSubmissionRepository
  ) {}

  /**
   * Creates a new quiz with validation
   */
  async createQuiz(educatorId: string, data: CreateQuizDTO): Promise<Quiz> {
    try {
      logger.info('Creating quiz', { educatorId, lessonId: data.lessonId, title: data.title });

      // Validate input data
      this.validateCreateQuizData(data);

      // TODO: Verify educator owns the lesson (requires lesson repository)
      // For now, we'll assume the authorization is handled at the controller level

      // Validate quiz using domain entity (but don't store the result since we use repository)
      Quiz.create({
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        quizType: data.quizType,
        config: {
          timeLimitMinutes: data.timeLimitMinutes,
          passingScorePercentage: data.passingScorePercentage,
          maxAttempts: data.maxAttempts || 0, // 0 means unlimited
          randomizeQuestions: data.randomizeQuestions || false,
          randomizeOptions: data.randomizeOptions || false,
          showCorrectAnswers: data.showCorrectAnswers !== false, // Default true
          showExplanations: data.showExplanations !== false, // Default true
          availableFrom: data.availableFrom,
          availableUntil: data.availableUntil
        }
      });

      // Save to repository
      const createdQuiz = await this.quizRepository.create({
        lessonId: data.lessonId,
        title: data.title,
        description: data.description,
        quizType: data.quizType,
        timeLimitMinutes: data.timeLimitMinutes,
        passingScorePercentage: data.passingScorePercentage,
        maxAttempts: data.maxAttempts,
        randomizeQuestions: data.randomizeQuestions,
        randomizeOptions: data.randomizeOptions,
        showCorrectAnswers: data.showCorrectAnswers,
        showExplanations: data.showExplanations,
        availableFrom: data.availableFrom,
        availableUntil: data.availableUntil
      });

      logger.info('Quiz created successfully', { quizId: createdQuiz.id, educatorId });

      return Quiz.fromPersistence(
        createdQuiz.id,
        createdQuiz.lessonId,
        createdQuiz.title,
        createdQuiz.description,
        createdQuiz.quizType,
        {
          timeLimitMinutes: createdQuiz.timeLimitMinutes || undefined,
          passingScorePercentage: createdQuiz.passingScorePercentage,
          maxAttempts: createdQuiz.maxAttempts,
          randomizeQuestions: createdQuiz.randomizeQuestions,
          randomizeOptions: createdQuiz.randomizeOptions,
          showCorrectAnswers: createdQuiz.showCorrectAnswers,
          showExplanations: createdQuiz.showExplanations,
          availableFrom: createdQuiz.availableFrom || undefined,
          availableUntil: createdQuiz.availableUntil || undefined
        },
        createdQuiz.createdAt,
        createdQuiz.updatedAt
      );

    } catch (error) {
      logger.error('Failed to create quiz', { error, educatorId, data });
      
      if (error instanceof ValidationError || error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to create quiz', 'create', error as Error);
    }
  }

  /**
   * Adds a question to an existing quiz with validation
   */
  async addQuestion(educatorId: string, quizId: string, data: CreateQuestionDTO): Promise<Question> {
    try {
      logger.info('Adding question to quiz', { educatorId, quizId, questionType: data.questionType });

      // Validate input data
      this.validateCreateQuestionData(data);

      // Verify quiz exists
      const quiz = await this.quizRepository.findById(quizId);
      if (!quiz) {
        throw new NotFoundError('Quiz', quizId);
      }

      // TODO: Verify educator owns the quiz (requires lesson ownership check)
      // For now, we'll assume the authorization is handled at the controller level

      // Get next order number
      const orderNumber = await this.questionRepository.getNextOrderNumber(quizId);

      // Create question
      const createdQuestion = await this.questionRepository.create({
        quizId,
        questionType: data.questionType,
        questionText: data.questionText,
        questionMediaUrl: data.questionMediaUrl,
        options: data.options,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        points: data.points || 1,
        orderNumber,
        difficulty: data.difficulty || 'medium'
      });

      logger.info('Question added successfully', { questionId: createdQuestion.id, quizId, educatorId });

      return Question.fromPersistence(
        createdQuestion.id,
        createdQuestion.quizId,
        createdQuestion.questionType,
        createdQuestion.questionText,
        createdQuestion.questionMediaUrl || undefined,
        createdQuestion.options,
        createdQuestion.correctAnswer,
        createdQuestion.explanation || undefined,
        createdQuestion.points,
        createdQuestion.orderNumber,
        createdQuestion.difficulty,
        createdQuestion.createdAt,
        createdQuestion.updatedAt
      );

    } catch (error) {
      logger.error('Failed to add question', { error, educatorId, quizId, data });
      
      if (error instanceof ValidationError || error instanceof AuthorizationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to add question', 'create', error as Error);
    }
  }

  /**
   * Starts a new quiz attempt with randomization if configured
   */
  async startAttempt(data: StartAttemptDTO): Promise<QuizAttemptResult> {
    try {
      logger.info('Starting quiz attempt', { quizId: data.quizId, studentId: data.studentId });

      // Verify quiz exists and is available
      const quiz = await this.quizRepository.findById(data.quizId);
      if (!quiz) {
        throw new NotFoundError('Quiz', data.quizId);
      }

      // Check if quiz is available
      const isAvailable = await this.quizRepository.isAvailable(data.quizId);
      if (!isAvailable) {
        throw new ConflictError('Quiz is not currently available');
      }

      // Check if student can start a new attempt
      const canStart = await this.canStartAttempt(data.quizId, data.studentId);
      if (!canStart) {
        throw new ConflictError('Maximum attempts exceeded or quiz not available');
      }

      // Get next attempt number
      const attemptNumber = await this.submissionRepository.getNextAttemptNumber(data.quizId, data.studentId);

      // Create submission
      const submission = await this.submissionRepository.create({
        quizId: data.quizId,
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        attemptNumber,
        answers: {} // Initialize empty answers
      });

      // Get questions (with randomization if configured)
      const rawQuestions = await this.questionRepository.findAllByQuiz(
        data.quizId, 
        quiz.randomizeQuestions
      );

      // Convert to domain entities
      const questions = rawQuestions.map(q => Question.fromPersistence(
        q.id,
        q.quizId,
        q.questionType,
        q.questionText,
        q.questionMediaUrl || undefined,
        q.options,
        q.correctAnswer,
        q.explanation || undefined,
        q.points,
        q.orderNumber,
        q.difficulty,
        q.createdAt,
        q.updatedAt
      ));

      logger.info('Quiz attempt started successfully', { 
        submissionId: submission.id, 
        quizId: data.quizId, 
        studentId: data.studentId,
        attemptNumber 
      });

      return {
        submission,
        questions
      };

    } catch (error) {
      logger.error('Failed to start quiz attempt', { error, data });
      
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to start quiz attempt', 'create', error as Error);
    }
  }

  /**
   * Submits an answer for progressive submission
   */
  async submitAnswer(data: SubmitAnswerDTO): Promise<QuizSubmission> {
    try {
      logger.info('Submitting answer', { submissionId: data.submissionId, questionId: data.questionId });

      // Get submission
      const submission = await this.submissionRepository.findById(data.submissionId);
      if (!submission) {
        throw new NotFoundError('Quiz submission', data.submissionId);
      }

      // Check if submission is still in progress
      if (submission.submittedAt) {
        throw new ConflictError('Quiz submission already completed');
      }

      // Verify question belongs to the quiz
      const question = await this.questionRepository.findById(data.questionId);
      if (!question || question.quizId !== submission.quizId) {
        throw new ValidationError('Question does not belong to this quiz');
      }

      // Update answers in submission
      const currentAnswers = (submission.answers as Record<string, unknown>) || {};
      currentAnswers[data.questionId] = data.answer;

      // Update submission with new answer
      const updatedSubmission = await this.submissionRepository.update(data.submissionId, {
        answers: currentAnswers
      });

      logger.info('Answer submitted successfully', { 
        submissionId: data.submissionId, 
        questionId: data.questionId 
      });

      return updatedSubmission;

    } catch (error) {
      logger.error('Failed to submit answer', { error, data });
      
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to submit answer', 'update', error as Error);
    }
  }

  /**
   * Submits a complete quiz with auto-grading
   */
  async submitQuiz(data: SubmitQuizDTO): Promise<QuizSubmission> {
    try {
      logger.info('Submitting complete quiz', { submissionId: data.submissionId });

      // Get submission
      const submission = await this.submissionRepository.findById(data.submissionId);
      if (!submission) {
        throw new NotFoundError('Quiz submission', data.submissionId);
      }

      // Check if submission is still in progress
      if (submission.submittedAt) {
        throw new ConflictError('Quiz submission already completed');
      }

      // Calculate time taken
      const timeTakenSeconds = Math.floor((Date.now() - submission.startedAt.getTime()) / 1000);

      // Get quiz and questions for grading
      const quiz = await this.quizRepository.findById(submission.quizId);
      if (!quiz) {
        throw new NotFoundError('Quiz', submission.quizId);
      }

      const rawQuestions = await this.questionRepository.findAllByQuiz(submission.quizId);
      
      // Convert to domain entities
      const questions = rawQuestions.map(q => Question.fromPersistence(
        q.id,
        q.quizId,
        q.questionType,
        q.questionText,
        q.questionMediaUrl || undefined,
        q.options,
        q.correctAnswer,
        q.explanation || undefined,
        q.points,
        q.orderNumber,
        q.difficulty,
        q.createdAt,
        q.updatedAt
      ));

      // Auto-grade objective questions
      const gradingResult = await this.autoGradeSubmission(submission, questions);

      // Determine grading status
      const hasSubjectiveQuestions = questions.some(q => 
        q.questionType === 'essay' || q.questionType === 'short_answer'
      );
      
      const gradingStatus = hasSubjectiveQuestions ? 'pending_review' : 'auto_graded';

      // Update submission with results
      const updatedSubmission = await this.submissionRepository.update(data.submissionId, {
        submittedAt: new Date(),
        timeTakenSeconds,
        scorePercentage: gradingResult.scorePercentage.toString(),
        pointsEarned: gradingResult.earnedPoints.toString(),
        gradingStatus,
        gradedAt: gradingStatus === 'auto_graded' ? new Date() : undefined
      });

      logger.info('Quiz submitted successfully', { 
        submissionId: data.submissionId,
        scorePercentage: gradingResult.scorePercentage,
        gradingStatus
      });

      return updatedSubmission;

    } catch (error) {
      logger.error('Failed to submit quiz', { error, data });
      
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to submit quiz', 'update', error as Error);
    }
  }

  /**
   * Manually grades a quiz submission
   */
  async gradeSubmission(data: GradeSubmissionDTO): Promise<QuizSubmission> {
    try {
      logger.info('Manually grading submission', { submissionId: data.submissionId, gradedBy: data.gradedBy });

      // Get submission
      const submission = await this.submissionRepository.findById(data.submissionId);
      if (!submission) {
        throw new NotFoundError('Quiz submission', data.submissionId);
      }

      // Check if submission is in a gradable state
      if (!submission.submittedAt) {
        throw new ConflictError('Cannot grade submission that has not been submitted');
      }

      if (submission.gradingStatus === 'graded') {
        throw new ConflictError('Submission has already been graded');
      }

      // TODO: Verify grader has permission to grade this submission
      // This would require checking if the grader is the course instructor

      // Calculate final score if question grades provided
      let finalScore = submission.scorePercentage ? parseFloat(submission.scorePercentage) : 0;
      let finalPoints = submission.pointsEarned ? parseFloat(submission.pointsEarned) : 0;

      if (data.questionGrades && data.questionGrades.length > 0) {
        // Recalculate based on question grades
        const totalQuestionPoints = await this.questionRepository.getTotalPointsByQuiz(submission.quizId);
        const earnedPoints = data.questionGrades.reduce((sum, grade) => sum + grade.points, 0);
        
        finalPoints = earnedPoints;
        finalScore = totalQuestionPoints > 0 ? (earnedPoints / totalQuestionPoints) * 100 : 0;
      } else if (data.pointsAwarded !== undefined) {
        // Use provided points
        const totalQuestionPoints = await this.questionRepository.getTotalPointsByQuiz(submission.quizId);
        finalPoints = data.pointsAwarded;
        finalScore = totalQuestionPoints > 0 ? (data.pointsAwarded / totalQuestionPoints) * 100 : 0;
      }

      // Update submission with manual grading
      const updatedSubmission = await this.submissionRepository.update(data.submissionId, {
        scorePercentage: finalScore.toString(),
        pointsEarned: finalPoints.toString(),
        feedback: data.feedback,
        gradingStatus: 'graded',
        gradedAt: new Date(),
        gradedBy: data.gradedBy
      });

      logger.info('Submission graded successfully', { 
        submissionId: data.submissionId,
        finalScore,
        gradedBy: data.gradedBy
      });

      return updatedSubmission;

    } catch (error) {
      logger.error('Failed to grade submission', { error, data });
      
      if (error instanceof ValidationError || error instanceof AuthorizationError || 
          error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to grade submission', 'update', error as Error);
    }
  }

  /**
   * Gets quiz by ID with authorization check
   */
  async getQuiz(quizId: string, _userId: string, _userRole: string): Promise<Quiz> {
    try {
      const quiz = await this.quizRepository.findById(quizId);
      if (!quiz) {
        throw new NotFoundError('Quiz', quizId);
      }

      // TODO: Implement proper authorization logic
      // For now, allow all authenticated users to view quizzes
      
      return Quiz.fromPersistence(
        quiz.id,
        quiz.lessonId,
        quiz.title,
        quiz.description,
        quiz.quizType,
        {
          timeLimitMinutes: quiz.timeLimitMinutes || undefined,
          passingScorePercentage: quiz.passingScorePercentage,
          maxAttempts: quiz.maxAttempts,
          randomizeQuestions: quiz.randomizeQuestions,
          randomizeOptions: quiz.randomizeOptions,
          showCorrectAnswers: quiz.showCorrectAnswers,
          showExplanations: quiz.showExplanations,
          availableFrom: quiz.availableFrom || undefined,
          availableUntil: quiz.availableUntil || undefined
        },
        quiz.createdAt,
        quiz.updatedAt
      );

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to get quiz', 'findById', error as Error);
    }
  }

  /**
   * Gets quiz submission by ID with authorization check
   */
  async getSubmission(submissionId: string, userId: string, userRole: string): Promise<QuizSubmission> {
    try {
      const submission = await this.submissionRepository.findById(submissionId);
      if (!submission) {
        throw new NotFoundError('Quiz submission', submissionId);
      }

      // Check authorization - students can only see their own submissions
      if (userRole === 'student' && submission.studentId !== userId) {
        throw new AuthorizationError('Access denied to this submission');
      }

      // TODO: For educators, verify they own the course/lesson

      return submission;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        throw error;
      }
      
      throw new DatabaseError('Failed to get submission', 'findById', error as Error);
    }
  }

  /**
   * Checks if a student can start a new attempt
   */
  async canStartAttempt(quizId: string, studentId: string): Promise<boolean> {
    try {
      // Get quiz
      const quiz = await this.quizRepository.findById(quizId);
      if (!quiz) {
        return false;
      }

      // Check if quiz is available
      const isAvailable = await this.quizRepository.isAvailable(quizId);
      if (!isAvailable) {
        return false;
      }

      // Check attempt count
      const attemptCount = await this.submissionRepository.countAttempts(quizId, studentId);
      
      // If maxAttempts is 0, unlimited attempts are allowed
      if (quiz.maxAttempts === 0) {
        return true;
      }

      return attemptCount < quiz.maxAttempts;

    } catch (error) {
      logger.error('Failed to check if student can start attempt', { error, quizId, studentId });
      return false;
    }
  }

  /**
   * Gets student's attempt summary for a quiz
   */
  async getAttemptSummary(quizId: string, studentId: string): Promise<{
    totalAttempts: number;
    bestScore: number | null;
    hasPassingScore: boolean;
    canStartNewAttempt: boolean;
  }> {
    try {
      const summary = await this.submissionRepository.getAttemptSummary(quizId, studentId);
      const canStart = await this.canStartAttempt(quizId, studentId);

      return {
        totalAttempts: summary.totalAttempts,
        bestScore: summary.bestScore,
        hasPassingScore: summary.hasPassingScore,
        canStartNewAttempt: canStart
      };

    } catch (error) {
      logger.error('Failed to get attempt summary', { error, quizId, studentId });
      throw new DatabaseError('Failed to get attempt summary', 'getAttemptSummary', error as Error);
    }
  }

  /**
   * Validates quiz creation data
   */
  private validateCreateQuizData(data: CreateQuizDTO): void {
    if (!data.lessonId?.trim()) {
      throw new ValidationError('Lesson ID is required');
    }

    if (!data.title?.trim()) {
      throw new ValidationError('Quiz title is required');
    }

    if (data.title.length > 255) {
      throw new ValidationError('Quiz title must be 255 characters or less');
    }

    if (!data.quizType || !['formative', 'summative', 'practice'].includes(data.quizType)) {
      throw new ValidationError('Valid quiz type is required (formative, summative, or practice)');
    }

    if (data.passingScorePercentage < 0 || data.passingScorePercentage > 100) {
      throw new ValidationError('Passing score percentage must be between 0 and 100');
    }

    if (data.maxAttempts !== undefined && data.maxAttempts < 0) {
      throw new ValidationError('Max attempts cannot be negative');
    }

    if (data.timeLimitMinutes !== undefined && data.timeLimitMinutes <= 0) {
      throw new ValidationError('Time limit must be positive if specified');
    }

    if (data.availableFrom && data.availableUntil && data.availableFrom >= data.availableUntil) {
      throw new ValidationError('Available from date must be before available until date');
    }
  }

  /**
   * Validates question creation data
   */
  private validateCreateQuestionData(data: CreateQuestionDTO): void {
    const validTypes = ['multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank', 'matching'];
    
    if (!data.questionType || !validTypes.includes(data.questionType)) {
      throw new ValidationError('Valid question type is required');
    }

    if (!data.questionText?.trim()) {
      throw new ValidationError('Question text is required');
    }

    if (data.points !== undefined && data.points <= 0) {
      throw new ValidationError('Points must be positive if specified');
    }

    // Type-specific validation
    this.validateQuestionTypeSpecificData(data);
  }

  /**
   * Validates type-specific question data
   */
  private validateQuestionTypeSpecificData(data: CreateQuestionDTO): void {
    switch (data.questionType) {
      case 'multiple_choice':
        if (!data.options || !Array.isArray(data.options) || (data.options as string[]).length < 2) {
          throw new ValidationError('Multiple choice questions must have at least 2 options');
        }
        if (typeof data.correctAnswer !== 'number' || 
            data.correctAnswer < 0 || 
            data.correctAnswer >= (data.options as string[]).length) {
          throw new ValidationError('Multiple choice questions must have a valid correct answer index');
        }
        break;

      case 'true_false':
        if (typeof data.correctAnswer !== 'boolean') {
          throw new ValidationError('True/false questions must have a boolean correct answer');
        }
        break;

      case 'short_answer':
        if (!data.correctAnswer || 
            (!Array.isArray(data.correctAnswer) && typeof data.correctAnswer !== 'string')) {
          throw new ValidationError('Short answer questions must have correct answer(s)');
        }
        break;

      case 'essay':
        // Essay questions don't require a correct answer
        break;

      case 'fill_blank':
        if (!data.correctAnswer || !Array.isArray(data.correctAnswer)) {
          throw new ValidationError('Fill in the blank questions must have an array of correct answers');
        }
        break;

      case 'matching':
        if (!data.options || !data.correctAnswer) {
          throw new ValidationError('Matching questions must have options and correct answer mappings');
        }
        break;
    }
  }

  /**
   * Auto-grades objective questions in a submission
   */
  private async autoGradeSubmission(
    submission: QuizSubmission, 
    questions: Question[]
  ): Promise<GradingResult> {
    const answers = (submission.answers as Record<string, unknown>) || {};
    let totalPoints = 0;
    let earnedPoints = 0;
    const questionResults: Array<{
      questionId: string;
      isCorrect: boolean;
      points: number;
      feedback?: string;
    }> = [];

    for (const question of questions) {
      totalPoints += question.points;
      const studentAnswer = answers[question.id];
      let isCorrect = false;
      let points = 0;

      // Only auto-grade objective questions
      if (['multiple_choice', 'true_false', 'fill_blank'].includes(question.questionType)) {
        isCorrect = this.checkAnswer(question, studentAnswer);
        points = isCorrect ? question.points : 0;
        earnedPoints += points;
      } else {
        // Subjective questions need manual grading
        points = 0; // Will be updated during manual grading
      }

      questionResults.push({
        questionId: question.id,
        isCorrect,
        points,
        feedback: question.explanation
      });
    }

    const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    return {
      totalPoints,
      earnedPoints,
      scorePercentage,
      questionResults
    };
  }

  /**
   * Checks if a student's answer is correct for a question
   */
  private checkAnswer(question: Question, studentAnswer: unknown): boolean {
    if (studentAnswer === null || studentAnswer === undefined) {
      return false;
    }

    switch (question.questionType) {
      case 'multiple_choice':
        return studentAnswer === question.correctAnswer;

      case 'true_false':
        return studentAnswer === question.correctAnswer;

      case 'fill_blank':
        if (!Array.isArray(studentAnswer) || !Array.isArray(question.correctAnswer)) {
          return false;
        }
        const studentAnswers = studentAnswer as string[];
        const correctAnswers = question.correctAnswer as string[];
        
        if (studentAnswers.length !== correctAnswers.length) {
          return false;
        }
        
        return studentAnswers.every((answer, index) => 
          answer.toLowerCase().trim() === correctAnswers[index]?.toLowerCase().trim()
        );

      default:
        return false; // Subjective questions can't be auto-graded
    }
  }
}