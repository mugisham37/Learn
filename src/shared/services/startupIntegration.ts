/**
 * Application Startup Integration
 *
 * Provides utilities for integrating various services during application startup,
 * including search indexing, event handling, and background job processing.
 *
 * Requirements: 8.7 - Search indexing strategy integration
 */

import { logger } from '../utils/logger.js';
import { initializeSearchIndexing, shutdownSearchIndexing } from '../../modules/search/index.js';
import { eventBus } from './EventBus.js';
import {
  initializeVideoProcessingQueue,
  shutdownVideoProcessingQueue,
} from './VideoProcessingQueue.js';
import { initializeEmailQueue, shutdownEmailQueue } from './EmailQueue.js';
import {
  initializeCertificateGenerationQueue,
  shutdownCertificateGenerationQueue,
} from './CertificateGenerationQueue.js';
import { MediaConvertService } from './MediaConvertService.js';
import { ContentRepository } from '../../modules/content/infrastructure/repositories/ContentRepository.js';
import { CloudWatchInitializer } from './CloudWatchInitializer.js';

/**
 * Application startup configuration
 */
export interface StartupConfig {
  searchIndexing?: {
    enabled?: boolean;
    enableEventHandlers?: boolean;
    enableBulkReindexing?: boolean;
    bulkReindexBatchSize?: number;
  };
  eventBus?: {
    enabled?: boolean;
  };
  videoProcessing?: {
    enabled?: boolean;
  };
  emailQueue?: {
    enabled?: boolean;
  };
  certificateGeneration?: {
    enabled?: boolean;
  };
  cloudWatch?: {
    enabled?: boolean;
  };
}

/**
 * Initializes all application services during startup
 */
