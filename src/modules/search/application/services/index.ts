/**
 * Search Application Services
 * 
 * Exports all search application layer services and interfaces.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */

export type { 
  ISearchService,
  SearchFilters,
  PaginationDTO,
  SortOptions,
  SearchResults,
  SearchFacets,
  CourseSearchResult,
  LessonSearchResult,
} from './ISearchService.js';

export { SearchService } from './SearchService.js';