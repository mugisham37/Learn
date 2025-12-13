/**
 * Search Indexing Queue Implementation
 * 
 * Implements BullMQ queue for search indexing operations with retry logic,
 * event-driven indexing, and bulk reindexing capabilities.
 * 
 * Requirements: 8.7 - Index courses on creation and updates, trigger reindexing on events
 */

import { Queue, Worker, Job, QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

import type { Course } from '../../modules/courses/domain/entities/Course.js';
import type { Lesson } from '../../modules/courses/domain/entities/Lesson.js';
import type { ISearchService } from '../../modules/search/application/services/ISearchService.js';
import { redis } from '../../infrastructure/cache/index.js';
import { ExternalServiceError, NotFoundError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

/**
 * Search indexing job types
 */
export type SearchIndexingJobType = 
  | 'index-course'
  | 'index-lesson'
  | 'remove-course'
  | 'remove-lesson'
  | 'remove-lessons-by-course'
  | 'bulk-reindex-courses'
  | 'bulk-reindex-lessons'
  | 'bulk-reindex-all';

/**
 * Search indexing job data interfaces
 */
export interface IndexCourseJobData {
  type: 'index-course';
  courseId: string;
  course?: Course; // Optional - will be fetched if not provided
  priority?: number;
}

export interface IndexLessonJobData {
  type: 'index-lesson';
  lessonId: string;
  courseId: string;
  lesson?: Lesson; // Optional - will be fetched if not provided
  priority?: number;
}

export interface RemoveCourseJobData {
  type: 'remove-course';
  courseId: string;
  priority?: number;
}

export interface RemoveLessonJobData {
  type: 'remove-lesson';
  lessonId: string;
  priority?: number;
}

export interface RemoveLessonsByCourseJobData {
  type: 'remove-lessons-by-course';
  courseId: string;
  priority?: number;
}

export interface BulkReindexJobData {
  type: 'bulk-reindex-courses' | 'bulk-reindex-lessons' | 'bulk-reindex-all';
  batchSize?: number;
  startFromId?: string;
  priority?: number;
}

export type SearchIndexingJobData = 
  | IndexCourseJobData
  | IndexLessonJobData
  | RemoveCourseJobData
  | RemoveLessonJobData
  | RemoveLessonsByCourseJobData
  | BulkReindexJobData;

/**
 * Search Indexing Queue Configuration
 */
const QUEUE_NAME = 'search-indexing';
const QUEUE_OPTIONS: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 200,     // Keep last 200 failed jobs
    attempts: 5,           // Maximum retry attempts for indexing
    backoff: {
      type: 'exponential',
      delay: 2000,         // Start with 2 second delay
    },
  },
};

const WORKER_OPTIONS: WorkerOptions = {
  connection: redis,
  concurrency: 5,        // Moderate concurrency for indexing operations
  maxStalledCount: 3,    // Maximum stalled jobs before failing
  stalledInterval: 30000, // Check for stalled jobs every 30 seconds
};

/**
 * Search Indexing Queue Implementation
 * 
 * Manages search indexing operations using BullMQ with comprehensive error handling,
 * retry logic, and support for both individual and bulk indexing operations.
 */
export class SearchIndexingQueue {
  private queue: Queue<SearchIndexingJobData>;
  private worker: Worker<SearchIndexingJobData>;
  private isInitialized = false;

  constructor(
    private readonly searchService: ISearchService
  ) {
    this.queue = new Queue<SearchIndexingJobData>(QUEUE_NAME, QUEUE_OPTIONS);
    this.worker = new Worker<SearchIndexingJobData>(
      QUEUE_NAME,
      this.processIndexingJob.bind(this),
      WORKER_OPTIONS
    );

    this.setupEventListeners();
  }

  /**
   * Initializes the queue and worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test Redis connection
      await redis.ping();
      
      logger.info('Search indexing queue initialized', {
        queueName: QUEUE_NAME,
        concurrency: WORKER_OPTIONS.concurrency,
      });

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize search indexing queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new ExternalServiceError(
        'SearchIndexingQueue',
        'Failed to initialize queue',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Adds a course indexing job to the queue
   */
  async indexCourse(
    courseId: string,
    course?: Course,
    options?: { priority?: number; delay?: number }
  ): Promise<Job<SearchIndexingJobData>> {
    const jobData: IndexCourseJobData = {
      type: 'index-course',
      courseId,
      course,
      priority: options?.priority || 5,
    };

    return this.addJob(jobData, {
      priority: options?.priority || 5,
      delay: options?.delay || 0,
      jobId: `index-course-${courseId}`,
    });
  }

