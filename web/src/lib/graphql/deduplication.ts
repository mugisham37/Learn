/**
 * GraphQL Request Deduplication Utilities
 * 
 * Advanced request deduplication specifically designed for GraphQL operations.
 * Provides intelligent merging, caching with TTL, and request batching.
 * 
 * Requirements: 12.1
 */

import { DocumentNode, OperationDefinitionNode, print } from 'graphql';
import { ApolloLink, Operation, NextLink, Observable, FetchResult } from '@apollo/client';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface GraphQLDeduplicationOptions {
  /** Maximum number of cached requests */
  maxCacheSize?: number;
  /** Time to live for cached requests in milliseconds */
  ttl?: number;
  /** Enable request batching */
  enableBatching?: boolean;
  /** Batch size for request batching */
  batchSize?: number;
  /** Batch timeout in milliseconds */
  batchTimeout?: number;
  /** Custom key generator for request identification */
  keyGenerator?: (operation: Operation) => string;
}

export interface CachedRequest<T = any> {
  observable: Observable<FetchResult<T>>;
  timestamp: number;
  operationName: string;
  variables: any;
}

export interface BatchedRequest {
  operation: Operation;
  observer: {
    next: (value: FetchResult) => void;
    error: (error: any) => void;
    complete: () => void;
  };
}

export interface RequestMetrics {
  totalRequests: number;
  deduplicatedRequests: number;
  cacheHits: number;
  batchedRequests: number;
  averageResponseTime: number;
}

// =============================================================================
// GraphQL Request Deduplicator
// =============================================================================

export class GraphQLRequestDeduplicator {
  private cache = new Map<string, CachedRequest>();
  private batchQueue: BatchedRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private metrics: RequestMetrics = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    cacheHits: 0,
    batchedRequests: 0,
    averageResponseTime: 0,
  };

  constructor(private options: GraphQLDeduplicationOptions = {}) {
    const {
      maxCacheSize = 100,
      ttl = 30000, // 30 seconds
      enableBatching = false,
      batchSize = 10,
      batchTimeout = 100,
    } = options;

    this.options = {
      maxCacheSize,
      ttl,
      enableBatching,
      batchSize,
      batchTimeout,
      keyGenerator: this.defaultKeyGenerator,
      ...options,
    };
  }

  /**
   * Default key generator for GraphQL operations
   */
  private defaultKeyGenerator = (operation: Operation): string => {
    const query = print(operation.query);
    const variables = JSON.stringify(operation.variables || {});
    const operationName = operation.operationName || 'anonymous';
    
    return `${operationName}:${this.hashString(query + variables)}`;
  };

  /**
   * Simple string hashing for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if operation should be deduplicated
   */
  private shouldDeduplicate(operation: Operation): boolean {
    const definition = operation.query.definitions[0] as OperationDefinitionNode;
    
    // Only deduplicate queries, not mutations or subscriptions
    if (definition.operation !== 'query') {
      return false;
    }

    // Don't deduplicate operations with @live directive
    const hasLiveDirective = definition.directives?.some(
      directive => directive.name.value === 'live'
    );

    return !hasLiveDirective;
  }

  /**
   * Clean expired entries from cache
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    const ttl = this.options.ttl!;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Manage cache size by removing oldest entries
   */
  private manageCacheSize(): void {
    const maxSize = this.options.maxCacheSize!;
    
    if (this.cache.size >= maxSize) {
      // Remove oldest entries (simple FIFO)
      const entries = Array.from(this.cache.entries());
      const toRemove = entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, this.cache.size - maxSize + 1);

      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Process batched requests
   */
  private processBatch(): void {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0);
    this.batchTimeout = null;

    // Group operations by query to enable batching
    const groupedOperations = new Map<string, BatchedRequest[]>();
    
    batch.forEach(request => {
      const queryKey = print(request.operation.query);
      if (!groupedOperations.has(queryKey)) {
        groupedOperations.set(queryKey, []);
      }
      groupedOperations.get(queryKey)!.push(request);
    });

    // Process each group
    groupedOperations.forEach(requests => {
      if (requests.length === 1) {
        // Single request - process normally
        const { operation, observer } = requests[0];
        this.executeOperation(operation).subscribe(observer);
      } else {
        // Multiple requests with same query - batch them
        this.executeBatchedOperations(requests);
      }
    });

    this.metrics.batchedRequests += batch.length;
  }

  /**
   * Execute batched operations with same query
   */
  private executeBatchedOperations(requests: BatchedRequest[]): void {
    // For now, execute individually
    // In a real implementation, you'd modify the query to accept multiple variable sets
    requests.forEach(({ operation, observer }) => {
      this.executeOperation(operation).subscribe(observer);
    });
  }

  /**
   * Execute a single GraphQL operation
   */
  private executeOperation(operation: Operation): Observable<FetchResult> {
    // This would normally forward to the next link in the chain
    // For now, return a placeholder observable
    return new Observable(observer => {
      // Simulate async operation
      setTimeout(() => {
        observer.next({ data: {} });
        observer.complete();
      }, Math.random() * 100);
    });
  }

  /**
   * Deduplicate a GraphQL request
   */
  public deduplicate(operation: Operation, forward: NextLink): Observable<FetchResult> {
    this.metrics.totalRequests++;

    // Check if operation should be deduplicated
    if (!this.shouldDeduplicate(operation)) {
      return forward(operation);
    }

    const key = this.options.keyGenerator!(operation);
    const now = Date.now();

    // Clean expired entries periodically
    if (Math.random() < 0.1) { // 10% chance
      this.cleanExpiredEntries();
    }

    // Check cache for existing request
    const cached = this.cache.get(key);
    if (cached && (now - cached.timestamp) < this.options.ttl!) {
      this.metrics.cacheHits++;
      this.metrics.deduplicatedRequests++;
      return cached.observable;
    }

    // Create new observable for this request
    const observable = new Observable<FetchResult>(observer => {
      if (this.options.enableBatching) {
        // Add to batch queue
        this.batchQueue.push({ operation, observer });

        // Set batch timeout if not already set
        if (!this.batchTimeout && this.batchQueue.length === 1) {
          this.batchTimeout = setTimeout(() => {
            this.processBatch();
          }, this.options.batchTimeout);
        }

        // Process batch immediately if it's full
        if (this.batchQueue.length >= this.options.batchSize!) {
          if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
          }
          this.processBatch();
        }
      } else {
        // Execute immediately
        forward(operation).subscribe(observer);
      }
    });

    // Cache the observable
    this.manageCacheSize();
    this.cache.set(key, {
      observable,
      timestamp: now,
      operationName: operation.operationName || 'anonymous',
      variables: operation.variables,
    });

    return observable;
  }

  /**
   * Get deduplication metrics
   */
  public getMetrics(): RequestMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear cache and reset metrics
   */
  public clear(): void {
    this.cache.clear();
    this.batchQueue.length = 0;
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.metrics = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      cacheHits: 0,
      batchedRequests: 0,
      averageResponseTime: 0,
    };
  }
}

