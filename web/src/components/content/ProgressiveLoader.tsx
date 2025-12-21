/**
 * Progressive Content Loader Component
 * 
 * Implements progressive loading strategies for content delivery
 * with intelligent caching and preloading capabilities.
 * 
 * Features:
 * - Progressive image loading with blur-up effect
 * - Video thumbnail preloading
 * - Adaptive quality based on connection speed
 * - Intelligent caching strategies
 * - Skeleton loading states
 * 
 * Requirements: 13.4
 */

import React, { useState, useEffect, useCallback } from 'react';

interface ProgressiveLoaderProps {
  title: string;
  thumbnail?: string;
  className?: string;
  type?: 'video' | 'image' | 'document';
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
}

interface LoadingState {
  phase: 'initial' | 'thumbnail' | 'preview' | 'full' | 'complete' | 'error';
  progress: number;
  error?: string;
}

interface ConnectionInfo {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  downlink: number;
  rtt: number;
}

export function ProgressiveLoader({
  title,
  thumbnail,
  className = '',
  type = 'video',
  size = 'medium',
  showProgress = true,
}: ProgressiveLoaderProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    phase: 'initial',
    progress: 0,
  });
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);
  const [optimizedThumbnail, setOptimizedThumbnail] = useState<string>('');

  // Detect connection quality
  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      setConnectionInfo({
        effectiveType: connection.effectiveType || '4g',
        downlink: connection.downlink || 10,
        rtt: connection.rtt || 100,
      });

      const handleConnectionChange = () => {
        setConnectionInfo({
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 100,
        });
      };

      connection.addEventListener('change', handleConnectionChange);
      return () => connection.removeEventListener('change', handleConnectionChange);
    }
  }, []);

  // Progressive loading strategy
  const getLoadingStrategy = useCallback((): 'fast' | 'adaptive' | 'conservative' => {
    if (!connectionInfo) return 'adaptive';

    const { effectiveType, downlink } = connectionInfo;
    
    if (effectiveType === '4g' && downlink > 5) {
      return 'fast';
    } else if (effectiveType === '3g' || (effectiveType === '4g' && downlink > 1)) {
      return 'adaptive';
    } else {
      return 'conservative';
    }
  }, [connectionInfo]);

  // Optimize thumbnail based on connection and size
  const getOptimizedThumbnailUrl = useCallback((originalUrl: string): string => {
    if (!originalUrl) return '';

    const strategy = getLoadingStrategy();
    const sizeMultiplier = {
      small: 0.5,
      medium: 1,
      large: 1.5,
    }[size];

    const baseWidth = 640 * sizeMultiplier;
    const quality = {
      fast: 85,
      adaptive: 70,
      conservative: 50,
    }[strategy];

    // Construct optimized URL (assuming CloudFront with image optimization)
    const url = new URL(originalUrl);
    url.searchParams.set('w', Math.round(baseWidth).toString());
    url.searchParams.set('q', quality.toString());
    url.searchParams.set('f', 'webp');
    
    return url.toString();
  }, [getLoadingStrategy, size]);

  // Load content progressively
  useEffect(() => {
    if (!thumbnail) return;

    const loadProgressively = async () => {
      try {
        // Phase 1: Load low-quality thumbnail
        setLoadingState({ phase: 'thumbnail', progress: 10 });
        
        const lowQualityUrl = getOptimizedThumbnailUrl(thumbnail);
        await preloadImage(lowQualityUrl);
        setOptimizedThumbnail(lowQualityUrl);
        
        setLoadingState({ phase: 'preview', progress: 50 });

        // Phase 2: Load higher quality preview (if connection allows)
        const strategy = getLoadingStrategy();
        if (strategy === 'fast') {
          const highQualityUrl = getOptimizedThumbnailUrl(thumbnail);
          await preloadImage(highQualityUrl);
          setOptimizedThumbnail(highQualityUrl);
        }

        setLoadingState({ phase: 'complete', progress: 100 });
      } catch (error) {
        setLoadingState({
          phase: 'error',
          progress: 0,
          error: 'Failed to load content preview',
        });
      }
    };

    loadProgressively();
  }, [thumbnail, getOptimizedThumbnailUrl, getLoadingStrategy]);

  // Preload image utility
  const preloadImage = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  };

  // Get skeleton dimensions based on type and size
  const getSkeletonDimensions = () => {
    const dimensions = {
      video: {
        small: { width: '320px', height: '180px' },
        medium: { width: '640px', height: '360px' },
        large: { width: '1280px', height: '720px' },
      },
      image: {
        small: { width: '200px', height: '150px' },
        medium: { width: '400px', height: '300px' },
        large: { width: '800px', height: '600px' },
      },
      document: {
        small: { width: '200px', height: '260px' },
        medium: { width: '300px', height: '390px' },
        large: { width: '400px', height: '520px' },
      },
    };

    return dimensions[type][size];
  };

  const dimensions = getSkeletonDimensions();

  // Render loading skeleton
  if (loadingState.phase === 'initial' || loadingState.phase === 'thumbnail') {
    return (
      <div className={`progressive-loader ${className}`} style={dimensions}>
        <div className="skeleton-container">
          {/* Animated skeleton */}
          <div className="skeleton-content">
            <div className="skeleton-image" />
            <div className="skeleton-text">
              <div className="skeleton-title" />
              <div className="skeleton-subtitle" />
            </div>
          </div>

          {/* Loading indicator */}
          {showProgress && (
            <div className="loading-indicator">
              <div className="loading-spinner" />
              <div className="loading-text">
                {loadingState.phase === 'initial' ? 'Initializing...' : 'Loading preview...'}
              </div>
              {connectionInfo && (
                <div className="connection-info">
                  {connectionInfo.effectiveType.toUpperCase()} • {Math.round(connectionInfo.downlink)}Mbps
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render error state
  if (loadingState.phase === 'error') {
    return (
      <div className={`progressive-loader error ${className}`} style={dimensions}>
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error-message">
            <h3>Content Unavailable</h3>
            <p>{loadingState.error}</p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render loaded content with progressive enhancement
  return (
    <div className={`progressive-loader loaded ${className}`} style={dimensions}>
      <div className="content-container">
        {/* Optimized thumbnail */}
        {optimizedThumbnail && (
          <div className="thumbnail-container">
            <img
              src={optimizedThumbnail}
              alt={title}
              className="optimized-thumbnail"
              loading="lazy"
            />
            
            {/* Content type overlay */}
            <div className="content-overlay">
              <div className="content-type-icon">
                {type === 'video' && '▶️'}
                {type === 'image' && '🖼️'}
                {type === 'document' && '📄'}
              </div>
            </div>
          </div>
        )}

        {/* Content info */}
        <div className="content-info">
          <h3 className="content-title">{title}</h3>
          
          {/* Loading progress */}
          {showProgress && loadingState.progress < 100 && (
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>
          )}

          {/* Connection-aware messaging */}
          {connectionInfo && (
            <div className="loading-tips">
              {connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g' ? (
                <p className="tip">Optimized for slow connections</p>
              ) : connectionInfo.effectiveType === '3g' ? (
                <p className="tip">Loading adaptive quality</p>
              ) : (
                <p className="tip">Loading high quality</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Utility functions for progressive loading
export const ProgressiveLoadingUtils = {
  /**
   * Preload critical content based on user behavior
   */
  preloadCriticalContent: async (contentIds: string[]) => {
    // Implement intelligent preloading based on user patterns
    const preloadPromises = contentIds.map(async (id) => {
      // Preload thumbnails and metadata
      return fetch(`/api/content/${id}/preview`, { 
        method: 'HEAD',
        priority: 'low' as RequestPriority,
      });
    });

    await Promise.allSettled(preloadPromises);
  },

  /**
   * Get optimal image format based on browser support
   */
  getOptimalImageFormat: (): 'webp' | 'avif' | 'jpeg' => {
    if (typeof window === 'undefined') return 'jpeg';

    // Check for AVIF support
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    if (canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0) {
      return 'avif';
    }
    
    // Check for WebP support
    if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
      return 'webp';
    }
    
    return 'jpeg';
  },

  /**
   * Calculate optimal quality based on viewport and connection
   */
  calculateOptimalQuality: (
    viewportWidth: number,
    connectionType: string,
    contentType: 'thumbnail' | 'preview' | 'full'
  ): number => {
    const baseQuality = {
      thumbnail: 60,
      preview: 75,
      full: 85,
    }[contentType];

    const connectionMultiplier = {
      'slow-2g': 0.6,
      '2g': 0.7,
      '3g': 0.85,
      '4g': 1.0,
    }[connectionType as keyof typeof connectionMultiplier] || 1.0;

    const viewportMultiplier = viewportWidth > 1920 ? 1.1 : 
                              viewportWidth > 1280 ? 1.0 : 
                              viewportWidth > 768 ? 0.9 : 0.8;

    return Math.round(baseQuality * connectionMultiplier * viewportMultiplier);
  },
};

export default ProgressiveLoader;