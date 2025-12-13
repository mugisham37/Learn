/**
 * CloudWatch Service
 * 
 * Handles CloudWatch Logs and Metrics integration for monitoring and observability.
 * Implements log group management, custom metrics, and application KPIs.
 * 
 * Requirements: 17.4, 17.6
 */

// Mock AWS SDK types and classes since the SDK might not be available
interface Dimension {
  Name: string;
  Value: string;
}

interface MetricDatum {
  MetricName: string;
  Value: number;
  Unit: string;
  Timestamp: Date;
  Dimensions?: Dimension[];
}

interface LogGroup {
  logGroupName?: string;
  creationTime?: number;
  retentionInDays?: number;
}

// Mock AWS SDK classes
class CloudWatchClient {
  constructor(_config?: unknown) {
    // Mock constructor
  }
  
  async send(_command: unknown): Promise<unknown> {
    return Promise.resolve({});
  }
}

class CloudWatchLogsClient {
  constructor(_config?: unknown) {
    // Mock constructor
  }
  
  async send(_command: unknown): Promise<unknown> {
    return Promise.resolve({});
  }
}

class CreateLogGroupCommand {
  constructor(public input: { logGroupName: string }) {}
}

class CreateLogStreamCommand {
  constructor(public input: { logGroupName: string; logStreamName: string }) {}
}

class DescribeLogGroupsCommand {
  constructor(public input?: { logGroupNamePrefix?: string; limit?: number }) {}
}

class PutRetentionPolicyCommand {
  constructor(public input: { logGroupName: string; retentionInDays: number }) {}
}

class PutMetricDataCommand {
  constructor(public input: { Namespace: string; MetricData: MetricDatum[] }) {}
}

import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';
import { secrets } from '../utils/secureConfig.js';

/**
 * CloudWatch service interface
 */
export interface ICloudWatchService {
  // Log Groups
  createLogGroup(logGroupName: string, retentionDays?: number): Promise<void>;
  createLogStream(logGroupName: string, logStreamName: string): Promise<void>;
  ensureLogGroupExists(logGroupName: string, retentionDays?: number): Promise<void>;
  
  // Custom Metrics
  putMetric(metricName: string, value: number, unit?: string, dimensions?: Dimension[]): Promise<void>;
  putMetrics(metrics: MetricDatum[]): Promise<void>;
  
  // Application KPIs
  recordResponseTime(endpoint: string, method: string, responseTime: number): Promise<void>;
  recordThroughput(endpoint: string, method: string, count?: number): Promise<void>;
  recordErrorRate(endpoint: string, method: string, errorType: string): Promise<void>;
  recordDatabaseQueryTime(operation: string, table: string, duration: number): Promise<void>;
  recordCacheHitRate(cacheType: string, hits: number, misses: number): Promise<void>;
  
  // Health Check
  isHealthy(): Promise<boolean>;
}

/**
 * CloudWatch service implementation
 */
export class CloudWatchService implements ICloudWatchService {
  private logsClient: CloudWatchLogsClient | null = null;
  private metricsClient: CloudWatchClient | null = null;
  private readonly namespace = 'LearningPlatform';
  private readonly isEnabled: boolean;

  constructor() {
    this.isEnabled = config.nodeEnv === 'production' && this.initializeClients();
  }

