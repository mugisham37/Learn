/**
 * Performance Optimization Utilities
 * 
 * Utilities for memoization, debouncing, throttling, and performance monitoring
 * to optimize expensive operations and improve user experience.
 * 
 * Requirements: 12.2
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface MemoizeOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (...args: unknown[]) => string;
}

export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage?: number;
  timestamp: number;
  operation: string;
}

// =============================================================================
// Memoization
// =============================================================================

/**
 * Creates a memoized version of a function with configurable cache size and TTL
 */
export function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: MemoizeOptions = {}
): (...args: TArgs) => TReturn {
  const {
    maxSize = 100,
    ttl,
    keyGenerator = (...args) => JSON.stringify(args)
  } = options;

  const cache = new Map<string, { value: TReturn; timestamp: number }>();

  return (...args: TArgs): TReturn => {
    const key = keyGenerator(...args);
    const now = Date.now();

    // Check if cached value exists and is still valid
    const cached = cache.get(key);
    if (cached) {
      if (!ttl || (now - cached.timestamp) < ttl) {
        return cached.value;
      } else {
        cache.delete(key);
      }
    }

    // Compute new value
    const value = fn(...args);

    // Manage cache size
    if (cache.size >= maxSize) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    // Store new value
    cache.set(key, { value, timestamp: now });

    return value;
  };
}

/**
 * Creates a memoized async function
 */
export function memoizeAsync<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: MemoizeOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  const {
    maxSize = 100,
    ttl,
    keyGenerator = (...args) => JSON.stringify(args)
  } = options;

  const cache = new Map<string, { promise: Promise<TReturn>; timestamp: number }>();

  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyGenerator(...args);
    const now = Date.now();

    // Check if cached promise exists and is still valid
    const cached = cache.get(key);
    if (cached) {
      if (!ttl || (now - cached.timestamp) < ttl) {
        return cached.promise;
      } else {
        cache.delete(key);
      }
    }

    // Create new promise
    const promise = fn(...args);

    // Manage cache size
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    // Store promise
    cache.set(key, { promise, timestamp: now });

    return promise;
  };
}

/**
 * Clears all memoization caches (useful for testing)
 */
export function clearMemoizationCaches(): void {
  // This is a placeholder - in a real implementation, we'd track all memoized functions
  // For now, individual memoized functions manage their own caches
}

// =============================================================================
// Debouncing
// =============================================================================

/**
 * Creates a debounced version of a function
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number,
  options: DebounceOptions = {}
): (...args: TArgs) => void {
  const { leading = false, trailing = true, maxWait } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let maxTimeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;

  function invokeFunc(args: TArgs): void {
    lastInvokeTime = Date.now();
    fn(...args);
  }

  function leadingEdge(args: TArgs): void {
    lastInvokeTime = Date.now();
    if (leading) {
      invokeFunc(args);
    }
  }

  function remainingWait(time: number): number {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = delay - timeSinceLastCall;

    return maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= delay ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired(args: TArgs): void {
    const time = Date.now();
    if (shouldInvoke(time)) {
      if (trailing) {
        invokeFunc(args);
      }
      timeoutId = null;
      maxTimeoutId = null;
    } else {
      const remaining = remainingWait(time);
      timeoutId = setTimeout(() => timerExpired(args), remaining);
    }
  }

  return (...args: TArgs): void => {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastCallTime = time;

    if (isInvoking) {
      if (timeoutId === null) {
        leadingEdge(args);
      }
      if (maxWait !== undefined && maxTimeoutId === null) {
        maxTimeoutId = setTimeout(() => {
          if (trailing) {
            invokeFunc(args);
          }
          maxTimeoutId = null;
        }, maxWait);
      }
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => timerExpired(args), delay);
  };
}

// =============================================================================
// Throttling
// =============================================================================

/**
 * Creates a throttled version of a function
 */
export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number,
  options: ThrottleOptions = {}
): (...args: TArgs) => void {
  const { leading = true, trailing = true } = options;

  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastArgs: TArgs | null = null;

  function invokeFunc(args: TArgs): void {
    lastCallTime = Date.now();
    fn(...args);
  }

  return (...args: TArgs): void => {
    const now = Date.now();
    lastArgs = args;

    if (lastCallTime === 0 && leading) {
      invokeFunc(args);
      return;
    }

    const remaining = delay - (now - lastCallTime);

    if (remaining <= 0) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      invokeFunc(args);
    } else if (timeoutId === null && trailing) {
      timeoutId = setTimeout(() => {
        if (lastArgs && trailing) {
          invokeFunc(lastArgs);
        }
        timeoutId = null;
      }, remaining);
    }
  };
}

