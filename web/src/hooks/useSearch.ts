/**
 * Search Module Hooks
 * 
 * Comprehensive React hooks for search functionality with Elasticsearch integration.
 * Provides typed access to course search, lesson search, autocomplete, trending searches,
 * and search analytics with proper error handling and cache integration.
 * 
 * Requirements: 2.2 - Complete Module Hook Implementation (Search)
 */

import { useQuery, useLazyQuery, useMutation } from '@apollo/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { gql } from '@apollo/client';

// ============================================================================
// GraphQL Operations
// ============================================================================

const SEARCH_COURSES = gql`
  query SearchCourses(
    $query: String!
    $filters: SearchFilters
    $pagination: SearchPagination
    $sort: SearchSort
    $includeFacets: Boolean
  ) {
    searchCourses(
      query: $query
      filters: $filters
      pagination: $pagination
      sort: $sort
      includeFacets: $includeFacets
    ) {
      documents {
        id
        title
        description
        slug
        instructorId
        instructorName
        category
        difficulty
        price
        currency
        status
        enrollmentCount
        averageRating
        totalReviews
        publishedAt
        createdAt
        updatedAt
        modules {
          id
          title
          description
          orderNumber
          durationMinutes
        }
        lessonContent
        searchBoost
        popularityScore
        recentEnrollmentVelocity
        highlight
      }
      total
      took
      maxScore
      facets {
        categories {
          key
          count
        }
        difficulties {
          key
          count
        }
        priceRanges {
          key
          count
          from
          to
        }
        ratings {
          key
          count
          from
        }
        languages {
          key
          count
        }
      }
      suggestions
    }
  }
`;

const SEARCH_LESSONS = gql`
  query SearchLessons(
    $query: String!
    $courseId: ID
    $pagination: SearchPagination
  ) {
    searchLessons(
      query: $query
      courseId: $courseId
      pagination: $pagination
    ) {
      documents {
        id
        moduleId
        courseId
        title
        description
        lessonType
        contentText
        durationMinutes
        orderNumber
        isPreview
        createdAt
        updatedAt
        courseTitle
        courseCategory
        courseDifficulty
        highlight
      }
      total
      took
      maxScore
    }
  }
`;

const AUTOCOMPLETE = gql`
  query Autocomplete($query: String!, $limit: Int) {
    autocomplete(query: $query, limit: $limit)
  }
`;

const TRENDING_SEARCHES = gql`
  query TrendingSearches($limit: Int) {
    trendingSearches(limit: $limit)
  }
`;

const SEARCH_HEALTH = gql`
  query SearchHealth {
    searchHealth {
      healthy
      indices {
        courses
        lessons
      }
      statistics {
        coursesIndexed
        lessonsIndexed
      }
      error
    }
  }
`;

// ============================================================================
// Type Definitions
// ============================================================================

