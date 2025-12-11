/**
 * Payment Repository Interface
 * 
 * Defines the contract for payment data access operations.
 * Abstracts database operations behind a clean interface following
 * the Repository pattern for domain independence.
 * 
 * Requirements: 11.1, 11.5
 */

import { 
  Payment, 
  Subscription, 
  Refund 
} from '../../../../infrastructure/database/schema/payments.schema.js';

/**
 * Data Transfer Object for creating a new payment
 */
export interface CreatePaymentDTO {
  userId: string;
  courseId?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  amount: string; // Decimal as string for precision
  currency?: string;
  status?: 'pending' | 'succeeded' | 'failed' | 'refunded';
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Data Transfer Object for updating a payment
 */
export interface UpdatePaymentDTO {
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  amount?: string;
  currency?: string;
  status?: 'pending' | 'succeeded' | 'failed' | 'refunded';
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Data Transfer Object for creating a new subscription
 */
export interface CreateSubscriptionDTO {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planId: string;
  status?: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Data Transfer Object for updating a subscription
 */
export interface UpdateSubscriptionDTO {
  status?: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Data Transfer Object for creating a new refund
 */
export interface CreateRefundDTO {
  paymentId: string;
  enrollmentId?: string;
  stripeRefundId?: string;
  amount: string; // Decimal as string for precision
  reason?: string;
  status?: 'pending' | 'succeeded' | 'failed';
}

/**
 * Data Transfer Object for updating a refund
 */
export interface UpdateRefundDTO {
  stripeRefundId?: string;
  amount?: string;
  reason?: string;
  status?: 'pending' | 'succeeded' | 'failed';
}

/**
 * Pagination parameters for payment history queries
 */
export interface PaginationDTO {
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Payment history filter options
 */
export interface PaymentHistoryFilter {
  userId?: string;
  courseId?: string;
  status?: 'pending' | 'succeeded' | 'failed' | 'refunded';
  startDate?: Date;
  endDate?: Date;
}

/**
 * Payment Repository Interface
 * 
 * Provides methods for all payment data access operations with caching support.
 * Implementations must handle database errors and map them to domain errors.
 */
export interface IPaymentRepository {
  /**
   * Creates a new payment in the database
   * 
   * @param data - Payment creation data
   * @returns The created payment
   * @throws DatabaseError if database operation fails
   */
  create(data: CreatePaymentDTO): Promise<Payment>;

  /**
   * Finds a payment by its unique ID
   * 
   * @param id - Payment ID
   * @returns The payment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Payment | null>;

  /**
   * Finds a payment by Stripe payment intent ID
   * 
   * @param stripePaymentIntentId - Stripe payment intent ID
   * @returns The payment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | null>;

  /**
   * Finds a payment by Stripe checkout session ID
   * 
   * @param stripeCheckoutSessionId - Stripe checkout session ID
   * @returns The payment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByStripeCheckoutSessionId(stripeCheckoutSessionId: string): Promise<Payment | null>;

  /**
   * Updates a payment's data
   * 
   * @param id - Payment ID
   * @param data - Update data
   * @returns The updated payment
   * @throws NotFoundError if payment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdatePaymentDTO): Promise<Payment>;

  /**
   * Gets payment history for a user with pagination
   * 
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @returns Paginated payment history
   * @throws DatabaseError if database operation fails
   */
  getPaymentHistory(userId: string, pagination: PaginationDTO): Promise<PaginatedResult<Payment>>;

  /**
   * Gets payment history with filters and pagination
   * 
   * @param filter - Filter criteria
   * @param pagination - Pagination parameters
   * @returns Paginated filtered payment history
   * @throws DatabaseError if database operation fails
   */
  getFilteredPaymentHistory(
    filter: PaymentHistoryFilter, 
    pagination: PaginationDTO
  ): Promise<PaginatedResult<Payment>>;

  /**
   * Gets payments by status
   * 
   * @param status - Payment status
   * @param pagination - Pagination parameters
   * @returns Paginated payments with specified status
   * @throws DatabaseError if database operation fails
   */
  findByStatus(
    status: 'pending' | 'succeeded' | 'failed' | 'refunded',
    pagination: PaginationDTO
  ): Promise<PaginatedResult<Payment>>;

  /**
   * Gets total revenue for a course
   * 
   * @param courseId - Course ID
   * @returns Total revenue amount
   * @throws DatabaseError if database operation fails
   */
  getTotalRevenueByCourse(courseId: string): Promise<string>;

