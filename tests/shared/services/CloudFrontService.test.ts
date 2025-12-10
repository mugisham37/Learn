/**
 * CloudFront Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudFrontService } from '../../../src/shared/services/CloudFrontService.js';
import { ExternalServiceError } from '../../../src/shared/errors/index.js';

// Mock the AWS CloudFront signer
vi.mock('@aws-sdk/cloudfront-signer', () => ({
  getSignedUrl: vi.fn(),
}));

// Mock fs for private key reading
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock config
vi.mock('../../../src/config/index.js', () => ({
  config: {
    cloudfront: {
      domain: 'd1234567890.cloudfront.net',
      keyPairId: 'APKAI23HVI2C4EXAMPLE',
      privateKeyPath: '/path/to/private-key.pem',
    },
    s3: {
      bucketName: 'test-bucket',
      bucketRegion: 'us-east-1',
    },
  },
}));

// Mock logger
vi.mock('../../../src/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CloudFrontService', () => {
  let cloudFrontService: CloudFrontService;
  let mockGetSignedUrl: any;
  let mockReadFileSync: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { getSignedUrl } = await import('@aws-sdk/cloudfront-signer');
    const { readFileSync } = await import('fs');
    
    mockGetSignedUrl = vi.mocked(getSignedUrl);
    mockReadFileSync = vi.mocked(readFileSync);
    
    // Mock successful private key reading
    mockReadFileSync.mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\nMOCK_PRIVATE_KEY\n-----END RSA PRIVATE KEY-----');
    
    cloudFrontService = new CloudFrontService();
  });

  describe('generateSignedUrl', () => {
    it('should generate signed URL successfully', async () => {
      const mockSignedUrl = 'https://d1234567890.cloudfront.net/video.mp4?Expires=1234567890&Signature=abc123';
      mockGetSignedUrl.mockReturnValue(mockSignedUrl);

      const params = {
        url: 'https://d1234567890.cloudfront.net/video.mp4',
        expiresIn: 3600,
      };

      const result = await cloudFrontService.generateSignedUrl(params);

      expect(result).toBe(mockSignedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith({
        url: params.url,
        keyPairId: 'APKAI23HVI2C4EXAMPLE',
        privateKey: expect.any(String),
        dateLessThan: expect.any(String),
        ipAddress: undefined,
      });
    });

    it('should generate signed URL with IP restriction', async () => {
      const mockSignedUrl = 'https://d1234567890.cloudfront.net/video.mp4?Expires=1234567890&Signature=abc123';
      mockGetSignedUrl.mockReturnValue(mockSignedUrl);

      const params = {
        url: 'https://d1234567890.cloudfront.net/video.mp4',
        expiresIn: 3600,
        ipAddress: '192.168.1.1',
      };

      const result = await cloudFrontService.generateSignedUrl(params);

      expect(result).toBe(mockSignedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledWith({
        url: params.url,
        keyPairId: 'APKAI23HVI2C4EXAMPLE',
        privateKey: expect.any(String),
        dateLessThan: expect.any(String),
        ipAddress: '192.168.1.1',
      });
    });

    it('should throw ExternalServiceError when CloudFront signing fails', async () => {
      mockGetSignedUrl.mockImplementation(() => {
        throw new Error('CloudFront signing failed');
      });

      const params = {
        url: 'https://d1234567890.cloudfront.net/video.mp4',
        expiresIn: 3600,
      };

      await expect(cloudFrontService.generateSignedUrl(params)).rejects.toThrow(ExternalServiceError);
    });

    it('should throw error when CloudFront is not configured', async () => {
      // Mock empty private key to simulate unconfigured service
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => new CloudFrontService()).toThrow('Failed to load CloudFront private key');
    });
  });

  describe('getCloudFrontUrl', () => {
    it('should return CloudFront URL when configured', () => {
      const s3Key = 'videos/user123/2024/01/video.mp4';
      const result = cloudFrontService.getCloudFrontUrl(s3Key);

      expect(result).toBe('https://d1234567890.cloudfront.net/videos/user123/2024/01/video.mp4');
    });
  });

  describe('isConfigured', () => {
    it('should return true when fully configured', () => {
      const result = cloudFrontService.isConfigured();
      expect(result).toBe(true);
    });

    it('should return false when private key is missing', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => new CloudFrontService()).toThrow('Failed to load CloudFront private key');
    });
  });
});