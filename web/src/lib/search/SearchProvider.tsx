/**
 * Search Context Provider
 * 
 * Global search state management and context provider for search functionality.
 * Provides centralized search state, analytics tracking, and search optimization
 * across the application.
 * 
 * Requirements: 2.2 - Complete Module Hook Implementation (Search)
 */

'use client';

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useSearch, 
  useFacetedSearch, 
  useAutocomplete, 
  useTrendingSearches,
  useSearchAnalytics,
  useSearchOptimization,
  type SearchFilters,
  type SearchSort,
  type CourseSearchResult,
} from '../../hooks/useSearch';
import { 
  trackSearchEvent, 
  trackSearchResultClick, 
  updateSearchMetrics,
  generatePersonalizedSuggestions,
  type UserPreferences,
} from './searchUtils';

// ============================================================================
// Context Types
// ============================================================================

export interface SearchContextValue {
  // Current search state
  query: string;
  filters: SearchFilters;
  sort: SearchSort;
  results: CourseSearchResult[];
  loading: boolean;
  error?: Error | undefined;
  
  // Search actions
  setQuery: (query: string) => void;
  setFilters: (filters: SearchFilters) => void;
  setSort: (sort: SearchSort) => void;
  performSearch: () => Promise<void>;
  clearSearch: () => void;
  
  // Pagination
  currentPage: number;
  totalResults: number;
  hasNextPage: boolean;
  loadMore: () => Promise<void>;
  
  // Autocomplete and suggestions
  suggestions: string[];
  trendingSearches: string[];
  personalizedSuggestions: string[];
  
  // Analytics and tracking
  trackResultClick: (resultId: string, position: number) => void;
  searchMetrics: {
    averageSearchTime?: number;
    successRate?: number;
    totalSearches?: number;
  };
  
  // Search optimization
  optimizeResults: (results: CourseSearchResult[]) => CourseSearchResult[];
  userPreferences: UserPreferences | undefined;
  setUserPreferences: (preferences: UserPreferences) => void;
  
  // Search history
  searchHistory: string[];
  addToHistory: (query: string) => void;
  clearHistory: () => void;
  
  // UI state
  isSearchFocused: boolean;
  setSearchFocused: (focused: boolean) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

// ============================================================================
// Search Provider Component
// ============================================================================

export interface SearchProviderProps {
  children: React.ReactNode;
  initialQuery?: string;
  initialFilters?: SearchFilters;
  userPreferences?: UserPreferences;
}

export function SearchProvider({ 
  children, 
  initialQuery = '', 
  initialFilters = {},
  userPreferences: initialUserPreferences,
}: SearchProviderProps) {
  const router = useRouter();
  
  // Core search state
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [sort, setSort] = useState<SearchSort>({ field: 'RELEVANCE', order: 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  
  // UI state
  const [isSearchFocused, setSearchFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Initialize search history and user preferences from localStorage
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    
    const stored = localStorage.getItem('search_history');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to load search history:', error);
        return [];
      }
    }
    return [];
  });
  
  const [userPreferences, setUserPreferences] = useState<UserPreferences | undefined>(() => {
    if (typeof window === 'undefined') return initialUserPreferences;
    
    if (initialUserPreferences) return initialUserPreferences;
    
    const storedPrefs = localStorage.getItem('user_search_preferences');
    if (storedPrefs) {
      try {
        return JSON.parse(storedPrefs);
      } catch (error) {
        console.warn('Failed to load user preferences:', error);
        return undefined;
      }
    }
    return undefined;
  });
  
  // Search hooks
  const searchHook = useSearch({
    query,
    filters,
    sort,
    includeFacets: true,
    skip: !query.trim(),
  });
  
  const facetedSearchHook = useFacetedSearch({
    query,
    initialFilters: filters,
    autoSearch: false, // Manual control
    debounceMs: 300,
  });
  
  const autocompleteHook = useAutocomplete({
    query,
    limit: 8,
    debounceMs: 200,
    skip: !isSearchFocused || query.length < 2,
  });
  
  const trendingHook = useTrendingSearches({
    limit: 10,
    pollInterval: 300000, // 5 minutes
  });
  