export interface SearchFilters {
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

export interface SearchPagination {
  from?: number;
  size?: number;
}

export interface SearchSort {
  field: 'RELEVANCE' | 'POPULARITY' | 'RATING' | 'PRICE' | 'CREATED' | 'UPDATED' | 'TRENDING';
  order: 'ASC' | 'DESC';
}

export interface CourseSearchResult {
  id: string;
  title: string;
  description: string;
  slug: string;
  instructorId: string;
  instructorName: string;
  category: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  price: string;
  currency: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  enrollmentCount: number;
  averageRating?: number;
  totalReviews: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  modules: Array<{
    id: string;
    title: string;
    description?: string;
    orderNumber: number;
    durationMinutes: number;
  }>;
  lessonContent: string;
  searchBoost?: number;
  popularityScore?: number;
  recentEnrollmentVelocity?: number;
  highlight?: Record<string, any>;
}

export interface LessonSearchResult {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description?: string;
  lessonType: 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT';
  contentText?: string;
  durationMinutes?: number;
  orderNumber: number;
  isPreview: boolean;
  createdAt: string;
  updatedAt: string;
  courseTitle: string;
  courseCategory: string;
  courseDifficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  highlight?: Record<string, any>;
}

export interface SearchFacets {
  categories: Array<{ key: string; count: number }>;
  difficulties: Array<{ key: string; count: number }>;
  priceRanges: Array<{ key: string; count: number; from?: number; to?: number }>;
  ratings: Array<{ key: string; count: number; from?: number }>;
  languages: Array<{ key: string; count: number }>;
}

export interface SearchResult {
  documents: CourseSearchResult[];
  total: number;
  took: number;
  maxScore?: number;
  facets?: SearchFacets;
  suggestions: string[];
}

export interface LessonSearchResults {
  documents: LessonSearchResult[];
  total: number;
  took: number;
  maxScore?: number;
}

export interface SearchHealthResult {
  healthy: boolean;
  indices: {
    courses: boolean;
    lessons: boolean;
  };
  statistics?: {
    coursesIndexed: number;
    lessonsIndexed: number;
  };
  error?: string;
}

// ============================================================================
// Hook Options and Return Types
// ============================================================================

export interface UseSearchOptions {
  query: string;
  filters?: SearchFilters;
  pagination?: SearchPagination;
  sort?: SearchSort;
  includeFacets?: boolean;
  skip?: boolean;
  pollInterval?: number;
}

export interface UseSearchReturn {
  data?: SearchResult;
  loading: boolean;
  error?: Error;
  refetch: (variables?: Partial<UseSearchOptions>) => Promise<void>;
  fetchMore: (pagination: SearchPagination) => Promise<void>;
  // Search analytics
  searchTime?: number;
  resultCount: number;
  hasNextPage: boolean;
  // Faceted search helpers
  applyFilter: (key: keyof SearchFilters, value: any) => void;
  clearFilter: (key: keyof SearchFilters) => void;
  clearAllFilters: () => void;
  activeFilters: Partial<SearchFilters>;
}

export interface UseFacetedSearchOptions {
  query: string;
  initialFilters?: SearchFilters;
  autoSearch?: boolean;
  debounceMs?: number;
}

export interface UseFacetedSearchReturn {
  // Search state
  searchResult?: SearchResult;
  loading: boolean;
  error?: Error;
  
  // Filter management
  filters: SearchFilters;
  setFilter: (key: keyof SearchFilters, value: any) => void;
  clearFilter: (key: keyof SearchFilters) => void;
  clearAllFilters: () => void;
  
  // Search actions
  search: () => Promise<void>;
  refetch: () => Promise<void>;
  
  // Pagination
  loadMore: () => Promise<void>;
  hasNextPage: boolean;
  
  // Facets
  facets?: SearchFacets;
  
  // Analytics
  searchTime?: number;
  resultCount: number;
}

export interface UseAutocompleteOptions {
  query: string;
  limit?: number;
  debounceMs?: number;
  skip?: boolean;
}

export interface UseAutocompleteReturn {
  suggestions: string[];
  loading: boolean;
  error?: Error;
  refetch: () => Promise<void>;
}

export interface UseTrendingSearchesOptions {
  limit?: number;
  pollInterval?: number;
}

export interface UseTrendingSearchesReturn {
  trendingSearches: string[];
  loading: boolean;
  error?: Error;
  refetch: () => Promise<void>;
}

export interface UseSearchLessonsOptions {
  query: string;
  courseId?: string;
  pagination?: SearchPagination;
  skip?: boolean;
}

export interface UseSearchLessonsReturn {
  data?: LessonSearchResults;
  loading: boolean;
  error?: Error;
  refetch: (variables?: Partial<UseSearchLessonsOptions>) => Promise<void>;
  fetchMore: (pagination: SearchPagination) => Promise<void>;
  hasNextPage: boolean;
  resultCount: number;
}

// ============================================================================
// Main Search Hook
// ============================================================================

/**
 * Primary search hook with Elasticsearch integration
 * Provides comprehensive course search with filters, facets, and pagination
 */
export function useSearch(options: UseSearchOptions): UseSearchReturn {
  const [activeFilters, setActiveFilters] = useState<Partial<SearchFilters>>(options.filters || {});
  const [currentPagination, setCurrentPagination] = useState<SearchPagination>(
    options.pagination || { from: 0, size: 20 }
  );

  const { data, loading, error, refetch: apolloRefetch, fetchMore: apolloFetchMore } = useQuery(
    SEARCH_COURSES,
    {
      variables: {
        query: options.query,
        filters: activeFilters,
        pagination: currentPagination,
        sort: options.sort || { field: 'RELEVANCE', order: 'DESC' },
        includeFacets: options.includeFacets !== false,
      },
      skip: options.skip || !options.query.trim(),
      pollInterval: options.pollInterval,
      errorPolicy: 'partial',
      notifyOnNetworkStatusChange: true,
    }
  );

  const searchResult = data?.searchCourses;
  const resultCount = searchResult?.total || 0;
  const hasNextPage = currentPagination.from + currentPagination.size < resultCount;

  const refetch = useCallback(async (variables?: Partial<UseSearchOptions>) => {
    if (variables?.filters) {
      setActiveFilters(variables.filters);
    }
    if (variables?.pagination) {
      setCurrentPagination(variables.pagination);
    }
    
    await apolloRefetch({
      query: variables?.query || options.query,
      filters: variables?.filters || activeFilters,
      pagination: variables?.pagination || currentPagination,
      sort: variables?.sort || options.sort || { field: 'RELEVANCE', order: 'DESC' },
      includeFacets: variables?.includeFacets !== false,
    });
  }, [apolloRefetch, options.query, options.sort, activeFilters, currentPagination]);

  const fetchMore = useCallback(async (pagination: SearchPagination) => {
    setCurrentPagination(pagination);
    
    await apolloFetchMore({
      variables: {
        query: options.query,
        filters: activeFilters,
        pagination,
        sort: options.sort || { field: 'RELEVANCE', order: 'DESC' },
        includeFacets: options.includeFacets !== false,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.searchCourses) return prev;
        
        return {
          searchCourses: {
            ...fetchMoreResult.searchCourses,
            documents: [
              ...prev.searchCourses.documents,
              ...fetchMoreResult.searchCourses.documents,
            ],
          },
        };
      },
    });
  }, [apolloFetchMore, options.query, options.sort, options.includeFacets, activeFilters]);

