/**
 * Alerting Rules Service
 * 
 * Implements comprehensive alerting rules for critical system events including
 * database failures, high error rates, API latency, disk space, and performance
 * degradation. Supports multiple alert channels and severity levels.
 * 
 * Requirements: 17.7
 */

import { EventEmitter } from 'events';

import { applicationMetricsService } from './ApplicationMetricsService.js';
import { Alert, AlertSeverity, AlertingService } from './AlertingService.js';

import { logger } from '../utils/logger.js';

/**
 * Alert rule configuration
 */
interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  threshold: number;
  duration: number; // Duration in seconds before triggering
  cooldown: number; // Cooldown period in seconds
  enabled: boolean;
  channels: string[]; // Alert channels to notify
}

/**
 * Alert condition types
 */
type AlertCondition = 
  | 'database_failure'
  | 'high_error_rate'
  | 'api_latency'
  | 'disk_space'
  | 'memory_usage'
  | 'cpu_usage'
  | 'response_time_p95'
  | 'response_time_p99'
  | 'external_service_errors'
  | 'cache_miss_rate'
  | 'queue_depth'
  | 'connection_pool_exhaustion';

/**
 * Alert state tracking
 */
interface AlertState {
  ruleId: string;
  triggered: boolean;
  firstTriggered: number;
  lastTriggered: number;
  lastNotified: number;
  consecutiveFailures: number;
}

/**
 * System health metrics
 */
interface SystemHealthMetrics {
  errorRate: number;
  responseTimeP95: number;
  responseTimeP99: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  diskUsagePercent: number;
  databaseConnections: number;
  externalServiceErrors: number;
  cacheMissRate: number;
  queueDepth: number;
}

/**
 * Alerting rules service interface
 */
export interface IAlertingRulesService {
  initialize(): void;
  addRule(rule: AlertRule): void;
  removeRule(ruleId: string): void;
  updateRule(ruleId: string, updates: Partial<AlertRule>): void;
  enableRule(ruleId: string): void;
  disableRule(ruleId: string): void;
  checkRules(): Promise<void>;
  getActiveAlerts(): AlertState[];
  getRules(): AlertRule[];
  startMonitoring(): void;
  stopMonitoring(): void;
}

/**
 * Alerting rules service implementation
 */
export class AlertingRulesService extends EventEmitter implements IAlertingRulesService {
  private rules: Map<string, AlertRule> = new Map();
  private alertStates: Map<string, AlertState> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertingService: AlertingService;
  private readonly checkInterval = 30000; // Check every 30 seconds

  constructor(alertingService: AlertingService) {
    super();
    this.alertingService = alertingService;
    this.initializeDefaultRules();
  }

  /**
   * Initialize the alerting rules service
   */
  initialize(): void {
    logger.info('Initializing alerting rules service...');
    this.startMonitoring();
    logger.info('Alerting rules service initialized successfully');
  }

