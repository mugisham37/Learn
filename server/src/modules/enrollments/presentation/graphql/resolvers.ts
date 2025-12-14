/**
 * GraphQL Resolvers for Enrollments Module
 *
 * Implements GraphQL resolvers for enrollment management, progress tracking,
 * and certificate operations with proper authorization and error handling.
 *
 * Requirements: 21.2, 21.3
 */

import { GraphQLError } from 'graphql';

import { GraphQLContext } from '../../../../infrastructure/graphql/apolloServer.js';
import {
  SUBSCRIPTION_EVENTS,
  createAsyncIterator,
  publishEvent,
  withFilter,
} from '../../../../infrastructure/graphql/pubsub.js';
import { requireAuth } from '../../../../infrastructure/graphql/utils.js';
import { ICourseRepository } from '../../../courses/infrastructure/repositories/ICourseRepository.js';
import { IUserRepository } from '../../../users/infrastructure/repositories/IUserRepository.js';
import {
  IEnrollmentService,
  EnrollStudentDTO,
  UpdateLessonProgressRequestDTO,
  CompleteCourseDTO,
  WithdrawEnrollmentDTO,
} from '../../application/services/IEnrollmentService.js';
import { Certificate } from '../../domain/entities/Certificate.js';
import { Enrollment } from '../../domain/entities/Enrollment.js';
import { LessonProgress } from '../../domain/entities/LessonProgress.js';
import { ICertificateRepository } from '../../infrastructure/repositories/ICertificateRepository.js';
import { IEnrollmentRepository } from '../../infrastructure/repositories/IEnrollmentRepository.js';
import { ILessonProgressRepository } from '../../infrastructure/repositories/ILessonProgressRepository.js';

/**
 * GraphQL context interface for enrollments module
 */
export interface EnrollmentGraphQLContext extends GraphQLContext {
  enrollmentService: IEnrollmentService;
  certificateRepository: ICertificateRepository;
  enrollmentRepository: IEnrollmentRepository;
  lessonProgressRepository: ILessonProgressRepository;
  courseRepository: ICourseRepository;
  userRepository: IUserRepository;
}

/**
 * Input type interfaces matching GraphQL schema
 */
interface EnrollInCourseInput {
  courseId: string;
  paymentInfo?: {
    paymentId: string;
    amount: number;
    currency: string;
  };
}

interface UpdateLessonProgressInput {
  enrollmentId: string;
  lessonId: string;
  progress: {
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    timeSpentSeconds?: number;
    quizScore?: number;
    attemptsCount?: number;
  };
}

interface WithdrawEnrollmentInput {
  enrollmentId: string;
  reason?: string;
}

interface EnrollmentFiltersInput {
  status?: 'ACTIVE' | 'COMPLETED' | 'DROPPED';
  courseId?: string;
  studentId?: string;
}

interface PaginationInput {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}



/**
 * Helper function to check if user is a student
 */
function requireStudent(context: EnrollmentGraphQLContext): {
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
 * Helper function to check if user is an admin
 */
function requireAdmin(context: EnrollmentGraphQLContext): {
  id: string;
  email: string;
  role: string;
} {
  const user = requireAuth(context);
  if (user.role !== 'admin') {
    throw new GraphQLError('Admin role required', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }
  return user;
}

/**
 * Helper function to check enrollment ownership or admin access
 */
async function requireEnrollmentAccess(
  enrollmentId: string,
  context: EnrollmentGraphQLContext,
  allowEducatorAccess = false
): Promise<{ id: string; email: string; role: string }> {
  const user = requireAuth(context);

  try {
    const enrollment = await context.enrollmentRepository.findById(enrollmentId);
    if (!enrollment) {
      throw new GraphQLError('Enrollment not found', {
        extensions: {
          code: 'NOT_FOUND',
          http: { status: 404 },
        },
      });
    }

    // Admin can access any enrollment
    if (user.role === 'admin') {
      return user;
    }

    // Student can access their own enrollment
    if (user.role === 'student' && enrollment.studentId === user.id) {
      return user;
    }

    // Educator can access enrollments for their courses (if allowed)
    if (allowEducatorAccess && user.role === 'educator') {
      const course = await context.courseRepository.findById(enrollment.courseId);
      if (course && course.instructorId === user.id) {
        return user;
      }
    }

    throw new GraphQLError('Insufficient permissions to access this enrollment', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  } catch (error) {
    if (error instanceof GraphQLError) {
      throw error;
    }
    throw new GraphQLError('Failed to verify enrollment access', {
      extensions: {
        code: 'INTERNAL_ERROR',
        http: { status: 500 },
      },
    });
  }
}

/**
 * Helper function to convert domain enrollment status to GraphQL enum
 */
function mapEnrollmentStatusToGraphQL(status: string): 'ACTIVE' | 'COMPLETED' | 'DROPPED' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'completed':
      return 'COMPLETED';
    case 'dropped':
      return 'DROPPED';
    default:
      throw new Error(`Unknown enrollment status: ${status}`);
  }
}

/**
 * Helper function to convert GraphQL enrollment status to domain status
 */
function mapEnrollmentStatusFromGraphQL(
  status: 'ACTIVE' | 'COMPLETED' | 'DROPPED'
): 'active' | 'completed' | 'dropped' {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'COMPLETED':
      return 'completed';
    case 'DROPPED':
      return 'dropped';
    default:
      throw new Error(`Unknown GraphQL enrollment status: ${String(status)}`);
  }
}

