/**
 * GraphQL Request Deduplication
 *
 * Utilities for deduplicating GraphQL requests.
 */

import { Observable, ApolloLink, FetchResult } from '@apollo/client';
import type { Operation } from '@apollo/client/core';

export interface DeduplicationConfig {
  ttl?: number;
  enableBatching?: boolean;
  maxCacheSize?: number;
}

export interface DeduplicationMetrics {
  totalRequests: number;
  deduplicatedRequests: number;
  cacheHits: number;
  hitRate: number;
}

export class GraphQLRequestDeduplicator {
  private cache = new Map<string, Observable<FetchResult>>();
  private config: Required<DeduplicationConfig>;
  private metrics: DeduplicationMetrics = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    cacheHits: 0,
    hitRate: 0,
  };

  constructor(config: DeduplicationConfig = {}) {
    this.config = {
      ttl: 30000,
      enableBatching: true,
      maxCacheSize: 200,
      ...config,
    };
  }

  deduplicate(
    operation: Operation,
    forward: (operation: Operation) => Observable<FetchResult>
  ): Observable<FetchResult> | null {
    this.metrics.totalRequests++;
    
    // Simple deduplication logic
    const key = this.getOperationKey(operation);
    
    if (this.cache.has(key)) {
      this.metrics.cacheHits++;
      this.metrics.deduplicatedRequests++;
      this.updateHitRate();
      return this.cache.get(key)!;
    }

    const observable = forward(operation);
    this.cache.set(key, observable);

    // Clean up after TTL
    setTimeout(() => {
      this.cache.delete(key);
    }, this.config.ttl);

    this.updateHitRate();
    return observable;
  }

  private getOperationKey(operation: Operation): string {
    return `${operation.operationName || 'anonymous'}-${JSON.stringify(operation.variables || {})}`;
  }

  private updateHitRate(): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? this.metrics.cacheHits / this.metrics.totalRequests 
      : 0;
  }

  getMetrics(): DeduplicationMetrics {
    return { ...this.metrics };
  }

  clear(): void {
    this.cache.clear();
    this.metrics = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      cacheHits: 0,
      hitRate: 0,
    };
  }
}

export const GraphQLDeduplicationUtils = {
  GraphQLRequestDeduplicator,
  createGraphQLDeduplicationLink: (config?: DeduplicationConfig): ApolloLink => {
    const deduplicator = new GraphQLRequestDeduplicator(config);
    
    return new ApolloLink((operation, forward) => {
      if (!forward) {
        throw new Error('Deduplication link must not be the last link in the chain');
      }
      
      const result = deduplicator.deduplicate(operation, forward);
      return result || forward(operation);
    });
  },
};