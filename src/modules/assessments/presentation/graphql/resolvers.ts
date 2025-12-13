/**
 * GraphQL Resolvers for Assessments Module
 *
 * Implements GraphQL resolvers for quiz and assignment creation, management,
 * submission tracking, and grading workflows with proper authorization,
 * validation, and error handling.
 *
 * Requirements: 21.2, 21.3
 */

import { GraphQLError } from 'graphql';

import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
} from '../../../../shared/errors/index.js';
import { IAssignmentService } from '../../application/services/IAssignmentService.js';
import { IQuizService } from '../../application/services/IQuizService.js';
import { IAssignmentRepository } from '../../infrastructure/repositories/IAssignmentRepository.js';
import { IAssignmentSubmissionRepository } from '../../infrastructure/repositories/IAssignmentSubmissionRepository.js';
import { IQuestionRepository } from '../../infrastructure/repositories/IQuestionRepository.js';
import { IQuizRepository } from '../../infrastructure/repositories/IQuizRepository.js';
import { IQuizSubmissionRepository } from '../../infrastructure/repositories/IQuizSubmissionRepository.js';

/**
 * GraphQL context interface
 */
export interface AssessmentGraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  quizService: IQuizService;
  assignmentService: IAssignmentService;
  quizRepository: IQuizRepository;
  questionRepository: IQuestionRepository;
  quizSubmissionRepository: IQuizSubmissionRepository;
  assignmentRepository: IAssignmentRepository;
  assignmentSubmissionRepository: IAssignmentSubmissionRepository;
}

/**
 * Input type interfaces matching GraphQL schema
 */
interface CreateQuizInput {
  lessonId: string;
  title: string;
  description?: string;
  quizType: 'FORMATIVE' | 'SUMMATIVE' | 'PRACTICE';
  config: QuizConfigInput;
}

interface UpdateQuizInput {
  title?: string;
  description?: string;
  config?: QuizConfigInput;
}

interface QuizConfigInput {
  timeLimitMinutes?: number;
  passingScorePercentage: number;
  maxAttempts: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  availableFrom?: string; // DateTime as ISO string
  availableUntil?: string; // DateTime as ISO string
}

