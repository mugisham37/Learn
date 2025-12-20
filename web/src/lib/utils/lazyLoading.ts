/**
 * Lazy Loading Infrastructure
 * 
 * Code splitting utilities, lazy loading for subscription components,
 * dynamic import helpers with loading states, and bundle size monitoring.
 * 
 * Requirements: 12.3, 12.5
 */

import React, { Suspense, ComponentType, LazyExoticComponent } from 'react';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface LazyLoadOptions {
  /** Fallback component to show while loading */
  fallback?: React.ComponentType;
  /** Error boundary component for handling load errors */
  errorBoundary?: React.ComponentType<{ error: Error; retry: () => void }>;
  /** Retry attempts for failed loads */
  retryAttempts?: number;
  /** Delay before retry in milliseconds */
  retryDelay?: number;
  /** Enable preloading on hover/focus */
  preload?: boolean;
  /** Custom loading component */
  loadingComponent?: React.ComponentType<{ progress?: number }>;
}

export interface DynamicImportOptions<T = unknown> {
  /** Loading state component */
  loading?: React.ComponentType;
  /** Error state component */
  error?: React.ComponentType<{ error: Error; retry: () => void }>;
  /** Timeout for import in milliseconds */
  timeout?: number;
  /** Enable retry on failure */
  retry?: boolean;
  /** Custom module resolver */
  resolver?: (module: unknown) => T;
}

export interface BundleMetrics {
  /** Bundle name/identifier */
  name: string;
  /** Bundle size in bytes */
  size: number;
  /** Load time in milliseconds */
  loadTime: number;
  /** Whether bundle was cached */
  cached: boolean;
  /** Timestamp of load */
  timestamp: number;
}

export interface LazyComponentState {
  /** Whether component is loaded */
  loaded: boolean;
  /** Whether component is currently loading */
  loading: boolean;
  /** Load error if any */
  error: Error | null;
  /** Load progress (0-100) */
  progress: number;
}

// =============================================================================
// Code Splitting Utilities
// =============================================================================

/**
 * Creates a lazy-loaded component with enhanced error handling and retry logic
 */
export function createLazyComponent<TProps = Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<TProps> }>,
  options: LazyLoadOptions = {}
): LazyExoticComponent<ComponentType<TProps>> {
  const {
    errorBoundary: ErrorBoundaryComponent,
    retryAttempts = 3,
    retryDelay = 1000,
    preload = false,
    loadingComponent: LoadingComponent,
  } = options;

  let retryCount = 0;
  let preloadPromise: Promise<unknown> | null = null;

  // Enhanced import function with retry logic
  const enhancedImportFn = async (): Promise<{ default: ComponentType<TProps> }> => {
    try {
      const startTime = performance.now();
      const loadedModule = await importFn();
      const loadTime = performance.now() - startTime;

      // Track bundle metrics
      BundleMonitor.getInstance().recordLoad({
        name: loadedModule.default.displayName || loadedModule.default.name || 'Anonymous',
        size: 0, // Would need webpack plugin to get actual size
        loadTime,
        cached: loadTime < 50, // Heuristic for cached bundles
        timestamp: Date.now(),
      });

      retryCount = 0; // Reset retry count on success
      return loadedModule;
    } catch (error) {
      if (retryCount < retryAttempts) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
        return enhancedImportFn();
      }
      throw error;
    }
  };

  const LazyComponent = React.lazy(enhancedImportFn);

  // Add preload capability
  if (preload) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LazyComponent as any).preload = () => {
      if (!preloadPromise) {
        preloadPromise = enhancedImportFn();
      }
      return preloadPromise;
    };
  }

  // Wrap with error boundary if provided
  if (ErrorBoundaryComponent) {
    const WrappedComponent: React.FC<TProps> = (props) => {
      return React.createElement(ErrorBoundaryComponent, {
        error: new Error('Component failed to load'),
        retry: () => window.location.reload()
      }, React.createElement(Suspense, {
        fallback: LoadingComponent ? React.createElement(LoadingComponent) : React.createElement('div', {}, 'Loading...')
      }, React.createElement(LazyComponent, props)));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return WrappedComponent as any;
  }

  return LazyComponent;
}

