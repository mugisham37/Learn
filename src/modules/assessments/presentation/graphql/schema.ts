/**
 * GraphQL Schema for Assessments Module
 * 
 * Defines GraphQL types, inputs, and schema for quiz and assignment creation,
 * management, submission tracking, and grading workflows.
 * 
 * Requirements: 21.1, 21.2
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for assessments module
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const assessmentTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # User type (from users module)
  type User {
    id: ID!
    email: String!
    role: String!
    profile: UserProfile
  }

  type UserProfile {
    fullName: String!
    avatarUrl: String
  }

  # Lesson type (from courses module)
  type Lesson {
    id: ID!
    title: String!
    type: String!
  }

  # Enums
  enum QuestionType {
    MULTIPLE_CHOICE
    TRUE_FALSE
    SHORT_ANSWER
    ESSAY
    FILL_BLANK
    MATCHING
  }

  enum QuizType {
    FORMATIVE
    SUMMATIVE
    PRACTICE
  }

  enum Difficulty {
    EASY
    MEDIUM
    HARD
  }

  enum GradingStatus {
    AUTO_GRADED
    PENDING_REVIEW
    GRADED
    REVISION_REQUESTED
  }

  enum AssignmentGradingStatus {
    SUBMITTED
    UNDER_REVIEW
    GRADED
    REVISION_REQUESTED
  }

  # Object Types - Quiz Related
  type Quiz {
    id: ID!
    lesson: Lesson!
    title: String!
    description: String
    quizType: QuizType!
    config: QuizConfig!
    questions: [Question!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type QuizConfig {
    timeLimitMinutes: Int
    passingScorePercentage: Int!
    maxAttempts: Int!
    randomizeQuestions: Boolean!
    randomizeOptions: Boolean!
    showCorrectAnswers: Boolean!
    showExplanations: Boolean!
    availableFrom: DateTime
    availableUntil: DateTime
  }

  type Question {
    id: ID!
    quiz: Quiz!
    questionType: QuestionType!
    questionText: String!
    questionMediaUrl: String
    options: JSON
    explanation: String
    points: Int!
    orderNumber: Int!
    difficulty: Difficulty!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type QuizSubmission {
    id: ID!
    quiz: Quiz!
    student: User!
    attemptNumber: Int!
    startedAt: DateTime!
    submittedAt: DateTime
    timeTakenSeconds: Int
    scorePercentage: Float
    pointsEarned: Float
    totalPoints: Int!
    answers: JSON!
    gradingStatus: GradingStatus!
    feedback: String
    gradedBy: User
    gradedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Object Types - Assignment Related
  type Assignment {
    id: ID!
    lesson: Lesson!
    title: String!
    description: String
    instructions: String!
    config: AssignmentConfig!
    submissions: [AssignmentSubmission!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AssignmentConfig {
    dueDate: DateTime!
    lateSubmissionAllowed: Boolean!
    latePenaltyPercentage: Float!
    maxPoints: Int!
    requiresFileUpload: Boolean!
    allowedFileTypes: [String!]!
    maxFileSizeMb: Float!
    rubric: JSON
  }

  type AssignmentSubmission {
    id: ID!
    assignment: Assignment!
    student: User!
    file: SubmissionFile
    submissionText: String
    submittedAt: DateTime!
    isLate: Boolean!
    pointsAwarded: Float
    feedback: String
    gradingStatus: AssignmentGradingStatus!
    gradedAt: DateTime
    gradedBy: User
    revisionNumber: Int!
    parentSubmission: AssignmentSubmission
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SubmissionFile {
    url: String!
    name: String!
    sizeBytes: Int!
  }

  # Input Types - Quiz Related
  input CreateQuizInput {
    lessonId: ID!
    title: String!
    description: String
    quizType: QuizType!
    config: QuizConfigInput!
  }

  input UpdateQuizInput {
    title: String
    description: String
    config: QuizConfigInput
  }

  input QuizConfigInput {
    timeLimitMinutes: Int
    passingScorePercentage: Int!
    maxAttempts: Int!
    randomizeQuestions: Boolean!
    randomizeOptions: Boolean!
    showCorrectAnswers: Boolean!
    showExplanations: Boolean!
    availableFrom: DateTime
    availableUntil: DateTime
  }

  input CreateQuestionInput {
    quizId: ID!
    questionType: QuestionType!
    questionText: String!
    questionMediaUrl: String
    options: JSON
    correctAnswer: JSON!
    explanation: String
    points: Int!
    difficulty: Difficulty!
  }

  input UpdateQuestionInput {
    questionText: String
    questionMediaUrl: String
    options: JSON
    correctAnswer: JSON
    explanation: String
    points: Int
    difficulty: Difficulty
  }

  input SubmitQuizAnswerInput {
    questionId: ID!
    answer: JSON!
  }

  # Input Types - Assignment Related
  input CreateAssignmentInput {
    lessonId: ID!
    title: String!
    description: String
    instructions: String!
    config: AssignmentConfigInput!
  }

  input UpdateAssignmentInput {
    title: String
    description: String
    instructions: String
    config: AssignmentConfigInput
  }

  input AssignmentConfigInput {
    dueDate: DateTime!
    lateSubmissionAllowed: Boolean!
    latePenaltyPercentage: Float!
    maxPoints: Int!
    requiresFileUpload: Boolean!
    allowedFileTypes: [String!]!
    maxFileSizeMb: Float!
    rubric: JSON
  }

  input SubmitAssignmentInput {
    assignmentId: ID!
    file: SubmissionFileInput
    submissionText: String
  }

  input SubmissionFileInput {
    url: String!
    name: String!
    sizeBytes: Int!
  }

  input GradeQuizInput {
    pointsEarned: Float!
    feedback: String
  }

  input GradeAssignmentInput {
    pointsAwarded: Float!
    feedback: String
  }

  # Mutations
  type Mutation {
    # Quiz mutations
    """
    Create a new quiz for a lesson with configuration settings.
    
    Example:
    mutation {
      createQuiz(input: {
        lessonId: "lesson-123"
        title: "React Fundamentals Quiz"
        quizType: SUMMATIVE
        config: {
          timeLimitMinutes: 30
          passingScorePercentage: 70
          maxAttempts: 3
          randomizeQuestions: true
        }
      }) {
        id
        title
        config {
          timeLimitMinutes
          maxAttempts
        }
      }
    }
    
    Requirements: 6.1, 6.2
    """
    createQuiz(input: CreateQuizInput!): Quiz!
    
    """
    Start a new quiz attempt for a student.
    
    Example:
    mutation {
      startQuizAttempt(quizId: "quiz-123") {
        id
        attemptNumber
        startedAt
        quiz {
          title
          config {
            timeLimitMinutes
          }
        }
      }
    }
    
    Requirements: 6.3
    """
    startQuizAttempt(quizId: ID!): QuizSubmission!
    
    """
    Submit answer for a specific question during quiz attempt.
    
    Example:
    mutation {
      submitQuizAnswer(
        submissionId: "submission-123"
        input: {
          questionId: "question-456"
          answer: ["Option A", "Option C"]
        }
      )
    }
    
    Requirements: 6.3
    """
    submitQuizAnswer(submissionId: ID!, input: SubmitQuizAnswerInput!): Boolean!
    
    """
    Submit completed quiz for grading and scoring.
    
    Example:
    mutation {
      submitQuiz(submissionId: "submission-123") {
        id
        submittedAt
        scorePercentage
        gradingStatus
        pointsEarned
      }
    }
    
    Requirements: 6.4, 6.5
    """
    submitQuiz(submissionId: ID!): QuizSubmission!
    
    # Assignment mutations
    """
    Create a new assignment for a lesson with requirements and rubric.
    
    Example:
    mutation {
      createAssignment(input: {
        lessonId: "lesson-123"
        title: "Build a React Component"
        instructions: "Create a reusable button component with props"
        config: {
          dueDate: "2024-02-15T23:59:59Z"
          maxPoints: 100
          requiresFileUpload: true
          allowedFileTypes: ["zip", "tar.gz"]
        }
      }) {
        id
        title
        config {
          dueDate
          maxPoints
        }
      }
    }
    
    Requirements: 7.1
    """
    createAssignment(input: CreateAssignmentInput!): Assignment!
    
    """
    Submit assignment with file upload or text response.
    
    Example:
    mutation {
      submitAssignment(input: {
        assignmentId: "assignment-123"
        file: {
          url: "https://s3.amazonaws.com/uploads/student-work.zip"
          name: "react-component.zip"
          sizeBytes: 1024000
        }
        submissionText: "This component implements the requirements..."
      }) {
        id
        submittedAt
        isLate
        file {
          name
          url
        }
      }
    }
    
    Requirements: 7.2, 7.3
    """
    submitAssignment(input: SubmitAssignmentInput!): AssignmentSubmission!
    
    """
    Grade assignment submission with points and feedback.
    
    Example:
    mutation {
      gradeAssignment(
        submissionId: "submission-123"
        input: {
          pointsAwarded: 85
          feedback: "Good implementation, consider error handling"
        }
      ) {
        id
        pointsAwarded
        feedback
        gradingStatus
        gradedAt
      }
    }
    
    Requirements: 7.4, 7.7
    """
    gradeAssignment(submissionId: ID!, input: GradeAssignmentInput!): AssignmentSubmission!
    
    """
    Request revision on assignment submission with specific feedback.
    
    Example:
    mutation {
      requestRevision(
        submissionId: "submission-123"
        feedback: "Please add unit tests and improve documentation"
      ) {
        id
        gradingStatus
        feedback
        revisionNumber
      }
    }
    
    Requirements: 7.5, 7.6
    """
    requestRevision(submissionId: ID!, feedback: String!): AssignmentSubmission!
  }

  # Queries
  type Query {
    # Quiz queries
    quiz(id: ID!): Quiz
    quizzesByLesson(lessonId: ID!): [Quiz!]!
    
    # Question queries
    question(id: ID!): Question
    questionsByQuiz(quizId: ID!): [Question!]!
    
    # Quiz submission queries
    quizSubmission(id: ID!): QuizSubmission
    quizSubmissionsByStudent(quizId: ID!): [QuizSubmission!]!
    quizSubmissionsByQuiz(quizId: ID!): [QuizSubmission!]!
    
    # Assignment queries
    assignment(id: ID!): Assignment
    assignmentsByLesson(lessonId: ID!): [Assignment!]!
    
    # Assignment submission queries
    assignmentSubmission(id: ID!): AssignmentSubmission
    assignmentSubmissionsByStudent(assignmentId: ID!): [AssignmentSubmission!]!
    assignmentSubmissionsByAssignment(assignmentId: ID!): [AssignmentSubmission!]!
  }
`;