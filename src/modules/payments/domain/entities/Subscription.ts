/**
 * Subscription Domain Entity
 *
 * Represents a recurring subscription plan for users.
 * Contains business logic for subscription lifecycle management.
 *
 * Requirements:
 * - 11.1: Subscription creation and management
 * - 11.5: Subscription cancellation and status tracking
 */

import { randomUUID } from 'crypto';
import {
  SubscriptionCreatedEvent,
  SubscriptionCanceledEvent,
  SubscriptionRenewedEvent,
} from '../events/PaymentEvents';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid';

export interface SubscriptionData {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionData {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Subscription Entity
 *
 * Encapsulates subscription business logic and validation rules.
 * Manages subscription lifecycle and billing periods.
 */
export class Subscription {
  private constructor(private data: SubscriptionData) {
    this.validateSubscription();
  }

  /**
   * Creates a new Subscription entity
   *
   * @param data - Subscription creation data
   * @returns Subscription entity
   * @throws Error if validation fails
   */
  static create(data: CreateSubscriptionData): Subscription {
    const now = new Date();
    const subscriptionData: SubscriptionData = {
      id: randomUUID(),
      userId: data.userId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripeCustomerId: data.stripeCustomerId,
      planId: data.planId,
      status: 'active',
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };

    const subscription = new Subscription(subscriptionData);

    // Emit domain event for subscription creation
    subscription.addDomainEvent(
      new SubscriptionCreatedEvent(
        subscription.getId(),
        subscription.getUserId(),
        subscription.getPlanId(),
        subscription.getCurrentPeriodEnd()
      )
    );

    return subscription;
  }

  /**
   * Reconstructs Subscription entity from database data
   *
   * @param data - Complete subscription data from database
   * @returns Subscription entity
   */
  static fromData(data: SubscriptionData): Subscription {
    return new Subscription(data);
  }

  /**
   * Validates subscription data according to business rules
   *
   * @throws Error if validation fails
   */
  private validateSubscription(): void {
    if (!this.data.userId) {
      throw new Error('Subscription must have a user ID');
    }

    if (!this.data.stripeSubscriptionId || !this.data.stripeSubscriptionId.startsWith('sub_')) {
      throw new Error('Stripe subscription ID must start with "sub_"');
    }

    if (!this.data.stripeCustomerId || !this.data.stripeCustomerId.startsWith('cus_')) {
      throw new Error('Stripe customer ID must start with "cus_"');
    }

    if (!this.data.planId) {
      throw new Error('Subscription must have a plan ID');
    }

    if (!['active', 'canceled', 'past_due', 'unpaid'].includes(this.data.status)) {
      throw new Error('Subscription status must be active, canceled, past_due, or unpaid');
    }

    if (this.data.currentPeriodStart >= this.data.currentPeriodEnd) {
      throw new Error('Current period start must be before current period end');
    }

    // Validate that current period is not in the distant past (more than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (this.data.currentPeriodStart < oneYearAgo) {
      throw new Error('Current period start cannot be more than 1 year in the past');
    }

    // Validate that current period end is not too far in the future (more than 2 years)
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    if (this.data.currentPeriodEnd > twoYearsFromNow) {
      throw new Error('Current period end cannot be more than 2 years in the future');
    }
  }

  /**
   * Cancels the subscription at the end of the current period
   */
  cancelAtPeriodEnd(): void {
    if (this.data.status !== 'active') {
      throw new Error('Only active subscriptions can be canceled');
    }

    this.data.cancelAtPeriodEnd = true;
    this.data.updatedAt = new Date();

    // Emit domain event for subscription cancellation
    this.addDomainEvent(
      new SubscriptionCanceledEvent(
        this.data.id,
        this.data.userId,
        this.data.currentPeriodEnd,
        true // cancelAtPeriodEnd
      )
    );
  }

