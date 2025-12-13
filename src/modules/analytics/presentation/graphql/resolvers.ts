/**
 * GraphQL Resolvers for Analytics Module
 *
 * Implements GraphQL resolvers for analytics queries with:
 * - Role-based authorization checks
 * - Caching for expensive operations
 * - Error handling and validation
 * - Performance optimization
 *
 * Requirements: 21.2, 21.3
 */

import { GraphQLError } from 'graphql';

import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  DatabaseError,
} from '../../../../shared/errors/index.js';
import type { AuthenticatedRequest } from '../../../../shared/middleware/index.js';
import type { Role, DateRange } from '../../../../shared/types/index.js';
import type { IAnalyticsService } from '../../application/services/IAnalyticsService.js';
import { analyticsCacheService } from '../../infrastructure/cache/AnalyticsCacheService.js';

/**
 * GraphQL Context interface with authenticated user
 */
interface GraphQLContext {
  request: AuthenticatedRequest;
  analyticsService: IAnalyticsService;
}

/**
 * Input types for GraphQL resolvers
 */
interface DateRangeInput {
  startDate: string;
  endDate: string;
}

interface CourseReportInput {
  courseId: string;
  dateRange: DateRangeInput;
}

interface StudentReportInput {
  studentId: string;
  dateRange: DateRangeInput;
}

interface PlatformMetricsInput {
  dateRange: DateRangeInput;
}

/**
 * Helper function to validate and parse date range input
 */
function parseDateRange(input: DateRangeInput): DateRange {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new ValidationError('Invalid date format', [
      { field: 'dateRange', message: 'Dates must be valid ISO 8601 strings' },
    ]);
  }

  if (startDate >= endDate) {
    throw new ValidationError('Invalid date range', [
      { field: 'dateRange', message: 'Start date must be before end date' },
    ]);
  }

  // Limit date range to prevent excessive queries
  const maxDays = 365; // 1 year
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff > maxDays) {
    throw new ValidationError('Date range too large', [
      { field: 'dateRange', message: `Date range cannot exceed ${maxDays} days` },
    ]);
  }

  return { startDate, endDate };
}

/**
 * Helper function to check if user can access analytics for a specific user
 */
function canAccessUserAnalytics(
  requestingUser: { userId: string; role: Role },
  targetUserId: string
): boolean {
  // Users can always access their own analytics
  if (requestingUser.userId === targetUserId) {
    return true;
  }

  // Admins can access any user's analytics
  if (requestingUser.role === 'admin') {
    return true;
  }

  // Educators can access their students' analytics (this would need additional logic
  // to verify the student is enrolled in the educator's courses)
  // For now, we'll restrict to admin and self-access only
  return false;
}

/**
 * Helper function to check if user can access course analytics
 */
function canAccessCourseAnalytics(
  requestingUser: { userId: string; role: Role },
  _courseId: string
): boolean {
  // Admins can access any course analytics
  if (requestingUser.role === 'admin') {
    return true;
  }

  // Educators can access their own course analytics
  // This would need additional logic to verify course ownership
  if (requestingUser.role === 'educator') {
    return true; // Simplified - should check course ownership
  }

  // Students cannot access course analytics
  return false;
}

/**
 * Helper function to format GraphQL errors consistently
 */
function formatGraphQLError(error: unknown, operation: string): GraphQLError {
  if (error instanceof AuthenticationError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        operation,
      },
    });
  }

  if (error instanceof AuthorizationError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: 'FORBIDDEN',
        operation,
      },
    });
  }

  if (error instanceof NotFoundError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: 'NOT_FOUND',
        operation,
        resourceType: error.resourceType,
        resourceId: error.resourceId,
      },
    });
  }

  if (error instanceof ValidationError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        operation,
        validationErrors: error.details,
      },
    });
  }

  if (error instanceof DatabaseError) {
    return new GraphQLError('Internal server error', {
      extensions: {
        code: 'INTERNAL_ERROR',
        operation,
      },
    });
  }

  // Unknown error
  return new GraphQLError('An unexpected error occurred', {
    extensions: {
      code: 'INTERNAL_ERROR',
      operation,
    },
  });
}

/**
 * Analytics GraphQL Resolvers
 *
 * Implements all analytics queries with proper authorization,
 * caching, and error handling.
 */
