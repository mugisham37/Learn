/**
 * CloudWatch Initializer
 *
 * Handles initial setup of CloudWatch log groups and configuration.
 * Creates required log groups with appropriate retention policies.
 *
 * Requirements: 17.4
 */

import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

import { cloudWatchService } from './CloudWatchService.js';

/**
 * Log group configuration
 */
interface LogGroupConfig {
  name: string;
  retentionDays: number;
  description: string;
}

/**
 * Default log groups to create
 */
const DEFAULT_LOG_GROUPS: LogGroupConfig[] = [
  {
    name: '/aws/learning-platform/application',
    retentionDays: 30,
    description: 'Main application logs',
  },
  {
    name: '/aws/learning-platform/errors',
    retentionDays: 90,
    description: 'Error logs for debugging',
  },
  {
    name: '/aws/learning-platform/access',
    retentionDays: 30,
    description: 'HTTP access logs',
  },
  {
    name: '/aws/learning-platform/security',
    retentionDays: 365,
    description: 'Security-related logs',
  },
  {
    name: '/aws/learning-platform/performance',
    retentionDays: 14,
    description: 'Performance metrics and monitoring',
  },
  {
    name: '/aws/learning-platform/background-jobs',
    retentionDays: 30,
    description: 'Background job processing logs',
  },
  {
    name: '/aws/learning-platform/database',
    retentionDays: 14,
    description: 'Database query and performance logs',
  },
  {
    name: '/aws/learning-platform/external-services',
    retentionDays: 30,
    description: 'External service integration logs',
  },
];

/**
 * CloudWatch initializer class
 */
export class CloudWatchInitializer {
  /**
   * Initialize CloudWatch log groups and configuration
   */
  static async initialize(): Promise<void> {
    try {
      logger.info('Initializing CloudWatch integration...');

      // Check if CloudWatch service is healthy
      const isHealthy = await cloudWatchService.isHealthy();
      if (!isHealthy) {
        logger.warn('CloudWatch service is not available, skipping initialization');
        return;
      }

      // Create default log groups
      await this.createDefaultLogGroups();

      // Create custom log groups from configuration
      await this.createCustomLogGroups();

      // Create log streams for immediate use
      await this.createInitialLogStreams();

      logger.info('CloudWatch integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CloudWatch integration', { error });
      // Don't throw error to prevent application startup failure
    }
  }

  /**
   * Create default log groups
   */
  private static async createDefaultLogGroups(): Promise<void> {
    logger.info('Creating default CloudWatch log groups...');

    for (const logGroup of DEFAULT_LOG_GROUPS) {
      try {
        await cloudWatchService.ensureLogGroupExists(logGroup.name, logGroup.retentionDays);
        logger.debug(`Ensured log group exists: ${logGroup.name}`);
      } catch (error) {
        logger.error(`Failed to create log group: ${logGroup.name}`, { error });
      }
    }
  }

  /**
   * Create custom log groups from configuration
   */
  private static async createCustomLogGroups(): Promise<void> {
    // Create the main application log group from config
    if (config.cloudwatch.logGroup) {
      try {
        await cloudWatchService.ensureLogGroupExists(config.cloudwatch.logGroup, 30);
        logger.debug(`Ensured configured log group exists: ${config.cloudwatch.logGroup}`);
      } catch (error) {
        logger.error(`Failed to create configured log group: ${config.cloudwatch.logGroup}`, {
          error,
        });
      }
    }
  }

  /**
   * Create initial log streams
   */
  private static async createInitialLogStreams(): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const instanceId = process.env['INSTANCE_ID'] || 'default';

    const logStreams = [
      {
        logGroup: config.cloudwatch.logGroup || '/aws/learning-platform/application',
        streamName: `${config.cloudwatch.logStream || 'application'}-${timestamp}-${instanceId}`,
      },
      {
        logGroup: '/aws/learning-platform/errors',
        streamName: `errors-${timestamp}-${instanceId}`,
      },
      {
        logGroup: '/aws/learning-platform/access',
        streamName: `access-${timestamp}-${instanceId}`,
      },
    ];

    for (const stream of logStreams) {
      try {
        await cloudWatchService.createLogStream(stream.logGroup, stream.streamName);
        logger.debug(`Created log stream: ${stream.streamName} in ${stream.logGroup}`);
      } catch (error) {
        logger.error(`Failed to create log stream: ${stream.streamName}`, { error });
      }
    }
  }

  /**
   * Setup log rotation configuration
   * This configures automatic log rotation policies
   */
  static setupLogRotation(): void {
    try {
      logger.info('Setting up CloudWatch log rotation policies...');

      // Log rotation is handled automatically by CloudWatch retention policies
      // which were set during log group creation

      // Additional rotation logic can be added here if needed
      // For example, creating new log streams daily or weekly

      logger.info('CloudWatch log rotation policies configured');
    } catch (error) {
      logger.error('Failed to setup log rotation', { error });
    }
  }

  /**
   * Create application-specific log groups
   */
  static async createApplicationLogGroups(): Promise<void> {
    const applicationLogGroups: LogGroupConfig[] = [
      {
        name: '/aws/learning-platform/auth',
        retentionDays: 90,
        description: 'Authentication and authorization logs',
      },
      {
        name: '/aws/learning-platform/courses',
        retentionDays: 30,
        description: 'Course management logs',
      },
      {
        name: '/aws/learning-platform/assessments',
        retentionDays: 60,
        description: 'Quiz and assignment logs',
      },
      {
        name: '/aws/learning-platform/payments',
        retentionDays: 365,
        description: 'Payment processing logs',
      },
      {
        name: '/aws/learning-platform/video-processing',
        retentionDays: 30,
        description: 'Video transcoding and processing logs',
      },
      {
        name: '/aws/learning-platform/notifications',
        retentionDays: 30,
        description: 'Notification delivery logs',
      },
      {
        name: '/aws/learning-platform/analytics',
        retentionDays: 90,
        description: 'Analytics and reporting logs',
      },
    ];

    for (const logGroup of applicationLogGroups) {
      try {
        await cloudWatchService.ensureLogGroupExists(logGroup.name, logGroup.retentionDays);
        logger.debug(`Created application log group: ${logGroup.name}`);
      } catch (error) {
        logger.error(`Failed to create application log group: ${logGroup.name}`, { error });
      }
    }
  }

  /**
   * Validate CloudWatch configuration
   */
  static async validateConfiguration(): Promise<boolean> {
    try {
      // Check if CloudWatch service is available
      const isHealthy = await cloudWatchService.isHealthy();
      if (!isHealthy) {
        logger.error('CloudWatch service health check failed');
        return false;
      }

      // Validate required configuration
      if (!config.cloudwatch.logGroup) {
        logger.error('CloudWatch log group not configured');
        return false;
      }

      if (!config.cloudwatch.logStream) {
        logger.error('CloudWatch log stream not configured');
        return false;
      }

      logger.info('CloudWatch configuration validation passed');
      return true;
    } catch (error) {
      logger.error('CloudWatch configuration validation failed', { error });
      return false;
    }
  }
}

/**
 * Initialize CloudWatch on module load in production
 */
if (config.nodeEnv === 'production') {
  // Initialize CloudWatch asynchronously without blocking startup
  CloudWatchInitializer.initialize().catch((error) => {
    logger.error('CloudWatch initialization failed during module load', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });
}

// Export is already done above with the class declaration
