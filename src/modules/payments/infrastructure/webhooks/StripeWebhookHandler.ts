/**
 * Stripe Webhook Handler
 * 
 * Processes incoming webhook events from Stripe.
 * Handles payment completion, failures, subscription changes, etc.
 */

import Stripe from 'stripe';
import { logger } from '../../../../shared/utils/logger';

export interface IStripeWebhookHandler {
  handleWebhook(event: Stripe.Event): Promise<void>;
}

export class StripeWebhookHandler implements IStripeWebhookHandler {
  async handleWebhook(event: Stripe.Event): Promise<void> {
    logger.info('Processing Stripe webhook event', { 
      eventType: event.type,
      eventId: event.id 
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          logger.info('Unhandled Stripe webhook event type', { eventType: event.type });
      }

      logger.info('Stripe webhook event processed successfully', { 
        eventType: event.type,
        eventId: event.id 
      });
    } catch (error) {
      logger.error('Failed to process Stripe webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType: event.type,
        eventId: event.id
      });
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    logger.info('Processing checkout session completed', { sessionId: session.id });

    // TODO: This will be implemented in the payment service
    // For now, we just log the event
    logger.info('Checkout session completed - payment processing needed', {
      sessionId: session.id,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total,
      metadata: session.metadata
    });
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info('Processing payment intent succeeded', { paymentIntentId: paymentIntent.id });

    // TODO: This will be implemented in the payment service
    logger.info('Payment intent succeeded - enrollment processing needed', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata
    });
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info('Processing payment intent failed', { paymentIntentId: paymentIntent.id });

    // TODO: This will be implemented in the payment service
    logger.info('Payment intent failed - notification needed', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error,
      metadata: paymentIntent.metadata
    });
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Processing invoice payment succeeded', { invoiceId: invoice.id });

    // TODO: This will be implemented in the payment service
    logger.info('Invoice payment succeeded - subscription processing needed', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amountPaid: invoice.amount_paid
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.info('Processing invoice payment failed', { invoiceId: invoice.id });

    // TODO: This will be implemented in the payment service
    logger.info('Invoice payment failed - notification needed', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      attemptCount: invoice.attempt_count
    });
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Processing subscription created', { subscriptionId: subscription.id });

    // TODO: This will be implemented in the payment service
    logger.info('Subscription created - database record needed', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Processing subscription updated', { subscriptionId: subscription.id });

    // TODO: This will be implemented in the payment service
    logger.info('Subscription updated - database sync needed', {
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Processing subscription deleted', { subscriptionId: subscription.id });

    // TODO: This will be implemented in the payment service
    logger.info('Subscription deleted - access revocation needed', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });
  }
}