/**
 * Test Setup Configuration
 * 
 * Global test setup for Vitest testing environment.
 */

import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT = 'http://localhost:3000/graphql';
process.env.NEXT_PUBLIC_WS_ENDPOINT = 'ws://localhost:3000/graphql';

// Mock fetch globally for tests
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Setup test utilities
beforeEach(() => {
  vi.clearAllMocks();
});