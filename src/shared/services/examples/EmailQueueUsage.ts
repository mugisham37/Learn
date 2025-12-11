/**
 * Email Queue Usage Examples
 * 
 * Demonstrates how to use the EmailQueue for various email sending scenarios
 */

import { getEmailQueue, WebhookData } from '../EmailQueue.js';
import { EmailOptions } from '../IEmailService.js';
import { logger } from '../../utils/logger.js';

/**
 * Example: Send a welcome email to a new user
 */
export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<string> {
  const emailQueue = getEmailQueue();
  
  const emailOptions: EmailOptions = {
    to: userEmail,
    templateId: 'welcome',
    templateData: {
      name: userName,
      loginUrl: 'https://platform.example.com/login',
    },
  };

  const jobId = await emailQueue.queueEmail(emailOptions, 'high');
  logger.info('Welcome email queued', { jobId, userEmail });
  
  return jobId;
}

/**
 * Example: Send password reset email
 */
export async function sendPasswordResetEmail(
  userEmail: string, 
  resetToken: string
): Promise<string> {
  const emailQueue = getEmailQueue();
  
  const emailOptions: EmailOptions = {
    to: userEmail,
    templateId: 'password-reset',
    templateData: {
      re