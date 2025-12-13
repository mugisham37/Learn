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
  "Custom scalar type for date and time values in ISO 8601 format"
  scalar DateTime

  "Custom scalar type for arbitrary JSON data"
  scalar JSON

  "Custom scalar type for decimal numbers with precision (e.g., prices)"
  scalar Decimal

  # User type (from users module)
  "User entity reference for course instructors and participants"
  type User {
    "Unique identifier for the user"
    id: ID!
    "User's email address"
    email: String!
    "User's role (STUDENT, EDUCATOR, ADMIN)"
    role: String!
    "User's profile information"
    profile: UserProfile
    "Timestamp when the user account was created"
    createdAt: DateTime!
  }

  "User profile information for display purposes"
  type UserProfile {
    "User's full display name"
    fullName: String!
    "Optional biographical information"
    bio: String
    "URL to user's profile avatar image"
    avatarUrl: String
  }

  # Enums
  "Types of lessons that can be included in course modules"
  enum LessonType {
    "Video-based lesson with streaming content"
    VIDEO
    "Text-based lesson with written content"
    TEXT
    "Interactive quiz with questions and answers"
    QUIZ
    "Assignment requiring file submission or text response"
    ASSIGNMENT
  }

  "Course publication and lifecycle status"
  enum CourseStatus {
    "Course is being created and not yet ready for students"
    DRAFT
    "Course submitted for review before publication"
    PENDING_REVIEW
    "Course is live and available for enrollment"
    PUBLISHED
    "Course is no longer active but remains accessible to enrolled students"
    ARCHIVED
  }

  "Course difficulty levels for student guidance and filtering"
  enum Difficulty {
    "Suitable for students with no prior knowledge"
    BEGINNER
    "Requires some foundational knowledge in the subject"
    INTERMEDIATE
    "Designed for students with significant experience"
    ADVANCED
  }

  # Object Types
  """
  Core course entity representing a complete educational program.
  Contains metadata, content structure, and enrollment information.
  """
  type Course {
    "Unique identifier for the course"
    id: ID!
    "Course instructor/creator with full user information"
    instructor: User!
    "Course title displayed to students and in search results"
    title: String!
    "Detailed course description explaining content and objectives"
    description: String!
    "URL-friendly slug generated from title for course pages"
    slug: String!
    "Course category for organization and filtering (e.g., 'Programming', 'Design')"
    category: String!
    "Course difficulty level for student guidance"
    difficulty: Difficulty!
    "Course price in the specified currency (0 for free courses)"
    price: Decimal!
    "Currency code for the course price (e.g., 'USD', 'EUR')"
    currency: String!
    "Maximum number of students that can enroll (null for unlimited)"
    enrollmentLimit: Int
    "Current number of enrolled students"
    enrollmentCount: Int!
    "Average rating from student reviews (1-5 scale)"
    averageRating: Float
    "Total number of student reviews submitted"
    totalReviews: Int!
    "Current publication status of the course"
    status: CourseStatus!
    "Timestamp when the course was published (null if not published)"
    publishedAt: DateTime
    "URL to course thumbnail image for display"
    thumbnailUrl: String
    "Ordered list of course modules containing lessons"
    modules: [CourseModule!]!
    "Timestamp when the course was created"
    createdAt: DateTime!
    "Timestamp when the course was last updated"
    updatedAt: DateTime!
  }

  """
  Course module representing a logical grouping of related lessons.
  Modules provide structure and can have prerequisites for sequential learning.
  """
  type CourseModule {
    "Unique identifier for the module"
    id: ID!
    "Parent course containing this module"
    course: Course!
    "Module title describing the learning objectives"
    title: String!
    "Optional detailed description of module content"
    description: String
    "Sequential order number within the course (1-based)"
    orderNumber: Int!
    "Total estimated duration in minutes for all module lessons"
    durationMinutes: Int!
    "Optional prerequisite module that must be completed first"
    prerequisiteModule: CourseModule
    "Ordered list of lessons within this module"
    lessons: [Lesson!]!
    "Timestamp when the module was created"
    createdAt: DateTime!
    "Timestamp when the module was last updated"
    updatedAt: DateTime!
  }

  """
  Individual lesson within a course module containing specific content.
  Lessons can be videos, text, quizzes, or assignments with type-specific properties.
  """
  type Lesson {
    "Unique identifier for the lesson"
    id: ID!
    "Parent module containing this lesson"
    module: CourseModule!
    "Lesson title describing the specific learning objective"
    title: String!
    "Optional detailed description of lesson content"
    description: String
    "Type of lesson determining content format and interaction"
    type: LessonType!
    "URL to lesson content (video, document, etc.) if applicable"
    contentUrl: String
    "Text content for text-based lessons"
    contentText: String
    "Estimated duration in minutes to complete the lesson"
    durationMinutes: Int
    "Sequential order number within the module (1-based)"
    orderNumber: Int!
    "Whether lesson is available as preview to non-enrolled students"
    isPreview: Boolean!
    "Additional lesson metadata (quiz questions, assignment requirements, etc.)"
    metadata: JSON!
    "Timestamp when the lesson was created"
    createdAt: DateTime!
    "Timestamp when the lesson was last updated"
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
    """
    Create a new course with basic information. Only educators can create courses.

    Example:
    mutation {
      createCourse(input: {
        title: "Introduction to React"
        description: "Learn React fundamentals with hands-on projects"
        category: "Programming"
        difficulty: BEGINNER
        price: 99.99
        currency: "USD"
      }) {
        id
        title
        slug
        status
        instructor {
          profile {
            fullName
          }
        }
      }
    }

    Requirements: 3.1
    """
    createCourse(input: CreateCourseInput!): Course!

    """
    Update existing course information. Only course instructor can update.

    Example:
    mutation {
      updateCourse(id: "course-123", input: {
        title: "Advanced React Patterns"
        price: 149.99
      }) {
        id
        title
        price
        updatedAt
      }
    }

    Requirements: 3.6
    """
    updateCourse(id: ID!, input: UpdateCourseInput!): Course!

    """
    Publish course making it available for student enrollment.
    Validates minimum content requirements before publishing.

    Example:
    mutation {
      publishCourse(id: "course-123") {
        id
        status
        publishedAt
      }
    }

    Requirements: 3.5
    """
    publishCourse(id: ID!): Course!

    """
    Delete course and all associated content. Only course instructor can delete.

    Example:
    mutation {
      deleteCourse(id: "course-123")
    }

    Requirements: 3.7
    """
    deleteCourse(id: ID!): Boolean!

    # Module mutations
    """
    Add new module to existing course with sequential ordering.

    Example:
    mutation {
      addModule(courseId: "course-123", input: {
        title: "Getting Started"
        description: "Introduction and setup"
        orderNumber: 1
      }) {
        id
        title
        orderNumber
        course {
          title
        }
      }
    }

    Requirements: 3.2
    """
    addModule(courseId: ID!, input: CreateModuleInput!): CourseModule!

    """
    Update existing module information and prerequisites.

    Example:
    mutation {
      updateModule(id: "module-123", input: {
        title: "Advanced Concepts"
        prerequisiteModuleId: "module-456"
      }) {
        id
        title
        prerequisiteModule {
          title
        }
      }
    }

    Requirements: 3.2
    """
    updateModule(id: ID!, input: UpdateModuleInput!): CourseModule!

    """
    Delete module and all contained lessons.

    Example:
    mutation {
      deleteModule(id: "module-123")
    }

    Requirements: 3.7
    """
    deleteModule(id: ID!): Boolean!

    """
    Reorder modules within a course by providing new sequence.

    Example:
    mutation {
      reorderModules(courseId: "course-123", input: {
        moduleIds: ["module-2", "module-1", "module-3"]
      }) {
        id
        title
        orderNumber
      }
    }

    Requirements: 3.4
    """
    reorderModules(courseId: ID!, input: ReorderModulesInput!): [CourseModule!]!

    # Lesson mutations
    """
    Add new lesson to existing module with type-specific content.

    Example:
    mutation {
      addLesson(moduleId: "module-123", input: {
        title: "React Components"
        type: VIDEO
        contentUrl: "https://videos.example.com/react-components.mp4"
        durationMinutes: 15
        orderNumber: 1
        isPreview: true
      }) {
        id
        title
        type
        durationMinutes
        isPreview
      }
    }

    Requirements: 3.3
    """
    addLesson(moduleId: ID!, input: CreateLessonInput!): Lesson!

    """
    Update existing lesson content and properties.

    Example:
    mutation {
      updateLesson(id: "lesson-123", input: {
        title: "Advanced React Components"
        durationMinutes: 20
      }) {
        id
        title
        durationMinutes
        updatedAt
      }
    }

    Requirements: 3.3
    """
    updateLesson(id: ID!, input: UpdateLessonInput!): Lesson!

    """
    Delete lesson from module.

    Example:
    mutation {
      deleteLesson(id: "lesson-123")
    }

    Requirements: 3.7
    """
    deleteLesson(id: ID!): Boolean!

    """
    Reorder lessons within a module by providing new sequence.

    Example:
    mutation {
      reorderLessons(moduleId: "module-123", input: {
        lessonIds: ["lesson-2", "lesson-1", "lesson-3"]
      }) {
        id
        title
        orderNumber
      }
    }

    Requirements: 3.4
    """
    reorderLessons(moduleId: ID!, input: ReorderLessonsInput!): [Lesson!]!
  }

  # Queries
  type Query {
    """
    Get single course by ID with complete module and lesson structure.

    Example:
    query {
      course(id: "course-123") {
        id
        title
        description
        instructor {
          profile {
            fullName
          }
        }
        modules {
          title
          lessons {
            title
            type
            durationMinutes
          }
        }
      }
    }

    Requirements: 21.2
    """
    course(id: ID!): Course

    """
    Get course by URL slug for public course pages.

    Example:
    query {
      courseBySlug(slug: "introduction-to-react") {
        id
        title
        description
        price
        enrollmentCount
        averageRating
      }
    }

    Requirements: 21.2
    """
    courseBySlug(slug: String!): Course

    """
    Search and filter courses with pagination support.

    Example:
    query {
      courses(
        filter: {
          category: "Programming"
          difficulty: BEGINNER
          maxPrice: 100.00
        }
        pagination: {
          first: 10
          after: "cursor-123"
        }
      ) {
        edges {
          node {
            id
            title
            price
            averageRating
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }

    Requirements: 21.2, 8.1
    """
    courses(filter: CourseFilter, pagination: PaginationInput): CourseConnection!

    """
    Get courses created by the authenticated educator.

    Example:
    query {
      myCourses(
        filter: {
          status: PUBLISHED
        }
        pagination: {
          first: 20
        }
      ) {
        edges {
          node {
            id
            title
            status
            enrollmentCount
            averageRating
          }
        }
        totalCount
      }
    }

    Requirements: 21.2, 21.7
    """
    myCourses(filter: CourseFilter, pagination: PaginationInput): CourseConnection!

    """
    Validate if course meets requirements for publication.

    Example:
    query {
      validateCoursePublication(id: "course-123") {
        canPublish
        reasons
      }
    }

    Requirements: 3.5
    """
    validateCoursePublication(id: ID!): PublicationValidationResult!
  }
`;
