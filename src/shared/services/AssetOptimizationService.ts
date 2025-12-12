/**
 * Asset Optimization Service
 * 
 * Coordinates CloudFront CDN, compression, image optimization,
 * and lazy loading for comprehensive asset optimization.
 * 
 * Requirements: 15.5
 */

import { ICloudFrontService } from './ICloudFrontService.js';
import { ImageProcessingService } from './ImageProcessingService.js';
import { LazyLoadingService, LazyResource } from './LazyLoadingService.js';
import { CDNCacheBehaviors, generateCDNCacheHeaders } from '../utils/cdnCaching.js';
import { logger } from '../utils/logger.js';

/**
 * Asset optimization configuration
 */
export interface AssetOptimizationConfig {
  /** Enable CloudFront CDN */
  enableCDN?: boolean;
  /** Enable image optimization */
  enableImageOptimization?: boolean;
  /** Enable lazy loading */
  enableLazyLoading?: boolean;
  /** Enable responsive images */
  enableResponsiveImages?: boolean;
  /** Cache duration for different asset types (seconds) */
  cacheDurations?: {
    images?: number;
    videos?: number;
    documents?: number;
    static?: number;
  };
}

/**
 * Optimized asset result
 */
export interface OptimizedAsset {
  /** Original asset URL */
  originalUrl: string;
  /** Optimized asset URL (CDN) */
  optimizedUrl: string;
  /** Asset metadata */
  metadata: {
    size: number;
    format: string;
    dimensions?: { width: number; height: number };
    cacheHeaders: Record<string, string>;
  };
  /** Lazy loading configuration */
  lazyConfig?: {
    shouldLoad: boolean;
    placeholder: string;
    attributes: Record<string, string>;
  };
  /** Responsive variants (for images) */
  responsiveVariants?: Array<{
    url: string;
    width: number;
    breakpoint: string;
  }>;
}

/**
 * Asset Optimization Service Implementation
 */
export class AssetOptimizationService {
  private readonly config: Required<AssetOptimizationConfig>;

  constructor(
    private readonly cloudFrontService: ICloudFrontService,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly lazyLoadingService: LazyLoadingService,
    config: AssetOptimizationConfig = {}
  ) {
    this.config = {
      enableCDN: config.enableCDN ?? true,
      enableImageOptimization: config.enableImageOptimization ?? true,
      enableLazyLoading: config.enableLazyLoading ?? true,
      enableResponsiveImages: config.enableResponsiveImages ?? true,
      cacheDurations: {
        images: 604800, // 1 week
        videos: 86400, // 1 day
        documents: 3600, // 1 hour
        static: 31536000, // 1 year
        ...config.cacheDurations,
      },
    };
  }

