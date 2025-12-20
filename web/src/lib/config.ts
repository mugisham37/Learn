/**
 * Foundation Layer Configuration
 * 
 * Central configuration for GraphQL client, authentication, and other foundation services.
 * Includes environment-specific configurations and validation.
 */

import { z } from 'zod';
import type { FoundationConfig } from '@/types';

// Environment validation schema
const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  
  // GraphQL Configuration
  NEXT_PUBLIC_GRAPHQL_ENDPOINT: z.string().url(),
  NEXT_PUBLIC_WS_ENDPOINT: z.string().url(),
  
  // Development Configuration
  NEXT_PUBLIC_ENABLE_DEV_TOOLS: z.string().transform(val => val === 'true').default('false'),
  NEXT_PUBLIC_ENABLE_GRAPHQL_PLAYGROUND: z.string().transform(val => val === 'true').default('false'),
  
  // Authentication Configuration
  NEXT_PUBLIC_JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  NEXT_PUBLIC_JWT_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  NEXT_PUBLIC_JWT_REFRESH_TOKEN_EXPIRY: z.string().default('30d'),
  NEXT_PUBLIC_TOKEN_STORAGE_KEY: z.string().default('lms-auth-token'),
  NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY: z.string().default('lms-refresh-token'),
  
  // Upload Configuration
  NEXT_PUBLIC_MAX_FILE_SIZE: z.string().default('100MB'),
  NEXT_PUBLIC_MAX_VIDEO_SIZE: z.string().default('500MB'),
  NEXT_PUBLIC_ALLOWED_FILE_TYPES: z.string().default('image/*,video/*,application/pdf'),
  NEXT_PUBLIC_CONCURRENT_UPLOADS: z.string().transform(val => parseInt(val, 10)).default('3'),
  
  // AWS Configuration
  NEXT_PUBLIC_AWS_REGION: z.string().default('us-east-1'),
  NEXT_PUBLIC_S3_BUCKET_NAME: z.string().optional(),
  NEXT_PUBLIC_CLOUDFRONT_DOMAIN: z.string().optional(),
  
  // Error Tracking and Monitoring
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().default('development'),
  NEXT_PUBLIC_SENTRY_RELEASE: z.string().default('1.0.0'),
  NEXT_PUBLIC_SENTRY_SAMPLE_RATE: z.string().transform(val => parseFloat(val)).default('1.0'),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.string().transform(val => parseFloat(val)).default('0.1'),
  
  // Performance Monitoring
  NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE: z.string().transform(val => parseFloat(val)).default('0.1'),
  
  // Cache Configuration
  NEXT_PUBLIC_CACHE_TTL: z.string().transform(val => parseInt(val, 10)).default('300000'),
  NEXT_PUBLIC_CACHE_MAX_SIZE: z.string().transform(val => parseInt(val, 10)).default('52428800'),
  NEXT_PUBLIC_ENABLE_CACHE_PERSISTENCE: z.string().transform(val => val === 'true').default('true'),
  
  // Real-time Configuration
  NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS: z.string().transform(val => parseInt(val, 10)).default('5'),
  NEXT_PUBLIC_WS_RECONNECT_INTERVAL: z.string().transform(val => parseInt(val, 10)).default('1000'),
  NEXT_PUBLIC_WS_HEARTBEAT_INTERVAL: z.string().transform(val => parseInt(val, 10)).default('30000'),
  
  // Security Configuration
  NEXT_PUBLIC_ENABLE_CSRF_PROTECTION: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_XSS_PROTECTION: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_SECURE_COOKIES: z.string().transform(val => val === 'true').default('false'),
  
  // Rate Limiting
  NEXT_PUBLIC_RATE_LIMIT_MAX: z.string().transform(val => parseInt(val, 10)).default('100'),
  NEXT_PUBLIC_RATE_LIMIT_WINDOW: z.string().transform(val => parseInt(val, 10)).default('900000'),
  
  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_NOTIFICATIONS: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_REAL_TIME: z.string().transform(val => val === 'true').default('true'),
  NEXT_PUBLIC_ENABLE_FILE_UPLOADS: z.string().transform(val => val === 'true').default('true'),
  
  // API Timeouts
  NEXT_PUBLIC_API_TIMEOUT: z.string().transform(val => parseInt(val, 10)).default('30000'),
  NEXT_PUBLIC_UPLOAD_TIMEOUT: z.string().transform(val => parseInt(val, 10)).default('300000'),
  
  // Development Tools
  NEXT_PUBLIC_ENABLE_REDUX_DEVTOOLS: z.string().transform(val => val === 'true').default('false'),
  NEXT_PUBLIC_ENABLE_APOLLO_DEVTOOLS: z.string().transform(val => val === 'true').default('false'),
  NEXT_PUBLIC_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// Validate environment variables
