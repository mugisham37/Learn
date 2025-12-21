/**
 * Search Utilities
 * 
 * Utility functions for search functionality including query processing,
 * result formatting, analytics tracking, and search optimization helpers.
 * 
 * Requirements: 2.2 - Complete Module Hook Implementation (Search)
 */

import type { 
  SearchFilters, 
  CourseSearchResult, 
  LessonSearchResult, 
  SearchFacets 
} from '../../hooks/useSearch';

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

// ============================================================================
// Query Processing Utilities
// ============================================================================

/**
 * Sanitize and normalize search query
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 200); // Limit length
}

/**
 * Extract search terms from query
 */
export function extractSearchTerms(query: string): string[] {
  return sanitizeSearchQuery(query)
    .toLowerCase()
    .split(' ')
    .filter(term => term.length > 2)
    .filter(term => !STOP_WORDS.includes(term));
}

/**
 * Generate search suggestions based on query
 */
export function generateQuerySuggestions(query: string, existingResults?: CourseSearchResult[]): string[] {
  const suggestions: string[] = [];
  const terms = extractSearchTerms(query);
  
  // Add term variations
  terms.forEach(term => {
    QUERY_EXPANSIONS[term]?.forEach(expansion => {
      suggestions.push(query.replace(term, expansion));
    });
  });
  
  // Add category-based suggestions from results
  if (existingResults) {
    const categories = [...new Set(existingResults.map(r => r.category))];
    categories.forEach(category => {
      suggestions.push(`${query} ${category.toLowerCase()}`);
    });
  }
  
  return [...new Set(suggestions)].slice(0, 8);
}

/**
 * Build Elasticsearch query from search parameters
 */
