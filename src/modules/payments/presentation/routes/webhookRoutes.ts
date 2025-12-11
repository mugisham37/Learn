/**
 * Stripe Webhook Routes
 * 
 * Handles incoming webhook events from Stripe.
 * These endpoints are called by Stripe to notify us of payment events.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StripeClientFactory } from '../../infrastructure/clients/StripeClientFactory';
import { StripeWebhookHandler } from '../../infrastructure/webhooks/StripeWebhookHandler';
import { logger } from '../../../../shared/utils/logger';

export interface WebhookRequest extends FastifyRequest {
  body: Buffer;
  headers: {
    'stripe-signature': string;
  };
}

/**
 * Registers Stripe webhook routes with the Fastify instance
 */
export async function registerWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  const stripeClient = StripeClientFactory.getInstance();
  const webhookHandler = new StripeWebhookHandler();

  // Add content type parser for raw body (needed for Stripe webhook signature verification)
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body);
  });

  // Stripe webhook endpoint
  fastify.post('/webhooks/stripe', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          'stripe-signature': { type: 'string' },
        },
        required: ['stripe-signature'],
      },
    },
  }, async (request: WebhookRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['stripe-signature'];
      
      if (!signature) {
        logger.warn('Stripe webhook received without signature');
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      // Get raw body as string for signature verification
      const payload = request.body.toString();

      if (!payload) {
        logger.warn('Stripe webhook received without payload');
        return reply.code(400).send({ error: 'Missing request body' });
      }

      // Verify webhook signature
      const event = stripeClient.verifyWebhookSignature(payload, signature);

      logger.info('Stripe webhook received and verified', {
        eventType: event.type,
        eventId: event.id,
      });

      // Process the webhook event
      await webhookHandler.handleWebhook(event);

      // Return success response to Stripe
      return reply.code(200).send({ received: true });
    } catch (error) {
      logger.error('Failed to process Stripe webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: request.id,
      });

      // Return error response to Stripe
      // Stripe will retry the webhook if we return a non-2xx status
      return reply.code(400).send({ 
        error: 'Webhook processing failed',
        requestId: request.id,
      });
    }
  });

  logger.info('Stripe webhook routes registered');
}

/**
 * Fastify plugin for payment webhook routes
 */
export default async function webhookPlugin(fastify: FastifyInstance): Promise<void> {
  await registerWebhookRoutes(fastify);
}