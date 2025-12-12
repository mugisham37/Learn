/**
 * Queue Configuration
 * 
 * Centralized configuration for all BullMQ queues with predefined
 * settings for different job types based on requirements.
 */

import { QueueConfigurations } from './types.js';

/**
 * Predefined queue configurations based on requirements:
 * - Video processing: Low concurrency (2), 3 retries
 * - Email sending: High concurrency (10), 5 retries  
 * - Certificate generation: Moderate concurrency (5), 3 retries
 * - Analytics aggregation: Batch processing, 3 retries
 * - Search indexing: Moderate concurrency (3), 5 retries
 */
export const QUEUE_CONFIGURATIONS: QueueConfigurations = {
  videoProcessing: {
    name: 'video-processing',
    concurrency: 2,
    maxRetries: 3,
    backoffDelay: 5000,
    removeOnComplete: 50,
    removeOnFail: 100,
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
  
  emailSending: {
    name: 'email-sending',
    concurrency: 10,
    maxRetries: 5,
    backoffDelay: 2000,
    removeOnComplete: 100,
    removeOnFail: 200,
    stalledInterval: 15000,
    maxStalledCount: 2,
  },
  
  certificateGeneration: {
    name: 'certificate-generation',
    concurrency: 5,
    maxRetries: 3,
    backoffDelay: 3000,
    removeOnComplete: 100,
    removeOnFail: 150,
    stalledInterval: 20000,
    maxStalledCount: 1,
  },
  
  analyticsAggregation: {
    name: 'analytics-aggregation',
    concurrency: 3,
    maxRetries: 3,
    backoffDelay: 10000,
    removeOnComplete: 50,
    removeOnFail: 100,
    stalledInterval: 60000,
    maxStalledCount: 1,
  },
  
  searchIndexing: {
    name: 'search-indexing',
    concurrency: 3,
    maxRetries: 5,
    backoffDelay: 2000,
    removeOnComplete: 200,
    removeOnFail: 300,
    stalledInterval: 20000,
    maxStalledCount: 2,
  },
};

/**
 * Default queue options applied to all queues
 */
export const DEFAULT_QUEUE_OPTIONS = {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
  },
};

/**
 * Default worker options applied to all workers
 */
export const DEFAULT_WORKER_OPTIONS = {
  maxStalledCount: 1,
  stalledInterval: 30000,
};