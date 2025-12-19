/**
 * Property-Based Testing Utilities
 * 
 * Utilities for generating GraphQL-compatible test data and configuring fast-check
 * for property-based testing with minimum 100 iterations per test.
 */

import * as fc from 'fast-check';

/**
 * Configuration for property-based tests
 */
export const PROPERTY_TEST_CONFIG = {
  numRuns: 100, // Minimum 100 iterations as required
  verbose: process.env.NODE_ENV === 'development',
  seed: process.env.VITEST_SEED ? parseInt(process.env.VITEST_SEED) : undefined,
} as const;

/**
 * Common GraphQL-compatible data generators
 */
export const generators = {
  // Basic types
  id: () => fc.uuid(),
  email: () => fc.emailAddress(),
  url: () => fc.webUrl(),
  slug: () => fc.stringMatching(/^[a-z0-9-]+$/),
  
  // Date generators
  pastDate: () => fc.date({ max: new Date() }),
  futureDate: () => fc.date({ min: new Date() }),
  dateRange: () => fc.tuple(fc.date(), fc.date()).map(([d1, d2]) => 
    d1 <= d2 ? [d1, d2] : [d2, d1]
  ),
  
  // User-related generators
  userRole: () => fc.constantFrom('student', 'educator', 'admin'),
  userStatus: () => fc.constantFrom('active', 'inactive', 'suspended'),
  
  // Course-related generators
  courseStatus: () => fc.constantFrom('draft', 'published', 'archived'),
  difficulty: () => fc.constantFrom('beginner', 'intermediate', 'advanced'),
  currency: () => fc.constantFrom('USD', 'EUR', 'GBP'),
  
  // Enrollment-related generators
  enrollmentStatus: () => fc.constantFrom('active', 'completed', 'dropped', 'suspended'),
  progressPercentage: () => fc.integer({ min: 0, max: 100 }),
  
  // Content-related generators
  fileType: () => fc.constantFrom('image/jpeg', 'image/png', 'video/mp4', 'application/pdf'),
  fileSize: () => fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // 1KB to 100MB
  
  // Text generators
  title: () => fc.string({ minLength: 5, maxLength: 100 }),
  description: () => fc.string({ minLength: 10, maxLength: 500 }),
  shortText: () => fc.string({ minLength: 1, maxLength: 50 }),
  longText: () => fc.string({ minLength: 100, maxLength: 2000 }),
  
  // Numeric generators
  price: () => fc.float({ min: 0, max: 10000, noNaN: true }).map(n => Math.round(n * 100) / 100),
  rating: () => fc.float({ min: 0, max: 5, noNaN: true }).map(n => Math.round(n * 10) / 10),
  count: () => fc.integer({ min: 0, max: 1000 }),
  
  // Complex object generators
  userProfile: () => fc.record({
    id: generators.id(),
    email: generators.email(),
    role: generators.userRole(),
    fullName: fc.string({ minLength: 2, maxLength: 50 }),
    bio: fc.option(generators.description()),
    timezone: fc.constantFrom('UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'),
    language: fc.constantFrom('en', 'es', 'fr', 'de'),
    emailVerified: fc.boolean(),
    createdAt: generators.pastDate(),
    updatedAt: generators.pastDate(),
  }),
  
  course: () => fc.record({
    id: generators.id(),
    title: generators.title(),
    description: generators.description(),
    slug: generators.slug(),
    status: generators.courseStatus(),
    difficulty: generators.difficulty(),
    price: generators.price(),
    currency: generators.currency(),
    enrollmentCount: generators.count(),
    averageRating: fc.option(generators.rating()),
    createdAt: generators.pastDate(),
    updatedAt: generators.pastDate(),
  }),
  
  enrollment: () => fc.record({
    id: generators.id(),
    studentId: generators.id(),
    courseId: generators.id(),
    status: generators.enrollmentStatus(),
    progressPercentage: generators.progressPercentage(),
    enrolledAt: generators.pastDate(),
    completedAt: fc.option(generators.pastDate()),
  }),
  
  // JWT token payload generator
  jwtPayload: () => fc.record({
    userId: generators.id(),
    email: generators.email(),
    role: generators.userRole(),
    iat: fc.integer({ min: 1000000000, max: 2000000000 }),
    exp: fc.integer({ min: 2000000000, max: 2100000000 }),
  }),
  
  // GraphQL error generator
  graphqlError: () => fc.record({
    message: fc.string({ minLength: 5, maxLength: 100 }),
    extensions: fc.option(fc.record({
      code: fc.constantFrom('UNAUTHENTICATED', 'FORBIDDEN', 'BAD_USER_INPUT', 'INTERNAL_ERROR'),
      field: fc.option(fc.string()),
    })),
    path: fc.option(fc.array(fc.oneof(fc.string(), fc.integer()))),
  }),
  
  // Upload-related generators
  uploadProgress: () => fc.record({
    uploadId: generators.id(),
    loaded: fc.integer({ min: 0, max: 100000000 }),
    total: fc.integer({ min: 1, max: 100000000 }),
    percentage: fc.integer({ min: 0, max: 100 }),
    speed: fc.integer({ min: 0, max: 10000000 }),
    timeRemaining: fc.integer({ min: 0, max: 3600 }),
    status: fc.constantFrom('pending', 'uploading', 'processing', 'completed', 'failed'),
  }).filter(progress => progress.loaded <= progress.total),
  
  // Cache key generator
  cacheKey: () => fc.oneof(
    fc.string({ minLength: 5, maxLength: 50 }),
    fc.tuple(fc.string(), generators.id()).map(([prefix, id]) => `${prefix}:${id}`),
    fc.tuple(fc.string(), fc.string(), generators.id()).map(([type, action, id]) => `${type}:${action}:${id}`)
  ),
};

