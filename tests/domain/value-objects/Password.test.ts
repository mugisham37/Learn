/**
 * Password Value Object Tests
 * 
 * Tests for the Password value object to ensure proper validation
 * and strength checking.
 */

import { describe, it, expect } from 'vitest';
import { Password } from '../../../src/modules/users/domain/value-objects/Password.js';

describe('Password Value Object', () => {
  describe('create', () => {
    it('should create password with valid strength', () => {
      const password = Password.create('SecurePass123');
      expect(password.value).toBe('SecurePass123');
      expect(password.strength).toBeDefined();
    });

    it('should accept password with minimum requirements', () => {
      const password = Password.create('Abcd1234');
      expect(password.value).toBe('Abcd1234');
    });

    it('should reject password shorter than 8 characters', () => {
      expect(() => Password.create('Abc123')).toThrow('at least 8 characters');
    });

    it('should reject password without uppercase letter', () => {
      expect(() => Password.create('abcd1234')).toThrow('uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      expect(() => Password.create('ABCD1234')).toThrow('lowercase letter');
    });

    it('should reject password without number', () => {
      expect(() => Password.create('Abcdefgh')).toThrow('one number');
    });

    it('should rate strong password correctly', () => {
      const password = Password.create('VerySecurePass123!@#');
      expect(password.strength).toBe('strong');
      expect(password.isStrong()).toBe(true);
    });

    it('should rate medium password correctly', () => {
      const password = Password.create('SecurePass123');
      expect(['medium', 'strong']).toContain(password.strength);
    });
  });

  describe('equals', () => {
    it('should return true for equal passwords', () => {
      const password1 = Password.create('SecurePass123');
      const password2 = Password.create('SecurePass123');
      expect(password1.equals(password2)).toBe(true);
    });

    it('should return false for different passwords', () => {
      const password1 = Password.create('SecurePass123');
      const password2 = Password.create('DifferentPass456');
      expect(password1.equals(password2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should mask password in string representation', () => {
      const password = Password.create('SecurePass123');
      expect(password.toString()).toBe('********');
    });
  });

  describe('toJSON', () => {
    it('should mask password in JSON representation', () => {
      const password = Password.create('SecurePass123');
      expect(password.toJSON()).toBe('********');
    });
  });
});
