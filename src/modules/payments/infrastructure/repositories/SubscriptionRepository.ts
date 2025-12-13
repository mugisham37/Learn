/**
 * Subscription Repository Implementation
 *
 * Implements subscription data access operations with Drizzle ORM queries,
 * Redis caching with 5-minute TTL, and cache invalidation on updates.
 * Handles database errors and maps them to domain errors.
 *
 * Requirements: 11.1, 11.5
 */

import { eq, and, desc, lte, gte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { getWriteDb, getReadDb } from '../../../../infrastructure/database/index.js';
import {
  subscriptions,
  Subscription,
  NewSubscription,
} from '../../../../infrastructure/database/schema/payments.schema.js';
import {
  cache,
  buildCacheKey,
  CachePrefix,
  CacheTTL,
} from '../../../../infrastructure/cache/index.js';
import { DatabaseError, NotFoundError } from '../../../../shared/errors/index.js';
import {
  ISubscriptionRepository,
  CreateSubscriptionDTO,
  UpdateSubscriptionDTO,
} from './IPaymentRepository.js';

/**
 * Subscription Repository Implementation
 *
 * Provides data access methods for subscription entities with:
 * - Drizzle ORM for type-safe queries
 * - Redis caching with 5-minute TTL
 * - Automatic cache invalidation on updates
 * - Comprehensive error handling
 * - Subscription lifecycle management
 */
export class SubscriptionRepository implements ISubscriptionRepository {
  private writeDb: NodePgDatabase;
  private readDb: NodePgDatabase;

  constructor() {
    this.writeDb = getWriteDb();
    this.readDb = getReadDb();
  }

  /**
   * Builds cache key for subscription by ID
   */
  private getSubscriptionCacheKey(id: string): string {
    return buildCacheKey(CachePrefix.USER, 'subscription', 'id', id);
  }

  /**
   * Builds cache key for subscription by Stripe subscription ID
   */
  private getSubscriptionStripeIdCacheKey(stripeSubscriptionId: string): string {
    return buildCacheKey(CachePrefix.USER, 'subscription', 'stripe_id', stripeSubscriptionId);
  }

  /**
   * Builds cache key for user subscriptions
   */
  private getUserSubscriptionsCacheKey(userId: string): string {
    return buildCacheKey(CachePrefix.USER, 'subscription', 'user', userId);
  }

  /**
   * Builds cache key for active user subscriptions
   */
  private getUserActiveSubscriptionsCacheKey(userId: string): string {
    return buildCacheKey(CachePrefix.USER, 'subscription', 'user_active', userId);
  }

  /**
   * Creates a new subscription in the database
   *
   * @param data - Subscription creation data
   * @returns The created subscription
   * @throws DatabaseError if database operation fails
   */
  async create(data: CreateSubscriptionDTO): Promise<Subscription> {
    try {
      // Prepare subscription data for insertion
      const newSubscription: NewSubscription = {
        userId: data.userId,
        stripeSubscriptionId: data.stripeSubscriptionId,
        stripeCustomerId: data.stripeCustomerId,
        planId: data.planId,
        status: data.status || 'active',
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
      };

      // Insert subscription into database
      const [createdSubscription] = await this.writeDb
        .insert(subscriptions)
        .values(newSubscription)
        .returning();

      if (!createdSubscription) {
        throw new DatabaseError('Failed to create subscription', 'insert');
      }

      // Invalidate user subscriptions cache
      await this.invalidateUserSubscriptionsCache(data.userId);

      return createdSubscription;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Handle database constraint violations
      if (error instanceof Error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
          throw new DatabaseError(
            'A subscription with this Stripe subscription ID already exists',
            'insert',
            error
          );
        }
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to create subscription',
        'insert',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a subscription by its unique ID
   *
   * Implements caching with 5-minute TTL.
   * Uses read database for query optimization.
   *
   * @param id - Subscription ID
   * @returns The subscription if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findById(id: string): Promise<Subscription | null> {
    try {
      // Check cache first
      const cacheKey = this.getSubscriptionCacheKey(id);
      const cachedSubscription = await cache.get<Subscription>(cacheKey);

      if (cachedSubscription) {
        return cachedSubscription;
      }

      // Query database if not in cache
      const [subscription] = await this.readDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, id))
        .limit(1);

      if (!subscription) {
        return null;
      }

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, subscription, CacheTTL.MEDIUM);

      return subscription;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find subscription by ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds a subscription by Stripe subscription ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param stripeSubscriptionId - Stripe subscription ID
   * @returns The subscription if found, null otherwise
   * @throws DatabaseError if database operation fails
   */
  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    try {
      // Check cache first
      const cacheKey = this.getSubscriptionStripeIdCacheKey(stripeSubscriptionId);
      const cachedSubscription = await cache.get<Subscription>(cacheKey);

      if (cachedSubscription) {
        return cachedSubscription;
      }

      // Query database if not in cache
      const [subscription] = await this.readDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .limit(1);

      if (!subscription) {
        return null;
      }

      // Cache the result with 5-minute TTL
      // Cache by both Stripe subscription ID and subscription ID for consistency
      await Promise.all([
        cache.set(cacheKey, subscription, CacheTTL.MEDIUM),
        cache.set(this.getSubscriptionCacheKey(subscription.id), subscription, CacheTTL.MEDIUM),
      ]);

      return subscription;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find subscription by Stripe subscription ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Finds subscriptions by user ID
   *
   * Implements caching with 5-minute TTL.
   *
   * @param userId - User ID
   * @returns Array of user's subscriptions
   * @throws DatabaseError if database operation fails
   */
  async findByUserId(userId: string): Promise<Subscription[]> {
    try {
      // Check cache first
      const cacheKey = this.getUserSubscriptionsCacheKey(userId);
      const cachedSubscriptions = await cache.get<Subscription[]>(cacheKey);

      if (cachedSubscriptions) {
        return cachedSubscriptions;
      }

      // Query database if not in cache
      const userSubscriptions = await this.readDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, userSubscriptions, CacheTTL.MEDIUM);

      return userSubscriptions;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find subscriptions by user ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Updates a subscription's data
   *
   * Invalidates all related cache entries after successful update.
   *
   * @param id - Subscription ID
   * @param data - Update data
   * @returns The updated subscription
   * @throws NotFoundError if subscription doesn't exist
   * @throws DatabaseError if database operation fails
   */
  async update(id: string, data: UpdateSubscriptionDTO): Promise<Subscription> {
    try {
      // First, verify subscription exists
      const existingSubscription = await this.findById(id);
      if (!existingSubscription) {
        throw new NotFoundError('Subscription', id);
      }

      // Prepare update data
      const updateData: Partial<NewSubscription> = {
        ...data,
        updatedAt: new Date(),
      };

      // Update subscription in database
      const [updatedSubscription] = await this.writeDb
        .update(subscriptions)
        .set(updateData)
        .where(eq(subscriptions.id, id))
        .returning();

      if (!updatedSubscription) {
        throw new DatabaseError('Failed to update subscription', 'update');
      }

      // Invalidate all cache entries for this subscription
      await this.invalidateCache(id);
      await this.invalidateCacheByStripeId(existingSubscription.stripeSubscriptionId);
      await this.invalidateUserSubscriptionsCache(existingSubscription.userId);

      return updatedSubscription;
    } catch (error) {
      // Re-throw known errors
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new DatabaseError(
        'Failed to update subscription',
        'update',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets subscriptions expiring soon (within specified days)
   *
   * @param days - Number of days to look ahead
   * @returns Array of expiring subscriptions
   * @throws DatabaseError if database operation fails
   */
  async findExpiringSoon(days: number): Promise<Subscription[]> {
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + days);

      const expiringSubscriptions = await this.readDb
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, 'active'),
            lte(subscriptions.currentPeriodEnd, expirationDate),
            gte(subscriptions.currentPeriodEnd, new Date())
          )
        )
        .orderBy(subscriptions.currentPeriodEnd);

      return expiringSubscriptions;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find expiring subscriptions',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets active subscriptions for a user
   *
   * Implements caching with 5-minute TTL.
   *
   * @param userId - User ID
   * @returns Array of active subscriptions
   * @throws DatabaseError if database operation fails
   */
  async findActiveByUserId(userId: string): Promise<Subscription[]> {
    try {
      // Check cache first
      const cacheKey = this.getUserActiveSubscriptionsCacheKey(userId);
      const cachedSubscriptions = await cache.get<Subscription[]>(cacheKey);

      if (cachedSubscriptions) {
        return cachedSubscriptions;
      }

      // Query database if not in cache
      const activeSubscriptions = await this.readDb
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, 'active'),
            gte(subscriptions.currentPeriodEnd, new Date())
          )
        )
        .orderBy(desc(subscriptions.createdAt));

      // Cache the result with 5-minute TTL
      await cache.set(cacheKey, activeSubscriptions, CacheTTL.MEDIUM);

      return activeSubscriptions;
    } catch (error) {
      throw new DatabaseError(
        'Failed to find active subscriptions by user ID',
        'select',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Invalidates cache for a specific subscription
   * Should be called after any update operation
   *
   * @param id - Subscription ID
   * @returns void
   */
  async invalidateCache(id: string): Promise<void> {
    try {
      const cacheKey = this.getSubscriptionCacheKey(id);
      await cache.delete(cacheKey);
    } catch (error) {
      // Log error but don't throw - cache invalidation failure shouldn't break the operation
      console.error(`Failed to invalidate cache for subscription ${id}:`, error);
    }
  }

  /**
   * Invalidates cache for a subscription by Stripe ID
   *
   * @param stripeSubscriptionId - Stripe subscription ID
   * @returns void
   */
  private async invalidateCacheByStripeId(stripeSubscriptionId: string): Promise<void> {
    try {
      const cacheKey = this.getSubscriptionStripeIdCacheKey(stripeSubscriptionId);
      await cache.delete(cacheKey);
    } catch (error) {
      console.error(
        `Failed to invalidate cache for subscription Stripe ID ${stripeSubscriptionId}:`,
        error
      );
    }
  }

  /**
   * Invalidates cache for user subscriptions
   *
   * @param userId - User ID
   * @returns void
   */
  private async invalidateUserSubscriptionsCache(userId: string): Promise<void> {
    try {
      await Promise.all([
        cache.delete(this.getUserSubscriptionsCacheKey(userId)),
        cache.delete(this.getUserActiveSubscriptionsCacheKey(userId)),
      ]);
    } catch (error) {
      console.error(`Failed to invalidate user subscriptions cache for user ${userId}:`, error);
    }
  }
}
