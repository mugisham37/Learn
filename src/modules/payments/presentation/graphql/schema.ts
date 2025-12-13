/**
 * GraphQL Schema for Payments Module
 *
 * Defines GraphQL types, inputs, and schema for payment processing,
 * subscription management, and refund operations.
 *
 * Requirements: 21.1, 21.2
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for payments module
 */
export const paymentTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON
  scalar Decimal

  # Enums
  enum PaymentStatus {
    PENDING
    SUCCEEDED
    FAILED
    REFUNDED
  }

  enum SubscriptionStatus {
    ACTIVE
    CANCELED
    PAST_DUE
    UNPAID
  }

  enum RefundStatus {
    PENDING
    SUCCEEDED
    FAILED
  }

  # Object Types
  type Payment {
    id: ID!
    userId: ID!
    user: User!
    courseId: ID
    course: Course
    stripePaymentIntentId: String
    stripeCheckoutSessionId: String
    amount: Decimal!
    currency: String!
    status: PaymentStatus!
    paymentMethod: String
    metadata: JSON
    refunds: [Refund!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Subscription {
    id: ID!
    userId: ID!
    user: User!
    stripeSubscriptionId: String!
    stripeCustomerId: String!
    planId: String!
    status: SubscriptionStatus!
    currentPeriodStart: DateTime!
    currentPeriodEnd: DateTime!
    cancelAtPeriodEnd: Boolean!
    daysRemaining: Int!
    isActive: Boolean!
    isExpired: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Refund {
    id: ID!
    paymentId: ID!
    payment: Payment!
    enrollmentId: ID
    enrollment: Enrollment
    stripeRefundId: String
    amount: Decimal!
    reason: String
    status: RefundStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CheckoutSession {
    sessionId: String!
    sessionUrl: String!
    paymentId: ID!
  }

  type PaymentHistory {
    payments: [Payment!]!
    total: Int!
    page: Int!
    limit: Int!
    totalPages: Int!
  }

  type RefundEligibility {
    eligible: Boolean!
    reason: String
    maxRefundAmount: Decimal
    refundPolicy: RefundPolicy!
  }

  type RefundPolicy {
    fullRefundDays: Int!
    contentConsumptionThreshold: Int!
    minimumRefundPercentage: Int!
    administrativeFeePercentage: Int!
  }

  # Input Types
  input CreateCheckoutSessionInput {
    courseId: ID!
    successUrl: String!
    cancelUrl: String!
    metadata: JSON
  }

  input RequestRefundInput {
    enrollmentId: ID!
    reason: String!
    amount: Decimal
  }

  input CreateSubscriptionInput {
    planId: String!
    metadata: JSON
  }

  input CancelSubscriptionInput {
    subscriptionId: ID!
    cancelAtPeriodEnd: Boolean = true
    reason: String
  }

  input PaymentHistoryInput {
    page: Int = 1
    limit: Int = 20
  }

  # Mutations
  type Mutation {
    # Payment mutations
    createCheckoutSession(input: CreateCheckoutSessionInput!): CheckoutSession!

    # Refund mutations
    requestRefund(input: RequestRefundInput!): Refund!

    # Subscription mutations
    createSubscription(input: CreateSubscriptionInput!): Subscription!
    cancelSubscription(input: CancelSubscriptionInput!): Subscription!
  }

  # Queries
  type Query {
    # Payment queries
    getPaymentHistory(input: PaymentHistoryInput): PaymentHistory!
    getPayment(id: ID!): Payment

    # Subscription queries
    getUserSubscriptions: [Subscription!]!
    getSubscription(id: ID!): Subscription

    # Refund queries
    getRefund(id: ID!): Refund
    getRefundEligibility(enrollmentId: ID!): RefundEligibility!
  }
`;
