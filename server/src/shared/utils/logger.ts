/**
 * Winston Logger Configuration
 *
 * Implements comprehensive logging infrastructure with Winston
 * as per Requirements 13.7, 17.2, 17.3, and 17.4
 */

import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';

import { config } from '../../config/index.js';

import { secrets } from './secureConfig.js';

/**
 * Sensitive fields that should be redacted from logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'creditCard',
  'cvv',
  'ssn',
  'authorization',
  'cookie',
  'stripeSecretKey',
  'stripePublishableKey',
  'awsAccessKeyId',
  'awsSecretAccessKey',
  'privateKey',
  'jwtSecret',
  'sessionSecret',
];

/**
 * Redact sensitive data from log objects
 * Recursively searches for sensitive fields and replaces their values
 *
 * @param obj - Object to redact
 * @returns Redacted object
 */
function redactSensitiveData(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = { ...(obj as Record<string, unknown>) };

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if key contains any sensitive field name
      const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()));

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        redacted[key] = redactSensitiveData(value);
      } else if (Array.isArray(value)) {
        redacted[key] = value.map((item) => redactSensitiveData(item));
      }
    }

    return redacted;
  }

  return obj;
}

/**
 * Custom format for redacting sensitive data
 */
const redactFormat = winston.format((info) => {
  // Redact sensitive data from the info object
  const redacted = redactSensitiveData(info) as winston.Logform.TransformableInfo;
  return redacted;
})();

/**
 * Development log format with pretty printing
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  redactFormat,
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${String(timestamp)} [${level.toUpperCase()}]: ${String(message)}`;

    // Add metadata if present
    const metaKeys = Object.keys(meta).filter(
      (key) =>
        ![
          'timestamp',
          'level',
          'message',
          'splat',
          Symbol.for('level'),
          Symbol.for('splat'),
        ].includes(key)
    );

    if (metaKeys.length > 0) {
      const metaObj: Record<string, unknown> = {};
      metaKeys.forEach((key) => {
        metaObj[key] = meta[key];
      });
      log += `\n${JSON.stringify(metaObj, null, 2)}`;
    }

    return log;
  })
);

/**
 * Production log format with JSON output
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  redactFormat,
  winston.format.json()
);

/**
 * Create Winston logger instance
 */
function createLogger(): winston.Logger {
  const isDevelopment = config.nodeEnv === 'development';
  const isProduction = config.nodeEnv === 'production';

  // Determine format based on environment
  const logFormat = isDevelopment ? developmentFormat : productionFormat;

  // Base transports
  const transports: winston.transport[] = [
    // Console transport - always enabled
    new winston.transports.Console({
      level: config.logLevel,
      format: logFormat,
      handleExceptions: true,
      handleRejections: true,
    }),
  ];

  // File transports for non-development environments
  if (!isDevelopment) {
    // Error log file
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: productionFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    );

    // Combined log file
    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: productionFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      })
    );
  }

  // CloudWatch transport for production
  // Only add if all required AWS credentials are present
  if (isProduction && config.cloudwatch.logGroup && config.cloudwatch.logStream) {
    try {
      const awsConfig = secrets.getAwsConfig();
      if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
        const cloudwatchTransport = new WinstonCloudWatch({
          logGroupName: config.cloudwatch.logGroup,
          logStreamName: config.cloudwatch.logStream,
          awsRegion: awsConfig.region,
          awsAccessKeyId: awsConfig.accessKeyId,
          awsSecretKey: awsConfig.secretAccessKey,
          messageFormatter: (logObject: Record<string, unknown>): string => {
            // Format as JSON for CloudWatch
            return JSON.stringify(logObject);
          },
          retentionInDays: 30,
        });

        transports.push(cloudwatchTransport);
      }
    } catch (error) {
      // Log to console if CloudWatch fails to initialize
      console.error('Failed to initialize CloudWatch transport:', error);
    }
  }

  // Create logger
  const logger = winston.createLogger({
    level: config.logLevel,
    format: logFormat,
    transports,
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
  });

  return logger;
}

/**
 * Global logger instance
 */
export const logger = createLogger();

/**
 * Log levels for convenience
 */
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly',
} as const;

/**
 * Logging utility functions
 */
export const log = {
  /**
   * Log error message
   */
  error: (message: string, meta?: Record<string, unknown>): void => {
    logger.error(message, meta);
  },

  /**
   * Log warning message
   */
  warn: (message: string, meta?: Record<string, unknown>): void => {
    logger.warn(message, meta);
  },

  /**
   * Log info message
   */
  info: (message: string, meta?: Record<string, unknown>): void => {
    logger.info(message, meta);
  },

  /**
   * Log HTTP request/response
   */
  http: (message: string, meta?: Record<string, unknown>): void => {
    logger.http(message, meta);
  },

  /**
   * Log debug message
   */
  debug: (message: string, meta?: Record<string, unknown>): void => {
    logger.debug(message, meta);
  },

  /**
   * Log with custom level
   */
  log: (level: string, message: string, meta?: Record<string, unknown>): void => {
    logger.log(level, message, meta);
  },
};

/**
 * Create a child logger with additional context
 * Useful for adding module-specific or request-specific context
 *
 * @param context - Additional context to include in all logs
 * @returns Child logger instance
 */
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

/**
 * Stream for Morgan or other middleware that expects a write method
 */
export const logStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};