  const applyFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPagination({ from: 0, size: currentPagination.size }); // Reset pagination
  }, [currentPagination.size]);

  const clearFilter = useCallback((key: keyof SearchFilters) => {
    setActiveFilters(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    setCurrentPagination({ from: 0, size: currentPagination.size }); // Reset pagination
  }, [currentPagination.size]);

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setCurrentPagination({ from: 0, size: currentPagination.size }); // Reset pagination
  }, [currentPagination.size]);

  return {
    data: searchResult,
    loading,
    error,
    refetch,
    fetchMore,
    searchTime: searchResult?.took,
    resultCount,
    hasNextPage,
    applyFilter,
    clearFilter,
    clearAllFilters,
    activeFilters,
  };
}

// ============================================================================
// Faceted Search Hook
// ============================================================================

/**
 * Advanced search hook with comprehensive filter management
 * Provides faceted search capabilities with automatic filter application
 */
export function useFacetedSearch(options: UseFacetedSearchOptions): UseFacetedSearchReturn {
  const [filters, setFilters] = useState<SearchFilters>(options.initialFilters || {});
  const [searchQuery, setSearchQuery] = useState(options.query);
  const [pagination, setPagination] = useState<SearchPagination>({ from: 0, size: 20 });

  // Debounced search execution
  const [searchTrigger, setSearchTrigger] = useState(0);
  
  useEffect(() => {
    if (!options.autoSearch) return;
    
    const timer = setTimeout(() => {
      setSearchTrigger(prev => prev + 1);
    }, options.debounceMs || 500);
    
    return () => clearTimeout(timer);
  }, [searchQuery, filters, options.autoSearch, options.debounceMs]);

  const [executeSearch, { data, loading, error, refetch: apolloRefetch, fetchMore: apolloFetchMore }] = useLazyQuery(
    SEARCH_COURSES,
    {
      errorPolicy: 'partial',
      notifyOnNetworkStatusChange: true,
    }
  );

  // Auto-execute search when trigger changes
  useEffect(() => {
    if (options.autoSearch && searchTrigger > 0 && searchQuery.trim()) {
      executeSearch({
        variables: {
          query: searchQuery,
          filters,
          pagination,
          sort: { field: 'RELEVANCE', order: 'DESC' },
          includeFacets: true,
        },
      });
    }
  }, [searchTrigger, executeSearch, searchQuery, filters, pagination, options.autoSearch]);

  const searchResult = data?.searchCourses;
  const resultCount = searchResult?.total || 0;
  const hasNextPage = pagination.from + pagination.size < resultCount;

  const setFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination({ from: 0, size: pagination.size }); // Reset pagination
  }, [pagination.size]);

  const clearFilter = useCallback((key: keyof SearchFilters) => {
    setFilters(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    setPagination({ from: 0, size: pagination.size }); // Reset pagination
  }, [pagination.size]);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    setPagination({ from: 0, size: pagination.size }); // Reset pagination
  }, [pagination.size]);

  const search = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    await executeSearch({
      variables: {
        query: searchQuery,
        filters,
        pagination: { from: 0, size: pagination.size },
        sort: { field: 'RELEVANCE', order: 'DESC' },
        includeFacets: true,
      },
    });
    
    setPagination({ from: 0, size: pagination.size });
  }, [executeSearch, searchQuery, filters, pagination.size]);

  const refetch = useCallback(async () => {
    if (apolloRefetch) {
      await apolloRefetch();
    } else {
      await search();
    }
  }, [apolloRefetch, search]);

  const loadMore = useCallback(async () => {
    if (!hasNextPage || loading) return;
    
    const newPagination = {
      from: pagination.from + pagination.size,
      size: pagination.size,
    };
    
    setPagination(newPagination);
    
    if (apolloFetchMore) {
      await apolloFetchMore({
        variables: {
          query: searchQuery,
          filters,
          pagination: newPagination,
          sort: { field: 'RELEVANCE', order: 'DESC' },
          includeFacets: true,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!fetchMoreResult?.searchCourses) return prev;
          
          return {
            searchCourses: {
              ...fetchMoreResult.searchCourses,
              documents: [
                ...prev.searchCourses.documents,
                ...fetchMoreResult.searchCourses.documents,
              ],
            },
          };
        },
      });
    }
  }, [hasNextPage, loading, pagination, apolloFetchMore, searchQuery, filters]);

  // Update search query when options change
  useEffect(() => {
    setSearchQuery(options.query);
  }, [options.query]);

  return {
    searchResult,
    loading,
    error,
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    search,
    refetch,
    loadMore,
    hasNextPage,
    facets: searchResult?.facets,
    searchTime: searchResult?.took,
    resultCount,
  };
}