  /**
   * Gets total revenue for a user (instructor)
   * 
   * @param userId - User ID
   * @returns Total revenue amount
   * @throws DatabaseError if database operation fails
   */
  getTotalRevenueByUser(userId: string): Promise<string>;

  /**
   * Invalidates cache for a specific payment
   * Should be called after any update operation
   * 
   * @param id - Payment ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;
}

/**
 * Subscription Repository Interface
 * 
 * Provides methods for subscription data access operations.
 */
export interface ISubscriptionRepository {
  /**
   * Creates a new subscription in the database
   * 
   * @param data - Subscription creation data
   * @returns The created subscription
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateSubscriptionDTO): Promise<Subscription>;

  /**
   * Finds a subscription by its unique ID
   * 
   * @param id - Subscription ID
   * @returns The subscription if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Subscription | null>;

  /**
   * Finds a subscription by Stripe subscription ID
   * 
   * @param stripeSubscriptionId - Stripe subscription ID
   * @returns The subscription if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>;

  /**
   * Finds subscriptions by user ID
   * 
   * @param userId - User ID
   * @returns Array of user's subscriptions
   * @throws DatabaseError if database operation fails
   */
  findByUserId(userId: string): Promise<Subscription[]>;

  /**
   * Updates a subscription's data
   * 
   * @param id - Subscription ID
   * @param data - Update data
   * @returns The updated subscription
   * @throws NotFoundError if subscription doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateSubscriptionDTO): Promise<Subscription>;

  /**
   * Gets subscriptions expiring soon (within specified days)
   * 
   * @param days - Number of days to look ahead
   * @returns Array of expiring subscriptions
   * @throws DatabaseError if database operation fails
   */
  findExpiringSoon(days: number): Promise<Subscription[]>;

  /**
   * Gets active subscriptions for a user
   * 
   * @param userId - User ID
   * @returns Array of active subscriptions
   * @throws DatabaseError if database operation fails
   */
  findActiveByUserId(userId: string): Promise<Subscription[]>;

  /**
   * Invalidates cache for a specific subscription
   * Should be called after any update operation
   * 
   * @param id - Subscription ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;
}

/**
 * Refund Repository Interface
 * 
 * Provides methods for refund data access operations.
 */
export interface IRefundRepository {
  /**
   * Creates a new refund in the database
   * 
   * @param data - Refund creation data
   * @returns The created refund
   * @throws DatabaseError if database operation fails
   */
  create(data: CreateRefundDTO): Promise<Refund>;

  /**
   * Finds a refund by its unique ID
   * 
   * @param id - Refund ID
   * @returns The refund if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findById(id: string): Promise<Refund | null>;

  /**
   * Finds a refund by Stripe refund ID
   * 
   * @param stripeRefundId - Stripe refund ID
   * @returns The refund if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  findByStripeRefundId(stripeRefundId: string): Promise<Refund | null>;

  /**
   * Finds refunds by payment ID
   * 
   * @param paymentId - Payment ID
   * @returns Array of refunds for the payment
   * @throws DatabaseError if database operation fails
   */
  findByPaymentId(paymentId: string): Promise<Refund[]>;

  /**
   * Finds refunds by enrollment ID
   * 
   * @param enrollmentId - Enrollment ID
   * @returns Array of refunds for the enrollment
   * @throws DatabaseError if database operation fails
   */
  findByEnrollmentId(enrollmentId: string): Promise<Refund[]>;

  /**
   * Updates a refund's data
   * 
   * @param id - Refund ID
   * @param data - Update data
   * @returns The updated refund
   * @throws NotFoundError if refund doesn't exist
   * @throws DatabaseError if database operation fails
   */
  update(id: string, data: UpdateRefundDTO): Promise<Refund>;

  /**
   * Gets refunds by status
   * 
   * @param status - Refund status
   * @param pagination - Pagination parameters
   * @returns Paginated refunds with specified status
   * @throws DatabaseError if database operation fails
   */
  findByStatus(
    status: 'pending' | 'succeeded' | 'failed',
    pagination: PaginationDTO
  ): Promise<PaginatedResult<Refund>>;

  /**
   * Gets total refunded amount for a payment
   * 
   * @param paymentId - Payment ID
   * @returns Total refunded amount
   * @throws DatabaseError if database operation fails
   */
  getTotalRefundedByPayment(paymentId: string): Promise<string>;

  /**
   * Invalidates cache for a specific refund
   * Should be called after any update operation
   * 
   * @param id - Refund ID
   * @returns void
   */
  invalidateCache(id: string): Promise<void>;
}