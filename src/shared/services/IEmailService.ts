/**
 * Email Service Interface
 * 
 * Defines the contract for email sending operations.
 */

export interface IEmailService {
  /**
   * Send transactional email
   */
  sendTransactional(params: {
    to: string;
    templateId: string;
    templateData: Record<string, unknown>;
    priority?: string;
  }): Promise<void>;

  /**
   * Send bulk email
   */
  sendBulk(params: {
    recipients: string[];
    templateId: string;
    templateData: Record<string, unknown>;
  }): Promise<void>;
}