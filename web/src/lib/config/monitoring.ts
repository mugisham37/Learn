/**
 * Configuration Monitoring and Health Checks
 * 
 * Provides monitoring capabilities for configuration health and service status.
 */

import { config, authConfig, uploadConfig, awsConfig, errorTrackingConfig } from '../config';
import type { ServiceStatus } from '@/types';

export interface ConfigurationHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceStatus[];
  lastCheck: Date;
  issues: string[];
}

/**
 * Check GraphQL endpoint health
 */
async function checkGraphQLHealth(): Promise<ServiceStatus> {
  try {
    const response = await fetch(config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ __typename }',
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      return {
        name: 'GraphQL API',
        status: 'healthy',
        lastCheck: new Date(),
      };
    } else {
      return {
        name: 'GraphQL API',
        status: 'degraded',
        lastCheck: new Date(),
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      name: 'GraphQL API',
      status: 'unhealthy',
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check WebSocket endpoint health
 */
async function checkWebSocketHealth(): Promise<ServiceStatus> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(config.wsEndpoint);
      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          name: 'WebSocket',
          status: 'unhealthy',
          lastCheck: new Date(),
          error: 'Connection timeout',
        });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          name: 'WebSocket',
          status: 'healthy',
          lastCheck: new Date(),
        });
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          name: 'WebSocket',
          status: 'unhealthy',
          lastCheck: new Date(),
          error: 'Connection failed',
        });
      };
    } catch (error) {
      resolve({
        name: 'WebSocket',
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

/**
 * Check authentication configuration health
 */
function checkAuthHealth(): ServiceStatus {
  const issues: string[] = [];

  if (!authConfig.jwtSecret || authConfig.jwtSecret.length < 32) {
    issues.push('JWT secret is too short or missing');
  }

  if (authConfig.jwtSecret === 'development-secret-key' && config.appEnv === 'production') {
    issues.push('Using development JWT secret in production');
  }

  if (!authConfig.tokenStorageKey) {
    issues.push('Token storage key is missing');
  }

  return {
    name: 'Authentication',
    status: issues.length === 0 ? 'healthy' : 'degraded',
    lastCheck: new Date(),
    error: issues.length > 0 ? issues.join(', ') : undefined,
  };
}

/**
 * Check upload configuration health
 */
function checkUploadHealth(): ServiceStatus {
  const issues: string[] = [];

  if (config.features.fileUploads) {
    if (!awsConfig.s3BucketName) {
      issues.push('S3 bucket name is missing');
    }

    if (!awsConfig.region) {
      issues.push('AWS region is missing');
    }

    if (!uploadConfig.allowedFileTypes || uploadConfig.allowedFileTypes.length === 0) {
      issues.push('No allowed file types configured');
    }
  }

  return {
    name: 'File Upload',
    status: issues.length === 0 ? 'healthy' : config.features.fileUploads ? 'degraded' : 'healthy',
    lastCheck: new Date(),
    error: issues.length > 0 ? issues.join(', ') : undefined,
  };
}

/**
 * Check error tracking configuration health
 */
function checkErrorTrackingHealth(): ServiceStatus {
  const issues: string[] = [];

  if (config.appEnv === 'production' && !errorTrackingConfig.sentryDsn) {
    issues.push('Sentry DSN is missing in production');
  }

  if (errorTrackingConfig.sampleRate > 1.0 || errorTrackingConfig.sampleRate < 0) {
    issues.push('Invalid sample rate (must be between 0 and 1)');
  }

  return {
    name: 'Error Tracking',
    status: issues.length === 0 ? 'healthy' : 'degraded',
    lastCheck: new Date(),
    error: issues.length > 0 ? issues.join(', ') : undefined,
  };
}

/**
 * Perform comprehensive configuration health check
 */
export async function checkConfigurationHealth(): Promise<ConfigurationHealth> {
  console.log('🔍 Checking configuration health...');

  const services: ServiceStatus[] = [];
  const issues: string[] = [];

  // Check all services
  try {
    const [graphqlHealth, wsHealth] = await Promise.all([
      checkGraphQLHealth(),
      checkWebSocketHealth(),
    ]);

    services.push(graphqlHealth, wsHealth);
    services.push(checkAuthHealth());
    services.push(checkUploadHealth());
    services.push(checkErrorTrackingHealth());
  } catch (error) {
    issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Determine overall health
  const unhealthyServices = services.filter(s => s.status === 'unhealthy');
  const degradedServices = services.filter(s => s.status === 'degraded');

  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (unhealthyServices.length > 0) {
    overall = 'unhealthy';
  } else if (degradedServices.length > 0) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  // Collect issues from services
  services.forEach(service => {
    if (service.error) {
      issues.push(`${service.name}: ${service.error}`);
    }
  });

  const health: ConfigurationHealth = {
    overall,
    services,
    lastCheck: new Date(),
    issues,
  };

  // Log results
  console.log(`📊 Configuration health: ${overall.toUpperCase()}`);
  if (issues.length > 0) {
    console.warn('⚠️  Configuration issues found:');
    issues.forEach(issue => console.warn(`  - ${issue}`));
  }

  return health;
}

/**
 * Monitor configuration health continuously
 */
export class ConfigurationMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private lastHealth: ConfigurationHealth | null = null;
  private listeners: Array<(health: ConfigurationHealth) => void> = [];

  constructor(private checkInterval: number = 60000) {} // Default: 1 minute

  /**
   * Start monitoring
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Configuration monitor is already running');
      return;
    }

    console.log('🔄 Starting configuration monitor...');
    
    // Initial check
    this.performCheck();

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, this.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️  Configuration monitor stopped');
    }
  }

  /**
   * Add health change listener
   */
  onHealthChange(listener: (health: ConfigurationHealth) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove health change listener
   */
  removeHealthChangeListener(listener: (health: ConfigurationHealth) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Get last health check result
   */
  getLastHealth(): ConfigurationHealth | null {
    return this.lastHealth;
  }

  /**
   * Perform health check and notify listeners
   */
  private async performCheck(): Promise<void> {
    try {
      const health = await checkConfigurationHealth();
      
      // Check if health status changed
      const statusChanged = !this.lastHealth || this.lastHealth.overall !== health.overall;
      
      this.lastHealth = health;

      // Notify listeners if status changed
      if (statusChanged) {
        this.listeners.forEach(listener => {
          try {
            listener(health);
          } catch (error) {
            console.error('Error in health change listener:', error);
          }
        });
      }
    } catch (error) {
      console.error('Configuration health check failed:', error);
    }
  }
}

// Export singleton monitor instance
export const configurationMonitor = new ConfigurationMonitor();

/**
 * Initialize configuration monitoring
 */
export function initializeConfigurationMonitoring(): void {
  // Start monitoring in non-production environments or when explicitly enabled
  if (config.appEnv !== 'production' || config.performanceMonitoring.enabled) {
    configurationMonitor.start();

    // Log health changes
    configurationMonitor.onHealthChange((health) => {
      if (health.overall === 'unhealthy') {
        console.error('🚨 Configuration health is UNHEALTHY');
      } else if (health.overall === 'degraded') {
        console.warn('⚠️  Configuration health is DEGRADED');
      } else {
        console.log('✅ Configuration health is HEALTHY');
      }
    });
  }
}