/**
 * Property test wrapper that applies standard configuration
 */
export function propertyTest<T extends readonly unknown[]>(
  name: string,
  arbitraries: fc.Arbitrary<T>,
  predicate: (...args: T) => void | boolean | Promise<void | boolean>,
  options: Partial<fc.Parameters<T>> = {}
): void {
  const config = { ...PROPERTY_TEST_CONFIG, ...options };
  
  test(name, () => {
    fc.assert(
      fc.property(arbitraries, predicate),
      config
    );
  });
}

/**
 * Async property test wrapper
 */
export function asyncPropertyTest<T extends readonly unknown[]>(
  name: string,
  arbitraries: fc.Arbitrary<T>,
  predicate: (...args: T) => Promise<void | boolean>,
  options: Partial<fc.Parameters<T>> = {}
): void {
  const config = { ...PROPERTY_TEST_CONFIG, ...options };
  
  test(name, async () => {
    await fc.assert(
      fc.asyncProperty(arbitraries, predicate),
      config
    );
  });
}

/**
 * Test data factory for creating realistic test data
 */
export class TestDataFactory {
  /**
   * Generate a complete user with related data
   */
  static generateUser(overrides: Partial<any> = {}) {
    return fc.sample(generators.userProfile(), 1)[0];
  }
  
  /**
   * Generate a complete course with modules and lessons
   */
  static generateCourse(overrides: Partial<any> = {}) {
    return fc.sample(generators.course(), 1)[0];
  }
  
  /**
   * Generate an enrollment with progress data
   */
  static generateEnrollment(overrides: Partial<any> = {}) {
    return fc.sample(generators.enrollment(), 1)[0];
  }
  
  /**
   * Generate multiple related entities
   */
  static generateRelatedData() {
    const user = this.generateUser();
    const course = this.generateCourse();
    const enrollment = {
      ...this.generateEnrollment(),
      studentId: user.id,
      courseId: course.id,
    };
    
    return { user, course, enrollment };
  }
}

/**
 * Property test tagging system for identification
 */
export function tagProperty(featureName: string, propertyNumber: number, propertyText: string) {
  return `Feature: ${featureName}, Property ${propertyNumber}: ${propertyText}`;
}

/**
 * Common property patterns for testing
 */
export const propertyPatterns = {
  /**
   * Round-trip property: operation and its inverse should return original value
   */
  roundTrip: <T>(
    encode: (value: T) => any,
    decode: (encoded: any) => T,
    generator: fc.Arbitrary<T>,
    equals: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  ) => fc.property(generator, (original) => {
    const encoded = encode(original);
    const decoded = decode(encoded);
    return equals(original, decoded);
  }),
  
  /**
   * Idempotence property: applying operation twice should equal applying it once
   */
  idempotent: <T>(
    operation: (value: T) => T,
    generator: fc.Arbitrary<T>,
    equals: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  ) => fc.property(generator, (value) => {
    const once = operation(value);
    const twice = operation(once);
    return equals(once, twice);
  }),
  
  /**
   * Invariant property: some condition should always hold after operation
   */
  invariant: <T>(
    operation: (value: T) => T,
    invariantCheck: (value: T) => boolean,
    generator: fc.Arbitrary<T>
  ) => fc.property(generator, (value) => {
    const result = operation(value);
    return invariantCheck(result);
  }),
  
  /**
   * Metamorphic property: relationship between inputs should be preserved in outputs
   */
  metamorphic: <T, R>(
    operation: (value: T) => R,
    inputRelation: (a: T, b: T) => boolean,
    outputRelation: (a: R, b: R) => boolean,
    generator: fc.Arbitrary<[T, T]>
  ) => fc.property(generator, ([a, b]) => {
    if (inputRelation(a, b)) {
      const resultA = operation(a);
      const resultB = operation(b);
      return outputRelation(resultA, resultB);
    }
    return true; // Skip if input relation doesn't hold
  }),
};

/**
 * Mock data generators for testing
 */
export const mockGenerators = {
  /**
   * Generate mock GraphQL response
   */
  graphqlResponse: <T>(dataGenerator: fc.Arbitrary<T>) => fc.record({
    data: fc.option(dataGenerator),
    errors: fc.option(fc.array(generators.graphqlError())),
    extensions: fc.option(fc.dictionary(fc.string(), fc.anything())),
  }),
  
  /**
   * Generate mock HTTP response
   */
  httpResponse: <T>(dataGenerator: fc.Arbitrary<T>) => fc.record({
    status: fc.integer({ min: 200, max: 599 }),
    statusText: fc.string(),
    data: dataGenerator,
    headers: fc.dictionary(fc.string(), fc.string()),
  }),
  
  /**
   * Generate mock WebSocket message
   */
  websocketMessage: <T>(dataGenerator: fc.Arbitrary<T>) => fc.record({
    id: generators.id(),
    type: fc.constantFrom('connection_init', 'start', 'data', 'error', 'complete'),
    payload: fc.option(dataGenerator),
  }),
};