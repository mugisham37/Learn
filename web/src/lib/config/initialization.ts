/**
 * Configuration Initialization System
 *
 * Handles the complete initialization of the application configuration,
 * including validation, monitoring, and error tracking setup.
 */

import { initializeConfiguration } from '../config';
import { initializeConfigurationMonitoring } from './monitoring';
import { initializeErrorTracking, setupGlobalErrorHandlers } from './errorTracking';
import type { InitializationResult } from '@/types';

/**
 * Initialize all configuration systems
 */
export async function initializeAllSystems(): Promise<InitializationResult> {
  console.log('🚀 Starting application configuration initialization...');

  const result: InitializationResult = {
    success: false,
    errors: [],
    services: {
      graphql: false,
      auth: false,
      subscriptions: false,
      uploads: false,
    },
  };

  try {
    // Step 1: Initialize and validate core configuration
    console.log('📋 Step 1: Initializing core configuration...');
    try {
      initializeConfiguration();
      result.services.graphql = true;
      console.log('✅ Core configuration initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown configuration error';
      result.errors.push(`Configuration validation failed: ${errorMessage}`);
      console.error('❌ Core configuration failed:', errorMessage);
    }

    // Step 2: Initialize error tracking
    console.log('📋 Step 2: Initializing error tracking...');
    try {
      await initializeErrorTracking();
      setupGlobalErrorHandlers();
      console.log('✅ Error tracking initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error tracking error';
      result.errors.push(`Error tracking initialization failed: ${errorMessage}`);
      console.error('❌ Error tracking failed:', errorMessage);
    }

    // Step 3: Initialize configuration monitoring
    console.log('📋 Step 3: Initializing configuration monitoring...');
    try {
      initializeConfigurationMonitoring();
      console.log('✅ Configuration monitoring initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown monitoring error';
      result.errors.push(`Configuration monitoring failed: ${errorMessage}`);
      console.error('❌ Configuration monitoring failed:', errorMessage);
    }

    // Step 4: Validate service connectivity
    console.log('📋 Step 4: Validating service connectivity...');
    try {
      const { checkConfigurationHealth } = await import('./monitoring');
      const health = await checkConfigurationHealth();

      // Update service status based on health check
      health.services.forEach(service => {
        switch (service.name) {
          case 'GraphQL API':
            result.services.graphql = service.status === 'healthy';
            break;
          case 'WebSocket':
            result.services.subscriptions = service.status === 'healthy';
            break;
          case 'Authentication':
            result.services.auth = service.status === 'healthy';
            break;
          case 'File Upload':
            result.services.uploads = service.status === 'healthy';
            break;
        }
      });

      if (health.overall === 'unhealthy') {
        result.errors.push('One or more critical services are unhealthy');
        health.issues.forEach(issue => result.errors.push(issue));
      } else if (health.overall === 'degraded') {
        console.warn('⚠️  Some services are degraded but application can continue');
        health.issues.forEach(issue => console.warn(`  - ${issue}`));
      }

      console.log('✅ Service connectivity validated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown health check error';
      result.errors.push(`Service health check failed: ${errorMessage}`);
      console.error('❌ Service health check failed:', errorMessage);
    }

    // Determine overall success
    result.success = result.errors.length === 0 && result.services.graphql;

    // Log final result
    if (result.success) {
      console.log('🎉 Application configuration initialization completed successfully!');
      console.log('📊 Service Status:');
      console.log(`  - GraphQL API: ${result.services.graphql ? '✅' : '❌'}`);
      console.log(`  - Authentication: ${result.services.auth ? '✅' : '❌'}`);
      console.log(`  - Real-time (WebSocket): ${result.services.subscriptions ? '✅' : '❌'}`);
      console.log(`  - File Uploads: ${result.services.uploads ? '✅' : '❌'}`);
    } else {
      console.error('❌ Application configuration initialization failed');
      console.error('🔍 Errors encountered:');
      result.errors.forEach(error => console.error(`  - ${error}`));
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    result.errors.push(`Initialization process failed: ${errorMessage}`);
    console.error('❌ Critical initialization error:', errorMessage);
  }

  return result;
}

/**
 * Initialize configuration for Next.js app
 */
export async function initializeNextJSConfiguration(): Promise<void> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const result = await initializeAllSystems();

    // Store initialization result globally for debugging
    (window as unknown as Record<string, unknown>).__APP_INIT_RESULT__ = result;

    if (!result.success) {
      console.error('⚠️  Application started with configuration issues');

      // In development, show more detailed error information
      if (process.env.NODE_ENV === 'development') {
        console.group('🔍 Configuration Issues Details:');
        result.errors.forEach(error => console.error(error));
        console.groupEnd();
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize Next.js configuration:', error);
  }
}

/**
 * Get initialization status
 */
export function getInitializationStatus(): InitializationResult | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return ((window as unknown as Record<string, unknown>).__APP_INIT_RESULT__ as InitializationResult) || null;
}

/**
 * Check if application is ready
 */
export function isApplicationReady(): boolean {
  const status = getInitializationStatus();
  return status ? status.success : false;
}

/**
 * Wait for application to be ready
 */
export function waitForApplicationReady(timeout: number = 10000): Promise<boolean> {
  return new Promise(resolve => {
    const startTime = Date.now();

    const checkReady = () => {
      if (isApplicationReady()) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime > timeout) {
        resolve(false);
        return;
      }

      setTimeout(checkReady, 100);
    };

    checkReady();
  });
}

/**
 * React hook to get initialization status
 */
export function useInitializationStatus() {
  const [status, setStatus] = React.useState<InitializationResult | null>(null);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const checkStatus = () => {
      const currentStatus = getInitializationStatus();
      setStatus(currentStatus);
      setIsReady(currentStatus ? currentStatus.success : false);
    };

    // Check immediately
    checkStatus();

    // Check periodically until ready
    const interval = setInterval(() => {
      if (!isReady) {
        checkStatus();
      } else {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isReady]);

  return { status, isReady };
}

// Import React for the hook
import React from 'react';
