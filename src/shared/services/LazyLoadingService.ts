/**
 * Lazy Loading Service
 * 
 * Implements lazy loading strategies for large resources including
 * images, videos, and other assets to improve page load performance.
 * 
 * Requirements: 15.5
 */

import { logger } from '../utils/logger.js';

/**
 * Lazy loading configuration options
 */
export interface LazyLoadingOptions {
  /** Intersection observer root margin */
  rootMargin?: string;
  /** Intersection observer threshold */
  threshold?: number;
  /** Placeholder image URL */
  placeholderUrl?: string;
  /** Loading animation URL */
  loadingUrl?: string;
  /** Fade-in animation duration (ms) */
  fadeInDuration?: number;
  /** Enable progressive loading for images */
  progressiveLoading?: boolean;
}

/**
 * Resource metadata for lazy loading
 */
export interface LazyResource {
  /** Resource ID */
  id: string;
  /** Resource URL */
  url: string;
  /** Resource type */
  type: 'image' | 'video' | 'iframe' | 'script';
  /** Resource size in bytes */
  size?: number;
  /** Resource dimensions */
  dimensions?: { width: number; height: number };
  /** Priority level (1-5, 1 being highest) */
  priority?: number;
  /** Whether resource is critical for initial render */
  critical?: boolean;
}

/**
 * Lazy loading strategy interface
 */
export interface LazyLoadingStrategy {
  /** Strategy name */
  name: string;
  /** Check if resource should be loaded */
  shouldLoad(resource: LazyResource, viewport: ViewportInfo): boolean;
  /** Get placeholder content */
  getPlaceholder(resource: LazyResource): string;
  /** Get loading indicator */
  getLoadingIndicator(resource: LazyResource): string;
}

/**
 * Viewport information
 */
export interface ViewportInfo {
  width: number;
  height: number;
  scrollY: number;
  devicePixelRatio: number;
  connectionType?: string;
  effectiveType?: string;
}

/**
 * Lazy Loading Service Implementation
 */
export class LazyLoadingService {
  private readonly options: Required<LazyLoadingOptions>;
  private readonly strategies: Map<string, LazyLoadingStrategy> = new Map();
  private readonly loadedResources: Set<string> = new Set();
  private readonly loadingResources: Set<string> = new Set();

  constructor(options: LazyLoadingOptions = {}) {
    this.options = {
      rootMargin: options.rootMargin || '50px',
      threshold: options.threshold || 0.1,
      placeholderUrl: options.placeholderUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+TG9hZGluZy4uLjwvdGV4dD48L3N2Zz4=',
      loadingUrl: options.loadingUrl || '',
      fadeInDuration: options.fadeInDuration || 300,
      progressiveLoading: options.progressiveLoading ?? true,
    };

    this.initializeStrategies();
  }

  /**
   * Initialize built-in lazy loading strategies
   */
  private initializeStrategies(): void {
    // Viewport-based strategy
    this.strategies.set('viewport', {
      name: 'viewport',
      shouldLoad: (resource, viewport) => {
        // Load resources that are within viewport or close to it
        return resource.critical || viewport.scrollY >= 0;
      },
      getPlaceholder: (resource) => this.generatePlaceholder(resource),
      getLoadingIndicator: (resource) => this.generateLoadingIndicator(resource),
    });

    // Connection-aware strategy
    this.strategies.set('connection-aware', {
      name: 'connection-aware',
      shouldLoad: (resource, viewport) => {
        if (resource.critical) return true;
        
        // Load based on connection quality
        const effectiveType = viewport.effectiveType || '4g';
        const resourceSize = resource.size || 0;
        
        switch (effectiveType) {
          case 'slow-2g':
          case '2g':
            return resourceSize < 50 * 1024; // 50KB
          case '3g':
            return resourceSize < 200 * 1024; // 200KB
          case '4g':
          default:
            return resourceSize < 1024 * 1024; // 1MB
        }
      },
      getPlaceholder: (resource) => this.generatePlaceholder(resource),
      getLoadingIndicator: (resource) => this.generateLoadingIndicator(resource),
    });

    // Priority-based strategy
    this.strategies.set('priority', {
      name: 'priority',
      shouldLoad: (resource, viewport) => {
        if (resource.critical) return true;
        
        // Load based on priority (1 = highest, 5 = lowest)
        const priority = resource.priority || 3;
        return priority <= 2;
      },
      getPlaceholder: (resource) => this.generatePlaceholder(resource),
      getLoadingIndicator: (resource) => this.generateLoadingIndicator(resource),
    });
  }

  /**
   * Register a custom lazy loading strategy
   */
  registerStrategy(strategy: LazyLoadingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    logger.info('Lazy loading strategy registered', { strategy: strategy.name });
  }

