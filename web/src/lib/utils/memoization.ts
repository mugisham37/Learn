/**
 * Advanced Memoization Utilities
 *
 * React component memoization helpers, selector memoization for state management,
 * and cache-aware memoization with invalidation capabilities.
 *
 * Requirements: 12.2
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface SelectorMemoOptions {
  /** Maximum cache size for selector results */
  maxSize?: number;
  /** Custom equality function for comparing inputs */
  equalityFn?: (a: unknown, b: unknown) => boolean;
  /** Enable cache invalidation tracking */
  trackInvalidation?: boolean;
}

export interface ComponentMemoOptions {
  /** Custom comparison function for props */
  areEqual?: (prevProps: unknown, nextProps: unknown) => boolean;
  /** Enable debug logging for re-renders */
  debug?: boolean;
  /** Component display name for debugging */
  displayName?: string;
}

export interface CacheAwareMemoOptions {
  /** Apollo cache instance for invalidation tracking */
  cache?: {
    evict: (options: unknown) => unknown;
  };
  /** Cache keys to watch for invalidation */
  watchKeys?: string[];
  /** Custom invalidation predicate */
  shouldInvalidate?: (cacheUpdate: unknown) => boolean;
}

export interface MemoizationMetrics {
  hits: number;
  misses: number;
  invalidations: number;
  cacheSize: number;
  hitRate: number;
}

// =============================================================================
// Selector Memoization
// =============================================================================

/**
 * Creates a memoized selector with advanced caching capabilities
 */
export function createMemoizedSelector<TState, TArgs extends unknown[], TResult>(
  selector: (state: TState, ...args: TArgs) => TResult,
  options: SelectorMemoOptions = {}
): (state: TState, ...args: TArgs) => TResult {
  const { maxSize = 10, equalityFn = Object.is } = options;

  const cache = new Map<
    string,
    { result: TResult; inputs: [TState, ...TArgs]; timestamp: number }
  >();
  const metrics: MemoizationMetrics = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    cacheSize: 0,
    hitRate: 0,
  };

  function generateKey(state: TState, args: TArgs): string {
    // Simple key generation - in practice, you might want something more sophisticated
    return JSON.stringify({
      state: typeof state === 'object' ? Object.keys(state || {}) : state,
      args,
    });
  }

  function updateMetrics(): void {
    metrics.cacheSize = cache.size;
    metrics.hitRate = metrics.hits / (metrics.hits + metrics.misses) || 0;
  }

  const memoizedSelector = (state: TState, ...args: TArgs): TResult => {
    const key = generateKey(state, args);
    const cached = cache.get(key);

    // Check if we have a cached result with matching inputs
    if (cached) {
      const [cachedState, ...cachedArgs] = cached.inputs;

      if (
        equalityFn(state, cachedState) &&
        args.length === cachedArgs.length &&
        args.every((arg, index) => equalityFn(arg, cachedArgs[index]))
      ) {
        metrics.hits++;
        updateMetrics();
        return cached.result;
      }
    }

    // Compute new result
    const result = selector(state, ...args);
    metrics.misses++;

    // Manage cache size
    if (cache.size >= maxSize) {
      // Remove oldest entry
      const entries = Array.from(cache.entries());
      const oldest = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) {
        cache.delete(oldest[0]);
      }
    }

    // Cache the result
    cache.set(key, {
      result,
      inputs: [state, ...args],
      timestamp: Date.now(),
    });

    updateMetrics();
    return result;
  };

  // Add utility methods
  (memoizedSelector as unknown as { clearCache: () => void }).clearCache = () => {
    cache.clear();
    metrics.invalidations++;
    updateMetrics();
  };

  (memoizedSelector as unknown as { getMetrics: () => MemoizationMetrics }).getMetrics = () => ({
    ...metrics,
  });

  return memoizedSelector;
}

/**
 * Creates a reselect-style selector with multiple input selectors
 */
export function createSelector<TState, TInputs extends unknown[], TResult>(
  inputSelectors: {
    [K in keyof TInputs]: (state: TState) => TInputs[K];
  },
  resultSelector: (...inputs: TInputs) => TResult,
  options?: SelectorMemoOptions
): (state: TState) => TResult {
  const memoizedResultSelector = createMemoizedSelector(
    (_: TState, ...inputs: TInputs) => resultSelector(...inputs),
    options
  );

  return (state: TState): TResult => {
    const inputs = inputSelectors.map(selector => selector(state)) as TInputs;
    return memoizedResultSelector(state, ...inputs);
  };
}

