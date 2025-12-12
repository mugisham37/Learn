/**
 * HTTP Caching Middleware Tests
 * 
 * Tests for HTTP caching functionality including ETag generation,
 * conditional requests, and Cache-Control headers.
 * 
 * Requirements: 15.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateETag, 
  buildCacheControlHeader, 
  parseIfNoneMatch, 
  etagsMatch,
  createHttpCachingMiddleware,
  CacheConfigs,
  type CacheConfig 
} from '../httpCaching.js';

describe('HTTP Caching Utilities', () => {
  describe('generateETag', () => {
    it('should generate consistent ETags for same data', () => {
      const data = { id: 1, name: 'test' };
      const etag1 = generateETag(data);
      const etag2 = generateETag(data);
      
      expect(etag1).toBe(etag2);
      expect(etag1).toMatch(/^"[a-f0-9]{16}"$/);
    });

    it('should generate different ETags for different data', () => {
      const data1 = { id: 1, name: 'test1' };
      const data2 = { id: 2, name: 'test2' };
      
      const etag1 = generateETag(data1);
      const etag2 = generateETag(data2);
      
      expect(etag1).not.toBe(etag2);
    });

    it('should generate weak ETags when specified', () => {
      const data = { id: 1, name: 'test' };
      const etag = generateETag(data, { weak: true });
      
      expect(etag).toMatch(/^W\/"[a-f0-9]{16}"$/);
    });

    it('should handle string data', () => {
      const data = 'test string';
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{16}"$/);
    });

    it('should handle buffer data', () => {
      const data = Buffer.from('test buffer');
      const etag = generateETag(data);
      
      expect(etag).toMatch(/^"[a-f0-9]{16}"$/);
    });

    it('should handle errors gracefully', () => {
      // Create circular reference to cause JSON.stringify to fail
      const data: any = { name: 'test' };
      data.self = data;
      
      const etag = generateETag(data);
      
      // Should still generate a fallback ETag
      expect(etag).toMatch(/^"[a-f0-9]{8}"$/);
    });
  });

  describe('buildCacheControlHeader', () => {
    it('should build basic cache control header', () => {
      const config: CacheConfig = {
        maxAge: 300,
        public: true,
      };
      
      const header = buildCacheControlHeader(config);
      expect(header).toBe('max-age=300, public');
    });

    it('should build private cache control header', () => {
      const config: CacheConfig = {
        maxAge: 600,
        private: true,
        mustRevalidate: true,
      };
      
      const header = buildCacheControlHeader(config);
      expect(header).toBe('max-age=600, private, must-revalidate');
    });

    it('should build no-cache header', () => {
      const config: CacheConfig = {
        maxAge: 0,
        noCache: true,
        noStore: true,
        mustRevalidate: true,
      };
      
      const header = buildCacheControlHeader(config);
      expect(header).toBe('max-age=0, must-revalidate, no-cache, no-store');
    });

    it('should include custom directives', () => {
      const config: CacheConfig = {
        maxAge: 300,
        public: true,
        customDirectives: ['stale-while-revalidate=60', 'immutable'],
      };
      
      const header = buildCacheControlHeader(config);
      expect(header).toBe('max-age=300, public, stale-while-revalidate=60, immutable');
    });
  });

  describe('parseIfNoneMatch', () => {
    it('should parse single ETag', () => {
      const etags = parseIfNoneMatch('"abc123"');
      expect(etags).toEqual(['"abc123"']);
    });

    it('should parse multiple ETags', () => {
      const etags = parseIfNoneMatch('"abc123", "def456", W/"ghi789"');
      expect(etags).toEqual(['"abc123"', '"def456"', 'W/"ghi789"']);
    });

    it('should handle wildcard', () => {
      const etags = parseIfNoneMatch('*');
      expect(etags).toEqual(['*']);
    });

    it('should handle empty header', () => {
      const etags = parseIfNoneMatch('');
      expect(etags).toEqual([]);
    });

    it('should handle malformed header', () => {
      const etags = parseIfNoneMatch('"abc123", , "def456"');
      expect(etags).toEqual(['"abc123"', '"def456"']);
    });
  });

  describe('etagsMatch', () => {
    it('should match identical strong ETags', () => {
      expect(etagsMatch('"abc123"', '"abc123"')).toBe(true);
    });

    it('should match strong and weak ETags with same value', () => {
      expect(etagsMatch('"abc123"', 'W/"abc123"')).toBe(true);
      expect(etagsMatch('W/"abc123"', '"abc123"')).toBe(true);
    });

    it('should match identical weak ETags', () => {
      expect(etagsMatch('W/"abc123"', 'W/"abc123"')).toBe(true);
    });

    it('should not match different ETags', () => {
      expect(etagsMatch('"abc123"', '"def456"')).toBe(false);
    });

    it('should handle empty ETags', () => {
      expect(etagsMatch('', '"abc123"')).toBe(false);
      expect(etagsMatch('"abc123"', '')).toBe(false);
      expect(etagsMatch('', '')).toBe(false);
    });
  });

  describe('CacheConfigs', () => {
    it('should have predefined static assets config', () => {
      expect(CacheConfigs.STATIC_ASSETS).toEqual({
        maxAge: 31536000,
        public: true,
      });
    });

    it('should have predefined API responses config', () => {
      expect(CacheConfigs.API_RESPONSES).toEqual({
        maxAge: 300,
        private: true,
        mustRevalidate: true,
      });
    });

    it('should have predefined no cache config', () => {
      expect(CacheConfigs.NO_CACHE).toEqual({
        maxAge: 0,
        noCache: true,
        noStore: true,
        mustRevalidate: true,
      });
    });
  });
});

describe('HTTP Caching Middleware', () => {
  let mockRequest: any;
  let mockReply: any;
  let mockNext: any;

  beforeEach(() => {
    mockRequest = {
      id: 'test-request-id',
      method: 'GET',
      url: '/test',
      headers: {},
    };

    mockReply = {
      header: vi.fn(),
      removeHeader: vi.fn(),
      code: vi.fn().mockReturnThis(),
      addHook: vi.fn(),
    };

    mockNext = vi.fn();
  });

  describe('createHttpCachingMiddleware', () => {
    it('should skip caching for non-GET requests', async () => {
      mockRequest.method = 'POST';
      
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      expect(mockReply.addHook).not.toHaveBeenCalled();
    });

    it('should add no-cache headers for no-cache config', async () => {
      const middleware = createHttpCachingMiddleware(CacheConfigs.NO_CACHE);
      await middleware(mockRequest, mockReply);
      
      expect(mockReply.header).toHaveBeenCalledWith(
        'Cache-Control', 
        'max-age=0, must-revalidate, no-cache, no-store'
      );
    });

    it('should add onSend hook for cacheable requests', async () => {
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      expect(mockReply.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
    });

    it('should handle middleware errors gracefully', async () => {
      // Mock addHook to throw an error
      mockReply.addHook.mockImplementation(() => {
        throw new Error('Hook error');
      });
      
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      
      // Should not throw
      await expect(middleware(mockRequest, mockReply)).resolves.toBeUndefined();
    });
  });

  describe('onSend hook behavior', () => {
    it('should generate ETag and cache headers', async () => {
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      // Get the onSend hook function
      const onSendHook = mockReply.addHook.mock.calls[0][1];
      
      const payload = JSON.stringify({ data: 'test' });
      const result = await onSendHook(mockRequest, mockReply, payload);
      
      expect(mockReply.header).toHaveBeenCalledWith('ETag', expect.stringMatching(/^"[a-f0-9]{16}"$/));
      expect(mockReply.header).toHaveBeenCalledWith('Cache-Control', 'max-age=300, private, must-revalidate');
      expect(result).toBe(payload);
    });

    it('should return 304 for matching ETags', async () => {
      const testData = { data: 'test' };
      const expectedETag = generateETag(testData);
      
      mockRequest.headers['if-none-match'] = expectedETag;
      
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      const onSendHook = mockReply.addHook.mock.calls[0][1];
      const payload = JSON.stringify(testData);
      const result = await onSendHook(mockRequest, mockReply, payload);
      
      expect(mockReply.code).toHaveBeenCalledWith(304);
      expect(mockReply.removeHeader).toHaveBeenCalledWith('Content-Type');
      expect(mockReply.removeHeader).toHaveBeenCalledWith('Content-Length');
      expect(mockReply.removeHeader).toHaveBeenCalledWith('Content-Encoding');
      expect(result).toBe('');
    });

    it('should handle wildcard If-None-Match', async () => {
      mockRequest.headers['if-none-match'] = '*';
      
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      const onSendHook = mockReply.addHook.mock.calls[0][1];
      const payload = JSON.stringify({ data: 'test' });
      const result = await onSendHook(mockRequest, mockReply, payload);
      
      expect(mockReply.code).toHaveBeenCalledWith(304);
      expect(result).toBe('');
    });

    it('should handle multiple ETags in If-None-Match', async () => {
      const testData = { data: 'test' };
      const expectedETag = generateETag(testData);
      
      mockRequest.headers['if-none-match'] = `"other-etag", ${expectedETag}, "another-etag"`;
      
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      const onSendHook = mockReply.addHook.mock.calls[0][1];
      const payload = JSON.stringify(testData);
      const result = await onSendHook(mockRequest, mockReply, payload);
      
      expect(mockReply.code).toHaveBeenCalledWith(304);
      expect(result).toBe('');
    });

    it('should continue normally for non-matching ETags', async () => {
      mockRequest.headers['if-none-match'] = '"different-etag"';
      
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      const onSendHook = mockReply.addHook.mock.calls[0][1];
      const payload = JSON.stringify({ data: 'test' });
      const result = await onSendHook(mockRequest, mockReply, payload);
      
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(result).toBe(payload);
    });

    it('should handle onSend hook errors gracefully', async () => {
      // Mock header method to throw an error
      mockReply.header.mockImplementation(() => {
        throw new Error('Header error');
      });
      
      const middleware = createHttpCachingMiddleware(CacheConfigs.API_RESPONSES);
      await middleware(mockRequest, mockReply);
      
      const onSendHook = mockReply.addHook.mock.calls[0][1];
      const payload = JSON.stringify({ data: 'test' });
      
      // Should return original payload even if caching fails
      const result = await onSendHook(mockRequest, mockReply, payload);
      expect(result).toBe(payload);
    });
  });
});