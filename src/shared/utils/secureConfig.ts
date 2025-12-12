/**
 * Secure Configuration Utilities
 * 
 * Provides secure access to secrets through SecretsManager
 * Ensures secrets are never logged or exposed in configuration objects
 * 
 * Requirements: 13.7
 */

import { config } from '../../config/index.js';
import { secretsManager } from '../services/SecretsManager.js';

/**
 * Secure configuration interface that provides access to secrets
 * without exposing them in the main config object
 */
export interface SecureConfig {
  // JWT secrets
  getJwtSecret(): string;
  
  // Session secrets
  getSessionSecret(): string;
  
  // Database secrets
  getDatabaseUrl(): string;
  getRedisPassword(): string | undefined;
  
  // AWS secrets
  getAwsAccessKeyId(): string | undefined;
  getAwsSecretAccessKey(): string | undefined;
  
  // Third-party service secrets
  getStripeSecretKey(): string | undefined;
  getStripeWebhookSecret(): string | undefined;
  getSendGridApiKey(): string | undefined;
  getElasticsearchPassword(): string | undefined;
  
  // Firebase secrets
  getFirebasePrivateKey(): string | undefined;
  
  // CloudFront secrets
  getCloudFrontPrivateKeyPath(): string | undefined;
  
  // Certificate secrets
  getCertificateSigningKey(): string | undefined;
  
  // BullMQ Redis password
  getBullMQRedisPassword(): string | undefined;
}

/**
 * Implementation of secure configuration
 */
class SecureConfigImpl implements SecureConfig {
  /**
   * Get JWT secret (required)
   */
  getJwtSecret(): string {
    return secretsManager.getRequiredSecret('jwt_secret');
  }
  
  /**
   * Get session secret (required)
   */
  getSessionSecret(): string {
    return secretsManager.getRequiredSecret('session_secret');
  }
  
  /**
   * Get database URL (required)
   */
  getDatabaseUrl(): string {
    return secretsManager.getRequiredSecret('database_url');
  }
  
  /**
   * Get Redis password (optional)
   */
  getRedisPassword(): string | undefined {
    return secretsManager.getSecret('redis_password');
  }
  
  /**
   * Get AWS access key ID (optional)
   */
  getAwsAccessKeyId(): string | undefined {
    return secretsManager.getSecret('aws_access_key_id');
  }
  
  /**
   * Get AWS secret access key (optional)
   */
  getAwsSecretAccessKey(): string | undefined {
    return secretsManager.getSecret('aws_secret_access_key');
  }
  
  /**
   * Get Stripe secret key (optional)
   */
  getStripeSecretKey(): string | undefined {
    return secretsManager.getSecret('stripe_secret_key');
  }
  
  /**
   * Get Stripe webhook secret (optional)
   */
  getStripeWebhookSecret(): string | undefined {
    return secretsManager.getSecret('stripe_webhook_secret');
  }
  
  /**
   * Get SendGrid API key (optional)
   */
  getSendGridApiKey(): string | undefined {
    return secretsManager.getSecret('sendgrid_api_key');
  }
  
  /**
   * Get Elasticsearch password (optional)
   */
  getElasticsearchPassword(): string | undefined {
    return secretsManager.getSecret('elasticsearch_password');
  }
  
  /**
   * Get Firebase private key (optional)
   */
  getFirebasePrivateKey(): string | undefined {
    return secretsManager.getSecret('firebase_private_key');
  }
  
  /**
   * Get CloudFront private key path (optional)
   */
  getCloudFrontPrivateKeyPath(): string | undefined {
    return secretsManager.getSecret('cloudfront_private_key_path');
  }
  
  /**
   * Get certificate signing key (optional)
   */
  getCertificateSigningKey(): string | undefined {
    return secretsManager.getSecret('certificate_signing_key');
  }
  