// =============================================================================
// React Component Memoization
// =============================================================================

/**
 * Enhanced React.memo with debugging and custom comparison
 */
export function memoizeComponent<TProps extends object>(
  Component: React.ComponentType<TProps>,
  options: ComponentMemoOptions = {}
): React.MemoExoticComponent<React.ComponentType<TProps>> {
  const { areEqual, debug = false, displayName } = options;

  const MemoizedComponent = React.memo(Component, (prevProps, nextProps) => {
    let isEqual = true;

    if (areEqual) {
      isEqual = areEqual(prevProps, nextProps);
    } else {
      // Default shallow comparison
      const prevKeys = Object.keys(prevProps);
      const nextKeys = Object.keys(nextProps);

      if (prevKeys.length !== nextKeys.length) {
        isEqual = false;
      } else {
        isEqual = prevKeys.every(key =>
          Object.is(
            (prevProps as Record<string, unknown>)[key],
            (nextProps as Record<string, unknown>)[key]
          )
        );
      }
    }

    if (debug) {
      const componentName = displayName || Component.displayName || Component.name || 'Component';
      if (isEqual) {
        console.log(`[Memo] ${componentName}: Props equal, skipping render`);
      } else {
        console.log(`[Memo] ${componentName}: Props changed, re-rendering`);

        // Log changed props
        const changedProps = Object.keys(nextProps).filter(
          key =>
            !Object.is(
              (prevProps as Record<string, unknown>)[key],
              (nextProps as Record<string, unknown>)[key]
            )
        );
        if (changedProps.length > 0) {
          console.log(`[Memo] ${componentName}: Changed props:`, changedProps);
        }
      }
    }

    return isEqual;
  });

  if (displayName) {
    MemoizedComponent.displayName = `Memo(${displayName})`;
  }

  return MemoizedComponent;
}

/**
 * Hook for memoizing expensive computations with dependency tracking
 */