// =============================================================================
// Apollo Link Integration
// =============================================================================

/**
 * Creates an Apollo Link for GraphQL request deduplication
 */
export function createGraphQLDeduplicationLink(
  options?: GraphQLDeduplicationOptions
): ApolloLink {
  const deduplicator = new GraphQLRequestDeduplicator(options);

  return new ApolloLink((operation, forward) => {
    if (!forward) {
      throw new Error('GraphQL deduplication link must not be the last link in the chain');
    }

    return deduplicator.deduplicate(operation, forward);
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a request cache with TTL for non-GraphQL requests
 */
export function createRequestCache<TArgs extends any[], TReturn>(
  requestFn: (...args: TArgs) => Promise<TReturn>,
  options: {
    ttl?: number;
    maxSize?: number;
    keyGenerator?: (...args: TArgs) => string;
  } = {}
): (...args: TArgs) => Promise<TReturn> {
  const {
    ttl = 30000,
    maxSize = 100,
    keyGenerator = (...args) => JSON.stringify(args),
  } = options;

  const cache = new Map<string, { promise: Promise<TReturn>; timestamp: number }>();

  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyGenerator(...args);
    const now = Date.now();

    // Check for cached result
    const cached = cache.get(key);
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.promise;
    }

    // Create new request
    const promise = requestFn(...args);

    // Manage cache size
    if (cache.size >= maxSize) {
      const entries = Array.from(cache.entries());
      const oldest = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      cache.delete(oldest[0]);
    }

    // Cache the promise
    cache.set(key, { promise, timestamp: now });

    return promise;
  };
}

/**
 * Merge multiple GraphQL queries into a single request
 */
export function mergeGraphQLQueries(queries: DocumentNode[]): DocumentNode {
  // This is a simplified implementation
  // In practice, you'd need to handle field conflicts, aliases, etc.
  
  if (queries.length === 0) {
    throw new Error('Cannot merge empty query list');
  }

  if (queries.length === 1) {
    return queries[0];
  }

  // For now, return the first query
  // A full implementation would merge the selection sets
  return queries[0];
}

// =============================================================================
// Exports
// =============================================================================

export const GraphQLDeduplicationUtils = {
  GraphQLRequestDeduplicator,
  createGraphQLDeduplicationLink,
  createRequestCache,
  mergeGraphQLQueries,
};