  /**
   * Get BullMQ Redis password (optional)
   */
  getBullMQRedisPassword(): string | undefined {
    return secretsManager.getSecret('redis_password'); // Same as main Redis password
  }
}

/**
 * Global secure configuration instance
 * 
 * This should only be used after SecretsManager has been initialized
 */
export const secureConfig: SecureConfig = new SecureConfigImpl();

/**
 * Enhanced configuration that combines regular config with secure config
 * This provides a single interface for all configuration needs
 */
export type EnhancedConfig = typeof config & {
  secrets: SecureConfig;
};

/**
 * Create enhanced configuration with secrets manager integration
 * This should be called after secrets manager is initialized
 */
export function createEnhancedConfig(): EnhancedConfig {
  return {
    ...config,
    secrets: secureConfig,
  };
}

/**
 * Utility functions for common secret access patterns
 */
export const secrets = {
  /**
   * Get JWT configuration with secret
   */
  getJwtConfig(): { secret: string; accessTokenExpiry: string; refreshTokenExpiry: string } {
    return {
      secret: secureConfig.getJwtSecret(),
      accessTokenExpiry: config.jwt.accessTokenExpiry,
      refreshTokenExpiry: config.jwt.refreshTokenExpiry,
    };
  },
  
  /**
   * Get AWS configuration with credentials
   */
  getAwsConfig(): { region: string; accessKeyId: string | undefined; secretAccessKey: string | undefined } {
    return {
      region: config.aws.region,
      accessKeyId: secureConfig.getAwsAccessKeyId(),
      secretAccessKey: secureConfig.getAwsSecretAccessKey(),
    };
  },
  
  /**
   * Get Redis configuration with password
   */
  getRedisConfig(): { host: string; port: number; password: string | undefined; db: number } {
    return {
      host: config.redis.host,
      port: config.redis.port,
      password: secureConfig.getRedisPassword(),
      db: config.redis.db,
    };
  },
  
  /**
   * Get BullMQ Redis configuration with password
   */
  getBullMQRedisConfig(): { host: string; port: number; password: string | undefined } {
    return {
      host: config.bullmq.redis.host,
      port: config.bullmq.redis.port,
      password: secureConfig.getBullMQRedisPassword(),
    };
  },
  
  /**
   * Get Stripe configuration with secrets
   */
  getStripeConfig(): { secretKey: string | undefined; publishableKey: string; webhookSecret: string | undefined } {
    return {
      secretKey: secureConfig.getStripeSecretKey(),
      publishableKey: config.stripe.publishableKey,
      webhookSecret: secureConfig.getStripeWebhookSecret(),
    };
  },
  
  /**
   * Get SendGrid configuration with API key
   */
  getSendGridConfig(): { apiKey: string | undefined; fromEmail: string; fromName: string } {
    return {
      apiKey: secureConfig.getSendGridApiKey(),
      fromEmail: config.sendgrid.fromEmail,
      fromName: config.sendgrid.fromName,
    };
  },
  
  /**
   * Get Elasticsearch configuration with password
   */
  getElasticsearchConfig(): { node: string; username: string; password: string | undefined } {
    return {
      node: config.elasticsearch.node,
      username: config.elasticsearch.username,
      password: secureConfig.getElasticsearchPassword(),
    };
  },
  
  /**
   * Get Firebase configuration with private key
   */
  getFirebaseConfig(): { projectId: string; privateKey: string | undefined; clientEmail: string } {
    return {
      projectId: config.firebase.projectId,
      privateKey: secureConfig.getFirebasePrivateKey(),
      clientEmail: config.firebase.clientEmail,
    };
  },
  
  /**
   * Get CloudFront configuration with private key
   */
  getCloudFrontConfig(): { domain: string; keyPairId: string; privateKeyPath: string | undefined } {
    return {
      domain: config.cloudfront.domain,
      keyPairId: config.cloudfront.keyPairId,
      privateKeyPath: secureConfig.getCloudFrontPrivateKeyPath(),
    };
  },
};