/**
 * Schema Integration React Hook
 *
 * This hook provides React integration for GraphQL schema management,
 * including synchronization status and validation results.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  schemaIntegration,
  type SchemaValidationResult,
  type SchemaMetadata,
  type SchemaSyncOptions,
} from './schemaIntegration.js';

/**
 * Schema integration hook state
 */
interface UseSchemaIntegrationState {
  // Status
  isLoading: boolean;
  isValidating: boolean;
  isSyncing: boolean;

  // Data
  metadata: SchemaMetadata | null;
  validation: SchemaValidationResult | null;
  schemaSDL: string | null;

  // Error handling
  error: string | null;
  lastSyncAt: Date | null;

  // Health status
  healthScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

/**
 * Schema integration hook options
 */
interface UseSchemaIntegrationOptions {
  autoSync?: boolean;
  syncInterval?: number;
  validateOnMount?: boolean;
  endpoint?: string;
}

/**
 * Schema integration hook return type
 */
interface UseSchemaIntegrationReturn extends UseSchemaIntegrationState {
  // Actions
  sync: (options?: SchemaSyncOptions) => Promise<void>;
  validate: () => Promise<void>;
  reset: () => void;

  // Computed values
  isHealthy: boolean;
  hasPlaceholders: boolean;
  needsImprovement: boolean;

  // Statistics
  stats: SchemaMetadata['stats'] | null;
}

/**
 * React hook for GraphQL schema integration management
 */
export function useSchemaIntegration(
  options: UseSchemaIntegrationOptions = {}
): UseSchemaIntegrationReturn {
  const {
    autoSync = false,
    syncInterval = 30000, // 30 seconds
    validateOnMount = true,
    endpoint,
  } = options;

  // State
  const [state, setState] = useState<UseSchemaIntegrationState>({
    isLoading: false,
    isValidating: false,
    isSyncing: false,
    metadata: null,
    validation: null,
    schemaSDL: null,
    error: null,
    lastSyncAt: null,
    healthScore: 0,
    healthStatus: 'unknown',
  });

  // Refs for cleanup
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Update state safely (only if component is still mounted)
  const updateState = useCallback((updates: Partial<UseSchemaIntegrationState>) => {
    if (mountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Sync schema from backend
  const sync = useCallback(
    async (syncOptions: Partial<SchemaSyncOptions> = {}) => {
      if (state.isSyncing) {
        return; // Prevent concurrent syncs
      }

      updateState({
        isSyncing: true,
        isLoading: true,
        error: null,
      });

      try {
        const fullSyncOptions: SchemaSyncOptions = {
          endpoint: endpoint || '/graphql',
          validateBeforeUse: true,
          retryAttempts: 3,
          retryDelay: 1000,
          timeout: 10000,
          ...syncOptions,
        };

        await schemaIntegration.synchronize(fullSyncOptions);

        // Get updated metadata and validation
        const metadata = await schemaIntegration.getMetadata();
        const validation = await schemaIntegration.getLastValidation();

        updateState({
          metadata,
          validation,
          schemaSDL: null, // Would be populated in real implementation
          lastSyncAt: new Date(),
          healthScore: validation?.health?.score || 0,
          healthStatus: validation?.health?.score ? 
            (validation.health.score >= 90 ? 'excellent' :
             validation.health.score >= 80 ? 'good' :
             validation.health.score >= 60 ? 'fair' : 'poor') : 'unknown',
          error: null,
        });
      } catch (error) {
        updateState({
          error: (error as Error).message,
        });
      } finally {
        updateState({
          isSyncing: false,
          isLoading: false,
        });
      }
    },
    [state.isSyncing, endpoint, updateState]
  );

  // Validate current schema
  const validate = useCallback(async () => {
    if (state.isValidating) {
      return; // Prevent concurrent validations
    }

    updateState({
      isValidating: true,
      error: null,
    });

    try {
      // Get current validation from schema integration
      const validation = await schemaIntegration.getLastValidation();
      const metadata = await schemaIntegration.getMetadata();

      if (validation && metadata) {
        updateState({
          validation,
          metadata,
          healthScore: validation.health?.score || 0,
          healthStatus: validation.health?.score ? 
            (validation.health.score >= 90 ? 'excellent' :
             validation.health.score >= 80 ? 'good' :
             validation.health.score >= 60 ? 'fair' : 'poor') : 'unknown',
        });
      } else {
        // No validation available, trigger sync
        await sync();
      }
    } catch (error) {
      updateState({
        error: (error as Error).message,
      });
    } finally {
      updateState({
        isValidating: false,
      });
    }
  }, [state.isValidating, sync, updateState]);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isValidating: false,
      isSyncing: false,
      metadata: null,
      validation: null,
      schemaSDL: null,
      error: null,
      lastSyncAt: null,
      healthScore: 0,
      healthStatus: 'unknown',
    });
  }, []);

  // Setup auto-sync interval
  useEffect(() => {
    if (autoSync && syncInterval > 0) {
      syncIntervalRef.current = setInterval(() => {
        sync();
      }, syncInterval);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
      };
    }
    return undefined;
  }, [autoSync, syncInterval, sync]);

  // Initial validation on mount
  useEffect(() => {
    if (validateOnMount) {
      validate();
    }
  }, [validateOnMount, validate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  // Computed values
  const isHealthy = state.healthScore >= 70;
  const hasPlaceholders = state.validation?.errors.some(error => 
    typeof error === 'string' && error.includes('PLACEHOLDER_OPERATIONS')
  ) || false;
  const needsImprovement = state.healthScore < 60;
  const stats = state.metadata?.stats || null;

  return {
    // State
    ...state,

    // Actions
    sync,
    validate,
    reset,

    // Computed values
    isHealthy,
    hasPlaceholders,
    needsImprovement,
    stats,
  };
}

/**
 * Hook for schema health monitoring
 */
export function useSchemaHealth() {
  const { healthScore, healthStatus, validation, isHealthy, needsImprovement } =
    useSchemaIntegration({
      validateOnMount: true,
    });

  const recommendations: string[] = [];
  const criticalIssues = validation?.errors.filter(e => 
    typeof e === 'string' && e.includes('error')
  ) || [];
  const warnings = validation?.errors.filter(e => 
    typeof e === 'string' && e.includes('warning')
  ) || [];

  return {
    healthScore,
    healthStatus,
    isHealthy,
    needsImprovement,
    recommendations,
    criticalIssues,
    warnings,
    hasIssues: criticalIssues.length > 0 || warnings.length > 0,
  };
}

/**
 * Hook for schema statistics
 */
export function useSchemaStats() {
  const { stats, metadata, validation } = useSchemaIntegration({
    validateOnMount: true,
  });

  return {
    stats,
    lastUpdated: metadata?.extractedAt,
    endpoint: metadata?.endpoint,
    version: metadata?.version,
    isComplete: validation?.valid || false,
    totalOperations: (stats?.queries || 0) + (stats?.mutations || 0) + (stats?.subscriptions || 0),
  };
}
