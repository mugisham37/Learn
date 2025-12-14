/**
 * Fastify Apollo Server Plugin
 *
 * This module integrates Apollo Server with Fastify using the official
 * @apollo/server/plugin/drainHttpServer plugin and custom Fastify integration.
 *
 * Requirements: 21.1
 */

import { ApolloServer } from '@apollo/server';
import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

import { logger } from '../../shared/utils/logger.js';

import { createApolloServer, createGraphQLContext } from './apolloServer.js';
import { GraphQLContext } from './types.js';

/**
 * Fastify plugin options for Apollo Server
 */
interface ApolloServerPluginOptions {
  path?: string;
  cors?: boolean;
}

/**
 * Fastify plugin for Apollo Server integration
 */
const apolloServerPlugin: FastifyPluginAsync<ApolloServerPluginOptions> = async (
  fastify: FastifyInstance,
  options: ApolloServerPluginOptions
) => {
  const { path = '/graphql', cors = true } = options;

  // Create Apollo Server instance with subscription support
  const { server: apolloServer, subscriptionCleanup } = createApolloServer(fastify);

  // Start Apollo Server
  await apolloServer.start();

  logger.info('Apollo Server started successfully', {
    path,
    cors,
  });

  // Register GraphQL endpoint
  fastify.route({
    method: ['GET', 'POST', 'OPTIONS'],
    url: path,
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return reply
          .header('Access-Control-Allow-Origin', '*')
          .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          .header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          .code(200)
          .send();
      }

      try {
        // Create GraphQL context
        const contextValue = await createGraphQLContext({ request });

        // Create HeaderMap with required __identity property for Apollo Server compatibility
        const headerMap = new Map(Object.entries(request.headers as Record<string, string>)) as Map<string, string> & { __identity: string };
        // Add the required __identity property for Apollo Server HeaderMap compatibility
        (headerMap as Map<string, string> & { __identity: string }).__identity = 'HeaderMap';

        // Execute GraphQL request
        const response = await apolloServer.executeHTTPGraphQLRequest({
          httpGraphQLRequest: {
            method: request.method.toUpperCase() as 'GET' | 'POST',
            headers: headerMap,
            search: request.url.includes('?') ? request.url.split('?')[1] || '' : '',
            body: request.body,
          },
          context: () => Promise.resolve(contextValue),
        });

        // Set response headers
        if (response.headers) {
          for (const [key, value] of response.headers) {
            void reply.header(key, value);
          }
        }

        // Set CORS headers if enabled
        if (cors) {
          void reply
            .header('Access-Control-Allow-Origin', '*')
            .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            .header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        }

        // Send response
        void reply
          .code(response.status || 200)
          .type('application/json')
          .send(response.body);
      } catch (error) {
        logger.error('GraphQL request failed', {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : String(error),
          requestId: request.id,
          method: request.method,
          url: request.url,
        });

        void reply
          .code(500)
          .type('application/json')
          .send({
            errors: [
              {
                message: 'Internal server error',
                extensions: {
                  code: 'INTERNAL_SERVER_ERROR',
                  requestId: request.id,
                },
              },
            ],
          });
      }
    },
  });

  // Add Apollo Server instance to Fastify instance for access in other plugins
  fastify.decorate('apolloServer', apolloServer);

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    logger.info('Stopping Apollo Server...');

    // Clean up subscription server first
    if (subscriptionCleanup) {
      await subscriptionCleanup();
      logger.info('Subscription server stopped successfully');
    }

    await apolloServer.stop();
    logger.info('Apollo Server stopped successfully');
  });
};

// Export as Fastify plugin
export default fp(apolloServerPlugin, {
  name: 'apollo-server',
  dependencies: [],
});

// Type declaration for Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    apolloServer: ApolloServer<GraphQLContext>;
  }
}
