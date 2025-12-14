/**
 * Search Indexing Service
 *
 * Initializes and manages the search indexing system, including
 * event handlers, queue management, and bulk reindexing operations.
 *
 * Requirements: 8.7 - Search indexing strategy implementation
 */

import { eventBus } from '../../../../shared/services/EventBus.js';
import { SearchIndexingQueue } from '../../../../shared/services/SearchIndexingQueue.js';
import { logger } from '../../../../shared/utils/logger.js';
import type { CourseEvent } from '../../../courses/domain/events/CourseEvents.js';
import type { ISearchService } from '../../application/services/ISearchService.js';

import { SearchIndexingEventHandlers } from './SearchIndexingEventHandlers.js';

/**
 * Search Indexing Service Configuration
 */
export interface SearchIndexingServiceConfig {
  enableEventHandlers?: boolean;
  enableBulkReindexing?: boolean;
  bulkReindexBatchSize?: number;
  retryFailedJobs?: boolean;
}

/**
 * Search Indexing Service
 *
 * Coordinates search indexing operations by managing the indexing queue,
 * event handlers, and providing utilities for bulk operations.
 */
export class SearchIndexingService {
  private searchIndexingQueue: SearchIndexingQueue;
  private eventHandlers: SearchIndexingEventHandlers;
  private isInitialized = false;
  private unsubscribeFunctions: Array<() => void> = [];

  constructor(
    private readonly searchService: ISearchService,
    private readonly config: SearchIndexingServiceConfig = {}
  ) {
    // Initialize queue and event handlers
    this.searchIndexingQueue = new SearchIndexingQueue(searchService);
    this.eventHandlers = new SearchIndexingEventHandlers(this.searchIndexingQueue);
  }

