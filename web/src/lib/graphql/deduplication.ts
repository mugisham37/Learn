/**
 * GraphQL Request Deduplication
 *
 * Utilities for deduplicating GraphQL requests.
 */

import { Observable } from '@apollo/client';
import type { FetchResult } from '@apollo/client';

export interface DeduplicationConfig {
  ttl?: number;
  enableBatching?: boolean;
  maxCacheSize?: number;
}

export class GraphQLRequestDeduplicator {
  private cache = new Map<string, Observable<FetchResult>>();
  private config: Required<DeduplicationConfig>;

  constructor(config: DeduplicationConfig = {}) {
    this.config = {
      ttl: 30000,
      enableBatching: true,
      maxCacheSize: 200,
      ...config,
    };
  }

  deduplicate(
    operation: any,
    forward: (operation: any) => Observable<FetchResult>
  ): Observable<FetchResult> | null {
    // Simple deduplication logic
    const key = this.getOperationKey(operation);
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const observable = forward(operation);
    this.cache.set(key, observable);

    // Clean up after TTL
    setTimeout(() => {
      this.cache.delete(key);
    }, this.config.ttl);

    return observable;
  }

  private getOperationKey(operation: any): string {
    return `${operation.operationName || 'anonymous'}-${JSON.stringify(operation.variables || {})}`;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const GraphQLDeduplicationUtils = {
  GraphQLRequestDeduplicator,
};