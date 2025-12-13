/**
 * Payment Repository Implementation
 *
 * Implements payment data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 11.1, 11.5
 */

import { eq, and, desc, gte, lte, count, sum } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  payments,
  Payment,
  NewPayment,
} from '../../../../infrastructure/database/schema/payments.schema.js';
import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { DatabaseError, NotFoundError } from '../../../../shared/errors/index.js';
import {
  IPaymentRepository,
  CreatePaymentDTO,
  UpdatePaymentDTO,
  PaginationDTO,
  PaginatedResult,
  PaymentHistoryFilter,
} from './IPaymentRepository.js';

/**
 * Payment Repository Implementation
 *
 * Provides data access methods for payment entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Payment history queries with filtering and pagination
 */
export class PaymentRepository implements IPaymentRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for payment by ID
   */
  private getPaymentCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.USER, 'payment', 'id', id);
  }

  /**
   * Builds cache key for payment by Stripe payment intent ID
   */
  private getPaymentStripeIntentCacheKey(stripePaymentIntentId: string): string {
    return buildCacheKey(CachePrefix.USER, 'payment', 'stripe_intent', stripePaymentIntentId);
  }

  /**
   * Builds cache key for payment by Stripe checkout session ID
   */
  private getPaymentStripeSessionCacheKey(stripeCheckoutSessionId: string): string {
    return buildCacheKey(CachePrefix.USER, 'payment', 'stripe_session', stripeCheckoutSessionId);
  }

  /**
   * Builds cache key for user payment history
   */
  private getUserPaymentHistoryCacheKey(userId: string, page: number, limit: number): string {
    return buildCacheKey(CachePrefix.USER, 'payment', 'history', userId, page, limit);
  }

  /**
   * Creates a new payment in the database
   *
   * @param data - Payment creation data
   * @returns The created payment
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreatePaymentDTO): Promise<Payment> {
    try {
      // Prepare payment data for insertion
      const newPayment: NewPayment = {
        userId: data.userId,
        courseId: data.courseId,
        stripePaymentIntentId: data.stripePaymentIntentId,
        stripeCheckoutSessionId: data.stripeCheckoutSessionId,
        amount: data.amount,
        currency: data.currency || 'USD',
        status: data.status || 'pending',
        paymentMethod: data.paymentMethod,
        metadata: data.metadata,
      };

      // Insert payment into database
      const [createdPayment] = await this.writeDb.insert(payments).values(newPayment).returning();

      if (!createdPayment) {
        throw new DatabaseError('Failed to create payment', 'insert');
      }

      return createdPayment;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create payment',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a payment by its unique ID
   *
   * Implements caching with 5-minute TTL.
   * Uses read database for query optimization.
   *
   * @param id - Payment ID
   * @returns The payment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Payment | null> {
    try {
      // Check cache first
      const cacheKey = this.getPaymentCacheKey(id);
      const cachedPayment = await cache.get<Payment>(cacheKey);

      if (cachedPayment) {
        return cachedPayment;
      }

      // Query database if not in cache
      const [payment] = await this.readDb
        .select()
        .from(payments)
        .where(eq(payments.id, id))
        .limit(1);

      if (!payment) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, payment, CacheTTL.MEDIUM);

      return payment;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find payment by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a payment by Stripe payment intent ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param stripePaymentIntentId - Stripe payment intent ID
   * @returns The payment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | null> {
    try {
      // Check cache first
      const cacheKey = this.getPaymentStripeIntentCacheKey(stripePaymentIntentId);
      const cachedPayment = await cache.get<Payment>(cacheKey);

      if (cachedPayment) {
        return cachedPayment;
      }

      // Query database if not in cache
      const [payment] = await this.readDb
        .select()
        .from(payments)
        .where(eq(payments.stripePaymentIntentId, stripePaymentIntentId))
        .limit(1);

      if (!payment) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both Stripe intent ID and payment ID for consistency
      await Promise.all([
        cache.set(cacheKey, payment, CacheTTL.MEDIUM),
        cache.set(this.getPaymentCacheKey(payment.id), payment, CacheTTL.MEDIUM),
      ]);

      return payment;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find payment by Stripe payment intent ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a payment by Stripe checkout session ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param stripeCheckoutSessionId - Stripe checkout session ID
   * @returns The payment if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByStripeCheckoutSessionId(stripeCheckoutSessionId: string): Promise<Payment | null> {
    try {
      // Check cache first
      const cacheKey = this.getPaymentStripeSessionCacheKey(stripeCheckoutSessionId);
      const cachedPayment = await cache.get<Payment>(cacheKey);

      if (cachedPayment) {
        return cachedPayment;
      }

      // Query database if not in cache
      const [payment] = await this.readDb
        .select()
        .from(payments)
        .where(eq(payments.stripeCheckoutSessionId, stripeCheckoutSessionId))
        .limit(1);

      if (!payment) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both Stripe session ID and payment ID for consistency
      await Promise.all([
        cache.set(cacheKey, payment, CacheTTL.MEDIUM),
        cache.set(this.getPaymentCacheKey(payment.id), payment, CacheTTL.MEDIUM),
      ]);

      return payment;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find payment by Stripe checkout session ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a payment's data
   *
   * Invalidates all related cache entries after successful update.
   *
   * @param id - Payment ID
   * @param data - Update data
   * @returns The updated payment
   * @throws NotFoundError if payment doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdatePaymentDTO): Promise<Payment> {
    try {
      // First, verify payment exists
      const existingPayment = await this.findById(id);
      if (!existingPayment) {
        throw new NotFoundError('Payment', id);
      }

      // Prepare update data
      const updateData: Partial<NewPayment> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update payment in database
      const [updatedPayment] = await this.writeDb
        .update(payments)
        .set(updateData)
        .where(eq(payments.id, id))
        .returning();

      if (!updatedPayment) {
        throw new DatabaseError('Failed to update payment', 'update');
      }

      // Invalidate all cache entries for this payment
      await this.invalidateCache(id);
      if (existingPayment.stripePaymentIntentId) {
        await this.invalidateCacheByStripeIntentId(existingPayment.stripePaymentIntentId);
      }
      if (existingPayment.stripeCheckoutSessionId) {
        await this.invalidateCacheByStripeSessionId(existingPayment.stripeCheckoutSessionId);
      }

      return updatedPayment;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update payment',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets payment history for a user with pagination
   *
   * Implements caching for frequently accessed payment histories.
   *
   * @param userId - User ID
   * @param pagination - Pagination parameters
   * @returns Paginated payment history
   * @throws DatabaseError if database operation fails
   */
  async getPaymentHistory(
    userId: string,
    pagination: PaginationDTO
  ): Promise<PaginatedResult<Payment>> {
    try {
      // Check cache first
      const cacheKey = this.getUserPaymentHistoryCacheKey(
        userId,
        pagination.page,
        pagination.limit
      );
      const cachedResult = await cache.get<PaginatedResult<Payment>>(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      const offset = (pagination.page - 1) * pagination.limit;

      // Get total count
      const [totalResult] = await this.readDb
        .select({ count: count() })
        .from(payments)
        .where(eq(payments.userId, userId));

      const total = totalResult?.count || 0;

      // Get paginated data
      const paymentsData = await this.readDb
        .select()
        .from(payments)
        .where(eq(payments.userId, userId))
        .orderBy(desc(payments.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      const result: PaginatedResult<Payment> = {
        data: paymentsData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, result, CacheTTL.MEDIUM);

      return result;
    } catch (error) {
      throw new DatabaseError(
        'Failed to get payment history',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets payment history with filters and pagination
   *
   * @param filter - Filter criteria
   * @param pagination - Pagination parameters
   * @returns Paginated filtered payment history
   * @throws DatabaseError if database operation fails
   */
  async getFilteredPaymentHistory(
    filter: PaymentHistoryFilter,
    pagination: PaginationDTO
  ): Promise<PaginatedResult<Payment>> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;

      // Build where conditions
      const conditions = [];

      if (filter.userId) {
        conditions.push(eq(payments.userId, filter.userId));
      }

      if (filter.courseId) {
        conditions.push(eq(payments.courseId, filter.courseId));
      }

      if (filter.status) {
        conditions.push(eq(payments.status, filter.status));
      }

      if (filter.startDate) {
        conditions.push(gte(payments.createdAt, filter.startDate));
      }

      if (filter.endDate) {
        conditions.push(lte(payments.createdAt, filter.endDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count
      const [totalResult] = await this.readDb
        .select({ count: count() })
        .from(payments)
        .where(whereClause);

      const total = totalResult?.count || 0;

      // Get paginated data
      const paymentsData = await this.readDb
        .select()
        .from(payments)
        .where(whereClause)
        .orderBy(desc(payments.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      return {
        data: paymentsData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };
    } catch (error) {
      throw new DatabaseError(
        'Failed to get filtered payment history',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets payments by status
   *
   * @param status - Payment status
   * @param pagination - Pagination parameters
   * @returns Paginated payments with specified status
   * @throws DatabaseError if database operation fails
   */
  async findByStatus(
    status: 'pending' | 'succeeded' | 'failed' | 'refunded',
    pagination: PaginationDTO
  ): Promise<PaginatedResult<Payment>> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;

      // Get total count
      const [totalResult] = await this.readDb
        .select({ count: count() })
        .from(payments)
        .where(eq(payments.status, status));

      const total = totalResult?.count || 0;

      // Get paginated data
      const paymentsData = await this.readDb
        .select()
        .from(payments)
        .where(eq(payments.status, status))
        .orderBy(desc(payments.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      return {
        data: paymentsData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };
    } catch (error) {
      throw new DatabaseError(
        'Failed to find payments by status',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets total revenue for a course
   *
   * @param courseId - Course ID
   * @returns Total revenue amount
   * @throws DatabaseError if database operation fails
   */
  async getTotalRevenueByCourse(courseId: string): Promise<string> {
    try {
      const [result] = await this.readDb
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(and(eq(payments.courseId, courseId), eq(payments.status, 'succeeded')));

      return result?.total || '0';
    } catch (error) {
      throw new DatabaseError(
        'Failed to get total revenue by course',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets total revenue for a user (instructor)
   *
   * @param userId - User ID
   * @returns Total revenue amount
   * @throws DatabaseError if database operation fails
   */
  async getTotalRevenueByUser(userId: string): Promise<string> {
    try {
      const [result] = await this.readDb
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(and(eq(payments.userId, userId), eq(payments.status, 'succeeded')));

      return result?.total || '0';
    } catch (error) {
      throw new DatabaseError(
        'Failed to get total revenue by user',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific payment
   * Should be called after any update operation
   *
   * @param id - Payment ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getPaymentCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for payment ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for a payment by Stripe intent ID
   *
   * @param stripePaymentIntentId - Stripe payment intent ID
   * @returns void
   */
  private async invalidateCacheByStripeIntentId(stripePaymentIntentId: string): Promise<void> {
    try {
      const cacheKey = this.getPaymentStripeIntentCacheKey(stripePaymentIntentId);
      await cache.delete(cacheKey);
    } catch (error) {
      console.error(
        `Failed to invalidate cache for payment Stripe intent ${stripePaymentIntentId}:`,
        error
      );
    }
  }

  /**
   * Invalidates cache for a payment by Stripe session ID
   *
   * @param stripeCheckoutSessionId - Stripe checkout session ID
   * @returns void
   */
  private async invalidateCacheByStripeSessionId(stripeCheckoutSessionId: string): Promise<void> {
    try {
      const cacheKey = this.getPaymentStripeSessionCacheKey(stripeCheckoutSessionId);
      await cache.delete(cacheKey);
    } catch (error) {
      console.error(
        `Failed to invalidate cache for payment Stripe session ${stripeCheckoutSessionId}:`,
        error
      );
    }
  }
}