// ============================================================================
// Autocomplete Hook
// ============================================================================

/**
 * Real-time autocomplete suggestions hook
 * Provides debounced search suggestions with caching
 */
export function useAutocomplete(options: UseAutocompleteOptions): UseAutocompleteReturn {
  const [debouncedQuery, setDebouncedQuery] = useState(options.query);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(options.query);
    }, options.debounceMs || 300);

    return () => clearTimeout(timer);
  }, [options.query, options.debounceMs]);

  const { data, loading, error, refetch } = useQuery(AUTOCOMPLETE, {
    variables: {
      query: debouncedQuery,
      limit: options.limit || 10,
    },
    skip: options.skip || !debouncedQuery.trim() || debouncedQuery.length < 2,
    errorPolicy: 'ignore', // Don't show errors for autocomplete
  });

  const suggestions = data?.autocomplete || [];

  const refetchSuggestions = useCallback(async () => {
    if (refetch) {
      await refetch();
    }
  }, [refetch]);

  return {
    suggestions,
    loading,
    error,
    refetch: refetchSuggestions,
  };
}

// ============================================================================
// Trending Searches Hook
// ============================================================================

/**
 * Trending searches hook for popular queries
 * Provides cached trending search terms with optional polling
 */
export function useTrendingSearches(options: UseTrendingSearchesOptions = {}): UseTrendingSearchesReturn {
  const { data, loading, error, refetch } = useQuery(TRENDING_SEARCHES, {
    variables: {
      limit: options.limit || 10,
    },
    pollInterval: options.pollInterval,
    errorPolicy: 'ignore', // Don't show errors for trending searches
  });

  const trendingSearches = data?.trendingSearches || [];

  const refetchTrending = useCallback(async () => {
    if (refetch) {
      await refetch();
    }
  }, [refetch]);

  return {
    trendingSearches,
    loading,
    error,
    refetch: refetchTrending,
  };
}

// ============================================================================
// Lesson Search Hook
// ============================================================================

/**
 * Lesson-specific search hook
 * Provides search within course lessons or across all lessons
 */
