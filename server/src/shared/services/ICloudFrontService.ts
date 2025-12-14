/**
 * CloudFront Service Interface
 *
 * Defines the contract for CloudFront CDN operations.
 * Handles signed URL generation for private content delivery.
 */

/**
 * Signed URL parameters for CloudFront
 */
export interface CloudFrontSignedUrlParams {
  url: string;
  expiresIn: number; // seconds from now
  ipAddress?: string; // Optional IP restriction
}

/**
 * CloudFront Service Interface
 *
 * Provides methods for CloudFront CDN operations including
 * signed URL generation for private content access.
 */
export interface ICloudFrontService {
  /**
   * Generates a signed URL for private content access
   *
   * @param params - Signed URL parameters
   * @returns Signed CloudFront URL
   * @throws ExternalServiceError if CloudFront operation fails
   */
  generateSignedUrl(params: CloudFrontSignedUrlParams): Promise<string>;

  /**
   * Gets the CloudFront URL for a given S3 key
   *
   * @param s3Key - S3 object key
   * @returns CloudFront URL
   */
  getCloudFrontUrl(s3Key: string): string;

  /**
   * Checks if CloudFront is properly configured
   *
   * @returns True if CloudFront is configured, false otherwise
   */
  isConfigured(): boolean;
}
