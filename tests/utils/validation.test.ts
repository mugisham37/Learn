/**
 * Validation Utilities Tests
 * 
 * Tests for email, password, file, URL validation and JSON Schema helpers
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateEmail,
  validatePasswordStrength,
  validateFileType,
  validateFileSize,
  validateFile,
  validateURL,
  sanitizeURL,
  validateWithSchema,
  createSchemaValidator,
  createSafeSchemaValidator,
  commonSchemas,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES,
} from '@shared/utils/validation.js';

describe('Email Validation', () => {
  it('should accept valid email addresses', () => {
    const validEmails = [
      'user@example.com',
      'test.user@example.com',
      'user+tag@example.co.uk',
      'user_name@example-domain.com',
      'a@b.co',
      '123@example.com',
    ];

    validEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  it('should reject invalid email addresses', () => {
    const invalidEmails = [
      'invalid',
      '@example.com',
      'user@',
      'user @example.com',
      'user@example',
      '',
      'user@.com',
    ];

    invalidEmails.forEach((email) => {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should reject emails exceeding maximum length', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const result = validateEmail(longEmail);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum length');
  });

  it('should handle empty and whitespace emails', () => {
    expect(validateEmail('').valid).toBe(false);
    expect(validateEmail('   ').valid).toBe(false);
  });

  it('should handle non-string inputs', () => {
    expect(validateEmail(null as any).valid).toBe(false);
    expect(validateEmail(undefined as any).valid).toBe(false);
    expect(validateEmail(123 as any).valid).toBe(false);
  });

  it('should trim whitespace from emails', () => {
    const result = validateEmail('  user@example.com  ');
    expect(result.valid).toBe(true);
  });

  it('should accept emails with consecutive dots in local part', () => {
    // Note: Consecutive dots are technically allowed in quoted strings in RFC 5322
    // but most validators reject them for simplicity
    const result = validateEmail('user..name@example.com');
    // Our implementation accepts this as valid per the regex
    expect(result.valid).toBe(true);
  });
});

describe('Password Strength Validation', () => {
  it('should accept strong passwords', () => {
    const strongPasswords = [
      'Password123',
      'MyP@ssw0rd',
      'Secure123Pass',
      'Test1234Pass',
    ];

    strongPasswords.forEach((password) => {
      const result = validatePasswordStrength(password);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject passwords without uppercase letters', () => {
    const result = validatePasswordStrength('password123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject passwords without lowercase letters', () => {
    const result = validatePasswordStrength('PASSWORD123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject passwords without numbers', () => {
    const result = validatePasswordStrength('PasswordOnly');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePasswordStrength('Pass1');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should return multiple errors for weak passwords', () => {
    const result = validatePasswordStrength('weak');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('should rate password strength correctly', () => {
    const medium = validatePasswordStrength('Password123');
    expect(medium.strength).toBe('medium');

    const strong = validatePasswordStrength('P@ssw0rd1234');
    expect(strong.strength).toBe('strong');

    const weak = validatePasswordStrength('pass');
    expect(weak.strength).toBe('weak');
  });

  it('should handle non-string inputs', () => {
    expect(validatePasswordStrength(null as any).valid).toBe(false);
    expect(validatePasswordStrength(undefined as any).valid).toBe(false);
    expect(validatePasswordStrength(123 as any).valid).toBe(false);
  });
});

describe('File Type Validation', () => {
  it('should accept allowed file types', () => {
    const result = validateFileType('image/jpeg', ALLOWED_FILE_TYPES.images);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject disallowed file types', () => {
    const result = validateFileType('application/exe', ALLOWED_FILE_TYPES.images);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should be case-insensitive', () => {
    const result = validateFileType('IMAGE/JPEG', ALLOWED_FILE_TYPES.images);
    expect(result.valid).toBe(true);
  });

  it('should handle empty or invalid mime types', () => {
    expect(validateFileType('', ALLOWED_FILE_TYPES.images).valid).toBe(false);
    expect(validateFileType(null as any, ALLOWED_FILE_TYPES.images).valid).toBe(false);
  });

  it('should validate video file types', () => {
    expect(validateFileType('video/mp4', ALLOWED_FILE_TYPES.videos).valid).toBe(true);
    expect(validateFileType('video/webm', ALLOWED_FILE_TYPES.videos).valid).toBe(true);
  });

  it('should validate document file types', () => {
    expect(validateFileType('application/pdf', ALLOWED_FILE_TYPES.documents).valid).toBe(true);
    expect(validateFileType('text/plain', ALLOWED_FILE_TYPES.documents).valid).toBe(true);
  });
});

describe('File Size Validation', () => {
  it('should accept files within size limit', () => {
    const result = validateFileSize(1024 * 1024, MAX_FILE_SIZES.avatar); // 1 MB
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject files exceeding size limit', () => {
    const result = validateFileSize(10 * 1024 * 1024, MAX_FILE_SIZES.avatar); // 10 MB > 5 MB limit
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exceeds maximum allowed size');
  });

  it('should reject empty files', () => {
    const result = validateFileSize(0, MAX_FILE_SIZES.avatar);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('File cannot be empty');
  });

  it('should reject negative file sizes', () => {
    const result = validateFileSize(-100, MAX_FILE_SIZES.avatar);
    expect(result.valid).toBe(false);
  });

  it('should handle invalid inputs', () => {
    expect(validateFileSize(NaN, MAX_FILE_SIZES.avatar).valid).toBe(false);
    expect(validateFileSize('1024' as any, MAX_FILE_SIZES.avatar).valid).toBe(false);
  });
});

describe('Combined File Validation', () => {
  it('should validate both type and size', () => {
    const result = validateFile(
      'image/jpeg',
      1024 * 1024, // 1 MB
      ALLOWED_FILE_TYPES.images,
      MAX_FILE_SIZES.avatar
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return errors for both type and size violations', () => {
    const result = validateFile(
      'application/exe',
      10 * 1024 * 1024, // 10 MB
      ALLOWED_FILE_TYPES.images,
      MAX_FILE_SIZES.avatar
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('URL Validation', () => {
  it('should accept valid URLs', () => {
    const validUrls = [
      'https://example.com',
      'http://example.com',
      'https://www.example.com',
      'https://example.com/path',
      'https://example.com/path?query=value',
      'https://subdomain.example.com',
    ];

    validUrls.forEach((url) => {
      const result = validateURL(url);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBeDefined();
    });
  });

  it('should reject invalid URLs', () => {
    const invalidUrls = [
      'not-a-url',
      'ftp://example.com',
      'javascript:alert(1)',
      '//example.com',
      'http://',
      '',
    ];

    invalidUrls.forEach((url) => {
      const result = validateURL(url);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('should enforce allowed protocols', () => {
    const result = validateURL('ftp://example.com', ['http:', 'https:']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Protocol');
  });

  it('should allow custom protocols', () => {
    const result = validateURL('ftp://example.com', ['ftp:']);
    expect(result.valid).toBe(true);
  });

  it('should sanitize URLs', () => {
    const result = validateURL('https://example.com/path');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('https://example.com/path');
  });

  it('should handle empty and whitespace URLs', () => {
    expect(validateURL('').valid).toBe(false);
    expect(validateURL('   ').valid).toBe(false);
  });

  it('should handle non-string inputs', () => {
    expect(validateURL(null as any).valid).toBe(false);
    expect(validateURL(undefined as any).valid).toBe(false);
  });
});

describe('URL Sanitization', () => {
  it('should sanitize valid URLs', () => {
    const sanitized = sanitizeURL('https://example.com');
    expect(sanitized).toBe('https://example.com/');
  });

  it('should return null for invalid URLs', () => {
    const sanitized = sanitizeURL('not-a-url');
    expect(sanitized).toBeNull();
  });
});

describe('JSON Schema Validation', () => {
  const userSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().positive(),
  });

  it('should validate data against schema', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    };

    const result = validateWithSchema(userSchema, validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should return errors for invalid data', () => {
    const invalidData = {
      name: '',
      email: 'invalid-email',
      age: -5,
    };

    const result = validateWithSchema(userSchema, invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should handle missing required fields', () => {
    const incompleteData = {
      name: 'John Doe',
    };

    const result = validateWithSchema(userSchema, incompleteData);
    expect(result.success).toBe(false);
  });
});

describe('Schema Validator Creation', () => {
  const simpleSchema = z.object({
    value: z.string(),
  });

  it('should create a validator that throws on invalid data', () => {
    const validator = createSchemaValidator(simpleSchema);
    
    expect(() => validator({ value: 'test' })).not.toThrow();
    expect(() => validator({ value: 123 })).toThrow();
  });

  it('should create a safe validator that returns results', () => {
    const validator = createSafeSchemaValidator(simpleSchema);
    
    const validResult = validator({ value: 'test' });
    expect(validResult.success).toBe(true);

    const invalidResult = validator({ value: 123 });
    expect(invalidResult.success).toBe(false);
  });
});

describe('Common Schemas', () => {
  it('should validate emails with common schema', () => {
    expect(() => commonSchemas.email.parse('user@example.com')).not.toThrow();
    expect(() => commonSchemas.email.parse('invalid')).toThrow();
  });

  it('should validate passwords with common schema', () => {
    expect(() => commonSchemas.password.parse('Password123')).not.toThrow();
    expect(() => commonSchemas.password.parse('weak')).toThrow();
  });

  it('should validate URLs with common schema', () => {
    expect(() => commonSchemas.url.parse('https://example.com')).not.toThrow();
    expect(() => commonSchemas.url.parse('not-a-url')).toThrow();
  });

  it('should validate UUIDs with common schema', () => {
    expect(() => commonSchemas.uuid.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    expect(() => commonSchemas.uuid.parse('invalid-uuid')).toThrow();
  });

  it('should validate positive integers with common schema', () => {
    expect(() => commonSchemas.positiveInt.parse(5)).not.toThrow();
    expect(() => commonSchemas.positiveInt.parse(0)).toThrow();
    expect(() => commonSchemas.positiveInt.parse(-5)).toThrow();
  });

  it('should validate percentages with common schema', () => {
    expect(() => commonSchemas.percentage.parse(50)).not.toThrow();
    expect(() => commonSchemas.percentage.parse(0)).not.toThrow();
    expect(() => commonSchemas.percentage.parse(100)).not.toThrow();
    expect(() => commonSchemas.percentage.parse(101)).toThrow();
    expect(() => commonSchemas.percentage.parse(-1)).toThrow();
  });
});
