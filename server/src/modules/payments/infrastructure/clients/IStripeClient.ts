/**
 * Stripe Client Interface
 *
 * Defines the contract for Stripe API operations.
 * This abstraction allows for easier testing and potential future
 * payment provider changes.
 */

import Stripe from 'stripe';

export interface CheckoutSessionParams {
  courseId: string;
  courseName: string;
  coursePrice: number;
  currency: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface SubscriptionParams {
  customerId: string;
  priceId: string;
  metadata?: Record<string, string>;
}

export interface RefundParams {
  paymentIntentId: string;
  amount?: number; // Amount in cents, if not provided refunds full amount
  reason?: string;
}

export interface IStripeClient {
  /**
   * Creates a Stripe checkout session for course purchases
   */
  createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session>;

  /**
   * Creates a refund for a payment
   */
  createRefund(params: RefundParams): Promise<Stripe.Refund>;

  /**
   * Creates a subscription for a customer
   */
  createSubscription(params: SubscriptionParams): Promise<Stripe.Subscription>;

  /**
   * Cancels a subscription
   */
  cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription>;

  /**
   * Retrieves a customer by ID
   */
  getCustomer(customerId: string): Promise<Stripe.Customer>;

  /**
   * Creates or updates a customer
   */
  createOrUpdateCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Customer>;

  /**
   * Verifies webhook signature for security
   */
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event;

  /**
   * Retrieves a payment intent
   */
  getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent>;

  /**
   * Retrieves a checkout session
   */
  getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session>;
}
