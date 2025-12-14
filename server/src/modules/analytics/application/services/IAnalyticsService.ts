/**
 * Analytics Service Interface
 *
 * Defines the contract for analytics application services.
 * Provides methods for updating analytics, generating reports, and tracking events.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.7
 */

import type { Role, DateRange } from '../../../../shared/types/index.js';
import type {
  CourseAnalytics,
  StudentAnalytics,
  AnalyticsEvent,
} from '../../domain/entities/index.js';

/**
 * Course report data structure
 */
export interface CourseReport {
  courseId: string;
  courseName: string;
  instructorName: string;
  reportPeriod: DateRange;
  enrollmentTrends: {
    totalEnrollments: number;
    newEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    droppedEnrollments: number;
    enrollmentsByMonth: Array<{ month: string; count: number }>;
  };
  performanceMetrics: {
    completionRate: number;
    averageTimeToCompletion: number;
    dropoutRate: number;
    averageQuizScore: number;
    assignmentSubmissionRate: number;
  };
  engagementMetrics: {
    averageSessionDuration: number;
    totalVideoWatchTime: number;
    discussionParticipationRate: number;
    lessonCompletionVelocity: number;
    studentRetentionRate: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    revenuePerEnrollment: number;
    refundRate: number;
  };
  difficultContent: {
    mostDifficultLessons: Array<{
      lessonId: string;
      lessonName: string;
      averageAttempts: number;
      completionRate: number;
    }>;
    strugglingStudents: Array<{
      studentId: string;
      studentName: string;
      progressPercentage: number;
      strugglingAreas: string[];
    }>;
  };
}

/**
 * Student report data structure
 */
export interface StudentReport {
  studentId: string;
  studentName: string;
  reportPeriod: DateRange;
  learningProgress: {
    totalCoursesEnrolled: number;
    coursesCompleted: number;
    coursesInProgress: number;
    completionRate: number;
    totalTimeInvested: number;
    averageTimePerCourse: number;
  };
  performanceMetrics: {
    averageQuizScore: number;
    totalQuizzesTaken: number;
    assignmentsSubmitted: number;
    averageAssignmentScore: number;
    improvementTrend: 'improving' | 'stable' | 'declining';
  };
  engagementMetrics: {
    currentStreak: number;
    longestStreak: number;
    averageSessionDuration: number;
    discussionParticipation: number;
    lastActivityDate: Date;
  };
  skillDevelopment: {
    skillRatings: Record<string, number>;
    skillProgress: Array<{
      skillName: string;
      currentRating: number;
      improvement: number;
      coursesContributing: string[];
    }>;
    badgesEarned: Array<{
      badgeId: string;
      badgeName: string;
      earnedAt: Date;
      category: string;
    }>;
  };
  recommendations: {
    nextCourses: string[];
    skillsToImprove: string[];
    studyScheduleSuggestions: string[];
  };
}

/**
 * Dashboard metrics for different user roles
 */
export interface DashboardMetrics {
  role: Role;
  userId: string;
  generatedAt: Date;

  // Common metrics for all roles
  overview: {
    totalUsers?: number;
    totalCourses?: number;
    totalEnrollments?: number;
    totalRevenue?: number;
  };

  // Student-specific metrics
  studentMetrics?: {
    enrolledCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    currentStreak: number;
    totalTimeInvested: number;
    averageQuizScore: number;
    badgesEarned: number;
    upcomingDeadlines: Array<{
      courseId: string;
      courseName: string;
      assignmentName: string;
      dueDate: Date;
    }>;
    recentGrades: Array<{
      courseId: string;
      courseName: string;
      assessmentName: string;
      score: number;
      gradedAt: Date;
    }>;
    recommendedCourses: Array<{
      courseId: string;
      courseName: string;
      reason: string;
    }>;
  };

  // Educator-specific metrics
  educatorMetrics?: {
    totalCourses: number;
    publishedCourses: number;
    totalStudents: number;
    averageRating: number;
    totalRevenue: number;
    pendingGrading: number;
    coursePerformance: Array<{
      courseId: string;
      courseName: string;
      enrollments: number;
      completionRate: number;
      averageRating: number;
      revenue: number;
    }>;
    recentActivity: Array<{
      type: 'enrollment' | 'completion' | 'discussion' | 'submission';
      courseId: string;
      courseName: string;
      studentName: string;
      timestamp: Date;
    }>;
  };

