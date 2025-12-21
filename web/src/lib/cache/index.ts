/**
 * Cache Management Module
 *
 * Comprehensive cache management system for Apollo Client with backend integration.
 * Provides cache update functions, invalidation strategies, optimistic response generators,
 * subscription integration, persistence, optimization, and backend-specific operations.
 *
 * Features:
 * - Complete backend module integration (Users, Courses, Enrollments, etc.)
 * - Cache persistence and restoration
 * - Real-time subscription cache updates
 * - Optimistic response generation
 * - Cache optimization and monitoring
 * - Module-specific cache operations
 * - Health monitoring and reporting
 */

// Provider and hooks
export {
  CacheProvider,
  useCacheManager,
  useBackendCacheManager,
  useModuleCache,
  useCacheHealth,
} from './provider';

// Backend integration
export {
  BackendCacheManager,
  createBackendCacheManager,
  BackendModule,
  moduleOperations,
} from './backendIntegration';
export type { BackendCacheOperation } from './backendIntegration';

// Core cache utilities
export * from './cacheHelpers';
export * from './cacheUpdaters';
export * from './cacheInvalidation';
export * from './optimisticResponses';
export * from './subscriptionIntegration';
export * from './optimization';
export * from './types';

// GraphQL cache configuration
export {
  createCacheConfig,
  cacheHelpers as graphqlCacheHelpers,
  cachePersistence,
  backendCacheInvalidation,
} from '../graphql/cache';
