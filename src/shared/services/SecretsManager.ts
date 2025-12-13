/**
 * Secrets Management Service
 *
 * Provides centralized secrets management with support for:
 * - Environment variables (development/testing)
 * - AWS Secrets Manager (production)
 * - Secret validation and rotation
 * - Secure secret handling without logging
 *
 * Requirements: 13.7
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

import { config } from '../../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Interface for secret configuration
 */
export interface SecretConfig {
  /** Secret name/key */
  name: string;
  /** Environment variable name */
  envVar: string;
  /** AWS Secrets Manager secret name (for production) */
  awsSecretName?: string;
  /** Whether this secret is required */
  required: boolean;
  /** Default value (only for non-required secrets) */
  defaultValue?: string;
  /** Whether this secret supports rotation */
  rotatable?: boolean;
}

/**
 * Secret value with metadata
 */
export interface SecretValue {
  /** The actual secret value */
  value: string;
  /** When the secret was last updated */
  lastUpdated?: Date;
  /** Version of the secret (for rotation) */
  version?: string;
}

/**
 * Secrets Manager Service
 */
export class SecretsManager {
  private static instance: SecretsManager;
  private secretsCache = new Map<string, SecretValue>();
  private awsClient?: SecretsManagerClient;
  private isProduction: boolean;

  /**
   * Secret configurations for the application
   */
  private readonly secretConfigs: SecretConfig[] = [
    // Authentication secrets
    {
      name: 'jwt_secret',
      envVar: 'JWT_SECRET',
      awsSecretName: 'learning-platform/jwt-secret',
      required: true,
      rotatable: true,
    },
    {
      name: 'session_secret',
      envVar: 'SESSION_SECRET',
      awsSecretName: 'learning-platform/session-secret',
      required: true,
      rotatable: true,
    },

    // Database secrets
    {
      name: 'database_url',
      envVar: 'DATABASE_URL',
      awsSecretName: 'learning-platform/database-url',
      required: true,
      rotatable: false,
    },
    {
      name: 'redis_password',
      envVar: 'REDIS_PASSWORD',
      awsSecretName: 'learning-platform/redis-password',
      required: false,
      defaultValue: '',
      rotatable: true,
    },

    // AWS secrets
    {
      name: 'aws_access_key_id',
      envVar: 'AWS_ACCESS_KEY_ID',
      awsSecretName: 'learning-platform/aws-credentials',
      required: false,
      rotatable: true,
    },
    {
      name: 'aws_secret_access_key',
      envVar: 'AWS_SECRET_ACCESS_KEY',
      awsSecretName: 'learning-platform/aws-credentials',
      required: false,
      rotatable: true,
    },

    // Third-party service secrets
    {
      name: 'stripe_secret_key',
      envVar: 'STRIPE_SECRET_KEY',
      awsSecretName: 'learning-platform/stripe-secret-key',
      required: false,
      rotatable: true,
    },
    {
      name: 'stripe_webhook_secret',
      envVar: 'STRIPE_WEBHOOK_SECRET',
      awsSecretName: 'learning-platform/stripe-webhook-secret',
      required: false,
      rotatable: true,
    },
    {
      name: 'sendgrid_api_key',
      envVar: 'SENDGRID_API_KEY',
      awsSecretName: 'learning-platform/sendgrid-api-key',
      required: false,
      rotatable: true,
    },
    {
      name: 'elasticsearch_password',
      envVar: 'ELASTICSEARCH_PASSWORD',
      awsSecretName: 'learning-platform/elasticsearch-password',
      required: false,
      defaultValue: 'changeme',
      rotatable: true,
    },

    // Firebase secrets
    {
      name: 'firebase_private_key',
      envVar: 'FIREBASE_PRIVATE_KEY',
      awsSecretName: 'learning-platform/firebase-private-key',
      required: false,
      rotatable: true,
    },

    // CloudFront secrets
    {
      name: 'cloudfront_private_key_path',
      envVar: 'CLOUDFRONT_PRIVATE_KEY_PATH',
      awsSecretName: 'learning-platform/cloudfront-private-key',
      required: false,
      rotatable: true,
    },

    // Certificate signing
    {
      name: 'certificate_signing_key',
      envVar: 'CERTIFICATE_SIGNING_KEY',
      awsSecretName: 'learning-platform/certificate-signing-key',
      required: false,
      rotatable: true,
    },
  ];

