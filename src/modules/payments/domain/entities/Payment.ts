/**
 * Payment Domain Entity
 * 
 * Represents a payment transaction for course purchases.
 * Contains business logic for payment validation and state management.
 * 
 * Requirements:
 * - 11.1: Stripe checkout session creation and payment processing
 * - 11.5: Refund processing and tracking
 */

import { randomUUID } from 'crypto';
import { PaymentCreatedEvent, PaymentSucceededEvent, PaymentFailedEvent, PaymentRefundedEvent } from '../events/PaymentEvents';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface PaymentData {
  id: string;
  userId: string;
  courseId?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  amount: string; // Decimal as string for precision
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentData {
  userId: string;
  courseId?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  amount: string;
  currency?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

/**
 * Payment Entity
 * 
 * Encapsulates payment business logic and validation rules.
 * Ensures payment data integrity and business rule compliance.
 */
export class Payment {
  private constructor(private data: PaymentData) {
    this.validatePayment();
  }

  /**
   * Creates a new Payment entity
   * 
   * @param data - Payment creation data
   * @returns Payment entity
   * @throws Error if validation fails
   */
  static create(data: CreatePaymentData): Payment {
    const now = new Date();
    const paymentData: PaymentData = {
      id: randomUUID(),
      userId: data.userId,
      courseId: data.courseId,
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeCheckoutSessionId: data.stripeCheckoutSessionId,
      amount: data.amount,
      currency: data.currency || 'USD',
      status: 'pending',
      paymentMethod: data.paymentMethod,
      metadata: data.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    const payment = new Payment(paymentData);
    
    // Emit domain event for payment creation
    payment.addDomainEvent(new PaymentCreatedEvent(payment.getId(), payment.getUserId(), payment.getAmount(), payment.getCurrency()));
    
    return payment;
  }

  /**
   * Reconstructs Payment entity from database data
   * 
   * @param data - Complete payment data from database
   * @returns Payment entity
   */
  static fromData(data: PaymentData): Payment {
    return new Payment(data);
  }

  /**
   * Validates payment data according to business rules
   * 
   * @throws Error if validation fails
   */
  private validatePayment(): void {
    if (!this.data.userId) {
      throw new Error('Payment must have a user ID');
    }

    if (!this.data.amount || parseFloat(this.data.amount) <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (parseFloat(this.data.amount) > 999999.99) {
      throw new Error('Payment amount cannot exceed $999,999.99');
    }

    if (!this.data.currency || this.data.currency.length !== 3) {
      throw new Error('Payment currency must be a valid 3-letter ISO code');
    }

    if (!['pending', 'succeeded', 'failed', 'refunded'].includes(this.data.status)) {
      throw new Error('Payment status must be pending, succeeded, failed, or refunded');
    }

    // Validate Stripe IDs format if provided
    if (this.data.stripePaymentIntentId && !this.data.stripePaymentIntentId.startsWith('pi_')) {
      throw new Error('Stripe payment intent ID must start with "pi_"');
    }

    if (this.data.stripeCheckoutSessionId && !this.data.stripeCheckoutSessionId.startsWith('cs_')) {
      throw new Error('Stripe checkout session ID must start with "cs_"');
    }
  }

  /**
   * Marks payment as succeeded
   * 
   * @param stripePaymentIntentId - Stripe payment intent ID
   * @param paymentMethod - Payment method used
   */
  markAsSucceeded(stripePaymentIntentId: string, paymentMethod?: string): void {
    if (this.data.status !== 'pending') {
      throw new Error('Only pending payments can be marked as succeeded');
    }

    this.data.status = 'succeeded';
    this.data.stripePaymentIntentId = stripePaymentIntentId;
    this.data.paymentMethod = paymentMethod;
    this.data.updatedAt = new Date();

    // Emit domain event for payment success
    this.addDomainEvent(new PaymentSucceededEvent(this.data.id, this.data.userId, this.data.amount, this.data.currency));
  }

  /**
   * Marks payment as failed
   * 
   * @param reason - Failure reason
   */
  markAsFailed(reason?: string): void {
    if (this.data.status !== 'pending') {
      throw new Error('Only pending payments can be marked as failed');
    }

    this.data.status = 'failed';
    this.data.updatedAt = new Date();
    
    if (reason) {
      this.data.metadata = { ...this.data.metadata, failureReason: reason };
    }

    // Emit domain event for payment failure
    this.addDomainEvent(new PaymentFailedEvent(this.data.id, this.data.userId, reason));
  }

  /**
   * Marks payment as refunded
   * 
   * @param refundAmount - Amount refunded
   */
  markAsRefunded(refundAmount: string): void {
    if (this.data.status !== 'succeeded') {
      throw new Error('Only succeeded payments can be refunded');
    }

    if (parseFloat(refundAmount) > parseFloat(this.data.amount)) {
      throw new Error('Refund amount cannot exceed original payment amount');
    }

    this.data.status = 'refunded';
    this.data.updatedAt = new Date();
    this.data.metadata = { ...this.data.metadata, refundAmount };

    // Emit domain event for payment refund
    this.addDomainEvent(new PaymentRefundedEvent(this.data.id, this.data.userId, refundAmount, this.data.currency));
  }

  /**
   * Checks if payment can be refunded
   * 
   * @returns true if payment can be refunded
   */
  canBeRefunded(): boolean {
    return this.data.status === 'succeeded';
  }

  /**
   * Gets the maximum refundable amount
   * 
   * @returns Maximum refundable amount as string
   */
  getMaxRefundableAmount(): string {
    if (!this.canBeRefunded()) {
      return '0.00';
    }
    return this.data.amount;
  }

  /**
   * Updates payment metadata
   * 
   * @param metadata - Additional metadata to merge
   */
  updateMetadata(metadata: Record<string, any>): void {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    this.data.updatedAt = new Date();
  }

  // Getters
  getId(): string {
    return this.data.id;
  }

  getUserId(): string {
    return this.data.userId;
  }

  getCourseId(): string | undefined {
    return this.data.courseId;
  }

  getStripePaymentIntentId(): string | undefined {
    return this.data.stripePaymentIntentId;
  }

  getStripeCheckoutSessionId(): string | undefined {
    return this.data.stripeCheckoutSessionId;
  }

  getAmount(): string {
    return this.data.amount;
  }

  getCurrency(): string {
    return this.data.currency;
  }

  getStatus(): PaymentStatus {
    return this.data.status;
  }

  getPaymentMethod(): string | undefined {
    return this.data.paymentMethod;
  }

  getMetadata(): Record<string, any> {
    return { ...this.data.metadata };
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
  toData(): PaymentData {
    return { ...this.data };
  }

  // Domain events handling
  private domainEvents: any[] = [];

  private addDomainEvent(event: any): void {
    this.domainEvents.push(event);
  }

  getDomainEvents(): any[] {
    return [...this.domainEvents];
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}