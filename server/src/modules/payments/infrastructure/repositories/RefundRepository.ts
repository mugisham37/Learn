/**
 * Refund Repository Implementation
 *
 * Implements refund data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 11.1, 11.5
 */

import { eq, desc, count, sum } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  refunds,
  Refund,
  NewRefund,
} from '../../../../infrastructure/database/schema/payments.schema.js';
import { DatabaseError, NotFoundError } from '../../../../shared/errors/index.js';

import {
  IRefundRepository,
  CreateRefundDTO,
  UpdateRefundDTO,
  PaginationDTO,
  PaginatedResult,
} from './IPaymentRepository.js';

/**
 * Refund Repository Implementation
 *
 * Provides data access methods for refund entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Refund tracking and aggregation
 */
export class RefundRepository implements IRefundRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for refund by ID
   */
  private getRefundCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.USER, 'refund', 'id', id);
  }

  /**
   * Builds cache key for refund by Stripe refund ID
   */
  private getRefundStripeIdCacheKey(stripeRefundId: string): string {
    return buildCacheKey(CachePrefix.USER, 'refund', 'stripe_id', stripeRefundId);
  }

  /**
   * Builds cache key for payment refunds
   */
  private getPaymentRefundsCacheKey(paymentId: string): string {
    return buildCacheKey(CachePrefix.USER, 'refund', 'payment', paymentId);
  }

  /**
   * Builds cache key for enrollment refunds
   */
  private getEnrollmentRefundsCacheKey(enrollmentId: string): string {
    return buildCacheKey(CachePrefix.USER, 'refund', 'enrollment', enrollmentId);
  }

  /**
   * Creates a new refund in the database
   *
   * @param data - Refund creation data
   * @returns The created refund
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateRefundDTO): Promise<Refund> {
    try {
      // Prepare refund data for insertion
      const newRefund: NewRefund = {
        paymentId: data.paymentId,
        enrollmentId: data.enrollmentId ?? null,
        stripeRefundId: data.stripeRefundId ?? null,
        amount: data.amount,
        reason: data.reason ?? null,
        status: data.status ?? 'pending',
      };

      // Insert refund into database
      const [createdRefund] = await this.writeDb.insert(refunds).values(newRefund).returning();

      if (!createdRefund) {
        throw new DatabaseError('Failed to create refund', 'insert');
      }

      // Invalidate related caches
      await this.invalidatePaymentRefundsCache(data.paymentId);
      if (data.enrollmentId) {
        await this.invalidateEnrollmentRefundsCache(data.enrollmentId);
      }

      return createdRefund;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new DatabaseError(
            'A refund with this Stripe refund ID already exists',
            'insert',
            error
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create refund',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a refund by its unique ID
   *
   * Implements caching with 5-minute TTL.
   * Uses read database for query optimization.
   *
   * @param id - Refund ID
   * @returns The refund if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Refund | null> {
    try {
      // Check cache first
      const cacheKey = this.getRefundCacheKey(id);
      const cachedRefund = await cache.get<Refund>(cacheKey);

      if (cachedRefund) {
        return cachedRefund;
      }

      // Query database if not in cache
      const [refund] = await this.readDb.select().from(refunds).where(eq(refunds.id, id)).limit(1);

      if (!refund) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, refund, CacheTTL.MEDIUM);

      return refund;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find refund by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a refund by Stripe refund ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param stripeRefundId - Stripe refund ID
   * @returns The refund if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByStripeRefundId(stripeRefundId: string): Promise<Refund | null> {
    try {
      // Check cache first
      const cacheKey = this.getRefundStripeIdCacheKey(stripeRefundId);
      const cachedRefund = await cache.get<Refund>(cacheKey);

      if (cachedRefund) {
        return cachedRefund;
      }

      // Query database if not in cache
      const [refund] = await this.readDb
        .select()
        .from(refunds)
        .where(eq(refunds.stripeRefundId, stripeRefundId))
        .limit(1);

      if (!refund) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both Stripe refund ID and refund ID for consistency
      await Promise.all([
        cache.set(cacheKey, refund, CacheTTL.MEDIUM),
        cache.set(this.getRefundCacheKey(refund.id), refund, CacheTTL.MEDIUM),
      ]);

      return refund;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find refund by Stripe refund ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds refunds by payment ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param paymentId - Payment ID
   * @returns Array of refunds for the payment
   * @throws DatabaseError if database operation fails
   */
  async findByPaymentId(paymentId: string): Promise<Refund[]> {
    try {
      // Check cache first
      const cacheKey = this.getPaymentRefundsCacheKey(paymentId);
      const cachedRefunds = await cache.get<Refund[]>(cacheKey);

      if (cachedRefunds) {
        return cachedRefunds;
      }

      // Query database if not in cache
      const paymentRefunds = await this.readDb
        .select()
        .from(refunds)
        .where(eq(refunds.paymentId, paymentId))
        .orderBy(desc(refunds.createdAt));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, paymentRefunds, CacheTTL.MEDIUM);

      return paymentRefunds;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find refunds by payment ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds refunds by enrollment ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param enrollmentId - Enrollment ID
   * @returns Array of refunds for the enrollment
   * @throws DatabaseError if database operation fails
   */
  async findByEnrollmentId(enrollmentId: string): Promise<Refund[]> {
    try {
      // Check cache first
      const cacheKey = this.getEnrollmentRefundsCacheKey(enrollmentId);
      const cachedRefunds = await cache.get<Refund[]>(cacheKey);

      if (cachedRefunds) {
        return cachedRefunds;
      }

      // Query database if not in cache
      const enrollmentRefunds = await this.readDb
        .select()
        .from(refunds)
        .where(eq(refunds.enrollmentId, enrollmentId))
        .orderBy(desc(refunds.createdAt));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, enrollmentRefunds, CacheTTL.MEDIUM);

      return enrollmentRefunds;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find refunds by enrollment ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a refund's data
   *
   * Invalidates all related cache entries after successful update.
   *
   * @param id - Refund ID
   * @param data - Update data
   * @returns The updated refund
   * @throws NotFoundError if refund doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateRefundDTO): Promise<Refund> {
    try {
      // First, verify refund exists
      const existingRefund = await this.findById(id);
      if (!existingRefund) {
        throw new NotFoundError('Refund', id);
      }

      // Prepare update data
      const updateData: Partial<NewRefund> = {
        stripeRefundId: data.stripeRefundId ?? undefined,
        amount: data.amount,
        reason: data.reason ?? undefined,
        status: data.status,
        updatedAt: new Date(),
      };

      // Update refund in database
      const [updatedRefund] = await this.writeDb
        .update(refunds)
        .set(updateData)
        .where(eq(refunds.id, id))
        .returning();

      if (!updatedRefund) {
        throw new DatabaseError('Failed to update refund', 'update');
      }

      // Invalidate all cache entries for this refund
      await this.invalidateCache(id);
      if (existingRefund.stripeRefundId) {
        await this.invalidateCacheByStripeId(existingRefund.stripeRefundId);
      }
      await this.invalidatePaymentRefundsCache(existingRefund.paymentId);
      if (existingRefund.enrollmentId) {
        await this.invalidateEnrollmentRefundsCache(existingRefund.enrollmentId);
      }

      return updatedRefund;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update refund',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets refunds by status
   *
   * @param status - Refund status
   * @param pagination - Pagination parameters
   * @returns Paginated refunds with specified status
   * @throws DatabaseError if database operation fails
   */
  async findByStatus(
    status: 'pending' | 'succeeded' | 'failed',
    pagination: PaginationDTO
  ): Promise<PaginatedResult<Refund>> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;

      // Get total count
      const [totalResult] = await this.readDb
        .select({ count: count() })
        .from(refunds)
        .where(eq(refunds.status, status));

      const total = Number(totalResult?.count) || 0;

      // Get paginated data
      const refundsData = await this.readDb
        .select()
        .from(refunds)
        .where(eq(refunds.status, status))
        .orderBy(desc(refunds.createdAt))
        .limit(pagination.limit)
        .offset(offset);

      return {
        data: refundsData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      };
    } catch (error) {
      throw new DatabaseError(
        'Failed to find refunds by status',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets total refunded amount for a payment
   *
   * @param paymentId - Payment ID
   * @returns Total refunded amount
   * @throws DatabaseError if database operation fails
   */
  async getTotalRefundedByPayment(paymentId: string): Promise<string> {
    try {
      const [result] = await this.readDb
        .select({ total: sum(refunds.amount) })
        .from(refunds)
        .where(eq(refunds.paymentId, paymentId));

      return result?.total || '0';
    } catch (error) {
      throw new DatabaseError(
        'Failed to get total refunded amount by payment',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific refund
   * Should be called after any update operation
   *
   * @param id - Refund ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getRefundCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for refund ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for a refund by Stripe ID
   *
   * @param stripeRefundId - Stripe refund ID
   * @returns void
   */
  private async invalidateCacheByStripeId(stripeRefundId: string): Promise<void> {
    try {
      const cacheKey = this.getRefundStripeIdCacheKey(stripeRefundId);
      await cache.delete(cacheKey);
    } catch (error) {
      console.error(`Failed to invalidate cache for refund Stripe ID ${stripeRefundId}:`, error);
    }
  }

  /**
   * Invalidates cache for payment refunds
   *
   * @param paymentId - Payment ID
   * @returns void
   */
  private async invalidatePaymentRefundsCache(paymentId: string): Promise<void> {
    try {
      const cacheKey = this.getPaymentRefundsCacheKey(paymentId);
      await cache.delete(cacheKey);
    } catch (error) {
      console.error(`Failed to invalidate payment refunds cache for payment ${paymentId}:`, error);
    }
  }

  /**
   * Invalidates cache for enrollment refunds
   *
   * @param enrollmentId - Enrollment ID
   * @returns void
   */
  private async invalidateEnrollmentRefundsCache(enrollmentId: string): Promise<void> {
    try {
      const cacheKey = this.getEnrollmentRefundsCacheKey(enrollmentId);
      await cache.delete(cacheKey);
    } catch (error) {
      console.error(
        `Failed to invalidate enrollment refunds cache for enrollment ${enrollmentId}:`,
        error
      );
    }
  }
}
