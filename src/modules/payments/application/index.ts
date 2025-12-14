/**
 * Payments Application Layer
 *
 * Contains use cases, application services, DTOs,
 * and orchestration logic for the payments domain.
 *
 * This layer orchestrates payment operations between domain entities,
 * repositories, and external services. It handles complex business
 * workflows and ensures data consistency across payment, enrollment,
 * and notification systems.
 *
 * Requirements:
 * - 11.1: Stripe checkout session creation and payment processing
 * - 11.2: Webhook handling for payment events
 * - 11.3: Payment failure handling and retry logic
 * - 11.5: Refund processing with policy validation
 */

// Export all services
export * from './services/index.js';

// Re-export for explicit access
export type { IPaymentService } from './services/IPaymentService.js';
export { PaymentService } from './services/PaymentService.js';
