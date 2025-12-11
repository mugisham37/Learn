/**
 * GraphQL Schema for Analytics Module
 * 
 * Defines GraphQL types, inputs, and schema for analytics data,
 * dashboard metrics, and report generation.
 * 
 * Requirements: 21.1, 21.2
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for analytics module
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const analyticsTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON
  scalar Decimal

  # User type (from users module)
  type User {
    id: ID!
    email: String!
    role: String!
    profile: UserProfile
    createdAt: DateTime!
  }

  type UserProfile {
    fullName: String!
    bio: String
    avatarUrl: String
  }

  # Course type (from courses module)
  type Course {
    id: ID!
    title: String!
    instructor: User!
  }

  # Lesson type (from courses module)
  type Lesson {
    id: ID!
    title: String!
    module: CourseModule!
  }

  type CourseModule {
    id: ID!
    title: String!
    course: Course!
  }

  # Enums
  enum PerformanceLevel {
    EXCELLENT
    GOOD
    NEEDS_IMPROVEMENT
    POOR
  }

  enum EngagementLevel {
    HIGH
    MEDIUM
    LOW
  }

  enum LearningConsistency {
    CONSISTENT
    IRREGULAR
    INACTIVE
  }

  enum BadgeCategory {
    COMPLETION
    PERFORMANCE
    ENGAGEMENT
    STREAK
    SKILL
  }

  enum ImprovementTrend {
    IMPROVING
    STABLE
    DECLINING
  }

  # Analytics Object Types
  type CourseAnalytics {
    courseId: ID!
    course: Course!
    totalEnrollments: Int!
    activeEnrollments: Int!
    completionCount: Int!
    completionRate: Float!
    averageRating: Float
    totalRevenue: Decimal!
    averageTimeToCompletionDays: Int
    dropoutRate: Float!
    mostDifficultLesson: Lesson
    engagementMetrics: EngagementMetrics!
    lastUpdated: DateTime!
  }

  type EngagementMetrics {
    averageSessionDuration: Float!
    totalVideoWatchTime: Float!
    discussionParticipationRate: Float!
    assignmentSubmissionRate: Float!
    quizAttemptRate: Float!
    averageQuizScore: Float!
    lessonCompletionVelocity: Float!
    studentRetentionRate: Float!
  }

  type StudentAnalytics {
    userId: ID!
    user: User!
    totalCoursesEnrolled: Int!
    coursesCompleted: Int!
    coursesInProgress: Int!
    averageQuizScore: Float
    totalTimeInvestedMinutes: Int!
    currentStreakDays: Int!
    longestStreakDays: Int!
    badgesEarned: [String!]!
    skillRatings: JSON!
    lastUpdated: DateTime!
    
    # Computed fields
    completionRate: Float!
    averageTimePerCourse: Int!
    performanceSummary: StudentPerformanceSummary!
    learningStreak: LearningStreak!
  }

  type StudentPerformanceSummary {
    completionRate: Float!
    performanceLevel: PerformanceLevel!
    engagementLevel: EngagementLevel!
    learningConsistency: LearningConsistency!
    totalBadges: Int!
    averageSkillRating: Float!
  }

  type LearningStreak {
    currentStreak: Int!
    longestStreak: Int!
    lastActivityDate: DateTime!
    streakStartDate: DateTime
  }

  type DashboardMetrics {
    role: String!
    userId: ID!
    generatedAt: DateTime!
    overview: PlatformOverview
    studentMetrics: StudentDashboardMetrics
    educatorMetrics: EducatorDashboardMetrics
    adminMetrics: AdminDashboardMetrics
  }

  type PlatformOverview {
    totalUsers: Int
    totalCourses: Int
    totalEnrollments: Int
    totalRevenue: Decimal
  }

  type StudentDashboardMetrics {
    enrolledCourses: Int!
    completedCourses: Int!
    inProgressCourses: Int!
    currentStreak: Int!
    totalTimeInvested: Int!
    averageQuizScore: Float
    badgesEarned: Int!
    upcomingDeadlines: [UpcomingDeadline!]!
    recentGrades: [RecentGrade!]!
    recommendedCourses: [RecommendedCourse!]!
  }

  type EducatorDashboardMetrics {
    totalCourses: Int!
    publishedCourses: Int!
    totalStudents: Int!
    averageRating: Float!
    totalRevenue: Decimal!
    pendingGrading: Int!
    coursePerformance: [CoursePerformanceMetric!]!
    recentActivity: [RecentActivity!]!
  }

  type AdminDashboardMetrics {
    platformHealth: PlatformHealth!
    growthMetrics: GrowthMetrics!
    systemMetrics: SystemMetrics!
    topPerformers: TopPerformers!
  }

  type PlatformHealth {
    totalUsers: Int!
    activeUsers: Int!
    totalCourses: Int!
    publishedCourses: Int!
    totalEnrollments: Int!
    completionRate: Float!
    averageRating: Float!
    totalRevenue: Decimal!
  }

  type GrowthMetrics {
    userGrowthRate: Float!
    courseGrowthRate: Float!
    revenueGrowthRate: Float!
    enrollmentGrowthRate: Float!
  }

  type SystemMetrics {
    errorRate: Float!
    averageResponseTime: Float!
    uptime: Float!
    storageUsage: Float!
  }

  type TopPerformers {
    topCourses: [TopCourse!]!
    topInstructors: [TopInstructor!]!
    topStudents: [TopStudent!]!
  }

  type UpcomingDeadline {
    courseId: ID!
    courseName: String!
    assignmentName: String!
    dueDate: DateTime!
  }

  type RecentGrade {
    courseId: ID!
    courseName: String!
    assessmentName: String!
    score: Float!
    gradedAt: DateTime!
  }

  type RecommendedCourse {
    courseId: ID!
    courseName: String!
    reason: String!
  }

  type CoursePerformanceMetric {
    courseId: ID!
    courseName: String!
    enrollments: Int!
    completionRate: Float!
    averageRating: Float!
    revenue: Decimal!
  }

  type RecentActivity {
    type: String!
    courseId: ID!
    courseName: String!
    studentName: String!
    timestamp: DateTime!
  }

  type TopCourse {
    courseId: ID!
    courseName: String!
    instructorName: String!
    enrollments: Int!
    rating: Float!
  }

  type TopInstructor {
    instructorId: ID!
    instructorName: String!
    totalCourses: Int!
    totalStudents: Int!
    averageRating: Float!
  }

  type TopStudent {
    studentId: ID!
    studentName: String!
    coursesCompleted: Int!
    averageScore: Float!
    currentStreak: Int!
  }

  # Report Types
  type CourseReport {
    courseId: ID!
    courseName: String!
    instructorName: String!
    reportPeriod: DateRange!
    enrollmentTrends: EnrollmentTrends!
    performanceMetrics: CoursePerformanceMetrics!
    engagementMetrics: CourseEngagementMetrics!
    revenueMetrics: RevenueMetrics!
    difficultContent: DifficultContent!
  }

  type StudentReport {
    studentId: ID!
    studentName: String!
    reportPeriod: DateRange!
    learningProgress: LearningProgress!
    performanceMetrics: StudentPerformanceMetrics!
    engagementMetrics: StudentEngagementMetrics!
    skillDevelopment: SkillDevelopment!
    recommendations: StudentRecommendations!
  }

  type DateRange {
    startDate: DateTime!
    endDate: DateTime!
  }

  type EnrollmentTrends {
    totalEnrollments: Int!
    newEnrollments: Int!
    activeEnrollments: Int!
    completedEnrollments: Int!
    droppedEnrollments: Int!
    enrollmentsByMonth: [MonthlyEnrollment!]!
  }

  type MonthlyEnrollment {
    month: String!
    count: Int!
  }

  type CoursePerformanceMetrics {
    completionRate: Float!
    averageTimeToCompletion: Float!
    dropoutRate: Float!
    averageQuizScore: Float!
    assignmentSubmissionRate: Float!
  }

  type CourseEngagementMetrics {
    averageSessionDuration: Float!
    totalVideoWatchTime: Float!
    discussionParticipationRate: Float!
    lessonCompletionVelocity: Float!
    studentRetentionRate: Float!
  }

  type RevenueMetrics {
    totalRevenue: Decimal!
    revenuePerEnrollment: Decimal!
    refundRate: Float!
  }

  type DifficultContent {
    mostDifficultLessons: [DifficultLesson!]!
    strugglingStudents: [StrugglingStudent!]!
  }

  type DifficultLesson {
    lessonId: ID!
    lessonName: String!
    averageAttempts: Float!
    completionRate: Float!
  }

  type StrugglingStudent {
    studentId: ID!
    studentName: String!
    progressPercentage: Float!
    strugglingAreas: [String!]!
  }

  type LearningProgress {
    totalCoursesEnrolled: Int!
    coursesCompleted: Int!
    coursesInProgress: Int!
    completionRate: Float!
    totalTimeInvested: Int!
    averageTimePerCourse: Int!
  }

  type StudentPerformanceMetrics {
    averageQuizScore: Float!
    totalQuizzesTaken: Int!
    assignmentsSubmitted: Int!
    averageAssignmentScore: Float!
    improvementTrend: ImprovementTrend!
  }

  type StudentEngagementMetrics {
    currentStreak: Int!
    longestStreak: Int!
    averageSessionDuration: Float!
    discussionParticipation: Int!
    lastActivityDate: DateTime!
  }

  type SkillDevelopment {
    skillRatings: JSON!
    skillProgress: [SkillProgress!]!
    badgesEarned: [Badge!]!
  }

  type SkillProgress {
    skillName: String!
    currentRating: Float!
    improvement: Float!
    coursesContributing: [String!]!
  }

  type Badge {
    badgeId: String!
    badgeName: String!
    earnedAt: DateTime!
    category: BadgeCategory!
  }

  type StudentRecommendations {
    nextCourses: [String!]!
    skillsToImprove: [String!]!
    studyScheduleSuggestions: [String!]!
  }

  # Input Types
  input DateRangeInput {
    startDate: DateTime!
    endDate: DateTime!
  }

  input CourseReportInput {
    courseId: ID!
    dateRange: DateRangeInput!
  }

  input StudentReportInput {
    studentId: ID!
    dateRange: DateRangeInput!
  }

  input PlatformMetricsInput {
    dateRange: DateRangeInput!
  }

  # Queries
  type Query {
    # Analytics queries
    courseAnalytics(courseId: ID!): CourseAnalytics
    studentAnalytics(userId: ID!): StudentAnalytics
    dashboardMetrics: DashboardMetrics!
    
    # Report generation queries
    generateCourseReport(input: CourseReportInput!): CourseReport!
    generateStudentReport(input: StudentReportInput!): StudentReport!
    
    # Platform-wide analytics (admin only)
    platformMetrics(input: PlatformMetricsInput!): PlatformHealth!
    trendingCourses(limit: Int = 10, dateRange: DateRangeInput!): [CourseAnalytics!]!
    topPerformingStudents(limit: Int = 10): [StudentAnalytics!]!
  }
`;