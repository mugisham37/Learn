/**
 * GraphQL Field Selection Optimization
 *
 * Implements intelligent field selection to minimize data transfer and improve query performance.
 * Provides automatic field pruning, query optimization, and performance monitoring.
 *
 * Requirements: 11.1
 */

import React from 'react';
import { DocumentNode, FieldNode, visit } from 'graphql';
import { ApolloLink, Observable } from '@apollo/client';
import type { FetchResult } from '@apollo/client';

// =============================================================================
// Types and Interfaces
// =============================================================================

export interface FieldSelectionOptions {
  /** Enable automatic field pruning */
  enablePruning?: boolean;
  /** Maximum query depth allowed */
  maxDepth?: number;
  /** Fields to always include */
  alwaysInclude?: string[];
  /** Fields to always exclude */
  alwaysExclude?: string[];
  /** Enable query complexity analysis */
  enableComplexityAnalysis?: boolean;
  /** Maximum query complexity score */
  maxComplexity?: number;
}

export interface QueryComplexity {
  score: number;
  depth: number;
  fieldCount: number;
  estimatedCost: number;
}

export interface FieldUsageMetrics {
  fieldPath: string;
  usageCount: number;
  lastUsed: Date;
  averageResponseSize: number;
  performanceImpact: number;
}

export interface OptimizationResult {
  originalQuery: DocumentNode;
  optimizedQuery: DocumentNode;
  fieldsRemoved: string[];
  complexityReduction: number;
  estimatedSavings: {
    bandwidth: number;
    responseTime: number;
  };
}

// =============================================================================
// Field Selection Optimizer
// =============================================================================

class FieldSelectionOptimizerClass {
  private fieldUsage = new Map<string, FieldUsageMetrics>();
  private options: Required<FieldSelectionOptions>;

  constructor(options: FieldSelectionOptions = {}) {
    this.options = {
      enablePruning: true,
      maxDepth: 10,
      alwaysInclude: ['id', '__typename'],
      alwaysExclude: [],
      enableComplexityAnalysis: true,
      maxComplexity: 1000,
      ...options,
    };
  }

  /**
   * Optimize a GraphQL query by removing unused fields and reducing complexity
   */
  optimizeQuery(query: DocumentNode, usedFields?: string[]): OptimizationResult {
    const originalComplexity = this.calculateComplexity(query);
    let optimizedQuery = query;
    const fieldsRemoved: string[] = [];

    if (this.options.enablePruning && usedFields) {
      optimizedQuery = this.pruneUnusedFields(query, usedFields);
      fieldsRemoved.push(...this.getFieldDifference(query, optimizedQuery));
    }

    if (this.options.enableComplexityAnalysis) {
      optimizedQuery = this.reduceComplexity(optimizedQuery);
    }

    const optimizedComplexity = this.calculateComplexity(optimizedQuery);
    const complexityReduction = originalComplexity.score - optimizedComplexity.score;

    return {
      originalQuery: query,
      optimizedQuery,
      fieldsRemoved,
      complexityReduction,
      estimatedSavings: {
        bandwidth: complexityReduction * 0.1, // Rough estimate
        responseTime: complexityReduction * 0.05, // Rough estimate
      },
    };
  }

  /**
   * Calculate query complexity score
   */
  calculateComplexity(query: DocumentNode): QueryComplexity {
    let score = 0;
    let depth = 0;
    let fieldCount = 0;
    let currentDepth = 0;

    visit(query, {
      Field: {
        enter: () => {
          fieldCount++;
          score += 1;
          currentDepth++;
          depth = Math.max(depth, currentDepth);
        },
        leave: () => {
          currentDepth--;
        },
      },
      SelectionSet: {
        enter: () => {
          score += 0.5; // Selection sets add complexity
        },
      },
    });

    return {
      score,
      depth,
      fieldCount,
      estimatedCost: score * 10, // Rough cost estimation
    };
  }

