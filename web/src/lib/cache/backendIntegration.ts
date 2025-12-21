/**
 * Backend Cache Integration Service
 *
 * Comprehensive cache management system that integrates with all backend modules.
 * Provides unified cache operations, subscription handling, and persistence management.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { InMemoryCache, ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { cacheHelpers, cachePersistence, backendCacheInvalidation } from '../graphql/cache';
import { updateCacheAfterMutation } from './cacheUpdaters';
import { invalidateCache } from './cacheInvalidation';
import { generateOptimisticResponse, commonOptimisticResponses } from './optimisticResponses';
import {
  subscriptionCachePatterns,
} from './subscriptionIntegration';
import { CacheOptimizer, createCacheWarmingConfig } from './optimization';
import {
  CacheEntity,
  CacheInvalidationConfig,
  OptimisticResponseConfig,
} from './types';
import { cacheConfig } from '../config';

/**
 * Backend module identifiers
 */
export enum BackendModule {
  USERS = 'users',
  COURSES = 'courses',
  ENROLLMENTS = 'enrollments',
  ASSESSMENTS = 'assessments',
  CONTENT = 'content',
  PAYMENTS = 'payments',
  NOTIFICATIONS = 'notifications',
  COMMUNICATION = 'communication',
  ANALYTICS = 'analytics',
  SEARCH = 'search',
}

/**
 * Cache operation types for backend integration
 */
export interface BackendCacheOperation<T extends CacheEntity = CacheEntity> {
  module: BackendModule;
  operation: 'create' | 'update' | 'delete' | 'invalidate' | 'subscribe';
  typename: string;
  data?: T;
  id?: string;
  subscriptionData?: unknown;
  invalidationRules?: string[];
}

/**
 * Backend Cache Integration Manager
 *
 * Central service for managing cache operations across all backend modules
 */
export class BackendCacheManager {
  private cache: InMemoryCache;
  private client: ApolloClient<NormalizedCacheObject>;
  private optimizer: CacheOptimizer;
  private subscriptionHandlers = new Map<string, (data: unknown) => void>();
  private persistenceEnabled: boolean;
  private persistenceKey: string;

  constructor(
    cache: InMemoryCache,
    client: ApolloClient<NormalizedCacheObject>,
    options: {
      enablePersistence?: boolean;
      persistenceKey?: string;
      enableOptimization?: boolean;
    } = {}
  ) {
    this.cache = cache;
    this.client = client;
    this.persistenceEnabled = options.enablePersistence ?? cacheConfig.enablePersistence;
    this.persistenceKey = options.persistenceKey ?? 'lms-apollo-cache';

    // Initialize cache optimizer
    if (options.enableOptimization !== false) {
      this.optimizer = new CacheOptimizer(cache, {
        maxSize: cacheConfig.maxCacheSize,
        targetSize: Math.floor(cacheConfig.maxCacheSize * 0.8),
        enableMonitoring: true,
      });
    }

    // Load persisted cache on initialization
    if (this.persistenceEnabled) {
      this.loadPersistedCache();
    }

    // Set up periodic cache persistence
    if (this.persistenceEnabled) {
      setInterval(
        () => {
          this.persistCache();
        },
        5 * 60 * 1000
      ); // Every 5 minutes
    }
  }

