/**
 * Stripe Client Implementation
 * 
 * Concrete implementation of the Stripe API client.
 * Handles all interactions with the Stripe API including
 * payments, subscriptions, refunds, and webhook verification.
 */

import Stripe from 'stripe';

import { config } from '../../../../config';
import { secrets } from '../../../../shared/utils/secureConfig';
import { logger } from '../../../../shared/utils/logger';
import { 
  IStripeClient, 
  CheckoutSessionParams, 
  SubscriptionParams, 
  RefundParams 
} from './IStripeClient';

export class StripeClient implements IStripeClient {
  private stripe: Stripe;

  constructor() {
    const stripeConfig = secrets.getStripeConfig();
    if (!stripeConfig.secretKey) {
      throw new Error('Stripe secret key is required');
    }

    this.stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    logger.info('Stripe client initialized');
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    try {
      logger.info('Creating Stripe checkout session', { 
        courseId: params.courseId,
        customerEmail: params.customerEmail 
      });

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: params.currency,
              product_data: {
                name: params.courseName,
                metadata: {
                  courseId: params.courseId,
                },
              },
              unit_amount: Math.round(params.coursePrice * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        customer_email: params.customerEmail,
        metadata: {
          courseId: params.courseId,
          ...params.metadata,
        },
        payment_intent_data: {
          metadata: {
            courseId: params.courseId,
            ...params.metadata,
          },
        },
      });

      logger.info('Stripe checkout session created', { 
        sessionId: session.id,
        courseId: params.courseId 
      });

      return session;
    } catch (error) {
      logger.error('Failed to create Stripe checkout session', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        courseId: params.courseId 
      });
      throw error;
    }
  }

  async createRefund(params: RefundParams): Promise<Stripe.Refund> {
    try {
      logger.info('Creating Stripe refund', { 
        paymentIntentId: params.paymentIntentId,
        amount: params.amount 
      });

      const refundData: Stripe.RefundCreateParams = {
        payment_intent: params.paymentIntentId,
      };

      if (params.amount) {
        refundData.amount = params.amount;
      }

      if (params.reason) {
        refundData.reason = params.reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await this.stripe.refunds.create(refundData);

      logger.info('Stripe refund created', { 
        refundId: refund.id,
        paymentIntentId: params.paymentIntentId 
      });

      return refund;
    } catch (error) {
      logger.error('Failed to create Stripe refund', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentIntentId: params.paymentIntentId 
      });
      throw error;
    }
  }

  async createSubscription(params: SubscriptionParams): Promise<Stripe.Subscription> {
    try {
      logger.info('Creating Stripe subscription', { 
        customerId: params.customerId,
        priceId: params.priceId 
      });

      const subscription = await this.stripe.subscriptions.create({
        customer: params.customerId,
        items: [{ price: params.priceId }],
        metadata: params.metadata,
      });

      logger.info('Stripe subscription created', { 
        subscriptionId: subscription.id,
        customerId: params.customerId 
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create Stripe subscription', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId: params.customerId 
      });
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      logger.info('Canceling Stripe subscription', { subscriptionId });

      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);

      logger.info('Stripe subscription canceled', { subscriptionId });

      return subscription;
    } catch (error) {
      logger.error('Failed to cancel Stripe subscription', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId 
      });
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        throw new Error(`Customer ${customerId} has been deleted`);
      }

      return customer as Stripe.Customer;
    } catch (error) {
      logger.error('Failed to retrieve Stripe customer', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId 
      });
      throw error;
    }
  }

  async createOrUpdateCustomer(
    email: string, 
    name?: string, 
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer> {
    try {
      // First, try to find existing customer by email
      const existingCustomers = await this.stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        const customer = existingCustomers.data[0];
        
        if (!customer) {
          throw new Error('Customer data is unexpectedly undefined');
        }
        
        // Update existing customer if needed
        const updateData: Stripe.CustomerUpdateParams = {};
        if (name && customer.name !== name) {
          updateData.name = name;
        }
        if (metadata && customer.metadata) {
          updateData.metadata = { ...customer.metadata, ...metadata };
        } else if (metadata) {
          updateData.metadata = metadata;
        }

        if (Object.keys(updateData).length > 0) {
          logger.info('Updating existing Stripe customer', { customerId: customer.id });
          return await this.stripe.customers.update(customer.id, updateData);
        }

        return customer;
      }

      // Create new customer
      logger.info('Creating new Stripe customer', { email });
      
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata,
      });

      logger.info('Stripe customer created', { customerId: customer.id });

      return customer;
    } catch (error) {
      logger.error('Failed to create or update Stripe customer', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        email 
      });
      throw error;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
    try {
      const stripeConfig = secrets.getStripeConfig();
      if (!stripeConfig.webhookSecret) {
        throw new Error('Stripe webhook secret is not configured');
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        stripeConfig.webhookSecret
      );

      logger.info('Stripe webhook signature verified', { eventType: event.type });

      return event;
    } catch (error) {
      logger.error('Failed to verify Stripe webhook signature', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to retrieve Stripe payment intent', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentIntentId 
      });
      throw error;
    }
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      logger.error('Failed to retrieve Stripe checkout session', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId 
      });
      throw error;
    }
  }
}