/**
 * Creates a lazy-loaded subscription component with connection management
 */
export function createLazySubscriptionComponent<TProps = Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<TProps> }>,
  subscriptionSetup?: () => void,
  subscriptionCleanup?: () => void
): LazyExoticComponent<ComponentType<TProps>> {
  const LazyComponent = createLazyComponent(importFn, {
    preload: true,
    loadingComponent: () => React.createElement('div', { className: 'flex items-center justify-center p-4' },
      React.createElement('div', { className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600' }),
      React.createElement('span', { className: 'ml-2 text-sm text-gray-600' }, 'Connecting...')
    ),
  });

  // Wrap with subscription lifecycle management
  const SubscriptionWrapper: React.FC<TProps> = (props) => {
    React.useEffect(() => {
      subscriptionSetup?.();
      return subscriptionCleanup;
    }, []);

    return React.createElement(LazyComponent, props);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return SubscriptionWrapper as any;
}

// =============================================================================
// Dynamic Import Helpers
// =============================================================================

/**
 * Enhanced dynamic import with loading states and error handling
 */
export function useDynamicImport<T = unknown>(
  importFn: () => Promise<T>,
  options: DynamicImportOptions<T> = {}
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const {
    timeout = 30000,
    retry = true,
    resolver = (module) => module as T,
  } = options;

  const [state, setState] = React.useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const [retryCount, setRetryCount] = React.useState(0);

  const executeImport = React.useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Import timeout')), timeout);
      });

      const loadedModule = await Promise.race([importFn(), timeoutPromise]);
      const resolvedData = resolver(loadedModule);

      setState({
        data: resolvedData,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error as Error,
      });
    }
  }, [importFn, timeout, resolver]);

  const retryImport = React.useCallback(() => {
    setRetryCount(prev => prev + 1);
    executeImport();
  }, [executeImport]);

  React.useEffect(() => {
    executeImport();
  }, [executeImport, retryCount]);

  return {
    ...state,
    retry: retry ? retryImport : () => {},
  };
}

/**
 * Hook for preloading components on hover/focus
 */
export function usePreloadOnHover<T>(
  preloadFn: () => Promise<T>,
  enabled: boolean = true
): {
  onMouseEnter: () => void;
  onFocus: () => void;
  preloaded: boolean;
} {
  const [preloaded, setPreloaded] = React.useState(false);
  const preloadPromise = React.useRef<Promise<T> | null>(null);

  const preload = React.useCallback(() => {
    if (!enabled || preloaded || preloadPromise.current) return;

    preloadPromise.current = preloadFn();
    preloadPromise.current
      .then(() => setPreloaded(true))
      .catch(() => {
        preloadPromise.current = null;
      });
  }, [preloadFn, enabled, preloaded]);

  return {
    onMouseEnter: preload,
    onFocus: preload,
    preloaded,
  };
}

// =============================================================================
// Bundle Size Monitoring
// =============================================================================

/**
 * Bundle size and performance monitoring
 */
export class BundleMonitor {
  private static instance: BundleMonitor;
  private metrics: BundleMetrics[] = [];
  private observers: ((metrics: BundleMetrics) => void)[] = [];

  static getInstance(): BundleMonitor {
    if (!BundleMonitor.instance) {
      BundleMonitor.instance = new BundleMonitor();
    }
    return BundleMonitor.instance;
  }

