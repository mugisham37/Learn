/**
 * GraphQL Schema for Enrollments Module
 * 
 * Defines GraphQL types, inputs, and schema for enrollment management,
 * progress tracking, and certificate generation operations.
 * 
 * Requirements: 21.1, 21.2
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for enrollments module
 */
export const enrollmentTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum EnrollmentStatus {
    ACTIVE
    COMPLETED
    DROPPED
  }

  enum ProgressStatus {
    NOT_STARTED
    IN_PROGRESS
    COMPLETED
  }

  # Object Types
  type Enrollment {
    id: ID!
    student: User!
    course: Course!
    enrolledAt: DateTime!
    completedAt: DateTime
    progressPercentage: Float!
    lastAccessedAt: DateTime
    status: EnrollmentStatus!
    certificate: Certificate
    paymentId: String
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Computed fields
    lessonProgress: [LessonProgress!]!
    completedLessonsCount: Int!
    totalLessonsCount: Int!
    totalTimeSpentSeconds: Int!
    averageQuizScore: Float
    nextLesson: LessonProgress
    inProgressLessons: [LessonProgress!]!
  }

  type LessonProgress {
    id: ID!
    enrollment: Enrollment!
    lesson: Lesson!
    status: ProgressStatus!
    timeSpentSeconds: Int!
    completedAt: DateTime
    quizScore: Int
    attemptsCount: Int!
    lastAccessedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Computed fields
    progressPercentage: Float!
  }

  type Certificate {
    id: ID!
    enrollment: Enrollment!
    certificateId: String!
    pdfUrl: String!
    issuedAt: DateTime!
    verificationUrl: String!
    metadata: CertificateMetadata
    createdAt: DateTime!
    
    # Computed fields
    studentName: String!
    courseTitle: String!
    instructorName: String!
    completionDate: DateTime!
    grade: String
    creditsEarned: Int
    qrCodeData: String!
    isReadyForDelivery: Boolean!
    isExpired: Boolean!
  }

  type CertificateMetadata {
    studentName: String!
    courseTitle: String!
    instructorName: String!
    completionDate: DateTime!
    grade: String
    creditsEarned: Int
  }

  type ProgressSummary {
    enrollment: Enrollment!
    totalLessons: Int!
    completedLessons: Int!
    inProgressLessons: Int!
    notStartedLessons: Int!
    progressPercentage: Float!
    totalTimeSpentSeconds: Int!
    averageQuizScore: Float
    nextRecommendedLesson: RecommendedLesson
    strugglingAreas: [String!]!
    estimatedTimeRemaining: Int
  }

  type RecommendedLesson {
    lessonId: String!
    lessonTitle: String!
    moduleTitle: String!
  }

  type EnrollmentEligibility {
    eligible: Boolean!
    reasons: [String!]!
    requiresPayment: Boolean!
    paymentAmount: Float
    enrollmentLimit: Int
    currentEnrollments: Int
  }

  type LessonAccess {
    canAccess: Boolean!
    reasons: [String!]!
    prerequisiteModules: [PrerequisiteModule!]
  }

  type PrerequisiteModule {
    moduleId: String!
    moduleTitle: String!
    isCompleted: Boolean!
  }

  # Connection types for pagination
  type EnrollmentsConnection {
    edges: [EnrollmentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type EnrollmentEdge {
    node: Enrollment!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Input Types
  input EnrollInCourseInput {
    courseId: ID!
    paymentInfo: PaymentInfoInput
  }

  input PaymentInfoInput {
    paymentId: String!
    amount: Float!
    currency: String!
  }

  input ProgressInput {
    status: ProgressStatus
    timeSpentSeconds: Int
    quizScore: Int
    attemptsCount: Int
  }

  input UpdateLessonProgressInput {
    enrollmentId: ID!
    lessonId: ID!
    progress: ProgressInput!
  }

  input WithdrawEnrollmentInput {
    enrollmentId: ID!
    reason: String
  }

  input EnrollmentFiltersInput {
    status: EnrollmentStatus
    courseId: ID
    studentId: ID
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  # Mutations
  type Mutation {
    # Enrollment management
    enrollInCourse(input: EnrollInCourseInput!): Enrollment!
    updateLessonProgress(input: UpdateLessonProgressInput!): LessonProgress!
    withdrawEnrollment(input: WithdrawEnrollmentInput!): Boolean!
    
    # Progress management
    completeLesson(enrollmentId: ID!, lessonId: ID!): LessonProgress!
    resetLessonProgress(enrollmentId: ID!, lessonId: ID!): LessonProgress!
    
    # Certificate management
    regenerateCertificate(enrollmentId: ID!): Certificate!
  }

  # Queries
  type Query {
    # Enrollment queries
    myEnrollments(
      status: EnrollmentStatus
      first: Int
      after: String
    ): EnrollmentsConnection!
    
    enrollment(id: ID!): Enrollment
    
    enrollmentProgress(enrollmentId: ID!): ProgressSummary!
    
    # Certificate queries
    verifyCertificate(certificateId: String!): Certificate
    myCertificates: [Certificate!]!
    
    # Eligibility and access checks
    checkEnrollmentEligibility(
      studentId: ID!
      courseId: ID!
    ): EnrollmentEligibility!
    
    checkLessonAccess(
      enrollmentId: ID!
      lessonId: ID!
    ): LessonAccess!
    
    # Course enrollments (for educators)
    courseEnrollments(
      courseId: ID!
      filters: EnrollmentFiltersInput
      pagination: PaginationInput
    ): EnrollmentsConnection!
    
    # Student enrollments (for admins)
    studentEnrollments(
      studentId: ID!
      filters: EnrollmentFiltersInput
      pagination: PaginationInput
    ): EnrollmentsConnection!
  }

  # Subscriptions for real-time updates
  type Subscription {
    # Progress updates
    enrollmentProgressUpdated(enrollmentId: ID!): ProgressSummary!
    lessonProgressUpdated(enrollmentId: ID!): LessonProgress!
    
    # Certificate updates
    certificateGenerated(enrollmentId: ID!): Certificate!
    
    # Course completion
    courseCompleted(enrollmentId: ID!): Enrollment!
  }
`;