  /**
   * Cancels the subscription immediately
   */
  cancelImmediately(): void {
    if (this.data.status !== 'active') {
      throw new Error('Only active subscriptions can be canceled');
    }

    this.data.status = 'canceled';
    this.data.cancelAtPeriodEnd = false;
    this.data.updatedAt = new Date();

    // Emit domain event for immediate subscription cancellation
    this.addDomainEvent(
      new SubscriptionCanceledEvent(
        this.data.id,
        this.data.userId,
        new Date(), // canceled immediately
        false // not cancelAtPeriodEnd
      )
    );
  }

  /**
   * Reactivates a canceled subscription
   */
  reactivate(): void {
    if (this.data.status !== 'canceled' && !this.data.cancelAtPeriodEnd) {
      throw new Error(
        'Only canceled subscriptions or those marked for cancellation can be reactivated'
      );
    }

    this.data.status = 'active';
    this.data.cancelAtPeriodEnd = false;
    this.data.updatedAt = new Date();
  }

  /**
   * Updates subscription status
   *
   * @param status - New subscription status
   */
  updateStatus(status: SubscriptionStatus): void {
    if (this.data.status === status) {
      return; // No change needed
    }

    this.data.status = status;
    this.data.updatedAt = new Date();

    // If subscription becomes unpaid or past_due, don't cancel at period end
    if (status === 'unpaid' || status === 'past_due') {
      this.data.cancelAtPeriodEnd = false;
    }
  }

  /**
   * Renews the subscription for the next billing period
   *
   * @param newPeriodStart - Start of new billing period
   * @param newPeriodEnd - End of new billing period
   */
  renew(newPeriodStart: Date, newPeriodEnd: Date): void {
    if (this.data.status !== 'active') {
      throw new Error('Only active subscriptions can be renewed');
    }

    if (newPeriodStart <= this.data.currentPeriodEnd) {
      throw new Error('New period start must be after current period end');
    }

    if (newPeriodStart >= newPeriodEnd) {
      throw new Error('New period start must be before new period end');
    }

    this.data.currentPeriodStart = newPeriodStart;
    this.data.currentPeriodEnd = newPeriodEnd;
    this.data.cancelAtPeriodEnd = false; // Reset cancellation flag on renewal
    this.data.updatedAt = new Date();

    // Emit domain event for subscription renewal
    this.addDomainEvent(
      new SubscriptionRenewedEvent(this.data.id, this.data.userId, newPeriodStart, newPeriodEnd)
    );
  }

  /**
   * Checks if subscription is currently active
   *
   * @returns true if subscription is active and not expired
   */
  isActive(): boolean {
    const now = new Date();
    return this.data.status === 'active' && this.data.currentPeriodEnd > now;
  }

  /**
   * Checks if subscription is expired
   *
   * @returns true if subscription has passed its current period end
   */
  isExpired(): boolean {
    const now = new Date();
    return this.data.currentPeriodEnd <= now;
  }

  /**
   * Checks if subscription will be canceled at period end
   *
   * @returns true if subscription is marked for cancellation
   */
  willCancelAtPeriodEnd(): boolean {
    return this.data.cancelAtPeriodEnd;
  }

  /**
   * Gets days remaining in current billing period
   *
   * @returns Number of days remaining, or 0 if expired
   */
  getDaysRemaining(): number {
    const now = new Date();
    if (this.data.currentPeriodEnd <= now) {
      return 0;
    }

    const timeDiff = this.data.currentPeriodEnd.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  // Getters
  getId(): string {
    return this.data.id;
  }

  getUserId(): string {
    return this.data.userId;
  }

  getStripeSubscriptionId(): string {
    return this.data.stripeSubscriptionId;
  }

  getStripeCustomerId(): string {
    return this.data.stripeCustomerId;
  }

  getPlanId(): string {
    return this.data.planId;
  }

  getStatus(): SubscriptionStatus {
    return this.data.status;
  }

  getCurrentPeriodStart(): Date {
    return this.data.currentPeriodStart;
  }

  getCurrentPeriodEnd(): Date {
    return this.data.currentPeriodEnd;
  }

  getCancelAtPeriodEnd(): boolean {
    return this.data.cancelAtPeriodEnd;
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
  toData(): SubscriptionData {
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