  /**
   * Prune unused fields from query
   */
  private pruneUnusedFields(query: DocumentNode, usedFields: string[]): DocumentNode {
    const usedFieldSet = new Set([...usedFields, ...this.options.alwaysInclude]);
    const excludedFieldSet = new Set(this.options.alwaysExclude);

    return visit(query, {
      Field: node => {
        const fieldName = node.name.value;

        // Always exclude certain fields
        if (excludedFieldSet.has(fieldName)) {
          return null;
        }

        // Keep used fields and always-include fields
        if (usedFieldSet.has(fieldName)) {
          return node;
        }

        // Check field usage metrics
        const fieldPath = this.getFieldPath(node);
        const metrics = this.fieldUsage.get(fieldPath);

        if (metrics && metrics.usageCount > 0) {
          return node;
        }

        // Remove unused field
        return null;
      },
    });
  }

  /**
   * Reduce query complexity by limiting depth and field count
   */
  private reduceComplexity(query: DocumentNode): DocumentNode {
    let currentDepth = 0;

    return visit(query, {
      SelectionSet: {
        enter: () => {
          currentDepth++;

          // Limit query depth
          if (currentDepth > this.options.maxDepth) {
            return null;
          }
          return undefined;
        },
        leave: () => {
          currentDepth--;
          return undefined;
        },
      },
    });
  }

  /**
   * Get field path for tracking usage
   */
  private getFieldPath(field: FieldNode): string {
    // In a real implementation, this would build the full path
    return field.name.value;
  }

  /**
   * Get difference between two queries
   */
  private getFieldDifference(original: DocumentNode, optimized: DocumentNode): string[] {
    const originalFields = this.extractFields(original);
    const optimizedFields = this.extractFields(optimized);

    return originalFields.filter(field => !optimizedFields.includes(field));
  }

  /**
   * Extract all field names from a query
   */
  private extractFields(query: DocumentNode): string[] {
    const fields: string[] = [];

    visit(query, {
      Field: node => {
        fields.push(node.name.value);
      },
    });

    return fields;
  }

  /**
   * Track field usage for optimization
   */
  trackFieldUsage(fieldPath: string, responseSize: number, responseTime: number): void {
    const existing = this.fieldUsage.get(fieldPath);

    if (existing) {
      existing.usageCount++;
      existing.lastUsed = new Date();
      existing.averageResponseSize = (existing.averageResponseSize + responseSize) / 2;
      existing.performanceImpact = (existing.performanceImpact + responseTime) / 2;
    } else {
      this.fieldUsage.set(fieldPath, {
        fieldPath,
        usageCount: 1,
        lastUsed: new Date(),
        averageResponseSize: responseSize,
        performanceImpact: responseTime,
      });
    }
  }

  /**
   * Get field usage analytics
   */
  getFieldAnalytics(): {
    totalFields: number;
    unusedFields: string[];
    heavyFields: string[];
    recommendations: string[];
  } {
    const allFields = Array.from(this.fieldUsage.values());
    const unusedFields = allFields
      .filter(field => field.usageCount === 0)
      .map(field => field.fieldPath);

    const heavyFields = allFields
      .filter(field => field.performanceImpact > 100) // 100ms threshold
      .sort((a, b) => b.performanceImpact - a.performanceImpact)
      .slice(0, 10)
      .map(field => field.fieldPath);

    const recommendations: string[] = [];

    if (unusedFields.length > 0) {
      recommendations.push(`Remove ${unusedFields.length} unused fields to improve performance`);
    }

    if (heavyFields.length > 0) {
      recommendations.push(`Consider optimizing ${heavyFields.length} performance-heavy fields`);
    }

    return {
      totalFields: allFields.length,
      unusedFields,
      heavyFields,
      recommendations,
    };
  }

  /**
   * Clear field usage data
   */
  clearUsageData(): void {
    this.fieldUsage.clear();
  }
}

// =============================================================================
// Apollo Link Integration
// =============================================================================

/**
 * Creates an Apollo Link for automatic field selection optimization
 */
