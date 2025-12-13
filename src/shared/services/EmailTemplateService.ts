/**
 * Email Template Service
 *
 * Manages email templates with dynamic data population
 * Supports template loading, caching, and variable substitution
 */

import { NotificationType } from '../../infrastructure/database/schema/notifications.schema';

/**
 * Email template interface
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
}

/**
 * Template data for variable substitution
 */
export interface TemplateData {
  [key: string]: unknown;
}

/**
 * Rendered email template
 */
export interface RenderedTemplate {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

/**
 * Email template service for managing and rendering templates
 *
 * Requirements:
 * - 10.2: Email template system with dynamic data population
 */
export class EmailTemplateService {
  private templates: Map<string, EmailTemplate> = new Map();

  constructor() {
    this.loadTemplates();
  }

  /**
   * Load all email templates
   */
  private loadTemplates(): void {
    // Welcome/Registration templates
    this.registerTemplate({
      id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to {{platformName}}!',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #2563eb;">Welcome to {{platformName}}!</h1>',
        '  <p>Hi {{userName}},</p>',
        "  <p>Thank you for joining our learning platform. We're excited to have you on board!</p>",
        '  <p>Your account has been successfully created with the email: <strong>{{userEmail}}</strong></p>',
        '  <p>To get started, please verify your email address by clicking the button below:</p>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{verificationUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      Verify Email Address',
        '    </a>',
        '  </div>',
        "  <p>If the button doesn't work, you can copy and paste this link into your browser:</p>",
        '  <p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>',
        '  <p>Best regards,<br>The {{platformName}} Team</p>',
        '</div>',
      ].join('\n'),
      textContent: [
        'Welcome to {{platformName}}!',
        '',
        'Hi {{userName}},',
        '',
        "Thank you for joining our learning platform. We're excited to have you on board!",
        '',
        'Your account has been successfully created with the email: {{userEmail}}',
        '',
        'To get started, please verify your email address by visiting: {{verificationUrl}}',
        '',
        'Best regards,',
        'The {{platformName}} Team',
      ].join('\n'),
      variables: ['platformName', 'userName', 'userEmail', 'verificationUrl'],
    });

    // Email verification
    this.registerTemplate({
      id: 'email_verification',
      name: 'Email Verification',
      subject: 'Verify your email address',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #2563eb;">Verify Your Email Address</h1>',
        '  <p>Hi {{userName}},</p>',
        '  <p>Please verify your email address by clicking the button below:</p>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{verificationUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      Verify Email',
        '    </a>',
        '  </div>',
        '  <p>This link will expire in 24 hours.</p>',
        "  <p>If you didn't request this verification, please ignore this email.</p>",
        '</div>',
      ].join('\n'),
      variables: ['userName', 'verificationUrl'],
    });

