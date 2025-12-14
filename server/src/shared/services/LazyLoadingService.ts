/**
 * Lazy Loading Service
 *
 * Handles lazy loading configuration for various resource types.
 */

export interface LazyResource {
  id: string;
  url: string;
  type: 'image' | 'video' | 'iframe' | 'script';
  dimensions?: { width: number; height: number };
  priority: number;
  critical: boolean;
}

export interface LazyConfig {
  shouldLoad: boolean;
  placeholder: string;
  attributes: Record<string, string>;
}

export class LazyLoadingService {
  /**
   * Generate lazy loading configuration for a resource
   */
  generateLazyConfig(resource: LazyResource): LazyConfig {
    const shouldLoad = resource.critical || resource.priority <= 2;

    return {
      shouldLoad,
      placeholder: this.generatePlaceholder(resource),
      attributes: this.generateAttributes(resource),
    };
  }

  /**
   * Generate placeholder for lazy loaded resource
   */
  private generatePlaceholder(resource: LazyResource): string {
    if (resource.type === 'image') {
      const dimensions = resource.dimensions || { width: 300, height: 200 };
      const width = dimensions.width || 300;
      const height = dimensions.height || 200;
      return `data:image/svg+xml;base64,${Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f0f0f0"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Loading...</text>
        </svg>`
      ).toString('base64')}`;
    }

    return '';
  }

  /**
   * Generate HTML attributes for lazy loading
   */
  private generateAttributes(resource: LazyResource): Record<string, string> {
    const attributes: Record<string, string> = {
      'data-src': resource.url,
      'data-priority': resource.priority.toString(),
    };

    if (resource.critical) {
      attributes['data-critical'] = 'true';
    }

    if (resource.dimensions) {
      attributes['width'] = resource.dimensions.width?.toString() || '';
      attributes['height'] = resource.dimensions.height?.toString() || '';
    }

    return attributes;
  }

  /**
   * Generate client-side lazy loading script
   */
  generateClientScript(): string {
    return `
      (function() {
        'use strict';
        
        // Intersection Observer for lazy loading
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target;
              const src = element.getAttribute('data-src');
              if (src) {
                if (element.tagName === 'IMG') {
                  element.src = src;
                } else if (element.tagName === 'VIDEO') {
                  element.src = src;
                } else {
                  element.style.backgroundImage = 'url(' + src + ')';
                }
                element.removeAttribute('data-src');
                observer.unobserve(element);
              }
            }
          });
        }, {
          rootMargin: '50px 0px',
          threshold: 0.01
        });

        // Observe all elements with data-src
        document.querySelectorAll('[data-src]').forEach(el => {
          observer.observe(el);
        });

        // Handle dynamically added elements
        const mutationObserver = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === 1) {
                const element = node;
                if (element.hasAttribute && element.hasAttribute('data-src')) {
                  observer.observe(element);
                }
                element.querySelectorAll && element.querySelectorAll('[data-src]').forEach(el => {
                  observer.observe(el);
                });
              }
            });
          });
        });

        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      })();
    `.trim();
  }
}

/**
 * Singleton instance of LazyLoadingService
 */
export const lazyLoadingService = new LazyLoadingService();
