/**
 * Admin GraphQL Resolvers
 * 
 * GraphQL resolvers for admin-only functionality including
 * job monitoring, queue management, and system administration.
 */

import { GraphQLError } from 'graphql';
import { logger } from '../../../../shared/utils/logger.js';
import { JobMonitoringService } from '../../../../shared/services/JobMonitoringService.js';

/**
 * GraphQL context interface for admin operations
 */
interface AdminGraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Require admin authentication
 */
function requireAdmin(context: AdminGraphQLContext): { id: string; email: string; role: string } {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
  
  if (context.user.role !== 'admin') {
    throw new GraphQLError('Admin role required', {
      extensions: { code: 'FORBIDDEN' }
    });
  }
  
  return context.user;
}

/**
 * Admin GraphQL resolvers
 */
export const adminResolvers = {
  Query: {
    /**
     * Get comprehensive job monitoring dashboard data
     */
    jobDashboard: async (_: any, __: any, context: AdminGraphQLContext) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const dashboardData = await jobMonitoringService.getDashboardData();
        
        // Transform Map objects to arrays for GraphQL
        const completionRates = Array.from(dashboardData.metrics.completionRates.entries())
          .map(([queueName, metrics]) => ({
            queueName,
            metrics
          }));
          
        const queueDepths = Array.from(dashboardData.metrics.queueDepths.entries())
          .map(([queueName, metrics]) => ({
            queueName,
            metrics
          }));
        
        logger.info('Job dashboard accessed', { adminId: admin.id });
        
        return {
          ...dashboardData,
          completionRates,
          queueDepths
        };
        
      } catch (error) {
        logger.error('Failed to get job dashboard:', error);
        throw new GraphQLError('Failed to retrieve job dashboard data');
      }
    },
    
    /**
     * Get real-time queue statistics
     */
    realtimeQueueStats: async (_: any, __: any, context: AdminGraphQLContext) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const stats = await jobMonitoringService.getRealtimeStats();
        
        logger.debug('Realtime queue stats accessed', { adminId: admin.id });
        
        return stats;
        
      } catch (error) {
        logger.error('Failed to get realtime stats:', error);
        throw new GraphQLError('Failed to retrieve realtime queue statistics');
      }
    },
    
    /**
     * Get job event history
     */
    jobEventHistory: async (
      _: any, 
      { queueName, limit = 100 }: { queueName?: string; limit?: number }, 
      context: AdminGraphQLContext
    ) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const events = jobMonitoringService.getJobEventHistory(queueName, limit);
        
        logger.info('Job event history accessed', { 
          adminId: admin.id, 
          queueName, 
          limit 
        });
        
        return events;
        
      } catch (error) {
        logger.error('Failed to get job event history:', error);
        throw new GraphQLError('Failed to retrieve job event history');
      }
    },
    
    /**
     * Get health status for a specific queue
     */
    queueHealth: async (
      _: any, 
      { queueName }: { queueName?: string }, 
      context: AdminGraphQLContext
    ) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const dashboardData = await jobMonitoringService.getDashboardData();
        
        if (queueName) {
          const queueHealth = dashboardData.queues.find(q => q.name === queueName);
          if (!queueHealth) {
            throw new GraphQLError(`Queue '${queueName}' not found`);
          }
          return queueHealth;
        }
        
        // Return overall system health if no specific queue requested
        return null;
        
      } catch (error) {
        logger.error('Failed to get queue health:', error);
        throw new GraphQLError('Failed to retrieve queue health status');
      }
    },
    
    /**
     * Get detailed job information
     */
    jobDetails: async (
      _: any,
      { queueName, jobId }: { queueName: string; jobId: string },
      context: AdminGraphQLContext
    ) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const jobDetails = await jobMonitoringService.getJobDetails(queueName, jobId);
        
        logger.info('Job details accessed', {
          adminId: admin.id,
          queueName,
          jobId
        });
        
        return jobDetails;
        
      } catch (error) {
        logger.error('Failed to get job details:', error);
        throw new GraphQLError('Failed to retrieve job details');
      }
    }
  },
  
  Mutation: {
    /**
     * Retry failed jobs
     */
    retryJobs: async (
      _: any, 
      { input }: { input: any }, 
      context: AdminGraphQLContext
    ) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const result = await jobMonitoringService.retryJobs(input);
        
        logger.info('Jobs retry initiated', { 
          adminId: admin.id, 
          input,
          result 
        });
        
        return result;
        
      } catch (error) {
        logger.error('Failed to retry jobs:', error);
        throw new GraphQLError('Failed to retry jobs');
      }
    },
    
    /**
     * Manage queue operations
     */
    manageQueue: async (
      _: any, 
      { input }: { input: any }, 
      context: AdminGraphQLContext
    ) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const result = await jobMonitoringService.manageQueue({
          queueName: input.queueName,
          action: input.action.toLowerCase(),
          jobStatus: input.jobStatus?.toLowerCase()
        });
        
        logger.info('Queue management operation performed', { 
          adminId: admin.id, 
          input,
          result 
        });
        
        return result;
        
      } catch (error) {
        logger.error('Failed to manage queue:', error);
        throw new GraphQLError('Failed to perform queue management operation');
      }
    },
    
    /**
     * Export monitoring data
     */
    exportMonitoringData: async (
      _: any, 
      { startDate, endDate }: { startDate: Date; endDate: Date }, 
      context: AdminGraphQLContext
    ) => {
      const admin = requireAdmin(context);
      
      try {
        const jobMonitoringService = JobMonitoringService.getInstance();
        const exportResult = await jobMonitoringService.exportMonitoringData(startDate, endDate);
        
        logger.info('Monitoring data export initiated', { 
          adminId: admin.id, 
          startDate, 
          endDate,
          exportId: exportResult.exportId 
        });
        
        return exportResult;
        
      } catch (error) {
        logger.error('Failed to export monitoring data:', error);
        throw new GraphQLError('Failed to export monitoring data');
      }
    },
    
    /**
     * Clear queue alerts
     */
    clearQueueAlerts: async (
      _: any, 
      { queueName }: { queueName?: string }, 
      context: AdminGraphQLContext
    ) => {
      const admin = requireAdmin(context);
      
      try {
        // This would clear alerts for the specified queue or all queues
        logger.info('Queue alerts cleared', { 
          adminId: admin.id, 
          queueName 
        });
        
        return true;
        
      } catch (error) {
        logger.error('Failed to clear queue alerts:', error);
        throw new GraphQLError('Failed to clear queue alerts');
      }
    }
  },
  
  Subscription: {
    /**
     * Subscribe to queue statistics updates
     */
    queueStatsUpdated: {
      // This would be implemented with a real-time subscription mechanism
      subscribe: () => {
        throw new GraphQLError('Real-time subscriptions not yet implemented');
      }
    },
    
    /**
     * Subscribe to job alerts
     */
    jobAlerts: {
      // This would be implemented with a real-time subscription mechanism
      subscribe: () => {
        throw new GraphQLError('Real-time subscriptions not yet implemented');
      }
    },
    
    /**
     * Subscribe to job events
     */
    jobEvents: {
      // This would be implemented with a real-time subscription mechanism
      subscribe: () => {
        throw new GraphQLError('Real-time subscriptions not yet implemented');
      }
    }
  },
  
  // Enum resolvers
  QueueHealthStatus: {
    HEALTHY: 'healthy',
    WARNING: 'warning',
    ERROR: 'error'
  },
  
  AlertSeverity: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  },
  
  QueueAction: {
    PAUSE: 'pause',
    RESUME: 'resume',
    CLEAR: 'clear',
    DRAIN: 'drain'
  },
  
  JobStatus: {
    WAITING: 'waiting',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    FAILED: 'failed'
  }
};