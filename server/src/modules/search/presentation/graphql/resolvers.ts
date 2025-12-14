/**
 * GraphQL Resolvers for Search Module
 *
 * Implements GraphQL resolvers for search operations including course search,
 * lesson search, autocomplete, and trending searches with proper error handling
 * and pagination support.
 *
 * Requirements: 21.2
 */

import { GraphQLError } from 'graphql';

import type { ISearchService } from '../../application/services/ISearchService.js';

/**
 * GraphQL context interface
 */
export interface SearchGraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  searchService: ISearchService;
}

/**
 * Input type interfaces matching GraphQL schema
 */
interface SearchFilters {
  category?: string[];
  difficulty?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  rating?: {
    min?: number;
  };
  status?: string[];
  language?: string[];
}

interface SearchPagination {
  from?: number;
  size?: number;
}

interface SearchSort {
  field: 'RELEVANCE' | 'POPULARITY' | 'RATING' | 'PRICE' | 'CREATED' | 'UPDATED' | 'TRENDING';
  order: 'ASC' | 'DESC';
}

/**
 * Helper function to convert GraphQL sort field to service interface
 */
function mapSortFieldFromGraphQL(
  field: string
): 'relevance' | 'popularity' | 'rating' | 'price' | 'created' | 'updated' | 'trending' {
  switch (field) {
    case 'RELEVANCE':
      return 'relevance';
    case 'POPULARITY':
      return 'popularity';
    case 'RATING':
      return 'rating';
    case 'PRICE':
      return 'price';
    case 'CREATED':
      return 'created';
    case 'UPDATED':
      return 'updated';
    case 'TRENDING':
      return 'trending';
    default:
      return 'relevance';
  }
}

/**
 * Helper function to convert GraphQL sort order to service interface
 */
function mapSortOrderFromGraphQL(order: string): 'asc' | 'desc' {
  return order === 'ASC' ? 'asc' : 'desc';
}

/**
 * Helper function to convert GraphQL difficulty to domain values
 */
function mapDifficultyFromGraphQL(difficulties: string[]): string[] {
  return difficulties.map((difficulty) => {
    switch (difficulty) {
      case 'BEGINNER':
        return 'beginner';
      case 'INTERMEDIATE':
        return 'intermediate';
      case 'ADVANCED':
        return 'advanced';
      default:
        return difficulty.toLowerCase();
    }
  });
}

/**
 * Helper function to convert domain difficulty to GraphQL enum
 */
function mapDifficultyToGraphQL(difficulty: string): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
  switch (difficulty) {
    case 'beginner':
      return 'BEGINNER';
    case 'intermediate':
      return 'INTERMEDIATE';
    case 'advanced':
      return 'ADVANCED';
    default:
      throw new Error(`Unknown difficulty: ${difficulty}`);
  }
}

/**
 * Helper function to convert domain course status to GraphQL enum
 */
function mapCourseStatusToGraphQL(
  status: string
): 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED' {
  switch (status) {
    case 'draft':
      return 'DRAFT';
    case 'pending_review':
      return 'PENDING_REVIEW';
    case 'published':
      return 'PUBLISHED';
    case 'archived':
      return 'ARCHIVED';
    default:
      throw new Error(`Unknown status: ${status}`);
  }
}

/**
 * Helper function to convert domain lesson type to GraphQL enum
 */
function mapLessonTypeToGraphQL(type: string): 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT' {
  switch (type) {
    case 'video':
      return 'VIDEO';
    case 'text':
      return 'TEXT';
    case 'quiz':
      return 'QUIZ';
    case 'assignment':
      return 'ASSIGNMENT';
    default:
      throw new Error(`Unknown lesson type: ${type}`);
  }
}

/**
 * Helper function to handle Elasticsearch errors
 */
function handleSearchError(error: unknown, operation: string): never {
  console.error(`Search ${operation} failed:`, error);

  // Check for specific Elasticsearch errors
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('index_not_found_exception')) {
    throw new GraphQLError('Search index not available', {
      extensions: {
        code: 'SEARCH_INDEX_UNAVAILABLE',
        http: { status: 503 },
      },
    });
  }

  if (errorMessage.includes('parsing_exception')) {
    throw new GraphQLError('Invalid search query', {
      extensions: {
        code: 'INVALID_SEARCH_QUERY',
        http: { status: 400 },
      },
    });
  }

  // Generic search error
  throw new GraphQLError(`Search ${operation} failed`, {
    extensions: {
      code: 'SEARCH_ERROR',
      http: { status: 500 },
    },
  });
}

