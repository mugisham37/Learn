/**
 * Secret Rotation Service
 * 
 * Handles automatic rotation of secrets in production environments.
 * Supports scheduled rotation and manual rotation triggers.
 * 
 * Requirements: 13.7
 */

import { secretsManager } from './SecretsManager.js';
import { logger } from '../utils/logger.js';
import { config } from '../../config/index.js';

/**
 * Rotation schedule configuration
 */
export interface RotationSchedule {
  /** Secret name */
  secretName: string;
  /** Rotation interval in days */
  intervalDays: number;
  /** Whether rotation is enabled */
  enabled: boolean;
  /** Last rotation timestamp */
  lastRotation?: Date;
  /** Next scheduled rotation */
  nextRotation?: Date;
}

/**
 * Rotation result
 */
export interface RotationResult {
  /** Secret name */
  secretName: string;
  /** Whether rotation was successful */
  success: boolean;
  /** Error message if rotation failed */
  error?: string;
  /** Timestamp of rotation attempt */
  timestamp: Date;
  /** Previous version (if available) */
  previousVersion?: string;
  /** New version (if available) */
  newVersion?: string;
}

/**
 * Secret Rotation Service
 */
export class SecretRotationService {
  private static instance: SecretRotationService;
  private rotationSchedules = new Map<string, RotationSchedule>();
  private rotationHistory: RotationResult[] = [];
  private isEnabled: boolean;

  /**
   * Default rotation schedules for different secret types
   */
  private readonly defaultSchedules: Record<string, number> = {
    // Authentication secrets - rotate every 90 days
    jwt_secret: 90,
    session_secret: 90,
    
    // API keys - rotate every 60 days
    stripe_secret_key: 60,
    sendgrid_api_key: 60,
    
    // Database passwords - rotate every 180 days
    redis_password: 180,
    elasticsearch_password: 180,
    
    // AWS credentials - rotate every 30 days
    aws_access_key_id: 30,
    aws_secret_access_key: 30,
    
    // Certificate keys - rotate every 365 days
    certificate_signing_key: 365,
    firebase_private_key: 365,
    cloudfront_private_key_path: 365,
  };