  const analyticsHook = useSearchAnalytics();
  const optimizationHook = useSearchOptimization();
  
  // Save search history when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && searchHistory.length > 0) {
      localStorage.setItem('search_history', JSON.stringify(searchHistory));
    }
  }, [searchHistory]);
  
  // Save user preferences when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && userPreferences) {
      localStorage.setItem('user_search_preferences', JSON.stringify(userPreferences));
    }
  }, [userPreferences]);
  
  // Sync URL with search state
  useEffect(() => {
    if (typeof window !== 'undefined' && query.trim()) {
      const params = new URLSearchParams();
      params.set('q', query);
      
      if (filters.category?.length) {
        params.set('category', filters.category.join(','));
      }
      if (filters.difficulty?.length) {
        params.set('difficulty', filters.difficulty.join(','));
      }
      if (filters.priceRange) {
        if (filters.priceRange.min !== undefined) {
          params.set('priceMin', filters.priceRange.min.toString());
        }
        if (filters.priceRange.max !== undefined) {
          params.set('priceMax', filters.priceRange.max.toString());
        }
      }
      if (filters.rating?.min) {
        params.set('rating', filters.rating.min.toString());
      }
      
      const newUrl = `/search?${params.toString()}`;
      if (window.location.pathname + window.location.search !== newUrl) {
        router.replace(newUrl, { scroll: false });
      }
    }
  }, [query, filters, router]);
  
  // Generate personalized suggestions
  const personalizedSuggestions = React.useMemo(() => {
    return generatePersonalizedSuggestions(
      searchHistory,
      trendingHook.trendingSearches
    );
  }, [searchHistory, trendingHook.trendingSearches]);
  
  // Optimize search results
  const optimizedResults = React.useMemo(() => {
    if (!searchHook.data?.documents) return [];
    
    return optimizationHook.optimizeResults(
      searchHook.data.documents,
      userPreferences
    );
  }, [searchHook.data, optimizationHook, userPreferences]);
  
  // Search actions
  const addToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== searchQuery);
      const newHistory = [searchQuery, ...filtered].slice(0, 50); // Keep last 50
      return newHistory;
    });
  }, []);
  
  const performSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    const startTime = Date.now();
    
    try {
      await searchHook.refetch();
      
      const searchTime = Date.now() - startTime;
      const resultCount = searchHook.data?.total || 0;
      
      // Track analytics
      trackSearchEvent(query, filters, resultCount, searchTime);
      updateSearchMetrics(searchTime, resultCount, query);
      analyticsHook.trackSearch(query, resultCount, searchTime);
      
      // Add to history
      addToHistory(query);
      
      setCurrentPage(1);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [query, filters, searchHook, analyticsHook, addToHistory]);
  
  const clearSearch = useCallback(() => {
    setQuery('');
    setFilters({});
    setCurrentPage(1);
    setShowFilters(false);
  }, []);
  
  const loadMore = useCallback(async () => {
    if (!searchHook.hasNextPage || searchHook.loading) return;
    
    const nextPage = currentPage + 1;
    const from = (nextPage - 1) * 20; // Assuming 20 results per page
    
    await searchHook.fetchMore({ from, size: 20 });
    setCurrentPage(nextPage);
  }, [searchHook, currentPage]);
  
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('search_history');
    }
  }, []);
  
  const trackResultClick = useCallback((resultId: string, position: number) => {
    trackSearchResultClick(query, resultId, position, 'course');
  }, [query]);
  
  // Context value
  const contextValue: SearchContextValue = {
    // Current search state
    query,
    filters,
    sort,
    results: optimizedResults,
    loading: searchHook.loading || facetedSearchHook.loading,
    error: searchHook.error || facetedSearchHook.error,
    
    // Search actions
    setQuery,
    setFilters,
    setSort,
    performSearch,
    clearSearch,
    
    // Pagination
    currentPage,
    totalResults: searchHook.data?.total || 0,
    hasNextPage: searchHook.hasNextPage,
    loadMore,
    
    // Autocomplete and suggestions
    suggestions: autocompleteHook.suggestions,
    trendingSearches: trendingHook.trendingSearches,
    personalizedSuggestions,
    
    // Analytics and tracking
    trackResultClick,
    searchMetrics: analyticsHook.searchMetrics,
    
    // Search optimization
    optimizeResults: optimizationHook.optimizeResults,
    userPreferences,
    setUserPreferences,
    
    // Search history
    searchHistory,
    addToHistory,
    clearHistory,
    
    // UI state
    isSearchFocused,
    setSearchFocused,
    showFilters,
    setShowFilters,
  };
  
  return (
    <SearchContext.Provider value={contextValue}>
      {children}
    </SearchContext.Provider>
  );
}

