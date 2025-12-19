/**
 * Configuration Tests
 * 
 * Basic tests to verify configuration setup works correctly.
 */

import { describe, it, expect } from 'vitest';
import { config, authConfig, uploadConfig, cacheConfig } from '../config';

describe('Foundation Configuration', () => {
  it('should have valid GraphQL endpoint configuration', () => {
    expect(config.graphqlEndpoint).toBeDefined();
    expect(config.graphqlEndpoint).toMatch(/^https?:\/\//);
  });

  it('should have valid WebSocket endpoint configuration', () => {
    expect(config.wsEndpoint).toBeDefined();
    expect(config.wsEndpoint).toMatch(/^wss?:\/\//);
  });

  it('should have authentication configuration', () => {
    expect(authConfig.jwtSecret).toBeDefined();
    expect(authConfig.tokenStorageKey).toBe('lms-auth-token');
    expect(authConfig.refreshTokenStorageKey).toBe('lms-refresh-token');
    expect(authConfig.tokenExpirationBuffer).toBeGreaterThan(0);
  });

  it('should have upload configuration', () => {
    expect(uploadConfig.maxFileSize).toBeDefined();
    expect(Array.isArray(uploadConfig.allowedFileTypes)).toBe(true);
    expect(uploadConfig.concurrentUploads).toBeGreaterThan(0);
  });

  it('should have cache configuration', () => {
    expect(cacheConfig.defaultTTL).toBeGreaterThan(0);
    expect(cacheConfig.maxCacheSize).toBeGreaterThan(0);
    expect(typeof cacheConfig.enablePersistence).toBe('boolean');
  });
});