  /**
   * Execute a backend cache operation
   */
  async executeOperation<T extends CacheEntity>(
    operation: BackendCacheOperation<T>
  ): Promise<{ success: boolean; error?: Error }> {
    try {
      switch (operation.operation) {
        case 'create':
          return this.handleCreate(operation);

        case 'update':
          return this.handleUpdate(operation);

        case 'delete':
          return this.handleDelete(operation);

        case 'invalidate':
          return this.handleInvalidate(operation);

        case 'subscribe':
          return this.handleSubscription(operation);

        default:
          throw new Error(`Unknown operation: ${operation.operation}`);
      }
    } catch (error) {
      console.error(`Cache operation failed for ${operation.module}:`, error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Handle create operations with optimistic updates
   */
  private handleCreate<T extends CacheEntity>(
    operation: BackendCacheOperation<T>
  ): { success: boolean; error?: Error } {
    if (!operation.data) {
      return { success: false, error: new Error('Create operation requires data') };
    }

    // Generate optimistic response
    const optimisticResponse = this.generateOptimisticResponse(
      operation.module,
      'create',
      operation.typename,
      operation.data
    );

    // Update cache
    const result = updateCacheAfterMutation(this.cache, {
      operation: 'create',
      typename: operation.typename,
      data: optimisticResponse,
    });

    return result;
  }

  /**
   * Handle update operations
   */
  private handleUpdate<T extends CacheEntity>(
    operation: BackendCacheOperation<T>
  ): { success: boolean; error?: Error } {
    if (!operation.data || !operation.id) {
      return { success: false, error: new Error('Update operation requires data and id') };
    }

    const result = updateCacheAfterMutation(this.cache, {
      operation: 'update',
      typename: operation.typename,
      data: operation.data,
      id: operation.id,
    });

    return result;
  }

  /**
   * Handle delete operations
   */
  private handleDelete<T extends CacheEntity>(
    operation: BackendCacheOperation<T>
  ): { success: boolean; error?: Error } {
    if (!operation.id) {
      return { success: false, error: new Error('Delete operation requires id') };
    }

    const result = updateCacheAfterMutation(this.cache, {
      operation: 'delete',
      typename: operation.typename,
      data: { id: operation.id, __typename: operation.typename } as T,
      id: operation.id,
    });

    // Apply module-specific invalidation rules
    this.applyInvalidationRules(operation.module, operation.typename, operation.id);

    return result;
  }

  /**
   * Handle cache invalidation
   */
  private handleInvalidate<T extends CacheEntity>(
    operation: BackendCacheOperation<T>
  ): { success: boolean; error?: Error } {
    const config: CacheInvalidationConfig = {
      typename: operation.typename,
      ...(operation.id && { id: operation.id }),
      ...(operation.invalidationRules && { fieldNames: operation.invalidationRules }),
    };

    invalidateCache(this.cache, config);
    return { success: true };
  }

  /**
   * Handle subscription updates
   */
  private handleSubscription<T extends CacheEntity>(
    operation: BackendCacheOperation<T>
  ): { success: boolean; error?: Error } {
    if (!operation.subscriptionData) {
      return {
        success: false,
        error: new Error('Subscription operation requires subscription data'),
      };
    }

    // Apply module-specific subscription handling
    this.applySubscriptionHandling(operation.module, operation.subscriptionData);

    return { success: true };
  }

  /**
   * Generate optimistic responses based on module and operation
   */
  private generateOptimisticResponse<T extends CacheEntity>(
    module: BackendModule,
    operation: 'create' | 'update' | 'delete',
    typename: string,
    data: Partial<T>
  ): T {
    const config: OptimisticResponseConfig<T> = {
      operation,
      typename,
      data,
    };

    // Use module-specific optimistic response generators
    switch (module) {
      case BackendModule.COURSES:
        if (typename === 'Course') {
          return commonOptimisticResponses.course.create(data as Partial<CacheEntity>) as T;
        }
        break;

      case BackendModule.ENROLLMENTS:
        if (typename === 'Enrollment') {
          return commonOptimisticResponses.enrollment.create(data as Partial<CacheEntity>) as T;
        }
        break;

      case BackendModule.COMMUNICATION:
        if (typename === 'Message') {
          return commonOptimisticResponses.message.send(data as Partial<CacheEntity>) as T;
        }
        break;

      case BackendModule.ASSESSMENTS:
        if (typename === 'AssignmentSubmission') {
          return commonOptimisticResponses.assignment.submit(data as Partial<CacheEntity>) as T;
        }
        break;

      case BackendModule.USERS:
        if (typename === 'User') {
          return commonOptimisticResponses.user.updateProfile(
            data.id!,
            data as unknown as Record<string, unknown>
          ) as T;
        }
        break;

      case BackendModule.NOTIFICATIONS:
        if (typename === 'Notification') {
          return commonOptimisticResponses.notification.markAsRead(data.id!) as T;
        }
        break;
    }

    // Fallback to generic optimistic response
    return generateOptimisticResponse(config);
  }

  /**
   * Apply module-specific invalidation rules
   */
  private applyInvalidationRules(module: BackendModule, typename: string, id: string): void {
    switch (module) {
      case BackendModule.USERS:
        if (typename === 'User') {
          backendCacheInvalidation.userProfileUpdated(this.cache, id);
        }
        break;

      case BackendModule.COURSES:
        if (typename === 'Course') {
          backendCacheInvalidation.coursePublished(this.cache, id);
        }
        break;

      case BackendModule.COMMUNICATION:
        if (typename === 'Message') {
          // Extract conversation ID from message data if available
          const conversationId = id; // This would need to be extracted properly
          backendCacheInvalidation.messageSent(this.cache, conversationId, id);
        }
        break;

      case BackendModule.ASSESSMENTS:
        if (typename === 'AssignmentSubmission') {
          // Extract assignment and student IDs
          const assignmentId = id; // This would need to be extracted properly
          const studentId = id; // This would need to be extracted properly
          backendCacheInvalidation.assignmentSubmitted(this.cache, assignmentId, studentId);
        }
        break;

      case BackendModule.PAYMENTS:
        if (typename === 'Payment') {
          // Extract course and user IDs
          const courseId = id; // This would need to be extracted properly
          const userId = id; // This would need to be extracted properly
          backendCacheInvalidation.paymentCompleted(this.cache, courseId, userId, id);
        }
        break;

      case BackendModule.NOTIFICATIONS:
        if (typename === 'Notification') {
          // Extract user ID
          const userId = id; // This would need to be extracted properly
          backendCacheInvalidation.notificationRead(this.cache, id, userId);
        }
        break;

      case BackendModule.CONTENT:
        if (typename === 'MediaAsset') {
          // Extract job ID
          const jobId = id; // This would need to be extracted properly
          backendCacheInvalidation.contentProcessingCompleted(this.cache, id, jobId);
        }
        break;
    }
  }

  /**
   * Apply module-specific subscription handling
   */
  private applySubscriptionHandling(module: BackendModule, subscriptionData: unknown): void {
    const data = subscriptionData as CacheEntity;

    switch (module) {
      case BackendModule.COMMUNICATION:
        if (data.__typename === 'Message') {
          const conversationId = (data as { conversationId?: string }).conversationId || '';
          subscriptionCachePatterns.messageAdded(this.cache, data, conversationId);
        }
        break;

      case BackendModule.ENROLLMENTS:
        if (data.__typename === 'EnrollmentProgress') {
          const enrollmentId = (data as { enrollmentId?: string }).enrollmentId || '';
          subscriptionCachePatterns.progressUpdated(
            this.cache,
            data as unknown as Record<string, unknown>,
            enrollmentId
          );
        }
        break;

      case BackendModule.COURSES:
        if (data.__typename === 'Course') {
          subscriptionCachePatterns.coursePublished(this.cache, data);
        }
        break;

      case BackendModule.NOTIFICATIONS:
        if (data.__typename === 'Notification') {
          const userId = (data as { userId?: string }).userId || '';
          subscriptionCachePatterns.notificationReceived(this.cache, data, userId);
        }
        break;

      case BackendModule.ASSESSMENTS:
        if (data.__typename === 'AssignmentSubmission') {
          const assignmentId = (data as { assignmentId?: string }).assignmentId || '';
          subscriptionCachePatterns.assignmentSubmitted(this.cache, data, assignmentId);
        }
        break;
    }
  }

  /**
   * Warm cache with critical queries for a specific module
   */
  async warmModuleCache(module: BackendModule, queries: DocumentNode[]): Promise<void> {
    if (!this.optimizer) return;

    // Create warming config for the queries
    createCacheWarmingConfig(queries.map(query => ({ query, priority: 1 })));

    await this.optimizer.warmCache(this.client);
  }

  /**
   * Get cache statistics for a specific module
   */
  getModuleStats(module: BackendModule): {
    entities: number;
    queries: number;
    memoryUsage: string;
  } {
    const stats = cacheHelpers.getCacheStats(this.cache);

    // This is a simplified version - in a real implementation,
    // you'd filter by module-specific entity types
    return {
      entities: Math.floor(stats.entities / Object.keys(BackendModule).length),
      queries: Math.floor(stats.queries / Object.keys(BackendModule).length),
      memoryUsage: stats.memoryUsage,
    };
  }

  /**
   * Persist cache to storage
   */
  persistCache(): boolean {
    if (!this.persistenceEnabled) return false;
    return cachePersistence.saveToStorage(this.cache, this.persistenceKey);
  }

  /**
   * Load persisted cache from storage
   */
  loadPersistedCache(): boolean {
    if (!this.persistenceEnabled) return false;
    return cachePersistence.loadFromStorage(this.cache, this.persistenceKey);
  }

  /**
   * Clear persisted cache
   */
  clearPersistedCache(): boolean {
    if (!this.persistenceEnabled) return false;
    return cachePersistence.clearStorage(this.persistenceKey);
  }

  /**
   * Get cache health report
   */
  getHealthReport(): {
    overall: 'healthy' | 'warning' | 'critical';
    stats: ReturnType<typeof cacheHelpers.getCacheStats>;
    persistence: ReturnType<typeof cachePersistence.getStorageInfo> | null;
    optimization: ReturnType<CacheOptimizer['getOptimizationReport']> | null;
    recommendations: string[];
  } {
    const stats = cacheHelpers.getCacheStats(this.cache);
    const persistence = this.persistenceEnabled
      ? cachePersistence.getStorageInfo(this.persistenceKey)
      : null;
    const optimization = this.optimizer?.getOptimizationReport() || null;

    const recommendations: string[] = [];
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check memory usage
    const memoryUsageMB = parseFloat(stats.memoryUsage.replace(' MB', ''));
    if (memoryUsageMB > 50) {
      overall = 'warning';
      recommendations.push('Cache memory usage is high, consider clearing old data');
    }
    if (memoryUsageMB > 100) {
      overall = 'critical';
      recommendations.push('Cache memory usage is critical, immediate cleanup required');
    }

    // Check entity count
    if (stats.entities > 10000) {
      overall = overall === 'critical' ? 'critical' : 'warning';
      recommendations.push('High entity count detected, consider implementing cache eviction');
    }

    // Check optimization metrics
    if (optimization && optimization.performance.hitRate < 0.7) {
      overall = overall === 'critical' ? 'critical' : 'warning';
      recommendations.push('Cache hit rate is low, consider warming critical queries');
    }

    return {
      overall,
      stats,
      persistence,
      optimization,
      recommendations,
    };
  }

  /**
   * Cleanup and destroy the cache manager
   */
  destroy(): void {
    if (this.optimizer) {
      this.optimizer.stop();
    }

    if (this.persistenceEnabled) {
      this.persistCache();
    }

    this.subscriptionHandlers.clear();
  }
}

/**
 * Create a backend cache manager instance
 */
export function createBackendCacheManager(
  cache: InMemoryCache,
  client: ApolloClient<NormalizedCacheObject>,
  options?: {
    enablePersistence?: boolean;
    persistenceKey?: string;
    enableOptimization?: boolean;
  }
): BackendCacheManager {
  return new BackendCacheManager(cache, client, options);
}

/**
 * Module-specific cache operation helpers
 */
export const moduleOperations = {
  users: {
    updateProfile: (cache: InMemoryCache, userId: string, profileData: Record<string, unknown>) => {
      const manager = new BackendCacheManager(cache, {} as ApolloClient<NormalizedCacheObject>);
      return manager.executeOperation({
        module: BackendModule.USERS,
        operation: 'update',
        typename: 'User',
        id: userId,
        data: { id: userId, __typename: 'User', profile: profileData },
      });
    },
  },

  courses: {
    publish: (cache: InMemoryCache, courseId: string) => {
      const manager = new BackendCacheManager(cache, {} as ApolloClient<NormalizedCacheObject>);
      return manager.executeOperation({
        module: BackendModule.COURSES,
        operation: 'update',
        typename: 'Course',
        id: courseId,
        data: {
          id: courseId,
          __typename: 'Course',
          status: 'PUBLISHED',
          publishedAt: new Date().toISOString(),
        },
      });
    },
  },

  enrollments: {
    updateProgress: (
      cache: InMemoryCache,
      enrollmentId: string,
      progress: { percentage: number; lessons: unknown[] }
    ) => {
      const manager = new BackendCacheManager(cache, {} as ApolloClient<NormalizedCacheObject>);
      return manager.executeOperation({
        module: BackendModule.ENROLLMENTS,
        operation: 'update',
        typename: 'Enrollment',
        id: enrollmentId,
        data: {
          id: enrollmentId,
          __typename: 'Enrollment',
          progressPercentage: progress.percentage,
          lessonProgress: progress.lessons,
        },
      });
    },
  },

  communication: {
    sendMessage: (cache: InMemoryCache, messageData: CacheEntity, conversationId: string) => {
      const manager = new BackendCacheManager(cache, {} as ApolloClient<NormalizedCacheObject>);
      return manager.executeOperation({
        module: BackendModule.COMMUNICATION,
        operation: 'create',
        typename: 'Message',
        data: { ...messageData, conversationId },
      });
    },
    createAnnouncement: (cache: InMemoryCache, announcementData: CacheEntity, courseId: string) => {
      const manager = new BackendCacheManager(cache, {} as ApolloClient<NormalizedCacheObject>);
      return manager.executeOperation({
        module: BackendModule.COMMUNICATION,
        operation: 'create',
        typename: 'Announcement',
        data: { ...announcementData, courseId },
      });
    },
    updatePresence: (cache: InMemoryCache, presenceData: CacheEntity, courseId: string) => {
      const manager = new BackendCacheManager(cache, {} as ApolloClient<NormalizedCacheObject>);
      return manager.executeOperation({
        module: BackendModule.COMMUNICATION,
        operation: 'update',
        typename: 'PresenceUpdate',
        data: { ...presenceData, courseId },
      });
    },
  },

  notifications: {
    markAsRead: (cache: InMemoryCache, notificationId: string, _userId: string) => {
      const manager = new BackendCacheManager(cache, {} as ApolloClient<NormalizedCacheObject>);
      return manager.executeOperation({
        module: BackendModule.NOTIFICATIONS,
        operation: 'update',
        typename: 'Notification',
        id: notificationId,
        data: {
          id: notificationId,
          __typename: 'Notification',
          isRead: true,
          readAt: new Date().toISOString(),
        },
      });
    },
  },
};