/**
 * Helper function to convert domain progress status to GraphQL enum
 */
function mapProgressStatusToGraphQL(status: string): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
  switch (status) {
    case 'not_started':
      return 'NOT_STARTED';
    case 'in_progress':
      return 'IN_PROGRESS';
    case 'completed':
      return 'COMPLETED';
    default:
      throw new Error(`Unknown progress status: ${status}`);
  }
}

/**
 * Helper function to convert GraphQL progress status to domain status
 */
function mapProgressStatusFromGraphQL(
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
): 'not_started' | 'in_progress' | 'completed' {
  switch (status) {
    case 'NOT_STARTED':
      return 'not_started';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'COMPLETED':
      return 'completed';
    default:
      throw new Error(`Unknown GraphQL progress status: ${String(status)}`);
  }
}

/**
 * Helper function to create pagination connection
 */
function createConnection<T>(
  items: T[],
  totalCount: number,
  first?: number,
  after?: string
): {
  edges: Array<{ node: T; cursor: string }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
} {
  const edges = items.map((item, index) => ({
    node: item,
    cursor: Buffer.from(
      `${after ? parseInt(Buffer.from(after, 'base64').toString(), 10) + index + 1 : index}`
    ).toString('base64'),
  }));

  const hasNextPage = first ? items.length === first : false;
  const hasPreviousPage = !!after;

  return {
    edges,
    pageInfo: {
      hasNextPage,
      hasPreviousPage,
      startCursor: edges.length > 0 ? edges[0]?.cursor : undefined,
      endCursor: edges.length > 0 ? edges[edges.length - 1]?.cursor : undefined,
    },
    totalCount,
  };
}

/**
 * GraphQL resolvers for enrollments module
 */