  /**
   * Optimize an asset for delivery
   */
  async optimizeAsset(
    s3Key: string,
    assetType: 'image' | 'video' | 'document' | 'static',
    options: {
      critical?: boolean;
      priority?: number;
      dimensions?: { width: number; height: number };
      generateResponsive?: boolean;
    } = {}
  ): Promise<OptimizedAsset> {
    try {
      logger.info('Optimizing asset', { s3Key, assetType, options });

      // Get base URLs
      const originalUrl = this.getS3Url(s3Key);
      let optimizedUrl = originalUrl;

      // Use CloudFront if enabled and configured
      if (this.config.enableCDN && this.cloudFrontService.isConfigured()) {
        optimizedUrl = this.cloudFrontService.getCloudFrontUrl(s3Key);
      }

      // Generate cache headers
      const cacheHeaders = this.generateCacheHeaders(s3Key, assetType);

      // Create base asset metadata
      const metadata = {
        size: 0, // Would be populated from S3 metadata in production
        format: this.getFileExtension(s3Key),
        dimensions: options.dimensions,
        cacheHeaders,
      };

      const result: OptimizedAsset = {
        originalUrl,
        optimizedUrl,
        metadata,
      };

      // Handle image-specific optimizations
      if (assetType === 'image' && this.config.enableImageOptimization) {
        await this.optimizeImageAsset(result, s3Key, options);
      }

      // Generate lazy loading configuration
      if (this.config.enableLazyLoading) {
        result.lazyConfig = this.generateLazyLoadingConfig(result, options);
      }

      logger.info('Asset optimization completed', {
        s3Key,
        assetType,
        originalUrl: result.originalUrl,
        optimizedUrl: result.optimizedUrl,
        hasResponsiveVariants: !!result.responsiveVariants?.length,
        hasLazyConfig: !!result.lazyConfig,
      });

      return result;
    } catch (error) {
      logger.error('Asset optimization failed', {
        s3Key,
        assetType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Optimize multiple assets in batch
   */
  async optimizeAssets(
    assets: Array<{
      s3Key: string;
      type: 'image' | 'video' | 'document' | 'static';
      options?: any;
    }>
  ): Promise<OptimizedAsset[]> {
    const results = await Promise.allSettled(
      assets.map(asset => this.optimizeAsset(asset.s3Key, asset.type, asset.options))
    );

    const optimizedAssets: OptimizedAsset[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        optimizedAssets.push(result.value);
      } else {
        errors.push(`Asset ${assets[index].s3Key}: ${result.reason}`);
      }
    });

    if (errors.length > 0) {
      logger.warn('Some assets failed to optimize', { errors });
    }

    logger.info('Batch asset optimization completed', {
      total: assets.length,
      successful: optimizedAssets.length,
      failed: errors.length,
    });

    return optimizedAssets;
  }

  /**
   * Generate signed URL for private content
   */
  async generateSignedUrl(
    s3Key: string,
    expiresIn: number = 3600,
    ipAddress?: string
  ): Promise<string> {
    if (this.config.enableCDN && this.cloudFrontService.isConfigured()) {
      const cloudFrontUrl = this.cloudFrontService.getCloudFrontUrl(s3Key);
      return this.cloudFrontService.generateSignedUrl({
        url: cloudFrontUrl,
        expiresIn,
        ipAddress,
      });
    }

    // Fallback to S3 presigned URL (would need S3 service integration)
    return this.getS3Url(s3Key);
  }

  /**
   * Optimize image asset with responsive variants
   */
  private async optimizeImageAsset(
    result: OptimizedAsset,
    s3Key: string,
    options: any
  ): Promise<void> {
    if (!this.config.enableResponsiveImages || !options.generateResponsive) {
      return;
    }

    // Generate responsive variants
    const responsiveBreakpoints = [
      { width: 320, suffix: 'xs' },
      { width: 640, suffix: 'sm' },
      { width: 768, suffix: 'md' },
      { width: 1024, suffix: 'lg' },
      { width: 1280, suffix: 'xl' },
    ];

    result.responsiveVariants = responsiveBreakpoints.map(breakpoint => {
      const variantKey = this.generateResponsiveKey(s3Key, breakpoint.suffix);
      const variantUrl = this.config.enableCDN && this.cloudFrontService.isConfigured()
        ? this.cloudFrontService.getCloudFrontUrl(variantKey)
        : this.getS3Url(variantKey);

      return {
        url: variantUrl,
        width: breakpoint.width,
        breakpoint: breakpoint.suffix,
      };
    });
  }

  /**
   * Generate lazy loading configuration for an asset
   */
  private generateLazyLoadingConfig(
    asset: OptimizedAsset,
    options: any
  ): any {
    const lazyResource: LazyResource = {
      id: asset.originalUrl,
      url: asset.optimizedUrl,
      type: this.getAssetTypeFromUrl(asset.originalUrl),
      dimensions: asset.metadata.dimensions,
      priority: options.priority || 3,
      critical: options.critical || false,
    };

    return this.lazyLoadingService.generateLazyConfig(lazyResource);
  }

  /**
   * Generate cache headers for an asset
   */
  private generateCacheHeaders(
    s3Key: string,
    assetType: 'image' | 'video' | 'document' | 'static'
  ): Record<string, string> {
    const cacheDuration = this.config.cacheDurations[assetType];
    const path = `/${assetType}s/${s3Key}`;

    return generateCDNCacheHeaders(path, {
      ttl: cacheDuration,
      compress: assetType !== 'video', // Don't compress videos
    });
  }

  /**
   * Get S3 URL for a key
   */
  private getS3Url(s3Key: string): string {
    // This would use the actual S3 configuration
    return `https://your-bucket.s3.amazonaws.com/${s3Key}`;
  }

  /**
   * Get file extension from S3 key
   */
  private getFileExtension(s3Key: string): string {
    const parts = s3Key.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Generate responsive image key
   */
  private generateResponsiveKey(originalKey: string, suffix: string): string {
    const parts = originalKey.split('.');
    if (parts.length > 1) {
      const extension = parts.pop();
      const baseName = parts.join('.');
      return `${baseName}-${suffix}.${extension}`;
    }
    return `${originalKey}-${suffix}`;
  }

  /**
   * Get asset type from URL
   */
  private getAssetTypeFromUrl(url: string): 'image' | 'video' | 'iframe' | 'script' {
    const extension = this.getFileExtension(url);
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension)) {
      return 'image';
    }
    
    if (['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(extension)) {
      return 'video';
    }
    
    if (['js', 'mjs'].includes(extension)) {
      return 'script';
    }
    
    return 'image'; // Default fallback
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    cdnEnabled: boolean;
    imageOptimizationEnabled: boolean;
    lazyLoadingEnabled: boolean;
    responsiveImagesEnabled: boolean;
    cacheDurations: Record<string, number>;
  } {
    return {
      cdnEnabled: this.config.enableCDN && this.cloudFrontService.isConfigured(),
      imageOptimizationEnabled: this.config.enableImageOptimization,
      lazyLoadingEnabled: this.config.enableLazyLoading,
      responsiveImagesEnabled: this.config.enableResponsiveImages,
      cacheDurations: this.config.cacheDurations,
    };
  }
}

/**
 * Factory function to create asset optimization service
 */
export function createAssetOptimizationService(
  cloudFrontService: ICloudFrontService,
  config: AssetOptimizationConfig = {}
): AssetOptimizationService {
  const imageProcessingService = new ImageProcessingService();
  const lazyLoadingService = new LazyLoadingService();
  
  return new AssetOptimizationService(
    cloudFrontService,
    imageProcessingService,
    lazyLoadingService,
    config
  );
}