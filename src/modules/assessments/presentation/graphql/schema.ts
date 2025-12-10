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
    createQuiz(input: CreateQuizInput!): Quiz!
    updateQuiz(id: ID!, input: UpdateQuizInput!): Quiz!
    deleteQuiz(id: ID!): Boolean!
    
    # Question mutations
    addQuestion(input: CreateQuestionInput!): Question!
    updateQuestion(id: ID!, input: UpdateQuestionInput!): Question!
    deleteQuestion(id: ID!): Boolean!
    
    # Quiz attempt mutations
    startQuizAttempt(quizId: ID!): QuizSubmission!
    submitQuizAnswer(submissionId: ID!, input: SubmitQuizAnswerInput!): Boolean!
    submitQuiz(submissionId: ID!): QuizSubmission!
    gradeQuizSubmission(submissionId: ID!, input: GradeQuizInput!): QuizSubmission!
    
    # Assignment mutations
    createAssignment(input: CreateAssignmentInput!): Assignment!
    updateAssignment(id: ID!, input: UpdateAssignmentInput!): Assignment!
    deleteAssignment(id: ID!): Boolean!
    
    # Assignment submission mutations
    submitAssignment(input: SubmitAssignmentInput!): AssignmentSubmission!
    gradeAssignment(submissionId: ID!, input: GradeAssignmentInput!): AssignmentSubmission!
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