    // Password reset
    this.registerTemplate({
      id: 'password_reset',
      name: 'Password Reset',
      subject: 'Reset your password',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #2563eb;">Reset Your Password</h1>',
        '  <p>Hi {{userName}},</p>',
        '  <p>You requested to reset your password. Click the button below to create a new password:</p>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{resetUrl}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      Reset Password',
        '    </a>',
        '  </div>',
        '  <p>This link will expire in 1 hour.</p>',
        "  <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>",
        '</div>',
      ].join('\n'),
      variables: ['userName', 'resetUrl'],
    });

    // Notification templates based on NotificationType
    this.registerTemplate({
      id: 'new_message',
      name: 'New Message Notification',
      subject: 'New message from {{senderName}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #2563eb;">New Message</h1>',
        '  <p>Hi {{recipientName}},</p>',
        '  <p>You have received a new message from <strong>{{senderName}}</strong>:</p>',
        '  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Subject:</strong> {{messageSubject}}</p>',
        '    <p>{{messagePreview}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{messageUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      Read Message',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: ['recipientName', 'senderName', 'messageSubject', 'messagePreview', 'messageUrl'],
    });

    this.registerTemplate({
      id: 'assignment_due',
      name: 'Assignment Due Reminder',
      subject: 'Assignment due soon: {{assignmentTitle}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #f59e0b;">Assignment Due Soon</h1>',
        '  <p>Hi {{studentName}},</p>',
        '  <p>This is a reminder that your assignment is due soon:</p>',
        '  <div style="background-color: #fef3c7; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Assignment:</strong> {{assignmentTitle}}</p>',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Due Date:</strong> {{dueDate}}</p>',
        '    <p><strong>Time Remaining:</strong> {{timeRemaining}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{assignmentUrl}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      View Assignment',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: [
        'studentName',
        'assignmentTitle',
        'courseName',
        'dueDate',
        'timeRemaining',
        'assignmentUrl',
      ],
    });

    this.registerTemplate({
      id: 'grade_posted',
      name: 'Grade Posted Notification',
      subject: 'Grade posted for {{assignmentTitle}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #10b981;">Grade Posted</h1>',
        '  <p>Hi {{studentName}},</p>',
        '  <p>Your grade has been posted for:</p>',
        '  <div style="background-color: #d1fae5; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Assignment:</strong> {{assignmentTitle}}</p>',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Grade:</strong> {{grade}}</p>',
        '    <p><strong>Feedback:</strong> {{feedback}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{gradeUrl}}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      View Details',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: ['studentName', 'assignmentTitle', 'courseName', 'grade', 'feedback', 'gradeUrl'],
    });

    this.registerTemplate({
      id: 'course_update',
      name: 'Course Update Notification',
      subject: 'Update in {{courseName}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #2563eb;">Course Update</h1>',
        '  <p>Hi {{studentName}},</p>',
        "  <p>There's been an update in your course:</p>",
        '  <div style="background-color: #dbeafe; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Update:</strong> {{updateDescription}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{courseUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      View Course',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: ['studentName', 'courseName', 'updateDescription', 'courseUrl'],
    });

    this.registerTemplate({
      id: 'announcement',
      name: 'Course Announcement',
      subject: 'Announcement: {{announcementTitle}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #7c3aed;">Course Announcement</h1>',
        '  <p>Hi {{studentName}},</p>',
        '  <p>Your instructor has posted a new announcement:</p>',
        '  <div style="background-color: #ede9fe; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Title:</strong> {{announcementTitle}}</p>',
        '    <p>{{announcementContent}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{announcementUrl}}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      View Announcement',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: [
        'studentName',
        'courseName',
        'announcementTitle',
        'announcementContent',
        'announcementUrl',
      ],
    });

    this.registerTemplate({
      id: 'discussion_reply',
      name: 'Discussion Reply Notification',
      subject: 'New reply in {{threadTitle}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #059669;">New Discussion Reply</h1>',
        '  <p>Hi {{recipientName}},</p>',
        "  <p>{{replyAuthor}} replied to a discussion you're following:</p>",
        '  <div style="background-color: #ecfdf5; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Thread:</strong> {{threadTitle}}</p>',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p>{{replyPreview}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{discussionUrl}}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      View Discussion',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: [
        'recipientName',
        'replyAuthor',
        'threadTitle',
        'courseName',
        'replyPreview',
        'discussionUrl',
      ],
    });

    this.registerTemplate({
      id: 'enrollment_confirmed',
      name: 'Enrollment Confirmation',
      subject: 'Welcome to {{courseName}}!',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #10b981;">Enrollment Confirmed</h1>',
        '  <p>Hi {{studentName}},</p>',
        '  <p>Congratulations! You have successfully enrolled in:</p>',
        '  <div style="background-color: #d1fae5; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Instructor:</strong> {{instructorName}}</p>',
        '    <p><strong>Start Date:</strong> {{startDate}}</p>',
        '    <p><strong>Payment:</strong> ${{paymentAmount}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{courseUrl}}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      Start Learning',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: [
        'studentName',
        'courseName',
        'instructorName',
        'startDate',
        'paymentAmount',
        'courseUrl',
      ],
    });

    this.registerTemplate({
      id: 'certificate_issued',
      name: 'Certificate Issued',
      subject: 'Congratulations! Certificate for {{courseName}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #f59e0b;">🎉 Certificate Issued!</h1>',
        '  <p>Hi {{studentName}},</p>',
        '  <p>Congratulations on completing the course! Your certificate is ready:</p>',
        '  <div style="background-color: #fef3c7; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Completion Date:</strong> {{completionDate}}</p>',
        '    <p><strong>Certificate ID:</strong> {{certificateId}}</p>',
        '  </div>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{certificateUrl}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      Download Certificate',
        '    </a>',
        '  </div>',
        '  <p>You can verify this certificate at: <a href="{{verificationUrl}}">{{verificationUrl}}</a></p>',
        '</div>',
      ].join('\n'),
      variables: [
        'studentName',
        'courseName',
        'completionDate',
        'certificateId',
        'certificateUrl',
        'verificationUrl',
      ],
    });

    this.registerTemplate({
      id: 'payment_received',
      name: 'Payment Confirmation',
      subject: 'Payment received for {{courseName}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #10b981;">Payment Received</h1>',
        '  <p>Hi {{studentName}},</p>',
        '  <p>We have received your payment. Here are the details:</p>',
        '  <div style="background-color: #d1fae5; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Amount:</strong> ${{amount}}</p>',
        '    <p><strong>Payment Method:</strong> {{paymentMethod}}</p>',
        '    <p><strong>Transaction ID:</strong> {{transactionId}}</p>',
        '    <p><strong>Date:</strong> {{paymentDate}}</p>',
        '  </div>',
        '  <p>You now have full access to the course content.</p>',
        '  <div style="text-align: center; margin: 30px 0;">',
        '    <a href="{{courseUrl}}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">',
        '      Access Course',
        '    </a>',
        '  </div>',
        '</div>',
      ].join('\n'),
      variables: [
        'studentName',
        'courseName',
        'amount',
        'paymentMethod',
        'transactionId',
        'paymentDate',
        'courseUrl',
      ],
    });

    this.registerTemplate({
      id: 'refund_processed',
      name: 'Refund Processed',
      subject: 'Refund processed for {{courseName}}',
      htmlContent: [
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
        '  <h1 style="color: #2563eb;">Refund Processed</h1>',
        '  <p>Hi {{studentName}},</p>',
        '  <p>Your refund has been processed successfully:</p>',
        '  <div style="background-color: #dbeafe; padding: 20px; border-radius: 6px; margin: 20px 0;">',
        '    <p><strong>Course:</strong> {{courseName}}</p>',
        '    <p><strong>Refund Amount:</strong> ${{refundAmount}}</p>',
        '    <p><strong>Original Payment:</strong> ${{originalAmount}}</p>',
        '    <p><strong>Refund ID:</strong> {{refundId}}</p>',
        '    <p><strong>Processing Date:</strong> {{refundDate}}</p>',
        '  </div>',
        '  <p>The refund will appear in your original payment method within 5-10 business days.</p>',
        '  <p>If you have any questions, please contact our support team.</p>',
        '</div>',
      ].join('\n'),
      variables: [
        'studentName',
        'courseName',
        'refundAmount',
        'originalAmount',
        'refundId',
        'refundDate',
      ],
    });
  }

  /**
   * Register a new email template
   */
  private registerTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: string): EmailTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get template ID for notification type
   */
  public getTemplateIdForNotificationType(notificationType: NotificationType): string {
    // Map notification types to template IDs
    const mapping: Record<NotificationType, string> = {
      new_message: 'new_message',
      assignment_due: 'assignment_due',
      grade_posted: 'grade_posted',
      course_update: 'course_update',
      announcement: 'announcement',
      discussion_reply: 'discussion_reply',
      enrollment_confirmed: 'enrollment_confirmed',
      certificate_issued: 'certificate_issued',
      payment_received: 'payment_received',
      refund_processed: 'refund_processed',
    };

    return mapping[notificationType] || 'default';
  }

  /**
   * Render template with data
   */
  public renderTemplate(templateId: string, data: TemplateData): RenderedTemplate | null {
    const template = this.getTemplate(templateId);
    if (!template) {
      return null;
    }

    // Simple template variable substitution
    // In production, consider using a more robust template engine like Handlebars
    const subject = this.substituteVariables(template.subject, data);
    const htmlContent = this.substituteVariables(template.htmlContent, data);
    const textContent = template.textContent
      ? this.substituteVariables(template.textContent, data)
      : undefined;

    return {
      subject,
      htmlContent,
      textContent,
    };
  }

  /**
   * Simple variable substitution
   * Replaces {{variableName}} with actual values
   */
  private substituteVariables(template: string, data: TemplateData): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName: string) => {
      const value = data[variableName];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get all available templates
   */
  public getAllTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Validate template data against template variables
   */
  public validateTemplateData(
    templateId: string,
    data: TemplateData
  ): { valid: boolean; missingVariables: string[] } {
    const template = this.getTemplate(templateId);
    if (!template) {
      return { valid: false, missingVariables: [] };
    }

    const missingVariables = template.variables.filter(
      (variable) => data[variable] === undefined || data[variable] === null
    );

    return {
      valid: missingVariables.length === 0,
      missingVariables,
    };
  }
}
