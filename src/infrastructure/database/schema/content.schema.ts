/**
 * Content Management Schema
 * 
 * Database schema definitions for content management including video assets,
 * file assets, and processing jobs for video transcoding.
 * 
 * Requirements:
 * - 4.1: Video upload and processing with S3 integration
 * - 4.4: Video processing status tracking and completion handling
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  decimal,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';
import { courses, lessons } from './courses.schema.js';

/**
 * Processing Status Enum
 * Tracks the current state of video processing jobs
 */
export const processingStatusEnum = pgEnum('processing_status', [
  'pending',
  'in_progress', 
  'completed',
  'failed',
  'cancelled'
]);

/**
 * Asset Type Enum
 * Defines the different types of content assets
 */
export const assetTypeEnum = pgEnum('asset_type', [
  'video',
  'image',
  'document',
  'audio',
  'archive'
]);

/**
 * Video Assets Table
 * Tracks video files with processing status, resolutions, and HLS manifests
 * 
 * Requirements:
 * - 4.1: Video upload with presigned URLs
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.4: Processing status tracking and completion handling
 */
export const videoAssets = pgTable('video_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id')
    .references(() => lessons.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // File metadata
  originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
  originalFileSize: integer('original_file_size').notNull(), // bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  
  // S3 storage information
  s3Bucket: varchar('s3_bucket', { length: 255 }).notNull(),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  s3Region: varchar('s3_region', { length: 50 }).notNull(),
  
  // Processing information
  processingStatus: processingStatusEnum('processing_status').default('pending').notNull(),
  processingJobId: varchar('processing_job_id', { length: 255 }),
  processingStartedAt: timestamp('processing_started_at'),
  processingCompletedAt: timestamp('processing_completed_at'),
  processingErrorMessage: text('processing_error_message'),
  
  // Video metadata
  durationSeconds: integer('duration_seconds'),
  originalResolution: varchar('original_resolution', { length: 20 }), // e.g., "1920x1080"
  originalBitrate: integer('original_bitrate'), // kbps
  originalFrameRate: decimal('original_frame_rate', { precision: 5, scale: 2 }),
  
  // Processed outputs
  hlsManifestUrl: varchar('hls_manifest_url', { length: 500 }),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  previewUrl: varchar('preview_url', { length: 500 }),
  
  // Available resolutions after processing
  availableResolutions: jsonb('available_resolutions').default([]).notNull(),
  // Example: [{"resolution": "1080p", "url": "...", "bitrate": 5000}, ...]
  
  // CDN and streaming
  cloudfrontDistribution: varchar('cloudfront_distribution', { length: 255 }),
  streamingUrls: jsonb('streaming_urls').default({}).notNull(),
  
  // Metadata
  metadata: jsonb('metadata').default({}).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  lessonIdIdx: index('video_assets_lesson_id_idx').on(table.lessonId),
  uploadedByIdx: index('video_assets_uploaded_by_idx').on(table.uploadedBy),
  processingStatusIdx: index('video_assets_processing_status_idx').on(table.processingStatus),
  s3KeyIdx: uniqueIndex('video_assets_s3_key_idx').on(table.s3Bucket, table.s3Key),
  processingJobIdIdx: index('video_assets_processing_job_id_idx').on(table.processingJobId),
}));

/**
 * File Assets Table
 * Tracks generic file uploads with metadata, S3 location, and access control
 * 
 * Requirements:
 * - 4.1: File upload with validation and S3 storage
 * - 7.2: Assignment file submissions with type and size validation
 */
