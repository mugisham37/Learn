/**
 * Refund Domain Entity
 *
 * Represents a refund transaction for payments.
 * Contains business logic for refund calculation and processing.
 *
 * Requirements:
 * - 11.5: Refund processing with reason tracking
 * - 11.5: Refund status updates and enrollment status changes
 */

import { randomUUID } from 'crypto';

import {
  RefundCreatedEvent,
  RefundProcessedEvent,
  RefundFailedEvent,
  PaymentDomainEvents,
} from '../events/PaymentEvents';

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

export interface RefundData {
  id: string;
  paymentId: string;
  enrollmentId?: string;
  stripeRefundId?: string;
  amount: string; // Decimal as string for precision
  reason?: string;
  status: RefundStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRefundData {
  paymentId: string;
  enrollmentId?: string;
  amount: string;
  reason?: string;
}

/**
 * Refund Policy Configuration
 * Defines business rules for refund calculations
 */
export interface RefundPolicy {
  // Maximum days after purchase to allow full refund
  fullRefundDays: number;
  // Percentage of refund based on content consumed
  contentConsumptionThreshold: number; // 0-100
  // Minimum refund percentage regardless of consumption
  minimumRefundPercentage: number; // 0-100
  // Administrative fee for processing refunds
  administrativeFeePercentage: number; // 0-100
}

/**
 * Default refund policy
 */
export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  fullRefundDays: 30,
  contentConsumptionThreshold: 25, // 25% content consumed
  minimumRefundPercentage: 50, // Minimum 50% refund
  administrativeFeePercentage: 5, // 5% administrative fee
};

/**
 * Refund Entity
 *
 * Encapsulates refund business logic and calculation rules.
 * Ensures refund processing follows business policies.
 */
export class Refund {
  private constructor(private data: RefundData) {
    this.validateRefund();
  }

