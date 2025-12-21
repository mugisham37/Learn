/**
 * Analytics Module Hooks
 * 
 * React hooks for analytics-related operations including course analytics,
 * student metrics, dashboard data, and report generation.
 * 
 * Requirements: 2.3 - Complete Module Hook Implementation (Analytics)
 */

import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import type {
  CourseAnalytics,
  StudentAnalytics,
  DashboardMetrics,
  CourseReport,
  StudentReport,
  PlatformHealth,
  CourseReportInput,
  StudentReportInput,
  PlatformMetricsInput,
  DateRangeInput,
} from '../types';

// GraphQL Queries
const GET_COURSE_ANALYTICS = gql`
  query GetCourseAnalytics($courseId: ID!) {
    courseAnalytics(courseId: $courseId) {
      courseId
      course {
        id
        title
        instructor {
          id
          profile {
            fullName
          }
        }
      }
      totalEnrollments
      activeEnrollments
      completionCount
      completionRate
      averageRating
      totalRevenue
      averageTimeToCompletionDays
      dropoutRate
      mostDifficultLesson {
        id
        title
        module {
          id
          title
        }
      }
      engagementMetrics {
        averageSessionDuration
        totalVideoWatchTime
        discussionParticipationRate
        assignmentSubmissionRate
        quizAttemptRate
        averageQuizScore
        lessonCompletionVelocity
        studentRetentionRate
      }
      lastUpdated
    }
  }
`;

const GET_STUDENT_ANALYTICS = gql`
  query GetStudentAnalytics($userId: ID!) {
    studentAnalytics(userId: $userId) {
      userId
      user {
        id
        email
        profile {
          fullName
          avatarUrl
        }
      }
      totalCoursesEnrolled
      coursesCompleted
      coursesInProgress
      averageQuizScore
      totalTimeInvestedMinutes
      currentStreakDays
      longestStreakDays
      badgesEarned
      skillRatings
      lastUpdated
      completionRate
      averageTimePerCourse
      performanceSummary {
        completionRate
        performanceLevel
        engagementLevel
        learningConsistency
        totalBadges
        averageSkillRating
      }
      learningStreak {
        currentStreak
        longestStreak
        lastActivityDate
        streakStartDate
      }
    }
  }
`;

const GET_DASHBOARD_METRICS = gql`
  query GetDashboardMetrics {
    dashboardMetrics {
      role
      userId
      generatedAt
      overview {
        totalUsers
        totalCourses
        totalEnrollments
        totalRevenue
      }
      studentMetrics {
        enrolledCourses
        completedCourses
        inProgressCourses
        currentStreak
        totalTimeInvested
        averageQuizScore
        badgesEarned
        upcomingDeadlines {
          courseId
          courseName
          assignmentName
          dueDate
        }
        recentGrades {
          courseId
          courseName
          assessmentName
          score
          gradedAt
        }
        recommendedCourses {
          courseId
          courseName
          reason
        }
      }
      educatorMetrics {
        totalCourses
        publishedCourses
        totalStudents
        averageRating
        totalRevenue
        pendingGrading
        coursePerformance {
          courseId
          courseName
          enrollments
          completionRate
          averageRating
          revenue
        }
        recentActivity {
          type
          courseId
          courseName
          studentName
          timestamp
        }
      }
      adminMetrics {
        platformHealth {
          totalUsers
          activeUsers
          totalCourses
          publishedCourses
          totalEnrollments
          completionRate
          averageRating
          totalRevenue
        }
        growthMetrics {
          userGrowthRate
          courseGrowthRate
          revenueGrowthRate
          enrollmentGrowthRate
        }
        systemMetrics {
          errorRate
          averageResponseTime
          uptime
          storageUsage
        }
        topPerformers {
          topCourses {
            courseId
            courseName
            instructorName
            enrollments
            rating
          }
          topInstructors {
            instructorId
            instructorName
            totalCourses
            totalStudents
            averageRating
          }
          topStudents {
            studentId
            studentName
            coursesCompleted
            averageScore
            currentStreak
          }
        }
      }
    }
  }
`;

