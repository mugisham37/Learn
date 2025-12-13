/**
 * Email Service Interface
 * 
 * Defines the contract for email sending operations.
 */

/**
 * Email options for transactional emails
 */
export interface EmailOptions {
  to: string;
  subject?: string;
  templateId?: string;
  templateData?: EmailTemplateData;
  priority?: 'normal' | 'high' | 'urgent';
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
    disposition?: string;
    contentId?: string;
  }>;
}

/**
 * Email template data type
 */
export type EmailTemplateData = Record<string, unknown>;

/**
 * Single email result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Bulk email result
 */
export interface BulkEmailResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  failures?: Array<{
    email: string;
    error: string;
  }>;
}

export interface IEmailService {
  /**
   * Send transactional email
   */
  sendTransactional(options: EmailOptions): Promise<EmailResult>;

  /**
   * Send bulk email
   */
  sendBulk(
    recipients: string[],
    templateId: string,
    templateData: EmailTemplateData
  ): Promise<BulkEmailResult>;

  /**
   * Health check for the email service
   */
  healthCheck?(): Promise<boolean>;
}