// ============================================================================
// Hook to use Search Context
// ============================================================================

export function useSearchContext(): SearchContextValue {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  return context;
}

// ============================================================================
// Higher-Order Component for Search
// ============================================================================

export interface WithSearchProps {
  searchContext: SearchContextValue;
}

export function withSearch<P extends WithSearchProps>(
  Component: React.ComponentType<P>
) {
  const WrappedComponent = (props: Omit<P, 'searchContext'>) => {
    const searchContext = useSearchContext();
    return <Component {...(props as P)} searchContext={searchContext} />;
  };
  
  WrappedComponent.displayName = `withSearch(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// ============================================================================
// Search Event Hooks
// ============================================================================

/**
 * Hook for handling search keyboard shortcuts
 */
export function useSearchKeyboardShortcuts() {
  const { setSearchFocused, performSearch, clearSearch } = useSearchContext();
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchFocused(true);
      }
      
      // Escape to clear search when focused
      if (event.key === 'Escape') {
        setSearchFocused(false);
      }
      
      // Enter to perform search
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        if (event.target.getAttribute('data-search-input')) {
          performSearch();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setSearchFocused, performSearch, clearSearch]);
}

/**
 * Hook for search URL synchronization
 */
export function useSearchUrlSync() {
  const { setQuery, setFilters } = useSearchContext();
  
  useEffect(() => {
    // Parse URL parameters on mount
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get('q');
      
      if (urlQuery) {
        setQuery(urlQuery);
        
        // Parse filters from URL
        const urlFilters: SearchFilters = {};
        
        const category = params.get('category');
        if (category) {
          urlFilters.category = category.split(',');
        }
        
        const difficulty = params.get('difficulty');
        if (difficulty) {
          urlFilters.difficulty = difficulty.split(',');
        }
        
        const priceMin = params.get('priceMin');
        const priceMax = params.get('priceMax');
        if (priceMin !== null || priceMax !== null) {
          urlFilters.priceRange = {
            ...(priceMin !== null && { min: parseInt(priceMin, 10) }),
            ...(priceMax !== null && { max: parseInt(priceMax, 10) }),
          };
        }
        
        const rating = params.get('rating');
        if (rating) {
          urlFilters.rating = { min: parseInt(rating, 10) };
        }
        
        if (Object.keys(urlFilters).length > 0) {
          setFilters(urlFilters);
        }
      }
    }
  }, [setQuery, setFilters]);
}

// ============================================================================
// Search Performance Hook
// ============================================================================

/**
 * Hook for monitoring search performance
 */
export function useSearchPerformance() {
  const { searchMetrics } = useSearchContext();
  
  // Derive performance data from searchMetrics without using state
  const performanceData = React.useMemo(() => {
    if (!searchMetrics) {
      return {
        averageSearchTime: 0,
        successRate: 0,
        totalSearches: 0,
        slowSearches: 0,
      };
    }
    
    return {
      averageSearchTime: searchMetrics.averageSearchTime || 0,
      successRate: searchMetrics.successRate || 0,
      totalSearches: searchMetrics.totalSearches || 0,
      slowSearches: (searchMetrics.totalSearches || 0) > 0 
        ? Math.round(((searchMetrics.totalSearches || 0) * 0.1)) // Estimate 10% slow searches
        : 0,
    };
  }, [searchMetrics]);
  
  const isPerformanceGood = performanceData.averageSearchTime < 1000 && performanceData.successRate > 0.8;
  
  return {
    performanceData,
    isPerformanceGood,
    recommendations: isPerformanceGood 
      ? [] 
      : [
          'Consider optimizing search queries',
          'Review search filters for better results',
          'Check network connectivity',
        ],
  };
}