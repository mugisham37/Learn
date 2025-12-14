/**
 * Payments Module
 *
 * Handles Stripe integration, payment processing, subscriptions, and refunds.
 * This module provides the public API for the payments domain.
 */

// Infrastructure exports
export * from './infrastructure';

// Domain exports
export * from './domain';

// Application exports
export { PaymentService } from './application/services/PaymentService.js';
export type { 
  IPaymentService,
  CreateCheckoutSessionParams,
  CheckoutSession,
  ProcessRefundParams,
  CreateSubscriptionParams,
  CancelSubscriptionParams
} from './application/services/IPaymentService.js';

// Presentation exports
export * from './presentation';
