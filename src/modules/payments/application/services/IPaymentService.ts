/**
 * Payment Service Interface
 *
 * Defines the contract for payment application services.
 * Handles payment processing, webhook events, refunds, and subscriptions.
 *
 * Requirements:
 * - 11.1: Stripe checkout session creation and payment processing
 * - 11.2: Webhook handling for payment events
 * - 11.3: Payment failure handling and retry logic
 * - 11.5: Refund processing with policy validation
 */

import Stripe from 'stripe';
import { Payment, Subscription, Refund } from '../../domain/entities/index.js';

/**
 * Checkout session creation parameters
 */
export interface CreateCheckoutSessionParams {
  courseId: string;
  studentId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Checkout session result
 */
export interface CheckoutSession {
  sessionId: string;
  sessionUrl: string;
  paymentId: string;
}

/**
 * Refund processing parameters
 */
export interface ProcessRefundParams {
  enrollmentId: string;
  reason: string;
  amount?: string; // Optional partial refund amount
  requestedBy: string; // User ID who requested the refund
}

/**
 * Subscription creation parameters
 */
export interface CreateSubscriptionParams {
  userId: string;
  planId: string;
  metadata?: Record<string, string>;
}

/**
 * Subscription cancellation parameters
 */
export interface CancelSubscriptionParams {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

/**
 * Payment Service Interface
 *
 * Provides high-level payment operations including Stripe integration,
 * webhook handling, refund processing, and subscription management.
 */
export interface IPaymentService {
  /**
   * Creates a Stripe checkout session for course purchase
   *
   * @param params - Checkout session parameters
   * @returns Checkout session details
   * @throws ValidationError if course or student data is invalid
   * @throws ExternalServiceError if Stripe API fails
   * @throws ConflictError if student is already enrolled
   */
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>;

  /**
   * Handles Stripe webhook events
   *
   * @param event - Stripe webhook event
   * @returns void
   * @throws ValidationError if event signature is invalid
   * @throws ExternalServiceError if webhook processing fails
   */
  handleWebhook(event: Stripe.Event): Promise<void>;

  /**
   * Processes a refund for an enrollment
   *
   * @param params - Refund processing parameters
   * @returns Created refund entity
   * @throws ValidationError if refund policy validation fails
   * @throws NotFoundError if enrollment or payment not found
   * @throws ConflictError if refund is not allowed
   * @throws ExternalServiceError if Stripe refund fails
   */
  processRefund(params: ProcessRefundParams): Promise<Refund>;

  /**
   * Creates a subscription for a user
   *
   * @param params - Subscription creation parameters
   * @returns Created subscription entity
   * @throws ValidationError if plan or user data is invalid
   * @throws ExternalServiceError if Stripe subscription creation fails
   */
  createSubscription(params: CreateSubscriptionParams): Promise<Subscription>;

  /**
   * Cancels a subscription
   *
   * @param params - Subscription cancellation parameters
   * @returns Updated subscription entity
   * @throws NotFoundError if subscription not found
   * @throws ExternalServiceError if Stripe cancellation fails
   */
  cancelSubscription(params: CancelSubscriptionParams): Promise<Subscription>;

  /**
   * Gets payment history for a user
   *
   * @param userId - User ID
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated payment history
   * @throws ValidationError if pagination parameters are invalid
   */
  getPaymentHistory(
    userId: string,
    page: number,
    limit: number
  ): Promise<{
    payments: Payment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Gets subscription details for a user
   *
   * @param userId - User ID
   * @returns Array of user's subscriptions
   * @throws ValidationError if user ID is invalid
   */
  getUserSubscriptions(userId: string): Promise<Subscription[]>;

  /**
   * Validates refund eligibility for an enrollment
   *
   * @param enrollmentId - Enrollment ID
   * @returns Refund eligibility details
   * @throws NotFoundError if enrollment not found
   */
  validateRefundEligibility(enrollmentId: string): Promise<{
    eligible: boolean;
    reason?: string;
    maxRefundAmount?: string;
    refundPolicy: {
      fullRefundDays: number;
      contentConsumptionThreshold: number;
      minimumRefundPercentage: number;
      administrativeFeePercentage: number;
    };
  }>;

  /**
   * Retries failed payment processing
   *
   * @param paymentId - Payment ID to retry
   * @returns Updated payment entity
   * @throws NotFoundError if payment not found
   * @throws ConflictError if payment cannot be retried
   */
  retryFailedPayment(paymentId: string): Promise<Payment>;
}