function validateEnvironment() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    throw new Error('Invalid environment configuration');
  }
}

// Get validated environment variables
const env = validateEnvironment();

// Main configuration object
export const config: FoundationConfig = {
  // Environment
  nodeEnv: env.NODE_ENV,
  appEnv: env.NEXT_PUBLIC_APP_ENV,
  
  // GraphQL Configuration
  graphqlEndpoint: env.NEXT_PUBLIC_GRAPHQL_ENDPOINT,
  wsEndpoint: env.NEXT_PUBLIC_WS_ENDPOINT,
  
  // Development Configuration
  enableDevTools: env.NEXT_PUBLIC_ENABLE_DEV_TOOLS,
  enableGraphQLPlayground: env.NEXT_PUBLIC_ENABLE_GRAPHQL_PLAYGROUND,
  
  // Feature Flags
  features: {
    analytics: env.NEXT_PUBLIC_ENABLE_ANALYTICS,
    notifications: env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS,
    realTime: env.NEXT_PUBLIC_ENABLE_REAL_TIME,
    fileUploads: env.NEXT_PUBLIC_ENABLE_FILE_UPLOADS,
  },
  
  // Performance Monitoring
  performanceMonitoring: {
    enabled: env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING,
    sampleRate: env.NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE,
  },
  
  // Logging
  logLevel: env.NEXT_PUBLIC_LOG_LEVEL,
};

// Authentication configuration
export const authConfig = {
  jwtSecret: env.NEXT_PUBLIC_JWT_SECRET,
  accessTokenExpiry: env.NEXT_PUBLIC_JWT_ACCESS_TOKEN_EXPIRY,
  refreshTokenExpiry: env.NEXT_PUBLIC_JWT_REFRESH_TOKEN_EXPIRY,
  tokenStorageKey: env.NEXT_PUBLIC_TOKEN_STORAGE_KEY,
  refreshTokenStorageKey: env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY,
  tokenExpirationBuffer: 5 * 60 * 1000, // 5 minutes in milliseconds
};

// Upload configuration
export const uploadConfig = {
  maxFileSize: env.NEXT_PUBLIC_MAX_FILE_SIZE,
  maxVideoSize: env.NEXT_PUBLIC_MAX_VIDEO_SIZE,
  allowedFileTypes: env.NEXT_PUBLIC_ALLOWED_FILE_TYPES.split(','),
  concurrentUploads: env.NEXT_PUBLIC_CONCURRENT_UPLOADS,
  timeout: env.NEXT_PUBLIC_UPLOAD_TIMEOUT,
};

// AWS configuration
export const awsConfig = {
  region: env.NEXT_PUBLIC_AWS_REGION,
  s3BucketName: env.NEXT_PUBLIC_S3_BUCKET_NAME,
  cloudFrontDomain: env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN,
};

// Cache configuration
export const cacheConfig = {
  defaultTTL: env.NEXT_PUBLIC_CACHE_TTL,
  maxCacheSize: env.NEXT_PUBLIC_CACHE_MAX_SIZE,
  enablePersistence: env.NEXT_PUBLIC_ENABLE_CACHE_PERSISTENCE,
};

