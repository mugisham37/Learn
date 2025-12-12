/**
 * Monitoring Dashboard Service
 * 
 * Creates and manages CloudWatch dashboards for application health, API performance,
 * database performance, background jobs, and business metrics. Provides comprehensive
 * monitoring visualization for operational insights.
 * 
 * Requirements: 17.6
 */

import {
  CloudWatchClient,
  PutDashboardCommand,
  GetDashboardCommand,
  DeleteDashboardCommand,
  ListDashboardsCommand,
} from '@aws-sdk/client-cloudwatch';

import { config } from '../../config/index.js';
import { secrets } from '../utils/secureConfig.js';
import { logger } from '../utils/logger.js';

/**
 * Dashboard widget configuration
 */
interface DashboardWidget {
  type: 'metric' | 'log' | 'number';
  x: number;
  y: number;
  width: number;
  height: number;
  properties: {
    title: string;
    metrics?: Array<Array<string | number>>;
    period?: number;
    stat?: string;
    region?: string;
    yAxis?: {
      left?: { min?: number; max?: number };
      right?: { min?: number; max?: number };
    };
    view?: 'timeSeries' | 'singleValue';
    stacked?: boolean;
    annotations?: {
      horizontal?: Array<{
        label: string;
        value: number;
        fill?: 'above' | 'below';
      }>;
    };
  };
}

/**
 * Dashboard configuration
 */
interface DashboardConfig {
  name: string;
  widgets: DashboardWidget[];
}

/**
 * Monitoring dashboard service interface
 */
export interface IMonitoringDashboardService {
  createApplicationHealthDashboard(): Promise<void>;
  createAPIPerformanceDashboard(): Promise<void>;
  createDatabasePerformanceDashboard(): Promise<void>;
  createBackgroundJobsDashboard(): Promise<void>;
  createBusinessMetricsDashboard(): Promise<void>;
  createCustomDashboard(config: DashboardConfig): Promise<void>;
  deleteDashboard(name: string): Promise<void>;
  listDashboards(): Promise<string[]>;
  isEnabled(): boolean;
}

/**
 * Monitoring dashboard service implementation
 */
