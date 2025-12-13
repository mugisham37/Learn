/**
 * Search Indexing Event Handlers
 *
 * Event handlers that listen to course and lesson domain events
 * and trigger appropriate search indexing operations.
 *
 * Requirements: 8.7 - Implement event listeners for course/lesson changes
 */

import { logger } from '../../../../shared/utils/logger.js';
import type { SearchIndexingQueue } from '../../../../shared/services/SearchIndexingQueue.js';
import type {
  CourseCreatedEvent,
  CourseUpdatedEvent,
  CoursePublishedEvent,
  CourseArchivedEvent,
  ModuleAddedEvent,
  ModuleRemovedEvent,
  ModulesReorderedEvent,
  LessonAddedEvent,
  LessonRemovedEvent,
  LessonsReorderedEvent,
  CourseEvent,
} from '../../../courses/domain/events/CourseEvents.js';

/**
 * Search Indexing Event Handlers
 *
 * Handles domain events from the courses module and triggers appropriate
 * search indexing operations through the search indexing queue.
 */
export class SearchIndexingEventHandlers {
  constructor(private readonly searchIndexingQueue: SearchIndexingQueue) {}

  /**
   * Handles course created events
   * Indexes the new course for search
   */
  async handleCourseCreated(event: CourseCreatedEvent): Promise<void> {
    try {
      logger.info('Handling course created event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        title: event.title,
      });

      // Add indexing job with normal priority
      await this.searchIndexingQueue.indexCourse(
        event.aggregateId,
        undefined, // Course data will be fetched by the job processor
        { priority: 5 }
      );

      logger.debug('Course indexing job queued successfully', {
        eventId: event.eventId,
        courseId: event.aggregateId,
      });
    } catch (error) {
      logger.error('Failed to handle course created event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Don't throw error to avoid breaking the event processing chain
      // The indexing job will be retried automatically
    }
  }

