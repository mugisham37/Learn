/**
 * Service Factory
 * 
 * Factory for creating service instances with proper dependency injection.
 */

import { IEmailService } from './IEmailService.js';

/**
 * Mock Email Service implementation
 */
class MockEmailService implements IEmailService {
  async sendTransactional(params: {
    to: string;
    templateId: string;
    templateData: Record<string, unknown>;
    priority?: string;
  }): Promise<void> {
    // Mock implementation - would integrate with real email service
    console.log('Mock email sent:', params);
  }

  async sendBulk(params: {
    recipients: string[];
    templateId: string;
    templateData: Record<string, unknown>;
  }): Promise<void> {
    // Mock implementation
    console.log('Mock bulk email sent:', params);
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