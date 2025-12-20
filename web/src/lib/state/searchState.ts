/**
 * Search and Filter State Management
 * 
 * Provides comprehensive state management for search and filtering with:
 * - Search filter state management with persistence
 * - URL synchronization for search parameters
 * - Faceted search state with filter combinations
 * - Search history and saved searches
 * 
 * Requirements: 10.3
 */

import { useCallback, useReducer, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

// Search Types
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'course' | 'lesson' | 'user' | 'discussion';
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}
export interface SearchFilters {
  query: string;
  category?: string;
  difficulty?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number;
  duration?: {
    min: number; // in minutes
    max: number;
  };
  instructor?: string;
  language?: string;
  tags?: string[];
  sortBy?: 'relevance' | 'rating' | 'price' | 'date' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchFacets {
  categories: Array<{ value: string; label: string; count: number }>;
  difficulties: Array<{ value: string; label: string; count: number }>;
  instructors: Array<{ value: string; label: string; count: number }>;
  languages: Array<{ value: string; label: string; count: number }>;
  tags: Array<{ value: string; label: string; count: number }>;
  priceRanges: Array<{ min: number; max: number; count: number }>;
  ratings: Array<{ value: number; count: number }>;
}

export interface SearchHistory {
  id: string;
  query: string;
  filters: SearchFilters;
  timestamp: Date;
  resultCount: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
}

export interface SearchState {
  // Current search
  filters: SearchFilters;
  facets: SearchFacets | null;
  
  // Search results
  results: SearchResult[]; // Properly typed search results
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  
  // History and saved searches
  history: SearchHistory[];
  savedSearches: SavedSearch[];
  
  // UI state
  isFiltersVisible: boolean;
  activeFilterCount: number;
  
  // URL synchronization
  isUrlSynced: boolean;
  urlUpdatePending: boolean;
}

export interface SearchActions {
  // Filter operations
  setQuery: (query: string) => void;
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilter: (key: keyof SearchFilters) => void;
  clearAllFilters: () => void;
  applyFilters: (filters: Partial<SearchFilters>) => void;
  
  // Search operations
  search: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // History operations
  addToHistory: (resultCount: number) => void;
  clearHistory: () => void;
  loadFromHistory: (historyItem: SearchHistory) => void;
  
  // Saved searches
  saveSearch: (name: string) => void;
  loadSavedSearch: (savedSearch: SavedSearch) => void;
  deleteSavedSearch: (id: string) => void;
  updateSavedSearch: (id: string, updates: Partial<SavedSearch>) => void;
  
  // UI operations
  toggleFilters: () => void;
  setPage: (page: number) => void;
  
  // URL synchronization
  syncFromUrl: () => void;
  syncToUrl: () => void;
}

// Action Types
type SearchAction =
  | { type: 'SET_QUERY'; payload: string }
  | { type: 'SET_FILTER'; payload: { key: keyof SearchFilters; value: SearchFilters[keyof SearchFilters] } }
  | { type: 'CLEAR_FILTER'; payload: keyof SearchFilters }
  | { type: 'CLEAR_ALL_FILTERS' }
  | { type: 'APPLY_FILTERS'; payload: Partial<SearchFilters> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_RESULTS'; payload: { results: SearchResult[]; totalCount: number; hasNextPage: boolean } }
  | { type: 'APPEND_RESULTS'; payload: { results: SearchResult[]; hasNextPage: boolean } }
  | { type: 'SET_FACETS'; payload: SearchFacets }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'ADD_TO_HISTORY'; payload: SearchHistory }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LOAD_FROM_HISTORY'; payload: SearchHistory }
  | { type: 'SET_SAVED_SEARCHES'; payload: SavedSearch[] }
  | { type: 'ADD_SAVED_SEARCH'; payload: SavedSearch }
  | { type: 'DELETE_SAVED_SEARCH'; payload: string }
  | { type: 'UPDATE_SAVED_SEARCH'; payload: { id: string; updates: Partial<SavedSearch> } }
  | { type: 'TOGGLE_FILTERS' }
  | { type: 'SET_URL_SYNCED'; payload: boolean }
  | { type: 'SET_URL_UPDATE_PENDING'; payload: boolean };

// Initial State
const initialFilters: SearchFilters = {
  query: '',
  sortBy: 'relevance',
  sortOrder: 'desc',
};

const initialState: SearchState = {
  filters: initialFilters,
  facets: null,
  results: [],
  totalCount: 0,
  isLoading: false,
  error: null,
  currentPage: 1,
  pageSize: 20,
  hasNextPage: false,
  history: [],
  savedSearches: [],
  isFiltersVisible: false,
  activeFilterCount: 0,
  isUrlSynced: false,
  urlUpdatePending: false,
};

// Utility Functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  
  if (filters.query) count++;
  if (filters.category) count++;
  if (filters.difficulty?.length) count++;
  if (filters.priceRange) count++;
  if (filters.rating) count++;
  if (filters.duration) count++;
  if (filters.instructor) count++;
  if (filters.language) count++;
  if (filters.tags?.length) count++;
  
