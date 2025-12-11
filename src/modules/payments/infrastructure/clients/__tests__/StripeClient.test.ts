/**
 * Stripe Client Tests
 * 
 * Tests for the Stripe client implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Stripe from 'stripe';
import { StripeClient } from '../StripeClient';

// Mock Stripe
vi.mock('stripe');
vi.mock('../../../../../config', () => ({
  config: {
    stripe: {
      secretKey: 'sk_test_mock_key',
      webhookSecret: 'whsec_mock_secret',
    },
  },
}));

vi.mock('../../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('StripeClient', () => {
  let stripeClient: StripeClient;
  let mockStripe: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock Stripe instance
    mockStripe = {
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn(),
        },
      },
      refunds: {
        create: vi.fn(),
      },
      subscriptions: {
        create: vi.fn(),
        cancel: vi.fn(),
      },
      customers: {
        retrieve: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      paymentIntents: {
        retrieve: vi.fn(),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    };

    // Mock Stripe constructor
    (Stripe as any).mockImplementation(() => mockStripe);

    stripeClient = new StripeClient();
  });

  describe('constructor', () => {
    it('should initialize Stripe client with correct configuration', () => {
      expect(Stripe).toHaveBeenCalledWith('sk_test_mock_key', {
        apiVersion: '2023-10-16',
        typescript: true,
      });
    });

    it('should throw error if secret key is missing', () => {
      vi.doMock('../../../../../config', () => ({
        config: {
          stripe: {
            secretKey: '',
          },
        },
      }));

      expect(() => new StripeClient()).toThrow('Stripe secret key is required');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session with correct parameters', async () => {
      const mockSession = { id: 'cs_test_123' };
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession);

      const params = {
        courseId: 'course_123',
        courseName: 'Test Course',
        coursePrice: 99.99,
        currency: 'usd',
        customerEmail: 'test@example.com',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      const result = await stripeClient.createCheckoutSession(params);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Test Course',
                metadata: {
                  courseId: 'course_123',
                },
              },
              unit_amount: 9999, // $99.99 in cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        customer_email: 'test@example.com',
        metadata: {
          courseId: 'course_123',
        },
        payment_intent_data: {
          metadata: {
            courseId: 'course_123',
          },
        },
      });

      expect(result).toEqual(mockSession);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', () => {
      const mockEvent = { type: 'payment_intent.succeeded', id: 'evt_123' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const payload = '{"test": "data"}';
      const signature = 'test_signature';

      const result = stripeClient.verifyWebhookSignature(payload, signature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_mock_secret'
      );
      expect(result).toEqual(mockEvent);
    });

    it('should throw error if webhook secret is not configured', () => {
      vi.doMock('../../../../../config', () => ({
        config: {
          stripe: {
            secretKey: 'sk_test_mock_key',
            webhookSecret: '',
          },
        },
      }));

      const payload = '{"test": "data"}';
      const signature = 'test_signature';

      expect(() => stripeClient.verifyWebhookSignature(payload, signature))
        .toThrow('Stripe webhook secret is not configured');
    });
  });
});