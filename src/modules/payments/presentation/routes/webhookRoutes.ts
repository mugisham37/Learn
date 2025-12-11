/**
 * Stripe Webhook Routes
 * 
 * Handles incoming webhook events from Stripe.
 * These endpoints are called by Stripe to notify us of payment events.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { StripeClientFactory } from '../../infrastructure/clients/StripeClientFactory';
import { StripeWebhookHandler } from '../../infrastructure/webhooks/StripeWebhookHandler';
import { EndpointRateLimits } from '../../../../shared/middleware/rateLimiting.js';
import { logger } from '../../../../shared/utils/logger';



/**
 * Registers Stripe webhook routes with the Fastify instance
 */
export async function registerWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  const stripeClient = StripeClientFactory.getInstance();
  
  // Get payment service from dependency injection container
  // For now, we'll create it manually - in a real app this would come from DI
  const { PaymentService } = await import('../../application/services/PaymentService.js');
  const { PaymentRepository } = await import('../../infrastructure/repositories/PaymentRepository.js');
  const { SubscriptionRepository } = await import('../../infrastructure/repositories/SubscriptionRepository.js');
  const { RefundRepository } = await import('../../infrastructure/repositories/RefundRepository.js');
  const { EnrollmentRepository } = await import('../../../enrollments/infrastructure/repositories/EnrollmentRepository.js');
  const { CourseRepository } = await import('../../../courses/infrastructure/repositories/CourseRepository.js');
  const { UserRepository } = await import('../../../users/infrastructure/repositories/UserRepository.js');
  
  // Create repositories
  const paymentRepository = new PaymentRepository();
  const subscriptionRepository = new SubscriptionRepository();
  const refundRepository = new RefundRepository();
  const enrollmentRepository = new EnrollmentRepository();
  const courseRepository = new CourseRepository();
  const userRepository = new UserRepository();
  
  // Create payment service (notification service is optional)
  const paymentService = new PaymentService(
    paymentRepository,
    subscriptionRepository,
    refundRepository,
    enrollmentRepository,
    courseRepository,
    userRepository,
    stripeClient,
    undefined // notificationService - optional for webhook processing
  );
  
  const webhookHandler = new StripeWebhookHandler(paymentService);

  // Add content type parser for raw body (needed for Stripe webhook signature verification)
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  // Stripe webhook endpoint with rate limiting
  // Webhooks should have moderate rate limiting to prevent abuse while allowing legitimate traffic
  fastify.post('/webhooks/stripe', {
    ...EndpointRateLimits.expensive.config, // Use expensive config for webhook protection
    schema: {
      headers: {
        type: 'object',
        properties: {
          'stripe-signature': { type: 'string' },
        },
        required: ['stripe-signature'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['stripe-signature'] as string;
      
      if (!signature) {
        logger.warn('Stripe webhook received without signature');
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      // Get raw body as string for signature verification
      const payload = (request.body as Buffer).toString();

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