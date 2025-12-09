/**
 * Payments Schema
 * 
 * Database schema definitions for payment processing, subscriptions, and refunds
 * Includes payments, subscriptions, and refunds tables
 */

import { 
  pgTable, 
  uuid, 
  varchar, 
  decimal, 
  timestamp, 
  jsonb, 
  pgEnum, 
  boolean,
  index, 
  uniqueIndex 
} from 'drizzle-orm/pg-core';

import { courses } from './courses.schema';
import { enrollments } from './enrollments.schema';
import { users } from './users.schema';

/**
 * Payment Status Enum
 * Defines the lifecycle states of a payment transaction
 */
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'failed', 'refunded']);

/**
 * Subscription Status Enum
 * Defines the lifecycle states of a subscription
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'past_due', 'unpaid']);

/**
 * Refund Status Enum
 * Defines the lifecycle states of a refund transaction
 */
export const refundStatusEnum = pgEnum('refund_status', ['pending', 'succeeded', 'failed']);

/**
 * Payments Table
 * Represents payment transactions for course purchases
 * Integrates with Stripe for payment processing
 * 
 * Requirements:
 * - 11.1: Stripe checkout session creation and payment processing
 * - 11.5: Refund processing and tracking
 */
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  courseId: uuid('course_id')
    .references(() => courses.id, { onDelete: 'cascade' }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }).unique(),
  stripeCheckoutSessionId: varchar('stripe_checkout_session_id', { length: 255 }).unique(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on userId for fast lookups of user's payment history
  userIdx: index('payments_user_idx').on(table.userId),
  // Index on status for filtering payments by status
  statusIdx: index('payments_status_idx').on(table.status),
  // Unique index on stripePaymentIntentId for Stripe webhook processing
  stripePaymentIntentIdx: uniqueIndex('payments_stripe_payment_intent_idx').on(table.stripePaymentIntentId),
  // Unique index on stripeCheckoutSessionId for session lookups
  stripeCheckoutSessionIdx: uniqueIndex('payments_stripe_checkout_session_idx').on(table.stripeCheckoutSessionId),
  // Index on courseId for course revenue analytics
  courseIdx: index('payments_course_idx').on(table.courseId),
  // Index on createdAt for time-based queries
  createdAtIdx: index('payments_created_at_idx').on(table.createdAt),
}));

/**
 * Subscriptions Table
 * Represents recurring subscription plans for users
 * Integrates with Stripe for subscription management
 * 
 * Requirements:
 * - 11.1: Subscription creation and management
 * - 11.5: Subscription cancellation and status tracking
 */
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique().notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  planId: varchar('plan_id', { length: 100 }).notNull(),
  status: subscriptionStatusEnum('status').default('active').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on userId for fast lookups of user's subscriptions
  userIdx: index('subscriptions_user_idx').on(table.userId),
  // Index on status for filtering subscriptions by status
  statusIdx: index('subscriptions_status_idx').on(table.status),
  // Unique index on stripeSubscriptionId for Stripe webhook processing
  stripeSubscriptionIdx: uniqueIndex('subscriptions_stripe_subscription_idx').on(table.stripeSubscriptionId),
  // Index on stripeCustomerId for customer lookups
  stripeCustomerIdx: index('subscriptions_stripe_customer_idx').on(table.stripeCustomerId),
  // Index on currentPeriodEnd for renewal processing
  currentPeriodEndIdx: index('subscriptions_current_period_end_idx').on(table.currentPeriodEnd),
}));

/**
 * Refunds Table
 * Represents refund transactions for payments
 * Tracks refund status and links to original payment and enrollment
 * 
 * Requirements:
 * - 11.5: Refund processing with reason tracking
 * - 11.5: Refund status updates and enrollment status changes
 */
export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .references(() => payments.id, { onDelete: 'cascade' })
    .notNull(),
  enrollmentId: uuid('enrollment_id')
    .references(() => enrollments.id, { onDelete: 'cascade' }),
  stripeRefundId: varchar('stripe_refund_id', { length: 255 }).unique(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  reason: varchar('reason', { length: 500 }),
  status: refundStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on paymentId for fast lookups of payment refunds
  paymentIdx: index('refunds_payment_idx').on(table.paymentId),
  // Index on enrollmentId for enrollment refund lookups
  enrollmentIdx: index('refunds_enrollment_idx').on(table.enrollmentId),
  // Index on status for filtering refunds by status
  statusIdx: index('refunds_status_idx').on(table.status),
  // Unique index on stripeRefundId for Stripe webhook processing
  stripeRefundIdx: uniqueIndex('refunds_stripe_refund_idx').on(table.stripeRefundId),
  // Index on createdAt for time-based queries
  createdAtIdx: index('refunds_created_at_idx').on(table.createdAt),
}));

/**
 * Type exports for use in application code
 */
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
