/**
 * Stripe Webhook Handler Tests
 *
 * Tests the webhook handler integration with payment service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stripe from 'stripe';
import { StripeWebhookHandler } from '../StripeWebhookHandler';
import { IPaymentService } from '../../../application/services/IPaymentService';

// Mock payment service
const mockPaymentService: IPaymentService = {
  handleWebhook: vi.fn(),
  createCheckoutSession: vi.fn(),
  processRefund: vi.fn(),
  createSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  getPaymentHistory: vi.fn(),
  getUserSubscriptions: vi.fn(),
  validateRefundEligibility: vi.fn(),
  retryFailedPayment: vi.fn(),
};

describe('StripeWebhookHandler', () => {
  let webhookHandler: StripeWebhookHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    webhookHandler = new StripeWebhookHandler(mockPaymentService);
  });

  describe('handleWebhook', () => {
    it('should delegate webhook processing to payment service', async () => {
      // Arrange
      const mockEvent: Stripe.Event = {
        id: 'evt_test_123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'cs_test_123',
            object: 'checkout.session',
            amount_total: 2000,
            currency: 'usd',
            customer_email: 'test@example.com',
            metadata: {
              courseId: 'course_123',
              studentId: 'student_123',
            },
          } as Stripe.Checkout.Session,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_123',
          idempotency_key: null,
        },
        type: 'checkout.session.completed',
      };

      // Act
      await webhookHandler.handleWebhook(mockEvent);

      // Assert
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledTimes(1);
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle payment_intent.succeeded events', async () => {
      // Arrange
      const mockEvent: Stripe.Event = {
        id: 'evt_test_456',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test_123',
            object: 'payment_intent',
            amount: 2000,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              courseId: 'course_123',
              studentId: 'student_123',
            },
          } as Stripe.PaymentIntent,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_456',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      // Act
      await webhookHandler.handleWebhook(mockEvent);

      // Assert
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledTimes(1);
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle payment_intent.payment_failed events', async () => {
      // Arrange
      const mockEvent: Stripe.Event = {
        id: 'evt_test_789',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test_456',
            object: 'payment_intent',
            amount: 2000,
            currency: 'usd',
            status: 'requires_payment_method',
            last_payment_error: {
              message: 'Your card was declined.',
              type: 'card_error',
            },
            metadata: {
              courseId: 'course_123',
              studentId: 'student_123',
            },
          } as Stripe.PaymentIntent,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_789',
          idempotency_key: null,
        },
        type: 'payment_intent.payment_failed',
      };

      // Act
      await webhookHandler.handleWebhook(mockEvent);

      // Assert
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledTimes(1);
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle invoice.payment_failed events', async () => {
      // Arrange
      const mockEvent: Stripe.Event = {
        id: 'evt_test_101',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'in_test_123',
            object: 'invoice',
            subscription: 'sub_test_123',
            amount_paid: 0,
            attempt_count: 1,
            status: 'open',
          } as Stripe.Invoice,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_101',
          idempotency_key: null,
        },
        type: 'invoice.payment_failed',
      };

      // Act
      await webhookHandler.handleWebhook(mockEvent);

      // Assert
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledTimes(1);
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);
    });

    it('should handle customer.subscription.deleted events', async () => {
      // Arrange
      const mockEvent: Stripe.Event = {
        id: 'evt_test_202',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'sub_test_456',
            object: 'subscription',
            customer: 'cus_test_123',
            status: 'canceled',
            cancel_at_period_end: false,
          } as Stripe.Subscription,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_202',
          idempotency_key: null,
        },
        type: 'customer.subscription.deleted',
      };

      // Act
      await webhookHandler.handleWebhook(mockEvent);

      // Assert
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledTimes(1);
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledWith(mockEvent);
    });

    it('should propagate errors from payment service', async () => {
      // Arrange
      const mockEvent: Stripe.Event = {
        id: 'evt_test_error',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {} as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_error',
          idempotency_key: null,
        },
        type: 'checkout.session.completed',
      };

      const error = new Error('Payment service error');
      vi.mocked(mockPaymentService.handleWebhook).mockRejectedValue(error);

      // Act & Assert
      await expect(webhookHandler.handleWebhook(mockEvent)).rejects.toThrow(
        'Payment service error'
      );
      expect(mockPaymentService.handleWebhook).toHaveBeenCalledTimes(1);
    });
  });
});
