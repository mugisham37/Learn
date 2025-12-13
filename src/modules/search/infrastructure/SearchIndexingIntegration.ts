/**
 * Search Indexing Integration
 *
 * Provides integration utilities for setting up search indexing
 * in the main application startup process.
 *
 * Requirements: 8.7 - Search indexing strategy integration
 */

import { logger } from '../../../shared/utils/logger.js';
import { SearchIndexingService } from './events/SearchIndexingService.js';
import { createSearchService } from '../index.js';

/**
 * Global search indexing service instance
 */
let searchIndexingService: SearchIndexingService | null = null;

/**
 * Search indexing integration configuration
 */
export interface SearchIndexingIntegrationConfig {
  enableEventHandlers?: boolean;
  enableBulkReindexing?: boolean;
  bulkReindexBatchSize?: number;
  retryFailedJobs?: boolean;
  autoInitialize?: boolean;
}

/**
 * Initializes the search indexing system
 */
export async function initializeSearchIndexing(
  config: SearchIndexingIntegrationConfig = {}
): Promise<SearchIndexingService> {
  try {
    if (searchIndexingService) {
      logger.warn('Search indexing service already initialized');
      return searchIndexingService;
    }

    logger.info('Initializing search indexing system...', {
      config,
    });

    // Create search service
    const searchService = await createSearchService();

    // Create and initialize search indexing service
    searchIndexingService = new SearchIndexingService(searchService, {
      enableEventHandlers: config.enableEventHandlers !== false,
      enableBulkReindexing: config.enableBulkReindexing !== false,
      bulkReindexBatchSize: config.bulkReindexBatchSize || 100,
      retryFailedJobs: config.retryFailedJobs !== false,
    });

    if (config.autoInitialize !== false) {
      await searchIndexingService.initialize();
    }

    logger.info('Search indexing system initialized successfully');

    return searchIndexingService;
  } catch (error) {
    logger.error('Failed to initialize search indexing system', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Gets the current search indexing service instance
 */
export function getSearchIndexingService(): SearchIndexingService | null {
  return searchIndexingService;
}

/**
 * Shuts down the search indexing system
 */
export async function shutdownSearchIndexing(): Promise<void> {
  try {
    if (!searchIndexingService) {
      logger.warn('Search indexing service not initialized');
      return;
    }

    logger.info('Shutting down search indexing system...');

    await searchIndexingService.shutdown();
    searchIndexingService = null;

    logger.info('Search indexing system shut down successfully');
  } catch (error) {
    logger.error('Failed to shut down search indexing system', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Gets health information about the search indexing system
 */
export async function getSearchIndexingHealth(): Promise<{
  healthy: boolean;
  initialized: boolean;
  queue?: {
    waiting: number;
    active: number;
    failed: number;
  };
  search?: {
    healthy: boolean;
    indices: {
      courses: boolean;
      lessons: boolean;
    };
    statistics?: {
      coursesIndexed: number;
      lessonsIndexed: number;
    };
  };
  eventHandlers?: {
    enabled: boolean;
    subscribedEvents: number;
  };
  error?: string;
}> {
  try {
    if (!searchIndexingService) {
      return {
        healthy: false,
        initialized: false,
        error: 'Search indexing service not initialized',
      };
    }

    const health = await searchIndexingService.getHealth();

    return {
      healthy: health.healthy,
      initialized: true,
      queue: health.queue,
      search: health.search,
      eventHandlers: health.eventHandlers,
    };
  } catch (error) {
    logger.error('Failed to get search indexing health', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      healthy: false,
      initialized: searchIndexingService !== null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Manually triggers indexing for a course
 */
export async function indexCourse(
  courseId: string,
  options?: { priority?: number; delay?: number }
): Promise<void> {
  if (!searchIndexingService) {
    throw new Error('Search indexing service not initialized');
  }

  return await searchIndexingService.indexCourse(courseId, options);
}

/**
 * Manually triggers indexing for a lesson
 */
export async function indexLesson(
  lessonId: string,
  courseId: string,
  options?: { priority?: number; delay?: number }
): Promise<void> {
  if (!searchIndexingService) {
    throw new Error('Search indexing service not initialized');
  }

  return await searchIndexingService.indexLesson(lessonId, courseId, options);
}

/**
 * Manually triggers removal of a course from search index
 */
export async function removeCourse(
  courseId: string,
  options?: { priority?: number; delay?: number }
): Promise<void> {
  if (!searchIndexingService) {
    throw new Error('Search indexing service not initialized');
  }

  return await searchIndexingService.removeCourse(courseId, options);
}

/**
 * Manually triggers removal of a lesson from search index
 */
export async function removeLesson(
  lessonId: string,
  options?: { priority?: number; delay?: number }
): Promise<void> {
  if (!searchIndexingService) {
    throw new Error('Search indexing service not initialized');
  }

  return await searchIndexingService.removeLesson(lessonId, options);
}

/**
 * Triggers bulk reindexing
 */
export async function bulkReindex(
  type: 'courses' | 'lessons' | 'all',
  options?: {
    batchSize?: number;
    startFromId?: string;
    priority?: number;
    delay?: number;
  }
): Promise<void> {
  if (!searchIndexingService) {
    throw new Error('Search indexing service not initialized');
  }

  return await searchIndexingService.bulkReindex(type, options);
}

/**
 * Refreshes search indices
 */
export async function refreshSearchIndices(): Promise<void> {
  if (!searchIndexingService) {
    throw new Error('Search indexing service not initialized');
  }

  return await searchIndexingService.refreshIndices();
}
