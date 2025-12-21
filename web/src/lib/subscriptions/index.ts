/**
 * Subscription System Exports
 *
 * Main entry point for the real-time subscription system.
 * Exports all subscription providers, hooks, and utilities.
 */

// Provider and context
export {
  SubscriptionProvider,
  useSubscriptionContext,
  useConnectionStatus,
  useIsConnected,
} from './SubscriptionProvider';

// Core subscription hooks
export {
  useSubscription,
  useSubscriptionState,
  useMessageSubscription,
  useProgressSubscription,
  useNotificationSubscription,
  usePresenceSubscription,
  useMultipleSubscriptions,
} from './subscriptionHooks';

// Cache integration utilities
export {
  SubscriptionCacheManager,
  createSubscriptionCacheManager,
  createCacheUpdateHandler,
  createCacheInvalidationHandler,
  SUBSCRIPTION_CACHE_CONFIGS,
  CACHE_INVALIDATION_CONFIGS,
} from './cacheIntegration';

// Types
export type {
  ConnectionStatus,
  SubscriptionManager,
  SubscriptionContextValue,
  SubscriptionHookResult,
  SubscriptionOptions,
  ReconnectionConfig,
} from './types';

export type {
  CacheUpdateStrategy,
  SubscriptionCacheConfig,
  CacheInvalidationConfig,
} from './cacheIntegration';

// Constants
export { DEFAULT_RECONNECTION_CONFIG } from './types';