const GENERATE_COURSE_REPORT = gql`
  query GenerateCourseReport($input: CourseReportInput!) {
    generateCourseReport(input: $input) {
      courseId
      courseName
      instructorName
      reportPeriod {
        startDate
        endDate
      }
      enrollmentTrends {
        totalEnrollments
        newEnrollments
        activeEnrollments
        completedEnrollments
        droppedEnrollments
        enrollmentsByMonth {
          month
          count
        }
      }
      performanceMetrics {
        completionRate
        averageTimeToCompletion
        dropoutRate
        averageQuizScore
        assignmentSubmissionRate
      }
      engagementMetrics {
        averageSessionDuration
        totalVideoWatchTime
        discussionParticipationRate
        lessonCompletionVelocity
        studentRetentionRate
      }
      revenueMetrics {
        totalRevenue
        revenuePerEnrollment
        refundRate
      }
      difficultContent {
        mostDifficultLessons {
          lessonId
          lessonName
          averageAttempts
          completionRate
        }
        strugglingStudents {
          studentId
          studentName
          progressPercentage
          strugglingAreas
        }
      }
    }
  }
`;

const GENERATE_STUDENT_REPORT = gql`
  query GenerateStudentReport($input: StudentReportInput!) {
    generateStudentReport(input: $input) {
      studentId
      studentName
      reportPeriod {
        startDate
        endDate
      }
      learningProgress {
        totalCoursesEnrolled
        coursesCompleted
        coursesInProgress
        completionRate
        totalTimeInvested
        averageTimePerCourse
      }
      performanceMetrics {
        averageQuizScore
        totalQuizzesTaken
        assignmentsSubmitted
        averageAssignmentScore
        improvementTrend
      }
      engagementMetrics {
        currentStreak
        longestStreak
        averageSessionDuration
        discussionParticipation
        lastActivityDate
      }
      skillDevelopment {
        skillRatings
        skillProgress {
          skillName
          currentRating
          improvement
          coursesContributing
        }
        badgesEarned {
          badgeId
          badgeName
          earnedAt
          category
        }
      }
      recommendations {
        nextCourses
        skillsToImprove
        studyScheduleSuggestions
      }
    }
  }
`;

const GET_PLATFORM_METRICS = gql`
  query GetPlatformMetrics($input: PlatformMetricsInput!) {
    platformMetrics(input: $input) {
      totalUsers
      activeUsers
      totalCourses
      publishedCourses
      totalEnrollments
      completionRate
      averageRating
      totalRevenue
    }
  }
`;

const GET_TRENDING_COURSES = gql`
  query GetTrendingCourses($limit: Int, $dateRange: DateRangeInput!) {
    trendingCourses(limit: $limit, dateRange: $dateRange) {
      courseId
      course {
        id
        title
        instructor {
          id
          profile {
            fullName
          }
        }
      }
      totalEnrollments
      activeEnrollments
      completionRate
      averageRating
      engagementMetrics {
        averageSessionDuration
        discussionParticipationRate
        studentRetentionRate
      }
    }
  }
`;

const GET_TOP_PERFORMING_STUDENTS = gql`
  query GetTopPerformingStudents($limit: Int) {
    topPerformingStudents(limit: $limit) {
      userId
      user {
        id
        profile {
          fullName
          avatarUrl
        }
      }
      coursesCompleted
      averageQuizScore
      currentStreakDays
      performanceSummary {
        performanceLevel
        engagementLevel
        totalBadges
      }
    }
  }
`;

// Hook return types
interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

// Response types
interface GetCourseAnalyticsResponse {
  courseAnalytics: CourseAnalytics;
}

interface GetStudentAnalyticsResponse {
  studentAnalytics: StudentAnalytics;
}

interface GetDashboardMetricsResponse {
  dashboardMetrics: DashboardMetrics;
}

interface GenerateCourseReportResponse {
  generateCourseReport: CourseReport;
}

interface GenerateStudentReportResponse {
  generateStudentReport: StudentReport;
}

interface GetPlatformMetricsResponse {
  platformMetrics: PlatformHealth;
}

interface GetTrendingCoursesResponse {
  trendingCourses: CourseAnalytics[];
}

interface GetTopPerformingStudentsResponse {
  topPerformingStudents: StudentAnalytics[];
}