export function buildElasticsearchQuery(
  query: string,
  filters: SearchFilters,
  _sort: { field: string; order: string }
): ElasticsearchQuery {
  const esQuery: ElasticsearchQuery = {
    bool: {
      must: [],
      filter: [],
      should: [],
    },
  };

  // Main search query
  if (query.trim()) {
    esQuery.bool.must.push({
      multi_match: {
        query: sanitizeSearchQuery(query),
        fields: [
          'title^3',
          'description^2',
          'lessonContent',
          'instructorName',
          'category',
        ],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  // Apply filters
  if (filters.category?.length) {
    esQuery.bool.filter.push({
      terms: { category: filters.category },
    });
  }

  if (filters.difficulty?.length) {
    esQuery.bool.filter.push({
      terms: { difficulty: filters.difficulty.map(d => d.toLowerCase()) },
    });
  }

  if (filters.priceRange) {
    const priceFilter: ElasticsearchRangeQuery = { 
      range: { 
        price: {} 
      } 
    };
    
    if (filters.priceRange.min !== undefined) {
      priceFilter.range.price.gte = filters.priceRange.min;
    }
    if (filters.priceRange.max !== undefined) {
      priceFilter.range.price.lte = filters.priceRange.max;
    }
    
    esQuery.bool.filter.push(priceFilter as Record<string, unknown>);
  }

  if (filters.rating?.min) {
    esQuery.bool.filter.push({
      range: { averageRating: { gte: filters.rating.min } },
    });
  }

  if (filters.status?.length) {
    esQuery.bool.filter.push({
      terms: { status: filters.status.map(s => s.toLowerCase()) },
    });
  }

  if (filters.language?.length) {
    esQuery.bool.filter.push({
      terms: { language: filters.language },
    });
  }

  // Boost popular and recent content
  esQuery.bool.should.push(
    { range: { enrollmentCount: { gte: 100, boost: 1.2 } } },
    { range: { averageRating: { gte: 4.0, boost: 1.1 } } },
    { range: { publishedAt: { gte: 'now-30d', boost: 1.1 } } }
  );

  return esQuery;
}

// ============================================================================
// Result Processing Utilities
// ============================================================================

/**
 * Format search results for display
 */
export function formatSearchResults(results: CourseSearchResult[]): CourseSearchResult[] {
  return results.map(result => ({
    ...result,
    // Format price for display
    formattedPrice: formatPrice(parseFloat(result.price), result.currency),
    // Calculate relevance score
    relevanceScore: calculateRelevanceScore(result),
    // Format dates
    formattedPublishedAt: result.publishedAt ? formatDate(result.publishedAt) : null,
    formattedCreatedAt: formatDate(result.createdAt),
    // Extract highlights
    highlights: extractHighlights(result.highlight),
  }));
}

/**
 * Format lesson search results
 */
export function formatLessonResults(results: LessonSearchResult[]): LessonSearchResult[] {
  return results.map(result => ({
    ...result,
    // Format duration
    formattedDuration: formatDuration(result.durationMinutes),
    // Format dates
    formattedCreatedAt: formatDate(result.createdAt),
    // Extract highlights
    highlights: extractHighlights(result.highlight),
    // Generate lesson URL
    lessonUrl: `/course/${result.courseId}/lesson/${result.id}`,
  }));
}

/**
 * Process search facets for UI display
 */
export function processFacets(facets: SearchFacets): ProcessedFacets {
  return {
    categories: facets.categories
      .sort((a, b) => b.count - a.count)
      .map(facet => ({
        ...facet,
        label: formatCategoryLabel(facet.key),
        percentage: 0, // Will be calculated by UI
      })),
    difficulties: facets.difficulties
      .sort((a, b) => DIFFICULTY_ORDER.indexOf(a.key) - DIFFICULTY_ORDER.indexOf(b.key))
      .map(facet => ({
        ...facet,
        label: formatDifficultyLabel(facet.key),
        percentage: 0,
      })),
    priceRanges: facets.priceRanges
      .sort((a, b) => (a.from || 0) - (b.from || 0))
      .map(facet => ({
        ...facet,
        label: formatPriceRangeLabel(facet.from, facet.to),
        percentage: 0,
      })),
    ratings: facets.ratings
      .sort((a, b) => (b.from || 0) - (a.from || 0))
      .map(facet => ({
        ...facet,
        label: formatRatingLabel(facet.from),
        percentage: 0,
      })),
    languages: facets.languages
      .sort((a, b) => b.count - a.count)
      .map(facet => ({
        ...facet,
        label: formatLanguageLabel(facet.key),
        percentage: 0,
      })),
  };
}

// ============================================================================
// Analytics and Tracking Utilities
// ============================================================================

/**
 * Track search event for analytics
 */
export function trackSearchEvent(
  query: string,
  filters: SearchFilters,
  resultCount: number,
  searchTime: number,
  userId?: string
) {
  const searchEvent = {
    type: 'search_performed',
    timestamp: new Date().toISOString(),
    query: sanitizeSearchQuery(query),
    filters: sanitizeFilters(filters),
    resultCount,
    searchTime,
    userId,
    sessionId: getSessionId(),
  };

  // Send to analytics service
  if (typeof window !== 'undefined') {
    // Client-side analytics
    window.gtag?.('event', 'search', {
      search_term: query,
      result_count: resultCount,
      search_time: searchTime,
    });

    // Store in local analytics
    storeLocalAnalytics(searchEvent);
  }

  return searchEvent;
}

/**
 * Track search result click
 */
export function trackSearchResultClick(
  query: string,
  resultId: string,
  position: number,
  resultType: 'course' | 'lesson'
) {
  const clickEvent = {
    type: 'search_result_click',
    timestamp: new Date().toISOString(),
    query: sanitizeSearchQuery(query),
    resultId,
    position,
    resultType,
    sessionId: getSessionId(),
  };

  if (typeof window !== 'undefined') {
    window.gtag?.('event', 'select_content', {
      content_type: resultType,
      content_id: resultId,
      search_term: query,
    });

    storeLocalAnalytics(clickEvent);
  }

  return clickEvent;
}

/**
 * Get search performance metrics
 */
export function getSearchMetrics(): SearchMetrics {
  if (typeof window === 'undefined') {
    return DEFAULT_METRICS;
  }

  const stored = localStorage.getItem('search_metrics');
  if (!stored) {
    return DEFAULT_METRICS;
  }

  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_METRICS;
  }
}

/**
 * Update search performance metrics
 */
export function updateSearchMetrics(
  searchTime: number,
  resultCount: number,
  query: string
) {
  const metrics = getSearchMetrics();
  
  metrics.totalSearches++;
  metrics.totalSearchTime += searchTime;
  metrics.averageSearchTime = metrics.totalSearchTime / metrics.totalSearches;
  
  if (resultCount === 0) {
    metrics.zeroResultSearches++;
    metrics.zeroResultQueries.push(query);
    // Keep only last 50 zero result queries
    if (metrics.zeroResultQueries.length > 50) {
      metrics.zeroResultQueries = metrics.zeroResultQueries.slice(-50);
    }
  } else {
    metrics.successfulSearches++;
  }
  
  metrics.successRate = metrics.successfulSearches / metrics.totalSearches;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('search_metrics', JSON.stringify(metrics));
  }
  
  return metrics;
}

// ============================================================================
// Search Optimization Utilities
// ============================================================================

/**
 * Calculate relevance score for search result
 */
export function calculateRelevanceScore(result: CourseSearchResult): number {
  let score = result.searchBoost || 1;
  
  // Boost based on ratings
  if (result.averageRating) {
    score += (result.averageRating - 3) * 0.2; // Boost 4+ star courses
  }
  
  // Boost based on enrollment count
  score += Math.log10(result.enrollmentCount + 1) * 0.1;
  
  // Boost recent content
  const daysSincePublished = result.publishedAt 
    ? (Date.now() - new Date(result.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;
  
  if (daysSincePublished < 30) {
    score += 0.3;
  } else if (daysSincePublished < 90) {
    score += 0.1;
  }
  
  return Math.round(score * 100) / 100;
}

/**
 * Optimize search results based on user preferences
 */
export function optimizeResultsForUser(
  results: CourseSearchResult[],
  userPreferences?: UserPreferences
): CourseSearchResult[] {
  if (!userPreferences) {
    return results;
  }

  return results.map(result => {
    let boostScore = 0;

    // Boost preferred categories
    if (userPreferences.preferredCategories?.includes(result.category)) {
      boostScore += 0.5;
    }

    // Boost appropriate difficulty level
    if (userPreferences.skillLevel) {
      const userLevel = userPreferences.skillLevel.toUpperCase();
      if (result.difficulty === userLevel) {
        boostScore += 0.3;
      } else if (
        (userLevel === 'BEGINNER' && result.difficulty === 'INTERMEDIATE') ||
        (userLevel === 'INTERMEDIATE' && result.difficulty === 'ADVANCED')
      ) {
        boostScore += 0.1; // Slight boost for next level
      }
    }

    // Boost preferred price range
    if (userPreferences.maxPrice && parseFloat(result.price) <= userPreferences.maxPrice) {
      boostScore += 0.2;
    }

    return {
      ...result,
      personalizedScore: (result.searchBoost || 1) + boostScore,
    };
  }).sort((a, b) => (b.personalizedScore || 0) - (a.personalizedScore || 0));
}

/**
 * Generate search suggestions based on user history
 */
export function generatePersonalizedSuggestions(
  userSearchHistory: string[],
  trendingSearches: string[]
): string[] {
  const suggestions = new Set<string>();
  
  // Add recent searches (last 5)
  userSearchHistory.slice(-5).forEach(query => {
    suggestions.add(query);
  });
  
  // Add trending searches
  trendingSearches.slice(0, 5).forEach(query => {
    suggestions.add(query);
  });
  
  // Add category-based suggestions
  POPULAR_CATEGORIES.forEach(category => {
    suggestions.add(category);
  });
  
  return Array.from(suggestions).slice(0, 10);
}

// ============================================================================
// Helper Functions and Constants
// ============================================================================

const STOP_WORDS = [
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'
];

const QUERY_EXPANSIONS: Record<string, string[]> = {
  'js': ['javascript'],
  'react': ['reactjs', 'react.js'],
  'node': ['nodejs', 'node.js'],
  'python': ['py'],
  'css': ['styling', 'styles'],
  'html': ['markup'],
  'api': ['rest', 'graphql'],
  'db': ['database'],
  'ml': ['machine learning'],
  'ai': ['artificial intelligence'],
};

const DIFFICULTY_ORDER = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

const POPULAR_CATEGORIES = [
  'Web Development',
  'Data Science',
  'Mobile Development',
  'DevOps',
  'Design',
  'Business',
  'Marketing',
];

const DEFAULT_METRICS: SearchMetrics = {
  totalSearches: 0,
  totalSearchTime: 0,
  averageSearchTime: 0,
  successfulSearches: 0,
  zeroResultSearches: 0,
  successRate: 0,
  zeroResultQueries: [],
};

// ============================================================================
// Type Definitions
// ============================================================================

export interface ProcessedFacets {
  categories: Array<{ key: string; count: number; label: string; percentage: number }>;
  difficulties: Array<{ key: string; count: number; label: string; percentage: number }>;
  priceRanges: Array<{ key: string; count: number; label: string; percentage: number; from?: number; to?: number }>;
  ratings: Array<{ key: string; count: number; label: string; percentage: number; from?: number }>;
  languages: Array<{ key: string; count: number; label: string; percentage: number }>;
}

export interface SearchMetrics {
  totalSearches: number;
  totalSearchTime: number;
  averageSearchTime: number;
  successfulSearches: number;
  zeroResultSearches: number;
  successRate: number;
  zeroResultQueries: string[];
}

export interface UserPreferences {
  preferredCategories?: string[];
  skillLevel?: string;
  maxPrice?: number;
  preferredLanguage?: string;
}

// Elasticsearch query types
interface ElasticsearchRangeQuery {
  range: {
    [field: string]: {
      gte?: number;
      lte?: number;
      boost?: number;
    };
  };
}

interface ElasticsearchQuery {
  bool: {
    must: Array<Record<string, unknown>>;
    filter: Array<Record<string, unknown>>;
    should: Array<Record<string, unknown>>;
  };
}

// ============================================================================
// Formatting Helper Functions
// ============================================================================

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(price);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
}

function formatDuration(minutes?: number): string {
  if (!minutes) return 'N/A';
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${remainingMinutes}m`;
}

function formatCategoryLabel(category: string): string {
  return category.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDifficultyLabel(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
}

function formatPriceRangeLabel(from?: number, to?: number): string {
  if (from !== undefined && to !== undefined) {
    return `$${from} - $${to}`;
  } else if (from !== undefined) {
    return `$${from}+`;
  } else if (to !== undefined) {
    return `Under $${to}`;
  }
  return 'Any Price';
}

function formatRatingLabel(from?: number): string {
  if (from !== undefined) {
    return `${from}+ Stars`;
  }
  return 'Any Rating';
}

function formatLanguageLabel(language: string): string {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
  };
  
  return languageNames[language] || language.toUpperCase();
}

function extractHighlights(highlight?: Record<string, unknown>): string[] {
  if (!highlight) return [];
  
  const highlights: string[] = [];
  Object.values(highlight).forEach(value => {
    if (Array.isArray(value)) {
      highlights.push(...value);
    } else if (typeof value === 'string') {
      highlights.push(value);
    }
  });
  
  return highlights.slice(0, 3); // Limit to 3 highlights
}

function sanitizeFilters(filters: SearchFilters): SearchFilters {
  return {
    ...filters,
    // Remove any potentially sensitive data
  };
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('search_session_id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('search_session_id', sessionId);
  }
  return sessionId;
}

function storeLocalAnalytics(event: Record<string, unknown>): void {
  try {
    const stored = localStorage.getItem('search_analytics') || '[]';
    const analytics = JSON.parse(stored);
    analytics.push(event);
    
    // Keep only last 1000 events
    if (analytics.length > 1000) {
      analytics.splice(0, analytics.length - 1000);
    }
    
    localStorage.setItem('search_analytics', JSON.stringify(analytics));
  } catch (error) {
    console.warn('Failed to store search analytics:', error);
  }
}