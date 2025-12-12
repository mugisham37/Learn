/**
 * Request Deduplication Middleware Usage Examples
 * 
 * This file demonstrates how to use the request deduplication middleware
 * in different scenarios within the learning platform backend.
 * 
 * Requirements: 15.6
 */

import { FastifyInstance } from 'fastify';

import {
  createRequestDeduplicationMiddleware,
  standardRequestDeduplication,
  aggressiveRequestDeduplication,
  conservativeRequestDeduplication,
  registerRequestDeduplication,
} from '../requestDeduplication.js';

/**
 * Example 1: Using pre-configured middleware for standard GET endpoints
 */
export function setupStandardDeduplication(fastify: FastifyInstance): void {
  // Apply standard deduplication to all course listing endpoints
  fastify.get('/api/courses', {
    preHandler: [standardRequestDeduplication]
  }, async (request, reply) => {
    // This endpoint will cache responses for 30 seconds
    // Duplicate requests within this window will return cached responses
    return { courses: [] };
  });
}

/**
 * Example 2: Using aggressive deduplication for expensive operations
 */
export function setupAggressiveDeduplication(fastify: FastifyInstance): void {
  // Apply aggressive deduplication to analytics endpoints
  fastify.get('/api/analytics/dashboard', {
    preHandler: [aggressiveRequestDeduplication]
  }, async (request, reply) => {
    // This endpoint will cache responses for 2 minutes
    // Includes authorization header in fingerprint for user-specific caching
    return { metrics: {} };
  });
}

/**
 * Example 3: Using conservative deduplication for frequently changing data
 */
export function setupConservativeDeduplication(fastify: FastifyInstance): void {
  // Apply conservative deduplication to real-time data endpoints
  fastify.get('/api/notifications', {
    preHandler: [conservativeRequestDeduplication]
  }, async (request, reply) => {
    // This endpoint will cache responses for only 10 seconds
    // Suitable for data that changes frequently
    return { notifications: [] };
  });
}

/**
 * Example 4: Custom deduplication configuration
 */
export function setupCustomDeduplication(fastify: FastifyInstance): void {
  // Create custom middleware for search endpoints
  const searchDeduplication = createRequestDeduplicationMiddleware({
    cacheTtlSeconds: 60, // 1 minute cache
    includeHeaders: true,
    headersToInclude: ['authorization', 'accept-language'],
    enabled: (request) => {
      // Only enable for search queries with parameters
      return request.query && Object.keys(request.query).length > 0;
    },
    keyPrefix: 'search_dedup',
  });

  fastify.get('/api/search/courses', {
    preHandler: [searchDeduplication]
  }, async (request, reply) => {
    // This endpoint will deduplicate based on query parameters and user context
    return { results: [] };
  });
}

/**
 * Example 5: Global registration for all endpoints
 */
export function setupGlobalDeduplication(fastify: FastifyInstance): void {
  // Register deduplication globally for all GET requests
  registerRequestDeduplication(fastify, {
    cacheTtlSeconds: 30,
    enabled: (request) => {
      // Only enable for GET requests to API endpoints
      return request.method === 'GET' && request.url.startsWith('/api/');
    },
  });
}

/**
 * Example 6: Conditional deduplication based on user role
 */
export function setupRoleBasedDeduplication(fastify: FastifyInstance): void {
  const roleBasedDeduplication = createRequestDeduplicationMiddleware({
    cacheTtlSeconds: 45,
    includeHeaders: true,
    headersToInclude: ['authorization'],
    enabled: (request) => {
      // Enable deduplication for all users except admins
      // (Admins might need real-time data)
      const authHeader = request.headers.authorization;
      if (!authHeader) return true;
      
      // In a real implementation, you would decode the JWT to check the role
      // This is just an example
      return !authHeader.includes('admin');
    },
  });

  fastify.get('/api/admin/users', {
    preHandler: [roleBasedDeduplication]
  }, async (request, reply) => {
    return { users: [] };
  });
}

/**
 * Example 7: Deduplication with custom key prefix for different modules
 */
export function setupModuleSpecificDeduplication(fastify: FastifyInstance): void {
  // Course module deduplication
  const courseDeduplication = createRequestDeduplicationMiddleware({
    keyPrefix: 'course_dedup',
    cacheTtlSeconds: 60,
  });

  // Analytics module deduplication
  const analyticsDeduplication = createRequestDeduplicationMiddleware({
    keyPrefix: 'analytics_dedup',
    cacheTtlSeconds: 300, // 5 minutes for analytics
  });

  // Apply to respective endpoints
  fastify.register(async function courseRoutes(fastify) {
    fastify.addHook('preHandler', courseDeduplication);
    
    fastify.get('/courses/:id', async (request, reply) => {
      return { course: {} };
    });
  }, { prefix: '/api' });

  fastify.register(async function analyticsRoutes(fastify) {
    fastify.addHook('preHandler', analyticsDeduplication);
    
    fastify.get('/analytics/reports', async (request, reply) => {
      return { report: {} };
    });
  }, { prefix: '/api' });
}

/**
 * Example 8: Monitoring deduplication effectiveness
 */
export async function monitorDeduplication(): Promise<void> {
  const { getDeduplicationStats } = await import('../requestDeduplication.js');
  
  // Get statistics about deduplication performance
  const stats = await getDeduplicationStats();
  
  console.log('Deduplication Statistics:', {
    totalCachedResponses: stats.totalCachedResponses,
    cacheHitRate: stats.cacheHitRate ? `${(stats.cacheHitRate * 100).toFixed(2)}%` : 'N/A',
  });
}

/**
 * Example 9: Cache management and cleanup
 */
export async function manageDuplicationCache(): Promise<void> {
  const { clearDeduplicationCache } = await import('../requestDeduplication.js');
  
  // Clear all deduplication cache entries
  const deletedCount = await clearDeduplicationCache();
  console.log(`Cleared ${deletedCount} cached responses`);
  
  // Clear specific module cache
  const courseDeletedCount = await clearDeduplicationCache('course_dedup');
  console.log(`Cleared ${courseDeletedCount} course-specific cached responses`);
}

/**
 * Complete setup example for the learning platform
 */
export function setupLearningPlatformDeduplication(fastify: FastifyInstance): void {
  // Global deduplication for API endpoints
  registerRequestDeduplication(fastify, {
    cacheTtlSeconds: 30,
    enabled: (request) => {
      return request.method === 'GET' && 
             request.url.startsWith('/api/') &&
             !request.url.includes('/admin/'); // Exclude admin endpoints
    },
  });

  // Specific configurations for different endpoint types
  const expensiveOperationsDeduplication = createRequestDeduplicationMiddleware({
    cacheTtlSeconds: 120,
    includeHeaders: true,
    headersToInclude: ['authorization'],
    keyPrefix: 'expensive_ops',
  });

  // Apply to expensive operations
  const expensiveEndpoints = [
    '/api/analytics/dashboard',
    '/api/reports/course-performance',
    '/api/search/advanced',
  ];

  expensiveEndpoints.forEach(endpoint => {
    fastify.addHook('preHandler', async (request, reply) => {
      if (request.url.startsWith(endpoint)) {
        await expensiveOperationsDeduplication(request, reply);
      }
    });
  });
}