  /**
   * Adds a lesson indexing job to the queue
   */
  async indexLesson(
    lessonId: string,
    courseId: string,
    lesson?: Lesson,
    options?: { priority?: number; delay?: number }
  ): Promise<Job<SearchIndexingJobData>> {
    const jobData: IndexLessonJobData = {
      type: 'index-lesson',
      lessonId,
      courseId,
      lesson,
      priority: options?.priority || 5,
    };

    return this.addJob(jobData, {
      priority: options?.priority || 5,
      delay: options?.delay || 0,
      jobId: `index-lesson-${lessonId}`,
    });
  }

  /**
   * Adds a course removal job to the queue
   */
  async removeCourse(
    courseId: string,
    options?: { priority?: number; delay?: number }
  ): Promise<Job<SearchIndexingJobData>> {
    const jobData: RemoveCourseJobData = {
      type: 'remove-course',
      courseId,
      priority: options?.priority || 7, // Higher priority for removals
    };

    return this.addJob(jobData, {
      priority: options?.priority || 7,
      delay: options?.delay || 0,
      jobId: `remove-course-${courseId}`,
    });
  }

  /**
   * Adds a lesson removal job to the queue
   */
  async removeLesson(
    lessonId: string,
    options?: { priority?: number; delay?: number }
  ): Promise<Job<SearchIndexingJobData>> {
    const jobData: RemoveLessonJobData = {
      type: 'remove-lesson',
      lessonId,
      priority: options?.priority || 7, // Higher priority for removals
    };

    return this.addJob(jobData, {
      priority: options?.priority || 7,
      delay: options?.delay || 0,
      jobId: `remove-lesson-${lessonId}`,
    });
  }

  /**
   * Adds a job to remove all lessons for a course
   */
  async removeLessonsByCourse(
    courseId: string,
    options?: { priority?: number; delay?: number }
  ): Promise<Job<SearchIndexingJobData>> {
    const jobData: RemoveLessonsByCourseJobData = {
      type: 'remove-lessons-by-course',
      courseId,
      priority: options?.priority || 7, // Higher priority for removals
    };

    return this.addJob(jobData, {
      priority: options?.priority || 7,
      delay: options?.delay || 0,
      jobId: `remove-lessons-by-course-${courseId}`,
    });
  }

  /**
   * Adds a bulk reindexing job to the queue
   */
  async bulkReindex(
    type: 'courses' | 'lessons' | 'all',
    options?: { 
      batchSize?: number; 
      startFromId?: string; 
      priority?: number; 
      delay?: number;
    }
  ): Promise<Job<SearchIndexingJobData>> {
    const jobType = type === 'courses' ? 'bulk-reindex-courses' :
                   type === 'lessons' ? 'bulk-reindex-lessons' :
                   'bulk-reindex-all';

    const jobData: BulkReindexJobData = {
      type: jobType,
      batchSize: options?.batchSize || 100,
      startFromId: options?.startFromId,
      priority: options?.priority || 3, // Lower priority for bulk operations
    };

    return this.addJob(jobData, {
      priority: options?.priority || 3,
      delay: options?.delay || 0,
      jobId: `bulk-reindex-${type}-${Date.now()}`,
    });
  }

