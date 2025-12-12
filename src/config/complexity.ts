/**
 * GraphQL Complexity Configuration
 * 
 * This module provides configuration settings for GraphQL query complexity
 * analysis, including environment-specific limits and monitoring settings.
 * 
 * Requirements: 15.6
 */

/**
 * Environment-specific complexity limits
 */
export const COMPLEXITY_LIMITS = {
  development: {
    maximumComplexity: 2000,
    maximumDepth: 20,
    logThreshold: 300,
    alertThreshold: 1500,
    enableDetailedLogging: true,
    enablePerformanceTracking: true,
  },
  staging: {
    maximumComplexity: 1500,
    maximumDepth: 18,
    logThreshold: 500,
    alertThreshold: 1200,
    enableDetailedLogging: true,
    enablePerformanceTracking: true,
  },
  production: {
    maximumComplexity: 1000,
    maximumDepth: 15,
    logThreshold: 600,
    alertThreshold: 800,
    enableDetailedLogging: false,
    enablePerformanceTracking: true,
  },
} as const;

/**
 * Field-specific complexity scores
 */
export const FIELD_COMPLEXITY = {
  // User operations
  'Query.users': 20,
  'Query.user': 5,
  'Mutation.register': 15,
  'Mutation.login': 10,
  
  // Course operations
  'Query.courses': 30,
  'Query.course': 10,
  'Query.searchCourses': 50,
  'Mutation.createCourse': 25,
  
  // Content operations
  'Query.videoAssets': 25,
  'Mutation.generateUploadUrl': 15,
  'Mutation.uploadCourseResource': 20,
  
  // Assessment operations
  'Query.quizzes': 20,
  'Query.assignments': 20,
  'Mutation.createQuiz': 30,
  'Mutation.submitQuiz': 25,
  
  // Enrollment operations
  'Query.enrollments': 25,
  'Query.enrollmentProgress': 15,
  'Mutation.enrollInCourse': 20,
  
  // Communication operations
  'Query.messages': 20,
  'Query.discussionThreads': 25,
  'Mutation.sendMessage': 15,
  'Mutation.createDiscussionThread': 20,
  
  // Analytics operations
  'Query.courseAnalytics': 40,
  'Query.studentAnalytics': 35,
  'Query.generateCourseReport': 60,
  'Query.dashboardMetrics': 30,
  
  // Payment operations
  'Query.paymentHistory': 20,
  'Mutation.createCheckoutSession': 25,
  'Mutation.requestRefund': 30,
  
  // Search operations
  'Query.searchCourses': 50,
  'Query.searchLessons': 40,
  'Query.autocomplete': 20,
  
  // Notification operations
  'Query.notifications': 15,
  'Mutation.markNotificationRead': 5,
  
  // Admin operations
  'Query.complexityStats': 10,
  'Query.topComplexQueries': 15,
  'Query.userComplexityQueries': 20,
} as const;

/**
 * Pagination multipliers
 */
export const PAGINATION_LIMITS = {
  maxFirst: 100,
  maxLast: 100,
  maxLimit: 100,
  defaultLimit: 20,
  complexityMultiplier: 1.5, // Multiply base complexity by this for each item
} as const;

/**
 * Get complexity configuration for current environment
 */
export function getComplexityConfiguration() {
  const env = (process.env.NODE_ENV || 'development') as keyof typeof COMPLEXITY_LIMITS;
  const config = COMPLEXITY_LIMITS[env] || COMPLEXITY_LIMITS.development;
  
  return {
    ...config,
    fieldComplexity: FIELD_COMPLEXITY,
    paginationLimits: PAGINATION_LIMITS,
  };
}

/**
 * Validate complexity configuration
 */
export function validateComplexityConfig(config: any): boolean {
  const required = ['maximumComplexity', 'maximumDepth', 'logThreshold', 'alertThreshold'];
  
  for (const field of required) {
    if (typeof config[field] !== 'number' || config[field] <= 0) {
      throw new Error(`Invalid complexity configuration: ${field} must be a positive number`);
    }
  }
  
  if (config.alertThreshold <= config.logThreshold) {
    throw new Error('Alert threshold must be greater than log threshold');
  }
  
  if (config.maximumComplexity <= config.alertThreshold) {
    throw new Error('Maximum complexity must be greater than alert threshold');
  }
  
  return true;
}

/**
 * Environment variables for complexity configuration
 */
export const COMPLEXITY_ENV_VARS = {
  GRAPHQL_MAX_COMPLEXITY: 'GRAPHQL_MAX_COMPLEXITY',
  GRAPHQL_MAX_DEPTH: 'GRAPHQL_MAX_DEPTH',
  GRAPHQL_LOG_THRESHOLD: 'GRAPHQL_LOG_THRESHOLD',
  GRAPHQL_ALERT_THRESHOLD: 'GRAPHQL_ALERT_THRESHOLD',
  GRAPHQL_DETAILED_LOGGING: 'GRAPHQL_DETAILED_LOGGING',
  GRAPHQL_PERFORMANCE_TRACKING: 'GRAPHQL_PERFORMANCE_TRACKING',
} as const;

/**
 * Load complexity configuration from environment variables
 */
export function loadComplexityConfigFromEnv() {
  const config = getComplexityConfiguration();
  
  // Override with environment variables if present
  if (process.env[COMPLEXITY_ENV_VARS.GRAPHQL_MAX_COMPLEXITY]) {
    config.maximumComplexity = parseInt(process.env[COMPLEXITY_ENV_VARS.GRAPHQL_MAX_COMPLEXITY], 10);
  }
  
  if (process.env[COMPLEXITY_ENV_VARS.GRAPHQL_MAX_DEPTH]) {
    config.maximumDepth = parseInt(process.env[COMPLEXITY_ENV_VARS.GRAPHQL_MAX_DEPTH], 10);
  }
  
  if (process.env[COMPLEXITY_ENV_VARS.GRAPHQL_LOG_THRESHOLD]) {
    config.logThreshold = parseInt(process.env[COMPLEXITY_ENV_VARS.GRAPHQL_LOG_THRESHOLD], 10);
  }
  
  if (process.env[COMPLEXITY_ENV_VARS.GRAPHQL_ALERT_THRESHOLD]) {
    config.alertThreshold = parseInt(process.env[COMPLEXITY_ENV_VARS.GRAPHQL_ALERT_THRESHOLD], 10);
  }
  
  if (process.env[COMPLEXITY_ENV_VARS.GRAPHQL_DETAILED_LOGGING]) {
    config.enableDetailedLogging = process.env[COMPLEXITY_ENV_VARS.GRAPHQL_DETAILED_LOGGING] === 'true';
  }
  
  if (process.env[COMPLEXITY_ENV_VARS.GRAPHQL_PERFORMANCE_TRACKING]) {
    config.enablePerformanceTracking = process.env[COMPLEXITY_ENV_VARS.GRAPHQL_PERFORMANCE_TRACKING] === 'true';
  }
  
  // Validate the final configuration
  validateComplexityConfig(config);
  
  return config;
}