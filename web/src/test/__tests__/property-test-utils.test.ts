/**
 * Property-Based Testing Infrastructure Tests
 * 
 * Tests to verify that the property-based testing utilities work correctly.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  generators, 
  propertyTest, 
  asyncPropertyTest, 
  propertyPatterns,
  TestDataFactory,
  tagProperty,
  PROPERTY_TEST_CONFIG 
} from '../property-test-utils';

describe('Property-Based Testing Infrastructure', () => {
  test('should have correct configuration', () => {
    expect(PROPERTY_TEST_CONFIG.numRuns).toBe(100);
    expect(typeof PROPERTY_TEST_CONFIG.verbose).toBe('boolean');
  });

  test('should generate valid IDs', () => {
    fc.assert(
      fc.property(generators.id(), (id) => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        // UUID format check
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }),
      { numRuns: 10 } // Reduced for faster test
    );
  });

  test('should generate valid email addresses', () => {
    fc.assert(
      fc.property(generators.email(), (email) => {
        expect(typeof email).toBe('string');
        expect(email).toContain('@');
        expect(email.length).toBeGreaterThan(0);
      }),
      { numRuns: 10 }
    );
  });

  test('should generate valid user profiles', () => {
    fc.assert(
      fc.property(generators.userProfile(), (profile) => {
        expect(typeof profile.id).toBe('string');
        expect(typeof profile.email).toBe('string');
        expect(['student', 'educator', 'admin']).toContain(profile.role);
        expect(typeof profile.emailVerified).toBe('boolean');
        expect(profile.createdAt).toBeInstanceOf(Date);
        expect(profile.updatedAt).toBeInstanceOf(Date);
      }),
      { numRuns: 10 }
    );
  });

  test('should generate valid progress percentages', () => {
    fc.assert(
      fc.property(generators.progressPercentage(), (percentage) => {
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
        expect(Number.isInteger(percentage)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  test('should generate valid upload progress with constraints', () => {
    fc.assert(
      fc.property(generators.uploadProgress(), (progress) => {
        expect(progress.loaded).toBeLessThanOrEqual(progress.total);
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
        expect(['pending', 'uploading', 'processing', 'completed', 'failed']).toContain(progress.status);
      }),
      { numRuns: 20 }
    );
  });

  test('TestDataFactory should generate consistent data', () => {
    const user1 = TestDataFactory.generateUser();
    const user2 = TestDataFactory.generateUser();
    
    expect(typeof user1.id).toBe('string');
    expect(typeof user2.id).toBe('string');
    expect(user1.id).not.toBe(user2.id); // Should be different
    
    const relatedData = TestDataFactory.generateRelatedData();
    expect(relatedData.enrollment.studentId).toBe(relatedData.user.id);
    expect(relatedData.enrollment.courseId).toBe(relatedData.course.id);
  });

  test('should create proper property tags', () => {
    const tag = tagProperty('frontend-foundation', 1, 'Authentication Token Management');
    expect(tag).toBe('Feature: frontend-foundation, Property 1: Authentication Token Management');
  });

  describe('Property Patterns', () => {
    test('round-trip pattern should work', () => {
      const encode = (x: number) => x.toString();
      const decode = (s: string) => parseInt(s, 10);
      
      fc.assert(
        propertyPatterns.roundTrip(
          encode,
          decode,
          fc.integer(),
          (a, b) => a === b
        ),
        { numRuns: 20 }
      );
    });

    test('idempotent pattern should work', () => {
      const normalize = (s: string) => s.toLowerCase().trim();
      
      fc.assert(
        propertyPatterns.idempotent(
          normalize,
          fc.string(),
          (a, b) => a === b
        ),
        { numRuns: 20 }
      );
    });

    test('invariant pattern should work', () => {
      const addPositive = (x: number) => x + 1;
      const isPositive = (x: number) => x > 0;
      
      fc.assert(
        propertyPatterns.invariant(
          addPositive,
          isPositive,
          fc.integer({ min: 1 })
        ),
        { numRuns: 20 }
      );
    });
  });

  // Test the property test wrapper
  propertyTest(
    'propertyTest wrapper should work',
    fc.integer(),
    (x) => {
      expect(typeof x).toBe('number');
      return true;
    },
    { numRuns: 10 }
  );

  // Test the async property test wrapper
  asyncPropertyTest(
    'asyncPropertyTest wrapper should work',
    fc.string(),
    async (s) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      expect(typeof s).toBe('string');
      return true;
    },
    { numRuns: 10 }
  );
});

/**
 * Feature: frontend-foundation, Property Test Infrastructure: Basic functionality verification
 */
describe('Property Test Infrastructure Validation', () => {
  test('should run property tests with correct configuration', () => {
    let runCount = 0;
    
    fc.assert(
      fc.property(fc.integer(), () => {
        runCount++;
        return true;
      }),
      { numRuns: 50 }
    );
    
    expect(runCount).toBe(50);
  });

  test('should handle property test failures correctly', () => {
    expect(() => {
      fc.assert(
        fc.property(fc.integer(), (x) => {
          return x !== x; // This will always fail
        }),
        { numRuns: 10 }
      );
    }).toThrow();
  });
});