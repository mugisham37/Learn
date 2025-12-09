/**
 * Application Configuration
 * 
 * Centralized configuration management loading from environment variables
 * with validation and type safety.
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validates that a required environment variable exists
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Application configuration object
 */
export const config = {
  // Application
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '3000'), 10),
  host: getEnv('HOST', '0.0.0.0'),
  logLevel: getEnv('LOG_LEVEL', 'info'),

  // Database
  database: {
    url: requireEnv('DATABASE_URL'),
    poolMin: parseInt(getEnv('DATABASE_POOL_MIN', '5'), 10),
    poolMax: parseInt(getEnv('DATABASE_POOL_MAX', '20'), 10),
  },

  // Redis
  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: parseInt(getEnv('REDIS_PORT', '6379'), 10),
    password: getEnv('REDIS_PASSWORD', ''),
    db: parseInt(getEnv('REDIS_DB', '0'), 10),
  },

  // JWT
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    accessTokenExpiry: getEnv('JWT_ACCESS_TOKEN_EXPIRY', '15m'),
    refreshTokenExpiry: getEnv('JWT_REFRESH_TOKEN_EXPIRY', '30d'),
  },

  // AWS
  aws: {
    region: getEnv('AWS_REGION', 'us-east-1'),
    accessKeyId: getEnv('AWS_ACCESS_KEY_ID', ''),
    secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY', ''),
  },

  // S3
  s3: {
    bucketName: getEnv('S3_BUCKET_NAME', ''),
    bucketRegion: getEnv('S3_BUCKET_REGION', 'us-east-1'),
  },

  // CloudFront
  cloudfront: {
    domain: getEnv('CLOUDFRONT_DOMAIN', ''),
    keyPairId: getEnv('CLOUDFRONT_KEY_PAIR_ID', ''),
    privateKeyPath: getEnv('CLOUDFRONT_PRIVATE_KEY_PATH', ''),
  },

  // MediaConvert
  mediaConvert: {
    endpoint: getEnv('MEDIACONVERT_ENDPOINT', ''),
    roleArn: getEnv('MEDIACONVERT_ROLE_ARN', ''),
    queueArn: getEnv('MEDIACONVERT_QUEUE_ARN', ''),
  },

  // Elasticsearch
  elasticsearch: {
    node: getEnv('ELASTICSEARCH_NODE', 'http://localhost:9200'),
    username: getEnv('ELASTICSEARCH_USERNAME', 'elastic'),
    password: getEnv('ELASTICSEARCH_PASSWORD', 'changeme'),
  },

  // Stripe
  stripe: {
    secretKey: getEnv('STRIPE_SECRET_KEY', ''),
    publishableKey: getEnv('STRIPE_PUBLISHABLE_KEY', ''),
    webhookSecret: getEnv('STRIPE_WEBHOOK_SECRET', ''),
  },

  // Email (SendGrid)
  sendgrid: {
    apiKey: getEnv('SENDGRID_API_KEY', ''),
    fromEmail: getEnv('SENDGRID_FROM_EMAIL', 'noreply@learningplatform.com'),
    fromName: getEnv('SENDGRID_FROM_NAME', 'Learning Platform'),
  },

  // Email (AWS SES)
  ses: {
    region: getEnv('SES_REGION', 'us-east-1'),
    fromEmail: getEnv('SES_FROM_EMAIL', 'noreply@learningplatform.com'),
  },

  // Firebase
  firebase: {
    projectId: getEnv('FIREBASE_PROJECT_ID', ''),
    privateKey: getEnv('FIREBASE_PRIVATE_KEY', ''),
    clientEmail: getEnv('FIREBASE_CLIENT_EMAIL', ''),
  },

  // Rate Limiting
  rateLimit: {
    max: parseInt(getEnv('RATE_LIMIT_MAX', '100'), 10),
    window: getEnv('RATE_LIMIT_WINDOW', '15m'),
  },

  // CORS
  cors: {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:3001').split(','),
    credentials: getEnv('CORS_CREDENTIALS', 'true') === 'true',
  },

  // Session
  session: {
    secret: requireEnv('SESSION_SECRET'),
  },

  // File Upload
  fileUpload: {
    maxFileSizeMb: parseInt(getEnv('MAX_FILE_SIZE_MB', '100'), 10),
    maxVideoSizeMb: parseInt(getEnv('MAX_VIDEO_SIZE_MB', '500'), 10),
  },

  // Certificate
  certificate: {
    signingKey: getEnv('CERTIFICATE_SIGNING_KEY', ''),
  },

  // CloudWatch
  cloudwatch: {
    logGroup: getEnv('CLOUDWATCH_LOG_GROUP', '/aws/learning-platform'),
    logStream: getEnv('CLOUDWATCH_LOG_STREAM', 'application'),
  },

  // Feature Flags
  features: {
    enableGraphqlPlayground: getEnv('ENABLE_GRAPHQL_PLAYGROUND', 'true') === 'true',
    enableApiDocs: getEnv('ENABLE_API_DOCS', 'true') === 'true',
    enableRateLimiting: getEnv('ENABLE_RATE_LIMITING', 'true') === 'true',
  },

  // BullMQ
  bullmq: {
    redis: {
      host: getEnv('BULLMQ_REDIS_HOST', 'localhost'),
      port: parseInt(getEnv('BULLMQ_REDIS_PORT', '6379'), 10),
      password: getEnv('BULLMQ_REDIS_PASSWORD', ''),
    },
  },

  // WebSocket
  websocket: {
    path: getEnv('WEBSOCKET_PATH', '/socket.io'),
    corsOrigin: getEnv('WEBSOCKET_CORS_ORIGIN', 'http://localhost:3001'),
  },

  // Analytics
  analytics: {
    batchSize: parseInt(getEnv('ANALYTICS_BATCH_SIZE', '100'), 10),
    flushInterval: parseInt(getEnv('ANALYTICS_FLUSH_INTERVAL', '60000'), 10),
  },
} as const;

/**
 * Validates the configuration on startup
 */
export function validateConfig(): void {
  const requiredInProduction = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
  ];

  if (config.nodeEnv === 'production') {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        throw new Error(`Missing required environment variable for production: ${key}`);
      }
    }
  }

  // Note: We can't import logger here due to circular dependency
  // Logger will be initialized after config is loaded
  console.log('Configuration validated successfully');
}