  private constructor() {
    this.isEnabled = config.nodeEnv === 'production';
    this.initializeSchedules();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SecretRotationService {
    if (!SecretRotationService.instance) {
      SecretRotationService.instance = new SecretRotationService();
    }
    return SecretRotationService.instance;
  }

  /**
   * Initialize rotation schedules
   */
  private initializeSchedules(): void {
    const rotatableSecrets = secretsManager.getRotatableSecrets();
    
    for (const secretName of rotatableSecrets) {
      const intervalDays = this.defaultSchedules[secretName] || 90; // Default to 90 days
      
      this.rotationSchedules.set(secretName, {
        secretName,
        intervalDays,
        enabled: this.isEnabled,
        lastRotation: undefined,
        nextRotation: this.calculateNextRotation(new Date(), intervalDays),
      });
    }

    logger.info('Secret rotation schedules initialized', {
      totalSecrets: rotatableSecrets.length,
      enabled: this.isEnabled,
    });
  }

  /**
   * Calculate next rotation date
   */
  private calculateNextRotation(lastRotation: Date, intervalDays: number): Date {
    const nextRotation = new Date(lastRotation);
    nextRotation.setDate(nextRotation.getDate() + intervalDays);
    return nextRotation;
  }

  /**
   * Generate a new secret value
   * This is a basic implementation - in production, you might want more sophisticated generation
   */
  private generateNewSecret(secretName: string): string {
    const crypto = require('crypto');
    
    // Different generation strategies based on secret type
    if (secretName.includes('jwt') || secretName.includes('session')) {
      // Generate a strong random string for JWT/session secrets
      return crypto.randomBytes(64).toString('hex');
    } else if (secretName.includes('api_key')) {
      // Generate API key format
      return `sk_${crypto.randomBytes(32).toString('hex')}`;
    } else if (secretName.includes('password')) {
      // Generate a strong password
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 32; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    } else {
      // Default: random hex string
      return crypto.randomBytes(32).toString('hex');
    }
  }

  /**
   * Rotate a specific secret
   */
  public async rotateSecret(secretName: string, newValue?: string): Promise<RotationResult> {
    const timestamp = new Date();
    
    logger.info(`Starting secret rotation: ${secretName}`);

    try {
      // Get current secret metadata
      const currentMetadata = secretsManager.getSecretMetadata(secretName);
      const previousVersion = currentMetadata?.version;

      // Generate new value if not provided
      const secretValue = newValue || this.generateNewSecret(secretName);

      // Update the secret in AWS Secrets Manager
      await secretsManager.updateSecret(secretName, secretValue);

      // Get new metadata
      const newMetadata = secretsManager.getSecretMetadata(secretName);
      const newVersion = newMetadata?.version;

      // Update rotation schedule
      const schedule = this.rotationSchedules.get(secretName);
      if (schedule) {
        schedule.lastRotation = timestamp;
        schedule.nextRotation = this.calculateNextRotation(timestamp, schedule.intervalDays);
        this.rotationSchedules.set(secretName, schedule);
      }

      const result: RotationResult = {
        secretName,
        success: true,
        timestamp,
        previousVersion,
        newVersion,
      };

      this.rotationHistory.push(result);

      logger.info(`Secret rotation completed successfully: ${secretName}`, {
        previousVersion,
        newVersion,
        nextRotation: schedule?.nextRotation?.toISOString(),
      });

      return result;
    } catch (error) {
      const result: RotationResult = {
        secretName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      };

      this.rotationHistory.push(result);

      logger.error(`Secret rotation failed: ${secretName}`, {
        error: result.error,
      });

      return result;
    }
  }

  /**
   * Rotate all secrets that are due for rotation
   */
  public async rotateExpiredSecrets(): Promise<RotationResult[]> {
    if (!this.isEnabled) {
      logger.info('Secret rotation is disabled (not in production)');
      return [];
    }

    logger.info('Checking for secrets due for rotation');

    const now = new Date();
    const secretsToRotate: string[] = [];

    // Find secrets that are due for rotation
    for (const [secretName, schedule] of this.rotationSchedules) {
      if (schedule.enabled && schedule.nextRotation && schedule.nextRotation <= now) {
        secretsToRotate.push(secretName);
      }
    }

    if (secretsToRotate.length === 0) {
      logger.info('No secrets due for rotation');
      return [];
    }

    logger.info(`Found ${secretsToRotate.length} secrets due for rotation`, {
      secrets: secretsToRotate,
    });

    // Rotate each secret
    const results: RotationResult[] = [];
    for (const secretName of secretsToRotate) {
      try {
        const result = await this.rotateSecret(secretName);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to rotate secret: ${secretName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        results.push({
          secretName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info('Secret rotation batch completed', {
      total: results.length,
      successful: successCount,
      failed: failureCount,
    });

    return results;
  }

  /**
   * Get rotation schedule for a secret
   */
  public getRotationSchedule(secretName: string): RotationSchedule | undefined {
    return this.rotationSchedules.get(secretName);
  }

  /**
   * Update rotation schedule for a secret
   */
  public updateRotationSchedule(secretName: string, schedule: Partial<RotationSchedule>): void {
    const currentSchedule = this.rotationSchedules.get(secretName);
    if (!currentSchedule) {
      throw new Error(`Rotation schedule not found for secret: ${secretName}`);
    }

    const updatedSchedule: RotationSchedule = {
      ...currentSchedule,
      ...schedule,
    };

    // Recalculate next rotation if interval changed
    if (schedule.intervalDays && schedule.intervalDays !== currentSchedule.intervalDays) {
      const lastRotation = updatedSchedule.lastRotation || new Date();
      updatedSchedule.nextRotation = this.calculateNextRotation(lastRotation, schedule.intervalDays);
    }

    this.rotationSchedules.set(secretName, updatedSchedule);

    logger.info(`Rotation schedule updated for secret: ${secretName}`, {
      intervalDays: updatedSchedule.intervalDays,
      enabled: updatedSchedule.enabled,
      nextRotation: updatedSchedule.nextRotation?.toISOString(),
    });
  }

  /**
   * Get all rotation schedules
   */
  public getAllRotationSchedules(): RotationSchedule[] {
    return Array.from(this.rotationSchedules.values());
  }

  /**
   * Get rotation history
   */
  public getRotationHistory(limit?: number): RotationResult[] {
    const history = [...this.rotationHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get secrets that are due for rotation soon (within specified days)
   */
  public getSecretsNearingRotation(withinDays: number = 7): RotationSchedule[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + withinDays);

    return Array.from(this.rotationSchedules.values()).filter(
      schedule => schedule.enabled && 
                 schedule.nextRotation && 
                 schedule.nextRotation <= cutoffDate
    );
  }

  /**
   * Enable or disable secret rotation
   */
  public setRotationEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    // Update all schedules
    for (const [secretName, schedule] of this.rotationSchedules) {
      schedule.enabled = enabled;
      this.rotationSchedules.set(secretName, schedule);
    }

    logger.info(`Secret rotation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Health check for rotation service
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if we can access secrets manager
      const secretNames = secretsManager.getSecretNames();
      
      // Check if rotation schedules are properly initialized
      const scheduleCount = this.rotationSchedules.size;
      
      if (scheduleCount === 0 && secretNames.length > 0) {
        logger.error('Rotation schedules not initialized properly');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Secret rotation service health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

/**
 * Global secret rotation service instance
 */
export const secretRotationService = SecretRotationService.getInstance();