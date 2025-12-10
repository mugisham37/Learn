/**
 * AWS SES Email Service Implementation
 * 
 * Implements email sending using AWS Simple Email Service (SES)
 * Includes retry logic, error handling, and template support
 */

import { SESClient, SendEmailCommand, SendBulkTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../../config';
import { logger } from '../utils/logger';
import { 
  IEmailService, 
  EmailOptions, 
  EmailResult, 
  BulkEmailResult, 
  EmailTemplateData 
} from './IEmailService';
import { EmailTemplateService } from './EmailTemplateService';

/**
 * AWS SES email service implementation
 * 
 * Requirements:
 * - 10.2: Email template system with AWS SES integration
 * - 10.2: Dynamic data population in templates
 * - 10.2: Email sending with retry logic
 */
export class SESEmailService implements IEmailService {
  private sesClient: SESClient;
  private templateService: EmailTemplateService;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second base delay

  constructor() {
    this.templateService = new EmailTemplateService();
    this.initializeSES();
  }

  /**
   * Initialize AWS SES client
   */
  private initializeSES(): void {
    this.sesClient = new SESClient({
      region: config.ses.region,
      credentials: config.aws.accessKeyId && config.aws.secretAccessKey ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      } : undefined // Use default credential chain if not provided
    });

    logger.info('AWS SES email service initialized', {
      region: config.ses.region
    });
  }

  /**
   * Send a single transactional email using a template
   */
  public async sendTransactional(options: EmailOptions): Promise<EmailResult> {
    try {
      let subject = options.subject;
      let htmlContent: string;
      let textContent: string | undefined;

      // If template is specified, render it
      if (options.templateId) {
        const rendered = this.templateService.renderTemplate(
          options.templateId, 
          options.templateData || {}
        );

        if (!rendered) {
          throw new Error(`Template not found: ${options.templateId}`);
        }

        // Validate template data
        const validation = this.templateService.validateTemplateData(
          options.templateId, 
          options.templateData || {}
        );

        if (!validation.valid) {
          logger.warn('Missing template variables', {
            templateId: options.templateId,
            missingVariables: validation.missingVariables
          });
        }

        subject = rendered.subject;
        htmlContent = rendered.htmlContent;
        textContent = rendered.textContent;
      } else {
        if (!options.subject) {
          throw new Error('Subject is required when not using a template');
        }
        htmlContent = options.templateData?.content || '';
        textContent = options.templateData?.textContent;
      }

      // Prepare SES command
      const destinations = Array.isArray(options.to) ? options.to : [options.to];
      
      const command = new SendEmailCommand({
        Source: config.ses.fromEmail,
        Destination: {
          ToAddresses: destinations
        },
        Message: {
          Subject: {
            Data: subject!,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlContent,
              Charset: 'UTF-8'
            },
            Text: textContent ? {
              Data: textContent,
              Charset: 'UTF-8'
            } : undefined
          }
        },
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
        Tags: [
          {
            Name: 'Service',
            Value: 'LearningPlatform'
          },
          {
            Name: 'Template',
            Value: options.templateId || 'none'
          }
        ]
      });

      // Send with retry logic
      const result = await this.sendWithRetry(command);

      logger.info('Email sent successfully via SES', {
        to: options.to,
        templateId: options.templateId,
        messageId: result.MessageId
      });

      return {
        success: true,
        messageId: result.MessageId
      };

    } catch (error) {
      logger.error('Failed to send email via SES', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: options.to,
        templateId: options.templateId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send bulk emails to multiple recipients
   */
  public async sendBulk(
    recipients: string[], 
    templateId: string, 
    templateData: EmailTemplateData
  ): Promise<BulkEmailResult> {
    try {
      // Render template
      const rendered = this.templateService.renderTemplate(templateId, templateData);
      if (!rendered) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Validate template data
      const validation = this.templateService.validateTemplateData(templateId, templateData);
      if (!validation.valid) {
        logger.warn('Missing template variables for bulk email', {
          templateId,
          missingVariables: validation.missingVariables
        });
      }

      // Send emails individually (SES bulk templated email requires pre-created templates)
      // For simplicity, we'll send individual emails in batches
      const batchSize = 50; // SES rate limit consideration
      const results: EmailResult[] = [];
      
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        try {
          const batchPromises = batch.map(recipient => 
            this.sendTransactional({
              to: recipient,
              templateId,
              templateData
            })
          );

          const batchResults = await Promise.allSettled(batchPromises);

          // Process batch results
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              results.push({
                success: false,
                error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
              });
            }
          });

          // Add delay between batches to respect rate limits
          if (i + batchSize < recipients.length) {
            await this.delay(200); // 200ms delay between batches
          }

        } catch (error) {
          // Handle batch failure
          batch.forEach(() => {
            results.push({
              success: false,
              error: error instanceof Error ? error.message : 'Batch failed'
            });
          });
        }
      }

      // Calculate summary
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      const failures = results
        .map((result, index) => ({ result, recipient: recipients[index] }))
        .filter(({ result }) => !result.success)
        .map(({ result, recipient }) => ({
          email: recipient,
          error: result.error || 'Unknown error'
        }));

      logger.info('Bulk email completed via SES', {
        templateId,
        totalRecipients: recipients.length,
        successCount,
        failureCount
      });

      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        failures: failures.length > 0 ? failures : undefined
      };

    } catch (error) {
      logger.error('Bulk email failed via SES', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
        recipientCount: recipients.length
      });

      return {
        success: false,
        successCount: 0,
        failureCount: recipients.length,
        failures: recipients.map(email => ({
          email,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      };
    }
  }

  /**
   * Send a simple email without template
   */
  public async sendSimple(
    to: string, 
    subject: string, 
    content: string, 
    isHtml: boolean = true
  ): Promise<EmailResult> {
    const options: EmailOptions = {
      to,
      subject,
      templateData: {
        content,
        textContent: isHtml ? undefined : content
      }
    };

    return this.sendTransactional(options);
  }

  /**
   * Verify email service configuration and connectivity
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // Test SES connectivity by getting send quota
      const { GetSendQuotaCommand } = await import('@aws-sdk/client-ses');
      const command = new GetSendQuotaCommand({});
      
      await this.sesClient.send(command);
      return true;
    } catch (error) {
      logger.error('SES health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Send email with retry logic
   */
  private async sendWithRetry(command: SendEmailCommand): Promise<{ MessageId: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.sesClient.send(command);
        
        if (!response.MessageId) {
          throw new Error('No message ID returned from SES');
        }

        return { MessageId: response.MessageId };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        logger.warn(`Email send attempt ${attempt} failed via SES`, {
          error: lastError.message,
          attempt,
          maxRetries: this.maxRetries
        });

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    // Don't retry on authentication, validation, or permanent errors
    if (error?.name) {
      const nonRetryableErrors = [
        'InvalidParameterValue',
        'MessageRejected',
        'MailFromDomainNotVerified',
        'ConfigurationSetDoesNotExist'
      ];
      return nonRetryableErrors.includes(error.name);
    }

    return false;
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}