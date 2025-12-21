/**
 * Search Hooks Tests
 * 
 * Basic unit tests for search hooks functionality.
 * 
 * Requirements: 2.2 - Complete Module Hook Implementation (Search)
 */

import { renderHook } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ReactNode } from 'react';

// Simple test to verify hooks can be imported and used
describe('Search Hooks', () => {
  it('should import search hooks without errors', () => {
    // This test verifies that the hooks can be imported successfully
    const { useSearch } = require('./useSearch');
    expect(typeof useSearch).toBe('function');
  });

  it('should handle empty query correctly', () => {
    const { useSearch } = require('./useSearch');
    
    function TestWrapper({ children }: { children: ReactNode }) {
      return <MockedProvider mocks={[]} addTypename={false}>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useSearch({
        query: '',
        filters: {},
        skip: true, // Skip the actual query
      }),
      { wrapper: TestWrapper }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.resultCount).toBe(0);
  });

  it('should initialize with correct default values', () => {
    const { useSearch } = require('./useSearch');
    
    function TestWrapper({ children }: { children: ReactNode }) {
      return <MockedProvider mocks={[]} addTypename={false}>{children}</MockedProvider>;
    }

    const { result } = renderHook(
      () => useSearch({
        query: 'test',
        filters: {},
        skip: true, // Skip the actual query
      }),
      { wrapper: TestWrapper }
    );

    expect(typeof result.current.refetch).toBe('function');
    expect(typeof result.current.fetchMore).toBe('function');
    expect(typeof result.current.applyFilter).toBe('function');
    expect(typeof result.current.clearFilter).toBe('function');
    expect(typeof result.current.clearAllFilters).toBe('function');
    expect(result.current.hasNextPage).toBe(false);
  });
});