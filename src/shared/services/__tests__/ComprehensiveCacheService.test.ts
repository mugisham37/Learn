/**
 * Comprehensive Cache Service Tests
 * 
 * Tests the comprehensive caching strategy implementation including:
 * - User profile caching with 5-minute TTL
 * - Course catalog caching with 10-minute TTL
 * - Search results caching with 5-minute TTL
 * - Cache stampede prevention
 * - Cache warming functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ComprehensiveCacheService, ComprehensiveCacheTTL } from '../ComprehensiveCacheService.js';

// Mock the cache module
vi.mock('../../../infrastructure/cache/index.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    deletePattern: vi.fn(),
    setIfNotExists: vi.fn(),
    getStats: vi.fn(() => ({
      keys: 100,
      memory: '10MB',
      hits: '1000',
      misses: '100'
    })),
    clear: vi.fn(),
  },
  buildCacheKey: vi.fn((...parts) => parts.join(':')),
  CachePrefix: {
    USER: 'user',
    COURSE: 'course',
    SEARCH: 'search',
    ANALYTICS: 'analytics',
  },
  CacheTTL: {
    MEDIUM: 300,
    LONG: 3600,
  },
}));

// Mock the analytics cache service
vi.mock('../../../modules/analytics/infrastructure/cache/index.js', () => ({
  analyticsCacheService: {
    warmDashboardCaches: vi.fn().mockResolvedValue({ warmed: 5, failed: 0 }),
  },
}));

describe('ComprehensiveCacheService', () => {
  let cacheService: ComprehensiveCacheService;
  let mockCache: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Get the mocked cache
    const cacheModule = vi.mocked(await import('../../../infrastructure/cache/index.js'));
    mockCache = cacheModule.cache;
    
    // Create service instance
    cacheService = new ComprehensiveCacheService({
      warmUserProfiles: true,
      warmCourseCatalogs: true,
      warmSearchData: true,
      warmAnalytics: true,
      maxUsersToWarm: 10,
      maxCoursesToWarm: 5,
      maxSearchQueries: 5,
      userBatchSize: 2,
      courseBatchSize: 2,
      enabled: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Profile Caching', () => {
    it('should cache user profile with 5-minute TTL', async () => {
      const userId = 'user-123';
      const profile = { id: userId, name: 'John Doe', email: 'john@example.com' };

      await cacheService.cacheUserProfile(userId, profile);

      expect(mockCache.set).toHaveBeenCalledWith(
        'user:profile:user-123',
        profile,
        ComprehensiveCacheTTL.USER_PROFILES
      );
    });

    it('should retrieve cached user profile', async () => {
      const userId = 'user-123';
      const profile = { id: userId, name: 'John Doe', email: 'john@example.com' };
      
      mockCache.get.mockResolvedValue(profile);

      const result = await cacheService.getCachedUserProfile(userId);

      expect(mockCache.get).toHaveBeenCalledWith('user:profile:user-123');
      expect(result).toEqual(profile);
    });

    it('should invalidate user profile cache', async () => {
      const userId = 'user-123';

      await cacheService.invalidateUserProfile(userId);

      expect(mockCache.delete).toHaveBeenCalledWith('user:profile:user-123');
    });
  });

  describe('Course Catalog Caching', () => {
    it('should cache course catalog with 10-minute TTL', async () => {
      const catalog = { courses: [], total: 0, page: 1 };

      await cacheService.cacheCourseCatalog(1, 20, 'web-development', catalog);

      expect(mockCache.set).toHaveBeenCalledWith(
        'course:catalog:1:20:web-development',
        catalog,
        ComprehensiveCacheTTL.COURSE_CATALOGS
      );
    });

    it('should retrieve cached course catalog', async () => {
      const catalog = { courses: [], total: 0, page: 1 };
      
      mockCache.get.mockResolvedValue(catalog);

      const result = await cacheService.getCachedCourseCatalog(1, 20, 'web-development');

      expect(mockCache.get).toHaveBeenCalledWith('course:catalog:1:20:web-development');
      expect(result).toEqual(catalog);
    });

    it('should cache course details with 10-minute TTL', async () => {
      const courseId = 'course-123';
      const course = { id: courseId, title: 'JavaScript Basics', price: 99 };

      await cacheService.cacheCourseDetails(courseId, course);

      expect(mockCache.set).toHaveBeenCalledWith(
        'course:details:course-123',
        course,
        ComprehensiveCacheTTL.COURSE_DETAILS
      );
    });

    it('should invalidate course catalog caches', async () => {
      await cacheService.invalidateCourseCatalog();

      expect(mockCache.deletePattern).toHaveBeenCalledWith('course:catalog:*');
    });
  });

  describe('Search Results Caching', () => {
    it('should cache search results with 5-minute TTL', async () => {
      const results = { documents: [], total: 0, took: 10 };

      await cacheService.cacheSearchResults('javascript', 'web-development', 1, results);

      expect(mockCache.set).toHaveBeenCalledWith(
        'search:results:javascript:web-development:1',
        results,
        ComprehensiveCacheTTL.SEARCH_RESULTS
      );
    });

    it('should retrieve cached search results', async () => {
      const results = { documents: [], total: 0, took: 10 };
      
      mockCache.get.mockResolvedValue(results);

      const result = await cacheService.getCachedSearchResults('javascript', 'web-development', 1);

      expect(mockCache.get).toHaveBeenCalledWith('search:results:javascript:web-development:1');
      expect(result).toEqual(results);
    });

    it('should cache autocomplete suggestions', async () => {
      const suggestions = ['javascript', 'java', 'jquery'];

      await cacheService.cacheAutocomplete('ja', suggestions);

      expect(mockCache.set).toHaveBeenCalledWith(
        'search:autocomplete:ja',
        suggestions,
        ComprehensiveCacheTTL.SEARCH_AUTOCOMPLETE
      );
    });

    it('should cache trending searches', async () => {
      const trending = ['javascript', 'python', 'react'];

      await cacheService.cacheTrendingSearches(trending);

      expect(mockCache.set).toHaveBeenCalledWith(
        'search:trending',
        trending,
        ComprehensiveCacheTTL.SEARCH_TRENDING
      );
    });
  });

  describe('Cache Stampede Prevention', () => {
    it('should return cached data if available', async () => {
      const cachedData = { result: 'cached' };
      mockCache.get.mockResolvedValue(cachedData);

      const expensiveFunction = vi.fn().mockResolvedValue({ result: 'fresh' });

      const result = await cacheService.withStampedePrevention(
        'test-key',
        expensiveFunction
      );

      expect(result).toEqual(cachedData);
      expect(expensiveFunction).not.toHaveBeenCalled();
    });

    it('should execute function and cache result if not cached and lock acquired', async () => {
      const freshData = { result: 'fresh' };
      
      mockCache.get.mockResolvedValue(null); // Not cached
      mockCache.setIfNotExists.mockResolvedValue(true); // Lock acquired
      
      const expensiveFunction = vi.fn().mockResolvedValue(freshData);

      const result = await cacheService.withStampedePrevention(
        'test-key',
        expensiveFunction
      );

      expect(result).toEqual(freshData);
      expect(expensiveFunction).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith('test-key', freshData, ComprehensiveCacheTTL.SEARCH_RESULTS);
      expect(mockCache.delete).toHaveBeenCalledWith('analytics:stampede-lock:test-key');
    });

    it('should wait and check cache again if lock not acquired', async () => {
      const cachedData = { result: 'cached-after-wait' };
      
      mockCache.get
        .mockResolvedValueOnce(null) // First check - not cached
        .mockResolvedValueOnce(cachedData); // Second check - now cached
      
      mockCache.setIfNotExists.mockResolvedValue(false); // Lock not acquired
      
      const expensiveFunction = vi.fn().mockResolvedValue({ result: 'fresh' });

      // Mock setTimeout to resolve immediately
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      const result = await cacheService.withStampedePrevention(
        'test-key',
        expensiveFunction
      );

      expect(result).toEqual(cachedData);
      expect(expensiveFunction).not.toHaveBeenCalled();
    });
  });

  describe('Cache Warming', () => {
    it('should warm all caches when enabled', async () => {
      const result = await cacheService.warmAllCaches();

      expect(result.warmed).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should skip warming when disabled', async () => {
      const disabledService = new ComprehensiveCacheService({
        enabled: false,
        warmUserProfiles: true,
        warmCourseCatalogs: true,
        warmSearchData: true,
        warmAnalytics: true,
        maxUsersToWarm: 10,
        maxCoursesToWarm: 5,
        maxSearchQueries: 5,
        userBatchSize: 2,
        courseBatchSize: 2,
      });

      const result = await disabledService.warmAllCaches();

      expect(result.warmed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.duration).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', async () => {
      const stats = await cacheService.getCacheStatistics();

      expect(stats).toEqual({
        totalKeys: 100,
        memoryUsage: '10MB',
        hitRate: '1000',
        missRate: '100',
        moduleBreakdown: {
          users: 0,
          courses: 0,
          search: 0,
          analytics: 0,
        },
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', async () => {
      await cacheService.clearAllCaches();

      expect(mockCache.clear).toHaveBeenCalled();
    });
  });
});