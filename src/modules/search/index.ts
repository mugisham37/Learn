/**
 * Search Module
 * 
 * Provides search functionality including full-text search, filtering,
 * faceted search, autocomplete, and trending searches using Elasticsearch.
 * 
 * This module handles:
 * - Course and lesson indexing for search
 * - Full-text search with relevance ranking
 * - Faceted filtering by category, difficulty, price, rating
 * - Autocomplete suggestions
 * - Trending search terms
 * - Search result highlighting
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

// Application layer exports
export * from './application/index.js';

// Infrastructure layer exports (re-exported for convenience)
export type { 
  ISearchRepository,
  CourseSearchDocument,
  LessonSearchDocument,
  BulkIndexResult,
  SearchResult,
  IndexStats,
} from '../../infrastructure/search/ISearchRepository.js';

export { 
  SearchRepository,
  createSearchRepository,
} from '../../infrastructure/search/index.js';

/**
 * Create a configured search service instance
 * Factory function to create a search service with all dependencies
 */
export async function createSearchService(): Promise<import('./application/services/ISearchService.js').ISearchService> {
  const { createSearchRepository } = await import('../../infrastructure/search/index.js');
  const { SearchService } = await import('./application/services/SearchService.js');
  
  const searchRepository = await createSearchRepository();
  return new SearchService(searchRepository);
}