export const enrollmentResolvers = {
  Query: {
    /**
     * Get current user's enrollments
     */
    myEnrollments: async (
      _parent: unknown,
      args: { status?: 'ACTIVE' | 'COMPLETED' | 'DROPPED'; first?: number; after?: string },
      context: EnrollmentGraphQLContext
    ): Promise<{
      edges: Array<{ node: Enrollment; cursor: string }>;
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor?: string;
        endCursor?: string;
      };
      totalCount: number;
    }> => {
      const user = requireStudent(context);

      try {
        const filters = args.status
          ? { status: mapEnrollmentStatusFromGraphQL(args.status) }
          : undefined;
        const enrollments = await context.enrollmentService.getStudentEnrollments(user.id, filters);

        // Apply pagination
        const limit = args.first || 20;
        const offset = args.after ? parseInt(Buffer.from(args.after, 'base64').toString(), 10) : 0;
        const paginatedEnrollments = enrollments.slice(offset, offset + limit);

        return createConnection(paginatedEnrollments, enrollments.length, args.first, args.after);
      } catch (error) {
        throw new GraphQLError('Failed to fetch enrollments', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get enrollment by ID
     */
    enrollment: async (
      _parent: unknown,
      args: { id: string },
      context: EnrollmentGraphQLContext
    ): Promise<Enrollment | null> => {
      await requireEnrollmentAccess(args.id, context, true);

      try {
        const enrollment = await context.enrollmentRepository.findById(args.id);
        if (!enrollment) {
          return null;
        }

        return Enrollment.fromDatabase({
          id: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt || undefined,
          progressPercentage: parseFloat(enrollment.progressPercentage),
          lastAccessedAt: enrollment.lastAccessedAt || undefined,
          paymentId: enrollment.paymentId || undefined,
          certificateId: enrollment.certificateId || undefined,
          status: enrollment.status,
          createdAt: enrollment.createdAt,
          updatedAt: enrollment.updatedAt,
        });
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to fetch enrollment', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get enrollment progress summary
     */
    enrollmentProgress: async (
      _parent: unknown,
      args: { enrollmentId: string },
      context: EnrollmentGraphQLContext
    ): Promise<{
      enrollment: Enrollment;
      totalLessons: number;
      completedLessons: number;
      inProgressLessons: number;
      notStartedLessons: number;
      progressPercentage: number;
      totalTimeSpentSeconds: number;
      averageQuizScore?: number;
      nextRecommendedLesson?: {
        lessonId: string;
        lessonTitle: string;
        moduleTitle: string;
      };
      strugglingAreas: string[];
      estimatedTimeRemaining?: number;
    }> => {
      await requireEnrollmentAccess(args.enrollmentId, context, true);

      try {
        const progressSummary = await context.enrollmentService.getEnrollmentProgress(
          args.enrollmentId
        );
        return progressSummary;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to fetch enrollment progress', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Verify certificate by certificate ID
     */
    verifyCertificate: async (
      _parent: unknown,
      args: { certificateId: string },
      context: EnrollmentGraphQLContext
    ): Promise<Certificate | null> => {
      try {
        const certificate = await context.certificateRepository.findByCertificateId(
          args.certificateId
        );
        if (!certificate) {
          return null;
        }

        return Certificate.fromDatabase({
          id: certificate.id,
          enrollmentId: certificate.enrollmentId,
          certificateId: certificate.certificateId,
          pdfUrl: certificate.pdfUrl,
          issuedAt: certificate.issuedAt,
          verificationUrl: certificate.verificationUrl,
          metadata: certificate.metadata as {
            studentName: string;
            courseTitle: string;
            instructorName: string;
            completionDate: Date;
            grade?: string;
            creditsEarned?: number;
            [key: string]: unknown;
          },
          createdAt: certificate.createdAt,
        });
      } catch (error) {
        throw new GraphQLError('Failed to verify certificate', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get current user's certificates
     */
    myCertificates: async (
      _parent: unknown,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<Certificate[]> => {
      const user = requireStudent(context);

      try {
        const enrollments = await context.enrollmentService.getStudentEnrollments(user.id, {
          status: 'completed',
        });
        const certificates: Certificate[] = [];

        for (const enrollment of enrollments) {
          if (enrollment.certificateId) {
            const certificate = await context.certificateRepository.findById(
              enrollment.certificateId
            );
            if (certificate) {
              certificates.push(
                Certificate.fromDatabase({
                  id: certificate.id,
                  enrollmentId: certificate.enrollmentId,
                  certificateId: certificate.certificateId,
                  pdfUrl: certificate.pdfUrl,
                  issuedAt: certificate.issuedAt,
                  verificationUrl: certificate.verificationUrl,
                  metadata: certificate.metadata as {
                    studentName: string;
                    courseTitle: string;
                    instructorName: string;
                    completionDate: Date;
                    grade?: string;
                    creditsEarned?: number;
                    [key: string]: unknown;
                  },
                  createdAt: certificate.createdAt,
                })
              );
            }
          }
        }

        return certificates;
      } catch (error) {
        throw new GraphQLError('Failed to fetch certificates', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Check enrollment eligibility
     */
    checkEnrollmentEligibility: async (
      _parent: unknown,
      args: { studentId: string; courseId: string },
      context: EnrollmentGraphQLContext
    ): Promise<{
      eligible: boolean;
      reasons: string[];
      requiresPayment: boolean;
      paymentAmount?: number;
      enrollmentLimit?: number;
      currentEnrollments?: number;
    }> => {
      const user = requireAuth(context);

      // Students can only check their own eligibility, admins can check anyone's
      if (user.role === 'student' && user.id !== args.studentId) {
        throw new GraphQLError('Can only check your own enrollment eligibility', {
          extensions: {
            code: 'FORBIDDEN',
            http: { status: 403 },
          },
        });
      }

      try {
        const eligibility = await context.enrollmentService.checkEnrollmentEligibility(
          args.studentId,
          args.courseId
        );
        return eligibility;
      } catch (error) {
        throw new GraphQLError('Failed to check enrollment eligibility', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Check lesson access
     */
    checkLessonAccess: async (
      _parent: unknown,
      args: { enrollmentId: string; lessonId: string },
      context: EnrollmentGraphQLContext
    ): Promise<{
      canAccess: boolean;
      reasons: string[];
      prerequisiteModules?: {
        moduleId: string;
        moduleTitle: string;
        isCompleted: boolean;
      }[];
    }> => {
      await requireEnrollmentAccess(args.enrollmentId, context, true);

      try {
        const accessResult = await context.enrollmentService.checkLessonAccess(
          args.enrollmentId,
          args.lessonId
        );
        return accessResult;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to check lesson access', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get course enrollments (for educators)
     */
    courseEnrollments: async (
      _parent: unknown,
      args: {
        courseId: string;
        filters?: EnrollmentFiltersInput;
        pagination?: PaginationInput;
      },
      context: EnrollmentGraphQLContext
    ): Promise<{
      edges: Array<{ node: Enrollment; cursor: string }>;
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor?: string;
        endCursor?: string;
      };
      totalCount: number;
    }> => {
      const user = requireAuth(context);

      try {
        // Check if user can access course enrollments
        if (user.role === 'educator') {
          const course = await context.courseRepository.findById(args.courseId);
          if (!course || course.instructorId !== user.id) {
            throw new GraphQLError('Can only view enrollments for your own courses', {
              extensions: {
                code: 'FORBIDDEN',
                http: { status: 403 },
              },
            });
          }
        } else if (user.role !== 'admin') {
          throw new GraphQLError('Insufficient permissions to view course enrollments', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        const filters = args.filters
          ? {
              status: args.filters.status
                ? mapEnrollmentStatusFromGraphQL(args.filters.status)
                : undefined,
              studentId: args.filters.studentId,
            }
          : undefined;

        const enrollments = await context.enrollmentService.getCourseEnrollments(
          args.courseId,
          filters
        );

        // Apply pagination
        const limit = args.pagination?.first || 20;
        const offset = args.pagination?.after
          ? parseInt(Buffer.from(args.pagination.after, 'base64').toString(), 10)
          : 0;
        const paginatedEnrollments = enrollments.slice(offset, offset + limit);

        return createConnection(
          paginatedEnrollments,
          enrollments.length,
          args.pagination?.first,
          args.pagination?.after
        );
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to fetch course enrollments', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Get student enrollments (for admins)
     */
    studentEnrollments: async (
      _parent: unknown,
      args: {
        studentId: string;
        filters?: EnrollmentFiltersInput;
        pagination?: PaginationInput;
      },
      context: EnrollmentGraphQLContext
    ): Promise<{
      edges: Array<{ node: Enrollment; cursor: string }>;
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor?: string;
        endCursor?: string;
      };
      totalCount: number;
    }> => {
      requireAdmin(context);

      try {
        const filters = args.filters
          ? {
              status: args.filters.status
                ? mapEnrollmentStatusFromGraphQL(args.filters.status)
                : undefined,
              courseId: args.filters.courseId,
            }
          : undefined;

        const enrollments = await context.enrollmentService.getStudentEnrollments(
          args.studentId,
          filters
        );

        // Apply pagination
        const limit = args.pagination?.first || 20;
        const offset = args.pagination?.after
          ? parseInt(Buffer.from(args.pagination.after, 'base64').toString(), 10)
          : 0;
        const paginatedEnrollments = enrollments.slice(offset, offset + limit);

        return createConnection(
          paginatedEnrollments,
          enrollments.length,
          args.pagination?.first,
          args.pagination?.after
        );
      } catch (error) {
        throw new GraphQLError('Failed to fetch student enrollments', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },
  },

  Mutation: {
    /**
     * Enroll in course
     */
    enrollInCourse: async (
      _parent: unknown,
      args: { input: EnrollInCourseInput },
      context: EnrollmentGraphQLContext
    ): Promise<Enrollment> => {
      const user = requireStudent(context);

      try {
        // Validate input
        if (!args.input.courseId) {
          throw new GraphQLError('Course ID is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        const enrollmentData: EnrollStudentDTO = {
          studentId: user.id,
          courseId: args.input.courseId,
          paymentInfo: args.input.paymentInfo,
        };

        const enrollment = await context.enrollmentService.enrollStudent(enrollmentData);
        return enrollment;
      } catch (error: unknown) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (
          (error as Error).message?.includes('already enrolled') ||
          (error as Error).message?.includes('duplicate')
        ) {
          throw new GraphQLError('Already enrolled in this course', {
            extensions: {
              code: 'CONFLICT',
              http: { status: 409 },
            },
          });
        }

        if (
          (error as Error).message?.includes('limit') ||
          (error as Error).message?.includes('full')
        ) {
          throw new GraphQLError('Course enrollment limit reached', {
            extensions: {
              code: 'CONFLICT',
              http: { status: 409 },
            },
          });
        }

        if ((error as Error).message?.includes('payment')) {
          throw new GraphQLError('Payment processing failed', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        if ((error as Error).message?.includes('not found')) {
          throw new GraphQLError('Course not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if ((error as Error).message?.includes('not published')) {
          throw new GraphQLError('Cannot enroll in unpublished course', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Enrollment failed', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Update lesson progress
     */
    updateLessonProgress: async (
      _parent: unknown,
      args: { input: UpdateLessonProgressInput },
      context: EnrollmentGraphQLContext
    ): Promise<LessonProgress> => {
      const user = requireAuth(context);
      await requireEnrollmentAccess(args.input.enrollmentId, context);

      try {
        // Validate input
        if (!args.input.enrollmentId) {
          throw new GraphQLError('Enrollment ID is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        if (!args.input.lessonId) {
          throw new GraphQLError('Lesson ID is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        const progressData: UpdateLessonProgressRequestDTO = {
          enrollmentId: args.input.enrollmentId,
          lessonId: args.input.lessonId,
          progressUpdate: {
            status: args.input.progress.status
              ? mapProgressStatusFromGraphQL(args.input.progress.status)
              : undefined,
            timeSpentSeconds: args.input.progress.timeSpentSeconds,
            quizScore: args.input.progress.quizScore,
            attemptsCount: args.input.progress.attemptsCount,
          },
        };

        const updatedProgress = await context.enrollmentService.updateLessonProgress(progressData);

        // Publish progress update event
        await publishEvent(SUBSCRIPTION_EVENTS.LESSON_PROGRESS_UPDATED, {
          lessonProgressUpdated: updatedProgress,
          enrollmentId: args.input.enrollmentId,
          studentId: user.id,
        });

        return updatedProgress;
      } catch (error: unknown) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if ((error as Error).message?.includes('not found')) {
          throw new GraphQLError('Enrollment or lesson not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (
          (error as Error).message?.includes('prerequisite') ||
          (error as Error).message?.includes('access')
        ) {
          throw new GraphQLError('Cannot access lesson due to unmet prerequisites', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        if ((error as Error).message?.includes('inactive')) {
          throw new GraphQLError('Cannot update progress for inactive enrollment', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to update lesson progress', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Withdraw enrollment
     */
    withdrawEnrollment: async (
      _parent: unknown,
      args: { input: WithdrawEnrollmentInput },
      context: EnrollmentGraphQLContext
    ): Promise<boolean> => {
      await requireEnrollmentAccess(args.input.enrollmentId, context);

      try {
        // Validate input
        if (!args.input.enrollmentId) {
          throw new GraphQLError('Enrollment ID is required', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        const withdrawalData: WithdrawEnrollmentDTO = {
          enrollmentId: args.input.enrollmentId,
          reason: args.input.reason,
        };

        await context.enrollmentService.withdrawEnrollment(withdrawalData);
        return true;
      } catch (error: unknown) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if ((error as Error).message?.includes('not found')) {
          throw new GraphQLError('Enrollment not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if ((error as Error).message?.includes('completed')) {
          throw new GraphQLError('Cannot withdraw from completed course', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        throw new GraphQLError('Failed to withdraw enrollment', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Complete lesson (convenience mutation)
     */
    completeLesson: async (
      _parent: unknown,
      args: { enrollmentId: string; lessonId: string },
      context: EnrollmentGraphQLContext
    ): Promise<LessonProgress> => {
      const user = requireAuth(context);
      await requireEnrollmentAccess(args.enrollmentId, context);

      try {
        const progressData: UpdateLessonProgressRequestDTO = {
          enrollmentId: args.enrollmentId,
          lessonId: args.lessonId,
          progressUpdate: {
            status: 'completed',
          },
        };

        const updatedProgress = await context.enrollmentService.updateLessonProgress(progressData);

        // Publish progress update event
        await publishEvent(SUBSCRIPTION_EVENTS.LESSON_PROGRESS_UPDATED, {
          lessonProgressUpdated: updatedProgress,
          enrollmentId: args.enrollmentId,
          studentId: user.id,
        });

        return updatedProgress;
      } catch (error: unknown) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        if (
          (error as Error).message?.includes('prerequisite') ||
          (error as Error).message?.includes('access')
        ) {
          throw new GraphQLError('Cannot complete lesson due to unmet prerequisites', {
            extensions: {
              code: 'FORBIDDEN',
              http: { status: 403 },
            },
          });
        }

        throw new GraphQLError('Failed to complete lesson', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Reset lesson progress
     */
    resetLessonProgress: async (
      _parent: unknown,
      args: { enrollmentId: string; lessonId: string },
      context: EnrollmentGraphQLContext
    ): Promise<LessonProgress> => {
      await requireEnrollmentAccess(args.enrollmentId, context);

      try {
        const progressData: UpdateLessonProgressRequestDTO = {
          enrollmentId: args.enrollmentId,
          lessonId: args.lessonId,
          progressUpdate: {
            status: 'not_started',
            timeSpentSeconds: 0,
            quizScore: undefined,
            attemptsCount: 0,
          },
        };

        const updatedProgress = await context.enrollmentService.updateLessonProgress(progressData);
        return updatedProgress;
      } catch (error) {
        throw new GraphQLError('Failed to reset lesson progress', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },

    /**
     * Regenerate certificate
     */
    regenerateCertificate: async (
      _parent: unknown,
      args: { enrollmentId: string },
      context: EnrollmentGraphQLContext
    ): Promise<Certificate> => {
      const user = requireAuth(context);
      await requireEnrollmentAccess(args.enrollmentId, context);

      try {
        // Get enrollment details
        const enrollment = await context.enrollmentRepository.findById(args.enrollmentId);
        if (!enrollment) {
          throw new GraphQLError('Enrollment not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        if (enrollment.status !== 'completed') {
          throw new GraphQLError('Can only regenerate certificate for completed courses', {
            extensions: {
              code: 'BAD_USER_INPUT',
              http: { status: 400 },
            },
          });
        }

        // Get course and student details
        const course = await context.courseRepository.findById(enrollment.courseId);
        const student = await context.userRepository.findById(enrollment.studentId);

        if (!course || !student) {
          throw new GraphQLError('Course or student not found', {
            extensions: {
              code: 'NOT_FOUND',
              http: { status: 404 },
            },
          });
        }

        // Delete existing certificate if it exists
        if (enrollment.certificateId) {
          await context.certificateRepository.delete(enrollment.certificateId);
        }

        // Generate new certificate
        const completeCourseData: CompleteCourseDTO = {
          enrollmentId: args.enrollmentId,
          certificateData: {
            studentName: student.email, // Simplified - would need user profile service
            courseTitle: course.title,
            instructorName: 'Instructor', // Simplified - would need instructor lookup
          },
        };

        const certificate = await context.enrollmentService.completeCourse(completeCourseData);

        // Publish certificate generation event
        await publishEvent(SUBSCRIPTION_EVENTS.CERTIFICATE_GENERATED, {
          certificateGenerated: certificate,
          enrollmentId: args.enrollmentId,
          studentId: user.id,
        });

        return certificate;
      } catch (error: unknown) {
        if (error instanceof GraphQLError) {
          throw error;
        }

        throw new GraphQLError('Failed to regenerate certificate', {
          extensions: {
            code: 'INTERNAL_ERROR',
            http: { status: 500 },
          },
        });
      }
    },
  },

  // Field resolvers
  Enrollment: {
    status: (enrollment: Enrollment): 'ACTIVE' | 'COMPLETED' | 'DROPPED' =>
      mapEnrollmentStatusToGraphQL(enrollment.status),

    student: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<unknown> => {
      try {
        const student = await context.userRepository.findById(enrollment.studentId);
        return student;
      } catch (error) {
        return null;
      }
    },

    course: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<unknown> => {
      try {
        const course = await context.courseRepository.findById(enrollment.courseId);
        return course;
      } catch (error) {
        return null;
      }
    },

    certificate: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<Certificate | null> => {
      if (!enrollment.certificateId) {
        return null;
      }

      try {
        const certificate = await context.certificateRepository.findById(enrollment.certificateId);
        if (!certificate) {
          return null;
        }

        return Certificate.fromDatabase({
          id: certificate.id,
          enrollmentId: certificate.enrollmentId,
          certificateId: certificate.certificateId,
          pdfUrl: certificate.pdfUrl,
          issuedAt: certificate.issuedAt,
          verificationUrl: certificate.verificationUrl,
          metadata: certificate.metadata as {
            studentName: string;
            courseTitle: string;
            instructorName: string;
            completionDate: Date;
            grade?: string;
            creditsEarned?: number;
            [key: string]: unknown;
          },
          createdAt: certificate.createdAt,
        });
      } catch (error) {
        return null;
      }
    },

    lessonProgress: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<LessonProgress[]> => {
      try {
        const progressRecords = await context.lessonProgressRepository.findByEnrollment(
          enrollment.id
        );
        return progressRecords.map((record) =>
          LessonProgress.fromDatabase({
            id: record.id,
            enrollmentId: record.enrollmentId,
            lessonId: record.lessonId,
            status: record.status,
            timeSpentSeconds: record.timeSpentSeconds,
            completedAt: record.completedAt || undefined,
            quizScore: record.quizScore || undefined,
            attemptsCount: record.attemptsCount,
            lastAccessedAt: record.lastAccessedAt || undefined,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          })
        );
      } catch (error) {
        return [];
      }
    },

    completedLessonsCount: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<number> => {
      try {
        const progressSummary = await context.lessonProgressRepository.getProgressSummary(
          enrollment.id
        );
        return progressSummary.completedLessons;
      } catch (error) {
        return 0;
      }
    },

    totalLessonsCount: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<number> => {
      try {
        const progressSummary = await context.lessonProgressRepository.getProgressSummary(
          enrollment.id
        );
        return progressSummary.totalLessons;
      } catch (error) {
        return 0;
      }
    },

    totalTimeSpentSeconds: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<number> => {
      try {
        const progressSummary = await context.lessonProgressRepository.getProgressSummary(
          enrollment.id
        );
        return progressSummary.totalTimeSpentSeconds;
      } catch (error) {
        return 0;
      }
    },

    averageQuizScore: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<number | null> => {
      try {
        const progressSummary = await context.lessonProgressRepository.getProgressSummary(
          enrollment.id
        );
        return progressSummary.averageQuizScore ?? null;
      } catch (error) {
        return null;
      }
    },

    nextLesson: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<LessonProgress | null> => {
      try {
        const nextLessonRecord = await context.lessonProgressRepository.getNextLesson(
          enrollment.id
        );
        if (!nextLessonRecord) {
          return null;
        }

        return LessonProgress.fromDatabase({
          id: nextLessonRecord.id,
          enrollmentId: nextLessonRecord.enrollmentId,
          lessonId: nextLessonRecord.lessonId,
          status: nextLessonRecord.status,
          timeSpentSeconds: nextLessonRecord.timeSpentSeconds,
          completedAt: nextLessonRecord.completedAt || undefined,
          quizScore: nextLessonRecord.quizScore || undefined,
          attemptsCount: nextLessonRecord.attemptsCount,
          lastAccessedAt: nextLessonRecord.lastAccessedAt || undefined,
          createdAt: nextLessonRecord.createdAt,
          updatedAt: nextLessonRecord.updatedAt,
        });
      } catch (error) {
        return null;
      }
    },

    inProgressLessons: async (
      enrollment: Enrollment,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<LessonProgress[]> => {
      try {
        const progressRecords = await context.lessonProgressRepository.findByEnrollment(
          enrollment.id
        );
        const inProgressRecords = progressRecords.filter(
          (record) => record.status === 'in_progress'
        );

        return inProgressRecords.map((record) =>
          LessonProgress.fromDatabase({
            id: record.id,
            enrollmentId: record.enrollmentId,
            lessonId: record.lessonId,
            status: record.status,
            timeSpentSeconds: record.timeSpentSeconds,
            completedAt: record.completedAt || undefined,
            quizScore: record.quizScore || undefined,
            attemptsCount: record.attemptsCount,
            lastAccessedAt: record.lastAccessedAt || undefined,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          })
        );
      } catch (error) {
        return [];
      }
    },
  },

  LessonProgress: {
    status: (progress: LessonProgress): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' =>
      mapProgressStatusToGraphQL(progress.status),

    enrollment: async (
      progress: LessonProgress,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<Enrollment | null> => {
      try {
        const enrollment = await context.enrollmentRepository.findById(progress.enrollmentId);
        if (!enrollment) {
          return null;
        }

        return Enrollment.fromDatabase({
          id: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt || undefined,
          progressPercentage: parseFloat(enrollment.progressPercentage),
          lastAccessedAt: enrollment.lastAccessedAt || undefined,
          paymentId: enrollment.paymentId || undefined,
          certificateId: enrollment.certificateId || undefined,
          status: enrollment.status,
          createdAt: enrollment.createdAt,
          updatedAt: enrollment.updatedAt,
        });
      } catch (error) {
        return null;
      }
    },

    lesson: (
      _progress: LessonProgress,
      _args: unknown,
      _context: EnrollmentGraphQLContext
    ): null => {
      // This would need to be implemented in the lessons repository
      // For now, return null as a placeholder
      return null;
    },

    progressPercentage: (progress: LessonProgress): number => {
      // Calculate progress percentage based on status
      switch (progress.status) {
        case 'not_started':
          return 0;
        case 'in_progress':
          return 50; // Could be more sophisticated based on time spent
        case 'completed':
          return 100;
        default:
          return 0;
      }
    },
  },

  Certificate: {
    enrollment: async (
      certificate: Certificate,
      _args: unknown,
      context: EnrollmentGraphQLContext
    ): Promise<Enrollment | null> => {
      try {
        const enrollment = await context.enrollmentRepository.findById(certificate.enrollmentId);
        if (!enrollment) {
          return null;
        }

        return Enrollment.fromDatabase({
          id: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          enrolledAt: enrollment.enrolledAt,
          completedAt: enrollment.completedAt || undefined,
          progressPercentage: parseFloat(enrollment.progressPercentage),
          lastAccessedAt: enrollment.lastAccessedAt || undefined,
          paymentId: enrollment.paymentId || undefined,
          certificateId: enrollment.certificateId || undefined,
          status: enrollment.status,
          createdAt: enrollment.createdAt,
          updatedAt: enrollment.updatedAt,
        });
      } catch (error) {
        return null;
      }
    },

    studentName: (certificate: Certificate): string => certificate.metadata?.studentName || '',
    courseTitle: (certificate: Certificate): string => certificate.metadata?.courseTitle || '',
    instructorName: (certificate: Certificate): string =>
      certificate.metadata?.instructorName || '',
    completionDate: (certificate: Certificate): Date =>
      certificate.metadata?.completionDate || new Date(),
    grade: (certificate: Certificate): string | null => certificate.metadata?.grade || null,
    creditsEarned: (certificate: Certificate): number | null =>
      certificate.metadata?.creditsEarned || null,

    qrCodeData: (certificate: Certificate): string => {
      // Generate QR code data for verification
      return `${certificate.verificationUrl}?id=${certificate.certificateId}`;
    },

    isReadyForDelivery: (certificate: Certificate): boolean => {
      // Check if certificate is ready for delivery (has PDF URL)
      return !!certificate.pdfUrl;
    },

    isExpired: (_certificate: Certificate): boolean => {
      // Certificates don't expire in this implementation
      return false;
    },
  },

  /**
   * Subscription resolvers for real-time enrollment and progress updates
   */
  Subscription: {
    /**
     * Enrollment progress updated subscription
     */
    enrollmentProgressUpdated: {
      subscribe: withFilter(
        (_parent: unknown, _args: unknown, context?: EnrollmentGraphQLContext) => {
          // Require authentication for subscriptions
          if (!context) {
            throw new GraphQLError('Context is required');
          }
          requireAuth(context);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return createAsyncIterator(SUBSCRIPTION_EVENTS.ENROLLMENT_PROGRESS_UPDATED);
        },
        (payload: unknown, variables: unknown, context?: EnrollmentGraphQLContext): boolean => {
          // Users can only subscribe to their own enrollment progress
          if (!context) {
            return false;
          }
          const user = requireAuth(context);
          const payloadData = payload as { enrollmentId: string; studentId: string };
          const variablesData = variables as { enrollmentId: string };
          return payloadData.enrollmentId === variablesData.enrollmentId && payloadData.studentId === user.id;
        }
      ),
    },

    /**
     * Lesson progress updated subscription
     */
    lessonProgressUpdated: {
      subscribe: withFilter(
        (_parent: unknown, _args: unknown, context?: EnrollmentGraphQLContext) => {
          // Require authentication for subscriptions
          if (!context) {
            throw new GraphQLError('Context is required');
          }
          requireAuth(context);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return createAsyncIterator(SUBSCRIPTION_EVENTS.LESSON_PROGRESS_UPDATED);
        },
        (payload: unknown, variables: unknown, context?: EnrollmentGraphQLContext): boolean => {
          // Users can only subscribe to their own lesson progress
          if (!context) {
            return false;
          }
          const user = requireAuth(context);
          const payloadData = payload as { enrollmentId: string; studentId: string };
          const variablesData = variables as { enrollmentId: string };
          return payloadData.enrollmentId === variablesData.enrollmentId && payloadData.studentId === user.id;
        }
      ),
    },

    /**
     * Certificate generated subscription
     */
    certificateGenerated: {
      subscribe: withFilter(
        (_parent: unknown, _args: unknown, context?: EnrollmentGraphQLContext) => {
          // Require authentication for subscriptions
          if (!context) {
            throw new GraphQLError('Context is required');
          }
          requireAuth(context);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return createAsyncIterator(SUBSCRIPTION_EVENTS.CERTIFICATE_GENERATED);
        },
        (payload: unknown, variables: unknown, context?: EnrollmentGraphQLContext): boolean => {
          // Users can only subscribe to their own certificates
          if (!context) {
            return false;
          }
          const user = requireAuth(context);
          const payloadData = payload as { enrollmentId: string; studentId: string };
          const variablesData = variables as { enrollmentId: string };
          return payloadData.enrollmentId === variablesData.enrollmentId && payloadData.studentId === user.id;
        }
      ),
    },

    /**
     * Course completed subscription
     */
    courseCompleted: {
      subscribe: withFilter(
        (_parent: unknown, _args: unknown, context?: EnrollmentGraphQLContext) => {
          // Require authentication for subscriptions
          if (!context) {
            throw new GraphQLError('Context is required');
          }
          requireAuth(context);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return createAsyncIterator(SUBSCRIPTION_EVENTS.COURSE_COMPLETED);
        },
        (payload: unknown, variables: unknown, context?: EnrollmentGraphQLContext): boolean => {
          // Users can only subscribe to their own course completions
          if (!context) {
            return false;
          }
          const user = requireAuth(context);
          const payloadData = payload as { enrollmentId: string; studentId: string };
          const variablesData = variables as { enrollmentId: string };
          return payloadData.enrollmentId === variablesData.enrollmentId && payloadData.studentId === user.id;
        }
      ),
    },
  },
};
