/**
 * Module Registration
 * 
 * Registers all application modules with the Fastify server.
 * This includes routes, GraphQL schemas, and other module-specific configurations.
 */

import { FastifyInstance } from 'fastify';
import { logger } from '../shared/utils/logger';

// Import module plugins
import webhookPlugin from './payments/presentation/routes/webhookRoutes';

/**
 * Registers all module routes and plugins with the Fastify server
 */
export async function registerModules(server: FastifyInstance): Promise<void> {
  try {
    logger.info('Registering application modules...');

    // Register payment webhook routes
    await server.register(webhookPlugin, { prefix: '/api/v1' });

    // TODO: Register other module routes as they are implemented
    // TODO: Register GraphQL server
    // TODO: Register WebSocket handlers

    logger.info('All modules registered successfully');
  } catch (error) {
    logger.error('Failed to register modules', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}