  /**
   * Initializes the search indexing service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Search indexing service already initialized');
      return;
    }

    try {
      logger.info('Initializing search indexing service...', {
        config: this.config,
      });

      // Initialize the indexing queue
      await this.searchIndexingQueue.initialize();

      // Set up event handlers if enabled
      if (this.config.enableEventHandlers !== false) {
        this.setupEventHandlers();
      }

      this.isInitialized = true;

      logger.info('Search indexing service initialized successfully', {
        eventHandlersEnabled: this.config.enableEventHandlers !== false,
        bulkReindexingEnabled: this.config.enableBulkReindexing !== false,
      });
    } catch (error) {
      logger.error('Failed to initialize search indexing service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Sets up event handlers for course and lesson events
   */
  private setupEventHandlers(): void {
    try {
      logger.info('Setting up search indexing event handlers...');

      // Subscribe to all course-related events
      const courseEventTypes = [
        'CourseCreated',
        'CourseUpdated',
        'CoursePublished',
        'CourseArchived',
        'ModuleAdded',
        'ModuleRemoved',
        'ModulesReordered',
        'LessonAdded',
        'LessonRemoved',
        'LessonsReordered',
      ];

      // Subscribe to each event type
      courseEventTypes.forEach((eventType) => {
        const unsubscribe = eventBus.subscribe<CourseEvent>(
          eventType,
          this.eventHandlers.handleCourseEvent.bind(this.eventHandlers),
          `SearchIndexing-${eventType}`
        );

        this.unsubscribeFunctions.push(unsubscribe);
      });

      logger.info('Search indexing event handlers set up successfully', {
        subscribedEventTypes: courseEventTypes,
      });
    } catch (error) {
      logger.error('Failed to set up search indexing event handlers', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually triggers indexing for a specific course
   */
  async indexCourse(
    courseId: string,
    options?: { priority?: number; delay?: number }
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    try {
      logger.info('Manually triggering course indexing', {
        courseId,
        options,
      });

      await this.searchIndexingQueue.indexCourse(courseId, undefined, options);

      logger.info('Course indexing job queued successfully', {
        courseId,
      });
    } catch (error) {
      logger.error('Failed to manually trigger course indexing', {
        courseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually triggers indexing for a specific lesson
   */
  async indexLesson(
    lessonId: string,
    courseId: string,
    options?: { priority?: number; delay?: number }
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    try {
      logger.info('Manually triggering lesson indexing', {
        lessonId,
        courseId,
        options,
      });

      await this.searchIndexingQueue.indexLesson(lessonId, courseId, undefined, options);

      logger.info('Lesson indexing job queued successfully', {
        lessonId,
        courseId,
      });
    } catch (error) {
      logger.error('Failed to manually trigger lesson indexing', {
        lessonId,
        courseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually triggers removal of a course from search index
   */
  async removeCourse(
    courseId: string,
    options?: { priority?: number; delay?: number }
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    try {
      logger.info('Manually triggering course removal', {
        courseId,
        options,
      });

      await this.searchIndexingQueue.removeCourse(courseId, options);

      logger.info('Course removal job queued successfully', {
        courseId,
      });
    } catch (error) {
      logger.error('Failed to manually trigger course removal', {
        courseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Manually triggers removal of a lesson from search index
   */
  async removeLesson(
    lessonId: string,
    options?: { priority?: number; delay?: number }
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    try {
      logger.info('Manually triggering lesson removal', {
        lessonId,
        options,
      });

      await this.searchIndexingQueue.removeLesson(lessonId, options);

      logger.info('Lesson removal job queued successfully', {
        lessonId,
      });
    } catch (error) {
      logger.error('Failed to manually trigger lesson removal', {
        lessonId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Triggers bulk reindexing of all courses and/or lessons
   */
  async bulkReindex(
    type: 'courses' | 'lessons' | 'all',
    options?: {
      batchSize?: number;
      startFromId?: string;
      priority?: number;
      delay?: number;
    }
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    if (this.config.enableBulkReindexing === false) {
      throw new Error('Bulk reindexing is disabled in configuration');
    }

    try {
      logger.info('Starting bulk reindexing operation', {
        type,
        options,
      });

      const batchSize = options?.batchSize || this.config.bulkReindexBatchSize || 100;

      await this.searchIndexingQueue.bulkReindex(type, {
        ...options,
        batchSize,
      });

      logger.info('Bulk reindexing job queued successfully', {
        type,
        batchSize,
      });
    } catch (error) {
      logger.error('Failed to start bulk reindexing', {
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Gets statistics about the indexing queue
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    return await this.searchIndexingQueue.getQueueStats();
  }

  /**
   * Gets the status of a specific indexing job
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: unknown;
    result?: unknown;
    failedReason?: string;
    processedOn?: Date;
    finishedOn?: Date;
  } | null> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    return await this.searchIndexingQueue.getJobStatus(jobId);
  }

  /**
   * Gets health information about the search indexing system
   */
  async getHealth(): Promise<{
    healthy: boolean;
    queue: {
      waiting: number;
      active: number;
      failed: number;
    };
    search: {
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
    eventHandlers: {
      enabled: boolean;
      subscribedEvents: number;
    };
  }> {
    try {
      // Get queue stats
      const queueStats = this.isInitialized
        ? await this.searchIndexingQueue.getQueueStats()
        : { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };

      // Get search service health
      const searchHealth = await this.searchService.getSearchHealth();

      // Get event bus stats
      const eventBusStats = eventBus.getStats();

      const healthy = this.isInitialized && searchHealth.healthy && queueStats.failed < 10; // Arbitrary threshold

      return {
        healthy,
        queue: {
          waiting: queueStats.waiting,
          active: queueStats.active,
          failed: queueStats.failed,
        },
        search: searchHealth,
        eventHandlers: {
          enabled: this.config.enableEventHandlers !== false,
          subscribedEvents: eventBusStats.totalHandlers,
        },
      };
    } catch (error) {
      logger.error('Failed to get search indexing health', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        healthy: false,
        queue: { waiting: 0, active: 0, failed: 0 },
        search: {
          healthy: false,
          indices: { courses: false, lessons: false },
        },
        eventHandlers: {
          enabled: false,
          subscribedEvents: 0,
        },
      };
    }
  }

  /**
   * Refreshes search indices to make recent changes searchable
   */
  async refreshIndices(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Search indexing service not initialized');
    }

    try {
      logger.info('Refreshing search indices...');

      await this.searchService.refreshIndices();

      logger.info('Search indices refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh search indices', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Gracefully shuts down the search indexing service
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down search indexing service...');

      // Unsubscribe from all events
      this.unsubscribeFunctions.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          logger.warn('Error unsubscribing from event', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
      this.unsubscribeFunctions = [];

      // Shutdown the indexing queue
      if (this.isInitialized) {
        await this.searchIndexingQueue.shutdown();
      }

      this.isInitialized = false;

      logger.info('Search indexing service shut down successfully');
    } catch (error) {
      logger.error('Error during search indexing service shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
