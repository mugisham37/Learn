/**
 * Payment Domain Events
 *
 * Defines domain events for payment lifecycle management.
 * These events are emitted when significant payment state changes occur.
 *
 * Requirements:
 * - 11.1: Payment processing events for enrollment creation
 * - 11.5: Refund processing events for enrollment status updates
 */

/**
 * Base interface for all payment domain events
 */
export interface PaymentDomainEvent {
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  version: number;
}

/**
 * Payment Created Event
 * Emitted when a new payment is created
 */
export class PaymentCreatedEvent implements PaymentDomainEvent {
  readonly eventType = 'PaymentCreated';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly amount: string,
    public readonly currency: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Payment Succeeded Event
 * Emitted when a payment is successfully processed
 * Triggers enrollment creation and confirmation email
 */
export class PaymentSucceededEvent implements PaymentDomainEvent {
  readonly eventType = 'PaymentSucceeded';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly amount: string,
    public readonly currency: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Payment Failed Event
 * Emitted when a payment fails to process
 * Triggers failure notification to user
 */
export class PaymentFailedEvent implements PaymentDomainEvent {
  readonly eventType = 'PaymentFailed';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly reason?: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Payment Refunded Event
 * Emitted when a payment is refunded
 * Triggers enrollment status update and analytics adjustment
 */
export class PaymentRefundedEvent implements PaymentDomainEvent {
  readonly eventType = 'PaymentRefunded';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly refundAmount: string,
    public readonly currency: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Subscription Created Event
 * Emitted when a new subscription is created
 */
export class SubscriptionCreatedEvent implements PaymentDomainEvent {
  readonly eventType = 'SubscriptionCreated';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly planId: string,
    public readonly currentPeriodEnd: Date
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Subscription Canceled Event
 * Emitted when a subscription is canceled
 */
export class SubscriptionCanceledEvent implements PaymentDomainEvent {
  readonly eventType = 'SubscriptionCanceled';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly effectiveDate: Date,
    public readonly cancelAtPeriodEnd: boolean
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Subscription Renewed Event
 * Emitted when a subscription is renewed for the next billing period
 */
export class SubscriptionRenewedEvent implements PaymentDomainEvent {
  readonly eventType = 'SubscriptionRenewed';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly userId: string,
    public readonly newPeriodStart: Date,
    public readonly newPeriodEnd: Date
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Refund Created Event
 * Emitted when a refund request is created
 */
export class RefundCreatedEvent implements PaymentDomainEvent {
  readonly eventType = 'RefundCreated';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly paymentId: string,
    public readonly amount: string,
    public readonly reason?: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Refund Processed Event
 * Emitted when a refund is successfully processed or fails
 */
export class RefundProcessedEvent implements PaymentDomainEvent {
  readonly eventType = 'RefundProcessed';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly paymentId: string,
    public readonly amount: string,
    public readonly status: 'succeeded' | 'failed'
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Refund Failed Event
 * Emitted when a refund fails to process
 */
export class RefundFailedEvent implements PaymentDomainEvent {
  readonly eventType = 'RefundFailed';
  readonly occurredAt: Date;
  readonly version = 1;

  constructor(
    public readonly aggregateId: string,
    public readonly paymentId: string,
    public readonly reason: string
  ) {
    this.occurredAt = new Date();
  }
}

/**
 * Union type of all payment domain events
 */
export type PaymentDomainEvents =
  | PaymentCreatedEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | PaymentRefundedEvent
  | SubscriptionCreatedEvent
  | SubscriptionCanceledEvent
  | SubscriptionRenewedEvent
  | RefundCreatedEvent
  | RefundProcessedEvent
  | RefundFailedEvent;
