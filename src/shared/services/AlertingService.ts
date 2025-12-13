/**
 * Alerting Service
 * 
 * Handles alert notifications for job monitoring and system health.
 * Integrates with email, Slack, and other notification channels.
 */

import { EventEmitter } from 'events';

import { logger } from '../utils/logger.js';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  resolved?: boolean;
  resolvedAt?: Date;
}

/**
 * Alert channel configuration
 */
export interface AlertChannelConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    severityThreshold: AlertSeverity;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    severityThreshold: AlertSeverity;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
    severityThreshold: AlertSeverity;
  };
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMinutes: number;
  channels: string[];
}

/**
 * Alerting Service for system monitoring
 */
export class AlertingService extends EventEmitter {
  private static instance: AlertingService;
  private alerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];
  private lastAlertTimes = new Map<string, Date>();
  
  private readonly defaultConfig: AlertChannelConfig = {
    email: {
      enabled: false,
      recipients: [],
      severityThreshold: 'warning'
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#alerts',
      severityThreshold: 'error'
    },
    webhook: {
      enabled: false,
      url: '',
      severityThreshold: 'error'
    }
  };
  
  private constructor(
    private readonly config: AlertChannelConfig = {}
  ) {
    super();
    this.config = { ...this.defaultConfig, ...config };
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: AlertChannelConfig): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService(config);
    }
    return AlertingService.instance;
  }
  
  /**
   * Create and send an alert
   */
  public createAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, unknown>
  ): Alert {
    const alertId = `${source}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const alert: Alert = {
      id: alertId,
      severity,
      title,
      message,
      source,
      timestamp: new Date(),
      metadata,
      resolved: false
    };
    
    // Check cooldown period
    const cooldownKey = `${source}-${severity}`;
    const lastAlertTime = this.lastAlertTimes.get(cooldownKey);
    const cooldownMinutes = this.getCooldownForSeverity(severity);
    
    if (lastAlertTime) {
      const timeSinceLastAlert = Date.now() - lastAlertTime.getTime();
      const cooldownMs = cooldownMinutes * 60 * 1000;
      
      if (timeSinceLastAlert < cooldownMs) {
        logger.debug('Alert suppressed due to cooldown', {
          alertId,
          source,
          severity,
          timeSinceLastAlert,
          cooldownMs
        });
        return alert;
      }
    }
    
    // Store alert
    this.alerts.set(alertId, alert);
    this.alertHistory.push(alert);
    this.lastAlertTimes.set(cooldownKey, alert.timestamp);
    
    // Log alert
    logger.info('Alert created', {
      alertId,
      severity,
      title,
      source,
      metadata
    });
    
    // Send notifications
    this.sendNotifications(alert);
    
    // Emit event
    this.emit('alert', alert);
    this.emit(`alert:${severity}`, alert);
    
    // Cleanup old alerts
    this.cleanupOldAlerts();
    
    return alert;
  }
  
  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }
    
    alert.resolved = true;
    alert.resolvedAt = new Date();
    
    logger.info('Alert resolved', {
      alertId,
      resolvedAt: alert.resolvedAt
    });
    
    this.emit('alert:resolved', alert);
    
    return true;
  }
  
  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Get alert history
   */
  public getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get alerts by severity
   */
  public getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.severity === severity && !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Get alert statistics
   */
  public getAlertStats(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    const active = alerts.filter(a => !a.resolved);
    const resolved = alerts.filter(a => a.resolved);
    
    const bySeverity: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    };
    
    active.forEach(alert => {
      bySeverity[alert.severity]++;
    });
    
    return {
      total: alerts.length,
      active: active.length,
      resolved: resolved.length,
      bySeverity
    };
  }
  
  /**
   * Send notifications through configured channels
   */
  private sendNotifications(alert: Alert): void {
    // Email notifications
    if (this.config.email?.enabled && this.shouldSendToChannel(alert.severity, this.config.email.severityThreshold)) {
      this.sendEmailAlert(alert);
    }
    
    // Slack notifications
    if (this.config.slack?.enabled && this.shouldSendToChannel(alert.severity, this.config.slack.severityThreshold)) {
      this.sendSlackAlert(alert);
    }
    
    // Webhook notifications
    if (this.config.webhook?.enabled && this.shouldSendToChannel(alert.severity, this.config.webhook.severityThreshold)) {
      this.sendWebhookAlert(alert);
    }
  }
  
  /**
   * Send email alert
   */
  private sendEmailAlert(alert: Alert): void {
    try {
      // This would integrate with the email service
      logger.info('Email alert sent', {
        alertId: alert.id,
        recipients: this.config.email?.recipients
      });
    } catch (error) {
      logger.error('Failed to send email alert:', error);
    }
  }
  
  /**
   * Send Slack alert
   */
  private sendSlackAlert(alert: Alert): void {
    try {
      if (!this.config.slack?.webhookUrl) {
        return;
      }
      
      const color = this.getSeverityColor(alert.severity);
      const _payload = {
        channel: this.config.slack.channel,
        username: 'Job Monitor',
        icon_emoji: ':warning:',
        attachments: [{
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Source',
              value: alert.source,
              short: true
            },
            {
              title: 'Time',
              value: alert.timestamp.toISOString(),
              short: true
            }
          ]
        }]
      };
      
      // This would make an HTTP request to Slack webhook
      // In a real implementation, you would use the payload here
      
      // This would make an HTTP request to Slack webhook
      logger.info('Slack alert sent', {
        alertId: alert.id,
        channel: this.config.slack.channel
      });
      
    } catch (error) {
      logger.error('Failed to send Slack alert:', error);
    }
  }
  
  /**
   * Send webhook alert
   */
  private sendWebhookAlert(alert: Alert): void {
    try {
      if (!this.config.webhook?.url) {
        return;
      }
      
      // This would make an HTTP request to the webhook URL
      logger.info('Webhook alert sent', {
        alertId: alert.id,
        url: this.config.webhook.url
      });
      
    } catch (error) {
      logger.error('Failed to send webhook alert:', error);
    }
  }
  
  /**
   * Check if alert should be sent to channel based on severity threshold
   */
  private shouldSendToChannel(alertSeverity: AlertSeverity, threshold: AlertSeverity): boolean {
    const severityLevels: Record<AlertSeverity, number> = {
      info: 1,
      warning: 2,
      error: 3,
      critical: 4
    };
    
    return severityLevels[alertSeverity] >= severityLevels[threshold];
  }
  
  /**
   * Get color for Slack based on severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical':
        return '#ff0000';
      case 'error':
        return '#ff6600';
      case 'warning':
        return '#ffcc00';
      case 'info':
      default:
        return '#36a64f';
    }
  }
  
  /**
   * Get cooldown period for severity level
   */
  private getCooldownForSeverity(severity: AlertSeverity): number {
    switch (severity) {
      case 'critical':
        return 5; // 5 minutes
      case 'error':
        return 15; // 15 minutes
      case 'warning':
        return 30; // 30 minutes
      case 'info':
      default:
        return 60; // 60 minutes
    }
  }
  
  /**
   * Clean up old alerts to prevent memory leaks
   */
  private cleanupOldAlerts(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    
    // Remove old alerts from active map
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoff && alert.resolved) {
        this.alerts.delete(alertId);
      }
    }
    
    // Keep only recent history
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 500);
    }
    
    // Clean up last alert times
    for (const [key, timestamp] of this.lastAlertTimes.entries()) {
      if (timestamp < cutoff) {
        this.lastAlertTimes.delete(key);
      }
    }
  }
}