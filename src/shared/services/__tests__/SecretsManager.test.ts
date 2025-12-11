/**
 * Secrets Manager Tests
 * 
 * Tests for the secrets management functionality
 * Requirements: 13.7
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SecretsManager } from '../SecretsManager.js';

describe('SecretsManager', () => {
  let secretsManager: SecretsManager;
  
  beforeEach(() => {
    // Reset environment variables
    vi.resetModules();
    
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    
    secretsManager = SecretsManager.getInstance();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with required secrets', async () => {
      await expect(secretsManager.initialize()).resolves.not.toThrow();
    });

    it('should throw error if required secret is missing', async () => {
      delete process.env.JWT_SECRET;
      
      const newSecretsManager = new (SecretsManager as any)();
      await expect(newSecretsManager.initialize()).rejects.toThrow('Failed to load required secret: jwt_secret');
    });
  });

  describe('secret retrieval', () => {
    beforeEach(async () => {
      await secretsManager.initialize();
    });

    it('should retrieve existing secret', () => {
      const secret = secretsManager.getSecret('jwt_secret');
      expect(secret).toBe('test-jwt-secret');
    });

    it('should return undefined for non-existent secret', () => {
      const secret = secretsManager.getSecret('non_existent_secret');
      expect(secret).toBeUndefined();
    });

    it('should retrieve required secret', () => {
      const secret = secretsManager.getRequiredSecret('jwt_secret');
      expect(secret).toBe('test-jwt-secret');
    });

    it('should throw error for missing required secret', () => {
      expect(() => secretsManager.getRequiredSecret('non_existent_secret'))
        .toThrow('Required secret not found: non_existent_secret');
    });
  });

  describe('secret validation', () => {
    beforeEach(async () => {
      await secretsManager.initialize();
    });

    it('should validate all required secrets successfully', () => {
      expect(() => secretsManager.validateSecrets()).not.toThrow();
    });
  });

  describe('secret metadata', () => {
    beforeEach(async () => {
      await secretsManager.initialize();
    });

    it('should return secret metadata without value', () => {
      const metadata = secretsManager.getSecretMetadata('jwt_secret');
      expect(metadata).toBeDefined();
      expect(metadata).not.toHaveProperty('value');
    });

    it('should return undefined for non-existent secret metadata', () => {
      const metadata = secretsManager.getSecretMetadata('non_existent_secret');
      expect(metadata).toBeUndefined();
    });
  });

  describe('secret names and rotatable secrets', () => {
    it('should return list of all secret names', () => {
      const names = secretsManager.getSecretNames();
      expect(names).toContain('jwt_secret');
      expect(names).toContain('session_secret');
      expect(names).toContain('database_url');
    });

    it('should return list of rotatable secrets', () => {
      const rotatable = secretsManager.getRotatableSecrets();
      expect(rotatable).toContain('jwt_secret');
      expect(rotatable).toContain('session_secret');
      expect(rotatable).not.toContain('database_url'); // Not rotatable
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await secretsManager.initialize();
    });

    it('should pass health check when all required secrets are present', async () => {
      const isHealthy = await secretsManager.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('sensitive data protection', () => {
    it('should never log secret values', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const secret = secretsManager.getSecret('jwt_secret');
      
      // Verify secret is retrieved but not logged
      expect(secret).toBe('test-jwt-secret');
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('test-jwt-secret'));
    });
  });
});