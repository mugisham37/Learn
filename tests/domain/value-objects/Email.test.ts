/**
 * Email Value Object Tests
 * 
 * Tests for the Email value object to ensure proper validation
 * and behavior.
 */

import { describe, it, expect } from 'vitest';
import { Email } from '../../../src/modules/users/domain/value-objects/Email.js';

describe('Email Value Object', () => {
  describe('create', () => {
    it('should create email with valid format', () => {
      const email = Email.create('test@example.com');
      expect(email.value).toBe('test@example.com');
    });

    it('should normalize email to lowercase', () => {
      const email = Email.create('Test@Example.COM');
      expect(email.value).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      const email = Email.create('  test@example.com  ');
      expect(email.value).toBe('test@example.com');
    });

    it('should reject empty email', () => {
      expect(() => Email.create('')).toThrow();
    });

    it('should reject email without @', () => {
      expect(() => Email.create('testexample.com')).toThrow('Invalid email format');
    });

    it('should reject email without domain', () => {
      expect(() => Email.create('test@')).toThrow('Invalid email format');
    });

    it('should reject email without local part', () => {
      expect(() => Email.create('@example.com')).toThrow('Invalid email format');
    });

    it('should reject email that is too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => Email.create(longEmail)).toThrow('exceeds maximum length');
    });
  });

  describe('equals', () => {
    it('should return true for equal emails', () => {
      const email1 = Email.create('test@example.com');
      const email2 = Email.create('test@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return true for equal emails with different casing', () => {
      const email1 = Email.create('Test@Example.com');
      const email2 = Email.create('test@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different emails', () => {
      const email1 = Email.create('test1@example.com');
      const email2 = Email.create('test2@example.com');
      expect(email1.equals(email2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return email string', () => {
      const email = Email.create('test@example.com');
      expect(email.toString()).toBe('test@example.com');
    });
  });

  describe('toJSON', () => {
    it('should return email string', () => {
      const email = Email.create('test@example.com');
      expect(email.toJSON()).toBe('test@example.com');
    });
  });
});