export async function initializeApplicationServices(config: StartupConfig = {}): Promise<void> {
  try {
    logger.info('Initializing application services...', { config });

    // Initialize search indexing if enabled
    if (config.searchIndexing?.enabled !== false) {
      logger.info('Initializing search indexing...');

      await initializeSearchIndexing({
        enableEventHandlers: config.searchIndexing?.enableEventHandlers !== false,
        enableBulkReindexing: config.searchIndexing?.enableBulkReindexing !== false,
        bulkReindexBatchSize: config.searchIndexing?.bulkReindexBatchSize || 100,
        autoInitialize: true,
      });

      logger.info('Search indexing initialized successfully');
    }

    // Initialize video processing queue if enabled
    if (config.videoProcessing?.enabled !== false) {
      logger.info('Initializing video processing queue...');

      // Create service instances
      const mediaConvertService = new MediaConvertService();
      const contentRepository = new ContentRepository();

      await initializeVideoProcessingQueue(mediaConvertService, contentRepository);

      logger.info('Video processing queue initialized successfully');
    }

    // Initialize email queue if enabled
    if (config.emailQueue?.enabled !== false) {
      logger.info('Initializing email queue...');

      await initializeEmailQueue();

      logger.info('Email queue initialized successfully');
    }

    // Initialize certificate generation queue if enabled
    if (config.certificateGeneration?.enabled !== false) {
      logger.info('Initializing certificate generation queue...');

      // Note: In a real application, these dependencies would be injected
      // For now, we'll create placeholder instances or skip initialization
      logger.warn(
        'Certificate generation queue initialization requires dependency injection setup'
      );

      logger.info('Certificate generation queue initialization skipped (requires DI setup)');
    }

    // Initialize CloudWatch if enabled
    if (config.cloudWatch?.enabled !== false) {
      logger.info('Initializing CloudWatch integration...');

      await CloudWatchInitializer.initialize();

      logger.info('CloudWatch integration initialized successfully');
    }

    // Initialize alerting rules
    logger.info('Initializing alerting rules...');

    const { initializeAlertingRules } = await import('./AlertingRulesService.js');
    initializeAlertingRules();

    logger.info('Alerting rules initialized successfully');

    // Initialize monitoring dashboards
    logger.info('Initializing monitoring dashboards...');

    const { initializeMonitoringDashboards } = await import('./MonitoringDashboardService.js');
    await initializeMonitoringDashboards();

    logger.info('Monitoring dashboards initialized successfully');

    // Event bus is already initialized as a singleton
    if (config.eventBus?.enabled !== false) {
      logger.info('Event bus is ready');
    }

    logger.info('All application services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application services', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Shuts down all application services during graceful shutdown
 */
export async function shutdownApplicationServices(): Promise<void> {
  try {
    logger.info('Shutting down application services...');

    // Shutdown search indexing
    await shutdownSearchIndexing();

    // Shutdown video processing queue
    await shutdownVideoProcessingQueue();

    // Shutdown email queue
    await shutdownEmailQueue();

    // Shutdown certificate generation queue
    await shutdownCertificateGenerationQueue();

    // Shutdown event bus
    await eventBus.shutdown();

    logger.info('All application services shut down successfully');
  } catch (error) {
    logger.error('Error during application services shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw during shutdown to allow other cleanup to continue
  }
}

/**
 * Example of how to integrate search indexing into course service operations
 */
export class CourseServiceWithSearchIntegration {
  constructor(
    private readonly courseService: any, // Replace with actual course service type
    private readonly eventBusInstance: typeof eventBus
  ) {}

  /**
   * Creates a course and publishes an event for search indexing
   */
  async createCourse(courseData: any): Promise<any> {
    try {
      // Create the course using the existing service
      const course = await this.courseService.createCourse(courseData);

      // Publish domain event for search indexing
      const { CourseCreatedEvent } =
        await import('../../modules/courses/domain/events/CourseEvents.js');

      const event = new CourseCreatedEvent(course.id, course.instructorId, course.title);

      await this.eventBusInstance.publish(event);

      logger.info('Course created and search indexing event published', {
        courseId: course.id,
        eventId: event.eventId,
      });

      return course;
    } catch (error) {
      logger.error('Failed to create course with search integration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Updates a course and publishes an event for search re-indexing
   */
  async updateCourse(courseId: string, updates: any): Promise<any> {
    try {
      // Update the course using the existing service
      const course = await this.courseService.updateCourse(courseId, updates);

      // Publish domain event for search re-indexing
      const { CourseUpdatedEvent } =
        await import('../../modules/courses/domain/events/CourseEvents.js');

      const event = new CourseUpdatedEvent(course.id, course.instructorId, updates);

      await this.eventBusInstance.publish(event);

      logger.info('Course updated and search re-indexing event published', {
        courseId: course.id,
        eventId: event.eventId,
        changes: updates,
      });

      return course;
    } catch (error) {
      logger.error('Failed to update course with search integration', {
        courseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Publishes a course and publishes an event for search indexing
   */
  async publishCourse(courseId: string): Promise<any> {
    try {
      // Publish the course using the existing service
      const course = await this.courseService.publishCourse(courseId);

      // Publish domain event for search indexing
      const { CoursePublishedEvent } =
        await import('../../modules/courses/domain/events/CourseEvents.js');

      const event = new CoursePublishedEvent(course.id, course.instructorId, course.title);

      await this.eventBusInstance.publish(event);

      logger.info('Course published and search indexing event published', {
        courseId: course.id,
        eventId: event.eventId,
      });

      return course;
    } catch (error) {
      logger.error('Failed to publish course with search integration', {
        courseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Archives a course and publishes an event for search removal
   */
  async archiveCourse(courseId: string): Promise<unknown> {
    try {
      // Archive the course using the existing service
      const course = await this.courseService.archiveCourse(courseId);

      // Publish domain event for search removal
      const { CourseArchivedEvent } =
        await import('../../modules/courses/domain/events/CourseEvents.js');

      const event = new CourseArchivedEvent(course.id, course.instructorId);

      await this.eventBusInstance.publish(event);

      logger.info('Course archived and search removal event published', {
        courseId: course.id,
        eventId: event.eventId,
      });

      return course;
    } catch (error) {
      logger.error('Failed to archive course with search integration', {
        courseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