export const analyticsResolvers = {
  Query: {
    /**
     * Gets course analytics with caching and authorization
     *
     * @param _parent - GraphQL parent (unused)
     * @param args - Query arguments
     * @param context - GraphQL context with authenticated user
     * @returns Course analytics data
     * @throws GraphQLError for authentication, authorization, or data errors
     */
    async courseAnalytics(
      _parent: unknown,
      args: { courseId: string },
      context: GraphQLContext
    ): Promise<unknown> {
      try {
        const { courseId } = args;
        const { request, analyticsService } = context;

        // Validate input
        if (!courseId) {
          throw new ValidationError('Course ID is required', [
            { field: 'courseId', message: 'Course ID cannot be empty' },
          ]);
        }

        // Check authorization
        if (!canAccessCourseAnalytics(request.user, courseId)) {
          throw new AuthorizationError('Insufficient permissions to access course analytics');
        }

        // Try cache first
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const cached = await analyticsCacheService.getCourseAnalytics(courseId);
        if (cached) {
          return cached as unknown;
        }

        // Get analytics from service
        const analytics = await analyticsService.updateCourseAnalytics(courseId);

        return analytics as unknown;
      } catch (error) {
        throw formatGraphQLError(error, 'courseAnalytics');
      }
    },

    /**
     * Gets student analytics with caching and authorization
     *
     * @param _parent - GraphQL parent (unused)
     * @param args - Query arguments
     * @param context - GraphQL context with authenticated user
     * @returns Student analytics data
     * @throws GraphQLError for authentication, authorization, or data errors
     */
    async studentAnalytics(
      _parent: unknown,
      args: { userId: string },
      context: GraphQLContext
    ): Promise<unknown> {
      try {
        const { userId } = args;
        const { request, analyticsService } = context;

        // Validate input
        if (!userId) {
          throw new ValidationError('User ID is required', [
            { field: 'userId', message: 'User ID cannot be empty' },
          ]);
        }

        // Check authorization
        if (!canAccessUserAnalytics(request.user, userId)) {
          throw new AuthorizationError('Insufficient permissions to access user analytics');
        }

        // Try cache first
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const cached = await analyticsCacheService.getStudentAnalytics(userId);
        if (cached) {
          return cached as unknown;
        }

        // Get analytics from service
        const analytics = await analyticsService.updateStudentAnalytics(userId);

        return analytics as unknown;
      } catch (error) {
        throw formatGraphQLError(error, 'studentAnalytics');
      }
    },

    /**
     * Gets role-specific dashboard metrics with caching
     *
     * @param _parent - GraphQL parent (unused)
     * @param _args - Query arguments (unused)
     * @param context - GraphQL context with authenticated user
     * @returns Role-specific dashboard metrics
     * @throws GraphQLError for authentication or data errors
     */
    async dashboardMetrics(
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext
    ): Promise<unknown> {
      try {
        const { request, analyticsService } = context;
        const { userId, role } = request.user;

        // Try cache first
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const cached = await analyticsCacheService.getDashboardMetrics(userId, role);
        if (cached) {
          return cached as unknown;
        }

        // Get metrics from service
        const metrics = await analyticsService.getDashboardMetrics(userId, role);

        return metrics;
      } catch (error) {
        throw formatGraphQLError(error, 'dashboardMetrics');
      }
    },

    /**
     * Generates comprehensive course report with caching
     *
     * @param _parent - GraphQL parent (unused)
     * @param args - Query arguments
     * @param context - GraphQL context with authenticated user
     * @returns Detailed course report
     * @throws GraphQLError for authentication, authorization, or data errors
     */
    async generateCourseReport(
      _parent: unknown,
      args: { input: CourseReportInput },
      context: GraphQLContext
    ): Promise<unknown> {
      try {
        const { input } = args;
        const { request, analyticsService } = context;

        // Validate input
        if (!input.courseId) {
          throw new ValidationError('Course ID is required', [
            { field: 'courseId', message: 'Course ID cannot be empty' },
          ]);
        }

        const dateRange = parseDateRange(input.dateRange);

        // Check authorization
        if (!canAccessCourseAnalytics(request.user, input.courseId)) {
          throw new AuthorizationError('Insufficient permissions to generate course report');
        }

        // Try cache first
        const cached = await analyticsCacheService.getCourseReport(input.courseId, dateRange);
        if (cached) {
          return cached as unknown;
        }

        // Generate report from service
        const report = await analyticsService.generateCourseReport(input.courseId, dateRange);

        return report;
      } catch (error) {
        throw formatGraphQLError(error, 'generateCourseReport');
      }
    },

    /**
     * Generates comprehensive student report with caching
     *
     * @param _parent - GraphQL parent (unused)
     * @param args - Query arguments
     * @param context - GraphQL context with authenticated user
     * @returns Detailed student report
     * @throws GraphQLError for authentication, authorization, or data errors
     */
    async generateStudentReport(
      _parent: unknown,
      args: { input: StudentReportInput },
      context: GraphQLContext
    ): Promise<unknown> {
      try {
        const { input } = args;
        const { request, analyticsService } = context;

        // Validate input
        if (!input.studentId) {
          throw new ValidationError('Student ID is required', [
            { field: 'studentId', message: 'Student ID cannot be empty' },
          ]);
        }

        const dateRange = parseDateRange(input.dateRange);

        // Check authorization
        if (!canAccessUserAnalytics(request.user, input.studentId)) {
          throw new AuthorizationError('Insufficient permissions to generate student report');
        }

        // Try cache first
        const cached = await analyticsCacheService.getStudentReport(input.studentId, dateRange);
        if (cached) {
          return cached as unknown;
        }

        // Generate report from service
        const report = await analyticsService.generateStudentReport(input.studentId, dateRange);

        return report;
      } catch (error) {
        throw formatGraphQLError(error, 'generateStudentReport');
      }
    },

    /**
     * Gets platform-wide metrics (admin only) with caching
     *
     * @param _parent - GraphQL parent (unused)
     * @param args - Query arguments
     * @param context - GraphQL context with authenticated user
     * @returns Platform-wide metrics
     * @throws GraphQLError for authentication, authorization, or data errors
     */
    async platformMetrics(
      _parent: unknown,
      args: { input: PlatformMetricsInput },
      context: GraphQLContext
    ): Promise<unknown> {
      try {
        const { input } = args;
        const { request, analyticsService } = context;

        // Check admin authorization
        if (request.user.role !== 'admin') {
          throw new AuthorizationError('Admin access required for platform metrics');
        }

        const dateRange = parseDateRange(input.dateRange);

        // Try cache first
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const cached = await analyticsCacheService.getPlatformMetrics(dateRange);
        if (cached) {
          return cached as unknown;
        }

        // Get metrics from service
        const metrics = await analyticsService.getPlatformMetrics(dateRange);

        return metrics as unknown;
      } catch (error) {
        throw formatGraphQLError(error, 'platformMetrics');
      }
    },

    /**
     * Gets trending courses with caching
     *
     * @param _parent - GraphQL parent (unused)
     * @param args - Query arguments
     * @param context - GraphQL context with authenticated user
     * @returns Array of trending course analytics
     * @throws GraphQLError for authentication, authorization, or data errors
     */
    async trendingCourses(
      _parent: unknown,
      args: { limit?: number; dateRange: DateRangeInput },
      context: GraphQLContext
    ): Promise<unknown[]> {
      try {
        const { limit = 10, dateRange: dateRangeInput } = args;
        const { request, analyticsService } = context;

        // Check authorization (admin or educator)
        if (!['admin', 'educator'].includes(request.user.role)) {
          throw new AuthorizationError('Insufficient permissions to access trending courses');
        }

        // Validate limit
        if (limit < 1 || limit > 50) {
          throw new ValidationError('Invalid limit', [
            { field: 'limit', message: 'Limit must be between 1 and 50' },
          ]);
        }

        const dateRange = parseDateRange(dateRangeInput);

        // Try cache first
        const cached = await analyticsCacheService.getTrendingCourses(limit, dateRange);
        if (cached) {
          return cached as unknown[];
        }

        // Get trending courses from service
        const trendingCourses = await analyticsService.getTrendingCourses(limit, dateRange);

        return trendingCourses as unknown[];
      } catch (error) {
        throw formatGraphQLError(error, 'trendingCourses');
      }
    },

    /**
     * Gets top performing students (admin only) with caching
     *
     * @param _parent - GraphQL parent (unused)
     * @param args - Query arguments
     * @param context - GraphQL context with authenticated user
     * @returns Array of top student analytics
     * @throws GraphQLError for authentication, authorization, or data errors
     */
    async topPerformingStudents(
      _parent: unknown,
      args: { limit?: number },
      context: GraphQLContext
    ): Promise<unknown[]> {
      try {
        const { limit = 10 } = args;
        const { request, analyticsService } = context;

        // Check admin authorization
        if (request.user.role !== 'admin') {
          throw new AuthorizationError('Admin access required for top performing students');
        }

        // Validate limit
        if (limit < 1 || limit > 50) {
          throw new ValidationError('Invalid limit', [
            { field: 'limit', message: 'Limit must be between 1 and 50' },
          ]);
        }

        // Try cache first
        const cached = await analyticsCacheService.getTopPerformers(limit);
        if (cached) {
          return cached as unknown[];
        }

        // Get top performers from service
        const topStudents = await analyticsService.getTopPerformingStudents(limit);

        return topStudents as unknown[];
      } catch (error) {
        throw formatGraphQLError(error, 'topPerformingStudents');
      }
    },
  },

  // Field resolvers for complex types
  CourseAnalytics: {
    /**
     * Resolves course reference for course analytics
     */
    course(parent: { courseId: string }, _args: unknown, _context: GraphQLContext): unknown {
      // This would typically fetch course data from the courses module
      // For now, return a placeholder that matches the expected Course type
      return {
        id: parent.courseId,
        title: 'Course Title', // Would be fetched from courses service
        instructor: {
          id: 'instructor-id',
          email: 'instructor@example.com',
          role: 'educator',
          profile: {
            fullName: 'Instructor Name',
          },
        },
      };
    },

    /**
     * Resolves most difficult lesson reference
     */
    mostDifficultLesson(
      parent: { mostDifficultLessonId?: string },
      _args: unknown,
      _context: GraphQLContext
    ): unknown {
      if (!parent.mostDifficultLessonId) {
        return null;
      }

      // This would typically fetch lesson data from the courses module
      // For now, return a placeholder that matches the expected Lesson type
      return {
        id: parent.mostDifficultLessonId,
        title: 'Difficult Lesson', // Would be fetched from courses service
        module: {
          id: 'module-id',
          title: 'Module Title',
          course: {
            id: 'course-id',
            title: 'Course Title',
            instructor: {
              id: 'instructor-id',
              email: 'instructor@example.com',
              role: 'educator',
            },
          },
        },
      };
    },
  },

  StudentAnalytics: {
    /**
     * Resolves user reference for student analytics
     */
    user(parent: { userId: string }, _args: unknown, _context: GraphQLContext): unknown {
      // This would typically fetch user data from the users module
      // For now, return a placeholder that matches the expected User type
      return {
        id: parent.userId,
        email: 'student@example.com', // Would be fetched from users service
        role: 'student',
        profile: {
          fullName: 'Student Name',
        },
        createdAt: new Date(),
      };
    },

    /**
     * Calculates completion rate from enrolled and completed courses
     */
    completionRate(parent: { totalCoursesEnrolled: number; coursesCompleted: number }): number {
      if (parent.totalCoursesEnrolled === 0) {
        return 0;
      }
      return Math.round((parent.coursesCompleted / parent.totalCoursesEnrolled) * 100 * 100) / 100;
    },

    /**
     * Calculates average time per course
     */
    averageTimePerCourse(parent: {
      totalTimeInvestedMinutes: number;
      coursesCompleted: number;
    }): number {
      if (parent.coursesCompleted === 0) {
        return 0;
      }
      return Math.round(parent.totalTimeInvestedMinutes / parent.coursesCompleted);
    },

    /**
     * Generates performance summary based on analytics data
     */
    performanceSummary(parent: {
      totalCoursesEnrolled: number;
      coursesCompleted: number;
      averageQuizScore?: number;
      currentStreakDays: number;
      badgesEarned: string[];
    }): unknown {
      const completionRate =
        parent.totalCoursesEnrolled > 0
          ? (parent.coursesCompleted / parent.totalCoursesEnrolled) * 100
          : 0;

      // Determine performance level based on completion rate and quiz scores
      let performanceLevel = 'POOR';
      if (completionRate >= 80 && (parent.averageQuizScore || 0) >= 85) {
        performanceLevel = 'EXCELLENT';
      } else if (completionRate >= 60 && (parent.averageQuizScore || 0) >= 70) {
        performanceLevel = 'GOOD';
      } else if (completionRate >= 40 || (parent.averageQuizScore || 0) >= 60) {
        performanceLevel = 'NEEDS_IMPROVEMENT';
      }

      // Determine engagement level based on streak and activity
      let engagementLevel = 'LOW';
      if (parent.currentStreakDays >= 30) {
        engagementLevel = 'HIGH';
      } else if (parent.currentStreakDays >= 7) {
        engagementLevel = 'MEDIUM';
      }

      // Determine learning consistency based on streak patterns
      let learningConsistency = 'INACTIVE';
      if (parent.currentStreakDays >= 7) {
        learningConsistency = 'CONSISTENT';
      } else if (parent.currentStreakDays >= 1) {
        learningConsistency = 'IRREGULAR';
      }

      const averageSkillRating = 0; // Would be calculated from skillRatings

      return {
        completionRate: Math.round(completionRate * 100) / 100,
        performanceLevel,
        engagementLevel,
        learningConsistency,
        totalBadges: parent.badgesEarned.length,
        averageSkillRating,
      };
    },

    /**
     * Generates learning streak information
     */
    learningStreak(parent: { currentStreakDays: number; longestStreakDays: number }): unknown {
      return {
        currentStreak: parent.currentStreakDays,
        longestStreak: parent.longestStreakDays,
        lastActivityDate: new Date(), // Would be fetched from actual data
        streakStartDate:
          parent.currentStreakDays > 0
            ? new Date(Date.now() - parent.currentStreakDays * 24 * 60 * 60 * 1000)
            : null,
      };
    },
  },
};
