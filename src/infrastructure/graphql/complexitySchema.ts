/**
 * GraphQL Schema for Complexity Monitoring
 *
 * This module defines GraphQL types and resolvers for monitoring
 * query complexity statistics and metrics.
 *
 * Requirements: 15.6
 */

import { complexityMonitor } from './complexityMonitoring.js';

/**
 * GraphQL type definitions for complexity monitoring
 */
export const complexityMonitoringTypeDefs = `
  type ComplexityStats {
    totalQueries: Int!
    averageComplexity: Float!
    maxComplexity: Int!
    minComplexity: Int!
    highComplexityQueries: Int!
    alertQueries: Int!
  }

  type ComplexityMetric {
    query: String!
    operationName: String
    complexity: Int!
    executionTime: Int
    userId: String
    userRole: String
    timestamp: DateTime!
  }

  extend type Query {
    """
    Get complexity statistics (Admin only)
    """
    complexityStats: ComplexityStats! @complexity(value: 10)
    
    """
    Get top complex queries (Admin only)
    """
    topComplexQueries(limit: Int = 10): [ComplexityMetric!]! @complexity(value: 15)
    
    """
    Get queries by user (Admin only)
    """
    userComplexityQueries(userId: ID!): [ComplexityMetric!]! @complexity(value: 20)
  }

  extend type Mutation {
    """
    Clear complexity metrics (Admin only)
    """
    clearComplexityMetrics: Boolean! @complexity(value: 5)
    
    """
    Update complexity monitoring configuration (Admin only)
    """
    updateComplexityConfig(
      logThreshold: Int
      alertThreshold: Int
      enableDetailedLogging: Boolean
      enablePerformanceTracking: Boolean
    ): Boolean! @complexity(value: 5)
  }
`;

/**
 * Context interface for complexity monitoring resolvers
 */
interface ComplexityMonitoringContext {
  user?: {
    role: string;
  };
}

/**
 * Complexity stats interface
 */
interface ComplexityStats {
  totalQueries: number;
  averageComplexity: number;
  maxComplexity: number;
  minComplexity: number;
  highComplexityQueries: number;
  alertQueries: number;
}

/**
 * Complexity metric interface
 */
interface ComplexityMetric {
  query: string;
  operationName?: string;
  complexity: number;
  executionTime?: number;
  userId?: string;
  userRole?: string;
  timestamp: Date;
}

/**
 * GraphQL resolvers for complexity monitoring
 */
export const complexityMonitoringResolvers = {
  Query: {
    complexityStats: (_: never, __: Record<string, never>, context: ComplexityMonitoringContext): ComplexityStats => {
      // Check admin authorization
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Admin access required');
      }

      return complexityMonitor.getComplexityStats();
    },

    topComplexQueries: (_: never, { limit }: { limit: number }, context: ComplexityMonitoringContext): ComplexityMetric[] => {
      // Check admin authorization
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Admin access required');
      }

      return complexityMonitor.getTopComplexQueries(limit);
    },

    userComplexityQueries: (_: never, { userId }: { userId: string }, context: ComplexityMonitoringContext): ComplexityMetric[] => {
      // Check admin authorization
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Admin access required');
      }

      return complexityMonitor.getQueriesByUser(userId);
    },
  },

  Mutation: {
    clearComplexityMetrics: (_: never, __: Record<string, never>, context: ComplexityMonitoringContext): boolean => {
      // Check admin authorization
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Admin access required');
      }

      complexityMonitor.clearMetrics();
      return true;
    },

    updateComplexityConfig: (
      _: never,
      args: {
        logThreshold?: number;
        alertThreshold?: number;
        enableDetailedLogging?: boolean;
        enablePerformanceTracking?: boolean;
      },
      context: ComplexityMonitoringContext
    ): boolean => {
      // Check admin authorization
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Admin access required');
      }

      // Filter out undefined values
      const config = Object.fromEntries(
        Object.entries(args).filter(([_, value]) => value !== undefined)
      );

      complexityMonitor.updateConfig(config);
      return true;
    },
  },
};

/**
 * Export combined schema and resolvers
 */
export const complexityMonitoringSchema = {
  typeDefs: complexityMonitoringTypeDefs,
  resolvers: complexityMonitoringResolvers,
};