export class MonitoringDashboardService implements IMonitoringDashboardService {
  private cloudWatchClient: CloudWatchClient | null = null;
  private readonly namespace = 'LearningPlatform';
  private readonly region: string;
  private readonly isEnabled: boolean;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.isEnabled = config.nodeEnv === 'production' && this.initializeClient();
  }

  /**
   * Initialize CloudWatch client
   */
  private initializeClient(): boolean {
    try {
      const awsConfig = secrets.getAwsConfig();
      
      if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey) {
        logger.warn('Monitoring dashboard service disabled: Missing AWS credentials');
        return false;
      }

      this.cloudWatchClient = new CloudWatchClient({
        region: this.region,
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      });

      logger.info('Monitoring dashboard service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize monitoring dashboard service', { error });
      return false;
    }
  }

  /**
   * Create application health dashboard
   */
  async createApplicationHealthDashboard(): Promise<void> {
    const config: DashboardConfig = {
      name: 'LearningPlatform-ApplicationHealth',
      widgets: [
        // Error Rate
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: 'Error Rate (%)',
            metrics: [
              [this.namespace, 'ErrorRate'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
            yAxis: { left: { min: 0, max: 10 } },
            annotations: {
              horizontal: [
                { label: 'Critical Threshold', value: 5, fill: 'above' },
                { label: 'Warning Threshold', value: 2, fill: 'above' },
              ],
            },
          },
        },
        // Response Time Percentiles
        {
          type: 'metric',
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: 'Response Time Percentiles (ms)',
            metrics: [
              [this.namespace, 'ResponseTimeP50'],
              [this.namespace, 'ResponseTimeP95'],
              [this.namespace, 'ResponseTimeP99'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
            annotations: {
              horizontal: [
                { label: 'Critical Latency', value: 3000, fill: 'above' },
                { label: 'Warning Latency', value: 1000, fill: 'above' },
              ],
            },
          },
        },
        // Throughput
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Requests per Second',
            metrics: [
              [this.namespace, 'RequestsPerSecond'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
          },
        },
        // Memory Usage
        {
          type: 'metric',
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Memory Usage (MB)',
            metrics: [
              [this.namespace, 'MemoryUsageHeapUsed', { stat: 'Average' }],
              [this.namespace, 'MemoryUsageHeapTotal', { stat: 'Average' }],
              [this.namespace, 'MemoryUsageRSS', { stat: 'Average' }],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
          },
        },
        // Process Uptime
        {
          type: 'metric',
          x: 0,
          y: 12,
          width: 24,
          height: 6,
          properties: {
            title: 'Process Uptime (seconds)',
            metrics: [
              [this.namespace, 'ProcessUptime'],
            ],
            period: 300,
            stat: 'Maximum',
            region: this.region,
          },
        },
      ],
    };

    await this.createCustomDashboard(config);
  }

  /**
   * Create API performance dashboard
   */
  async createAPIPerformanceDashboard(): Promise<void> {
    const config: DashboardConfig = {
      name: 'LearningPlatform-APIPerformance',
      widgets: [
        // Response Time by Endpoint
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 24,
          height: 6,
          properties: {
            title: 'Response Time by Endpoint (ms)',
            metrics: [
              [this.namespace, 'ResponseTime', 'Endpoint', '/api/courses', 'Method', 'GET'],
              [this.namespace, 'ResponseTime', 'Endpoint', '/api/users', 'Method', 'GET'],
              [this.namespace, 'ResponseTime', 'Endpoint', '/api/enrollments', 'Method', 'POST'],
              [this.namespace, 'ResponseTime', 'Endpoint', '/graphql', 'Method', 'POST'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
          },
        },
        // Throughput by Endpoint
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Throughput by Endpoint',
            metrics: [
              [this.namespace, 'Throughput', 'Endpoint', '/api/courses', 'Method', 'GET'],
              [this.namespace, 'Throughput', 'Endpoint', '/api/users', 'Method', 'GET'],
              [this.namespace, 'Throughput', 'Endpoint', '/api/enrollments', 'Method', 'POST'],
              [this.namespace, 'Throughput', 'Endpoint', '/graphql', 'Method', 'POST'],
            ],
            period: 300,
            stat: 'Sum',
            region: this.region,
          },
        },
        // Error Rate by Endpoint
        {
          type: 'metric',
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Error Rate by Endpoint',
            metrics: [
              [this.namespace, 'ErrorRate', 'Endpoint', '/api/courses', 'Method', 'GET'],
              [this.namespace, 'ErrorRate', 'Endpoint', '/api/users', 'Method', 'GET'],
              [this.namespace, 'ErrorRate', 'Endpoint', '/api/enrollments', 'Method', 'POST'],
              [this.namespace, 'ErrorRate', 'Endpoint', '/graphql', 'Method', 'POST'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
          },
        },
      ],
    };

    await this.createCustomDashboard(config);
  }

  /**
   * Create database performance dashboard
   */
  async createDatabasePerformanceDashboard(): Promise<void> {
    const config: DashboardConfig = {
      name: 'LearningPlatform-DatabasePerformance',
      widgets: [
        // Database Query Time
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: 'Database Query Time (ms)',
            metrics: [
              [this.namespace, 'DatabaseQueryTime', 'Operation', 'SELECT'],
              [this.namespace, 'DatabaseQueryTime', 'Operation', 'INSERT'],
              [this.namespace, 'DatabaseQueryTime', 'Operation', 'UPDATE'],
              [this.namespace, 'DatabaseQueryTime', 'Operation', 'DELETE'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
            annotations: {
              horizontal: [
                { label: 'Slow Query Threshold', value: 1000, fill: 'above' },
              ],
            },
          },
        },
        // Database Query Count
        {
          type: 'metric',
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: 'Database Query Count',
            metrics: [
              [this.namespace, 'DatabaseQueryCount'],
            ],
            period: 300,
            stat: 'Sum',
            region: this.region,
          },
        },
        // Cache Hit Rate
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Cache Hit Rate (%)',
            metrics: [
              [this.namespace, 'CacheHitRate', 'CacheType', 'redis'],
              [this.namespace, 'CacheHitRate', 'CacheType', 'memory'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
            yAxis: { left: { min: 0, max: 100 } },
          },
        },
        // Cache Operations
        {
          type: 'metric',
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Cache Operations',
            metrics: [
              [this.namespace, 'CacheHits'],
              [this.namespace, 'CacheMisses'],
            ],
            period: 300,
            stat: 'Sum',
            region: this.region,
          },
        },
      ],
    };

    await this.createCustomDashboard(config);
  }

  /**
   * Create background jobs dashboard
   */
  async createBackgroundJobsDashboard(): Promise<void> {
    const config: DashboardConfig = {
      name: 'LearningPlatform-BackgroundJobs',
      widgets: [
        // Job Processing Rate
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: 'Job Processing Rate',
            metrics: [
              ['AWS/BullMQ', 'JobsCompleted', 'Queue', 'video-processing'],
              ['AWS/BullMQ', 'JobsCompleted', 'Queue', 'email'],
              ['AWS/BullMQ', 'JobsCompleted', 'Queue', 'certificate-generation'],
              ['AWS/BullMQ', 'JobsCompleted', 'Queue', 'analytics'],
            ],
            period: 300,
            stat: 'Sum',
            region: this.region,
          },
        },
        // Job Failure Rate
        {
          type: 'metric',
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            title: 'Job Failure Rate',
            metrics: [
              ['AWS/BullMQ', 'JobsFailed', 'Queue', 'video-processing'],
              ['AWS/BullMQ', 'JobsFailed', 'Queue', 'email'],
              ['AWS/BullMQ', 'JobsFailed', 'Queue', 'certificate-generation'],
              ['AWS/BullMQ', 'JobsFailed', 'Queue', 'analytics'],
            ],
            period: 300,
            stat: 'Sum',
            region: this.region,
          },
        },
        // Queue Depth
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 24,
          height: 6,
          properties: {
            title: 'Queue Depth',
            metrics: [
              ['AWS/BullMQ', 'QueueDepth', 'Queue', 'video-processing'],
              ['AWS/BullMQ', 'QueueDepth', 'Queue', 'email'],
              ['AWS/BullMQ', 'QueueDepth', 'Queue', 'certificate-generation'],
              ['AWS/BullMQ', 'QueueDepth', 'Queue', 'analytics'],
            ],
            period: 300,
            stat: 'Average',
            region: this.region,
          },
        },
      ],
    };

    await this.createCustomDashboard(config);
  }

  /**
   * Create business metrics dashboard
   */
  async createBusinessMetricsDashboard(): Promise<void> {
    const config: DashboardConfig = {
      name: 'LearningPlatform-BusinessMetrics',
      widgets: [
        // User Registrations
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 6,
          height: 6,
          properties: {
            title: 'User Registrations',
            metrics: [
              [this.namespace, 'UserRegistrations'],
            ],
            period: 3600,
            stat: 'Sum',
            region: this.region,
            view: 'singleValue',
          },
        },
        // Course Enrollments
        {
          type: 'metric',
          x: 6,
          y: 0,
          width: 6,
          height: 6,
          properties: {
            title: 'Course Enrollments',
            metrics: [
              [this.namespace, 'CourseEnrollments'],
            ],
            period: 3600,
            stat: 'Sum',
            region: this.region,
            view: 'singleValue',
          },
        },
        // Course Completions
        {
          type: 'metric',
          x: 12,
          y: 0,
          width: 6,
          height: 6,
          properties: {
            title: 'Course Completions',
            metrics: [
              [this.namespace, 'CourseCompletions'],
            ],
            period: 3600,
            stat: 'Sum',
            region: this.region,
            view: 'singleValue',
          },
        },
        // Revenue
        {
          type: 'metric',
          x: 18,
          y: 0,
          width: 6,
          height: 6,
          properties: {
            title: 'Revenue ($)',
            metrics: [
              [this.namespace, 'Revenue'],
            ],
            period: 3600,
            stat: 'Sum',
            region: this.region,
            view: 'singleValue',
          },
        },
        // Active Users
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Active Users (Daily)',
            metrics: [
              [this.namespace, 'ActiveUsers'],
            ],
            period: 86400,
            stat: 'Maximum',
            region: this.region,
          },
        },
        // Video Watch Time
        {
          type: 'metric',
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            title: 'Video Watch Time (minutes)',
            metrics: [
              [this.namespace, 'VideoWatchTime'],
            ],
            period: 3600,
            stat: 'Sum',
            region: this.region,
          },
        },
      ],
    };

    await this.createCustomDashboard(config);
  }

  /**
   * Create custom dashboard
   */
  async createCustomDashboard(config: DashboardConfig): Promise<void> {
    if (!this.isEnabled || !this.cloudWatchClient) {
      logger.debug(`Dashboard creation skipped: ${config.name} (CloudWatch not enabled)`);
      return;
    }

    try {
      const dashboardBody = JSON.stringify({
        widgets: config.widgets,
      });

      const command = new PutDashboardCommand({
        DashboardName: config.name,
        DashboardBody: dashboardBody,
      });

      await this.cloudWatchClient.send(command);
      
      logger.info(`Created CloudWatch dashboard: ${config.name}`);
    } catch (error) {
      logger.error(`Failed to create dashboard: ${config.name}`, { error });
      throw error;
    }
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(name: string): Promise<void> {
    if (!this.isEnabled || !this.cloudWatchClient) {
      return;
    }

    try {
      const command = new DeleteDashboardCommand({
        DashboardNames: [name],
      });

      await this.cloudWatchClient.send(command);
      
      logger.info(`Deleted CloudWatch dashboard: ${name}`);
    } catch (error) {
      logger.error(`Failed to delete dashboard: ${name}`, { error });
      throw error;
    }
  }

  /**
   * List all dashboards
   */
  async listDashboards(): Promise<string[]> {
    if (!this.isEnabled || !this.cloudWatchClient) {
      return [];
    }

    try {
      const command = new ListDashboardsCommand({});
      const response = await this.cloudWatchClient.send(command);
      
      return response.DashboardEntries?.map(entry => entry.DashboardName || '') || [];
    } catch (error) {
      logger.error('Failed to list dashboards', { error });
      return [];
    }
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.isEnabled;
  }
}

/**
 * Global monitoring dashboard service instance
 */
export const monitoringDashboardService = new MonitoringDashboardService();

/**
 * Initialize all monitoring dashboards
 */
export async function initializeMonitoringDashboards(): Promise<void> {
  if (!monitoringDashboardService.isEnabled()) {
    logger.info('Monitoring dashboards initialization skipped (CloudWatch not enabled)');
    return;
  }

  try {
    logger.info('Initializing monitoring dashboards...');

    await monitoringDashboardService.createApplicationHealthDashboard();
    await monitoringDashboardService.createAPIPerformanceDashboard();
    await monitoringDashboardService.createDatabasePerformanceDashboard();
    await monitoringDashboardService.createBackgroundJobsDashboard();
    await monitoringDashboardService.createBusinessMetricsDashboard();

    logger.info('All monitoring dashboards initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize monitoring dashboards', { error });
  }
}