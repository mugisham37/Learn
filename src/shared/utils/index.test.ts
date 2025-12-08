/**
 * Tests for Shared Utility Functions
 */

import { describe, it, expect } from 'vitest';
import { generateSlug, isValidEmail, generateToken } from './index.js';

describe('Utility Functions', () => {
  describe('generateSlug', () => {
    it('should convert text to URL-friendly slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('TypeScript & Node.js')).toBe('typescript-nodejs');
      expect(generateSlug('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate token of specified length', () => {
      const token = generateToken(32);
      expect(token).toHaveLength(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken(32);
      const token2 = generateToken(32);
      expect(token1).not.toBe(token2);
    });
  });
});