  recordLoad(metrics: BundleMetrics): void {
    this.metrics.push(metrics);
    this.observers.forEach(observer => observer(metrics));

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Bundle] Loaded ${metrics.name} in ${metrics.loadTime.toFixed(2)}ms`);
    }
  }

  subscribe(observer: (metrics: BundleMetrics) => void): () => void {
    this.observers.push(observer);
    return () => {
      const index = this.observers.indexOf(observer);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }

  getMetrics(): BundleMetrics[] {
    return [...this.metrics];
  }

  getReport(): {
    totalBundles: number;
    totalSize: number;
    averageLoadTime: number;
    cacheHitRate: number;
    slowestBundles: BundleMetrics[];
    largestBundles: BundleMetrics[];
  } {
    const totalBundles = this.metrics.length;
    const totalSize = this.metrics.reduce((sum, m) => sum + m.size, 0);
    const averageLoadTime = this.metrics.reduce((sum, m) => sum + m.loadTime, 0) / totalBundles || 0;
    const cachedCount = this.metrics.filter(m => m.cached).length;
    const cacheHitRate = cachedCount / totalBundles || 0;

    const slowestBundles = [...this.metrics]
      .sort((a, b) => b.loadTime - a.loadTime)
      .slice(0, 5);

    const largestBundles = [...this.metrics]
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);

    return {
      totalBundles,
      totalSize,
      averageLoadTime,
      cacheHitRate,
      slowestBundles,
      largestBundles,
    };
  }

  clear(): void {
    this.metrics = [];
  }
}

/**
 * React hook for monitoring bundle performance
 */
export function useBundleMonitor(): {
  metrics: BundleMetrics[];
  report: ReturnType<BundleMonitor['getReport']>;
} {
  const [metrics, setMetrics] = React.useState<BundleMetrics[]>([]);

  React.useEffect(() => {
    const monitor = BundleMonitor.getInstance();
    setMetrics(monitor.getMetrics());

    const unsubscribe = monitor.subscribe(() => {
      setMetrics(monitor.getMetrics());
    });

    return unsubscribe;
  }, []);

  const report = React.useMemo(() => {
    return BundleMonitor.getInstance().getReport();
  }, [metrics]);

  return { metrics, report };
}

// =============================================================================
// Higher-Order Components
// =============================================================================

/**
 * HOC for adding lazy loading capabilities to any component
 */
export function withLazyLoading<TProps extends Record<string, unknown>>(
  Component: ComponentType<TProps>,
  options: LazyLoadOptions = {}
): ComponentType<TProps> {
  const { loadingComponent: LoadingComponent, errorBoundary: ErrorBoundary } = options;

  const WrappedComponent: React.FC<TProps> = (props) => {
    const [loaded, setLoaded] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    React.useEffect(() => {
      // Simulate async loading
      const timer = setTimeout(() => {
        setLoaded(true);
      }, 100);

      return () => clearTimeout(timer);
    }, []);

    if (error && ErrorBoundary) {
      return React.createElement(ErrorBoundary, { error, retry: () => setError(null) });
    }

    if (!loaded && LoadingComponent) {
      return React.createElement(LoadingComponent);
    }

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withLazyLoading(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// =============================================================================
// Utility Components
// =============================================================================

/**
 * Default loading component with progress indicator
 */
export const DefaultLoadingComponent: React.FC<{ progress?: number }> = ({ progress }) => {
  return React.createElement('div', { className: 'flex flex-col items-center justify-center p-8' },
    React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4' }),
    React.createElement('div', { className: 'text-sm text-gray-600 mb-2' }, 'Loading...'),
    progress !== undefined && React.createElement('div', { className: 'w-32 bg-gray-200 rounded-full h-2' },
      React.createElement('div', {
        className: 'bg-blue-600 h-2 rounded-full transition-all duration-300',
        style: { width: `${progress}%` }
      })
    )
  );
};

/**
 * Default error boundary component
 */
export const DefaultErrorBoundary: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => {
  return React.createElement('div', { className: 'flex flex-col items-center justify-center p-8 border border-red-200 rounded-lg bg-red-50' },
    React.createElement('div', { className: 'text-red-600 mb-4' },
      React.createElement('svg', { className: 'w-8 h-8', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z' })
      )
    ),
    React.createElement('div', { className: 'text-sm text-red-800 mb-4 text-center' },
      `Failed to load component: ${error.message}`
    ),
    React.createElement('button', {
      onClick: retry,
      className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors'
    }, 'Retry')
  );
};

// =============================================================================
// Exports
// =============================================================================

export const LazyLoadingUtils = {
  createLazyComponent,
  createLazySubscriptionComponent,
  useDynamicImport,
  usePreloadOnHover,
  useBundleMonitor,
  withLazyLoading,
  BundleMonitor,
  DefaultLoadingComponent,
  DefaultErrorBoundary,
};