/**
 * Hook for fetching course analytics with engagement and performance metrics
 * 
 * @param courseId - The course ID to fetch analytics for
 * @returns Query result with course analytics data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function CourseAnalyticsPage({ courseId }: { courseId: string }) {
 *   const { data, loading, error } = useCourseAnalytics(courseId);
 *   
 *   if (loading) return <div>Loading analytics...</div>;
 *   if (error) return <div>Error loading analytics</div>;
 *   
 *   return (
 *     <div>
 *       <h2>Course Analytics</h2>
 *       <p>Total Enrollments: {data?.totalEnrollments}</p>
 *       <p>Completion Rate: {data?.completionRate}%</p>
 *       <p>Average Rating: {data?.averageRating}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCourseAnalytics(courseId: string): QueryResult<CourseAnalytics> {
  const { data, loading, error, refetch } = useQuery<GetCourseAnalyticsResponse>(
    GET_COURSE_ANALYTICS,
    {
      variables: { courseId },
      skip: !courseId,
      errorPolicy: 'all',
      // Cache for 5 minutes since analytics data doesn't change frequently
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
    }
  );

  return {
    data: data?.courseAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching student analytics with learning progress and performance metrics
 * 
 * @param userId - The user ID to fetch analytics for (defaults to current user)
 * @returns Query result with student analytics data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function StudentDashboard({ userId }: { userId?: string }) {
 *   const { data, loading, error } = useStudentMetrics(userId);
 *   
 *   if (loading) return <div>Loading metrics...</div>;
 *   if (error) return <div>Error loading metrics</div>;
 *   
 *   return (
 *     <div>
 *       <h2>Your Learning Progress</h2>
 *       <p>Courses Completed: {data?.coursesCompleted}</p>
 *       <p>Current Streak: {data?.currentStreakDays} days</p>
 *       <p>Performance Level: {data?.performanceSummary.performanceLevel}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useStudentMetrics(userId?: string): QueryResult<StudentAnalytics> {
  const { data, loading, error, refetch } = useQuery<GetStudentAnalyticsResponse>(
    GET_STUDENT_ANALYTICS,
    {
      variables: { userId },
      skip: !userId,
      errorPolicy: 'all',
      // Cache for 5 minutes
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
    }
  );

  return {
    data: data?.studentAnalytics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching role-specific dashboard metrics
 * 
 * Returns different metrics based on user role:
 * - Students: enrollment stats, upcoming deadlines, recent grades
 * - Educators: course performance, pending grading, student activity
 * - Admins: platform health, growth metrics, top performers
 * 
 * @returns Query result with dashboard metrics data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { data, loading, error } = useDashboardData();
 *   
 *   if (loading) return <div>Loading dashboard...</div>;
 *   if (error) return <div>Error loading dashboard</div>;
 *   
 *   return (
 *     <div>
 *       {data?.studentMetrics && (
 *         <StudentDashboard metrics={data.studentMetrics} />
 *       )}
 *       {data?.educatorMetrics && (
 *         <EducatorDashboard metrics={data.educatorMetrics} />
 *       )}
 *       {data?.adminMetrics && (
 *         <AdminDashboard metrics={data.adminMetrics} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboardData(): QueryResult<DashboardMetrics> {
  const { data, loading, error, refetch } = useQuery<GetDashboardMetricsResponse>(
    GET_DASHBOARD_METRICS,
    {
      errorPolicy: 'all',
      // Cache for 2 minutes since dashboard data should be relatively fresh
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
      pollInterval: 120000, // Poll every 2 minutes for fresh data
    }
  );

  return {
    data: data?.dashboardMetrics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for generating comprehensive course reports with date filtering
 * 
 * @param input - Course report input with courseId and date range
 * @returns Query result with course report data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function CourseReportPage({ courseId }: { courseId: string }) {
 *   const { data, loading, error, refetch } = useReportGeneration({
 *     courseId,
 *     dateRange: {
 *       startDate: '2024-01-01',
 *       endDate: '2024-12-31'
 *     }
 *   });
 *   
 *   if (loading) return <div>Generating report...</div>;
 *   if (error) return <div>Error generating report</div>;
 *   
 *   return (
 *     <div>
 *       <h2>Course Report: {data?.courseName}</h2>
 *       <EnrollmentTrendsChart data={data?.enrollmentTrends} />
 *       <PerformanceMetrics data={data?.performanceMetrics} />
 *       <RevenueMetrics data={data?.revenueMetrics} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useReportGeneration(
  input: CourseReportInput
): QueryResult<CourseReport> {
  const { data, loading, error, refetch } = useQuery<GenerateCourseReportResponse>(
    GENERATE_COURSE_REPORT,
    {
      variables: { input },
      skip: !input.courseId || !input.dateRange,
      errorPolicy: 'all',
      // Don't cache reports since they're generated on-demand
      fetchPolicy: 'network-only',
    }
  );

  return {
    data: data?.generateCourseReport,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for generating comprehensive student reports with date filtering
 * 
 * @param input - Student report input with studentId and date range
 * @returns Query result with student report data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function StudentReportPage({ studentId }: { studentId: string }) {
 *   const { data, loading, error } = useStudentReport({
 *     studentId,
 *     dateRange: {
 *       startDate: '2024-01-01',
 *       endDate: '2024-12-31'
 *     }
 *   });
 *   
 *   if (loading) return <div>Generating report...</div>;
 *   if (error) return <div>Error generating report</div>;
 *   
 *   return (
 *     <div>
 *       <h2>Student Report: {data?.studentName}</h2>
 *       <LearningProgress data={data?.learningProgress} />
 *       <PerformanceMetrics data={data?.performanceMetrics} />
 *       <SkillDevelopment data={data?.skillDevelopment} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useStudentReport(
  input: StudentReportInput
): QueryResult<StudentReport> {
  const { data, loading, error, refetch } = useQuery<GenerateStudentReportResponse>(
    GENERATE_STUDENT_REPORT,
    {
      variables: { input },
      skip: !input.studentId || !input.dateRange,
      errorPolicy: 'all',
      // Don't cache reports since they're generated on-demand
      fetchPolicy: 'network-only',
    }
  );

  return {
    data: data?.generateStudentReport,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching platform-wide metrics (admin only)
 * 
 * @param input - Platform metrics input with date range
 * @returns Query result with platform health data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function PlatformMetricsPage() {
 *   const { data, loading, error } = usePlatformMetrics({
 *     dateRange: {
 *       startDate: '2024-01-01',
 *       endDate: '2024-12-31'
 *     }
 *   });
 *   
 *   if (loading) return <div>Loading metrics...</div>;
 *   if (error) return <div>Error loading metrics</div>;
 *   
 *   return (
 *     <div>
 *       <h2>Platform Metrics</h2>
 *       <p>Total Users: {data?.totalUsers}</p>
 *       <p>Total Courses: {data?.totalCourses}</p>
 *       <p>Completion Rate: {data?.completionRate}%</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlatformMetrics(
  input: PlatformMetricsInput
): QueryResult<PlatformHealth> {
  const { data, loading, error, refetch } = useQuery<GetPlatformMetricsResponse>(
    GET_PLATFORM_METRICS,
    {
      variables: { input },
      skip: !input.dateRange,
      errorPolicy: 'all',
      // Cache for 10 minutes
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
    }
  );

  return {
    data: data?.platformMetrics,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching trending courses based on enrollment and engagement
 * 
 * @param limit - Maximum number of trending courses to return (default: 10)
 * @param dateRange - Date range for trending analysis
 * @returns Query result with trending courses data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function TrendingCoursesWidget() {
 *   const { data, loading, error } = useTrendingCourses(5, {
 *     startDate: '2024-01-01',
 *     endDate: '2024-12-31'
 *   });
 *   
 *   if (loading) return <div>Loading trending courses...</div>;
 *   if (error) return <div>Error loading courses</div>;
 *   
 *   return (
 *     <div>
 *       <h3>Trending Courses</h3>
 *       {data?.map(course => (
 *         <CourseCard key={course.courseId} analytics={course} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTrendingCourses(
  limit: number = 10,
  dateRange: DateRangeInput
): QueryResult<CourseAnalytics[]> {
  const { data, loading, error, refetch } = useQuery<GetTrendingCoursesResponse>(
    GET_TRENDING_COURSES,
    {
      variables: { limit, dateRange },
      skip: !dateRange,
      errorPolicy: 'all',
      // Cache for 15 minutes
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
    }
  );

  return {
    data: data?.trendingCourses,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching top performing students (admin only)
 * 
 * @param limit - Maximum number of top students to return (default: 10)
 * @returns Query result with top students data, loading state, and error handling
 * 
 * @example
 * ```tsx
 * function TopStudentsLeaderboard() {
 *   const { data, loading, error } = useTopPerformingStudents(10);
 *   
 *   if (loading) return <div>Loading leaderboard...</div>;
 *   if (error) return <div>Error loading leaderboard</div>;
 *   
 *   return (
 *     <div>
 *       <h3>Top Performing Students</h3>
 *       {data?.map((student, index) => (
 *         <StudentCard key={student.userId} rank={index + 1} student={student} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTopPerformingStudents(
  limit: number = 10
): QueryResult<StudentAnalytics[]> {
  const { data, loading, error, refetch } = useQuery<GetTopPerformingStudentsResponse>(
    GET_TOP_PERFORMING_STUDENTS,
    {
      variables: { limit },
      errorPolicy: 'all',
      // Cache for 15 minutes
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
    }
  );

  return {
    data: data?.topPerformingStudents,
    loading,
    error,
    refetch,
  };
}