export function useStableMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options: { debug?: boolean; name?: string } = {}
): T {
  const { debug = false, name = 'useStableMemo' } = options;
  const previousDeps = useRef<React.DependencyList>(undefined);
  const previousResult = useRef<T>(undefined);

  return useMemo(() => {
    if (debug) {
      const depsChanged =
        !previousDeps.current ||
        deps.some((dep, index) => !Object.is(dep, previousDeps.current![index]));

      if (depsChanged) {
        console.log(`[${name}] Dependencies changed, recomputing`);
      } else {
        console.log(`[${name}] Dependencies unchanged, using cached result`);
      }
    }

    previousDeps.current = deps;
    const result = factory();
    previousResult.current = result;
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook for memoizing callback functions with stable references
 */
export function useStableCallback<TArgs extends unknown[], TReturn>(
  callback: (...args: TArgs) => TReturn,
  deps: React.DependencyList,
  options: { debug?: boolean; name?: string } = {}
): (...args: TArgs) => TReturn {
  const { debug = false, name = 'useStableCallback' } = options;

  return useCallback((...args: TArgs) => {
    if (debug) {
      console.log(`[${name}] Callback invoked with args:`, args);
    }
    return callback(...args);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// =============================================================================
// Cache-Aware Memoization
// =============================================================================

/**
 * Creates a memoized function that invalidates based on Apollo cache changes
 */
export function createCacheAwareMemo<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options: CacheAwareMemoOptions = {}
): (...args: TArgs) => TResult {
  const { cache, watchKeys = [], shouldInvalidate } = options;

  let cachedResult: TResult | undefined;
  let cachedArgs: TArgs | undefined;

  // Set up cache invalidation if Apollo cache is provided
  if (cache) {
    const originalEvict = cache.evict.bind(cache);
    cache.evict = (options: unknown) => {
      const result = originalEvict(options);

      // Check if we should invalidate
      const shouldInvalidateResult = shouldInvalidate
        ? shouldInvalidate(options)
        : watchKeys.length === 0 ||
          (options &&
            typeof options === 'object' &&
            'id' in options &&
            typeof (options as { id?: string }).id === 'string' &&
            watchKeys.some(key => (options as { id: string }).id.includes(key)));

      if (shouldInvalidateResult) {
        cachedResult = undefined;
        cachedArgs = undefined;
        // Cache version tracking for debugging
        if (process.env.NODE_ENV === 'development') {
          console.debug('Cache invalidated');
        }
      }

      return result;
    };
  }

  return (...args: TArgs): TResult => {
    // Check if we have a cached result with matching args
    if (
      cachedResult !== undefined &&
      cachedArgs &&
      args.length === cachedArgs.length &&
      args.every((arg, index) => Object.is(arg, cachedArgs![index]))
    ) {
      return cachedResult;
    }

    // Compute new result
    const result = fn(...args);
    cachedResult = result;
    cachedArgs = args;

    return result;
  };
}

/**
 * Hook for cache-aware memoization in React components
 */
export function useCacheAwareMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  cacheOptions: CacheAwareMemoOptions = {}
): T {
  const { cache, watchKeys = [] } = cacheOptions;
  const [cacheVersion, setCacheVersion] = React.useState(0);

  // Set up cache invalidation listener
  useEffect(() => {
    if (!cache) return;

    const originalEvict = cache.evict.bind(cache);
    cache.evict = (options: unknown) => {
      const result = originalEvict(options);

      const shouldInvalidate =
        watchKeys.length === 0 ||
        (options &&
          typeof options === 'object' &&
          'id' in options &&
          typeof (options as { id?: string }).id === 'string' &&
          watchKeys.some(key => (options as { id: string }).id.includes(key)));

      if (shouldInvalidate) {
        setCacheVersion(prev => prev + 1);
      }

      return result;
    };

    return () => {
      // Restore original evict method
      cache.evict = originalEvict;
    };
  }, [cache, watchKeys]);

  // Include cache version in dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(), [...deps, cacheVersion]);
}

// =============================================================================
// Performance Monitoring
// =============================================================================

/**
 * Tracks memoization performance across the application
 */
export class MemoizationMonitor {
  private static instance: MemoizationMonitor;
  private selectors = new Map<string, MemoizationMetrics>();
  private components = new Map<string, { renders: number; memoHits: number }>();

  static getInstance(): MemoizationMonitor {
    if (!MemoizationMonitor.instance) {
      MemoizationMonitor.instance = new MemoizationMonitor();
    }
    return MemoizationMonitor.instance;
  }

  registerSelector(name: string, metrics: MemoizationMetrics): void {
    this.selectors.set(name, metrics);
  }

  registerComponent(name: string, renderCount: number, memoHits: number): void {
    this.components.set(name, { renders: renderCount, memoHits });
  }

  getReport(): {
    selectors: Record<string, MemoizationMetrics>;
    components: Record<string, { renders: number; memoHits: number; memoRate: number }>;
    summary: {
      totalSelectors: number;
      averageHitRate: number;
      totalComponents: number;
      averageMemoRate: number;
    };
  } {
    const selectorsReport = Object.fromEntries(this.selectors.entries());

    const componentsReport = Object.fromEntries(
      Array.from(this.components.entries()).map(([name, data]) => [
        name,
        {
          ...data,
          memoRate: data.memoHits / (data.renders + data.memoHits) || 0,
        },
      ])
    );

    const averageHitRate =
      Array.from(this.selectors.values()).reduce((sum, metrics) => sum + metrics.hitRate, 0) /
        this.selectors.size || 0;

    const averageMemoRate =
      Array.from(this.components.values()).reduce(
        (sum, data) => sum + (data.memoHits / (data.renders + data.memoHits) || 0),
        0
      ) / this.components.size || 0;

    return {
      selectors: selectorsReport,
      components: componentsReport,
      summary: {
        totalSelectors: this.selectors.size,
        averageHitRate,
        totalComponents: this.components.size,
        averageMemoRate,
      },
    };
  }

  clear(): void {
    this.selectors.clear();
    this.components.clear();
  }
}

// =============================================================================
// Exports
// =============================================================================

export const MemoizationUtils = {
  createMemoizedSelector,
  createSelector,
  memoizeComponent,
  useStableMemo,
  useStableCallback,
  createCacheAwareMemo,
  useCacheAwareMemo,
  MemoizationMonitor,
};
