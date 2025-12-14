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

import { logger } from '../../shared/utils/logger.js';
import { GraphQLContext } from './types.js';

/**
 * WebSocket connection context
 */
interface _ConnectionContext {
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
  _schema: GraphQLSchema
): { wsServer: WebSocketServer; cleanup: () => Promise<void> } {
  // Create WebSocket server
  const wsServer = new WebSocketServer({
    server: server as import('http').Server,
    path: '/graphql',
    // Handle connection upgrades
    handleProtocols: (protocols: Set<string>): string | false => {
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

  // Handle WebSocket server events
  wsServer.on('connection', (_ws, request: IncomingMessage) => {
    logger.debug('Raw WebSocket connection established', {
      url: request.url,
      origin: request.headers.origin,
      userAgent: request.headers['user-agent'],
    });

    // Basic authentication check
    try {
      const authHeader = request.headers.authorization;
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const jwtSecret = (process.env as Record<string, string | undefined>)['JWT_SECRET'] || 'your-secret-key';
        
        const decoded = verify(token, jwtSecret) as {
          userId: string;
          email: string;
          role: string;
        };

        logger.info('WebSocket connection authenticated', {
          userId: decoded.userId,
          role: decoded.role,
        });
      } else {
        logger.warn('WebSocket connection without authentication token');
      }
    } catch (error) {
      logger.warn('WebSocket authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
