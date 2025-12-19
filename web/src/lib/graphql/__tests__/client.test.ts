/**
 * Apollo Client Configuration Tests
 * 
 * Tests for the main Apollo Client setup and configuration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createApolloClient } from '../client';
import { ApolloClient } from '@apollo/client';

describe('Apollo Client Configuration', () => {
  let client: ApolloClient<any>;

  beforeEach(() => {
    client = createApolloClient();
  });

  it('should create Apollo Client instance', () => {
    expect(client).toBeInstanceOf(ApolloClient);
  });

  it('should have correct configuration', () => {
    expect(client.cache).toBeDefined();
    expect(client.link).toBeDefined();
  });

  it('should have default options configured', () => {
    const defaultOptions = (client as any).defaultOptions;
    expect(defaultOptions).toBeDefined();
    expect(defaultOptions.watchQuery?.errorPolicy).toBe('all');
    expect(defaultOptions.query?.errorPolicy).toBe('all');
    expect(defaultOptions.mutate?.errorPolicy).toBe('all');
  });

  it('should have cache configured', () => {
    expect(client.cache).toBeDefined();
    // Test that cache has type policies
    const cache = client.cache as any;
    expect(cache.config).toBeDefined();
  });
});