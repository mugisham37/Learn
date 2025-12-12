/**
 * Apollo Server Configuration
 * 
 * This module creates and configures Apollo Server with Fastify integration,
 * schema stitching for all modules, and development tools.
 * 
 * Requirements: 21.1
 */

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageProductionDefault } from '@apollo/server/plugin/landingPage/default';
import { FastifyInstance } from 'fastify';
import { GraphQLSchema } from 'graphql';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createSubscriptionServer } from './subscriptionServer.js';
import { createPubSub } from './pubsub.js';

import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { formatGraphQLError } from './errorFormatter.js';
import { 
  createComplexityAnalysisRule, 
  createComplexityAnalysisPlugin, 
  getComplexityConfig 
} from './complexityAnalysis.js';
import { complexityDirectiveTypeDefs } from './complexityDirectives.js';
import { createExecutionTimeTracker } from './complexityMonitoring.js';
import { complexityMonitoringSchema } from './complexitySchema.js';
import { createGraphQLCachingPlugin, createCacheAwareContext } from './cachingPlugin.js';
import { createResponseOptimizationPlugin, getEnvironmentOptimizationConfig } from './responseOptimization.js';

// Import all module schemas and resolvers
import { userTypeDefs, userResolvers } from '../../modules/users/presentation/graphql/index.js';
import { courseTypeDefs, courseResolvers } from '../../modules/courses/presentation/graphql/index.js';
import { contentTypeDefs, contentResolvers } from '../../modules/content/presentation/index.js';
import { assessmentTypeDefs, assessmentResolvers } from '../../modules/assessments/presentation/graphql/index.js';
import { enrollmentTypeDefs, enrollmentResolvers } from '../../modules/enrollments/presentation/graphql/index.js';
import { communicationTypeDefs, communicationResolvers } from '../../modules/communication/presentation/graphql/index.js';
import { notificationTypeDefs } from '../../modules/notifications/presentation/index.js';
import { analyticsTypeDefs, analyticsResolvers } from '../../modules/analytics/presentation/index.js';
import { paymentTypeDefs, paymentResolvers } from '../../modules/payments/presentation/graphql/index.js';
import { searchTypeDefs, searchResolvers } from '../../modules/search/presentation/graphql/index.js';
import { adminTypeDefs, adminResolvers } from '../../modules/admin/presentation/graphql/index.js';

// Helper function to safely import resolvers
function safeImportResolvers(): any[] {
  const resolvers = [];
  
  // Always available resolvers
  resolvers.push(complexityMonitoringSchema.resolvers);
  resolvers.push(userResolvers);
  resolvers.push(courseResolvers);
  resolvers.push(contentResolvers);
  resolvers.push(assessmentResolvers);
  resolvers.push(enrollmentResolvers);
  resolvers.push(analyticsResolvers);
  resolvers.push(paymentResolvers);
  resolvers.push(searchResolvers);
  resolvers.push(adminResolvers);
  
  // Try to import communication resolvers if available
  try {
    resolvers.push(communicationResolvers);
  } catch (error) {
    logger.warn('Communication resolvers not available yet, skipping');
  }
  
  // Try to import notification resolvers if available
  try {
    // Import notification resolvers dynamically if they exist
    // For now, we'll skip them as they're not exported yet
    logger.warn('Notification resolvers not available yet, skipping');
  } catch (error) {
    logger.warn('Notification resolvers not available yet, skipping');
  }
  
  return resolvers.filter(Boolean);
}

// Import DataLoader types and implementations
import { UserDataLoaders } from '../../modules/users/presentation/graphql/dataloaders.js';
import { CourseDataLoaders } from '../../modules/courses/presentation/graphql/dataloaders.js';
import { EnrollmentDataLoaders } from '../../modules/enrollments/presentation/graphql/dataloaders.js';

/**
 * GraphQL Context interface
 */
export interface GraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  requestId: string;
  pubsub?: any; // PubSub instance for subscriptions
  dataloaders?: {
    // User data loaders
    users?: UserDataLoaders;
    
    // Course data loaders  
    courses?: CourseDataLoaders;
    
    // Enrollment data loaders
    enrollments?: EnrollmentDataLoaders;
    
    // Legacy individual loaders for backward compatibility
    userById?: any;
    usersByIds?: any;
    courseById?: any;
    coursesByInstructorId?: any;
    modulesByCourseId?: any;
    moduleById?: any;
    lessonsByModuleId?: any;
    lessonById?: any;
    enrollmentById?: any;
    enrollmentsByStudentId?: any;
    enrollmentsByCourseId?: unknown;
  };
}

/**
 * Creates the merged GraphQL schema from all modules
 */
function createMergedSchema(): GraphQLSchema {
  // Base type definitions for common scalars and interfaces
  const baseTypeDefs = `
    scalar DateTime
    scalar JSON
    scalar Upload

    type Query {
      _empty: String
    }

    type Mutation {
      _empty: String
    }

    type Subscription {
      _empty: String
    }

    interface Node {
      id: ID!
    }

    type PageInfo {
      hasNextPage: Boolean!
      hasPreviousPage: Boolean!
      startCursor: String
      endCursor: String
    }

    input PaginationInput {
      first: Int
      after: String
      last: Int
      before: String
    }

    type Error {
      message: String!
      code: String
      field: String
    }
  `;

  // Merge all type definitions including complexity directives and monitoring
  const mergedTypeDefs = mergeTypeDefs([
    baseTypeDefs,
    complexityDirectiveTypeDefs,
    complexityMonitoringSchema.typeDefs,
    userTypeDefs,
    courseTypeDefs,
    contentTypeDefs,
    assessmentTypeDefs,
    enrollmentTypeDefs,
    communicationTypeDefs,
    notificationTypeDefs,
    analyticsTypeDefs,
    paymentTypeDefs,
    searchTypeDefs,
    adminTypeDefs,
  ]);

  // Merge all resolvers (safely handle missing ones)
  const availableResolvers = safeImportResolvers();
  const mergedResolvers = mergeResolvers(availableResolvers);

  // Create executable schema with complexity analysis
  return makeExecutableSchema({
    typeDefs: mergedTypeDefs,
    resolvers: mergedResolvers,
  });
}