  // Admin-specific metrics
  adminMetrics?: {
    platformHealth: {
      totalUsers: number;
      activeUsers: number;
      totalCourses: number;
      publishedCourses: number;
      totalEnrollments: number;
      completionRate: number;
      averageRating: number;
      totalRevenue: number;
    };
    growthMetrics: {
      userGrowthRate: number;
      courseGrowthRate: number;
      revenueGrowthRate: number;
      enrollmentGrowthRate: number;
    };
    systemMetrics: {
      errorRate: number;
      averageResponseTime: number;
      uptime: number;
      storageUsage: number;
    };
    topPerformers: {
      topCourses: Array<{
        courseId: string;
        courseName: string;
        instructorName: string;
        enrollments: number;
        rating: number;
      }>;
      topInstructors: Array<{
        instructorId: string;
        instructorName: string;
        totalCourses: number;
        totalStudents: number;
        averageRating: number;
      }>;
      topStudents: Array<{
        studentId: string;
        studentName: string;
        coursesCompleted: number;
        averageScore: number;
        currentStreak: number;
      }>;
    };
  };
}

/**
 * Analytics Service Interface
 *
 * Provides methods for analytics data aggregation, report generation,
 * dashboard metrics, and event tracking.
 */
export interface IAnalyticsService {
  /**
   * Updates course analytics by aggregating data from enrollments, progress, and payments
   *
   * @param courseId - Course ID to update analytics for
   * @returns Updated course analytics
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if aggregation fails
   */
  updateCourseAnalytics(courseId: string): Promise<CourseAnalytics>;

  /**
   * Updates student analytics by aggregating data from enrollments, submissions, and progress
   *
   * @param userId - User ID to update analytics for
   * @returns Updated student analytics
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if aggregation fails
   */
  updateStudentAnalytics(userId: string): Promise<StudentAnalytics>;

  /**
   * Generates comprehensive course report with enrollment trends, performance, and engagement
   *
   * @param courseId - Course ID to generate report for
   * @param dateRange - Date range for the report
   * @returns Detailed course report
   * @throws NotFoundError if course doesn't exist
   * @throws DatabaseError if report generation fails
   */
  generateCourseReport(courseId: string, dateRange: DateRange): Promise<CourseReport>;

  /**
   * Generates comprehensive student report with learning progress, performance, and recommendations
   *
   * @param userId - User ID to generate report for
   * @param dateRange - Date range for the report
   * @returns Detailed student report
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if report generation fails
   */
  generateStudentReport(userId: string, dateRange: DateRange): Promise<StudentReport>;

  /**
   * Gets dashboard metrics tailored to user role (student, educator, admin)
   *
   * @param userId - User ID requesting dashboard metrics
   * @param role - User role for role-specific data
   * @returns Role-specific dashboard metrics
   * @throws NotFoundError if user doesn't exist
   * @throws DatabaseError if metrics calculation fails
   */
  getDashboardMetrics(userId: string, role: Role): Promise<DashboardMetrics>;

  /**
   * Tracks user action by creating analytics event for logging and analysis
   *
   * @param event - Analytics event to track
   * @returns Created analytics event
   * @throws ValidationError if event data is invalid
   * @throws DatabaseError if event creation fails
   */
  trackEvent(event: AnalyticsEvent): Promise<AnalyticsEvent>;

  /**
   * Batch updates multiple course analytics (for scheduled jobs)
   *
   * @param courseIds - Array of course IDs to update
   * @returns Array of updated course analytics
   * @throws DatabaseError if batch update fails
   */
  batchUpdateCourseAnalytics(courseIds: string[]): Promise<CourseAnalytics[]>;

  /**
   * Batch updates multiple student analytics (for scheduled jobs)
   *
   * @param userIds - Array of user IDs to update
   * @returns Array of updated student analytics
   * @throws DatabaseError if batch update fails
   */
  batchUpdateStudentAnalytics(userIds: string[]): Promise<StudentAnalytics[]>;

  /**
   * Gets trending courses based on recent enrollment velocity
   *
   * @param limit - Number of trending courses to return
   * @param dateRange - Date range to analyze trends
   * @returns Array of trending course analytics
   * @throws DatabaseError if trend calculation fails
   */
  getTrendingCourses(limit: number, dateRange: DateRange): Promise<CourseAnalytics[]>;

  /**
   * Gets top performing students based on completion rate and scores
   *
   * @param limit - Number of top students to return
   * @returns Array of top student analytics
   * @throws DatabaseError if performance calculation fails
   */
  getTopPerformingStudents(limit: number): Promise<StudentAnalytics[]>;

  /**
   * Calculates platform-wide metrics for admin dashboard
   *
   * @param dateRange - Date range for metrics calculation
   * @returns Platform-wide analytics summary
   * @throws DatabaseError if metrics calculation fails
   */
  getPlatformMetrics(dateRange: DateRange): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalCourses: number;
    totalEnrollments: number;
    totalRevenue: number;
    averageCompletionRate: number;
    averageRating: number;
    growthMetrics: {
      userGrowth: number;
      courseGrowth: number;
      enrollmentGrowth: number;
      revenueGrowth: number;
    };
  }>;
}
