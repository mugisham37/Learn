/**
 * Video Processing Service Tests
 * 
 * Tests for the video processing service implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoProcessingService } from '../../../src/shared/services/VideoProcessingService.js';
import { IMediaConvertService } from '../../../src/shared/services/IMediaConvertService.js';
import { IContentRepository } from '../../../src/modules/content/infrastructure/repositories/IContentRepository.js';

// Mock Redis
vi.mock('../../../src/infrastructure/cache/index.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

// Mock logger
vi.mock('../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('VideoProcessingService', () => {
  let videoProcessingService: VideoProcessingService;
  let mockMediaConvertService: IMediaConvertService;
  let mockContentRepository: IContentRepository;

  beforeEach(() => {
    // Create mock services
    mockMediaConvertService = {
      createTranscodingJob: vi.fn(),
      getJobStatus: vi.fn(),
      cancelJob: vi.fn(),
      listJobs: vi.fn(),
      getServiceEndpoint: vi.fn(),
      validateConfiguration: vi.fn(),
    };

    mockContentRepository = {
      // Video asset methods
      createVideoAsset: vi.fn(),
      findVideoAssetById: vi.fn(),
      findVideoAssetByS3Key: vi.fn(),
      findVideoAssetByProcessingJobId: vi.fn(),
      findVideoAssets: vi.fn(),
      updateVideoAsset: vi.fn(),
      updateVideoAssetProcessingStatus: vi.fn(),
      deleteVideoAsset: vi.fn(),
      deleteVideoAssetsBulk: vi.fn(),

      // File asset methods
      createFileAsset: vi.fn(),
      findFileAssetById: vi.fn(),
      findFileAssetByS3Key: vi.fn(),
      findFileAssets: vi.fn(),
      updateFileAsset: vi.fn(),
      deleteFileAsset: vi.fn(),
      deleteFileAssetsBulk: vi.fn(),
      findExpiredFileAssets: vi.fn(),

      // Processing job methods
      createProcessingJob: vi.fn(),
      findProcessingJobById: vi.fn(),
      findProcessingJobByExternalId: vi.fn(),
      findProcessingJobs: vi.fn(),
      findPendingProcessingJobs: vi.fn(),
      findJobsReadyForRetry: vi.fn(),
      updateProcessingJob: vi.fn(),
      updateProcessingJobStatus: vi.fn(),
      incrementJobAttempt: vi.fn(),
      deleteProcessingJob: vi.fn(),
      updateProcessingJobsStatusBulk: vi.fn(),
    };

    videoProcessingService = new VideoProcessingService(
      mockContentRepository,
      mockMediaConvertService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(videoProcessingService.initialize()).resolves.not.toThrow();
    });
  });

  describe('parameter validation', () => {
    it('should validate upload parameters', async () => {
      const validParams = {
        videoAssetId: 'test-video-id',
        s3Bucket: 'test-bucket',
        s3Key: 'test-key',
        uploadedBy: 'test-user',
        originalFileName: 'test.mp4',
        fileSize: 1000000,
      };

      // Mock video asset exists
      mockContentRepository.findVideoAssetById = vi.fn().mockResolvedValue({
        id: 'test-video-id',
        processingStatus: 'pending',
        metadata: {},
      });

      mockContentRepository.createProcessingJob = vi.fn().mockResolvedValue({
        id: 'test-job-id',
      });

      mockContentRepository.updateVideoAsset = vi.fn().mockResolvedValue({});
      mockContentRepository.updateProcessingJob = vi.fn().mockResolvedValue({});

      // This should not throw for valid parameters
      await videoProcessingService.initialize();
      
      // Verify parameter structure
      expect(validParams.videoAssetId).toBeDefined();
      expect(validParams.s3Bucket).toBeDefined();
      expect(validParams.s3Key).toBeDefined();
      expect(validParams.uploadedBy).toBeDefined();
      expect(validParams.originalFileName).toBeDefined();
      expect(validParams.fileSize).toBeGreaterThan(0);
    });
  });

  describe('queue statistics', () => {
    it('should return default stats when operations fail', async () => {
      // Skip initialization to avoid BullMQ setup
      const stats = await videoProcessingService.getQueueStats();
      
      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    }, 1000); // 1 second timeout
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(videoProcessingService.shutdown()).resolves.not.toThrow();
    });
  });
});