  return count;
}

function filtersToUrlParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  
  if (filters.query) params.set('q', filters.query);
  if (filters.category) params.set('category', filters.category);
  if (filters.difficulty?.length) params.set('difficulty', filters.difficulty.join(','));
  if (filters.priceRange) {
    params.set('priceMin', filters.priceRange.min.toString());
    params.set('priceMax', filters.priceRange.max.toString());
  }
  if (filters.rating) params.set('rating', filters.rating.toString());
  if (filters.duration) {
    params.set('durationMin', filters.duration.min.toString());
    params.set('durationMax', filters.duration.max.toString());
  }
  if (filters.instructor) params.set('instructor', filters.instructor);
  if (filters.language) params.set('language', filters.language);
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  
  return params;
}

function urlParamsToFilters(params: URLSearchParams): SearchFilters {
  const filters: SearchFilters = {
    query: params.get('q') || '',
    sortBy: (params.get('sortBy') as SearchFilters['sortBy']) || 'relevance',
    sortOrder: (params.get('sortOrder') as SearchFilters['sortOrder']) || 'desc',
  };
  
  const category = params.get('category');
  if (category) filters.category = category;
  
  const difficulty = params.get('difficulty');
  if (difficulty) filters.difficulty = difficulty.split(',');
  
  const priceMin = params.get('priceMin');
  const priceMax = params.get('priceMax');
  if (priceMin && priceMax) {
    filters.priceRange = {
      min: parseInt(priceMin, 10),
      max: parseInt(priceMax, 10),
    };
  }
  
  const rating = params.get('rating');
  if (rating) filters.rating = parseInt(rating, 10);
  
  const durationMin = params.get('durationMin');
  const durationMax = params.get('durationMax');
  if (durationMin && durationMax) {
    filters.duration = {
      min: parseInt(durationMin, 10),
      max: parseInt(durationMax, 10),
    };
  }
  
  const instructor = params.get('instructor');
  if (instructor) filters.instructor = instructor;
  
  const language = params.get('language');
  if (language) filters.language = language;
  
  const tags = params.get('tags');
  if (tags) filters.tags = tags.split(',');
  
  return filters;
}

