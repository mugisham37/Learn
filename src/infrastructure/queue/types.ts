/**
 * Queue Infrastructure Types
 *
 * Type definitions for BullMQ queue infrastructure including
 * queue configurations, job data interfaces, and monitoring types.
 */

import { QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';

/**
 * Queue configuration interface
 */
export interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  backoffDelay: number;
  removeOnComplete: number;
  removeOnFail: number;
  stalledInterval: number;
  maxStalledCount: number;
}

/**
 * Predefined queue configurations for different job types
 */
export interface QueueConfigurations {
  videoProcessing: QueueConfig;
  emailSending: QueueConfig;
  certificateGeneration: QueueConfig;
  analyticsAggregation: QueueConfig;
  searchIndexing: QueueConfig;
}

/**
 * Queue statistics interface
 */
export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Job event data interface
 */
export interface JobEventData {
  jobId: string;
  queueName: string;
  jobData: Record<string, unknown> | null;
  timestamp: Date;
  error?: Error;
  result?: Record<string, unknown>;
}

/**
 * Queue event listener interface
 */
export interface QueueEventListener {
  onJobCompleted?(data: JobEventData): void | Promise<void>;
  onJobFailed?(data: JobEventData): void | Promise<void>;
  onJobStalled?(data: JobEventData): void | Promise<void>;
  onJobProgress?(data: JobEventData & { progress: number }): void | Promise<void>;
}

/**
 * Typed queue interface for type-safe job operations
 */
export interface TypedQueue<T = Record<string, unknown>> {
  add(name: string, data: T, options?: JobsOptions): Promise<void>;
  getStats(): Promise<QueueStats>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  clean(grace: number, status: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Typed worker interface for type-safe job processing
 */
export interface TypedWorker<T = Record<string, unknown>> {
  process(processor: (job: { data: T }) => Promise<unknown>): void;
  close(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

/**
 * Queue factory options
 */
export interface QueueFactoryOptions {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  defaultOptions?: {
    queue?: Partial<QueueOptions>;
    worker?: Partial<WorkerOptions>;
    job?: Partial<JobsOptions>;
  };
}