// =============================================================================
// Request Deduplication
// =============================================================================

/**
 * Creates a request deduplication utility
 */
export function createRequestDeduplicator<TArgs extends unknown[], TReturn>(
  requestFn: (...args: TArgs) => Promise<TReturn>,
  keyGenerator: (...args: TArgs) => string = (...args) => JSON.stringify(args)
): (...args: TArgs) => Promise<TReturn> {
  const pendingRequests = new Map<string, Promise<TReturn>>();

  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyGenerator(...args);

    // Return existing promise if request is already pending
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key)!;
    }

    // Create new request
    const promise = requestFn(...args);

    // Store pending request
    pendingRequests.set(key, promise);

    // Clean up when request completes
    promise.finally(() => {
      pendingRequests.delete(key);
    });

    return promise;
  };
}

// =============================================================================
// Performance Monitoring
// =============================================================================

/**
 * Measures execution time of a function
 */
export function measurePerformance<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  operationName: string
): (...args: TArgs) => TReturn {
  return (...args: TArgs): TReturn => {
    const startTime = performance.now();
    const startMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;

    const result = fn(...args);

    const endTime = performance.now();
    const endMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;

    const metrics: PerformanceMetrics = {
      executionTime: endTime - startTime,
      timestamp: Date.now(),
      operation: operationName,
      ...(endMemory && startMemory ? { memoryUsage: endMemory - startMemory } : {}),
    };

    // Log performance metrics (in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance [${operationName}]:`, metrics);
    }

    return result;
  };
}

/**
 * Measures execution time of an async function
 */
export function measureAsyncPerformance<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  operationName: string
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const startTime = performance.now();
    const startMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;

    const result = await fn(...args);

    const endTime = performance.now();
    const endMemory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;

    const metrics: PerformanceMetrics = {
      executionTime: endTime - startTime,
      timestamp: Date.now(),
      operation: operationName,
      ...(endMemory && startMemory ? { memoryUsage: endMemory - startMemory } : {}),
    };

    // Log performance metrics (in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance [${operationName}]:`, metrics);
    }

    return result;
  };
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Creates a batch processor that collects items and processes them in batches
 */
export function createBatchProcessor<TItem, TResult>(
  processFn: (items: TItem[]) => Promise<TResult[]>,
  options: {
    batchSize?: number;
    delay?: number;
    maxWait?: number;
  } = {}
): (item: TItem) => Promise<TResult> {
  const { batchSize = 10, delay = 100, maxWait = 1000 } = options;

  let batch: Array<{ item: TItem; resolve: (result: TResult) => void; reject: (error: Error) => void }> = [];
  let timeoutId: NodeJS.Timeout | null = null;
  let maxWaitTimeoutId: NodeJS.Timeout | null = null;

  async function processBatch(): Promise<void> {
    if (batch.length === 0) return;

    const currentBatch = batch;
    batch = [];

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (maxWaitTimeoutId) {
      clearTimeout(maxWaitTimeoutId);
      maxWaitTimeoutId = null;
    }

    try {
      const items = currentBatch.map(({ item }) => item);
      const results = await processFn(items);

      currentBatch.forEach(({ resolve }, index) => {
        const result = results[index];
        if (result !== undefined) {
          resolve(result);
        }
      });
    } catch (error) {
      currentBatch.forEach(({ reject }) => {
        reject(error as Error);
      });
    }
  }

  return (item: TItem): Promise<TResult> => {
    return new Promise((resolve, reject) => {
      batch.push({ item, resolve, reject });

      // Process immediately if batch is full
      if (batch.length >= batchSize) {
        processBatch();
        return;
      }

      // Set up delay timeout if not already set
      if (timeoutId === null) {
        timeoutId = setTimeout(processBatch, delay);
      }

      // Set up max wait timeout if not already set
      if (maxWaitTimeoutId === null) {
        maxWaitTimeoutId = setTimeout(processBatch, maxWait);
      }
    });
  };
}

// =============================================================================
// Exports
// =============================================================================

export const PerformanceUtils = {
  memoize,
  memoizeAsync,
  clearMemoizationCaches,
  debounce,
  throttle,
  createRequestDeduplicator,
  measurePerformance,
  measureAsyncPerformance,
  createBatchProcessor,
};

// Re-export enhanced utilities
export { GraphQLDeduplicationUtils } from '../graphql/deduplication';
export { MemoizationUtils } from './memoization';
export { LazyLoadingUtils } from './lazyLoading';
export { CacheOptimizationUtils } from '../cache/optimization';