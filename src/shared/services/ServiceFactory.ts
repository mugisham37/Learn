/**
 * Service Factory
 *
 * Factory for creating service instances with proper dependency injection.
 */

import { logger } from '../utils/logger.js';

import {
  IEmailService,
  EmailOptions,
  EmailResult,
  BulkEmailResult,
  EmailTemplateData,
} from './IEmailService.js';

/**
 * Mock Email Service implementation
 */
class MockEmailService implements IEmailService {
  sendTransactional(options: EmailOptions): Promise<EmailResult> {
    // Mock implementation - would integrate with real email service
    logger.info('Mock email sent:', {
      to: options.to,
      templateId: options.templateId,
      subject: options.subject,
    });

    return Promise.resolve({
      success: true,
      messageId: `mock-${Date.now()}`,
    });
  }

  sendBulk(
    recipients: string[],
    templateId: string,
    _templateData: EmailTemplateData
  ): Promise<BulkEmailResult> {
    // Mock implementation
    logger.info('Mock bulk email sent:', {
      recipientCount: recipients.length,
      templateId,
    });

    return Promise.resolve({
      success: true,
      successCount: recipients.length,
      failureCount: 0,
    });
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

export class ServiceFactory {
  private static emailService: IEmailService | null = null;

  /**
   * Get email service instance
   */
  static getEmailService(): IEmailService {
    if (!this.emailService) {
      this.emailService = new MockEmailService();
    }
    return this.emailService;
  }

  /**
   * Set email service instance (for testing or different implementations)
   */
  static setEmailService(service: IEmailService): void {
    this.emailService = service;
  }
}
