/**
 * CloudFront Service Implementation
 * 
 * Implements CloudFront CDN operations using AWS SDK v3.
 * Handles signed URL generation for private content delivery.
 */

import { readFileSync } from 'fs';

import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

import { config } from '../../config/index.js';
import { ExternalServiceError } from '../errors/index.js';
import { logger } from '../utils/logger.js';
import { secrets } from '../utils/secureConfig.js';

import { 
  ICloudFrontService, 
  CloudFrontSignedUrlParams 
} from './ICloudFrontService.js';

/**
 * CloudFront Service Implementation
 * 
 * Provides CloudFront CDN operations with error handling and logging.
 */
export class CloudFrontService implements ICloudFrontService {
  private readonly domain: string;
  private readonly keyPairId: string;
  private readonly privateKey: string;

  constructor() {
    this.domain = config.cloudfront.domain;
    this.keyPairId = config.cloudfront.keyPairId;
    
    // Load private key from file if path is provided
    const cloudFrontConfig = secrets.getCloudFrontConfig();
    if (cloudFrontConfig.privateKeyPath) {
      try {
        this.privateKey = readFileSync(cloudFrontConfig.privateKeyPath, 'utf8');
      } catch (error) {
        logger.error('Failed to load CloudFront private key', {
          path: cloudFrontConfig.privateKeyPath,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error('Failed to load CloudFront private key');
      }
    } else {
      this.privateKey = '';
    }
  }

  /**
   * Generates a signed URL for private content access
   */
  async generateSignedUrl(params: CloudFrontSignedUrlParams): Promise<string> {
    if (!this.isConfigured()) {
      throw new ExternalServiceError(
        'AWS CloudFront',
        'CloudFront is not properly configured',
        new Error('Missing CloudFront configuration')
      );
    }

    try {
      logger.info('Generating CloudFront signed URL', {
        url: params.url,
        expiresIn: params.expiresIn,
        hasIpRestriction: !!params.ipAddress,
      });

      const expirationTime = new Date(Date.now() + params.expiresIn * 1000);

      // Simulate async operation for CloudFront URL generation
      const signedUrl = await Promise.resolve(getSignedUrl({
        url: params.url,
        keyPairId: this.keyPairId,
        privateKey: this.privateKey,
        dateLessThan: expirationTime.toISOString(),
        ipAddress: params.ipAddress,
      }));

      logger.info('CloudFront signed URL generated successfully', {
        url: params.url,
        expiresAt: expirationTime.toISOString(),
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate CloudFront signed URL', {
        url: params.url,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new ExternalServiceError(
        'AWS CloudFront',
        `Failed to generate signed URL for: ${params.url}`,
        error instanceof Error ? error : new Error('Unknown CloudFront error')
      );
    }
  }

  /**
   * Gets the CloudFront URL for a given S3 key
   */
  getCloudFrontUrl(s3Key: string): string {
    if (!this.domain) {
      // Fallback to S3 URL if CloudFront is not configured
      return `https://${config.s3.bucketName}.s3.${config.s3.bucketRegion}.amazonaws.com/${s3Key}`;
    }

    return `https://${this.domain}/${s3Key}`;
  }

  /**
   * Checks if CloudFront is properly configured
   */
  isConfigured(): boolean {
    return !!(this.domain && this.keyPairId && this.privateKey);
  }
}