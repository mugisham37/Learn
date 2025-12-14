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
  "Custom scalar type for date and time values in ISO 8601 format"
  scalar DateTime

  "Custom scalar type for arbitrary JSON data"
  scalar JSON

  # Enums
  "Enrollment lifecycle status tracking student participation"
  enum EnrollmentStatus {
    "Student is actively participating in the course"
    ACTIVE
    "Student has successfully completed all course requirements"
    COMPLETED
    "Student has withdrawn or been removed from the course"
    DROPPED
  }

  "Individual lesson completion status for progress tracking"
  enum ProgressStatus {
    "Lesson has not been accessed by the student"
    NOT_STARTED
    "Lesson has been started but not completed"
    IN_PROGRESS
    "Lesson has been successfully completed"
    COMPLETED
  }

  # Object Types
  """
  Core enrollment entity representing a student's participation in a course.
  Tracks progress, completion status, and provides access to learning materials.
  """
  type Enrollment {
    "Unique identifier for the enrollment"
    id: ID!
    "Student enrolled in the course"
    student: User!
    "Course the student is enrolled in"
    course: Course!
    "Timestamp when the student enrolled in the course"
    enrolledAt: DateTime!
    "Timestamp when the student completed the course (null if not completed)"
    completedAt: DateTime
    "Overall course completion percentage (0-100)"
    progressPercentage: Float!
    "Timestamp of student's last activity in the course"
    lastAccessedAt: DateTime
    "Current enrollment status"
    status: EnrollmentStatus!
    "Digital certificate issued upon course completion"
    certificate: Certificate
    "Payment ID if course required payment"
    paymentId: String
    "Timestamp when the enrollment was created"
    createdAt: DateTime!
    "Timestamp when the enrollment was last updated"
    updatedAt: DateTime!

    # Computed fields
    "Progress tracking for all lessons in the course"
    lessonProgress: [LessonProgress!]!
    "Number of lessons completed by the student"
    completedLessonsCount: Int!
    "Total number of lessons in the course"
    totalLessonsCount: Int!
    "Total time spent by student across all lessons (in seconds)"
    totalTimeSpentSeconds: Int!
    "Average score across all completed quizzes"
    averageQuizScore: Float
    "Next recommended lesson for the student to complete"
    nextLesson: LessonProgress
    "Lessons currently in progress"
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
    """
    Enroll student in a course, handling payment if required.

    Example:
    mutation {
      enrollInCourse(input: {
        courseId: "course-123"
        paymentInfo: {
          paymentId: "pi_1234567890"
          amount: 99.99
          currency: "USD"
        }
      }) {
        id
        student {
          profile {
            fullName
          }
        }
        course {
          title
        }
        enrolledAt
        status
      }
    }

    Requirements: 5.1, 5.2
    """
    enrollInCourse(input: EnrollInCourseInput!): Enrollment!

    """
    Update progress for a specific lesson including time spent and quiz scores.

    Example:
    mutation {
      updateLessonProgress(input: {
        enrollmentId: "enrollment-123"
        lessonId: "lesson-456"
        progress: {
          status: COMPLETED
          timeSpentSeconds: 1800
          quizScore: 85
        }
      }) {
        id
        status
        timeSpentSeconds
        quizScore
        completedAt
      }
    }

    Requirements: 5.4
    """
    updateLessonProgress(input: UpdateLessonProgressInput!): LessonProgress!

    """
    Withdraw student from course, updating enrollment status.

    Example:
    mutation {
      withdrawEnrollment(input: {
        enrollmentId: "enrollment-123"
        reason: "Schedule conflict"
      })
    }

    Requirements: 5.7
    """
    withdrawEnrollment(input: WithdrawEnrollmentInput!): Boolean!

    # Progress management
    """
    Mark lesson as completed and update overall course progress.

    Example:
    mutation {
      completeLesson(enrollmentId: "enrollment-123", lessonId: "lesson-456") {
        id
        status
        completedAt
        enrollment {
          progressPercentage
        }
      }
    }

    Requirements: 5.4, 5.5
    """
    completeLesson(enrollmentId: ID!, lessonId: ID!): LessonProgress!

    """
    Reset lesson progress allowing student to retake content.

    Example:
    mutation {
      resetLessonProgress(enrollmentId: "enrollment-123", lessonId: "lesson-456") {
        id
        status
        timeSpentSeconds
        attemptsCount
      }
    }

    Requirements: 5.4
    """
    resetLessonProgress(enrollmentId: ID!, lessonId: ID!): LessonProgress!

    # Certificate management
    """
    Regenerate certificate for completed course enrollment.

    Example:
    mutation {
      regenerateCertificate(enrollmentId: "enrollment-123") {
        id
        certificateId
        pdfUrl
        verificationUrl
        issuedAt
      }
    }

    Requirements: 5.6, 5.7
    """
    regenerateCertificate(enrollmentId: ID!): Certificate!
  }

  # Queries
  type Query {
    """
    Get current user's enrollments with optional status filtering.

    Example:
    query {
      myEnrollments(status: ACTIVE, first: 10) {
        edges {
          node {
            id
            course {
              title
              instructor {
                profile {
                  fullName
                }
              }
            }
            progressPercentage
            lastAccessedAt
          }
        }
        totalCount
      }
    }

    Requirements: 21.2, 21.7
    """
    myEnrollments(status: EnrollmentStatus, first: Int, after: String): EnrollmentsConnection!

    """
    Get specific enrollment details by ID.

    Example:
    query {
      enrollment(id: "enrollment-123") {
        id
        progressPercentage
        completedLessonsCount
        totalLessonsCount
        certificate {
          certificateId
          pdfUrl
        }
      }
    }

    Requirements: 21.2
    """
    enrollment(id: ID!): Enrollment

    """
    Get detailed progress summary for an enrollment.

    Example:
    query {
      enrollmentProgress(enrollmentId: "enrollment-123") {
        totalLessons
        completedLessons
        progressPercentage
        nextRecommendedLesson {
          lessonTitle
          moduleTitle
        }
        strugglingAreas
      }
    }

    Requirements: 5.4, 21.2
    """
    enrollmentProgress(enrollmentId: ID!): ProgressSummary!

    """
    Verify certificate authenticity using certificate ID.

    Example:
    query {
      verifyCertificate(certificateId: "CERT-2024-001234") {
        studentName
        courseTitle
        instructorName
        completionDate
        isExpired
      }
    }

    Requirements: 5.7, 21.2
    """
    verifyCertificate(certificateId: String!): Certificate

    """
    Get all certificates earned by the current user.

    Example:
    query {
      myCertificates {
        id
        certificateId
        enrollment {
          course {
            title
          }
        }
        issuedAt
        pdfUrl
      }
    }

    Requirements: 5.6, 21.2
    """
    myCertificates: [Certificate!]!

    """
    Check if student is eligible to enroll in a specific course.

    Example:
    query {
      checkEnrollmentEligibility(
        studentId: "student-123"
        courseId: "course-456"
      ) {
        eligible
        reasons
        requiresPayment
        paymentAmount
      }
    }

    Requirements: 5.1, 21.2
    """
    checkEnrollmentEligibility(studentId: ID!, courseId: ID!): EnrollmentEligibility!

    """
    Check if student can access a specific lesson based on prerequisites.

    Example:
    query {
      checkLessonAccess(
        enrollmentId: "enrollment-123"
        lessonId: "lesson-456"
      ) {
        canAccess
        reasons
        prerequisiteModules {
          moduleTitle
          isCompleted
        }
      }
    }

    Requirements: 5.8, 21.2
    """
    checkLessonAccess(enrollmentId: ID!, lessonId: ID!): LessonAccess!

    """
    Get enrollments for a specific course (educator access).

    Example:
    query {
      courseEnrollments(
        courseId: "course-123"
        filters: {
          status: ACTIVE
        }
        pagination: {
          first: 20
        }
      ) {
        edges {
          node {
            student {
              profile {
                fullName
              }
            }
            progressPercentage
            enrolledAt
          }
        }
        totalCount
      }
    }

    Requirements: 21.2, 21.3
    """
    courseEnrollments(
      courseId: ID!
      filters: EnrollmentFiltersInput
      pagination: PaginationInput
    ): EnrollmentsConnection!

    """
    Get all enrollments for a specific student (admin access).

    Example:
    query {
      studentEnrollments(
        studentId: "student-123"
        filters: {
          status: COMPLETED
        }
        pagination: {
          first: 10
        }
      ) {
        edges {
          node {
            course {
              title
            }
            completedAt
            certificate {
              certificateId
            }
          }
        }
        totalCount
      }
    }

    Requirements: 21.2, 21.3
    """
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
