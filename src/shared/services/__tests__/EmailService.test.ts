/**
 * Email Service Tests
 * 
 * Tests for email service implementations and template system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailTemplateService } from '../EmailTemplateService';
import { EmailServiceFactory } from '../EmailServiceFactory';
import { SendGridEmailService } from '../SendGridEmailService';
import { SESEmailService } from '../SESEmailService';

describe('EmailTemplateService', () => {
  let templateService: EmailTemplateService;

  beforeEach(() => {
    templateService = new EmailTemplateService();
  });

  it('should render welcome template with data', () => {
    const templateData = {
      platformName: 'Learning Platform',
      userName: 'John Doe',
      userEmail: 'john@example.com',
      verificationUrl: 'https://example.com/verify/123'
    };

    const rendered = templateService.renderTemplate('welcome', templateData);

    expect(rendered).toBeDefined();
    expect(rendered!.subject).toBe('Welcome to Learning Platform!');
    expect(rendered!.htmlContent).toContain('John Doe');
    expect(rendered!.htmlContent).toContain('john@example.com');
    expect(rendered!.htmlContent).toContain('https://example.com/verify/123');
  });

  it('should get correct template ID for notification type', () => {
    expect(templateService.getTemplateIdForNotificationType('new_message')).toBe('new_message');
    expect(templateService.getTemplateIdForNotificationType('assignment_due')).toBe('assignment_due');
    expect(templateService.getTemplateIdForNotificationType('grade_posted')).toBe('grade_posted');
  });

  it('should validate template data correctly', () => {
    const validation = templateService.validateTemplateData('welcome', {
      platformName: 'Test Platform',
      userName: 'Test User'
      // Missing userEmail and verificationUrl
    });

    expect(validation.valid).toBe(false);
    expect(validation.missingVariables).toContain('userEmail');
    expect(validation.missingVariables).toContain('verificationUrl');
  });

  it('should return null for non-existent template', () => {
    const rendered = templateService.renderTemplate('non-existent', {});
    expect(rendered).toBeNull();
  });
});

describe('EmailServiceFactory', () => {
  beforeEach(() => {
    EmailServiceFactory.resetInstance();
    vi.clearAllMocks();
  });

  it('should create SendGrid service when configured', () => {
    // Mock environment variables
    vi.stubEnv('EMAIL_PROVIDER', 'sendgrid');
    vi.stubEnv('SENDGRID_API_KEY', 'test-key');

    const service = EmailServiceFactory.getInstance();
    expect(service).toBeInstanceOf(SendGridEmailService);
  });

  it('should create SES service when configured', () => {
    // Mock environment variables
    vi.stubEnv('EMAIL_PROVIDER', 'ses');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-key');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret');

    const service = EmailServiceFactory.getInstance();
    expect(service).toBeInstanceOf(SESEmailService);
  });

  it('should return same instance on multiple calls', () => {
    const service1 = EmailServiceFactory.getInstance();
    const service2 = EmailServiceFactory.getInstance();
    expect(service1).toBe(service2);
  });

  it('should validate configuration correctly', async () => {
    // Mock valid SendGrid configuration
    vi.stubEnv('EMAIL_PROVIDER', 'sendgrid');
    vi.stubEnv('SENDGRID_API_KEY', 'test-key');
    vi.stubEnv('SENDGRID_FROM_EMAIL', 'test@example.com');

    // Mock health check to return true
    const mockHealthCheck = vi.fn().mockResolvedValue(true);
    vi.spyOn(SendGridEmailService.prototype, 'healthCheck').mockImplementation(mockHealthCheck);

    const validation = await EmailServiceFactory.validateConfiguration();
    
    expect(validation.valid).toBe(true);
    expect(validation.provider).toBe('sendgrid');
    expect(validation.errors).toHaveLength(0);
  });
});

describe('Email Service Integration', () => {
  it('should handle template rendering and email sending flow', async () => {
    // This is a unit test that doesn't actually send emails
    const templateService = new EmailTemplateService();
    
    // Test template rendering
    const templateData = {
      recipientName: 'Test User',
      senderName: 'Test Sender',
      messageSubject: 'Test Subject',
      messagePreview: 'Test message preview...',
      messageUrl: 'https://example.com/message/123'
    };

    const rendered = templateService.renderTemplate('new_message', templateData);
    
    expect(rendered).toBeDefined();
    expect(rendered!.subject).toBe('New message from Test Sender');
    expect(rendered!.htmlContent).toContain('Test User');
    expect(rendered!.htmlContent).toContain('Test Sender');
    expect(rendered!.htmlContent).toContain('Test Subject');
  });

  it('should handle missing template variables gracefully', () => {
    const templateService = new EmailTemplateService();
    
    // Render template with missing variables
    const rendered = templateService.renderTemplate('new_message', {
      recipientName: 'Test User'
      // Missing other required variables
    });

    expect(rendered).toBeDefined();
    expect(rendered!.subject).toContain('{{senderName}}'); // Unsubstituted variable
    expect(rendered!.htmlContent).toContain('Test User'); // Substituted variable
  });
});