  private constructor() {
    this.isProduction = config.nodeEnv === 'production';

    // Initialize AWS Secrets Manager client for production
    if (this.isProduction) {
      // Use environment variables for initial AWS credentials to bootstrap secrets manager
      const awsAccessKeyId = process.env['AWS_ACCESS_KEY_ID'];
      const awsSecretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];

      this.awsClient = new SecretsManagerClient({
        region: config.aws.region,
        credentials:
          awsAccessKeyId && awsSecretAccessKey
            ? {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
              }
            : undefined, // Use default credential chain if not provided
      });
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Initialize secrets manager and load all secrets
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing secrets manager', {
      environment: config.nodeEnv,
      useAwsSecretsManager: this.isProduction,
    });

    // Load all secrets
    for (const secretConfig of this.secretConfigs) {
      try {
        await this.loadSecret(secretConfig);
      } catch (error) {
        if (secretConfig.required) {
          logger.error(`Failed to load required secret: ${secretConfig.name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            secretName: secretConfig.name,
          });
          throw new Error(`Failed to load required secret: ${secretConfig.name}`);
        } else {
          logger.warn(`Failed to load optional secret: ${secretConfig.name}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            secretName: secretConfig.name,
          });
        }
      }
    }

    logger.info('Secrets manager initialized successfully', {
      loadedSecrets: this.secretsCache.size,
      totalSecrets: this.secretConfigs.length,
    });
  }

  /**
   * Load a single secret from environment or AWS Secrets Manager
   */
  private async loadSecret(secretConfig: SecretConfig): Promise<void> {
    let secretValue: string | undefined;
    let lastUpdated: Date | undefined;
    let version: string | undefined;

    if (this.isProduction && secretConfig.awsSecretName && this.awsClient) {
      // Load from AWS Secrets Manager in production
      try {
        const command = new GetSecretValueCommand({
          SecretId: secretConfig.awsSecretName,
        });

        const response = await this.awsClient.send(command);

        if (response.SecretString) {
          // Handle JSON secrets (like AWS credentials)
          if (
            secretConfig.name === 'aws_access_key_id' ||
            secretConfig.name === 'aws_secret_access_key'
          ) {
            const credentials = JSON.parse(response.SecretString);
            secretValue =
              secretConfig.name === 'aws_access_key_id'
                ? credentials.accessKeyId
                : credentials.secretAccessKey;
          } else {
            // Handle simple string secrets
            try {
              const parsed = JSON.parse(response.SecretString);
              secretValue = parsed.value || parsed[secretConfig.name] || response.SecretString;
            } catch {
              // If not JSON, use as-is
              secretValue = response.SecretString;
            }
          }
        }

        lastUpdated = response.CreatedDate;
        version = response.VersionId;

        logger.debug(`Loaded secret from AWS Secrets Manager`, {
          secretName: secretConfig.name,
          version,
        });
      } catch (error) {
        logger.warn(`Failed to load secret from AWS Secrets Manager: ${secretConfig.name}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          secretName: secretConfig.name,
        });

        // Fallback to environment variable
        secretValue = process.env[secretConfig.envVar];
      }
    } else {
      // Load from environment variable (development/testing)
      secretValue = process.env[secretConfig.envVar];
    }

    // Use default value if secret is not found and not required
    if (!secretValue && !secretConfig.required && secretConfig.defaultValue !== undefined) {
      secretValue = secretConfig.defaultValue;
    }

    // Validate required secrets
    if (!secretValue && secretConfig.required) {
      throw new Error(`Required secret not found: ${secretConfig.name}`);
    }

    // Cache the secret if found
    if (secretValue) {
      this.secretsCache.set(secretConfig.name, {
        value: secretValue,
        lastUpdated,
        version,
      });
    }
  }

  /**
   * Get a secret value by name
   */
  public getSecret(name: string): string | undefined {
    const secret = this.secretsCache.get(name);
    return secret?.value;
  }

  /**
   * Get a required secret value by name
   * Throws error if secret is not found
   */
  public getRequiredSecret(name: string): string {
    const secret = this.getSecret(name);
    if (!secret) {
      throw new Error(`Required secret not found: ${name}`);
    }
    return secret;
  }

  /**
   * Get secret metadata (without the actual value)
   */
  public getSecretMetadata(name: string): Omit<SecretValue, 'value'> | undefined {
    const secret = this.secretsCache.get(name);
    if (!secret) {
      return undefined;
    }

    return {
      lastUpdated: secret.lastUpdated,
      version: secret.version,
    };
  }

  /**
   * Refresh a specific secret (useful for rotation)
   */
  public async refreshSecret(name: string): Promise<void> {
    const secretConfig = this.secretConfigs.find((config) => config.name === name);
    if (!secretConfig) {
      throw new Error(`Secret configuration not found: ${name}`);
    }

    logger.info(`Refreshing secret: ${name}`);
    await this.loadSecret(secretConfig);
    logger.info(`Secret refreshed successfully: ${name}`);
  }

  /**
   * Refresh all secrets (useful for periodic rotation)
   */
  public async refreshAllSecrets(): Promise<void> {
    logger.info('Refreshing all secrets');

    const refreshPromises = this.secretConfigs.map(async (secretConfig) => {
      try {
        await this.loadSecret(secretConfig);
      } catch (error) {
        if (secretConfig.required) {
          throw error;
        }
        logger.warn(`Failed to refresh optional secret: ${secretConfig.name}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(refreshPromises);
    logger.info('All secrets refreshed successfully');
  }

  /**
   * Update a secret in AWS Secrets Manager (production only)
   */
  public async updateSecret(name: string, newValue: string): Promise<void> {
    if (!this.isProduction || !this.awsClient) {
      throw new Error('Secret updates are only supported in production with AWS Secrets Manager');
    }

    const secretConfig = this.secretConfigs.find((config) => config.name === name);
    if (!secretConfig || !secretConfig.awsSecretName) {
      throw new Error(`Secret configuration not found or not configured for AWS: ${name}`);
    }

    if (!secretConfig.rotatable) {
      throw new Error(`Secret is not rotatable: ${name}`);
    }

    try {
      const command = new UpdateSecretCommand({
        SecretId: secretConfig.awsSecretName,
        SecretString: newValue,
      });

      await this.awsClient.send(command);

      // Refresh the cached value
      await this.refreshSecret(name);

      logger.info(`Secret updated successfully: ${name}`);
    } catch (error) {
      logger.error(`Failed to update secret: ${name}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validate all required secrets are present
   */
  public validateSecrets(): void {
    const missingSecrets: string[] = [];

    for (const secretConfig of this.secretConfigs) {
      if (secretConfig.required && !this.secretsCache.has(secretConfig.name)) {
        missingSecrets.push(secretConfig.name);
      }
    }

    if (missingSecrets.length > 0) {
      throw new Error(`Missing required secrets: ${missingSecrets.join(', ')}`);
    }

    logger.info('All required secrets validated successfully');
  }

  /**
   * Get list of all configured secrets (names only, no values)
   */
  public getSecretNames(): string[] {
    return this.secretConfigs.map((config) => config.name);
  }

  /**
   * Get list of rotatable secrets
   */
  public getRotatableSecrets(): string[] {
    return this.secretConfigs.filter((config) => config.rotatable).map((config) => config.name);
  }

  /**
   * Check if secrets manager is healthy
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Validate that all required secrets are present
      this.validateSecrets();

      // If using AWS Secrets Manager, test connectivity
      if (this.isProduction && this.awsClient) {
        // Try to list secrets to test connectivity
        const { ListSecretsCommand } = await import('@aws-sdk/client-secrets-manager');
        const command = new ListSecretsCommand({ MaxResults: 1 });
        await this.awsClient.send(command);
      }

      return true;
    } catch (error) {
      logger.error('Secrets manager health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

/**
 * Global secrets manager instance
 */
export const secretsManager = SecretsManager.getInstance();

/**
 * Convenience functions for getting secrets
 */
export const getSecret = (name: string): string | undefined => {
  return secretsManager.getSecret(name);
};

export const getRequiredSecret = (name: string): string => {
  return secretsManager.getRequiredSecret(name);
};