// Reducer
function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'SET_QUERY':
      const newFilters = { ...state.filters, query: action.payload };
      return {
        ...state,
        filters: newFilters,
        activeFilterCount: countActiveFilters(newFilters),
        currentPage: 1,
      };

    case 'SET_FILTER':
      const updatedFilters = { ...state.filters, [action.payload.key]: action.payload.value };
      return {
        ...state,
        filters: updatedFilters,
        activeFilterCount: countActiveFilters(updatedFilters),
        currentPage: 1,
      };

    case 'CLEAR_FILTER':
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.payload]: _removedFilter, ...remainingFilters } = state.filters;
      // Ensure required properties are present
      const clearedFilters: SearchFilters = { 
        query: '',
        sortBy: 'relevance',
        sortOrder: 'desc',
        ...remainingFilters,
      };
      return {
        ...state,
        filters: clearedFilters,
        activeFilterCount: countActiveFilters(clearedFilters),
        currentPage: 1,
      };

    case 'CLEAR_ALL_FILTERS':
      return {
        ...state,
        filters: initialFilters,
        activeFilterCount: 0,
        currentPage: 1,
      };

    case 'APPLY_FILTERS':
      const appliedFilters = { ...state.filters, ...action.payload };
      return {
        ...state,
        filters: appliedFilters,
        activeFilterCount: countActiveFilters(appliedFilters),
        currentPage: 1,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_RESULTS':
      return {
        ...state,
        results: action.payload.results,
        totalCount: action.payload.totalCount,
        hasNextPage: action.payload.hasNextPage,
        isLoading: false,
        error: null,
      };

    case 'APPEND_RESULTS':
      return {
        ...state,
        results: [...state.results, ...action.payload.results],
        hasNextPage: action.payload.hasNextPage,
        isLoading: false,
      };

    case 'SET_FACETS':
      return {
        ...state,
        facets: action.payload,
      };

    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.payload,
      };

    case 'ADD_TO_HISTORY':
      const newHistory = [action.payload, ...state.history.slice(0, 49)]; // Keep last 50
      return {
        ...state,
        history: newHistory,
      };

    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: [],
      };

    case 'LOAD_FROM_HISTORY':
      return {
        ...state,
        filters: action.payload.filters,
        activeFilterCount: countActiveFilters(action.payload.filters),
        currentPage: 1,
      };

    case 'SET_SAVED_SEARCHES':
      return {
        ...state,
        savedSearches: action.payload,
      };

    case 'ADD_SAVED_SEARCH':
      return {
        ...state,
        savedSearches: [action.payload, ...state.savedSearches],
      };

    case 'DELETE_SAVED_SEARCH':
      return {
        ...state,
        savedSearches: state.savedSearches.filter(search => search.id !== action.payload),
      };

    case 'UPDATE_SAVED_SEARCH':
      return {
        ...state,
        savedSearches: state.savedSearches.map(search =>
          search.id === action.payload.id
            ? { ...search, ...action.payload.updates }
            : search
        ),
      };

    case 'TOGGLE_FILTERS':
      return {
        ...state,
        isFiltersVisible: !state.isFiltersVisible,
      };

    case 'SET_URL_SYNCED':
      return {
        ...state,
        isUrlSynced: action.payload,
      };

    case 'SET_URL_UPDATE_PENDING':
      return {
        ...state,
        urlUpdatePending: action.payload,
      };

    default:
      return state;
  }
}

