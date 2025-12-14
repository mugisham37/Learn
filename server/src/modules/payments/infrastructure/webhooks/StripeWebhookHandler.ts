/**
 * Stripe Webhook Handler
 *
 * Processes incoming webhook events from Stripe.
 * Handles payment completion, failures, subscription changes, etc.
 *
 * Requirements:
 * - 11.2: Webhook handling for payment events
 * - 11.3: Payment failure handling and retry logic
 * - 11.4: Subscription management and notifications
 */

import Stripe from 'stripe';

import { logger } from '../../../../shared/utils/logger';
import { IPaymentService } from '../../application/services/IPaymentService';

export interface IStripeWebhookHandler {
  handleWebhook(event: Stripe.Event): Promise<void>;
}

export class StripeWebhookHandler implements IStripeWebhookHandler {
  constructor(private readonly paymentService: IPaymentService) {}

  async handleWebhook(event: Stripe.Event): Promise<void> {
    logger.info('Processing Stripe webhook event', {
      eventType: event.type,
      eventId: event.id,
    });

    try {
      // Delegate to payment service for actual processing
      await this.paymentService.handleWebhook(event);

      logger.info('Stripe webhook event processed successfully', {
        eventType: event.type,
        eventId: event.id,
      });
    } catch (error) {
      logger.error('Failed to process Stripe webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType: event.type,
        eventId: event.id,
      });
      throw error;
    }
  }
}
