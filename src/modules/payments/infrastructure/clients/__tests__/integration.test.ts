/**
 * Stripe Integration Test
 * 
 * Manual integration test to verify Stripe client setup.
 * This test requires actual Stripe test keys to run.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { StripeClientFactory } from '../StripeClientFactory';

describe('Stripe Integration', () => {
  let stripeClient: any;

  beforeAll(() => {
    // Only run if we have test keys
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      console.log('Skipping Stripe integration tests - no test keys provided');
      return;
    }
    
    stripeClient = StripeClientFactory.getInstance();
  });

  it('should initialize Stripe client without errors', () => {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      expect(true).toBe(true); // Skip test
      return;
    }

    expect(stripeClient).toBeDefined();
    expect(typeof stripeClient.createCheckoutSession).toBe('function');
    expect(typeof stripeClient.verifyWebhookSignature).toBe('function');
  });

  it('should validate webhook signature format', () => {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      expect(true).toBe(true); // Skip test
      return;
    }

    // Test with invalid signature should throw
    expect(() => {
      stripeClient.verifyWebhookSignature('{"test": "data"}', 'invalid_signature');
    }).toThrow();
  });
});