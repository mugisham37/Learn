/**
 * GraphQL PubSub Infrastructure
 *
 * Provides Redis-backed publish/subscribe functionality for GraphQL subscriptions
 * with horizontal scaling support and proper error handling.
 *
 * Requirements: 21.4
 */

import { RedisPubSub } from 'graphql-redis-subscriptions';
import { PubSub, withFilter } from 'graphql-subscriptions';
import Redis from 'ioredis';

import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Subscription event names
 */
export const SUBSCRIPTION_EVENTS = {
  // Notification events
  NOTIFICATION_RECEIVED: 'NOTIFICATION_RECEIVED',
  NOTIFICATION_READ: 'NOTIFICATION_READ',
  UNREAD_COUNT_CHANGED: 'UNREAD_COUNT_CHANGED',

  // Message events
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  CONVERSATION_UPDATED: 'CONVERSATION_UPDATED',

  // Discussion events
  NEW_DISCUSSION_POST: 'NEW_DISCUSSION_POST',
  THREAD_UPDATED: 'THREAD_UPDATED',
  POST_VOTED: 'POST_VOTED',

  // Announcement events
  ANNOUNCEMENT_PUBLISHED: 'ANNOUNCEMENT_PUBLISHED',

  // Real-time presence events
  USER_PRESENCE: 'USER_PRESENCE',
  TYPING_INDICATOR: 'TYPING_INDICATOR',

  // Progress events
  ENROLLMENT_PROGRESS_UPDATED: 'ENROLLMENT_PROGRESS_UPDATED',
  LESSON_PROGRESS_UPDATED: 'LESSON_PROGRESS_UPDATED',
  CERTIFICATE_GENERATED: 'CERTIFICATE_GENERATED',
  COURSE_COMPLETED: 'COURSE_COMPLETED',
} as const;

export type SubscriptionEvent = (typeof SUBSCRIPTION_EVENTS)[keyof typeof SUBSCRIPTION_EVENTS];

/**
 * PubSub instance for GraphQL subscriptions
 */
let pubsub: PubSub | RedisPubSub | null = null;

/**
 * Creates and configures PubSub instance
 */
export function createPubSub(): PubSub | RedisPubSub {
  if (pubsub) {
    return pubsub;
  }

  try {
    // Use Redis PubSub for production/distributed environments
    if (config.nodeEnv === 'production' || (config.redis as Record<string, unknown>)['cluster']) {
      logger.info('Initializing Redis PubSub for GraphQL subscriptions');

      // Create Redis clients for pub/sub
      const publisher = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      const subscriber = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      // Create Redis PubSub instance
      pubsub = new RedisPubSub({
        publisher,
        subscriber,
        messageEventName: 'message',
        pmessageEventName: 'pmessage',
      });

      // Handle Redis connection events
      publisher.on('connect', () => {
        logger.info('Redis publisher connected for GraphQL subscriptions');
      });

      subscriber.on('connect', () => {
        logger.info('Redis subscriber connected for GraphQL subscriptions');
      });

      publisher.on('error', (error) => {
        logger.error('Redis publisher error for GraphQL subscriptions', {
          error: error.message,
        });
      });

      subscriber.on('error', (error) => {
        logger.error('Redis subscriber error for GraphQL subscriptions', {
          error: error.message,
        });
      });
    } else {
      // Use in-memory PubSub for development
      logger.info('Initializing in-memory PubSub for GraphQL subscriptions');
      pubsub = new PubSub();
    }

    logger.info('PubSub initialized successfully for GraphQL subscriptions');
    return pubsub;
  } catch (error) {
    logger.error('Failed to initialize PubSub for GraphQL subscriptions', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to in-memory PubSub
    logger.warn('Falling back to in-memory PubSub');
    pubsub = new PubSub();
    return pubsub;
  }
}

/**
 * Gets the PubSub instance
 */
export function getPubSub(): PubSub | RedisPubSub {
  if (!pubsub) {
    return createPubSub();
  }
  return pubsub;
}

/**
 * Publishes an event to subscribers
 */
export async function publishEvent(event: SubscriptionEvent, payload: unknown): Promise<void> {
  try {
    const pubsubInstance = getPubSub();
    // Type assertion to handle union type publish methods
    await (pubsubInstance.publish as (event: string, payload: unknown) => Promise<void>)(event, payload);

    logger.debug('Event published successfully', {
      event,
      payloadKeys: Object.keys(payload || {}),
    });
  } catch (error) {
    logger.error('Failed to publish event', {
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Creates an async iterator for subscription events
 */
export function createAsyncIterator(events: SubscriptionEvent | SubscriptionEvent[]): AsyncIterator<unknown> {
  const pubsubInstance = getPubSub();
  const eventArray = Array.isArray(events) ? events : [events];
  
  // Handle different PubSub implementations
  if ('asyncIterator' in pubsubInstance && typeof pubsubInstance.asyncIterator === 'function') {
    return pubsubInstance.asyncIterator(eventArray);
  }
  
  // Fallback for implementations without asyncIterator
  throw new Error('PubSub implementation does not support asyncIterator');
}

/**
 * Gracefully closes PubSub connections
 */
export async function closePubSub(): Promise<void> {
  try {
    if (pubsub && 'close' in pubsub && typeof pubsub.close === 'function') {
      await pubsub.close();
      logger.info('PubSub connections closed successfully');
    }
    pubsub = null;
  } catch (error) {
    logger.error('Error closing PubSub connections', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Export withFilter from graphql-subscriptions
export { withFilter };