export const fileAssets = pgTable('file_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  courseId: uuid('course_id')
    .references(() => courses.id, { onDelete: 'cascade' }),
  lessonId: uuid('lesson_id')
    .references(() => lessons.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // File metadata
  fileName: varchar('file_name', { length: 255 }).notNull(),
  originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(), // bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  assetType: assetTypeEnum('asset_type').notNull(),
  
  // S3 storage information
  s3Bucket: varchar('s3_bucket', { length: 255 }).notNull(),
  s3Key: varchar('s3_key', { length: 500 }).notNull(),
  s3Region: varchar('s3_region', { length: 50 }).notNull(),
  
  // Access control
  isPublic: boolean('is_public').default(false).notNull(),
  accessLevel: varchar('access_level', { length: 50 }).default('course').notNull(),
  // Values: 'public', 'course', 'lesson', 'private'
  
  // CDN information
  cloudfrontUrl: varchar('cloudfront_url', { length: 500 }),
  
  // File processing (for images, documents, etc.)
  processingStatus: processingStatusEnum('processing_status').default('completed').notNull(),
  processingErrorMessage: text('processing_error_message'),
  
  // Processed variants (thumbnails, compressed versions, etc.)
  variants: jsonb('variants').default({}).notNull(),
  // Example: {"thumbnail": "url", "compressed": "url", "preview": "url"}
  
  // Metadata
  description: text('description'),
  tags: jsonb('tags').default([]).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  
  // Expiration and cleanup
  expiresAt: timestamp('expires_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  courseIdIdx: index('file_assets_course_id_idx').on(table.courseId),
  lessonIdIdx: index('file_assets_lesson_id_idx').on(table.lessonId),
  uploadedByIdx: index('file_assets_uploaded_by_idx').on(table.uploadedBy),
  assetTypeIdx: index('file_assets_asset_type_idx').on(table.assetType),
  s3KeyIdx: uniqueIndex('file_assets_s3_key_idx').on(table.s3Bucket, table.s3Key),
  accessLevelIdx: index('file_assets_access_level_idx').on(table.accessLevel),
  expiresAtIdx: index('file_assets_expires_at_idx').on(table.expiresAt),
}));

/**
 * Processing Jobs Table
 * Tracks asynchronous processing jobs for video transcoding and file processing
 * 
 * Requirements:
 * - 4.2: MediaConvert job tracking
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 */
export const processingJobs = pgTable('processing_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  videoAssetId: uuid('video_asset_id')
    .references(() => videoAssets.id, { onDelete: 'cascade' }),
  fileAssetId: uuid('file_asset_id')
    .references(() => fileAssets.id, { onDelete: 'cascade' }),
  
  // Job identification
  jobType: varchar('job_type', { length: 50 }).notNull(),
  // Values: 'video_transcode', 'image_process', 'document_convert', etc.
  
  // External service job tracking
  externalJobId: varchar('external_job_id', { length: 255 }),
  externalServiceName: varchar('external_service_name', { length: 100 }),
  // Values: 'mediaconvert', 'lambda', 'custom', etc.
  
  // Job configuration
  jobConfiguration: jsonb('job_configuration').notNull(),
  // Stores service-specific configuration (MediaConvert settings, etc.)
  
  // Status tracking
  status: processingStatusEnum('status').default('pending').notNull(),
  progress: integer('progress').default(0).notNull(), // 0-100
  
  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  // Results and errors
  result: jsonb('result'),
  errorMessage: text('error_message'),
  errorCode: varchar('error_code', { length: 100 }),
  
  // Retry logic
  attemptCount: integer('attempt_count').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(3).notNull(),
  nextRetryAt: timestamp('next_retry_at'),
  
  // Priority and scheduling
  priority: integer('priority').default(5).notNull(), // 1-10, higher = more priority
  scheduledFor: timestamp('scheduled_for'),
  
  // Metadata
  metadata: jsonb('metadata').default({}).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  videoAssetIdIdx: index('processing_jobs_video_asset_id_idx').on(table.videoAssetId),
  fileAssetIdIdx: index('processing_jobs_file_asset_id_idx').on(table.fileAssetId),
  statusIdx: index('processing_jobs_status_idx').on(table.status),
  jobTypeIdx: index('processing_jobs_job_type_idx').on(table.jobType),
  externalJobIdIdx: index('processing_jobs_external_job_id_idx').on(table.externalJobId),
  priorityIdx: index('processing_jobs_priority_idx').on(table.priority),
  scheduledForIdx: index('processing_jobs_scheduled_for_idx').on(table.scheduledFor),
  nextRetryAtIdx: index('processing_jobs_next_retry_at_idx').on(table.nextRetryAt),
}));

// Type exports for use in repositories and services
export type VideoAsset = typeof videoAssets.$inferSelect;
export type NewVideoAsset = typeof videoAssets.$inferInsert;
export type FileAsset = typeof fileAssets.$inferSelect;
export type NewFileAsset = typeof fileAssets.$inferInsert;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type NewProcessingJob = typeof processingJobs.$inferInsert;

// Processing status type
export type ProcessingStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type AssetType = 'video' | 'image' | 'document' | 'audio' | 'archive';