function createFieldSelectionLinkFunction(options?: FieldSelectionOptions): ApolloLink {
  const optimizer = new FieldSelectionOptimizerClass(options);

  return new ApolloLink((operation, forward) => {
    if (!forward) {
      throw new Error('Field selection link must not be the last link in the chain');
    }

    // Skip optimization for mutations and subscriptions
    const definition = operation.query.definitions[0];
    if (
      definition &&
      definition.kind === 'OperationDefinition' &&
      definition.operation !== 'query'
    ) {
      return forward(operation);
    }

    // Optimize the query
    const optimization = optimizer.optimizeQuery(operation.query);

    // Update operation with optimized query
    const optimizedOperation = {
      ...operation,
      query: optimization.optimizedQuery,
    };

    // Track performance
    const startTime = performance.now();

    return new Observable<FetchResult>(observer => {
      forward(optimizedOperation).subscribe({
        next: result => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          const responseSize = JSON.stringify(result.data || {}).length;

          // Track field usage
          optimization.fieldsRemoved.forEach(field => {
            optimizer.trackFieldUsage(field, responseSize, responseTime);
          });

          observer.next(result);
        },
        error: error => observer.error(error),
        complete: () => observer.complete(),
      });
    });
  });
}

// =============================================================================
// Query Analysis Utilities
// =============================================================================

/**
 * Analyze query performance characteristics
 */
export function analyzeQueryPerformance(query: DocumentNode): {
  complexity: QueryComplexity;
  recommendations: string[];
  optimizationPotential: number;
} {
  const optimizer = new FieldSelectionOptimizerClass();
  const complexity = optimizer.calculateComplexity(query);
  const recommendations: string[] = [];

  // Generate recommendations based on complexity
  if (complexity.depth > 8) {
    recommendations.push('Query depth is high, consider flattening the structure');
  }

  if (complexity.fieldCount > 50) {
    recommendations.push('Query selects many fields, consider field pruning');
  }

  if (complexity.score > 500) {
    recommendations.push('Query complexity is high, consider breaking into smaller queries');
  }

  // Calculate optimization potential (0-100)
  const optimizationPotential = Math.min(100, complexity.score / 10);

  return {
    complexity,
    recommendations,
    optimizationPotential,
  };
}

/**
 * Create optimized query variants for A/B testing
 */
export function createQueryVariants(query: DocumentNode): {
  conservative: DocumentNode;
  aggressive: DocumentNode;
  balanced: DocumentNode;
} {
  const conservativeOptimizer = new FieldSelectionOptimizerClass({
    enablePruning: false,
    maxDepth: 15,
    enableComplexityAnalysis: false,
  });

  const aggressiveOptimizer = new FieldSelectionOptimizerClass({
    enablePruning: true,
    maxDepth: 5,
    enableComplexityAnalysis: true,
    maxComplexity: 200,
  });

  const balancedOptimizer = new FieldSelectionOptimizerClass({
    enablePruning: true,
    maxDepth: 8,
    enableComplexityAnalysis: true,
    maxComplexity: 500,
  });

  return {
    conservative: conservativeOptimizer.optimizeQuery(query).optimizedQuery,
    aggressive: aggressiveOptimizer.optimizeQuery(query).optimizedQuery,
    balanced: balancedOptimizer.optimizeQuery(query).optimizedQuery,
  };
}

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook for monitoring field selection performance
 */
export function useFieldSelectionMetrics(optimizer: FieldSelectionOptimizerClass): {
  analytics: ReturnType<FieldSelectionOptimizerClass['getFieldAnalytics']>;
  refresh: () => void;
} {
  const [analytics, setAnalytics] = React.useState(optimizer.getFieldAnalytics());

  const refresh = React.useCallback(() => {
    setAnalytics(optimizer.getFieldAnalytics());
  }, [optimizer]);

  React.useEffect(() => {
    const interval = setInterval(refresh, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return { analytics, refresh };
}

// =============================================================================
// Exports
// =============================================================================

export const FieldSelectionUtils = {
  FieldSelectionOptimizer: FieldSelectionOptimizerClass,
  createFieldSelectionLink: createFieldSelectionLinkFunction,
  analyzeQueryPerformance,
  createQueryVariants,
  useFieldSelectionMetrics,
};

// Re-export for convenience
export const FieldSelectionOptimizer = FieldSelectionOptimizerClass;
export const createFieldSelectionLink = createFieldSelectionLinkFunction;