  /**
   * Creates a new Refund entity
   *
   * @param data - Refund creation data
   * @returns Refund entity
   * @throws Error if validation fails
   */
  static create(data: CreateRefundData): Refund {
    const now = new Date();
    const refundData: RefundData = {
      id: randomUUID(),
      paymentId: data.paymentId,
      enrollmentId: data.enrollmentId,
      amount: data.amount,
      reason: data.reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const refund = new Refund(refundData);

    // Emit domain event for refund creation
    refund.addDomainEvent(
      new RefundCreatedEvent(
        refund.getId(),
        refund.getPaymentId(),
        refund.getAmount(),
        refund.getReason()
      )
    );

    return refund;
  }

  /**
   * Reconstructs Refund entity from database data
   *
   * @param data - Complete refund data from database
   * @returns Refund entity
   */
  static fromData(data: RefundData): Refund {
    return new Refund(data);
  }

  /**
   * Calculates refund amount based on business policy and content consumption
   *
   * @param originalAmount - Original payment amount
   * @param purchaseDate - Date of original purchase
   * @param contentConsumedPercentage - Percentage of content consumed (0-100)
   * @param policy - Refund policy to apply (optional, uses default if not provided)
   * @returns Calculated refund amount as string
   */
  static calculateRefundAmount(
    originalAmount: string,
    purchaseDate: Date,
    contentConsumedPercentage: number,
    policy: RefundPolicy = DEFAULT_REFUND_POLICY
  ): string {
    const amount = parseFloat(originalAmount);
    const now = new Date();
    const daysSincePurchase = Math.floor(
      (now.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24)
    );

    // Validate inputs
    if (amount <= 0) {
      throw new Error('Original amount must be greater than zero');
    }

    if (contentConsumedPercentage < 0 || contentConsumedPercentage > 100) {
      throw new Error('Content consumed percentage must be between 0 and 100');
    }

    // If within full refund period and low content consumption, give full refund minus admin fee
    if (
      daysSincePurchase <= policy.fullRefundDays &&
      contentConsumedPercentage <= policy.contentConsumptionThreshold
    ) {
      const adminFee = amount * (policy.administrativeFeePercentage / 100);
      const refundAmount = amount - adminFee;
      return Math.max(0, refundAmount).toFixed(2);
    }

    // Calculate refund based on content consumption
    let refundPercentage = 100 - contentConsumedPercentage;

    // Apply minimum refund percentage
    refundPercentage = Math.max(refundPercentage, policy.minimumRefundPercentage);

    // Calculate refund amount
    let refundAmount = amount * (refundPercentage / 100);

    // Subtract administrative fee
    const adminFee = amount * (policy.administrativeFeePercentage / 100);
    refundAmount = refundAmount - adminFee;

    // Ensure refund amount is not negative
    refundAmount = Math.max(0, refundAmount);

    return refundAmount.toFixed(2);
  }

  /**
   * Validates refund data according to business rules
   *
   * @throws Error if validation fails
   */
  private validateRefund(): void {
    if (!this.data.paymentId) {
      throw new Error('Refund must have a payment ID');
    }

    if (!this.data.amount || parseFloat(this.data.amount) <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }

    if (parseFloat(this.data.amount) > 999999.99) {
      throw new Error('Refund amount cannot exceed $999,999.99');
    }

    if (!['pending', 'succeeded', 'failed'].includes(this.data.status)) {
      throw new Error('Refund status must be pending, succeeded, or failed');
    }

    // Validate Stripe refund ID format if provided
    if (this.data.stripeRefundId && !this.data.stripeRefundId.startsWith('re_')) {
      throw new Error('Stripe refund ID must start with "re_"');
    }

    // Validate reason length if provided
    if (this.data.reason && this.data.reason.length > 500) {
      throw new Error('Refund reason cannot exceed 500 characters');
    }
  }

  /**
   * Marks refund as succeeded
   *
   * @param stripeRefundId - Stripe refund ID
   */
  markAsSucceeded(stripeRefundId: string): void {
    if (this.data.status !== 'pending') {
      throw new Error('Only pending refunds can be marked as succeeded');
    }

    if (!stripeRefundId || !stripeRefundId.startsWith('re_')) {
      throw new Error('Valid Stripe refund ID is required');
    }

    this.data.status = 'succeeded';
    this.data.stripeRefundId = stripeRefundId;
    this.data.updatedAt = new Date();

    // Emit domain event for refund success
    this.addDomainEvent(
      new RefundProcessedEvent(this.data.id, this.data.paymentId, this.data.amount, 'succeeded')
    );
  }

  /**
   * Marks refund as failed
   *
   * @param reason - Failure reason
   */
  markAsFailed(reason?: string): void {
    if (this.data.status !== 'pending') {
      throw new Error('Only pending refunds can be marked as failed');
    }

    this.data.status = 'failed';
    this.data.updatedAt = new Date();

    // Update reason if provided
    if (reason) {
      this.data.reason = reason;
    }

    // Emit domain event for refund failure
    this.addDomainEvent(
      new RefundFailedEvent(this.data.id, this.data.paymentId, reason || 'Refund processing failed')
    );
  }

  /**
   * Updates refund reason
   *
   * @param reason - New refund reason
   */
  updateReason(reason: string): void {
    if (reason.length > 500) {
      throw new Error('Refund reason cannot exceed 500 characters');
    }

    this.data.reason = reason;
    this.data.updatedAt = new Date();
  }

  /**
   * Checks if refund is still pending
   *
   * @returns true if refund is pending
   */
  isPending(): boolean {
    return this.data.status === 'pending';
  }

  /**
   * Checks if refund was successful
   *
   * @returns true if refund succeeded
   */
  isSucceeded(): boolean {
    return this.data.status === 'succeeded';
  }

  /**
   * Checks if refund failed
   *
   * @returns true if refund failed
   */
  isFailed(): boolean {
    return this.data.status === 'failed';
  }

  /**
   * Gets refund amount as number for calculations
   *
   * @returns Refund amount as number
   */
  getAmountAsNumber(): number {
    return parseFloat(this.data.amount);
  }

  // Getters
  getId(): string {
    return this.data.id;
  }

  getPaymentId(): string {
    return this.data.paymentId;
  }

  getEnrollmentId(): string | undefined {
    return this.data.enrollmentId;
  }

  getStripeRefundId(): string | undefined {
    return this.data.stripeRefundId;
  }

  getAmount(): string {
    return this.data.amount;
  }

  getReason(): string | undefined {
    return this.data.reason;
  }

  getStatus(): RefundStatus {
    return this.data.status;
  }

  getCreatedAt(): Date {
    return this.data.createdAt;
  }

  getUpdatedAt(): Date {
    return this.data.updatedAt;
  }

  /**
   * Converts entity to plain object for persistence
   *
   * @returns Plain object representation
   */
  toData(): RefundData {
    return { ...this.data };
  }

  // Domain events handling
  private domainEvents: PaymentDomainEvents[] = [];

  private addDomainEvent(event: PaymentDomainEvents): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): PaymentDomainEvents[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}
