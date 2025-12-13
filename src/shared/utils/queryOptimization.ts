/**
 * Database Query Optimization Utilities
 *
 * Provides tools for analyzing and optimizing database queries
 * Implements EXPLAIN ANALYZE functionality and performance monitoring
 *
 * Requirements: 15.1 - Database query optimization with strategic indexes
 */

import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { logger } from './logger.js';

/**
 * Query Performance Analysis Result
 */
export interface QueryAnalysis {
  query: string;
  executionTime: number;
  planningTime: number;
  totalCost: number;
  actualRows: number;
  estimatedRows: number;
  indexesUsed: string[];
  recommendations: string[];
  needsOptimization: boolean;
}

/**
 * Query Performance Thresholds
 */
const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 100,
  VERY_SLOW_QUERY_MS: 500,
  HIGH_COST: 1000,
  ROW_ESTIMATION_VARIANCE: 0.5, // 50% variance threshold
} as const;

/**
 * Query plan node interface
 */
interface QueryPlanNode {
  'Node Type': string;
  'Startup Cost': number;
  'Total Cost': number;
  'Plan Rows': number;
  'Plan Width': number;
  'Actual Startup Time': number;
  'Actual Total Time': number;
  'Actual Rows': number;
  'Actual Loops': number;
  'Index Name'?: string;
  'Relation Name'?: string;
  Plans?: QueryPlanNode[];
}

/**
 * Cursor pagination options
 */
export interface CursorPaginationOptions {
  cursor?: string;
  limit: number;
  orderBy: string;
  direction?: 'asc' | 'desc';
}

/**
 * Cursor pagination result
 */
export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Query Optimization Analyzer
 *
 * Analyzes database queries using EXPLAIN ANALYZE and provides
 * optimization recommendations
 */
export class QueryOptimizer {
  constructor(private db: NodePgDatabase<Record<string, never>>) {}

  /**
   * Analyze query performance using EXPLAIN ANALYZE
   */
  async analyzeQuery(query: string, params: unknown[] = []): Promise<QueryAnalysis> {
    try {
      const startTime = Date.now();

      // Execute EXPLAIN ANALYZE
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await this.db.execute(sql.raw(explainQuery));

      const executionTime = Date.now() - startTime;
      const planData = result.rows[0] as { 'QUERY PLAN': QueryPlanNode[] };
      const plan = planData['QUERY PLAN'][0];

      return this.parseQueryPlan(query, plan || {}, executionTime);
    } catch (error) {
      logger.error('Query analysis failed', { query, error });
      throw error;
    }
  }

  /**
   * Parse query execution plan
   */
  private parseQueryPlan(query: string, plan: QueryPlanNode, executionTime: number): QueryAnalysis {
    const indexesUsed = this.extractIndexesUsed(plan);
    const recommendations = this.generateRecommendations(plan, executionTime);

    return {
      query,
      executionTime,
      planningTime: plan['Actual Startup Time'] || 0,
      totalCost: plan['Total Cost'] || 0,
      actualRows: plan['Actual Rows'] || 0,
      estimatedRows: plan['Plan Rows'] || 0,
      indexesUsed,
      recommendations,
      needsOptimization: this.needsOptimization(plan, executionTime),
    };
  }

  /**
   * Extract indexes used in query plan
   */
  private extractIndexesUsed(plan: QueryPlanNode): string[] {
    const indexes: string[] = [];

    const extractFromNode = (node: QueryPlanNode): void => {
      if (node['Index Name']) {
        indexes.push(node['Index Name']);
      }

      if (node.Plans) {
        node.Plans.forEach(extractFromNode);
      }
    };

    extractFromNode(plan);
    return [...new Set(indexes)];
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(plan: QueryPlanNode, executionTime: number): string[] {
    const recommendations: string[] = [];

    if (executionTime > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      recommendations.push('Query execution time exceeds threshold - consider optimization');
    }

    if (plan['Total Cost'] > PERFORMANCE_THRESHOLDS.HIGH_COST) {
      recommendations.push('High query cost detected - review query structure');
    }

    const estimationVariance =
      Math.abs(plan['Actual Rows'] - plan['Plan Rows']) / plan['Plan Rows'];
    if (estimationVariance > PERFORMANCE_THRESHOLDS.ROW_ESTIMATION_VARIANCE) {
      recommendations.push('Row estimation variance high - update table statistics');
    }

    if (this.hasSequentialScans(plan)) {
      recommendations.push('Sequential scans detected - consider adding indexes');
    }

    return recommendations;
  }

  /**
   * Check if query needs optimization
   */
  private needsOptimization(plan: QueryPlanNode, executionTime: number): boolean {
    return (
      executionTime > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS ||
      plan['Total Cost'] > PERFORMANCE_THRESHOLDS.HIGH_COST ||
      this.hasSequentialScans(plan)
    );
  }

  /**
   * Check for sequential scans in query plan
   */
  private hasSequentialScans(plan: QueryPlanNode): boolean {
    if (plan['Node Type'] === 'Seq Scan') {
      return true;
    }

    if (plan.Plans) {
      return plan.Plans.some((subPlan) => this.hasSequentialScans(subPlan));
    }

    return false;
  }
}

/**
 * Query Cache Implementation
 */
export class QueryCache {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  private readonly defaultTTL = 300000; // 5 minutes

  /**
   * Get cached result
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached result
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}