export function useSearchLessons(options: UseSearchLessonsOptions): UseSearchLessonsReturn {
  const [currentPagination, setCurrentPagination] = useState<SearchPagination>(
    options.pagination || { from: 0, size: 20 }
  );

  const { data, loading, error, refetch: apolloRefetch, fetchMore: apolloFetchMore } = useQuery(
    SEARCH_LESSONS,
    {
      variables: {
        query: options.query,
        courseId: options.courseId,
        pagination: currentPagination,
      },
      skip: options.skip || !options.query.trim(),
      errorPolicy: 'partial',
      notifyOnNetworkStatusChange: true,
    }
  );

  const searchResult = data?.searchLessons;
  const resultCount = searchResult?.total || 0;
  const hasNextPage = currentPagination.from + currentPagination.size < resultCount;

  const refetch = useCallback(async (variables?: Partial<UseSearchLessonsOptions>) => {
    if (variables?.pagination) {
      setCurrentPagination(variables.pagination);
    }
    
    await apolloRefetch({
      query: variables?.query || options.query,
      courseId: variables?.courseId || options.courseId,
      pagination: variables?.pagination || currentPagination,
    });
  }, [apolloRefetch, options.query, options.courseId, currentPagination]);

  const fetchMore = useCallback(async (pagination: SearchPagination) => {
    setCurrentPagination(pagination);
    
    await apolloFetchMore({
      variables: {
        query: options.query,
        courseId: options.courseId,
        pagination,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult?.searchLessons) return prev;
        
        return {
          searchLessons: {
            ...fetchMoreResult.searchLessons,
            documents: [
              ...prev.searchLessons.documents,
              ...fetchMoreResult.searchLessons.documents,
            ],
          },
        };
      },
    });
  }, [apolloFetchMore, options.query, options.courseId]);

  return {
    data: searchResult,
    loading,
    error,
    refetch,
    fetchMore,
    hasNextPage,
    resultCount,
  };
}

// ============================================================================
// Search Analytics Hook
// ============================================================================

/**
 * Search analytics and reporting hook
 * Provides search performance metrics and usage analytics
 */
