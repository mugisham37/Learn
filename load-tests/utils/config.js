/**
 * Load Test Configuration Utilities
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const GRAPHQL_URL = `${BASE_URL}/graphql`;
export const REST_URL = `${BASE_URL}/api`;

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'k6-load-test/1.0.0',
};

export const GRAPHQL_HEADERS = {
  ...DEFAULT_HEADERS,
  'Content-Type': 'application/json',
};

// Test user credentials for authentication
export const TEST_USERS = {
  student: {
    email: 'student@test.com',
    password: 'TestPassword123!',
  },
  educator: {
    email: 'educator@test.com', 
    password: 'TestPassword123!',
  },
  admin: {
    email: 'admin@test.com',
    password: 'TestPassword123!',
  },
};

// Sample course and content IDs for testing
export const TEST_DATA = {
  courseIds: [
    'course-1',
    'course-2', 
    'course-3',
    'course-4',
    'course-5',
  ],
  lessonIds: [
    'lesson-1',
    'lesson-2',
    'lesson-3',
    'lesson-4',
    'lesson-5',
  ],
  quizIds: [
    'quiz-1',
    'quiz-2',
    'quiz-3',
  ],
};

export function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateRandomEmail() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `user${timestamp}${random}@loadtest.com`;
}

export function generateRandomString(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}