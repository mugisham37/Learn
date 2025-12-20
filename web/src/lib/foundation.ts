/**
 * Foundation Layer Initialization
 * 
 * Central initialization system for the frontend foundation layer.
 * Handles setup, configuration validation, and service initialization.
 */

import { apolloClient } from './graphql/client';
import { tokenManager } from './auth/tokenStorage';
import { config, authConfig, uploadConfig, cacheConfig } from './config';
import { gql } from '@apollo/client';
import type { FoundationConfig, InitializationResult } from '@/types';

/**
 * Foundation Layer Initialization Options
 */
export interface FoundationInitOptions {
  config?: Partial<FoundationConfig>;
  enableDevMode?: boolean;
  skipValidation?: boolean;
}

/**
 * Foundation Layer State
 */
interface FoundationState {
  initialized: boolean;
  config: FoundationConfig;
  services: {
    graphql: boolean;
    auth: boolean;
    subscriptions: boolean;
    uploads: boolean;
  };
  errors: string[];
}

let foundationState: FoundationState = {
  initialized: false,
  config: config,
  services: {
    graphql: false,
    auth: false,
    subscriptions: false,
    uploads: false,
  },
  errors: [],
};

/**
 * Initialize the Foundation Layer
 * 
 * Sets up all foundation services and validates configuration.
 * Should be called once at application startup.
 * 
 * @param options - Initialization options
 * @returns Promise resolving to initialization result
 * 
 * @example
 * ```typescript
 * import { initializeFoundation } from '@/lib/foundation';
 * 
 * async function setupApp() {
 *   const result = await initializeFoundation({
 *     enableDevMode: process.env.NODE_ENV === 'development'
 *   });
 *   
 *   if (!result.success) {
 *     console.error('Foundation initialization failed:', result.errors);
 *   }
 * }
 * ```
 */
export async function initializeFoundation(
  options: FoundationInitOptions = {}
): Promise<InitializationResult> {
  try {
    // Reset state
    foundationState.errors = [];
    
    // Merge configuration
    foundationState.config = {
      ...config,
      ...options.config,
    };

    // Validate configuration
    if (!options.skipValidation) {
      const validationErrors = validateConfiguration(foundationState.config);
      if (validationErrors.length > 0) {
        foundationState.errors.push(...validationErrors);
        return {
          success: false,
          errors: foundationState.errors,
          services: foundationState.services,
        };
      }
    }

    // Initialize services
    await initializeServices(options.enableDevMode || false);

    foundationState.initialized = true;

    return {
      success: true,
      errors: [],
      services: foundationState.services,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    foundationState.errors.push(errorMessage);
    
    return {
      success: false,
      errors: foundationState.errors,
      services: foundationState.services,
    };
  }
}

/**
 * Get Foundation Layer Status
 * 
 * Returns the current state of the foundation layer.
 */
export function getFoundationStatus(): FoundationState {
  return { ...foundationState };
}

/**
 * Reset Foundation Layer
 * 
 * Resets the foundation layer state. Useful for testing.
 */
export function resetFoundation(): void {
  foundationState = {
    initialized: false,
    config: config,
    services: {
      graphql: false,
      auth: false,
      subscriptions: false,
      uploads: false,
    },
    errors: [],
  };
}

/**
 * Validate Foundation Configuration
 */
function validateConfiguration(config: FoundationConfig): string[] {
  const errors: string[] = [];

  // Validate GraphQL endpoints
  if (!config.graphqlEndpoint) {
    errors.push('GraphQL endpoint is required');
  }

  if (!config.wsEndpoint) {
    errors.push('WebSocket endpoint is required');
  }

  // Validate URLs
  try {
    new URL(config.graphqlEndpoint);
  } catch {
    errors.push('Invalid GraphQL endpoint URL');
  }

  try {
    new URL(config.wsEndpoint.replace('ws://', 'http://').replace('wss://', 'https://'));
  } catch {
    errors.push('Invalid WebSocket endpoint URL');
  }

  return errors;
}

/**
 * Initialize Foundation Services
 */
async function initializeServices(devMode: boolean): Promise<void> {
  // Initialize GraphQL client
  try {
    // Apollo client is already initialized, just verify it's working
    await apolloClient.query({
      query: gql`query { __typename }`,
      errorPolicy: 'ignore',
    });
    foundationState.services.graphql = true;
  } catch (error) {
    foundationState.services.graphql = false;
    if (devMode) {
      console.warn('GraphQL client initialization failed:', error);
    }
  }

  // Initialize authentication
  try {
    // Token manager is already initialized, just verify storage
    tokenManager.getAccessToken(); // This will not throw, just return null if no token
    foundationState.services.auth = true;
  } catch (error) {
    foundationState.services.auth = false;
    if (devMode) {
      console.warn('Auth service initialization failed:', error);
    }
  }

  // Initialize subscriptions
  try {
    // Subscription service will be initialized when first used
    foundationState.services.subscriptions = true;
  } catch (error) {
    foundationState.services.subscriptions = false;
    if (devMode) {
      console.warn('Subscription service initialization failed:', error);
    }
  }

  // Initialize uploads
  try {
    // Upload service will be initialized when first used
    foundationState.services.uploads = true;
  } catch (error) {
    foundationState.services.uploads = false;
    if (devMode) {
      console.warn('Upload service initialization failed:', error);
    }
  }
}

/**
 * Configuration Management System
 */
export const ConfigManager = {
  /**
   * Get current configuration
   */
  getConfig: (): FoundationConfig => foundationState.config,

  /**
   * Update configuration
   */
  updateConfig: (updates: Partial<FoundationConfig>): void => {
    foundationState.config = {
      ...foundationState.config,
      ...updates,
    };
  },

  /**
   * Get auth configuration
   */
  getAuthConfig: () => authConfig,

  /**
   * Get upload configuration
   */
  getUploadConfig: () => uploadConfig,

  /**
   * Get cache configuration
   */
  getCacheConfig: () => cacheConfig,

  /**
   * Validate current configuration
   */
  validateConfig: (): string[] => validateConfiguration(foundationState.config),
};