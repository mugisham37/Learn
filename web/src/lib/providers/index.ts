/**
 * Provider Composition Module
 * 
 * Exports provider composition utilities for easy foundation layer setup.
 */

export { 
  FoundationProvider, 
  FoundationProviderWithConfig,
  ProviderUtils 
} from './FoundationProvider';

// Re-export individual providers for advanced use cases
export { AuthProvider } from '../auth/authProvider';
export { SubscriptionProvider } from '../subscriptions/SubscriptionProvider';