  /**
   * Handles course updated events
   * Re-indexes the updated course for search
   */
  async handleCourseUpdated(event: CourseUpdatedEvent): Promise<void> {
    try {
      logger.info('Handling course updated event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        changes: event.changes,
      });

      // Check if the changes affect searchable fields
      const searchableFields = [
        'title',
        'description',
        'category',
        'difficulty',
        'price',
        'status',
        'thumbnailUrl',
      ];

      const hasSearchableChanges =
        !event.changes ||
        Object.keys(event.changes).some((field) => searchableFields.includes(field));

      if (hasSearchableChanges) {
        // Add indexing job with higher priority for updates
        await this.searchIndexingQueue.indexCourse(
          event.aggregateId,
          undefined, // Course data will be fetched by the job processor
          { priority: 6 }
        );

        logger.debug('Course re-indexing job queued successfully', {
          eventId: event.eventId,
          courseId: event.aggregateId,
        });
      } else {
        logger.debug('Course update does not affect searchable fields, skipping indexing', {
          eventId: event.eventId,
          courseId: event.aggregateId,
          changes: event.changes,
        });
      }
    } catch (error) {
      logger.error('Failed to handle course updated event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles course published events
   * Re-indexes the published course with updated status
   */
  async handleCoursePublished(event: CoursePublishedEvent): Promise<void> {
    try {
      logger.info('Handling course published event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        title: event.title,
      });

      // Add indexing job with high priority for published courses
      await this.searchIndexingQueue.indexCourse(event.aggregateId, undefined, { priority: 7 });

      logger.debug('Published course indexing job queued successfully', {
        eventId: event.eventId,
        courseId: event.aggregateId,
      });
    } catch (error) {
      logger.error('Failed to handle course published event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles course archived events
   * Removes the archived course from search index
   */
  async handleCourseArchived(event: CourseArchivedEvent): Promise<void> {
    try {
      logger.info('Handling course archived event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
      });

      // Remove course from search index
      await this.searchIndexingQueue.removeCourse(
        event.aggregateId,
        { priority: 8 } // High priority for removals
      );

      // Also remove all lessons for this course
      await this.searchIndexingQueue.removeLessonsByCourse(event.aggregateId, { priority: 8 });

      logger.debug('Archived course removal jobs queued successfully', {
        eventId: event.eventId,
        courseId: event.aggregateId,
      });
    } catch (error) {
      logger.error('Failed to handle course archived event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles module added events
   * Re-indexes the course to include the new module information
   */
  async handleModuleAdded(event: ModuleAddedEvent): Promise<void> {
    try {
      logger.info('Handling module added event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        moduleId: event.moduleId,
        moduleTitle: event.moduleTitle,
      });

      // Re-index the course to include the new module
      await this.searchIndexingQueue.indexCourse(event.aggregateId, undefined, { priority: 5 });

      logger.debug('Course re-indexing job queued for module addition', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        moduleId: event.moduleId,
      });
    } catch (error) {
      logger.error('Failed to handle module added event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        moduleId: event.moduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles module removed events
   * Re-indexes the course and removes associated lessons
   */
  async handleModuleRemoved(event: ModuleRemovedEvent): Promise<void> {
    try {
      logger.info('Handling module removed event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        moduleId: event.moduleId,
      });

      // Re-index the course to reflect module removal
      await this.searchIndexingQueue.indexCourse(event.aggregateId, undefined, { priority: 6 });

      // Note: Individual lesson removal should be handled by separate lesson events
      // This just updates the course-level information

      logger.debug('Course re-indexing job queued for module removal', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        moduleId: event.moduleId,
      });
    } catch (error) {
      logger.error('Failed to handle module removed event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        moduleId: event.moduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles modules reordered events
   * Re-indexes the course to reflect new module order
   */
  async handleModulesReordered(event: ModulesReorderedEvent): Promise<void> {
    try {
      logger.info('Handling modules reordered event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        moduleCount: event.newOrder.length,
      });

      // Re-index the course to reflect new module order
      await this.searchIndexingQueue.indexCourse(
        event.aggregateId,
        undefined,
        { priority: 4 } // Lower priority for reordering
      );

      logger.debug('Course re-indexing job queued for module reordering', {
        eventId: event.eventId,
        courseId: event.aggregateId,
      });
    } catch (error) {
      logger.error('Failed to handle modules reordered event for search indexing', {
        eventId: event.eventId,
        courseId: event.aggregateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles lesson added events
   * Indexes the new lesson and re-indexes the course
   */
  async handleLessonAdded(event: LessonAddedEvent): Promise<void> {
    try {
      logger.info('Handling lesson added event for search indexing', {
        eventId: event.eventId,
        courseId: event.courseId,
        moduleId: event.aggregateId,
        lessonId: event.lessonId,
        lessonTitle: event.lessonTitle,
        lessonType: event.lessonType,
      });

      // Index the new lesson
      await this.searchIndexingQueue.indexLesson(
        event.lessonId,
        event.courseId,
        undefined, // Lesson data will be fetched by the job processor
        { priority: 5 }
      );

      // Re-index the course to include the new lesson in aggregated content
      await this.searchIndexingQueue.indexCourse(
        event.courseId,
        undefined,
        { priority: 4 } // Lower priority than lesson indexing
      );

      logger.debug('Lesson and course indexing jobs queued for lesson addition', {
        eventId: event.eventId,
        courseId: event.courseId,
        lessonId: event.lessonId,
      });
    } catch (error) {
      logger.error('Failed to handle lesson added event for search indexing', {
        eventId: event.eventId,
        courseId: event.courseId,
        lessonId: event.lessonId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles lesson removed events
   * Removes the lesson from search index and re-indexes the course
   */
  async handleLessonRemoved(event: LessonRemovedEvent): Promise<void> {
    try {
      logger.info('Handling lesson removed event for search indexing', {
        eventId: event.eventId,
        courseId: event.courseId,
        moduleId: event.aggregateId,
        lessonId: event.lessonId,
      });

      // Remove the lesson from search index
      await this.searchIndexingQueue.removeLesson(
        event.lessonId,
        { priority: 7 } // High priority for removals
      );

      // Re-index the course to reflect lesson removal
      await this.searchIndexingQueue.indexCourse(event.courseId, undefined, { priority: 5 });

      logger.debug('Lesson removal and course re-indexing jobs queued', {
        eventId: event.eventId,
        courseId: event.courseId,
        lessonId: event.lessonId,
      });
    } catch (error) {
      logger.error('Failed to handle lesson removed event for search indexing', {
        eventId: event.eventId,
        courseId: event.courseId,
        lessonId: event.lessonId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handles lessons reordered events
   * Re-indexes affected lessons and the course
   */
  async handleLessonsReordered(event: LessonsReorderedEvent): Promise<void> {
    try {
      logger.info('Handling lessons reordered event for search indexing', {
        eventId: event.eventId,
        courseId: event.courseId,
        moduleId: event.aggregateId,
        lessonCount: event.newOrder.length,
      });

      // Re-index all affected lessons to update their order information
      const lessonIndexingPromises = event.newOrder.map(({ lessonId }) =>
        this.searchIndexingQueue.indexLesson(
          lessonId,
          event.courseId,
          undefined,
          { priority: 4 } // Lower priority for reordering
        )
      );

      await Promise.all(lessonIndexingPromises);

      // Re-index the course to reflect new lesson order
      await this.searchIndexingQueue.indexCourse(event.courseId, undefined, { priority: 4 });

      logger.debug('Lesson and course re-indexing jobs queued for lesson reordering', {
        eventId: event.eventId,
        courseId: event.courseId,
        moduleId: event.aggregateId,
        lessonCount: event.newOrder.length,
      });
    } catch (error) {
      logger.error('Failed to handle lessons reordered event for search indexing', {
        eventId: event.eventId,
        courseId: event.courseId,
        moduleId: event.aggregateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generic event handler that routes events to specific handlers
   */
  async handleCourseEvent(event: CourseEvent): Promise<void> {
    try {
      switch (event.eventType) {
        case 'CourseCreated':
          await this.handleCourseCreated(event as CourseCreatedEvent);
          break;

        case 'CourseUpdated':
          await this.handleCourseUpdated(event as CourseUpdatedEvent);
          break;

        case 'CoursePublished':
          await this.handleCoursePublished(event as CoursePublishedEvent);
          break;

        case 'CourseArchived':
          await this.handleCourseArchived(event as CourseArchivedEvent);
          break;

        case 'ModuleAdded':
          await this.handleModuleAdded(event as ModuleAddedEvent);
          break;

        case 'ModuleRemoved':
          await this.handleModuleRemoved(event as ModuleRemovedEvent);
          break;

        case 'ModulesReordered':
          await this.handleModulesReordered(event as ModulesReorderedEvent);
          break;

        case 'LessonAdded':
          await this.handleLessonAdded(event as LessonAddedEvent);
          break;

        case 'LessonRemoved':
          await this.handleLessonRemoved(event as LessonRemovedEvent);
          break;

        case 'LessonsReordered':
          await this.handleLessonsReordered(event as LessonsReorderedEvent);
          break;

        default:
          logger.warn('Unknown course event type for search indexing', {
            eventType: (event as any).eventType,
            eventId: (event as any).eventId,
          });
      }
    } catch (error) {
      logger.error('Failed to handle course event for search indexing', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
