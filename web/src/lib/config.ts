/**
 * Foundation Layer Configuration
 * 
 * Central configuration for GraphQL client, authentication, and other foundation services.
 */

import type { FoundationConfig } from '@/types';

export const config: FoundationConfig = {
  graphqlEndpoint: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  wsEndpoint: process.env.NEXT_PUBLIC_WS_ENDPOINT || 'ws://localhost:4000/graphql',
  enableDevTools: process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true' || process.env.NODE_ENV === 'development',
};

export const authConfig = {
  jwtSecret: process.env.NEXT_PUBLIC_JWT_SECRET || 'development-secret-key',
  tokenStorageKey: 'lms-auth-token',
  refreshTokenStorageKey: 'lms-refresh-token',
  tokenExpirationBuffer: 5 * 60 * 1000, // 5 minutes in milliseconds
};

export const uploadConfig = {
  maxFileSize: process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '100MB',
  allowedFileTypes: process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES?.split(',') || ['image/*', 'video/*', 'application/pdf'],
  concurrentUploads: 3,
};

export const cacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  enablePersistence: true,
};