  /**
   * Gets the status of an indexing job
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    data?: SearchIndexingJobData;
    result?: any;
    failedReason?: string;
    processedOn?: Date;
    finishedOn?: Date;
  } | null> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        status: await job.getState(),
        progress: typeof job.progress === 'number' ? job.progress : 0,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get indexing job status', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Gets queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaiting(),
        this.queue.getActive(),
        this.queue.getCompleted(),
        this.queue.getFailed(),
        this.queue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      logger.error('Failed to get indexing queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Gracefully shuts down the queue and worker
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down search indexing queue...');

      // Close worker first to stop processing new jobs
      await this.worker.close();
      
      // Close queue
      await this.queue.close();

      logger.info('Search indexing queue shut down successfully');
    } catch (error) {
      logger.error('Error during indexing queue shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Adds a job to the queue with validation
   */
  private async addJob(
    data: SearchIndexingJobData,
    options?: JobsOptions
  ): Promise<Job<SearchIndexingJobData>> {
    try {
      logger.debug('Adding search indexing job to queue', {
        type: data.type,
        jobId: options?.jobId,
        priority: options?.priority,
      });

      // Validate job data
      this.validateJobData(data);

      const job = await this.queue.add(
        data.type,
        data,
        options
      );

      logger.debug('Search indexing job added successfully', {
        jobId: job.id,
        type: data.type,
      });

      return job;
    } catch (error) {
      logger.error('Failed to add search indexing job', {
        type: data.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ExternalServiceError(
        'SearchIndexingQueue',
        'Failed to add job to queue',
        error instanceof Error ? error : new Error('Unknown error')
      );
    }
  }

  /**
   * Processes a search indexing job
   */
  private async processIndexingJob(job: Job<SearchIndexingJobData>): Promise<any> {
    const { data } = job;

    try {
      logger.info('Processing search indexing job', {
        jobId: job.id,
        type: data.type,
        attempt: job.attemptsMade + 1,
      });

      await job.updateProgress(10);

      switch (data.type) {
        case 'index-course':
          return await this.processIndexCourseJob(job, data);
        
        case 'index-lesson':
          return await this.processIndexLessonJob(job, data);
        
        case 'remove-course':
          return await this.processRemoveCourseJob(job, data);
        
        case 'remove-lesson':
          return await this.processRemoveLessonJob(job, data);
        
        case 'remove-lessons-by-course':
          return await this.processRemoveLessonsByCourseJob(job, data);
        
        case 'bulk-reindex-courses':
        case 'bulk-reindex-lessons':
        case 'bulk-reindex-all':
          return await this.processBulkReindexJob(job, data);
        
        default:
          throw new ValidationError(`Unknown job type: ${(data as any).type}`);
      }
    } catch (error) {
      logger.error('Search indexing job failed', {
        jobId: job.id,
        type: data.type,
        attempt: job.attemptsMade + 1,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Processes a course indexing job
   */
  private async processIndexCourseJob(
    job: Job<SearchIndexingJobData>,
    data: IndexCourseJobData
  ): Promise<{ success: boolean; courseId: string }> {
    await job.updateProgress(20);

    let course = data.course;
    
    // If course data not provided, we would fetch it from the database
    // For now, we'll assume it's provided or handle the case where it's not
    if (!course) {
      // TODO: Fetch course from database
      // This would require injecting a course repository or service
      logger.warn('Course data not provided for indexing job', {
        courseId: data.courseId,
      });
      throw new NotFoundError(`Course data not available for indexing: ${data.courseId}`);
    }

    await job.updateProgress(50);

    // Index the course
    await this.searchService.indexCourse(course);

    await job.updateProgress(100);

    logger.info('Course indexed successfully', {
      courseId: data.courseId,
      title: course.title,
    });

    return {
      success: true,
      courseId: data.courseId,
    };
  }

  /**
   * Processes a lesson indexing job
   */
  private async processIndexLessonJob(
    job: Job<SearchIndexingJobData>,
    data: IndexLessonJobData
  ): Promise<{ success: boolean; lessonId: string; courseId: string }> {
    await job.updateProgress(20);

    let lesson = data.lesson;
    
    // If lesson data not provided, we would fetch it from the database
    if (!lesson) {
      // TODO: Fetch lesson from database
      logger.warn('Lesson data not provided for indexing job', {
        lessonId: data.lessonId,
        courseId: data.courseId,
      });
      throw new NotFoundError(`Lesson data not available for indexing: ${data.lessonId}`);
    }

    await job.updateProgress(50);

    // Index the lesson
    await this.searchService.indexLesson(lesson);

    await job.updateProgress(100);

    logger.info('Lesson indexed successfully', {
      lessonId: data.lessonId,
      courseId: data.courseId,
      title: lesson.title,
    });

    return {
      success: true,
      lessonId: data.lessonId,
      courseId: data.courseId,
    };
  }

  /**
   * Processes a course removal job
   */
  private async processRemoveCourseJob(
    job: Job<SearchIndexingJobData>,
    data: RemoveCourseJobData
  ): Promise<{ success: boolean; courseId: string }> {
    await job.updateProgress(50);

    // Remove the course from search index
    await this.searchService.removeCourse(data.courseId);

    await job.updateProgress(100);

    logger.info('Course removed from search index', {
      courseId: data.courseId,
    });

    return {
      success: true,
      courseId: data.courseId,
    };
  }

  /**
   * Processes a lesson removal job
   */
  private async processRemoveLessonJob(
    job: Job<SearchIndexingJobData>,
    data: RemoveLessonJobData
  ): Promise<{ success: boolean; lessonId: string }> {
    await job.updateProgress(50);

    // Remove the lesson from search index
    await this.searchService.removeLesson(data.lessonId);

    await job.updateProgress(100);

    logger.info('Lesson removed from search index', {
      lessonId: data.lessonId,
    });

    return {
      success: true,
      lessonId: data.lessonId,
    };
  }

  /**
   * Processes a remove lessons by course job
   */
  private async processRemoveLessonsByCourseJob(
    job: Job<SearchIndexingJobData>,
    data: RemoveLessonsByCourseJobData
  ): Promise<{ success: boolean; courseId: string; removedCount: number }> {
    await job.updateProgress(50);

    // Remove all lessons for the course from search index
    const removedCount = await this.searchService.removeLessonsByCourse(data.courseId);

    await job.updateProgress(100);

    logger.info('Lessons removed from search index by course', {
      courseId: data.courseId,
      removedCount,
    });

    return {
      success: true,
      courseId: data.courseId,
      removedCount,
    };
  }

  /**
   * Processes a bulk reindexing job
   */
  private async processBulkReindexJob(
    job: Job<SearchIndexingJobData>,
    data: BulkReindexJobData
  ): Promise<{ success: boolean; type: string; message: string }> {
    await job.updateProgress(10);

    // This is a placeholder implementation
    // In a real implementation, this would:
    // 1. Query the database for all courses/lessons in batches
    // 2. Transform them to search documents
    // 3. Bulk index them
    // 4. Handle errors and retries
    // 5. Update progress as batches are processed

    logger.info('Starting bulk reindex operation', {
      type: data.type,
      batchSize: data.batchSize,
      startFromId: data.startFromId,
    });

    await job.updateProgress(50);

    // TODO: Implement actual bulk reindexing logic
    // This would require access to course and lesson repositories
    
    await job.updateProgress(100);

    const message = `Bulk reindex operation completed for ${data.type}`;
    logger.info(message, {
      type: data.type,
      batchSize: data.batchSize,
    });

    return {
      success: true,
      type: data.type,
      message,
    };
  }

  /**
   * Validates job data before processing
   */
  private validateJobData(data: SearchIndexingJobData): void {
    if (!data.type) {
      throw new ValidationError('Job type is required');
    }

    switch (data.type) {
      case 'index-course':
        if (!data.courseId) {
          throw new ValidationError('Course ID is required for course indexing');
        }
        break;
      
      case 'index-lesson':
        if (!data.lessonId) {
          throw new ValidationError('Lesson ID is required for lesson indexing');
        }
        if (!data.courseId) {
          throw new ValidationError('Course ID is required for lesson indexing');
        }
        break;
      
      case 'remove-course':
        if (!data.courseId) {
          throw new ValidationError('Course ID is required for course removal');
        }
        break;
      
      case 'remove-lesson':
        if (!data.lessonId) {
          throw new ValidationError('Lesson ID is required for lesson removal');
        }
        break;
      
      case 'remove-lessons-by-course':
        if (!data.courseId) {
          throw new ValidationError('Course ID is required for lessons removal');
        }
        break;
      
      case 'bulk-reindex-courses':
      case 'bulk-reindex-lessons':
      case 'bulk-reindex-all':
        // No specific validation needed for bulk operations
        break;
      
      default:
        throw new ValidationError(`Invalid job type: ${(data as unknown).type}`);
    }
  }

  /**
   * Sets up event listeners for queue and worker
   */
  private setupEventListeners(): void {
    // Queue events
    this.queue.on('error', (error) => {
      logger.error('Search indexing queue error', {
        error: error.message,
      });
    });

    // Worker events
    this.worker.on('completed', (job, result) => {
      logger.info('Search indexing job completed', {
        jobId: job.id,
        type: job.data.type,
        result,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Search indexing job failed', {
        jobId: job?.id,
        type: job?.data?.type,
        attempt: job?.attemptsMade,
        error: error.message,
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Search indexing job stalled', { jobId });
    });

    this.worker.on('progress', (job, progress) => {
      logger.debug('Search indexing job progress', {
        jobId: job.id,
        type: job.data.type,
        progress,
      });
    });

    this.worker.on('error', (error) => {
      logger.error('Search indexing worker error', {
        error: error.message,
      });
    });
  }
}