/**
 * Creates and configures Apollo Server instance with subscription support
 */
export async function createApolloServer(fastify: FastifyInstance): Promise<{
  server: ApolloServer<GraphQLContext>;
  schema: GraphQLSchema;
  subscriptionCleanup?: () => Promise<void>;
}> {
  const schema = createMergedSchema();

  // Create subscription server for WebSocket support
  let subscriptionCleanup: (() => Promise<void>) | undefined;
  
  try {
    const { cleanup } = createSubscriptionServer(fastify.server, schema);
    subscriptionCleanup = cleanup;
    logger.info('GraphQL subscription server created successfully');
  } catch (error) {
    logger.warn('Failed to create subscription server, subscriptions will not be available', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Get complexity configuration for current environment
  const complexityConfig = getComplexityConfig();
  
  const server = new ApolloServer<GraphQLContext>({
    schema,
    
    // Configure introspection based on environment
    introspection: config.nodeEnv !== 'production',
    
    // Add validation rules including complexity analysis
    validationRules: [
      createComplexityAnalysisRule(complexityConfig),
    ],
    
    // Plugins configuration
    plugins: [
      // Drain HTTP server plugin for graceful shutdown
      ApolloServerPluginDrainHttpServer({ httpServer: fastify.server }),
      
      // Query complexity analysis plugin for monitoring
      createComplexityAnalysisPlugin(complexityConfig),
      
      // Execution time tracking plugin
      createExecutionTimeTracker(),
      
      // HTTP caching plugin for GraphQL responses
      createGraphQLCachingPlugin(),
      
      // Response optimization plugin for payload size reduction
      createResponseOptimizationPlugin(getEnvironmentOptimizationConfig()),
      
      // Landing page configuration based on environment
      config.nodeEnv === 'production'
        ? ApolloServerPluginLandingPageProductionDefault({
            footer: false,
            graphRef: 'learning-platform@production',
          })
        : ApolloServerPluginLandingPageLocalDefault({
            footer: false,
            embed: true,
          }),
    ],

    // Format errors for consistent structure using custom formatter
    formatError: (formattedError, error) => {
      return formatGraphQLError(formattedError, error);
    },

    // Include stack trace in development
    includeStacktraceInErrorResponses: config.nodeEnv !== 'production',
  });

  logger.info('Apollo Server created successfully', {
    introspection: config.nodeEnv !== 'production',
    environment: config.nodeEnv,
    subscriptions: !!subscriptionCleanup,
    complexityLimit: complexityConfig.maximumComplexity,
    maxDepth: complexityConfig.maximumDepth,
  });

  return { server, schema, subscriptionCleanup };
}

// Import DataLoader factory
import { createDataLoaders as createDataLoadersFactory } from './dataLoaderFactory.js';

/**
 * Creates data loaders for efficient data fetching
 */
async function createDataLoaders(context: Pick<GraphQLContext, 'requestId'>): Promise<GraphQLContext['dataloaders']> {
  return await createDataLoadersFactory(context.requestId);
}

/**
 * Request interface for GraphQL context
 */
interface GraphQLRequest {
  id?: string;
  headers: {
    authorization?: string;
    [key: string]: string | string[] | undefined;
  };
}

/**
 * Context function to extract user information from request
 */
export async function createGraphQLContext({ request }: { request: GraphQLRequest }): Promise<GraphQLContext> {
  const context: GraphQLContext = {
    requestId: request.id || 'unknown',
  };

  // Extract and validate JWT from Authorization header
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Import JWT utilities
      const { verifyToken } = await import('../../shared/utils/auth.js');
      
      // Verify and decode JWT token
      const { payload, expired } = verifyToken(token);
      
      // Check if token is expired
      if (expired) {
        logger.warn('Expired JWT token in GraphQL request', {
          requestId: context.requestId,
          userId: payload.userId,
        });
        // Don't attach user to context for expired tokens
      } else {
        // Attach validated user context
        context.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
        };
        
        logger.debug('Authenticated GraphQL request', {
          requestId: context.requestId,
          userId: payload.userId,
          role: payload.role,
        });
      }
    }
  } catch (error) {
    // Log authentication errors but don't fail the request
    // This allows unauthenticated queries to still work
    logger.warn('Failed to authenticate GraphQL request', {
      error: error instanceof Error ? error.message : String(error),
      requestId: context.requestId,
      authHeader: request.headers.authorization ? 'present' : 'missing',
    });
  }

  // Add data loaders to context
  try {
    context.dataloaders = await createDataLoaders(context);
  } catch (error) {
    logger.error('Failed to create data loaders for GraphQL context', {
      error: error instanceof Error ? error.message : String(error),
      requestId: context.requestId,
    });
    // Continue without data loaders - resolvers should handle gracefully
  }

  // Add PubSub instance to context for subscriptions
  try {
    context.pubsub = createPubSub();
  } catch (error) {
    logger.error('Failed to create PubSub for GraphQL context', {
      error: error instanceof Error ? error.message : String(error),
      requestId: context.requestId,
    });
    // Continue without PubSub - subscription resolvers should handle gracefully
  }

  // Add cache utilities to context
  return createCacheAwareContext(context);
}