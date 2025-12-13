/**
 * HTTP Caching Examples
 *
 * Examples of how to use HTTP caching middleware with different
 * types of endpoints and content.
 *
 * Requirements: 15.4
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createHttpCachingMiddleware,
  CacheConfigs,
  addCachingToRoute,
  type CacheConfig,
} from '../httpCaching.js';
import { generateCDNCacheHeaders } from '../../utils/cdnCaching.js';

/**
 * Example: Course catalog endpoint with public caching
 */
export function registerCourseCatalogEndpoint(fastify: FastifyInstance): void {
  // Course catalog - public, medium cache duration
  addCachingToRoute(
    fastify,
    'GET',
    '/api/courses/catalog',
    CacheConfigs.COURSE_CATALOG,
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Simulate course catalog data
      const courses = [
        {
          id: '1',
          title: 'Introduction to Programming',
          description: 'Learn the basics of programming',
          instructor: 'John Doe',
          price: 99.99,
          rating: 4.5,
        },
        {
          id: '2',
          title: 'Advanced JavaScript',
          description: 'Master advanced JavaScript concepts',
          instructor: 'Jane Smith',
          price: 149.99,
          rating: 4.8,
        },
      ];

      return {
        courses,
        total: courses.length,
        page: 1,
        limit: 10,
      };
    }
  );
}

/**
 * Example: User profile endpoint with private caching
 */
export function registerUserProfileEndpoint(fastify: FastifyInstance): void {
  // User profile - private, short cache duration
  fastify.get(
    '/api/users/profile',
    {
      preHandler: [
        // Add authentication middleware here
        createHttpCachingMiddleware(CacheConfigs.USER_PROFILES, {
          includeRequestData: true, // Include user ID in ETag
        }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Simulate user profile data
      const userProfile = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: 'https://example.com/avatar.jpg',
        preferences: {
          theme: 'dark',
          language: 'en',
        },
      };

      return userProfile;
    }
  );
}

/**
 * Example: Analytics endpoint with longer caching
 */
export function registerAnalyticsEndpoint(fastify: FastifyInstance): void {
  // Analytics data - private, longer cache duration
  fastify.get(
    '/api/analytics/dashboard',
    {
      preHandler: [
        // Add authentication and authorization middleware here
        createHttpCachingMiddleware(CacheConfigs.ANALYTICS),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Simulate analytics data
      const analytics = {
        totalCourses: 150,
        totalStudents: 5000,
        totalRevenue: 125000,
        completionRate: 0.78,
        popularCourses: [
          { id: '1', title: 'JavaScript Basics', enrollments: 1200 },
          { id: '2', title: 'React Fundamentals', enrollments: 980 },
        ],
        recentActivity: [
          { type: 'enrollment', count: 45, date: '2024-01-15' },
          { type: 'completion', count: 23, date: '2024-01-15' },
        ],
      };

      return analytics;
    }
  );
}

/**
 * Example: Search endpoint with custom caching
 */
export function registerSearchEndpoint(fastify: FastifyInstance): void {
  // Search results - public, short-medium cache duration
  const searchCacheConfig: CacheConfig = {
    ...CacheConfigs.SEARCH_RESULTS,
    customDirectives: ['stale-while-revalidate=300'], // Allow stale content for 5 minutes
  };

  fastify.get(
    '/api/search',
    {
      preHandler: [
        createHttpCachingMiddleware(searchCacheConfig, {
          includeRequestData: true, // Include query parameters in ETag
        }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = (request.query as any)?.q || '';
      const category = (request.query as any)?.category || 'all';

      // Simulate search results
      const results = [
        {
          id: '1',
          title: 'JavaScript Course',
          description: 'Learn JavaScript from scratch',
          type: 'course',
          relevance: 0.95,
        },
        {
          id: '2',
          title: 'React Tutorial',
          description: 'Build modern web apps with React',
          type: 'course',
          relevance: 0.87,
        },
      ].filter(
        (result) =>
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.description.toLowerCase().includes(query.toLowerCase())
      );

      return {
        query,
        category,
        results,
        total: results.length,
        facets: {
          types: [
            { key: 'course', count: results.length },
            { key: 'lesson', count: 0 },
          ],
          categories: [
            { key: 'programming', count: results.length },
            { key: 'design', count: 0 },
          ],
        },
      };
    }
  );
}

/**
 * Example: Static asset endpoint with long caching
 */
export function registerStaticAssetEndpoint(fastify: FastifyInstance): void {
  // Static assets - public, very long cache duration
  fastify.get(
    '/static/*',
    {
      preHandler: [createHttpCachingMiddleware(CacheConfigs.STATIC_ASSETS)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const filePath = (request.params as any)['*'];

      // Add CDN-optimized headers
      const cdnHeaders = generateCDNCacheHeaders(`/static/${filePath}`);
      Object.entries(cdnHeaders).forEach(([key, value]) => {
        reply.header(key, value);
      });

      // Simulate static file content
      const content = `/* Static asset: ${filePath} */\nbody { margin: 0; }`;

      reply.type('text/css');
      return content;
    }
  );
}

/**
 * Example: Health check endpoint with no caching
 */
export function registerHealthCheckEndpoint(fastify: FastifyInstance): void {
  // Health checks - no caching
  fastify.get(
    '/api/health/status',
    {
      preHandler: [createHttpCachingMiddleware(CacheConfigs.NO_CACHE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };
    }
  );
}

/**
 * Example: Conditional request handling
 */
export function registerConditionalRequestExample(fastify: FastifyInstance): void {
  // Example endpoint that demonstrates conditional request handling
  fastify.get(
    '/api/example/conditional',
    {
      preHandler: [createHttpCachingMiddleware(CacheConfigs.API_RESPONSES)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Simulate data that changes based on timestamp
      const lastModified = new Date();
      lastModified.setMinutes(Math.floor(lastModified.getMinutes() / 5) * 5); // Round to 5-minute intervals

      const data = {
        message: 'This data updates every 5 minutes',
        lastModified: lastModified.toISOString(),
        randomValue: Math.floor(lastModified.getTime() / (5 * 60 * 1000)), // Changes every 5 minutes
      };

      // Add Last-Modified header
      reply.header('Last-Modified', lastModified.toUTCString());

      return data;
    }
  );
}

/**
 * Register all caching examples
 */
export function registerCachingExamples(fastify: FastifyInstance): void {
  registerCourseCatalogEndpoint(fastify);
  registerUserProfileEndpoint(fastify);
  registerAnalyticsEndpoint(fastify);
  registerSearchEndpoint(fastify);
  registerStaticAssetEndpoint(fastify);
  registerHealthCheckEndpoint(fastify);
  registerConditionalRequestExample(fastify);

  console.log('HTTP caching examples registered:');
  console.log('  GET /api/courses/catalog - Course catalog with public caching');
  console.log('  GET /api/users/profile - User profile with private caching');
  console.log('  GET /api/analytics/dashboard - Analytics with longer caching');
  console.log('  GET /api/search - Search results with custom caching');
  console.log('  GET /static/* - Static assets with long caching');
  console.log('  GET /api/health/status - Health check with no caching');
  console.log('  GET /api/example/conditional - Conditional request example');
}
