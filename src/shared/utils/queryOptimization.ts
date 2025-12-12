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

import { logger } from './logger';

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
 * Query Optimization Analyzer
 * 
 * Analyzes database queries using EXPLAIN ANALYZE and provides
 * optimization recommendations
 */
/**
 * Query plan node interface
 */
interface QueryPlanNode {
  'Node Type': string;
  'Total Cost'?: number;
  'Actual Rows'?: number;
  'Plan Rows'?: number;
  'Index Name'?: string;
  Plans?: QueryPlanNode[];
}

/**
 * Query plan result interface
 */
interface QueryPlanResult {
  'QUERY PLAN': Array<{
    Plan: QueryPlanNode;
    'Execution Time': number;
    'Planning Time': number;
  }>;
}

export class QueryOptimizer {
  constructor(private db: NodePgDatabase<Record<string, never>>) {}

  /**
   * Analyze query performance using EXPLAIN ANALYZE
   */
  async analyzeQuery(query: string, _params: unknown[] = []): Promise<QueryAnalysis> {
    try {
      // Execute EXPLAIN ANALYZE
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await this.db.execute(sql.raw(explainQuery)) as unknown as QueryPlanResult[];
      
      const planData = result[0]?.['QUERY PLAN']?.[0];
      if (!planData) {
        throw new Error('Failed to get query plan');
      }

      // Extract performance metrics
      const executionTime = planData['Execution Time'] || 0;
      const planningTime = planData['Planning Time'] || 0;
      const totalCost = planData.Plan?.['Total Cost'] || 0;
      const actualRows = planData.Plan?.['Actual Rows'] || 0;
      const estimatedRows = planData.Plan?.['Plan Rows'] || 0;

      // Extract indexes used
      const indexesUsed = this.extractIndexesFromPlan(planData.Plan);

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        executionTime,
        planningTime,
        totalCost,
        actualRows,
        estimatedRows,
        indexesUsed,
        plan: planData.Plan,
      });

      const analysis: QueryAnalysis = {
        query,
        executionTime,
        planningTime,
        totalCost,
        actualRows,
        estimatedRows,
        indexesUsed,
        recommendations,
        needsOptimization: this.needsOptimization(executionTime, totalCost, recommendations),
      };

      // Log slow queries
      if (executionTime > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
        logger.warn('Slow query detected', {
          query: query.substring(0, 200),
          executionTime,
          totalCost,
          recommendations: recommendations.slice(0, 3),
        });
      }

