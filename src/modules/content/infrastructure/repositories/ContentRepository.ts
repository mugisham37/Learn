/**
 * Content Repository Implementation
 *
 * Implements content data access operations using Drizzle ORM
 * for video assets, file assets, and processing jobs.
 *
 * Requirements:
 * - 4.1: Video upload and file metadata tracking
 * - 4.4: Video processing status tracking and completion handling
 */

import { eq, and, or, sql, desc, asc, lt, lte, gte, inArray, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  videoAssets,
  fileAssets,
  processingJobs,
  VideoAsset,
  NewVideoAsset,
  FileAsset,
  NewFileAsset,
  ProcessingJob,
  NewProcessingJob,
  ProcessingStatus,
  AssetType,
} from '../../../../infrastructure/database/schema/content.schema.js';
import {
  IContentRepository,
  VideoAssetFilters,
  FileAssetFilters,
  ProcessingJobFilters,
  PaginationOptions,
  PaginatedResult,
} from './IContentRepository.js';

/**
 * Content Repository Implementation
 *
 * Provides concrete implementation of content data access operations
 * using Drizzle ORM with PostgreSQL.
 */
export class ContentRepository implements IContentRepository {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  // Video Asset Operations

  async createVideoAsset(videoAsset: NewVideoAsset): Promise<VideoAsset> {
    const [created] = await this.db
      .insert(videoAssets)
      .values({
        ...videoAsset,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  async findVideoAssetById(id: string): Promise<VideoAsset | null> {
    const [asset] = await this.db.select().from(videoAssets).where(eq(videoAssets.id, id)).limit(1);

    return asset || null;
  }

  async findVideoAssetByS3Key(s3Bucket: string, s3Key: string): Promise<VideoAsset | null> {
    const [asset] = await this.db
      .select()
      .from(videoAssets)
      .where(and(eq(videoAssets.s3Bucket, s3Bucket), eq(videoAssets.s3Key, s3Key)))
      .limit(1);

    return asset || null;
  }

  async findVideoAssetByProcessingJobId(processingJobId: string): Promise<VideoAsset | null> {
    const [asset] = await this.db
      .select()
      .from(videoAssets)
      .where(eq(videoAssets.processingJobId, processingJobId))
      .limit(1);

    return asset || null;
  }

  async findVideoAssets(
    filters?: VideoAssetFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<VideoAsset>> {
    const conditions = [];

    if (filters?.lessonId) {
      conditions.push(eq(videoAssets.lessonId, filters.lessonId));
    }
    if (filters?.uploadedBy) {
      conditions.push(eq(videoAssets.uploadedBy, filters.uploadedBy));
    }
    if (filters?.processingStatus) {
      conditions.push(eq(videoAssets.processingStatus, filters.processingStatus));
    }
    if (filters?.processingJobId) {
      conditions.push(eq(videoAssets.processingJobId, filters.processingJobId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(videoAssets)
      .where(whereClause);

    // Get paginated results
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;
    const orderBy = pagination?.orderBy || 'createdAt';
    const orderDirection = pagination?.orderDirection || 'desc';

    const orderColumn = videoAssets[orderBy as keyof typeof videoAssets] || videoAssets.createdAt;
    const orderFn = orderDirection === 'asc' ? asc : desc;

    const items = await this.db
      .select()
      .from(videoAssets)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    return {
      items,
      total: count,
      limit,
      offset,
      hasMore: offset + limit < count,
    };
  }

  async updateVideoAsset(id: string, updates: Partial<VideoAsset>): Promise<VideoAsset> {
    const [updated] = await this.db
      .update(videoAssets)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(videoAssets.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Video asset with id ${id} not found`);
    }

    return updated;
  }

  async updateVideoAssetProcessingStatus(
    id: string,
    status: ProcessingStatus,
    metadata?: Record<string, any>
  ): Promise<VideoAsset> {
    const updates: Partial<VideoAsset> = {
      processingStatus: status,
      updatedAt: new Date(),
    };

    if (status === 'in_progress' && !metadata?.processingStartedAt) {
      updates.processingStartedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updates.processingCompletedAt = new Date();
    }

    if (metadata) {
      if (metadata.errorMessage) {
        updates.processingErrorMessage = metadata.errorMessage;
      }
      if (metadata.hlsManifestUrl) {
        updates.hlsManifestUrl = metadata.hlsManifestUrl;
      }
      if (metadata.thumbnailUrl) {
        updates.thumbnailUrl = metadata.thumbnailUrl;
      }
      if (metadata.availableResolutions) {
        updates.availableResolutions = metadata.availableResolutions;
      }
      if (metadata.durationSeconds) {
        updates.durationSeconds = metadata.durationSeconds;
      }
      if (metadata.streamingUrls) {
        updates.streamingUrls = metadata.streamingUrls;
      }
    }

    return this.updateVideoAsset(id, updates);
  }

  async deleteVideoAsset(id: string): Promise<void> {
    await this.db.delete(videoAssets).where(eq(videoAssets.id, id));
  }

  // File Asset Operations

  async createFileAsset(fileAsset: NewFileAsset): Promise<FileAsset> {
    const [created] = await this.db
      .insert(fileAssets)
      .values({
        ...fileAsset,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  async findFileAssetById(id: string): Promise<FileAsset | null> {
    const [asset] = await this.db.select().from(fileAssets).where(eq(fileAssets.id, id)).limit(1);

    return asset || null;
  }

  async findFileAssetByS3Key(s3Bucket: string, s3Key: string): Promise<FileAsset | null> {
    const [asset] = await this.db
      .select()
      .from(fileAssets)
      .where(and(eq(fileAssets.s3Bucket, s3Bucket), eq(fileAssets.s3Key, s3Key)))
      .limit(1);

    return asset || null;
  }

  async findFileAssets(
    filters?: FileAssetFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<FileAsset>> {
    const conditions = [];

    if (filters?.courseId) {
      conditions.push(eq(fileAssets.courseId, filters.courseId));
    }
    if (filters?.lessonId) {
      conditions.push(eq(fileAssets.lessonId, filters.lessonId));
    }
    if (filters?.uploadedBy) {
      conditions.push(eq(fileAssets.uploadedBy, filters.uploadedBy));
    }
    if (filters?.assetType) {
      conditions.push(eq(fileAssets.assetType, filters.assetType));
    }
    if (filters?.accessLevel) {
      conditions.push(eq(fileAssets.accessLevel, filters.accessLevel));
    }
    if (filters?.isPublic !== undefined) {
      conditions.push(eq(fileAssets.isPublic, filters.isPublic));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(fileAssets)
      .where(whereClause);

    // Get paginated results
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;
    const orderBy = pagination?.orderBy || 'createdAt';
    const orderDirection = pagination?.orderDirection || 'desc';

    const orderColumn = fileAssets[orderBy as keyof typeof fileAssets] || fileAssets.createdAt;
    const orderFn = orderDirection === 'asc' ? asc : desc;

    const items = await this.db
      .select()
      .from(fileAssets)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    return {
      items,
      total: count,
      limit,
      offset,
      hasMore: offset + limit < count,
    };
  }

  async updateFileAsset(id: string, updates: Partial<FileAsset>): Promise<FileAsset> {
    const [updated] = await this.db
      .update(fileAssets)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(fileAssets.id, id))
      .returning();

    if (!updated) {
      throw new Error(`File asset with id ${id} not found`);
    }

    return updated;
  }

  async deleteFileAsset(id: string): Promise<void> {
    await this.db.delete(fileAssets).where(eq(fileAssets.id, id));
  }

  async findExpiredFileAssets(beforeDate: Date): Promise<FileAsset[]> {
    return await this.db
      .select()
      .from(fileAssets)
      .where(and(lte(fileAssets.expiresAt, beforeDate), isNull(fileAssets.expiresAt) === false));
  }

  // Processing Job Operations

  async createProcessingJob(processingJob: NewProcessingJob): Promise<ProcessingJob> {
    const [created] = await this.db
      .insert(processingJobs)
      .values({
        ...processingJob,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  async findProcessingJobById(id: string): Promise<ProcessingJob | null> {
    const [job] = await this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.id, id))
      .limit(1);

    return job || null;
  }

  async findProcessingJobByExternalId(externalJobId: string): Promise<ProcessingJob | null> {
    const [job] = await this.db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.externalJobId, externalJobId))
      .limit(1);

    return job || null;
  }

  async findProcessingJobs(
    filters?: ProcessingJobFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<ProcessingJob>> {
    const conditions = [];

    if (filters?.videoAssetId) {
      conditions.push(eq(processingJobs.videoAssetId, filters.videoAssetId));
    }
    if (filters?.fileAssetId) {
      conditions.push(eq(processingJobs.fileAssetId, filters.fileAssetId));
    }
    if (filters?.jobType) {
      conditions.push(eq(processingJobs.jobType, filters.jobType));
    }
    if (filters?.status) {
      conditions.push(eq(processingJobs.status, filters.status));
    }
    if (filters?.externalJobId) {
      conditions.push(eq(processingJobs.externalJobId, filters.externalJobId));
    }
    if (filters?.priority) {
      conditions.push(eq(processingJobs.priority, filters.priority));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(processingJobs)
      .where(whereClause);

    // Get paginated results
    const limit = pagination?.limit || 20;
    const offset = pagination?.offset || 0;
    const orderBy = pagination?.orderBy || 'createdAt';
    const orderDirection = pagination?.orderDirection || 'desc';

    const orderColumn =
      processingJobs[orderBy as keyof typeof processingJobs] || processingJobs.createdAt;
    const orderFn = orderDirection === 'asc' ? asc : desc;

    const items = await this.db
      .select()
      .from(processingJobs)
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    return {
      items,
      total: count,
      limit,
      offset,
      hasMore: offset + limit < count,
    };
  }

  async findPendingProcessingJobs(limit = 10): Promise<ProcessingJob[]> {
    return await this.db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.status, 'pending'),
          or(isNull(processingJobs.scheduledFor), lte(processingJobs.scheduledFor, new Date()))
        )
      )
      .orderBy(desc(processingJobs.priority), asc(processingJobs.createdAt))
      .limit(limit);
  }

  async findJobsReadyForRetry(beforeDate: Date, limit = 10): Promise<ProcessingJob[]> {
    return await this.db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.status, 'failed'),
          lt(processingJobs.attemptCount, processingJobs.maxAttempts),
          lte(processingJobs.nextRetryAt, beforeDate)
        )
      )
      .orderBy(desc(processingJobs.priority), asc(processingJobs.nextRetryAt))
      .limit(limit);
  }

  async updateProcessingJob(id: string, updates: Partial<ProcessingJob>): Promise<ProcessingJob> {
    const [updated] = await this.db
      .update(processingJobs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Processing job with id ${id} not found`);
    }

    return updated;
  }

  async updateProcessingJobStatus(
    id: string,
    status: ProcessingStatus,
    progress?: number,
    result?: Record<string, any>,
    errorMessage?: string
  ): Promise<ProcessingJob> {
    const updates: Partial<ProcessingJob> = {
      status,
      updatedAt: new Date(),
    };

    if (progress !== undefined) {
      updates.progress = Math.max(0, Math.min(100, progress));
    }

    if (status === 'in_progress' && !updates.startedAt) {
      updates.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.completedAt = new Date();
      updates.progress = status === 'completed' ? 100 : updates.progress;
    }

    if (result) {
      updates.result = result;
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    return this.updateProcessingJob(id, updates);
  }

  async incrementJobAttempt(id: string, nextRetryAt: Date): Promise<ProcessingJob> {
    const [updated] = await this.db
      .update(processingJobs)
      .set({
        attemptCount: sql`${processingJobs.attemptCount} + 1`,
        nextRetryAt,
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Processing job with id ${id} not found`);
    }

    return updated;
  }

  async deleteProcessingJob(id: string): Promise<void> {
    await this.db.delete(processingJobs).where(eq(processingJobs.id, id));
  }

  // Bulk Operations

  async deleteVideoAssetsBulk(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.db.delete(videoAssets).where(inArray(videoAssets.id, ids));
  }

  async deleteFileAssetsBulk(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.db.delete(fileAssets).where(inArray(fileAssets.id, ids));
  }

  async updateProcessingJobsStatusBulk(ids: string[], status: ProcessingStatus): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await this.db
      .update(processingJobs)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(inArray(processingJobs.id, ids));

    return result.rowCount || 0;
  }
}
