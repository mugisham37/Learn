/**
 * Payments Domain Layer
 * 
 * Contains business entities, value objects, domain services,
 * and business rules for the payments domain.
 * 
 * This module provides the core payment domain logic including:
 * - Payment entity with validation and state management
 * - Subscription entity with lifecycle management
 * - Refund entity with calculation logic and business rules
 * - Domain events for payment lifecycle tracking
 * 
 * Requirements:
 * - 11.1: Stripe checkout session creation and payment processing
 * - 11.5: Refund processing and tracking
 */

// Export all domain entities
export * from './entities';

// Export all domain events
export * from './events';