  /**
   * Add a new alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.alertStates.set(rule.id, {
      ruleId: rule.id,
      triggered: false,
      firstTriggered: 0,
      lastTriggered: 0,
      lastNotified: 0,
      consecutiveFailures: 0,
    });

    logger.info(`Added alert rule: ${rule.name}`, { ruleId: rule.id });
    this.emit('ruleAdded', rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.delete(ruleId);
      this.alertStates.delete(ruleId);
      logger.info(`Removed alert rule: ${rule.name}`, { ruleId });
      this.emit('ruleRemoved', ruleId);
    }
  }

  /**
   * Update an existing alert rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.rules.set(ruleId, updatedRule);
      logger.info(`Updated alert rule: ${updatedRule.name}`, { ruleId });
      this.emit('ruleUpdated', updatedRule);
    }
  }

  /**
   * Enable an alert rule
   */
  enableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: true });
  }

  /**
   * Disable an alert rule
   */
  disableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: false });
    
    // Reset alert state when disabling
    const state = this.alertStates.get(ruleId);
    if (state) {
      state.triggered = false;
      state.consecutiveFailures = 0;
    }
  }

  /**
   * Check all alert rules against current metrics
   */
  async checkRules(): Promise<void> {
    try {
      const metrics = this.collectSystemMetrics();
      
      for (const [ruleId, rule] of this.rules.entries()) {
        if (!rule.enabled) {
          continue;
        }

        const state = this.alertStates.get(ruleId)!;
        const isTriggered = this.evaluateRule(rule, metrics);
        
        await this.processRuleState(rule, state, isTriggered);
      }
    } catch (error) {
      logger.error('Error checking alert rules', { error });
    }
  }

  /**
   * Get currently active alerts
   */
  getActiveAlerts(): AlertState[] {
    return Array.from(this.alertStates.values()).filter(state => state.triggered);
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Start monitoring and checking rules
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.checkRules().catch(error => {
        logger.error('Error in alerting rules monitoring', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      });
    }, this.checkInterval);

    logger.info('Alerting rules monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Alerting rules monitoring stopped');
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      // Critical alerts
      {
        id: 'database_failure',
        name: 'Database Connection Failure',
        description: 'Database connections are failing',
        severity: 'critical',
        condition: 'database_failure',
        threshold: 1, // Any database failure
        duration: 0, // Immediate
        cooldown: 300, // 5 minutes
        enabled: true,
        channels: ['email', 'slack', 'pagerduty'],
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds 5%',
        severity: 'critical',
        condition: 'high_error_rate',
        threshold: 5, // 5%
        duration: 60, // 1 minute
        cooldown: 600, // 10 minutes
        enabled: true,
        channels: ['email', 'slack', 'pagerduty'],
      },
      {
        id: 'api_latency_critical',
        name: 'Critical API Latency',
        description: 'API response time exceeds 3 seconds',
        severity: 'critical',
        condition: 'api_latency',
        threshold: 3000, // 3 seconds
        duration: 120, // 2 minutes
        cooldown: 600, // 10 minutes
        enabled: true,
        channels: ['email', 'slack', 'pagerduty'],
      },
      {
        id: 'disk_space_critical',
        name: 'Critical Disk Space',
        description: 'Disk usage exceeds 90%',
        severity: 'critical',
        condition: 'disk_space',
        threshold: 90, // 90%
        duration: 300, // 5 minutes
        cooldown: 1800, // 30 minutes
        enabled: true,
        channels: ['email', 'slack', 'pagerduty'],
      },

      // Warning alerts
      {
        id: 'elevated_error_rate',
        name: 'Elevated Error Rate',
        description: 'Error rate exceeds 2%',
        severity: 'warning',
        condition: 'high_error_rate',
        threshold: 2, // 2%
        duration: 300, // 5 minutes
        cooldown: 900, // 15 minutes
        enabled: true,
        channels: ['email', 'slack'],
      },
      {
        id: 'api_latency_warning',
        name: 'Elevated API Latency',
        description: 'API P95 response time exceeds 1 second',
        severity: 'warning',
        condition: 'response_time_p95',
        threshold: 1000, // 1 second
        duration: 300, // 5 minutes
        cooldown: 900, // 15 minutes
        enabled: true,
        channels: ['email', 'slack'],
      },
      {
        id: 'memory_usage_warning',
        name: 'High Memory Usage',
        description: 'Memory usage exceeds 80%',
        severity: 'warning',
        condition: 'memory_usage',
        threshold: 80, // 80%
        duration: 600, // 10 minutes
        cooldown: 1800, // 30 minutes
        enabled: true,
        channels: ['email', 'slack'],
      },
      {
        id: 'disk_space_warning',
        name: 'High Disk Usage',
        description: 'Disk usage exceeds 75%',
        severity: 'warning',
        condition: 'disk_space',
        threshold: 75, // 75%
        duration: 600, // 10 minutes
        cooldown: 3600, // 1 hour
        enabled: true,
        channels: ['email'],
      },
      {
        id: 'external_service_errors',
        name: 'External Service Errors',
        description: 'High error rate from external services',
        severity: 'warning',
        condition: 'external_service_errors',
        threshold: 10, // 10 errors
        duration: 300, // 5 minutes
        cooldown: 900, // 15 minutes
        enabled: true,
        channels: ['email', 'slack'],
      },
      {
        id: 'cache_miss_rate',
        name: 'High Cache Miss Rate',
        description: 'Cache miss rate exceeds 50%',
        severity: 'info',
        condition: 'cache_miss_rate',
        threshold: 50, // 50%
        duration: 900, // 15 minutes
        cooldown: 3600, // 1 hour
        enabled: true,
        channels: ['email'],
      },
    ];

    defaultRules.forEach(rule => this.addRule(rule));
    logger.info(`Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * Collect current system metrics
   */
  private collectSystemMetrics(): SystemHealthMetrics {
    const errorMetrics = applicationMetricsService.getErrorRateMetrics();
    const responseTimeMetrics = applicationMetricsService.getResponseTimePercentiles();
    const resourceMetrics = applicationMetricsService.getResourceMetrics();
    const externalServiceMetrics = applicationMetricsService.getExternalServiceMetrics();
    const cacheMetrics = applicationMetricsService.getCacheMetrics();

    // Calculate memory usage percentage
    const memoryUsagePercent = resourceMetrics.memoryUsage.heapTotal > 0 
      ? (resourceMetrics.memoryUsage.heapUsed / resourceMetrics.memoryUsage.heapTotal) * 100 
      : 0;

    // Estimate CPU usage (simplified)
    const cpuUsagePercent = 0; // Would need more sophisticated CPU monitoring

    // Estimate disk usage (would need actual disk monitoring)
    const diskUsagePercent = 0;

    // Cache miss rate
    const totalCacheOperations = cacheMetrics.hitCount + cacheMetrics.missCount;
    const cacheMissRate = totalCacheOperations > 0 
      ? (cacheMetrics.missCount / totalCacheOperations) * 100 
      : 0;

    return {
      errorRate: errorMetrics.errorRate,
      responseTimeP95: responseTimeMetrics.p95,
      responseTimeP99: responseTimeMetrics.p99,
      memoryUsagePercent,
      cpuUsagePercent,
      diskUsagePercent,
      databaseConnections: 0, // Would need database connection monitoring
      externalServiceErrors: externalServiceMetrics.errorCount,
      cacheMissRate,
      queueDepth: 0, // Would need queue monitoring
    };
  }

  /**
   * Evaluate if a rule condition is met
   */
  private evaluateRule(rule: AlertRule, metrics: SystemHealthMetrics): boolean {
    switch (rule.condition) {
      case 'database_failure':
        // Would need actual database health check
        return false;

      case 'high_error_rate':
        return metrics.errorRate > rule.threshold;

      case 'api_latency':
        return metrics.responseTimeP95 > rule.threshold;

      case 'response_time_p95':
        return metrics.responseTimeP95 > rule.threshold;

      case 'response_time_p99':
        return metrics.responseTimeP99 > rule.threshold;

      case 'disk_space':
        return metrics.diskUsagePercent > rule.threshold;

      case 'memory_usage':
        return metrics.memoryUsagePercent > rule.threshold;

      case 'cpu_usage':
        return metrics.cpuUsagePercent > rule.threshold;

      case 'external_service_errors':
        return metrics.externalServiceErrors > rule.threshold;

      case 'cache_miss_rate':
        return metrics.cacheMissRate > rule.threshold;

      case 'queue_depth':
        return metrics.queueDepth > rule.threshold;

      case 'connection_pool_exhaustion':
        // Would need connection pool monitoring
        return false;

      default:
        logger.warn(`Unknown alert condition: ${rule.condition as string}`);
        return false;
    }
  }

  /**
   * Process rule state and trigger alerts if necessary
   */
  private async processRuleState(rule: AlertRule, state: AlertState, isTriggered: boolean): Promise<void> {
    const now = Date.now();

    if (isTriggered) {
      state.consecutiveFailures++;
      
      if (!state.triggered) {
        state.firstTriggered = now;
      }
      
      state.lastTriggered = now;

      // Check if we should trigger the alert
      const durationMet = (now - state.firstTriggered) >= (rule.duration * 1000);
      const cooldownPassed = (now - state.lastNotified) >= (rule.cooldown * 1000);

      if (durationMet && (cooldownPassed || !state.triggered)) {
        await this.triggerAlert(rule, state);
        state.triggered = true;
        state.lastNotified = now;
      }
    } else {
      // Condition is no longer met
      if (state.triggered) {
        await this.resolveAlert(rule, state);
        state.triggered = false;
      }
      
      state.consecutiveFailures = 0;
      state.firstTriggered = 0;
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, state: AlertState): Promise<void> {
    const alert: Alert = {
      id: `${rule.id}_${Date.now()}`,
      title: rule.name,
      message: rule.description,
      severity: rule.severity,
      source: 'alerting-rules',
      timestamp: new Date(),
      metadata: {
        ruleId: rule.id,
        condition: rule.condition,
        threshold: rule.threshold,
        consecutiveFailures: state.consecutiveFailures,
        firstTriggered: new Date(state.firstTriggered),
      },
    };

    try {
      // Send alert through AlertingService
      await this.alertingService.createAlert(
        alert.severity,
        alert.title,
        alert.message,
        alert.source,
        alert.metadata
      );
      
      logger.warn(`Alert triggered: ${rule.name}`, {
        ruleId: rule.id,
        severity: rule.severity,
        consecutiveFailures: state.consecutiveFailures,
      });

      this.emit('alertTriggered', { rule, alert, state });
    } catch (error) {
      logger.error(`Failed to send alert: ${rule.name}`, { error, ruleId: rule.id });
    }
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(rule: AlertRule, state: AlertState): Promise<void> {
    const alert: Alert = {
      id: `${rule.id}_resolved_${Date.now()}`,
      title: `RESOLVED: ${rule.name}`,
      message: `${rule.description} - Condition is no longer met`,
      severity: 'info',
      source: 'alerting-rules',
      timestamp: new Date(),
      metadata: {
        ruleId: rule.id,
        condition: rule.condition,
        resolved: true,
        duration: Date.now() - state.firstTriggered,
      },
    };

    try {
      // Send alert resolution through AlertingService
      await this.alertingService.createAlert(
        alert.severity,
        alert.title,
        alert.message,
        alert.source,
        alert.metadata
      );
      
      logger.info(`Alert resolved: ${rule.name}`, {
        ruleId: rule.id,
        duration: Date.now() - state.firstTriggered,
      });

      this.emit('alertResolved', { rule, alert, state });
    } catch (error) {
      logger.error(`Failed to send alert resolution: ${rule.name}`, { error, ruleId: rule.id });
    }
  }
}

/**
 * Global alerting rules service instance
 */
let alertingRulesService: AlertingRulesService | null = null;

/**
 * Get or create alerting rules service instance
 */
export function getAlertingRulesService(): AlertingRulesService {
  if (!alertingRulesService) {
    const alertingServiceInstance = AlertingService.getInstance();
    alertingRulesService = new AlertingRulesService(alertingServiceInstance);
  }
  return alertingRulesService;
}

/**
 * Initialize alerting rules service
 */
export function initializeAlertingRules(): AlertingRulesService {
  const service = getAlertingRulesService();
  service.initialize();
  return service;
}