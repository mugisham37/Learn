/**
 * Email Service Factory
 * 
 * Factory for creating email service instances based on configuration
 * Supports both SendGrid and AWS SES implementations
 */

import { config } from '../../config';
import { secrets } from '../utils/secureConfig';
import { logger } from '../utils/logger';
import { IEmailService } from './IEmailService';
import { SendGridEmailService } from './SendGridEmailService';
import { SESEmailService } from './SESEmailService';

/**
 * Email service provider types
 */
export type EmailProvider = 'sendgrid' | 'ses';

/**
 * Email service factory
 * 
 * Requirements:
 * - 10.2: Support for both SendGrid and AWS SES email providers
 */
export class EmailServiceFactory {
  private static instance: IEmailService | null = null;

  /**
   * Get email service instance (singleton)
   */
  public static getInstance(): IEmailService {
    if (!this.instance) {
      this.instance = this.createEmailService();
    }
    return this.instance;
  }

  /**
   * Create email service based on configuration
   */
  private static createEmailService(): IEmailService {
    const provider = this.determineProvider();
    
    switch (provider) {
      case 'sendgrid':
        logger.info('Creating SendGrid email service');
        return new SendGridEmailService();
      
      case 'ses':
        logger.info('Creating AWS SES email service');
        return new SESEmailService();
      
      default:
        logger.warn('No email provider configured, using SendGrid as default');
        return new SendGridEmailService();
    }
  }

  /**
   * Determine which email provider to use based on configuration
   */
  private static determineProvider(): EmailProvider {
    // Check for explicit provider configuration
    const explicitProvider = process.env.EMAIL_PROVIDER as EmailProvider;
    if (explicitProvider && ['sendgrid', 'ses'].includes(explicitProvider)) {
      return explicitProvider;
    }

    // Auto-detect based on available configuration
    const sendGridConfig = secrets.getSendGridConfig();
    const awsConfig = secrets.getAwsConfig();
    
    const hasSendGridConfig = Boolean(sendGridConfig.apiKey);
    const hasSESConfig = Boolean(
      awsConfig.accessKeyId && awsConfig.secretAccessKey
    ) || Boolean(process.env.AWS_PROFILE); // AWS profile or IAM role

    // Prefer SendGrid if both are configured
    if (hasSendGridConfig) {
      return 'sendgrid';
    }

    if (hasSESConfig) {
      return 'ses';
    }

    // Default to SendGrid
    logger.warn('No email service configuration detected, defaulting to SendGrid');
    return 'sendgrid';
  }

  /**
   * Create a specific email service instance (for testing or specific use cases)
   */
  public static createSpecificService(provider: EmailProvider): IEmailService {
    switch (provider) {
      case 'sendgrid':
        return new SendGridEmailService();
      case 'ses':
        return new SESEmailService();
      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    this.instance = null;
  }

  /**
   * Get current provider information
   */
  public static getCurrentProvider(): {
    provider: EmailProvider;
    configured: boolean;
    healthy?: boolean;
  } {
    const provider = this.determineProvider();
    const service = this.getInstance();
    
    return {
      provider,
      configured: true, // If we got here, some configuration exists
      // Note: healthy status would need to be checked asynchronously
    };
  }

  /**
   * Validate email service configuration
   */
  public static async validateConfiguration(): Promise<{
    valid: boolean;
    provider: EmailProvider;
    errors: string[];
  }> {
    const provider = this.determineProvider();
    const errors: string[] = [];

    try {
      switch (provider) {
        case 'sendgrid':
          if (!config.sendgrid.apiKey) {
            errors.push('SendGrid API key is required');
          }
          if (!config.sendgrid.fromEmail) {
            errors.push('SendGrid from email is required');
          }
          break;

        case 'ses':
          if (!config.ses.fromEmail) {
            errors.push('SES from email is required');
          }
          if (!config.ses.region) {
            errors.push('SES region is required');
          }
          // AWS credentials are optional if using IAM roles
          break;
      }

      // Test service health if no configuration errors
      if (errors.length === 0) {
        const service = this.createSpecificService(provider);
        const healthy = await service.healthCheck();
        
        if (!healthy) {
          errors.push(`${provider.toUpperCase()} service health check failed`);
        }
      }

      return {
        valid: errors.length === 0,
        provider,
        errors
      };

    } catch (error) {
      errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        valid: false,
        provider,
        errors
      };
    }
  }
}