interface CreateQuestionInput {
  quizId: string;
  questionType:
    | 'MULTIPLE_CHOICE'
    | 'TRUE_FALSE'
    | 'SHORT_ANSWER'
    | 'ESSAY'
    | 'FILL_BLANK'
    | 'MATCHING';
  questionText: string;
  questionMediaUrl?: string;
  options?: unknown; // JSON
  correctAnswer: unknown; // JSON
  explanation?: string;
  points: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

interface UpdateQuestionInput {
  questionText?: string;
  questionMediaUrl?: string;
  options?: unknown; // JSON
  correctAnswer?: unknown; // JSON
  explanation?: string;
  points?: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

interface SubmitQuizAnswerInput {
  questionId: string;
  answer: unknown; // JSON
}

interface CreateAssignmentInput {
  lessonId: string;
  title: string;
  description?: string;
  instructions: string;
  config: AssignmentConfigInput;
}

interface UpdateAssignmentInput {
  title?: string;
  description?: string;
  instructions?: string;
  config?: AssignmentConfigInput;
}

interface AssignmentConfigInput {
  dueDate: string; // DateTime as ISO string
  lateSubmissionAllowed: boolean;
  latePenaltyPercentage: number;
  maxPoints: number;
  requiresFileUpload: boolean;
  allowedFileTypes: string[];
  maxFileSizeMb: number;
  rubric?: unknown; // JSON
}

interface SubmitAssignmentInput {
  assignmentId: string;
  file?: SubmissionFileInput;
  submissionText?: string;
}

interface SubmissionFileInput {
  url: string;
  name: string;
  sizeBytes: number;
}

interface GradeQuizInput {
  pointsEarned: number;
  feedback?: string;
}

interface GradeAssignmentInput {
  pointsAwarded: number;
  feedback?: string;
}

/**
 * Helper function to require authentication
 */
function requireAuth(context: AssessmentGraphQLContext): {
  id: string;
  email: string;
  role: string;
} {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }
  return context.user;
}

/**
 * Helper function to require educator role
 */
function requireEducator(context: AssessmentGraphQLContext): {
  id: string;
  email: string;
  role: string;
} {
  const user = requireAuth(context);

  if (user.role !== 'educator' && user.role !== 'admin') {
    throw new GraphQLError('Educator role required', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }

  return user;
}

/**
 * Helper function to require student role (for submissions)
 */
function requireStudent(context: AssessmentGraphQLContext): {
  id: string;
  email: string;
  role: string;
} {
  const user = requireAuth(context);

  if (user.role !== 'student') {
    throw new GraphQLError('Student role required', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }

  return user;
}

/**
 * Helper function to convert GraphQL enum to domain enum
 */
function mapQuizTypeFromGraphQL(
  type: 'FORMATIVE' | 'SUMMATIVE' | 'PRACTICE'
): 'formative' | 'summative' | 'practice' {
  switch (type) {
    case 'FORMATIVE':
      return 'formative';
    case 'SUMMATIVE':
      return 'summative';
    case 'PRACTICE':
      return 'practice';
    default:
      throw new Error('Unknown quiz type: ' + type);
  }
}

/**
 * Helper function to convert GraphQL question type to domain type
 */
function mapQuestionTypeFromGraphQL(
  type: string
): 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank' | 'matching' {
  switch (type) {
    case 'MULTIPLE_CHOICE':
      return 'multiple_choice';
    case 'TRUE_FALSE':
      return 'true_false';
    case 'SHORT_ANSWER':
      return 'short_answer';
    case 'ESSAY':
      return 'essay';
    case 'FILL_BLANK':
      return 'fill_blank';
    case 'MATCHING':
      return 'matching';
    default:
      throw new Error('Unknown question type: ' + type);
  }
}

/**
 * Helper function to convert GraphQL difficulty to domain difficulty
 */
function mapDifficultyFromGraphQL(
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
): 'easy' | 'medium' | 'hard' {
  switch (difficulty) {
    case 'EASY':
      return 'easy';
    case 'MEDIUM':
      return 'medium';
    case 'HARD':
      return 'hard';
    default:
      throw new Error('Unknown difficulty: ' + difficulty);
  }
}

/**
 * Helper function to handle service errors and convert to GraphQL errors
 */
function handleServiceError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new GraphQLError(error.message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        http: { status: 400 },
      },
    });
  }

  if (error instanceof AuthenticationError) {
    throw new GraphQLError(error.message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }

  if (error instanceof AuthorizationError) {
    throw new GraphQLError(error.message, {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }

  if (error instanceof NotFoundError) {
    throw new GraphQLError(error.message, {
      extensions: {
        code: 'NOT_FOUND',
        http: { status: 404 },
      },
    });
  }

  if (error instanceof ConflictError) {
    throw new GraphQLError(error.message, {
      extensions: {
        code: 'CONFLICT',
        http: { status: 409 },
      },
    });
  }

  if (error instanceof ExternalServiceError) {
    throw new GraphQLError('External service error', {
      extensions: {
        code: 'SERVICE_UNAVAILABLE',
        http: { status: 503 },
      },
    });
  }

  if (error instanceof DatabaseError) {
    throw new GraphQLError('Database error', {
      extensions: {
        code: 'INTERNAL_ERROR',
        http: { status: 500 },
      },
    });
  }

  // Handle GraphQL errors
  if (error instanceof GraphQLError) {
    throw error;
  }

  // Handle unexpected errors
  throw new GraphQLError('Internal server error', {
    extensions: {
      code: 'INTERNAL_ERROR',
      http: { status: 500 },
    },
  });
}

/**
 * GraphQL resolvers for assessments module
 */
export const assessmentResolvers = {
  Query: {
    /**
     * Get quiz by ID
     */
    quiz: async (
      _parent: unknown,
      args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireAuth(context);

      try {
        const quiz = await context.quizService.getQuiz(args.id, user.id, user.role);
        return quiz;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Get quizzes by lesson ID
     */
    quizzesByLesson: async (
      _parent: unknown,
      args: { lessonId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown[]> => {
      requireAuth(context);

      try {
        const result = await context.quizRepository.findByLesson(args.lessonId, {
          page: 1,
          limit: 100,
        });
        return result.data;
      } catch (error) {
        handleServiceError(error);
        return [];
      }
    },

    /**
     * Get question by ID
     */
    question: async (
      _parent: unknown,
      args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      requireAuth(context);

      try {
        const question = await context.questionRepository.findById(args.id);
        if (!question) {
          throw new NotFoundError('Question', args.id);
        }
        return question;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Get questions by quiz ID
     */
    questionsByQuiz: async (
      _parent: unknown,
      args: { quizId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown[]> => {
      requireAuth(context);

      try {
        const questions = await context.questionRepository.findAllByQuiz(args.quizId);
        return questions;
      } catch (error) {
        handleServiceError(error);
        return [];
      }
    },

    /**
     * Get quiz submission by ID
     */
    quizSubmission: async (
      _parent: unknown,
      args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireAuth(context);

      try {
        const submission = await context.quizService.getSubmission(args.id, user.id, user.role);
        return submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Get quiz submissions by student for a specific quiz
     */
    quizSubmissionsByStudent: async (
      _parent: unknown,
      args: { quizId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown[]> => {
      const user = requireAuth(context);

      try {
        const submissions = await context.quizSubmissionRepository.findAllAttempts(
          args.quizId,
          user.id
        );
        return submissions;
      } catch (error) {
        handleServiceError(error);
        return [];
      }
    },

    /**
     * Get all quiz submissions for a quiz (educator only)
     */
    quizSubmissionsByQuiz: async (
      _parent: unknown,
      args: { quizId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      requireEducator(context);

      try {
        const result = await context.quizSubmissionRepository.findByQuiz(args.quizId, {
          page: 1,
          limit: 100,
        });
        return result.data;
      } catch (error) {
        handleServiceError(error);
        return [];
      }
    },

    /**
     * Get assignment by ID
     */
    assignment: async (
      _parent: unknown,
      args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireAuth(context);

      try {
        const assignment = await context.assignmentService.getAssignment(
          args.id,
          user.id,
          user.role
        );
        return assignment;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Get assignments by lesson ID
     */
    assignmentsByLesson: async (
      _parent: unknown,
      args: { lessonId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown[]> => {
      requireAuth(context);

      try {
        const result = await context.assignmentRepository.findByLesson(args.lessonId, {
          page: 1,
          limit: 100,
        });
        return result.data;
      } catch (error) {
        handleServiceError(error);
        return [];
      }
    },

    /**
     * Get assignment submission by ID
     */
    assignmentSubmission: async (
      _parent: unknown,
      args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireAuth(context);

      try {
        const submission = await context.assignmentService.getSubmission(
          args.id,
          user.id,
          user.role
        );
        return submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Get assignment submissions by student for a specific assignment
     */
    assignmentSubmissionsByStudent: async (
      _parent: unknown,
      args: { assignmentId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown[]> => {
      const user = requireAuth(context);

      try {
        const result = await context.assignmentSubmissionRepository.findByStudent(
          user.id,
          { page: 1, limit: 100 },
          { assignmentId: args.assignmentId }
        );
        return result.data;
      } catch (error) {
        handleServiceError(error);
        return [];
      }
    },

    /**
     * Get all assignment submissions for an assignment (educator only)
     */
    assignmentSubmissionsByAssignment: async (
      _parent: unknown,
      args: { assignmentId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      requireEducator(context);

      try {
        const result = await context.assignmentSubmissionRepository.findByAssignment(
          args.assignmentId,
          { page: 1, limit: 100 }
        );
        return result.data;
      } catch (error) {
        handleServiceError(error);
        return [];
      }
    },
  },

  Mutation: {
    /**
     * Create a new quiz (educator only)
     */
    createQuiz: async (
      _parent: unknown,
      args: { input: CreateQuizInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireEducator(context);

      try {
        const quiz = await context.quizService.createQuiz(user.id, {
          lessonId: args.input.lessonId,
          title: args.input.title,
          description: args.input.description,
          quizType: mapQuizTypeFromGraphQL(args.input.quizType),
          timeLimitMinutes: args.input.config.timeLimitMinutes,
          passingScorePercentage: args.input.config.passingScorePercentage,
          maxAttempts: args.input.config.maxAttempts,
          randomizeQuestions: args.input.config.randomizeQuestions,
          randomizeOptions: args.input.config.randomizeOptions,
          showCorrectAnswers: args.input.config.showCorrectAnswers,
          showExplanations: args.input.config.showExplanations,
          availableFrom: args.input.config.availableFrom
            ? new Date(args.input.config.availableFrom)
            : undefined,
          availableUntil: args.input.config.availableUntil
            ? new Date(args.input.config.availableUntil)
            : undefined,
        });

        return quiz;
      } catch (error) {
        return handleServiceError(error);
      }
    },

    /**
     * Update a quiz (educator only)
     */
    updateQuiz: async (
      _parent: unknown,
      _args: { id: string; input: UpdateQuizInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      requireEducator(context);

      try {
        // TODO: Implement quiz update in service
        throw new GraphQLError('Quiz update not yet implemented', {
          extensions: {
            code: 'NOT_IMPLEMENTED',
            http: { status: 501 },
          },
        });
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Delete a quiz (educator only)
     */
    deleteQuiz: async (
      _parent: unknown,
      _args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<boolean> => {
      requireEducator(context);

      try {
        // TODO: Implement quiz deletion in service
        throw new GraphQLError('Quiz deletion not yet implemented', {
          extensions: {
            code: 'NOT_IMPLEMENTED',
            http: { status: 501 },
          },
        });
      } catch (error) {
        handleServiceError(error);
        return false;
      }
    },

    /**
     * Add a question to a quiz (educator only)
     */
    addQuestion: async (
      _parent: unknown,
      args: { input: CreateQuestionInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireEducator(context);

      try {
        const question = await context.quizService.addQuestion(user.id, args.input.quizId, {
          questionType: mapQuestionTypeFromGraphQL(args.input.questionType),
          questionText: args.input.questionText,
          questionMediaUrl: args.input.questionMediaUrl,
          options: args.input.options,
          correctAnswer: args.input.correctAnswer,
          explanation: args.input.explanation,
          points: args.input.points,
          difficulty: mapDifficultyFromGraphQL(args.input.difficulty),
        });

        return question;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Update a question (educator only)
     */
    updateQuestion: async (
      _parent: unknown,
      _args: { id: string; input: UpdateQuestionInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      requireEducator(context);

      try {
        // TODO: Implement question update in service
        throw new GraphQLError('Question update not yet implemented', {
          extensions: {
            code: 'NOT_IMPLEMENTED',
            http: { status: 501 },
          },
        });
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Delete a question (educator only)
     */
    deleteQuestion: async (
      _parent: unknown,
      _args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<boolean> => {
      requireEducator(context);

      try {
        // TODO: Implement question deletion in service
        throw new GraphQLError('Question deletion not yet implemented', {
          extensions: {
            code: 'NOT_IMPLEMENTED',
            http: { status: 501 },
          },
        });
      } catch (error) {
        handleServiceError(error);
        return false;
      }
    },

    /**
     * Start a quiz attempt (student only)
     */
    startQuizAttempt: async (
      _parent: unknown,
      args: { quizId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireStudent(context);

      try {
        // TODO: Get enrollment ID from context or parameters
        // For now, we'll use a placeholder
        const enrollmentId = 'placeholder-enrollment-id';

        const attemptResult = await context.quizService.startAttempt({
          quizId: args.quizId,
          studentId: user.id,
          enrollmentId,
        });

        return attemptResult.submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Submit an answer for a quiz question (student only)
     */
    submitQuizAnswer: async (
      _parent: unknown,
      args: { submissionId: string; input: SubmitQuizAnswerInput },
      context: AssessmentGraphQLContext
    ): Promise<boolean> => {
      requireStudent(context);

      try {
        await context.quizService.submitAnswer({
          submissionId: args.submissionId,
          questionId: args.input.questionId,
          answer: args.input.answer,
        });

        return true;
      } catch (error) {
        handleServiceError(error);
        return false;
      }
    },

    /**
     * Submit a complete quiz (student only)
     */
    submitQuiz: async (
      _parent: unknown,
      args: { submissionId: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      requireStudent(context);

      try {
        const submission = await context.quizService.submitQuiz({
          submissionId: args.submissionId,
        });

        return submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Grade a quiz submission (educator only)
     */
    gradeQuizSubmission: async (
      _parent: unknown,
      args: { submissionId: string; input: GradeQuizInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireEducator(context);

      try {
        const submission = await context.quizService.gradeSubmission({
          submissionId: args.submissionId,
          gradedBy: user.id,
          pointsAwarded: args.input.pointsEarned,
          feedback: args.input.feedback,
        });

        return submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Create a new assignment (educator only)
     */
    createAssignment: async (
      _parent: unknown,
      args: { input: CreateAssignmentInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireEducator(context);

      try {
        const assignment = await context.assignmentService.createAssignment(user.id, {
          lessonId: args.input.lessonId,
          title: args.input.title,
          description: args.input.description,
          instructions: args.input.instructions,
          dueDate: new Date(args.input.config.dueDate),
          lateSubmissionAllowed: args.input.config.lateSubmissionAllowed,
          latePenaltyPercentage: args.input.config.latePenaltyPercentage,
          maxPoints: args.input.config.maxPoints,
          requiresFileUpload: args.input.config.requiresFileUpload,
          allowedFileTypes: args.input.config.allowedFileTypes,
          maxFileSizeMb: args.input.config.maxFileSizeMb,
          rubric: args.input.config.rubric as Record<string, unknown> | undefined,
        });

        return assignment;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Update an assignment (educator only)
     */
    updateAssignment: async (
      _parent: unknown,
      _args: { id: string; input: UpdateAssignmentInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      requireEducator(context);

      try {
        // TODO: Implement assignment update in service
        throw new GraphQLError('Assignment update not yet implemented', {
          extensions: {
            code: 'NOT_IMPLEMENTED',
            http: { status: 501 },
          },
        });
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Delete an assignment (educator only)
     */
    deleteAssignment: async (
      _parent: unknown,
      _args: { id: string },
      context: AssessmentGraphQLContext
    ): Promise<boolean> => {
      requireEducator(context);

      try {
        // TODO: Implement assignment deletion in service
        throw new GraphQLError('Assignment deletion not yet implemented', {
          extensions: {
            code: 'NOT_IMPLEMENTED',
            http: { status: 501 },
          },
        });
      } catch (error) {
        handleServiceError(error);
        return false;
      }
    },

    /**
     * Submit an assignment (student only)
     */
    submitAssignment: async (
      _parent: unknown,
      args: { input: SubmitAssignmentInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireStudent(context);

      try {
        // TODO: Get enrollment ID from context or parameters
        // For now, we'll use a placeholder
        const enrollmentId = 'placeholder-enrollment-id';

        // TODO: Handle file upload properly
        // For now, we'll handle the case where file info is provided
        let fileData: { buffer: Buffer; fileName: string; contentType: string } | undefined;

        if (args.input.file) {
          // In a real implementation, you would need to handle file upload
          // This is a placeholder - the file would come from a separate upload endpoint
          throw new GraphQLError('File upload handling not yet implemented', {
            extensions: {
              code: 'NOT_IMPLEMENTED',
              http: { status: 501 },
            },
          });
        }

        const result = await context.assignmentService.submitAssignment({
          assignmentId: args.input.assignmentId,
          studentId: user.id,
          enrollmentId,
          file: fileData,
          submissionText: args.input.submissionText,
        });

        return result.submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Grade an assignment submission (educator only)
     */
    gradeAssignment: async (
      _parent: unknown,
      args: { submissionId: string; input: GradeAssignmentInput },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireEducator(context);

      try {
        const submission = await context.assignmentService.gradeAssignment({
          submissionId: args.submissionId,
          gradedBy: user.id,
          pointsAwarded: args.input.pointsAwarded,
          feedback: args.input.feedback,
        });

        return submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },

    /**
     * Request revision for an assignment submission (educator only)
     */
    requestRevision: async (
      _parent: unknown,
      args: { submissionId: string; feedback: string },
      context: AssessmentGraphQLContext
    ): Promise<unknown> => {
      const user = requireEducator(context);

      try {
        const submission = await context.assignmentService.requestRevision({
          submissionId: args.submissionId,
          gradedBy: user.id,
          feedback: args.feedback,
        });

        return submission;
      } catch (error) {
        handleServiceError(error);
        return null;
      }
    },
  },
};
