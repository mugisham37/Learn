/**
 * Simple CSRF Protection Tests
 * 
 * Basic tests for CSRF token generation and validation.
 * 
 * Requirements: 13.8
 */

import { describe, expect, it } from 'vitest';

import { generateCSRFToken } from '../csrf.js';

describe('CSRF Protection - Basic', () => {
  describe('generateCSRFToken', () => {
    it('should generate a valid base64url token', () => {
      const token = generateCSRFToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      // Should be valid base64url (no +, /, or = characters)
      expect(token).not.toMatch(/[+/=]/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of consistent length', () => {
      const token1 = generateCSRFToken();
      const token2 = generateCSRFToken();
      
      expect(token1.length).toBe(token2.length);
    });
  });
});