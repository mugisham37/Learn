/**
 * GraphQL Schema for Courses Module
 * 
 * Defines GraphQL types, inputs, and schema for course creation,
 * management, module and lesson operations.
 * 
 * Requirements: 21.1, 21.2
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for courses module
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const courseTypeDefs = gql`
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

  # Enums
  enum LessonType {
    VIDEO
    TEXT
    QUIZ
    ASSIGNMENT
  }

  enum CourseStatus {
    DRAFT
    PENDING_REVIEW
    PUBLISHED
    ARCHIVED
  }

  enum Difficulty {
    BEGINNER
    INTERMEDIATE
    ADVANCED
  }

  # Object Types
  type Course {
    id: ID!
    instructor: User!
    title: String!
    description: String!
    slug: String!
    category: String!
    difficulty: Difficulty!
    price: Decimal!
    currency: String!
    enrollmentLimit: Int
    enrollmentCount: Int!
    averageRating: Float
    totalReviews: Int!
    status: CourseStatus!
    publishedAt: DateTime
    thumbnailUrl: String
    modules: [CourseModule!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CourseModule {
    id: ID!
    course: Course!
    title: String!
    description: String
    orderNumber: Int!
    durationMinutes: Int!
    prerequisiteModule: CourseModule
    lessons: [Lesson!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Lesson {
    id: ID!
    module: CourseModule!
    title: String!
    description: String
    type: LessonType!
    contentUrl: String
    contentText: String
    durationMinutes: Int
    orderNumber: Int!
    isPreview: Boolean!
    metadata: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Connection types for pagination
  type CourseConnection {
    edges: [CourseEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CourseEdge {
    node: Course!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Input Types
  input CreateCourseInput {
    title: String!
    description: String!
    category: String!
    difficulty: Difficulty!
    price: Decimal
    currency: String
    enrollmentLimit: Int
    thumbnailUrl: String
  }

  input UpdateCourseInput {
    title: String
    description: String
    category: String
    difficulty: Difficulty
    price: Decimal
    currency: String
    enrollmentLimit: Int
    thumbnailUrl: String
  }

  input CreateModuleInput {
    title: String!
    description: String
    orderNumber: Int!
    prerequisiteModuleId: ID
  }

  input UpdateModuleInput {
    title: String
    description: String
    orderNumber: Int
    prerequisiteModuleId: ID
  }

  input CreateLessonInput {
    title: String!
    description: String
    type: LessonType!
    contentUrl: String
    contentText: String
    durationMinutes: Int
    orderNumber: Int!
    isPreview: Boolean
  }

  input UpdateLessonInput {
    title: String
    description: String
    contentUrl: String
    contentText: String
    durationMinutes: Int
    orderNumber: Int
    isPreview: Boolean
  }

  input ReorderModulesInput {
    moduleIds: [ID!]!
  }

  input ReorderLessonsInput {
    lessonIds: [ID!]!
  }

  input CourseFilter {
    status: CourseStatus
    category: String
    difficulty: Difficulty
    instructorId: ID
    minPrice: Decimal
    maxPrice: Decimal
    minRating: Float
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  # Publication validation result
  type PublicationValidationResult {
    canPublish: Boolean!
    reasons: [String!]!
  }

  # Mutations
  type Mutation {
    # Course mutations
    createCourse(input: CreateCourseInput!): Course!
    updateCourse(id: ID!, input: UpdateCourseInput!): Course!
    publishCourse(id: ID!): Course!
    deleteCourse(id: ID!): Boolean!
    
    # Module mutations
    addModule(courseId: ID!, input: CreateModuleInput!): CourseModule!
    updateModule(id: ID!, input: UpdateModuleInput!): CourseModule!
    deleteModule(id: ID!): Boolean!
    reorderModules(courseId: ID!, input: ReorderModulesInput!): [CourseModule!]!
    
    # Lesson mutations
    addLesson(moduleId: ID!, input: CreateLessonInput!): Lesson!
    updateLesson(id: ID!, input: UpdateLessonInput!): Lesson!
    deleteLesson(id: ID!): Boolean!
    reorderLessons(moduleId: ID!, input: ReorderLessonsInput!): [Lesson!]!
  }

  # Queries
  type Query {
    # Single course queries
    course(id: ID!): Course
    courseBySlug(slug: String!): Course
    
    # Course list queries with pagination and filtering
    courses(
      filter: CourseFilter
      pagination: PaginationInput
    ): CourseConnection!
    
    # My courses (requires authentication)
    myCourses(
      filter: CourseFilter
      pagination: PaginationInput
    ): CourseConnection!
    
    # Publication validation
    validateCoursePublication(id: ID!): PublicationValidationResult!
  }
`;