      return analysis;
    } catch (error) {
      logger.error('Query analysis failed', { error, query: query.substring(0, 200) });
      throw error;
    }
  }

  /**
   * Extract indexes used from query plan
   */
  private extractIndexesFromPlan(plan: QueryPlanNode): string[] {
    const indexes: string[] = [];
    
    const extractFromNode = (node: QueryPlanNode): void => {
      if (node['Node Type'] === 'Index Scan' || node['Node Type'] === 'Index Only Scan') {
        if (node['Index Name']) {
          indexes.push(node['Index Name']);
        }
      }
      
      if (node.Plans) {
        node.Plans.forEach(extractFromNode);
      }
    };

    extractFromNode(plan);
    return [...new Set(indexes)]; // Remove duplicates
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(metrics: {
    executionTime: number;
    planningTime: number;
    totalCost: number;
    actualRows: number;
    estimatedRows: number;
    indexesUsed: string[];
    plan: QueryPlanNode;
  }): string[] {
    const recommendations: string[] = [];

    // Check execution time
    if (metrics.executionTime > PERFORMANCE_THRESHOLDS.VERY_SLOW_QUERY_MS) {
      recommendations.push('Query execution time is very high - consider adding indexes or rewriting query');
    } else if (metrics.executionTime > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      recommendations.push('Query execution time is elevated - review for optimization opportunities');
    }

    // Check cost
    if (metrics.totalCost > PERFORMANCE_THRESHOLDS.HIGH_COST) {
      recommendations.push('Query cost is high - consider adding strategic indexes');
    }

    // Check row estimation accuracy
    const estimationVariance = Math.abs(metrics.actualRows - metrics.estimatedRows) / Math.max(metrics.estimatedRows, 1);
    if (estimationVariance > PERFORMANCE_THRESHOLDS.ROW_ESTIMATION_VARIANCE && metrics.estimatedRows > 0) {
      recommendations.push('Row estimation is inaccurate - consider updating table statistics');
    }

    // Check for sequential scans
    if (this.hasSequentialScan(metrics.plan)) {
      recommendations.push('Sequential scan detected - consider adding appropriate indexes');
    }

    // Check for nested loops with high cost
    if (this.hasExpensiveNestedLoop(metrics.plan)) {
      recommendations.push('Expensive nested loop detected - consider adding join indexes');
    }

    // Check if no indexes are used
    if (metrics.indexesUsed.length === 0 && metrics.actualRows > 100) {
      recommendations.push('No indexes used for large result set - add appropriate indexes');
    }

    return recommendations;
  }

  /**
   * Check if query plan contains sequential scans
   */
  private hasSequentialScan(plan: QueryPlanNode): boolean {
    const checkNode = (node: QueryPlanNode): boolean => {
      if (node['Node Type'] === 'Seq Scan') {
        return true;
      }
      if (node.Plans) {
        return node.Plans.some(checkNode);
      }
      return false;
    };

    return checkNode(plan);
  }

  /**
   * Check if query plan has expensive nested loops
   */
  private hasExpensiveNestedLoop(plan: QueryPlanNode): boolean {
    const checkNode = (node: QueryPlanNode): boolean => {
      if (node['Node Type'] === 'Nested Loop' && (node['Total Cost'] || 0) > 500) {
        return true;
      }
      if (node.Plans) {
        return node.Plans.some(checkNode);
      }
      return false;
    };

    return checkNode(plan);
  }

  /**
   * Determine if query needs optimization
   */
  private needsOptimization(executionTime: number, totalCost: number, recommendations: string[]): boolean {
    return (
      executionTime > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS ||
      totalCost > PERFORMANCE_THRESHOLDS.HIGH_COST ||
      recommendations.length > 0
    );
  }

  /**
   * Batch analyze multiple queries
   */
  async batchAnalyze(queries: Array<{ query: string; params?: unknown[] }>): Promise<QueryAnalysis[]> {
    const results: QueryAnalysis[] = [];
    
    for (const { query, params = [] } of queries) {
      try {
        const analysis = await this.analyzeQuery(query, params);
        results.push(analysis);
      } catch (error) {
        logger.error('Failed to analyze query in batch', { error, query: query.substring(0, 100) });
      }
    }

    return results;
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport(analyses: QueryAnalysis[]): {
    totalQueries: number;
    slowQueries: number;
    averageExecutionTime: number;
    topRecommendations: string[];
    criticalQueries: QueryAnalysis[];
  } {
    const slowQueries = analyses.filter(a => a.executionTime > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS);
    const averageExecutionTime = analyses.reduce((sum, a) => sum + a.executionTime, 0) / analyses.length;
    
    // Aggregate recommendations
    const recommendationCounts = new Map<string, number>();
    analyses.forEach(a => {
      a.recommendations.forEach(rec => {
        recommendationCounts.set(rec, (recommendationCounts.get(rec) || 0) + 1);
      });
    });

    const topRecommendations = Array.from(recommendationCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([rec]) => rec);

    const criticalQueries = analyses
      .filter(a => a.executionTime > PERFORMANCE_THRESHOLDS.VERY_SLOW_QUERY_MS)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    return {
      totalQueries: analyses.length,
      slowQueries: slowQueries.length,
      averageExecutionTime,
      topRecommendations,
      criticalQueries,
    };
  }
}

/**
 * Query caching utilities for expensive queries
 */
export class QueryCache {
  private cache = new Map<string, { result: unknown; timestamp: number; ttl: number }>();

  /**
   * Get cached query result
   */
  get(key: string): unknown {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached query result
   */
  set(key: string, result: unknown, ttlMs: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  /**
   * Generate cache key from query and parameters
   */
  generateKey(query: string, params: unknown[] = []): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsStr = JSON.stringify(params);
    return `${normalizedQuery}:${paramsStr}`;
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hitRate: number } {
    // This would need hit/miss tracking in a real implementation
    return {
      size: this.cache.size,
      hitRate: 0, // Placeholder
    };
  }
}

/**
 * Cursor-based pagination utilities
 */
export interface CursorPaginationOptions {
  cursor?: string;
  limit: number;
  orderBy: string;
  direction: 'asc' | 'desc';
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Generate cursor from record
 */
export function generateCursor(record: Record<string, unknown>, orderBy: string): string {
  const value = record[orderBy];
  if (value instanceof Date) {
    return Buffer.from(value.toISOString()).toString('base64');
  }
  return Buffer.from(String(value)).toString('base64');
}

/**
 * Parse cursor value
 */
export function parseCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64').toString('utf-8');
  } catch {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Build cursor-based where condition
 */
export function buildCursorCondition(
  cursor: string | undefined,
  orderBy: string,
  direction: 'asc' | 'desc'
): ReturnType<typeof sql> | undefined {
  if (!cursor) return undefined;

  const cursorValue = parseCursor(cursor);
  
  // This would need to be implemented with proper Drizzle operators
  // based on the specific column type and direction
  return direction === 'asc' 
    ? sql`${sql.identifier(orderBy)} > ${cursorValue}`
    : sql`${sql.identifier(orderBy)} < ${cursorValue}`;
}