/**
 * GraphQL Schema for Search Module
 *
 * Defines GraphQL types, inputs, and schema for search operations
 * including course search, lesson search, autocomplete, and trending searches.
 *
 * Requirements: 21.1, 21.2
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for search module
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
export const searchTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON
  scalar Decimal

  # Enums
  enum SortOption {
    RELEVANCE
    POPULARITY
    RATING
    PRICE
    CREATED
    UPDATED
    TRENDING
  }

  enum SortOrder {
    ASC
    DESC
  }

  enum LessonType {
    VIDEO
    TEXT
    QUIZ
    ASSIGNMENT
  }

  enum Difficulty {
    BEGINNER
    INTERMEDIATE
    ADVANCED
  }

  enum CourseStatus {
    DRAFT
    PENDING_REVIEW
    PUBLISHED
    ARCHIVED
  }

  # Search Result Types
  type SearchResult {
    documents: [CourseSearchResult!]!
    total: Int!
    took: Int!
    maxScore: Float
    facets: SearchFacets
    suggestions: [String!]
  }

  type LessonSearchResults {
    documents: [LessonSearchResult!]!
    total: Int!
    took: Int!
    maxScore: Float
  }

  type CourseSearchResult {
    id: ID!
    title: String!
    description: String!
    slug: String!
    instructorId: ID!
    instructorName: String!
    category: String!
    difficulty: Difficulty!
    price: Decimal!
    currency: String!
    status: CourseStatus!
    enrollmentCount: Int!
    averageRating: Float
    totalReviews: Int!
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    modules: [CourseModuleSearchResult!]!
    lessonContent: String!
    searchBoost: Float
    popularityScore: Float
    recentEnrollmentVelocity: Float
    highlight: JSON
  }

  type CourseModuleSearchResult {
    id: ID!
    title: String!
    description: String
    orderNumber: Int!
    durationMinutes: Int!
  }

  type LessonSearchResult {
    id: ID!
    moduleId: ID!
    courseId: ID!
    title: String!
    description: String
    lessonType: LessonType!
    contentText: String
    durationMinutes: Int
    orderNumber: Int!
    isPreview: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    courseTitle: String!
    courseCategory: String!
    courseDifficulty: Difficulty!
    highlight: JSON
  }

  # Search Facets
  type SearchFacets {
    categories: [SearchFacet!]!
    difficulties: [SearchFacet!]!
    priceRanges: [PriceRangeFacet!]!
    ratings: [RatingFacet!]!
    languages: [SearchFacet!]!
  }

  type SearchFacet {
    key: String!
    count: Int!
  }

  type PriceRangeFacet {
    key: String!
    count: Int!
    from: Float
    to: Float
  }

  type RatingFacet {
    key: String!
    count: Int!
    from: Float
  }

  # Input Types
  input SearchFilters {
    category: [String!]
    difficulty: [String!]
    priceRange: PriceRangeInput
    rating: RatingInput
    status: [String!]
    language: [String!]
  }

  input PriceRangeInput {
    min: Float
    max: Float
  }

  input RatingInput {
    min: Float
  }

  input SearchPagination {
    from: Int
    size: Int
  }

  input SearchSort {
    field: SortOption!
    order: SortOrder!
  }

  # Queries
  type Query {
    # Course search with full-text search, filters, and facets
    searchCourses(
      query: String!
      filters: SearchFilters
      pagination: SearchPagination
      sort: SearchSort
      includeFacets: Boolean
    ): SearchResult!

    # Lesson search within a course or across all courses
    searchLessons(query: String!, courseId: ID, pagination: SearchPagination): LessonSearchResults!

    # Autocomplete suggestions for search queries
    autocomplete(query: String!, limit: Int): [String!]!

    # Trending search terms based on recent activity
    trendingSearches(limit: Int): [String!]!

    # Search health and statistics
    searchHealth: SearchHealthResult!
  }

  # Search health result
  type SearchHealthResult {
    healthy: Boolean!
    indices: SearchIndicesHealth!
    statistics: SearchStatistics
    error: String
  }

  type SearchIndicesHealth {
    courses: Boolean!
    lessons: Boolean!
  }

  type SearchStatistics {
    coursesIndexed: Int!
    lessonsIndexed: Int!
  }
`;