  /**
   * Generate lazy loading configuration for a resource
   */
  generateLazyConfig(
    resource: LazyResource,
    strategyName: string = 'viewport'
  ): {
    shouldLoad: boolean;
    placeholder: string;
    loadingIndicator: string;
    attributes: Record<string, string>;
  } {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Unknown lazy loading strategy: ${strategyName}`);
    }

    // Mock viewport info for server-side generation
    const viewport: ViewportInfo = {
      width: 1920,
      height: 1080,
      scrollY: 0,
      devicePixelRatio: 1,
      effectiveType: '4g',
    };

    const shouldLoad = strategy.shouldLoad(resource, viewport);
    const placeholder = strategy.getPlaceholder(resource);
    const loadingIndicator = strategy.getLoadingIndicator(resource);

    // Generate HTML attributes for lazy loading
    const attributes: Record<string, string> = {};
    
    if (!shouldLoad) {
      attributes['data-src'] = resource.url;
      attributes['data-lazy'] = 'true';
      attributes['loading'] = 'lazy';
      
      if (resource.type === 'image') {
        attributes['src'] = placeholder;
        attributes['data-placeholder'] = 'true';
      }
    } else {
      attributes['src'] = resource.url;
    }

    // Add intersection observer attributes
    attributes['data-root-margin'] = this.options.rootMargin;
    attributes['data-threshold'] = this.options.threshold.toString();

    return {
      shouldLoad,
      placeholder,
      loadingIndicator,
      attributes,
    };
  }

  /**
   * Generate responsive image srcset with lazy loading
   */
  generateResponsiveSrcSet(
    baseUrl: string,
    variants: Array<{ width: number; suffix: string }>,
    strategyName: string = 'viewport'
  ): {
    srcset: string;
    dataSrcset: string;
    sizes: string;
  } {
    const srcsetEntries = variants.map(variant => 
      `${baseUrl.replace(/\.[^.]+$/, `-${variant.suffix}$&`)} ${variant.width}w`
    );

    const srcset = srcsetEntries.join(', ');
    const sizes = this.generateSizesAttribute(variants);

    return {
      srcset: '', // Empty for lazy loading
      dataSrcset: srcset,
      sizes,
    };
  }

  /**
   * Generate sizes attribute for responsive images
   */
  private generateSizesAttribute(variants: Array<{ width: number; suffix: string }>): string {
    const sizeEntries = variants.map((variant, index) => {
      if (index === variants.length - 1) {
        return `${variant.width}px`;
      }
      return `(max-width: ${variant.width}px) ${variant.width}px`;
    });

    return sizeEntries.join(', ');
  }

  /**
   * Generate placeholder content for a resource
   */
  private generatePlaceholder(resource: LazyResource): string {
    if (resource.type === 'image') {
      const { width = 400, height = 300 } = resource.dimensions || {};
      
      if (this.options.progressiveLoading) {
        // Generate a low-quality placeholder
        return this.generateLowQualityPlaceholder(width, height);
      }
      
      return this.options.placeholderUrl;
    }
    
    return '';
  }

  /**
   * Generate loading indicator for a resource
   */
  private generateLoadingIndicator(resource: LazyResource): string {
    const { width = 400, height = 300 } = resource.dimensions || {};
    
    return `
      <div class="lazy-loading-indicator" style="width: ${width}px; height: ${height}px; background: #f4f4f4; display: flex; align-items: center; justify-content: center;">
        <div class="loading-spinner" style="width: 40px; height: 40px; border: 4px solid #e0e0e0; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
    `;
  }

  /**
   * Generate low-quality placeholder for progressive loading
   */
  private generateLowQualityPlaceholder(width: number, height: number): string {
    // Generate a simple SVG placeholder with the correct aspect ratio
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f4f4f4"/>
        <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" dy=".3em">
          Loading...
        </text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Generate client-side JavaScript for lazy loading
   */
  generateClientScript(): string {
    return `
      (function() {
        // Intersection Observer for lazy loading
        const lazyObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target;
              const src = element.dataset.src;
              
              if (src) {
                // Load the actual resource
                if (element.tagName === 'IMG') {
                  element.src = src;
                  element.onload = () => {
                    element.classList.add('lazy-loaded');
                    element.style.transition = 'opacity ${this.options.fadeInDuration}ms';
                    element.style.opacity = '1';
                  };
                } else if (element.tagName === 'VIDEO') {
                  element.src = src;
                  element.load();
                }
                
                // Remove data attributes
                delete element.dataset.src;
                delete element.dataset.lazy;
                
                // Stop observing this element
                lazyObserver.unobserve(element);
              }
            }
          });
        }, {
          rootMargin: '${this.options.rootMargin}',
          threshold: ${this.options.threshold}
        });
        
        // Observe all lazy elements
        document.querySelectorAll('[data-lazy="true"]').forEach(element => {
          lazyObserver.observe(element);
        });
        
        // Handle responsive images
        const responsiveObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target;
              const srcset = element.dataset.srcset;
              
              if (srcset) {
                element.srcset = srcset;
                delete element.dataset.srcset;
                responsiveObserver.unobserve(element);
              }
            }
          });
        }, {
          rootMargin: '${this.options.rootMargin}',
          threshold: ${this.options.threshold}
        });
        
        document.querySelectorAll('[data-srcset]').forEach(element => {
          responsiveObserver.observe(element);
        });
      })();
    `;
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    totalResources: number;
    loadedResources: number;
    loadingResources: number;
    strategies: string[];
  } {
    return {
      totalResources: this.loadedResources.size + this.loadingResources.size,
      loadedResources: this.loadedResources.size,
      loadingResources: this.loadingResources.size,
      strategies: Array.from(this.strategies.keys()),
    };
  }
}

/**
 * Default lazy loading service instance
 */
export const lazyLoadingService = new LazyLoadingService();