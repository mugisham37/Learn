/**
 * GraphQL Subscription Server
 *
 * Configures WebSocket server for GraphQL subscriptions with authentication,
 * connection management, and proper error handling.
 *
 * Requirements: 21.4
 */

import { IncomingMessage } from 'http';

import { GraphQLSchema } from 'graphql';
import { verify } from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

import { logger } from '../../shared/utils/logger.js';
import { createGraphQLContext } from './apolloServer.js';
import { GraphQLContext } from './types.js';

/**
 * WebSocket connection context
 */
interface ConnectionContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  connectionId: string;
  connectedAt: Date;
}

/**
 * Creates and configures WebSocket server for GraphQL subscriptions
 */
export function createSubscriptionServer(
  server: unknown,
  schema: GraphQLSchema
): { wsServer: WebSocketServer; cleanup: () => Promise<void> } {
  // Create WebSocket server
  const wsServer = new WebSocketServer({
    server,
    path: '/graphql',
    // Handle connection upgrades
    handleProtocols: (protocols: Set<string>) => {
      // Support graphql-ws protocol
      if (protocols.has('graphql-ws')) {
        return 'graphql-ws';
      }
      return false;
    },
  });

  logger.info('WebSocket server created for GraphQL subscriptions', {
    path: '/graphql',
  });

  // Configure graphql-ws server
  const serverCleanup = useServer(
    {
      schema,

      // Connection initialization
      onConnect: async (ctx) => {
        logger.info('WebSocket connection attempt', {
          connectionId: ctx.connectionParams?.connectionId || 'unknown',
        });

        try {
          // Extract authentication token from connection params or headers
          const token =
            ctx.connectionParams?.authorization ||
            ctx.connectionParams?.Authorization ||
            ctx.extra?.request?.headers?.authorization;

          if (!token) {
            logger.warn('WebSocket connection rejected: No authentication token');
            return false;
          }

          // Remove 'Bearer ' prefix if present
          const cleanToken =
            typeof token === 'string' && token.startsWith('Bearer ') ? token.substring(7) : token;

          // Verify JWT token - using a placeholder secret for now
          // TODO: Import proper JWT configuration
          const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
          const decoded = verify(cleanToken, jwtSecret) as {
            userId: string;
            email: string;
            role: string;
          };

          // Store user context in connection
          const connectionContext: ConnectionContext = {
            user: {
              id: decoded.userId,
              email: decoded.email,
              role: decoded.role,
            },
            connectionId: ctx.connectionParams?.connectionId || `ws-${Date.now()}`,
            connectedAt: new Date(),
          };

          // Store context for use in subscription resolvers
          ctx.extra.connectionContext = connectionContext;

          logger.info('WebSocket connection authenticated', {
            userId: decoded.userId,
            role: decoded.role,
            connectionId: connectionContext.connectionId,
          });

          return true;
        } catch (error) {
          logger.warn('WebSocket connection rejected: Authentication failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      },

      // Connection established
      onSubscribe: async (ctx, msg) => {
        logger.debug('WebSocket subscription started', {
          operationName: msg.payload.operationName,
          userId: ctx.extra.connectionContext?.user?.id,
          connectionId: ctx.extra.connectionContext?.connectionId,
        });

        // Create GraphQL context for subscription
        const graphqlContext: GraphQLContext = {
          user: ctx.extra.connectionContext?.user,
          requestId: `sub-${ctx.extra.connectionContext?.connectionId}-${Date.now()}`,
        };

        // Add context to the execution args
        return {
          ...msg.payload,
          contextValue: graphqlContext,
        };
      },

      // Handle subscription completion
      onComplete: (ctx, msg) => {
        logger.debug('WebSocket subscription completed', {
          operationName: msg?.payload?.operationName,
          userId: ctx.extra.connectionContext?.user?.id,
          connectionId: ctx.extra.connectionContext?.connectionId,
        });
      },

      // Handle connection close
      onDisconnect: (ctx, code, reason) => {
        logger.info('WebSocket connection closed', {
          userId: ctx.extra.connectionContext?.user?.id,
          connectionId: ctx.extra.connectionContext?.connectionId,
          code,
          reason: reason?.toString(),
        });
      },

      // Handle errors
      onError: (ctx, msg, errors) => {
        logger.error('WebSocket subscription error', {
          operationName: msg?.payload?.operationName,
          userId: ctx.extra.connectionContext?.user?.id,
          connectionId: ctx.extra.connectionContext?.connectionId,
          errors: errors.map((err) => ({
            message: err.message,
            path: err.path,
            extensions: err.extensions,
          })),
        });
      },

      // Context factory for subscription resolvers
      context: async (ctx, msg, args) => {
        // Return the context created in onSubscribe
        return (
          args.contextValue || {
            user: ctx.extra.connectionContext?.user,
            requestId: `sub-${ctx.extra.connectionContext?.connectionId}-${Date.now()}`,
          }
        );
      },
    },
    wsServer
  );

  // Handle WebSocket server events
  wsServer.on('connection', (ws, request: IncomingMessage) => {
    logger.debug('Raw WebSocket connection established', {
      url: request.url,
      origin: request.headers.origin,
      userAgent: request.headers['user-agent'],
    });
  });

  wsServer.on('error', (error) => {
    logger.error('WebSocket server error', {
      error: error.message,
    });
  });

  wsServer.on('close', () => {
    logger.info('WebSocket server closed');
  });

  // Cleanup function
  const cleanup = async (): Promise<void> => {
    try {
      logger.info('Cleaning up WebSocket server...');

      // Close all connections
      await serverCleanup.dispose();

      // Close WebSocket server
      await new Promise<void>((resolve, reject) => {
        wsServer.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      logger.info('WebSocket server cleanup completed');
    } catch (error) {
      logger.error('Error during WebSocket server cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return { wsServer, cleanup };
}

/**
 * Utility to check if user is authorized for subscription
 */
export function requireSubscriptionAuth(
  context: GraphQLContext
): NonNullable<GraphQLContext['user']> {
  if (!context.user) {
    throw new Error('Authentication required for subscription');
  }
  return context.user;
}

/**
 * Utility to check if user has required role for subscription
 */
export function requireSubscriptionRole(
  context: GraphQLContext,
  allowedRoles: string[]
): NonNullable<GraphQLContext['user']> {
  const user = requireSubscriptionAuth(context);

  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
  }

  return user;
}
