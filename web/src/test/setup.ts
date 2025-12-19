import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import * as fc from 'fast-check'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Configure fast-check for property-based testing
beforeAll(() => {
  // Set global configuration for property-based tests
  fc.configureGlobal({
    numRuns: 100, // Minimum 100 iterations as required by spec
    verbose: process.env.NODE_ENV === 'development',
    seed: process.env.VITEST_SEED ? parseInt(process.env.VITEST_SEED) : undefined,
    interruptAfterTimeLimit: 10000, // 10 seconds timeout
    markInterruptAsFailure: true,
  })
})

// Global test utilities
declare global {
  var propertyTestConfig: {
    numRuns: number
    verbose: boolean
    seed?: number
  }
}

globalThis.propertyTestConfig = {
  numRuns: 100,
  verbose: process.env.NODE_ENV === 'development',
  seed: process.env.VITEST_SEED ? parseInt(process.env.VITEST_SEED) : undefined,
}
