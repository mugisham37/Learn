/**
 * Test Server Helper
 * 
 * Creates a Fastify server instance for testing with minimal configuration.
 */

import { FastifyInstance } from 'fastify';

import { createServer } from '../../server.js';

/**
 * Creates a test server instance with minimal configuration
 */
export async function createTestServer(): Promise<FastifyInstance> {
  const server = await createServer();
  
  // Add a simple test route for CSRF testing
  server.post('/api/test', async (request, reply) => {
    return reply.send({ success: true, data: request.body });
  });
  
  return server;
}