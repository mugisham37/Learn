/**
 * SendGrid Email Service Implementation
 *
 * Implements email sending using SendGrid API
 * Includes retry logic, error handling, and template support
 */

import sgMail from '@sendgrid/mail';

import { config } from '../../config';
import { logger } from '../utils/logger';
import { secrets } from '../utils/secureConfig';

import { EmailTemplateService } from './EmailTemplateService';
import {
  IEmailService,
  EmailOptions,
  EmailResult,
  BulkEmailResult,
  EmailTemplateData,
} from './IEmailService';

/**
 * SendGrid email service implementation
 *
 * Requirements:
 * - 10.2: Email template system with SendGrid integration
 * - 10.2: Dynamic data population in templates
 * - 10.2: Email sending with retry logic
 */
export class SendGridEmailService implements IEmailService {
  private templateService: EmailTemplateService;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second base delay

  constructor() {
    this.templateService = new EmailTemplateService();
    this.initializeSendGrid();
  }

  /**
   * Initialize SendGrid configuration
   */
  private initializeSendGrid(): void {
    const sendGridConfig = secrets.getSendGridConfig();
    if (!sendGridConfig.apiKey) {
      logger.warn('SendGrid API key not configured. Email service will not function.');
      return;
    }

    sgMail.setApiKey(sendGridConfig.apiKey);
    logger.info('SendGrid email service initialized');
  }

  /**
   * Send a single transactional email using a template
   */
  public async sendTransactional(options: EmailOptions): Promise<EmailResult> {
    try {
      // Validate configuration
      const sendGridConfig = secrets.getSendGridConfig();
      if (!sendGridConfig.apiKey) {
        throw new Error('SendGrid API key not configured');
      }

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
            missingVariables: validation.missingVariables,
          });
        }

        subject = rendered.subject;
        htmlContent = rendered.htmlContent;
        textContent = rendered.textContent;
      } else {
        if (!options.subject) {
          throw new Error('Subject is required when not using a template');
        }
        htmlContent = (options.templateData?.['content'] as string) || '';
        textContent = options.templateData?.['textContent'] as string | undefined;
      }

      // Prepare SendGrid message
      const message: sgMail.MailDataRequired = {
        to: options.to,
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName,
        },
        subject: subject!,
        html: htmlContent,
        text: textContent,
        replyTo: options.replyTo,
        attachments: options.attachments?.map((att) => ({
          filename: att.filename,
          content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
          type: att.contentType,
          disposition: att.disposition,
          contentId: att.contentId,
        })),
      };

      // Set priority headers if specified
      if (options.priority === 'high' || options.priority === 'urgent') {
        message.headers = {
          'X-Priority': options.priority === 'urgent' ? '1' : '2',
          'X-MSMail-Priority': options.priority === 'urgent' ? 'High' : 'High',
        };
      }

      // Send with retry logic
      const result = await this.sendWithRetry(message);

      logger.info('Email sent successfully', {
        to: options.to,
        templateId: options.templateId,
        messageId: result.messageId,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: options.to,
        templateId: options.templateId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      const sendGridConfig = secrets.getSendGridConfig();
      if (!sendGridConfig.apiKey) {
        throw new Error('SendGrid API key not configured');
      }

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
          missingVariables: validation.missingVariables,
        });
      }

      // Prepare bulk messages
      const messages: sgMail.MailDataRequired[] = recipients.map((recipient) => ({
        to: recipient,
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName,
        },
        subject: rendered.subject,
        html: rendered.htmlContent,
        text: rendered.textContent,
      }));

      // Send in batches to avoid rate limits
      const batchSize = 100; // SendGrid recommended batch size
      const results: EmailResult[] = [];

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);

        try {
          const batchResults = await Promise.allSettled(
            batch.map((message) => this.sendWithRetry(message))
          );

          // Process batch results
          batchResults.forEach((result, _index) => {
            // const _recipient = batch[index]?.to as string;

            if (result.status === 'fulfilled') {
              results.push({
                success: true,
                messageId: result.value.messageId,
              });
            } else {
              results.push({
                success: false,
                error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
              });
            }
          });

          // Add delay between batches to respect rate limits
          if (i + batchSize < messages.length) {
            await this.delay(100); // 100ms delay between batches
          }
        } catch (error) {
          // Handle batch failure
          batch.forEach(() => {
            results.push({
              success: false,
              error: error instanceof Error ? error.message : 'Batch failed',
            });
          });
        }
      }

      // Calculate summary
      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;
      const failures = results
        .map((result, index) => ({ result, recipient: recipients[index] }))
        .filter(({ result }) => !result.success)
        .map(({ result, recipient }) => ({
          email: recipient || 'unknown',
          error: result.error || 'Unknown error',
        }));

      logger.info('Bulk email completed', {
        templateId,
        totalRecipients: recipients.length,
        successCount,
        failureCount,
      });

      return {
        success: failureCount === 0,
        successCount,
        failureCount,
        failures: failures.length > 0 ? failures : undefined,
      };
    } catch (error) {
      logger.error('Bulk email failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
        recipientCount: recipients.length,
      });

      return {
        success: false,
        successCount: 0,
        failureCount: recipients.length,
        failures: recipients.map((email) => ({
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
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
        textContent: isHtml ? undefined : content,
      },
    };

    return this.sendTransactional(options);
  }

  /**
   * Verify email service configuration and connectivity
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const sendGridConfig = secrets.getSendGridConfig();
      if (!sendGridConfig.apiKey) {
        return false;
      }

      // SendGrid doesn't have a dedicated health check endpoint
      // We'll verify the API key by attempting to get account information
      // This is a minimal request that doesn't send any emails
      const response = await fetch('https://api.sendgrid.com/v3/user/account', {
        headers: {
          Authorization: `Bearer ${sendGridConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      logger.error('SendGrid health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send email with retry logic
   */
  private async sendWithRetry(message: sgMail.MailDataRequired): Promise<{ messageId: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const [response] = await sgMail.send(message);

        // Extract message ID from response headers
        const headers = response.headers as Record<string, string>;
        const messageId =
          headers['x-message-id'] ||
          headers['X-Message-Id'] ||
          `sg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return { messageId: String(messageId) };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        logger.warn(`Email send attempt ${attempt} failed`, {
          error: lastError.message,
          to: message.to,
          attempt,
          maxRetries: this.maxRetries,
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
  private isNonRetryableError(error: unknown): boolean {
    // Don't retry on authentication, validation, or permanent errors
    if (error && typeof error === 'object' && 'code' in error) {
      const nonRetryableCodes = [400, 401, 403, 413, 422];
      return nonRetryableCodes.includes(Number((error as { code: unknown }).code));
    }

    return false;
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
