/**
 * Webhook Routes Tests
 * 
 * Tests for the Stripe webhook endpoint.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerWebhookRoutes } from '../webhookRoutes';

// Mock the Stripe client and webhook handler
vi.mock('../../infrastructure/clients/StripeClientFactory', () => ({
  StripeClientFactory: {
    getInstance: vi.fn(() => ({
      verifyWebhookSignature: vi.fn(() => ({
        type: 'payment_intent.succeeded',
        id: 'evt_test_123',
        data: { object: { id: 'pi_test_123' } },
      })),
    })),
  },
}));

vi.mock('../../infrastructure/webhooks/StripeWebhookHandler', () => ({
  StripeWebhookHandler: vi.fn(() => ({
    handleWebhook: vi.fn(),
  })),
}));

vi.mock('../../../../../shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Webhook Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await registerWebhookRoutes(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /webhooks/stripe', () => {
    it('should accept valid webhook with signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'test_signature',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test_123' } },
        }),
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ received: true });
    });

    it('should reject webhook without signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test_123' } },
        }),
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Missing stripe-signature header',
      });
    });

    it('should reject webhook without payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'stripe-signature': 'test_signature',
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'Missing request body',
      });
    });
  });
});