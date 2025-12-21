/**
 * Search Module Index
 * 
 * Centralized exports for all search-related functionality including hooks,
 * utilities, context providers, and type definitions.
 * 
 * Requirements: 2.2 - Complete Module Hook Implementation (Search)
 */

// Core search hooks
export {
  useSearch,
  useFacetedSearch,
  useAutocomplete,
  useTrendingSearches,
  useSearchLessons,
  useSearchAnalytics,
  useSearchOptimization,
  type UseSearchOptions,
  type UseSearchReturn,
  type UseFacetedSearchOptions,
  type UseFacetedSearchReturn,
  type UseAutocompleteOptions,
  type UseAutocompleteReturn,
  type UseTrendingSearchesOptions,
  type UseTrendingSearchesReturn,
  type UseSearchLessonsOptions,
  type UseSearchLessonsReturn,
  type SearchFilters,
  type SearchPagination,
  type SearchSort,
  type CourseSearchResult,
  type LessonSearchResult,
  type SearchFacets,
  type SearchResult,
  type LessonSearchResults,
  type SearchHealthResult,
} from '../../hooks/useSearch';

// Search utilities
export {
  sanitizeSearchQuery,
  extractSearchTerms,
  generateQuerySuggestions,
  buildElasticsearchQuery,
  formatSearchResults,
  formatLessonResults,
  processFacets,
  trackSearchEvent,
  trackSearchResultClick,
  getSearchMetrics,
  updateSearchMetrics,
  calculateRelevanceScore,
  optimizeResultsForUser,
  generatePersonalizedSuggestions,
  type ProcessedFacets,
  type SearchMetrics,
  type UserPreferences,
} from './searchUtils';

// Search context and providers
export {
  SearchProvider,
  useSearchContext,
  withSearch,
  useSearchKeyboardShortcuts,
  useSearchUrlSync,
  useSearchPerformance,
  type SearchContextValue,
  type SearchProviderProps,
  type WithSearchProps,
} from './SearchProvider';

// Re-export search state management from lib/state
export {
  useSearch as useSearchState,
  getSearchSuggestions,
  getPopularSearches,
  type SearchState,
  type SearchActions,
  type SearchFilters as SearchStateFilters,
  type SearchFacets as SearchStateFacets,
  type SearchHistory,
  type SavedSearch,
} from '../state/searchState';