export function useSearchAnalytics() {
  const [searchMetrics, setSearchMetrics] = useState({
    totalSearches: 0,
    averageSearchTime: 0,
    popularQueries: [] as string[],
    searchSuccessRate: 0,
    zeroResultQueries: [] as string[],
  });

  const { data: healthData, loading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery(
    SEARCH_HEALTH,
    {
      pollInterval: 30000, // Poll every 30 seconds
      errorPolicy: 'ignore',
    }
  );

  const { data: trendingData } = useQuery(TRENDING_SEARCHES, {
    variables: { limit: 20 },
    pollInterval: 60000, // Poll every minute
    errorPolicy: 'ignore',
  });

  const searchHealth = healthData?.searchHealth;
  const trendingSearches = trendingData?.trendingSearches || [];

  // Update metrics when trending data changes
  useEffect(() => {
    if (trendingSearches.length > 0) {
      setSearchMetrics(prev => ({
        ...prev,
        popularQueries: trendingSearches,
      }));
    }
  }, [trendingSearches]);

  const trackSearch = useCallback((query: string, resultCount: number, searchTime: number) => {
    setSearchMetrics(prev => {
      const newTotalSearches = prev.totalSearches + 1;
      const newAverageSearchTime = 
        (prev.averageSearchTime * prev.totalSearches + searchTime) / newTotalSearches;
      
      const newZeroResultQueries = resultCount === 0 
        ? [...prev.zeroResultQueries, query].slice(-50) // Keep last 50
        : prev.zeroResultQueries;
      
      const newSuccessRate = 
        ((prev.searchSuccessRate * prev.totalSearches) + (resultCount > 0 ? 1 : 0)) / newTotalSearches;

      return {
        ...prev,
        totalSearches: newTotalSearches,
        averageSearchTime: newAverageSearchTime,
        searchSuccessRate: newSuccessRate,
        zeroResultQueries: newZeroResultQueries,
      };
    });
  }, []);

  const getSearchInsights = useCallback(() => {
    return {
      ...searchMetrics,
      searchHealth,
      indexHealth: {
        coursesIndexed: searchHealth?.statistics?.coursesIndexed || 0,
        lessonsIndexed: searchHealth?.statistics?.lessonsIndexed || 0,
        indicesHealthy: searchHealth?.indices?.courses && searchHealth?.indices?.lessons,
      },
    };
  }, [searchMetrics, searchHealth]);

  return {
    searchMetrics,
    searchHealth,
    trendingSearches,
    loading: healthLoading,
    error: healthError,
    trackSearch,
    getSearchInsights,
    refetchHealth,
  };
}

// ============================================================================
// Search Result Optimization Hook
// ============================================================================

/**
 * Search result optimization and ranking hook
 * Provides advanced search result manipulation and optimization
 */
export function useSearchOptimization() {
  const [optimizationSettings, setOptimizationSettings] = useState({
    boostPopularCourses: true,
    boostRecentContent: true,
    boostHighRatedContent: true,
    personalizeResults: true,
    diversifyResults: true,
  });

  const optimizeResults = useCallback((results: CourseSearchResult[], userPreferences?: any) => {
    let optimizedResults = [...results];

    // Apply popularity boost
    if (optimizationSettings.boostPopularCourses) {
      optimizedResults = optimizedResults.sort((a, b) => {
        const aScore = (a.popularityScore || 0) + (a.enrollmentCount * 0.1);
        const bScore = (b.popularityScore || 0) + (b.enrollmentCount * 0.1);
        return bScore - aScore;
      });
    }

    // Apply recency boost
    if (optimizationSettings.boostRecentContent) {
      const now = new Date().getTime();
      optimizedResults = optimizedResults.sort((a, b) => {
        const aRecency = now - new Date(a.publishedAt || a.createdAt).getTime();
        const bRecency = now - new Date(b.publishedAt || b.createdAt).getTime();
        
        // Boost more recent content
        const aScore = (a.searchBoost || 1) + (aRecency < 30 * 24 * 60 * 60 * 1000 ? 0.2 : 0);
        const bScore = (b.searchBoost || 1) + (bRecency < 30 * 24 * 60 * 60 * 1000 ? 0.2 : 0);
        
        return bScore - aScore;
      });
    }

    // Apply rating boost
    if (optimizationSettings.boostHighRatedContent) {
      optimizedResults = optimizedResults.sort((a, b) => {
        const aRatingScore = (a.averageRating || 0) * (a.totalReviews > 10 ? 1 : 0.5);
        const bRatingScore = (b.averageRating || 0) * (b.totalReviews > 10 ? 1 : 0.5);
        return bRatingScore - aRatingScore;
      });
    }

    // Apply personalization
    if (optimizationSettings.personalizeResults && userPreferences) {
      optimizedResults = optimizedResults.sort((a, b) => {
        let aPersonalizationScore = 0;
        let bPersonalizationScore = 0;

        // Boost based on user's preferred categories
        if (userPreferences.preferredCategories?.includes(a.category)) {
          aPersonalizationScore += 0.3;
        }
        if (userPreferences.preferredCategories?.includes(b.category)) {
          bPersonalizationScore += 0.3;
        }

        // Boost based on user's skill level
        if (userPreferences.skillLevel === a.difficulty.toLowerCase()) {
          aPersonalizationScore += 0.2;
        }
        if (userPreferences.skillLevel === b.difficulty.toLowerCase()) {
          bPersonalizationScore += 0.2;
        }

        return bPersonalizationScore - aPersonalizationScore;
      });
    }

    // Apply diversification
    if (optimizationSettings.diversifyResults) {
      const diversified: CourseSearchResult[] = [];
      const categoryCount: Record<string, number> = {};
      const difficultyCount: Record<string, number> = {};

      for (const result of optimizedResults) {
        const catCount = categoryCount[result.category] || 0;
        const diffCount = difficultyCount[result.difficulty] || 0;

        // Prefer diverse categories and difficulties in top results
        if (diversified.length < 10 && (catCount < 3 || diffCount < 3)) {
          diversified.push(result);
          categoryCount[result.category] = catCount + 1;
          difficultyCount[result.difficulty] = diffCount + 1;
        } else if (diversified.length >= 10) {
          diversified.push(result);
        }
      }

      // Add remaining results
      for (const result of optimizedResults) {
        if (!diversified.includes(result)) {
          diversified.push(result);
        }
      }

      optimizedResults = diversified;
    }

    return optimizedResults;
  }, [optimizationSettings]);

  const updateOptimizationSettings = useCallback((settings: Partial<typeof optimizationSettings>) => {
    setOptimizationSettings(prev => ({ ...prev, ...settings }));
  }, []);

  const generateSearchRecommendations = useCallback((query: string, results: CourseSearchResult[]) => {
    const recommendations: string[] = [];

    // Suggest related queries based on results
    if (results.length > 0) {
      const categories = [...new Set(results.map(r => r.category))];
      const difficulties = [...new Set(results.map(r => r.difficulty))];

      if (categories.length > 1) {
        recommendations.push(`${query} ${categories[0].toLowerCase()}`);
      }
      
      if (difficulties.length > 1) {
        recommendations.push(`${difficulties[0].toLowerCase()} ${query}`);
      }
    }

    // Suggest broader queries if no results
    if (results.length === 0) {
      const words = query.split(' ');
      if (words.length > 1) {
        recommendations.push(words[0]); // Suggest first word only
        recommendations.push(words.slice(0, -1).join(' ')); // Remove last word
      }
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }, []);

  return {
    optimizationSettings,
    updateOptimizationSettings,
    optimizeResults,
    generateSearchRecommendations,
  };
}