/**
 * GraphQL resolvers for search module
 */
export const searchResolvers = {
  Query: {
    /**
     * Search courses with full-text search, filters, and facets
     */
    searchCourses: async (
      _parent: unknown,
      args: {
        query: string;
        filters?: SearchFilters;
        pagination?: SearchPagination;
        sort?: SearchSort;
        includeFacets?: boolean;
      },
      context: SearchGraphQLContext
    ): Promise<{
      documents: unknown[];
      total: number;
      took: number;
      maxScore?: number;
      facets?: unknown;
      suggestions: string[];
    }> => {
      try {
        // Validate query parameter
        if (!args.query || args.query.trim().length === 0) {
          throw new GraphQLError('Search query is required', {
            extensions: {
              code: 'INVALID_INPUT',
              http: { status: 400 },
            },
          });
        }

        // Convert GraphQL inputs to service interfaces
        const filters = args.filters
          ? {
              category: args.filters.category,
              difficulty: args.filters.difficulty
                ? mapDifficultyFromGraphQL(args.filters.difficulty)
                : undefined,
              priceRange: args.filters.priceRange,
              rating: args.filters.rating,
              status: args.filters.status?.map((s) => s.toLowerCase()),
              language: args.filters.language,
            }
          : {};

        const pagination = {
          from: args.pagination?.from || 0,
          size: Math.min(args.pagination?.size || 20, 100), // Cap at 100 results
        };

        const sort = args.sort
          ? {
              field: mapSortFieldFromGraphQL(args.sort.field),
              order: mapSortOrderFromGraphQL(args.sort.order),
            }
          : { field: 'relevance' as const, order: 'desc' as const };

        const includeFacets = args.includeFacets !== false; // Default to true

        // Perform search
        const searchResult = await context.searchService.searchCourses(
          args.query.trim(),
          filters,
          pagination,
          sort,
          includeFacets
        );

        // Transform results to match GraphQL schema
        return {
          documents: searchResult.documents.map((course) => ({
            ...course,
            difficulty: mapDifficultyToGraphQL(course.difficulty),
            status: mapCourseStatusToGraphQL(course.status),
            price: course.price.toString(),
            highlight: course._highlight || null,
          })),
          total: searchResult.total,
          took: searchResult.took,
          maxScore: searchResult.maxScore,
          facets: searchResult.facets,
          suggestions: searchResult.suggestions || [],
        };
      } catch (error) {
        handleSearchError(error, 'courses');
      }
    },

    /**
     * Search lessons within a course or across all courses
     */
    searchLessons: async (
      _parent: unknown,
      args: {
        query: string;
        courseId?: string;
        pagination?: SearchPagination;
      },
      context: SearchGraphQLContext
    ): Promise<{
      documents: unknown[];
      total: number;
      took: number;
      maxScore?: number;
    }> => {
      try {
        // Validate query parameter
        if (!args.query || args.query.trim().length === 0) {
          throw new GraphQLError('Search query is required', {
            extensions: {
              code: 'INVALID_INPUT',
              http: { status: 400 },
            },
          });
        }

        const pagination = {
          from: args.pagination?.from || 0,
          size: Math.min(args.pagination?.size || 20, 100), // Cap at 100 results
        };

        // Perform search
        const searchResult = await context.searchService.searchLessons(
          args.query.trim(),
          args.courseId,
          pagination
        );

        // Transform results to match GraphQL schema
        return {
          documents: searchResult.documents.map((lesson) => ({
            ...lesson,
            lessonType: mapLessonTypeToGraphQL(lesson.lessonType),
            courseDifficulty: mapDifficultyToGraphQL(lesson.courseDifficulty),
            highlight: lesson._highlight || null,
          })),
          total: searchResult.total,
          took: searchResult.took,
          maxScore: searchResult.maxScore,
        };
      } catch (error) {
        handleSearchError(error, 'lessons');
      }
    },

    /**
     * Get autocomplete suggestions for search queries
     */
    autocomplete: async (
      _parent: unknown,
      args: {
        query: string;
        limit?: number;
      },
      context: SearchGraphQLContext
    ): Promise<string[]> => {
      try {
        // Validate query parameter
        if (!args.query || args.query.trim().length === 0) {
          return [];
        }

        const limit = Math.min(args.limit || 10, 20); // Cap at 20 suggestions

        // Get autocomplete suggestions
        const suggestions = await context.searchService.autocomplete(args.query.trim(), limit);

        return suggestions;
      } catch (error) {
        // Don't throw errors for autocomplete - return empty array instead
        console.error('Autocomplete failed:', error);
        return [];
      }
    },

    /**
     * Get trending search terms based on recent activity
     */
    trendingSearches: async (
      _parent: unknown,
      args: {
        limit?: number;
      },
      context: SearchGraphQLContext
    ): Promise<string[]> => {
      try {
        const limit = Math.min(args.limit || 10, 20); // Cap at 20 trending searches

        // Get trending searches
        const trendingSearches = await context.searchService.getTrendingSearches(limit);

        return trendingSearches;
      } catch (error) {
        // Don't throw errors for trending searches - return empty array instead
        console.error('Trending searches failed:', error);
        return [];
      }
    },

    /**
     * Get search health and statistics
     */
    searchHealth: async (
      _parent: unknown,
      _args: unknown,
      context: SearchGraphQLContext
    ): Promise<{
      healthy: boolean;
      indices: { courses: boolean; lessons: boolean };
      statistics?: { coursesIndexed: number; lessonsIndexed: number } | null;
      error?: string | null;
    }> => {
      try {
        const health = await context.searchService.getSearchHealth();

        return {
          healthy: health.healthy,
          indices: health.indices,
          statistics: health.statistics || null,
          error: health.error || null,
        };
      } catch (error) {
        console.error('Search health check failed:', error);
        return {
          healthy: false,
          indices: { courses: false, lessons: false },
          statistics: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  },

  // Type resolvers for complex types
  CourseSearchResult: {
    /**
     * Resolve instructor information using DataLoader if available
     */
    instructorName: (parent: { instructorName?: string }): string => {
      // If instructor name is already in the search document, return it
      if (parent.instructorName) {
        return parent.instructorName;
      }

      // Otherwise, this would typically use a DataLoader to fetch user information
      // For now, return a placeholder
      return 'Instructor Name';
    },

    /**
     * Resolve modules information
     */
    modules: (parent: { modules?: unknown[] }): unknown[] => {
      // Return modules from search document or empty array
      return parent.modules || [];
    },

    /**
     * Format price as decimal string
     */
    price: (parent: { price: number | string }): string => {
      return typeof parent.price === 'number' ? parent.price.toString() : parent.price;
    },

    /**
     * Format dates
     */
    publishedAt: (parent: { publishedAt?: string | Date }): Date | null => {
      return parent.publishedAt ? new Date(parent.publishedAt) : null;
    },

    createdAt: (parent: { createdAt: string | Date }): Date => {
      return new Date(parent.createdAt);
    },

    updatedAt: (parent: { updatedAt: string | Date }): Date => {
      return new Date(parent.updatedAt);
    },
  },

  LessonSearchResult: {
    /**
     * Format dates
     */
    createdAt: (parent: { createdAt: string | Date }): Date => {
      return new Date(parent.createdAt);
    },

    updatedAt: (parent: { updatedAt: string | Date }): Date => {
      return new Date(parent.updatedAt);
    },
  },

  // Enum resolvers (if needed for custom logic)
  SortOption: {
    RELEVANCE: 'RELEVANCE',
    POPULARITY: 'POPULARITY',
    RATING: 'RATING',
    PRICE: 'PRICE',
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    TRENDING: 'TRENDING',
  },

  SortOrder: {
    ASC: 'ASC',
    DESC: 'DESC',
  },

  Difficulty: {
    BEGINNER: 'BEGINNER',
    INTERMEDIATE: 'INTERMEDIATE',
    ADVANCED: 'ADVANCED',
  },

  LessonType: {
    VIDEO: 'VIDEO',
    TEXT: 'TEXT',
    QUIZ: 'QUIZ',
    ASSIGNMENT: 'ASSIGNMENT',
  },

  CourseStatus: {
    DRAFT: 'DRAFT',
    PENDING_REVIEW: 'PENDING_REVIEW',
    PUBLISHED: 'PUBLISHED',
    ARCHIVED: 'ARCHIVED',
  },
};
