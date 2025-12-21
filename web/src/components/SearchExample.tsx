/**
 * Search Example Component
 *
 * Comprehensive example demonstrating the usage of all search hooks and utilities.
 * This component showcases the complete search functionality including faceted search,
 * autocomplete, trending searches, and search analytics.
 *
 * Requirements: 2.2 - Complete Module Hook Implementation (Search)
 */

'use client';

import { useState, useCallback } from 'react';
import {
  useSearch,
  useFacetedSearch,
  useAutocomplete,
  useTrendingSearches,
  useSearchLessons,
  useSearchAnalytics,
  SearchProvider,
  type SearchFilters,
  type CourseSearchResult,
} from '../lib/search';

// ============================================================================
// Main Search Interface Component
// ============================================================================

function SearchInterface() {
  const [query, setQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'courses' | 'lessons'>('courses');

  // Basic search hook
  const searchHook = useSearch({
    query,
    filters: {},
    sort: { field: 'RELEVANCE', order: 'DESC' },
    includeFacets: true,
    skip: !query.trim(),
  });

  // Faceted search hook for advanced filtering
  const facetedSearchHook = useFacetedSearch({
    query,
    autoSearch: true,
    debounceMs: 500,
  });

  // Autocomplete hook
  const autocompleteHook = useAutocomplete({
    query,
    limit: 8,
    debounceMs: 300,
  });

  // Trending searches
  const trendingHook = useTrendingSearches({
    limit: 10,
  });

  // Lesson search
  const lessonSearchHook = useSearchLessons({
    query,
    skip: selectedTab !== 'lessons' || !query.trim(),
  });

  // Analytics and optimization
  const analyticsHook = useSearchAnalytics();

  // Handle search submission
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    try {
      if (selectedTab === 'courses') {
        await searchHook.refetch();
      } else {
        await lessonSearchHook.refetch();
      }

      // Track search analytics
      const resultCount =
        selectedTab === 'courses' ? searchHook.data?.total || 0 : lessonSearchHook.data?.total || 0;

      analyticsHook.trackSearch(query, resultCount, searchHook.data?.took || 0);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [query, selectedTab, searchHook, lessonSearchHook, analyticsHook]);

  // Handle result click tracking
  const handleResultClick = useCallback(
    (result: CourseSearchResult) => {
      analyticsHook.trackSearch(query, 1, 0); // Track click
      // Navigate to course page
      window.location.href = `/course/${result.slug}`;
    },
    [query, analyticsHook]
  );

  return (
    <div className='max-w-6xl mx-auto p-6 space-y-6'>
      {/* Search Header */}
      <div className='text-center space-y-4'>
        <h1 className='text-3xl font-bold text-gray-900'>Course Search</h1>
        <p className='text-gray-600'>Find the perfect course from our extensive library</p>
      </div>

      {/* Search Input */}
      <div className='relative'>
        <div className='relative'>
          <input
            type='text'
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder='Search for courses, topics, or instructors...'
            className='w-full px-4 py-3 pl-12 pr-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            data-search-input
          />
          <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
            <svg
              className='h-5 w-5 text-gray-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          </div>
        </div>

        {/* Autocomplete Suggestions */}
        {autocompleteHook.suggestions.length > 0 && query.length > 1 && (
          <div className='absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg'>
            {autocompleteHook.suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setQuery(suggestion)}
                className='w-full px-4 py-2 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg'
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search Tabs */}
      <div className='flex space-x-1 bg-gray-100 p-1 rounded-lg'>
        <button
          onClick={() => setSelectedTab('courses')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            selectedTab === 'courses'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Courses ({searchHook.data?.total || 0})
        </button>
        <button
          onClick={() => setSelectedTab('lessons')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            selectedTab === 'lessons'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Lessons ({lessonSearchHook.data?.total || 0})
        </button>
      </div>

      {/* Advanced Filters Toggle */}
      <div className='flex justify-between items-center'>
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className='flex items-center space-x-2 text-blue-600 hover:text-blue-700'
        >
          <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4'
            />
          </svg>
          <span>Advanced Filters</span>
        </button>

        {/* Search Stats */}
        {(searchHook.data || lessonSearchHook.data) && (
          <div className='text-sm text-gray-600'>
            {selectedTab === 'courses'
              ? `${searchHook.data?.total || 0} courses found in ${searchHook.data?.took || 0}ms`
              : `${lessonSearchHook.data?.total || 0} lessons found in ${lessonSearchHook.data?.took || 0}ms`}
          </div>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <AdvancedFiltersPanel
          facetedSearch={facetedSearchHook}
          onFiltersChange={filters => {
            // Apply filters to search
            facetedSearchHook.setFilter('category', filters.category);
            facetedSearchHook.setFilter('difficulty', filters.difficulty);
            facetedSearchHook.setFilter('priceRange', filters.priceRange);
          }}
        />
      )}

      {/* Search Results */}
      <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
        {/* Facets Sidebar */}
        {selectedTab === 'courses' && searchHook.data?.facets && (
          <div className='lg:col-span-1'>
            <FacetsPanel
              facets={searchHook.data.facets}
              onFilterChange={(key, value) => {
                facetedSearchHook.setFilter(key, value);
              }}
            />
          </div>
        )}

        {/* Results List */}
        <div
          className={
            selectedTab === 'courses' && searchHook.data?.facets ? 'lg:col-span-3' : 'lg:col-span-4'
          }
        >
          {selectedTab === 'courses' ? (
            <CourseResultsList
              results={searchHook.data?.documents || []}
              loading={searchHook.loading}
              onResultClick={handleResultClick}
              onLoadMore={() =>
                searchHook.fetchMore({ from: searchHook.data?.documents.length || 0, size: 20 })
              }
              hasMore={searchHook.hasNextPage}
            />
          ) : (
            <LessonResultsList
              results={lessonSearchHook.data?.documents || []}
              loading={lessonSearchHook.loading}
              onLoadMore={() =>
                lessonSearchHook.fetchMore({
                  from: lessonSearchHook.data?.documents.length || 0,
                  size: 20,
                })
              }
              hasMore={lessonSearchHook.hasNextPage}
            />
          )}
        </div>
      </div>

      {/* Trending Searches */}
      {!query && trendingHook.trendingSearches.length > 0 && (
        <div className='bg-gray-50 rounded-lg p-6'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4'>Trending Searches</h3>
          <div className='flex flex-wrap gap-2'>
            {trendingHook.trendingSearches.map((trend, index) => (
              <button
                key={index}
                onClick={() => setQuery(trend)}
                className='px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-50 transition-colors'
              >
                {trend}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Analytics Dashboard */}
      <SearchAnalyticsDashboard analytics={analyticsHook} />
    </div>
  );
}

// ============================================================================
// Advanced Filters Panel Component
// ============================================================================

interface AdvancedFiltersPanelProps {
  facetedSearch: ReturnType<typeof useFacetedSearch>;
  onFiltersChange: (filters: SearchFilters) => void;
}

function AdvancedFiltersPanel({ facetedSearch, onFiltersChange }: AdvancedFiltersPanelProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>({});

  const handleFilterChange = useCallback(
    (key: keyof SearchFilters, value: string[] | { min?: number; max?: number }) => {
      const newFilters = { ...localFilters, [key]: value };
      setLocalFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [localFilters, onFiltersChange]
  );

  return (
    <div className='bg-gray-50 rounded-lg p-6 space-y-4'>
      <h3 className='text-lg font-semibold text-gray-900'>Advanced Filters</h3>

      {/* Category Filter */}
      <div>
        <label className='block text-sm font-medium text-gray-700 mb-2'>Category</label>
        <select
          multiple
          value={localFilters.category || []}
          onChange={e => {
            const values = Array.from(e.target.selectedOptions, option => option.value);
            handleFilterChange('category', values);
          }}
          className='w-full border border-gray-300 rounded-md px-3 py-2'
        >
          <option value='programming'>Programming</option>
          <option value='design'>Design</option>
          <option value='business'>Business</option>
          <option value='marketing'>Marketing</option>
          <option value='data-science'>Data Science</option>
        </select>
      </div>

      {/* Difficulty Filter */}
      <div>
        <label className='block text-sm font-medium text-gray-700 mb-2'>Difficulty</label>
        <div className='space-y-2'>
          {['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map(difficulty => (
            <label key={difficulty} className='flex items-center'>
              <input
                type='checkbox'
                checked={localFilters.difficulty?.includes(difficulty) || false}
                onChange={e => {
                  const current = localFilters.difficulty || [];
                  const updated = e.target.checked
                    ? [...current, difficulty]
                    : current.filter(d => d !== difficulty);
                  handleFilterChange('difficulty', updated);
                }}
                className='mr-2'
              />
              <span className='text-sm text-gray-700'>{difficulty.toLowerCase()}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range Filter */}
      <div>
        <label className='block text-sm font-medium text-gray-700 mb-2'>Price Range</label>
        <div className='grid grid-cols-2 gap-2'>
          <input
            type='number'
            placeholder='Min'
            value={localFilters.priceRange?.min || ''}
            onChange={e => {
              const min = e.target.value ? parseInt(e.target.value, 10) : undefined;
              if (min !== undefined) {
                handleFilterChange('priceRange', {
                  ...localFilters.priceRange,
                  min,
                });
              }
            }}
            className='border border-gray-300 rounded-md px-3 py-2'
          />
          <input
            type='number'
            placeholder='Max'
            value={localFilters.priceRange?.max || ''}
            onChange={e => {
              const max = e.target.value ? parseInt(e.target.value, 10) : undefined;
              if (max !== undefined) {
                handleFilterChange('priceRange', {
                  ...localFilters.priceRange,
                  max,
                });
              }
            }}
            className='border border-gray-300 rounded-md px-3 py-2'
          />
        </div>
      </div>

      {/* Clear Filters */}
      <button
        onClick={() => {
          setLocalFilters({});
          facetedSearch.clearAllFilters();
        }}
        className='w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors'
      >
        Clear All Filters
      </button>
    </div>
  );
}

// ============================================================================
// Facets Panel Component
// ============================================================================

interface FacetsPanelProps {
  facets: {
    categories?: Array<{ key: string; count: number }>;
    difficulties?: Array<{ key: string; count: number }>;
    priceRanges?: Array<{ key: string; count: number; from?: number; to?: number }>;
  };
  onFilterChange: (key: keyof SearchFilters, value: string[] | { min?: number; max?: number }) => void;
}

function FacetsPanel({ facets, onFilterChange }: FacetsPanelProps) {
  return (
    <div className='bg-white border border-gray-200 rounded-lg p-4 space-y-6'>
      <h3 className='text-lg font-semibold text-gray-900'>Refine Results</h3>

      {/* Categories */}
      {facets.categories && facets.categories.length > 0 && (
        <div>
          <h4 className='font-medium text-gray-900 mb-2'>Categories</h4>
          <div className='space-y-1'>
            {facets.categories.slice(0, 8).map((category) => (
              <button
                key={category.key}
                onClick={() => onFilterChange('category', [category.key])}
                className='flex justify-between w-full text-left text-sm text-gray-600 hover:text-gray-900'
              >
                <span>{category.key}</span>
                <span>({category.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Difficulties */}
      {facets.difficulties && facets.difficulties.length > 0 && (
        <div>
          <h4 className='font-medium text-gray-900 mb-2'>Difficulty</h4>
          <div className='space-y-1'>
            {facets.difficulties.map((difficulty) => (
              <button
                key={difficulty.key}
                onClick={() => onFilterChange('difficulty', [difficulty.key])}
                className='flex justify-between w-full text-left text-sm text-gray-600 hover:text-gray-900'
              >
                <span>{difficulty.key}</span>
                <span>({difficulty.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Ranges */}
      {facets.priceRanges && facets.priceRanges.length > 0 && (
        <div>
          <h4 className='font-medium text-gray-900 mb-2'>Price</h4>
          <div className='space-y-1'>
            {facets.priceRanges.map((range) => (
              <button
                key={range.key}
                onClick={() => {
                  const min = range.from;
                  const max = range.to;
                  const priceRange: { min?: number; max?: number } = {};
                  if (min !== undefined) priceRange.min = min;
                  if (max !== undefined) priceRange.max = max;
                  onFilterChange('priceRange', priceRange);
                }}
                className='flex justify-between w-full text-left text-sm text-gray-600 hover:text-gray-900'
              >
                <span>{range.key}</span>
                <span>({range.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Course Results List Component
// ============================================================================

interface CourseResultsListProps {
  results: CourseSearchResult[];
  loading: boolean;
  onResultClick: (result: CourseSearchResult) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}

function CourseResultsList({
  results,
  loading,
  onResultClick,
  onLoadMore,
  hasMore,
}: CourseResultsListProps) {
  if (loading && results.length === 0) {
    return (
      <div className='space-y-4'>
        {[...Array(5)].map((_, i) => (
          <div key={i} className='animate-pulse bg-gray-200 h-32 rounded-lg' />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className='text-center py-12'>
        <svg
          className='mx-auto h-12 w-12 text-gray-400'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33'
          />
        </svg>
        <h3 className='mt-2 text-sm font-medium text-gray-900'>No courses found</h3>
        <p className='mt-1 text-sm text-gray-500'>Try adjusting your search terms or filters.</p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {results.map((result) => (
        <div
          key={result.id}
          onClick={() => onResultClick(result)}
          className='bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer'
        >
          <div className='flex justify-between items-start'>
            <div className='flex-1'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>{result.title}</h3>
              <p className='text-gray-600 mb-3 line-clamp-2'>{result.description}</p>

              <div className='flex items-center space-x-4 text-sm text-gray-500'>
                <span>By {result.instructorName}</span>
                <span>•</span>
                <span className='capitalize'>{result.difficulty.toLowerCase()}</span>
                <span>•</span>
                <span>{result.enrollmentCount} students</span>
                {result.averageRating && (
                  <>
                    <span>•</span>
                    <span className='flex items-center'>
                      <svg
                        className='h-4 w-4 text-yellow-400 mr-1'
                        fill='currentColor'
                        viewBox='0 0 20 20'
                      >
                        <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                      </svg>
                      {result.averageRating.toFixed(1)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className='text-right'>
              <div className='text-2xl font-bold text-gray-900'>
                ${parseFloat(result.price).toFixed(0)}
              </div>
              <div className='text-sm text-gray-500'>{result.currency}</div>
            </div>
          </div>

          {/* Highlights */}
          {result.highlight && (
            <div className='mt-3 text-sm text-gray-600'>
              <div
                dangerouslySetInnerHTML={{ __html: Object.values(result.highlight)[0] as string }}
              />
            </div>
          )}
        </div>
      ))}

      {/* Load More Button */}
      {hasMore && (
        <div className='text-center pt-6'>
          <button
            onClick={onLoadMore}
            disabled={loading}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Lesson Results List Component
// ============================================================================

interface LessonResultsListProps {
  results: Array<{
    id: string;
    title: string;
    courseTitle: string;
    lessonType: string;
    durationMinutes?: number;
    courseDifficulty: string;
  }>;
  loading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
}

function LessonResultsList({ results, loading, onLoadMore, hasMore }: LessonResultsListProps) {
  if (loading && results.length === 0) {
    return (
      <div className='space-y-4'>
        {[...Array(5)].map((_, i) => (
          <div key={i} className='animate-pulse bg-gray-200 h-24 rounded-lg' />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className='text-center py-12'>
        <h3 className='mt-2 text-sm font-medium text-gray-900'>No lessons found</h3>
        <p className='mt-1 text-sm text-gray-500'>Try adjusting your search terms.</p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {results.map((result) => (
        <div
          key={result.id}
          className='bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow'
        >
          <div className='flex justify-between items-start'>
            <div className='flex-1'>
              <h4 className='font-semibold text-gray-900'>{result.title}</h4>
              <p className='text-sm text-gray-600 mt-1'>{result.courseTitle}</p>
              <div className='flex items-center space-x-2 mt-2 text-xs text-gray-500'>
                <span className='capitalize'>{result.lessonType.toLowerCase()}</span>
                {result.durationMinutes && (
                  <>
                    <span>•</span>
                    <span>{result.durationMinutes} min</span>
                  </>
                )}
                <span>•</span>
                <span className='capitalize'>{result.courseDifficulty.toLowerCase()}</span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {hasMore && (
        <div className='text-center pt-6'>
          <button
            onClick={onLoadMore}
            disabled={loading}
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Search Analytics Dashboard Component
// ============================================================================

interface SearchAnalyticsDashboardProps {
  analytics: ReturnType<typeof useSearchAnalytics>;
}

function SearchAnalyticsDashboard({ analytics }: SearchAnalyticsDashboardProps) {
  const insights = analytics.getSearchInsights();

  return (
    <div className='bg-white border border-gray-200 rounded-lg p-6'>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>Search Analytics</h3>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='text-center'>
          <div className='text-2xl font-bold text-blue-600'>{insights.totalSearches}</div>
          <div className='text-sm text-gray-600'>Total Searches</div>
        </div>

        <div className='text-center'>
          <div className='text-2xl font-bold text-green-600'>
            {Math.round(insights.averageSearchTime)}ms
          </div>
          <div className='text-sm text-gray-600'>Avg Search Time</div>
        </div>

        <div className='text-center'>
          <div className='text-2xl font-bold text-purple-600'>
            {Math.round(insights.searchSuccessRate * 100)}%
          </div>
          <div className='text-sm text-gray-600'>Success Rate</div>
        </div>

        <div className='text-center'>
          <div className='text-2xl font-bold text-orange-600'>
            {insights.indexHealth?.coursesIndexed || 0}
          </div>
          <div className='text-sm text-gray-600'>Courses Indexed</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Example Component with Provider
// ============================================================================

export default function SearchExample() {
  return (
    <SearchProvider>
      <SearchInterface />
    </SearchProvider>
  );
}
