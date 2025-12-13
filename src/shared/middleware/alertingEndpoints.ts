/**
 * Alerting Management Endpoints
 *
 * Provides HTTP endpoints for managing alerting rules and viewing alert status.
 * Admin-only endpoints for configuring and monitoring the alerting system.
 *
 * Requirements: 17.7
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getAlertingRulesService } from '../services/AlertingRulesService.js';
import { logger } from '../utils/logger.js';

import { requireAuth, requireRole } from './index.js';

/**
 * Register alerting management endpoints
 */
export function registerAlertingEndpoints(server: FastifyInstance): void {
  const alertingRulesService = getAlertingRulesService();

  // Get all alert rules
  server.get(
    '/admin/alerts/rules',
    {
      preHandler: [requireAuth, requireRole(['admin'])],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rules = alertingRulesService.getRules();
        return reply.send({ rules });
      } catch (error) {
        logger.error('Failed to get alert rules', { error });
        return reply.code(500).send({ error: 'Failed to retrieve alert rules' });
      }
    }
  );

  // Get active alerts
  server.get(
    '/admin/alerts/active',
    {
      preHandler: [requireAuth, requireRole(['admin'])],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const activeAlerts = alertingRulesService.getActiveAlerts();
        return reply.send({ activeAlerts });
      } catch (error) {
        logger.error('Failed to get active alerts', { error });
        return reply.code(500).send({ error: 'Failed to retrieve active alerts' });
      }
    }
  );

  logger.info('Alerting management endpoints registered');
}