// Custom Hook
export function useSearch(): [SearchState, SearchActions] {
  const [state, dispatch] = useReducer(searchReducer, initialState);
  const router = useRouter();
  const urlSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved data on mount
  useEffect(() => {
    // Load search history from localStorage
    const savedHistory = localStorage.getItem('search-history');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory).map((item: SearchHistory & { timestamp: string }) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        history.forEach((item: SearchHistory) => {
          dispatch({ type: 'ADD_TO_HISTORY', payload: item });
        });
      } catch (_error) {
        console.error('Failed to load search history:', _error);
      }
    }

    // Load saved searches from localStorage
    const savedSearches = localStorage.getItem('saved-searches');
    if (savedSearches) {
      try {
        const searches = JSON.parse(savedSearches).map((item: SavedSearch & { createdAt: string; lastUsed: string }) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          lastUsed: new Date(item.lastUsed),
        }));
        dispatch({ type: 'SET_SAVED_SEARCHES', payload: searches });
      } catch (_error) {
        console.error('Failed to load saved searches:', _error);
      }
    }

    // Sync from URL on mount
    if (router.isReady) {
      const params = new URLSearchParams(router.asPath.split('?')[1] || '');
      const filtersFromUrl = urlParamsToFilters(params);
      dispatch({ type: 'APPLY_FILTERS', payload: filtersFromUrl });
      dispatch({ type: 'SET_URL_SYNCED', payload: true });
    }
  }, [router.isReady, router.asPath]);

  // Save history to localStorage
  useEffect(() => {
    if (state.history.length > 0) {
      localStorage.setItem('search-history', JSON.stringify(state.history));
    }
  }, [state.history]);

  // Save saved searches to localStorage
  useEffect(() => {
    if (state.savedSearches.length > 0) {
      localStorage.setItem('saved-searches', JSON.stringify(state.savedSearches));
    }
  }, [state.savedSearches]);

  // URL synchronization with debouncing
  useEffect(() => {
    if (!state.isUrlSynced) return;

    if (urlSyncTimeoutRef.current) {
      clearTimeout(urlSyncTimeoutRef.current);
    }

    urlSyncTimeoutRef.current = setTimeout(() => {
      const params = filtersToUrlParams(state.filters);
      const newUrl = `${router.pathname}?${params.toString()}`;
      
      if (newUrl !== router.asPath) {
        router.replace(newUrl, undefined, { shallow: true });
      }
    }, 500);

    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
      }
    };
  }, [state.filters, state.isUrlSynced, router]);

  // Actions
  const actions: SearchActions = {
    setQuery: useCallback((query: string) => {
      dispatch({ type: 'SET_QUERY', payload: query });
    }, []),

    setFilter: useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      dispatch({ type: 'SET_FILTER', payload: { key, value } });
    }, []),

    clearFilter: useCallback((key: keyof SearchFilters) => {
      dispatch({ type: 'CLEAR_FILTER', payload: key });
    }, []),

    clearAllFilters: useCallback(() => {
      dispatch({ type: 'CLEAR_ALL_FILTERS' });
    }, []),

    applyFilters: useCallback((filters: Partial<SearchFilters>) => {
      dispatch({ type: 'APPLY_FILTERS', payload: filters });
    }, []),

    search: useCallback(async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // In a real implementation, this would call the GraphQL search query
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        // Mock results
        const mockResults: SearchResult[] = Array.from({ length: state.pageSize }, (_, i) => ({
          id: `result-${i}`,
          title: `Course ${i + 1}`,
          description: 'Mock course description',
          type: 'course',
          url: `/course/${i + 1}`,
        }));
        
        const mockFacets: SearchFacets = {
          categories: [
            { value: 'programming', label: 'Programming', count: 150 },
            { value: 'design', label: 'Design', count: 75 },
          ],
          difficulties: [
            { value: 'beginner', label: 'Beginner', count: 100 },
            { value: 'intermediate', label: 'Intermediate', count: 80 },
          ],
          instructors: [],
          languages: [],
          tags: [],
          priceRanges: [],
          ratings: [],
        };
        
        dispatch({ type: 'SET_RESULTS', payload: { 
          results: mockResults, 
          totalCount: 200, 
          hasNextPage: true 
        }});
        dispatch({ type: 'SET_FACETS', payload: mockFacets });
        
        // Add to history
        const historyItem: SearchHistory = {
          id: generateId(),
          query: state.filters.query,
          filters: state.filters,
          timestamp: new Date(),
          resultCount: 200,
        };
        dispatch({ type: 'ADD_TO_HISTORY', payload: historyItem });
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        dispatch({ type: 'SET_ERROR', payload: 'Search failed. Please try again.' });
      }
    }, [state.filters, state.pageSize]),

    loadMore: useCallback(async () => {
      if (!state.hasNextPage || state.isLoading) return;
      
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // In a real implementation, this would call the GraphQL search query with pagination
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        // Mock additional results
        const mockResults: SearchResult[] = Array.from({ length: state.pageSize }, (_, i) => ({
          id: `result-${state.results.length + i}`,
          title: `Course ${state.results.length + i + 1}`,
          description: 'Mock course description',
          type: 'course',
          url: `/course/${state.results.length + i + 1}`,
        }));
        
        dispatch({ type: 'APPEND_RESULTS', payload: { 
          results: mockResults, 
          hasNextPage: state.results.length + mockResults.length < state.totalCount 
        }});
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load more results.' });
      }
    }, [state.hasNextPage, state.isLoading, state.pageSize, state.results.length, state.totalCount]),

    refresh: useCallback(async () => {
      dispatch({ type: 'SET_PAGE', payload: 1 });
      // Trigger search by dispatching loading state
      dispatch({ type: 'SET_LOADING', payload: true });
      
      try {
        // In a real implementation, this would call the GraphQL search query
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        // Mock results
        const mockResults = Array.from({ length: state.pageSize }, (_, i) => ({
          id: `result-${i}`,
          title: `Course ${i + 1}`,
          description: 'Mock course description',
          type: 'course' as const,
          url: `/course/${i + 1}`,
        }));
        
        dispatch({ type: 'SET_RESULTS', payload: { 
          results: mockResults, 
          totalCount: 200, 
          hasNextPage: true 
        }});
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        dispatch({ type: 'SET_ERROR', payload: 'Search failed. Please try again.' });
      }
    }, [state.pageSize]),

    addToHistory: useCallback((resultCount: number) => {
      const historyItem: SearchHistory = {
        id: generateId(),
        query: state.filters.query,
        filters: state.filters,
        timestamp: new Date(),
        resultCount,
      };
      dispatch({ type: 'ADD_TO_HISTORY', payload: historyItem });
    }, [state.filters]),

    clearHistory: useCallback(() => {
      dispatch({ type: 'CLEAR_HISTORY' });
      localStorage.removeItem('search-history');
    }, []),

    loadFromHistory: useCallback((historyItem: SearchHistory) => {
      dispatch({ type: 'LOAD_FROM_HISTORY', payload: historyItem });
    }, []),

    saveSearch: useCallback((name: string) => {
      const savedSearch: SavedSearch = {
        id: generateId(),
        name,
        query: state.filters.query,
        filters: state.filters,
        createdAt: new Date(),
        lastUsed: new Date(),
        useCount: 1,
      };
      dispatch({ type: 'ADD_SAVED_SEARCH', payload: savedSearch });
    }, [state.filters]),

    loadSavedSearch: useCallback((savedSearch: SavedSearch) => {
      dispatch({ type: 'APPLY_FILTERS', payload: savedSearch.filters });
      
      // Update usage statistics
      dispatch({ type: 'UPDATE_SAVED_SEARCH', payload: {
        id: savedSearch.id,
        updates: {
          lastUsed: new Date(),
          useCount: savedSearch.useCount + 1,
        },
      }});
    }, []),

    deleteSavedSearch: useCallback((id: string) => {
      dispatch({ type: 'DELETE_SAVED_SEARCH', payload: id });
    }, []),

    updateSavedSearch: useCallback((id: string, updates: Partial<SavedSearch>) => {
      dispatch({ type: 'UPDATE_SAVED_SEARCH', payload: { id, updates } });
    }, []),

    toggleFilters: useCallback(() => {
      dispatch({ type: 'TOGGLE_FILTERS' });
    }, []),

    setPage: useCallback((page: number) => {
      dispatch({ type: 'SET_PAGE', payload: page });
    }, []),

    syncFromUrl: useCallback(() => {
      if (router.isReady) {
        const params = new URLSearchParams(router.asPath.split('?')[1] || '');
        const filtersFromUrl = urlParamsToFilters(params);
        dispatch({ type: 'APPLY_FILTERS', payload: filtersFromUrl });
        dispatch({ type: 'SET_URL_SYNCED', payload: true });
      }
    }, [router.isReady, router.asPath]),

    syncToUrl: useCallback(() => {
      const params = filtersToUrlParams(state.filters);
      const newUrl = `${router.pathname}?${params.toString()}`;
      router.replace(newUrl, undefined, { shallow: true });
    }, [state.filters, router]),
  };

  // Auto-search with debouncing - now that actions are defined
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (state.filters.query || state.activeFilterCount > 0) {
        // Auto-trigger search after user stops typing/filtering
        actions.search();
      }
    }, 1000);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.filters.query, state.activeFilterCount]); // actions intentionally omitted to prevent infinite re-renders

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return [state, actions];
}

// Utility functions for external use
export function getSearchSuggestions(query: string): string[] {
  // In a real implementation, this would call an API for search suggestions
  const mockSuggestions = [
    'JavaScript fundamentals',
    'React development',
    'Node.js backend',
    'Python programming',
    'Web design',
  ];
  
  return mockSuggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(query.toLowerCase())
  );
}

export function getPopularSearches(): string[] {
  // In a real implementation, this would come from analytics
  return [
    'React',
    'JavaScript',
    'Python',
    'Web Development',
    'Machine Learning',
    'UI/UX Design',
  ];
}