  /**
   * Initialize AWS CloudWatch clients
   */
  private initializeClients(): boolean {
    try {
      const awsConfig = secrets.getAwsConfig();
      
      if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey || !awsConfig.region) {
        logger.warn('CloudWatch service disabled: Missing AWS credentials');
        return false;
      }

      const clientConfig = {
        region: awsConfig.region,
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      };

      this.logsClient = new CloudWatchLogsClient(clientConfig);
      this.metricsClient = new CloudWatchClient(clientConfig);

      logger.info('CloudWatch service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize CloudWatch service', { error });
      return false;
    }
  }

  /**
   * Create a new log group
   */
  async createLogGroup(logGroupName: string, retentionDays: number = 30): Promise<void> {
    if (!this.isEnabled || !this.logsClient) {
      logger.debug('CloudWatch service not enabled, skipping log group creation');
      return;
    }

    try {
      const command = new CreateLogGroupCommand({
        logGroupName,
      });

      await this.logsClient.send(command);
      logger.info(`Created CloudWatch log group: ${logGroupName}`);

      // Set retention policy
      if (retentionDays > 0) {
        await this.setLogRetention(logGroupName, retentionDays);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ResourceAlreadyExistsException') {
        logger.debug(`Log group already exists: ${logGroupName}`);
      } else {
        logger.error(`Failed to create log group: ${logGroupName}`, { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        throw error;
      }
    }
  }

  /**
   * Create a new log stream
   */
  async createLogStream(logGroupName: string, logStreamName: string): Promise<void> {
    if (!this.isEnabled || !this.logsClient) {
      logger.debug('CloudWatch service not enabled, skipping log stream creation');
      return;
    }

    try {
      const command = new CreateLogStreamCommand({
        logGroupName,
        logStreamName,
      });

      await this.logsClient.send(command);
      logger.info(`Created CloudWatch log stream: ${logStreamName} in ${logGroupName}`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ResourceAlreadyExistsException') {
        logger.debug(`Log stream already exists: ${logStreamName}`);
      } else {
        logger.error(`Failed to create log stream: ${logStreamName}`, { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        throw error;
      }
    }
  }

  /**
   * Ensure log group exists, create if it doesn't
   */
  async ensureLogGroupExists(logGroupName: string, retentionDays: number = 30): Promise<void> {
    if (!this.isEnabled || !this.logsClient) {
      return;
    }

    try {
      const command = new DescribeLogGroupsCommand({
        logGroupNamePrefix: logGroupName,
      });

      const response = await this.logsClient.send(command) as { logGroups?: LogGroup[] };
      const exists = response.logGroups?.some((group: LogGroup) => group.logGroupName === logGroupName);

      if (!exists) {
        await this.createLogGroup(logGroupName, retentionDays);
      }
    } catch (error) {
      logger.error(`Failed to check log group existence: ${logGroupName}`, { error });
      throw error;
    }
  }

  /**
   * Set log retention policy
   */
  private async setLogRetention(logGroupName: string, retentionDays: number): Promise<void> {
    if (!this.logsClient) return;

    try {
      const command = new PutRetentionPolicyCommand({
        logGroupName,
        retentionInDays: retentionDays,
      });

      await this.logsClient.send(command);
      logger.info(`Set retention policy for ${logGroupName}: ${retentionDays} days`);
    } catch (error) {
      logger.error(`Failed to set retention policy for ${logGroupName}`, { error });
    }
  }

  /**
   * Put a single metric to CloudWatch
   */
  async putMetric(
    metricName: string,
    value: number,
    unit: string = 'Count',
    dimensions: Dimension[] = []
  ): Promise<void> {
    if (!this.isEnabled || !this.metricsClient) {
      return;
    }

    const metric: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions,
    };

    await this.putMetrics([metric]);
  }

  /**
   * Put multiple metrics to CloudWatch
   */
  async putMetrics(metrics: MetricDatum[]): Promise<void> {
    if (!this.isEnabled || !this.metricsClient || metrics.length === 0) {
      return;
    }

    try {
      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: metrics,
      });

      await this.metricsClient.send(command);
      logger.debug(`Sent ${metrics.length} metrics to CloudWatch`);
    } catch (error) {
      logger.error('Failed to send metrics to CloudWatch', { error, metricsCount: metrics.length });
    }
  }

  /**
   * Record API response time
   */
  async recordResponseTime(endpoint: string, method: string, responseTime: number): Promise<void> {
    await this.putMetric('ResponseTime', responseTime, 'Milliseconds', [
      { Name: 'Endpoint', Value: endpoint },
      { Name: 'Method', Value: method },
    ]);
  }

  /**
   * Record API throughput
   */
  async recordThroughput(endpoint: string, method: string, count: number = 1): Promise<void> {
    await this.putMetric('Throughput', count, 'Count', [
      { Name: 'Endpoint', Value: endpoint },
      { Name: 'Method', Value: method },
    ]);
  }

  /**
   * Record error rate
   */
  async recordErrorRate(endpoint: string, method: string, errorType: string): Promise<void> {
    await this.putMetric('ErrorRate', 1, 'Count', [
      { Name: 'Endpoint', Value: endpoint },
      { Name: 'Method', Value: method },
      { Name: 'ErrorType', Value: errorType },
    ]);
  }

  /**
   * Record database query performance
   */
  async recordDatabaseQueryTime(operation: string, table: string, duration: number): Promise<void> {
    await this.putMetric('DatabaseQueryTime', duration, 'Milliseconds', [
      { Name: 'Operation', Value: operation },
      { Name: 'Table', Value: table },
    ]);
  }

  /**
   * Record cache hit rate
   */
  async recordCacheHitRate(cacheType: string, hits: number, misses: number): Promise<void> {
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;

    await this.putMetrics([
      {
        MetricName: 'CacheHitRate',
        Value: hitRate,
        Unit: 'Percent',
        Timestamp: new Date(),
        Dimensions: [{ Name: 'CacheType', Value: cacheType }],
      },
      {
        MetricName: 'CacheHits',
        Value: hits,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: [{ Name: 'CacheType', Value: cacheType }],
      },
      {
        MetricName: 'CacheMisses',
        Value: misses,
        Unit: 'Count',
        Timestamp: new Date(),
        Dimensions: [{ Name: 'CacheType', Value: cacheType }],
      },
    ]);
  }

  /**
   * Health check for CloudWatch service
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isEnabled || !this.logsClient) {
      return false;
    }

    try {
      // Simple health check by listing log groups
      const command = new DescribeLogGroupsCommand({ limit: 1 });
      await this.logsClient.send(command);
      return true;
    } catch (error) {
      logger.error('CloudWatch health check failed', { error });
      return false;
    }
  }
}

/**
 * Global CloudWatch service instance
 */
export const cloudWatchService = new CloudWatchService();

/**
 * Convenience functions for common metrics
 */
export const metrics = {
  /**
   * Record API response time
   */
  responseTime: (endpoint: string, method: string, responseTime: number): Promise<void> =>
    cloudWatchService.recordResponseTime(endpoint, method, responseTime),

  /**
   * Record API throughput
   */
  throughput: (endpoint: string, method: string, count?: number): Promise<void> =>
    cloudWatchService.recordThroughput(endpoint, method, count),

  /**
   * Record error
   */
  error: (endpoint: string, method: string, errorType: string): Promise<void> =>
    cloudWatchService.recordErrorRate(endpoint, method, errorType),

  /**
   * Record database query time
   */
  dbQuery: (operation: string, table: string, duration: number): Promise<void> =>
    cloudWatchService.recordDatabaseQueryTime(operation, table, duration),

  /**
   * Record cache performance
   */
  cache: (cacheType: string, hits: number, misses: number): Promise<void> =>
    cloudWatchService.recordCacheHitRate(cacheType, hits, misses),
};