// Real-time configuration
export const realTimeConfig = {
  reconnectAttempts: env.NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS,
  reconnectInterval: env.NEXT_PUBLIC_WS_RECONNECT_INTERVAL,
  heartbeatInterval: env.NEXT_PUBLIC_WS_HEARTBEAT_INTERVAL,
};

// Security configuration
export const securityConfig = {
  enableCSRFProtection: env.NEXT_PUBLIC_ENABLE_CSRF_PROTECTION,
  enableXSSProtection: env.NEXT_PUBLIC_ENABLE_XSS_PROTECTION,
  secureCookies: env.NEXT_PUBLIC_SECURE_COOKIES,
  rateLimiting: {
    max: env.NEXT_PUBLIC_RATE_LIMIT_MAX,
    windowMs: env.NEXT_PUBLIC_RATE_LIMIT_WINDOW,
  },
};

// Error tracking configuration
export const errorTrackingConfig = {
  sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  release: env.NEXT_PUBLIC_SENTRY_RELEASE,
  sampleRate: env.NEXT_PUBLIC_SENTRY_SAMPLE_RATE,
  tracesSampleRate: env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
};

// API configuration
export const apiConfig = {
  timeout: env.NEXT_PUBLIC_API_TIMEOUT,
  retryAttempts: 3,
  retryDelay: 1000,
};

// Development tools configuration
export const devToolsConfig = {
  enableReduxDevTools: env.NEXT_PUBLIC_ENABLE_REDUX_DEVTOOLS,
  enableApolloDevTools: env.NEXT_PUBLIC_ENABLE_APOLLO_DEVTOOLS,
};

// Configuration validation function
export function validateConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required configurations
  if (!config.graphqlEndpoint) {
    errors.push('GraphQL endpoint is required');
  }
  
  if (!config.wsEndpoint) {
    errors.push('WebSocket endpoint is required');
  }
  
  if (!authConfig.jwtSecret || authConfig.jwtSecret.length < 32) {
    errors.push('JWT secret must be at least 32 characters long');
  }
  
  // Check environment-specific requirements
  if (config.appEnv === 'production') {
    if (config.enableDevTools) {
      errors.push('Development tools should be disabled in production');
    }
    
    if (errorTrackingConfig.sampleRate > 0.2) {
      errors.push('Error tracking sample rate should be lower in production');
    }
    
    if (!securityConfig.enableCSRFProtection) {
      errors.push('CSRF protection should be enabled in production');
    }
    
    if (!securityConfig.secureCookies) {
      errors.push('Secure cookies should be enabled in production');
    }
  }
  
  // Check feature flag consistency
  if (config.features.fileUploads && !awsConfig.s3BucketName) {
    errors.push('S3 bucket name is required when file uploads are enabled');
  }
  
  if (config.features.realTime && !config.wsEndpoint) {
    errors.push('WebSocket endpoint is required when real-time features are enabled');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Initialize configuration and validate on startup
export function initializeConfiguration(): void {
  console.log('🔧 Initializing configuration...');
  
  const validation = validateConfiguration();
  
  if (!validation.valid) {
    console.error('❌ Configuration validation failed:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Invalid configuration');
  }
  
  console.log('✅ Configuration validated successfully');
  console.log(`📍 Environment: ${config.appEnv}`);
  console.log(`🔗 GraphQL Endpoint: ${config.graphqlEndpoint}`);
  console.log(`🔌 WebSocket Endpoint: ${config.wsEndpoint}`);
  console.log(`🛠️  Dev Tools: ${config.enableDevTools ? 'Enabled' : 'Disabled'}`);
  console.log(`📊 Performance Monitoring: ${config.performanceMonitoring.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`🔒 Security Features: CSRF=${securityConfig.enableCSRFProtection}, XSS=${securityConfig.enableXSSProtection}`);
}

// Export environment for direct access when needed
export { env };