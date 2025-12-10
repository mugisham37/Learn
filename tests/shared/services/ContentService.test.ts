/**
 * Content Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentService } from '../../../src/shared/services/ContentService.js';
import { IS3Service } from '../../../src/shared/services/IS3Service.js';
import { ICloudFrontService } from '../../../src/shared/services/ICloudFrontService.js';
import { ExternalServiceError } from '../../../src/shared/errors/index.js';

// Mock logger
vi.mock('../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('ContentService', () => {
  let contentService: ContentService;
  let mockS3Service: IS3Service;
  let mockCloudFrontService: ICloudFrontService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockS3Service = {
      uploadFile: vi.fn(),
      deleteFile: vi.fn(),
      generatePresignedUrl: vi.fn(),
      fileExists: vi.fn(),
      getPublicUrl: vi.fn(),
    };

    mockCloudFrontService = {
      generateSignedUrl: vi.fn(),
      getCloudFrontUrl: vi.fn(),
      isConfigured: vi.fn(),
    };

    contentService = new ContentService(mockS3Service, mockCloudFrontService);
  });

  describe('generateUploadUrl', () => {
    it('should generate upload URL successfully for public content', async () => {
      const mockPresignedUrl = 'https://bucket.s3.amazonaws.com/upload-url';
      const mockPublicUrl = 'https://cdn.example.com/content.jpg';

      vi.mocked(mockS3Service.generatePresignedUrl).mockResolvedValue(mockPresignedUrl);
      vi.mocked(mockCloudFrontService.isConfigured).mockReturnValue(true);
      vi.mocked(mockCloudFrontService.getCloudFrontUrl).mockReturnValue(mockPublicUrl);

      const params = {
        userId: 'user123',
        fileName: 'test-image.jpg',
        fileType: 'images',
        contentType: 'image/jpeg',
        isPrivate: false,
      };

      const result = await contentService.generateUploadUrl(params);

      expect(result.key).toMatch(/^images\/user123\/\d{4}\/\d{2}\/[a-f0-9-]+\d+-test-image\.jpg$/);
      expect(result.uploadUrl).toBe(mockPresignedUrl);
      expect(result.publicUrl).toBe(mockPublicUrl);
      expect(result.expiresAt).toBeInstanceOf(Date);

      expect(mockS3Service.generatePresignedUrl).toHaveBeenCalledWith({
        key: expect.any(String),
        expiresIn: 3600,
        contentType: 'image/jpeg',
      });
    });

    it('should generate upload URL successfully for private content', async () => {
      const mockPresignedUrl = 'https://bucket.s3.amazonaws.com/upload-url';

      vi.mocked(mockS3Service.generatePresignedUrl).mockResolvedValue(mockPresignedUrl);

      const params = {
        userId: 'user123',
        fileName: 'private-document.pdf',
        fileType: 'documents',
        contentType: 'application/pdf',
        isPrivate: true,
      };

      const result = await contentService.generateUploadUrl(params);

      expect(result.key).toMatch(/^documents\/user123\/\d{4}\/\d{2}\/[a-f0-9-]+\d+-private-document\.pdf$/);
      expect(result.uploadUrl).toBe(mockPresignedUrl);
      expect(result.expiresAt).toBeInstanceOf(Date);

      expect(result.publicUrl).toBeUndefined();
    });

    it('should throw ExternalServiceError when S3 operation fails', async () => {
      vi.mocked(mockS3Service.generatePresignedUrl).mockRejectedValue(
        new ExternalServiceError('AWS S3', 'Failed to generate presigned URL', new Error('S3 error'))
      );

      const params = {
        userId: 'user123',
        fileName: 'test.jpg',
        fileType: 'images',
        contentType: 'image/jpeg',
      };

      await expect(contentService.generateUploadUrl(params)).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('generateStreamingUrl', () => {
    it('should generate CloudFront signed URL when configured', async () => {
      const mockCloudFrontUrl = 'https://cdn.example.com/video.mp4';
      const mockSignedUrl = 'https://cdn.example.com/video.mp4?signature=abc123';

      vi.mocked(mockCloudFrontService.isConfigured).mockReturnValue(true);
      vi.mocked(mockCloudFrontService.getCloudFrontUrl).mockReturnValue(mockCloudFrontUrl);
      vi.mocked(mockCloudFrontService.generateSignedUrl).mockResolvedValue(mockSignedUrl);

      const params = {
        s3Key: 'videos/user123/video.mp4',
        userId: 'user123',
        expiresIn: 7200,
        ipAddress: '192.168.1.1',
      };

      const result = await contentService.generateStreamingUrl(params);

      expect(result).toEqual({
        url: mockSignedUrl,
        expiresAt: expect.any(Date),
      });

      expect(mockCloudFrontService.generateSignedUrl).toHaveBeenCalledWith({
        url: mockCloudFrontUrl,
        expiresIn: 7200,
        ipAddress: '192.168.1.1',
      });
    });

    it('should fallback to S3 presigned URL when CloudFront not configured', async () => {
      const mockPresignedUrl = 'https://bucket.s3.amazonaws.com/video.mp4?signature=xyz789';

      vi.mocked(mockCloudFrontService.isConfigured).mockReturnValue(false);
      vi.mocked(mockS3Service.generatePresignedUrl).mockResolvedValue(mockPresignedUrl);

      const params = {
        s3Key: 'videos/user123/video.mp4',
        userId: 'user123',
      };

      const result = await contentService.generateStreamingUrl(params);

      expect(result).toEqual({
        url: mockPresignedUrl,
        expiresAt: expect.any(Date),
      });

      expect(mockS3Service.generatePresignedUrl).toHaveBeenCalledWith({
        key: 'videos/user123/video.mp4',
        expiresIn: 3600, // default
      });
    });

    it('should throw ExternalServiceError when CloudFront operation fails', async () => {
      vi.mocked(mockCloudFrontService.isConfigured).mockReturnValue(true);
      vi.mocked(mockCloudFrontService.getCloudFrontUrl).mockReturnValue('https://cdn.example.com/video.mp4');
      vi.mocked(mockCloudFrontService.generateSignedUrl).mockRejectedValue(
        new ExternalServiceError('AWS CloudFront', 'Failed to generate signed URL', new Error('CloudFront error'))
      );

      const params = {
        s3Key: 'videos/user123/video.mp4',
        userId: 'user123',
      };

      await expect(contentService.generateStreamingUrl(params)).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('getPublicUrl', () => {
    it('should return CloudFront URL when configured and requested', () => {
      const mockCloudFrontUrl = 'https://cdn.example.com/image.jpg';

      vi.mocked(mockCloudFrontService.isConfigured).mockReturnValue(true);
      vi.mocked(mockCloudFrontService.getCloudFrontUrl).mockReturnValue(mockCloudFrontUrl);

      const result = contentService.getPublicUrl('images/user123/image.jpg', true);

      expect(result).toBe(mockCloudFrontUrl);
    });

    it('should return S3 URL when CloudFront not configured', () => {
      const mockS3Url = 'https://bucket.s3.amazonaws.com/image.jpg';

      vi.mocked(mockCloudFrontService.isConfigured).mockReturnValue(false);
      vi.mocked(mockS3Service.getPublicUrl).mockReturnValue(mockS3Url);

      const result = contentService.getPublicUrl('images/user123/image.jpg', true);

      expect(result).toBe(mockS3Url);
    });

    it('should return S3 URL when CloudFront not requested', () => {
      const mockS3Url = 'https://bucket.s3.amazonaws.com/image.jpg';

      vi.mocked(mockS3Service.getPublicUrl).mockReturnValue(mockS3Url);

      const result = contentService.getPublicUrl('images/user123/image.jpg', false);

      expect(result).toBe(mockS3Url);
    });
  });

  describe('deleteContent', () => {
    it('should delete content successfully', async () => {
      vi.mocked(mockS3Service.deleteFile).mockResolvedValue();

      const params = {
        s3Key: 'images/user123/image.jpg',
        userId: 'user123',
      };

      await contentService.deleteContent(params);

      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('images/user123/image.jpg');
    });

    it('should throw ExternalServiceError when S3 deletion fails', async () => {
      vi.mocked(mockS3Service.deleteFile).mockRejectedValue(
        new ExternalServiceError('AWS S3', 'Failed to delete file', new Error('S3 error'))
      );

      const params = {
        s3Key: 'images/user123/image.jpg',
        userId: 'user123',
      };

      await expect(contentService.deleteContent(params)).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('contentExists', () => {
    it('should return true when content exists', async () => {
      vi.mocked(mockS3Service.fileExists).mockResolvedValue(true);

      const result = await contentService.contentExists('images/user123/image.jpg');

      expect(result).toBe(true);
      expect(mockS3Service.fileExists).toHaveBeenCalledWith('images/user123/image.jpg');
    });

    it('should return false when content does not exist', async () => {
      vi.mocked(mockS3Service.fileExists).mockResolvedValue(false);

      const result = await contentService.contentExists('images/user123/nonexistent.jpg');

      expect(result).toBe(false);
    });

    it('should throw ExternalServiceError when S3 check fails', async () => {
      vi.mocked(mockS3Service.fileExists).mockRejectedValue(
        new ExternalServiceError('AWS S3', 'Failed to check file existence', new Error('S3 error'))
      );

      await expect(contentService.contentExists('images/user123/image.jpg')).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('generateContentKey', () => {
    it('should generate valid S3 key with proper structure', () => {
      const userId = 'user123';
      const fileName = 'My Test File (1).jpg';
      const fileType = 'images';

      const result = contentService.generateContentKey(userId, fileName, fileType);

      // Should match pattern: fileType/userId/year/month/uuid-timestamp-sanitized_filename
      expect(result).toMatch(/^images\/user123\/\d{4}\/\d{2}\/[a-f0-9-]+\d+-my_test_file_1_\.jpg$/);
    });

    it('should sanitize special characters in filename', () => {
      const userId = 'user456';
      const fileName = 'File@#$%^&*()Name!.pdf';
      const fileType = 'documents';

      const result = contentService.generateContentKey(userId, fileName, fileType);

      expect(result).toMatch(/^documents\/user456\/\d{4}\/\d{2}\/[a-f0-9-]+\d+-file_name_\.pdf$/);
    });

    it('should handle files without extensions', () => {
      const userId = 'user789';
      const fileName = 'README';
      const fileType = 'documents';

      const result = contentService.generateContentKey(userId, fileName, fileType);

      expect(result).toMatch(/^documents\/user789\/\d{4}\/\d{2}\/[a-f0-9-]+\d+-readme$/);
    });
  });
});