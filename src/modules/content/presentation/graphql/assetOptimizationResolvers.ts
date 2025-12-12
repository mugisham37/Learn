/**
 * Asset Optimization GraphQL Resolvers
 * 
 * Provides GraphQL resolvers for asset optimization operations
 * including CDN URLs, responsive images, and lazy loading configuration.
 * 
 * Requirements: 15.5, 21.2
 */

import { FastifyRequest } from 'fastify';
import { AssetOptimizationService } from '../../../shared/services/AssetOptimizationService.js';
import { CloudFrontService } from '../../../shared/services/CloudFrontService.js';
import { ValidationError, AuthenticationError } from '../../../shared/errors/index.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * Asset optimization resolvers
 */
export const assetOptimizationResolvers = {
  Query: {
    /**
     * Get optimized asset configuration
     */
    optimizedAsset: async (
      _parent: any,
      args: {
        s3Key: string;
        assetType: 'image' | 'video' | 'document' | 'static';
        options?: {
          critical?: boolean;
          priority?: number;
          generateResponsive?: boolean;
        };
      },
      context: { request: FastifyRequest }
    ) => {
      try {
        // Create asset optimization service
        const cloudFrontService = new CloudFrontService();
        const assetOptimizationService = new AssetOptimizationService(
          cloudFrontService,
          new (await import('../../../shared/services/ImageProcessingService.js')).ImageProcessingService(),
          new (await import('../../../shared/services/LazyLoadingService.js')).LazyLoadingService()
        );

        const optimizedAsset = await assetOptimizationService.optimizeAsset(
          args.s3Key,
          args.assetType,
          args.options || {}
        );

        logger.info('Asset optimization requested via GraphQL', {
          s3Key: args.s3Key,
          assetType: args.assetType,
          userId: context.request.user?.id,
        });

        return optimizedAsset;
      } catch (error) {
        logger.error('Failed to optimize asset via GraphQL', {
          s3Key: args.s3Key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get signed URL for private content
     */
    signedAssetUrl: async (
      _parent: any,
      args: {
        s3Key: string;
        expiresIn?: number;
      },
      context: { request: FastifyRequest }
    ) => {
      try {
        // Require authentication for signed URLs
        if (!context.request.user) {
          throw new AuthenticationError('Authentication required for signed URLs');
        }

        const cloudFrontService = new CloudFrontService();
        const assetOptimizationService = new AssetOptimizationService(
          cloudFrontService,
          new (await import('../../../shared/services/ImageProcessingService.js')).ImageProcessingService(),
          new (await import('../../../shared/services/LazyLoadingService.js')).LazyLoadingService()
        );

        const signedUrl = await assetOptimizationService.generateSignedUrl(
          args.s3Key,
          args.expiresIn || 3600,
          context.request.ip
        );

        logger.info('Signed URL generated via GraphQL', {
          s3Key: args.s3Key,
          expiresIn: args.expiresIn || 3600,
          userId: context.request.user.id,
        });

        return {
          url: signedUrl,
          expiresAt: new Date(Date.now() + (args.expiresIn || 3600) * 1000).toISOString(),
        };
      } catch (error) {
        logger.error('Failed to generate signed URL via GraphQL', {
          s3Key: args.s3Key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get lazy loading client script
     */
    lazyLoadingScript: async () => {
      try {
        const { LazyLoadingService } = await import('../../../shared/services/LazyLoadingService.js');
        const lazyLoadingService = new LazyLoadingService();
        
        return {
          script: lazyLoadingService.generateClientScript(),
          version: '1.0.0',
        };
      } catch (error) {
        logger.error('Failed to generate lazy loading script', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },

    /**
     * Get asset optimization statistics
     */
    assetOptimizationStats: async (
      _parent: any,
      _args: any,
      context: { request: FastifyRequest }
    ) => {
      try {
        // Require admin role for statistics
        if (!context.request.user || context.request.user.role !== 'admin') {
          throw new AuthenticationError('Admin access required for optimization statistics');
        }

        const cloudFrontService = new CloudFrontService();
        const assetOptimizationService = new AssetOptimizationService(
          cloudFrontService,
          new (await import('../../../shared/services/ImageProcessingService.js')).ImageProcessingService(),
          new (await import('../../../shared/services/LazyLoadingService.js')).LazyLoadingService()
        );

        const stats = assetOptimizationService.getOptimizationStats();

        // Get compression stats
        const { getCompressionStats } = await import('../../../shared/middleware/compression.js');
        const compressionStats = getCompressionStats();

        return {
          ...stats,
          compression: compressionStats,
        };
      } catch (error) {
        logger.error('Failed to get asset optimization stats', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },

  Mutation: {
    /**
     * Optimize multiple assets in batch
     */
    optimizeAssets: async (
      _parent: any,
      args: {
        assets: Array<{
          s3Key: string;
          type: 'image' | 'video' | 'document' | 'static';
          options?: any;
        }>;
      },
      context: { request: FastifyRequest }
    ) => {
      try {
        // Require authentication for batch optimization
        if (!context.request.user) {
          throw new AuthenticationError('Authentication required for asset optimization');
        }

        if (!args.assets || args.assets.length === 0) {
          throw new ValidationError('At least one asset must be provided');
        }

        if (args.assets.length > 50) {
          throw new ValidationError('Maximum 50 assets can be optimized in a single batch');
        }

        const cloudFrontService = new CloudFrontService();
        const assetOptimizationService = new AssetOptimizationService(
          cloudFrontService,
          new (await import('../../../shared/services/ImageProcessingService.js')).ImageProcessingService(),
          new (await import('../../../shared/services/LazyLoadingService.js')).LazyLoadingService()
        );

        const optimizedAssets = await assetOptimizationService.optimizeAssets(args.assets);

        logger.info('Batch asset optimization completed via GraphQL', {
          assetCount: args.assets.length,
          optimizedCount: optimizedAssets.length,
          userId: context.request.user.id,
        });

        return {
          assets: optimizedAssets,
          totalCount: args.assets.length,
          optimizedCount: optimizedAssets.length,
          failedCount: args.assets.length - optimizedAssets.length,
        };
      } catch (error) {
        logger.error('Failed to optimize assets in batch via GraphQL', {
          assetCount: args.assets?.length || 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
  },
};

/**
 * Asset optimization type definitions
 */
export const assetOptimizationTypeDefs = `
  type OptimizedAsset {
    originalUrl: String!
    optimizedUrl: String!
    metadata: AssetMetadata!
    lazyConfig: LazyLoadingConfig
    responsiveVariants: [ResponsiveVariant!]
  }

  type AssetMetadata {
    size: Int!
    format: String!
    dimensions: Dimensions
    cacheHeaders: JSON!
  }

  type Dimensions {
    width: Int!
    height: Int!
  }

  type LazyLoadingConfig {
    shouldLoad: Boolean!
    placeholder: String!
    attributes: JSON!
  }

  type ResponsiveVariant {
    url: String!
    width: Int!
    breakpoint: String!
  }

  type SignedAssetUrl {
    url: String!
    expiresAt: DateTime!
  }

  type LazyLoadingScript {
    script: String!
    version: String!
  }

  type AssetOptimizationStats {
    cdnEnabled: Boolean!
    imageOptimizationEnabled: Boolean!
    lazyLoadingEnabled: Boolean!
    responsiveImagesEnabled: Boolean!
    cacheDurations: JSON!
    compression: CompressionStats!
  }

  type CompressionStats {
    totalRequests: Int!
    compressedRequests: Int!
    totalOriginalBytes: Int!
    totalCompressedBytes: Int!
    averageCompressionRatio: Float!
  }

  type BatchOptimizationResult {
    assets: [OptimizedAsset!]!
    totalCount: Int!
    optimizedCount: Int!
    failedCount: Int!
  }

  input AssetOptimizationOptions {
    critical: Boolean
    priority: Int
    generateResponsive: Boolean
  }

  input AssetInput {
    s3Key: String!
    type: AssetType!
    options: AssetOptimizationOptions
  }

  enum AssetType {
    IMAGE
    VIDEO
    DOCUMENT
    STATIC
  }

  extend type Query {
    optimizedAsset(
      s3Key: String!
      assetType: AssetType!
      options: AssetOptimizationOptions
    ): OptimizedAsset!

    signedAssetUrl(
      s3Key: String!
      expiresIn: Int
    ): SignedAssetUrl!

    lazyLoadingScript: LazyLoadingScript!

    assetOptimizationStats: AssetOptimizationStats!
  }

  extend type Mutation {
    optimizeAssets(
      assets: [AssetInput!]!
    ): BatchOptimizationResult!
  }
`;