/**
 * Email Service Interface
 * 
 * Defines the contract for email service implementations
 * Supports both transactional and bulk email sending with template system
 */

/**
 * Email template data for dynamic content population
 */
export interface EmailTemplateData {
  [key: string]: any;
}

/**
 * Email attachment interface
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

/**
 * Email sending options
 */
export interface EmailOptions {
  to: string | string[];
  subject?: string; // Optional if template includes subject
  templateId?: string;
  templateData?: EmailTemplateData;
  attachments?: EmailAttachment[];
  replyTo?: string;
  priority?: 'normal' | 'high' | 'urgent';
}

/**
 * Email sending result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Bulk email sending result
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

/**
 * Email service interface
 * 
 * Requirements:
 * - 10.2: Email template system with dynamic data population
 * - 10.2: SendGrid or AWS SES integration
 */
export interface IEmailService {
  /**
   * Send a single transactional email using a template
   * 
   * @param options - Email sending options
   * @returns Promise resolving to email result
   */
  sendTransactional(options: EmailOptions): Promise<EmailResult>;

  /**
   * Send bulk emails to multiple recipients
   * 
   * @param recipients - Array of recipient email addresses
   * @param templateId - Email template identifier
   * @param templateData - Dynamic data for template population
   * @returns Promise resolving to bulk email result
   */
  sendBulk(
    recipients: string[], 
    templateId: string, 
    templateData: EmailTemplateData
  ): Promise<BulkEmailResult>;

  /**
   * Send a simple email without template
   * 
   * @param to - Recipient email address
   * @param subject - Email subject
   * @param content - Email content (HTML or plain text)
   * @param isHtml - Whether content is HTML (default: true)
   * @returns Promise resolving to email result
   */
  sendSimple(
    to: string, 
    subject: string, 
    content: string, 
    isHtml?: boolean
  ): Promise<EmailResult>;

  /**
   * Verify email service configuration and connectivity
   * 
   * @returns Promise resolving to true if service is healthy
   */
  healthCheck(): Promise<boolean>;
}