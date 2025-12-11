/**
 * Payment Service Implementation
 * 
 * Implements payment processing, webhook handling, refunds, and subscriptions.
 * Orchestrates between domain entities, repositories, and external services.
 * 
 * Requirements:
 * - 11.1: Stripe checkout session creation and payment processing
 * - 11.2: Webhook handling for payment events
 * - 11.3: Payment failure handling and retry logic
 * - 11.5: Refund processing with policy validation
 */

import Stripe from 'stripe';

import { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  ExternalServiceError,
  DatabaseError 
} from '../../../../shared/errors/index.js';
import { logger } from '../../../../shared/utils/logger.js';

import { 
  IPaymentService,
  CreateCheckoutSessionParams,
  CheckoutSession,
  ProcessRefundParams,
  CreateSubscriptionParams,
  CancelSubscriptionParams
} from './IPaymentService.js';
import { Payment, Subscription, Refund, DEFAULT_REFUND_POLICY } from '../../domain/entities/index.js';
import { 
  IPaymentRepository,
  ISubscriptionRepository,
  IRefundRepository,
  CreatePaymentDTO,
  CreateSubscriptionDTO,
  CreateRefundDTO,
  PaginationDTO
} from '../../infrastructure/repositories/IPaymentRepository.js';
import { IStripeClient, CheckoutSessionParams, SubscriptionParams, RefundParams } from '../../infrastructure/clients/IStripeClient.js';
import { IEnrollmentRepository, CreateEnrollmentDTO } from '../../../enrollments/infrastructure/repositories/IEnrollmentRepository.js';
import { ICourseRepository } from '../../../courses/infrastructure/repositories/ICourseRepository.js';
import { IUserRepository } from '../../../users/infrastructure/repositories/IUserRepository.js';
import { INotificationService } from '../../../notifications/application/services/INotificationService.js';

/**
 * Payment Service Implementation
 * 
 * Orchestrates payment operations between domain entities, repositories,
 * and external services. Handles complex business workflows and ensures
 * data consistency across payment, enrollment, and notification systems.
 */
export class PaymentService implements IPaymentService {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly subscriptionRepository: ISubscriptionRepository,
    private readonly refundRepository: IRefundRepository,
    private readonly enrollmentRepository: IEnrollmentRepository,
    private readonly courseRepository: ICourseRepository,
    private readonly userRepository: IUserRepository,
    private readonly stripeClient: IStripeClient,
    private readonly notificationService?: INotificationService
  ) {}

  /**
   * Creates a Stripe checkout session for course purchase
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    try {
      logger.info('Creating checkout session', { 
        courseId: params.courseId, 
        studentId: params.studentId 
      });

      // Validate input parameters
      this.validateCheckoutSessionParams(params);

      // Check if student exists
      const student = await this.userRepository.findById(params.studentId);
      if (!student) {
        throw new NotFoundError('Student not found');
      }

      // Check if course exists and is published
      const course = await this.courseRepository.findById(params.courseId);
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      if (course.status !== 'published') {
        throw new ValidationError('Course is not available for purchase');
      }

      // Check if student is already enrolled
      const existingEnrollment = await this.enrollmentRepository.findByStudentAndCourse(
        params.studentId,
        params.courseId
      );
      if (existingEnrollment) {
        throw new ConflictError('Student is already enrolled in this course');
      }

      // Create payment record
      const paymentData: CreatePaymentDTO = {
        userId: params.studentId,
        courseId: params.courseId,
        amount: course.price,
        currency: course.currency || 'USD',
        metadata: {
          courseTitle: course.title,
          studentEmail: student.email,
          ...params.metadata
        }
      };

      const payment = await this.paymentRepository.create(paymentData);

      // Create Stripe checkout session
      const checkoutParams: CheckoutSessionParams = {
        courseId: params.courseId,
        courseName: course.title,
        coursePrice: Math.round(parseFloat(course.price) * 100), // Convert to cents
        currency: course.currency || 'USD',
        customerEmail: student.email,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        metadata: {
          paymentId: payment.id,
          courseId: params.courseId,
          studentId: params.studentId,
          ...params.metadata
        }
      };

      const stripeSession = await this.stripeClient.createCheckoutSession(checkoutParams);

      // Update payment with Stripe session ID
      await this.paymentRepository.update(payment.id, {
        stripeCheckoutSessionId: stripeSession.id
      });

      logger.info('Checkout session created successfully', {
        paymentId: payment.id,
        sessionId: stripeSession.id
      });

      return {
        sessionId: stripeSession.id,
        sessionUrl: stripeSession.url!,
        paymentId: payment.id
      };

    } catch (error) {
      logger.error('Failed to create checkout session', { 
        error: error instanceof Error ? error.message : String(error),
        courseId: params.courseId,
        studentId: params.studentId
      });

      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }

      throw new ExternalServiceError('Stripe', 'Failed to create checkout session', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handles Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      logger.info('Processing webhook event', { 
        type: event.type, 
        id: event.id 
      });

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'charge.dispute.created':
          await this.handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
          break;

        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      logger.info('Webhook event processed successfully', { 
        type: event.type, 
        id: event.id 
      });

    } catch (error) {
      logger.error('Failed to process webhook event', {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type,
        eventId: event.id
      });
      throw new ExternalServiceError('Stripe', 'Failed to process webhook event', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Processes a refund for an enrollment
   */
  async processRefund(params: ProcessRefundParams): Promise<Refund> {
    try {
      logger.info('Processing refund', { 
        enrollmentId: params.enrollmentId,
        reason: params.reason
      });

      // Validate refund eligibility
      const eligibility = await this.validateRefundEligibility(params.enrollmentId);
      if (!eligibility.eligible) {
        throw new ConflictError(`Refund not allowed: ${eligibility.reason}`);
      }

      // Get enrollment and payment details
      const enrollment = await this.enrollmentRepository.findById(params.enrollmentId);
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      if (!enrollment.paymentId) {
        throw new ValidationError('No payment associated with this enrollment');
      }

      const payment = await this.paymentRepository.findById(enrollment.paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      if (!payment.stripePaymentIntentId) {
        throw new ValidationError('No Stripe payment intent found for this payment');
      }

      // Calculate refund amount
      const refundAmount = params.amount || eligibility.maxRefundAmount || payment.amount;
      
      if (parseFloat(refundAmount) > parseFloat(payment.amount)) {
        throw new ValidationError('Refund amount cannot exceed original payment amount');
      }

      // Process refund with Stripe
      const refundParams: RefundParams = {
        paymentIntentId: payment.stripePaymentIntentId,
        amount: Math.round(parseFloat(refundAmount) * 100), // Convert to cents
        reason: params.reason
      };

      const stripeRefund = await this.stripeClient.createRefund(refundParams);

      // Create refund record
      const refundData: CreateRefundDTO = {
        paymentId: payment.id,
        enrollmentId: params.enrollmentId,
        stripeRefundId: stripeRefund.id,
        amount: refundAmount,
        reason: params.reason,
        status: stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending'
      };

      const refund = await this.refundRepository.create(refundData);

      // Update payment status if fully refunded
      if (parseFloat(refundAmount) === parseFloat(payment.amount)) {
        await this.paymentRepository.update(payment.id, { status: 'refunded' });
      }

      // Update enrollment status
      await this.enrollmentRepository.update(params.enrollmentId, { 
        status: 'dropped'
      });

      // Send notification
      if (this.notificationService) {
        await this.notificationService.createNotification({
          recipientId: enrollment.studentId,
          notificationType: 'refund_processed' as any,
          title: 'Refund Processed',
          content: `Your refund of $${refundAmount} has been processed and will appear in your account within 5-10 business days.`,
          metadata: {
            refundId: refund.id,
            amount: refundAmount,
            enrollmentId: params.enrollmentId
          }
        });
      }

      logger.info('Refund processed successfully', {
        refundId: refund.id,
        amount: refundAmount,
        enrollmentId: params.enrollmentId
      });

      return Refund.fromData({
        id: refund.id,
        paymentId: refund.paymentId,
        enrollmentId: refund.enrollmentId,
        stripeRefundId: refund.stripeRefundId,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
      });

    } catch (error) {
      logger.error('Failed to process refund', {
        error: error instanceof Error ? error.message : String(error),
        enrollmentId: params.enrollmentId
      });

      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }

      throw new ExternalServiceError('Stripe', 'Failed to process refund', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Creates a subscription for a user
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription> {
    try {
      logger.info('Creating subscription', { 
        userId: params.userId,
        planId: params.planId
      });

      // Validate user exists
      const user = await this.userRepository.findById(params.userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Create or get Stripe customer
      const customer = await this.stripeClient.createOrUpdateCustomer(
        user.email,
        undefined, // We'll get the full name from user profile if needed
        { userId: params.userId }
      );

      // Create Stripe subscription
      const subscriptionParams: SubscriptionParams = {
        customerId: customer.id,
        priceId: params.planId,
        metadata: {
          userId: params.userId,
          ...params.metadata
        }
      };

      const stripeSubscription = await this.stripeClient.createSubscription(subscriptionParams);

      // Create subscription record
      const subscriptionData: CreateSubscriptionDTO = {
        userId: params.userId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customer.id,
        planId: params.planId,
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      };

      const subscription = await this.subscriptionRepository.create(subscriptionData);

      logger.info('Subscription created successfully', {
        subscriptionId: subscription.id,
        stripeSubscriptionId: stripeSubscription.id
      });

      return Subscription.fromData({
        id: subscription.id,
        userId: subscription.userId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      });

    } catch (error) {
      logger.error('Failed to create subscription', {
        error: error instanceof Error ? error.message : String(error),
        userId: params.userId,
        planId: params.planId
      });

      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError('Stripe', 'Failed to create subscription', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Cancels a subscription
   */
  async cancelSubscription(params: CancelSubscriptionParams): Promise<Subscription> {
    try {
      logger.info('Canceling subscription', { 
        subscriptionId: params.subscriptionId
      });

      // Find subscription
      const subscription = await this.subscriptionRepository.findById(params.subscriptionId);
      if (!subscription) {
        throw new NotFoundError('Subscription not found');
      }

      // Cancel with Stripe
      const stripeSubscription = await this.stripeClient.cancelSubscription(subscription.stripeSubscriptionId);

      // Update subscription record
      const updatedSubscription = await this.subscriptionRepository.update(subscription.id, {
        status: stripeSubscription.status as any,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      });

      // Send notification
      if (this.notificationService) {
        await this.notificationService.createNotification({
          recipientId: subscription.userId,
          notificationType: 'subscription_canceled' as any,
          title: 'Subscription Canceled',
          content: params.cancelAtPeriodEnd 
            ? 'Your subscription will be canceled at the end of the current billing period.'
            : 'Your subscription has been canceled immediately.',
          metadata: {
            subscriptionId: params.subscriptionId,
            reason: params.reason
          }
        });
      }

      logger.info('Subscription canceled successfully', {
        subscriptionId: params.subscriptionId
      });

      return Subscription.fromData({
        id: updatedSubscription.id,
        userId: updatedSubscription.userId,
        stripeSubscriptionId: updatedSubscription.stripeSubscriptionId,
        stripeCustomerId: updatedSubscription.stripeCustomerId,
        planId: updatedSubscription.planId,
        status: updatedSubscription.status,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        createdAt: updatedSubscription.createdAt,
        updatedAt: updatedSubscription.updatedAt
      });

    } catch (error) {
      logger.error('Failed to cancel subscription', {
        error: error instanceof Error ? error.message : String(error),
        subscriptionId: params.subscriptionId
      });

      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new ExternalServiceError('Stripe', 'Failed to cancel subscription', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Gets payment history for a user
   */
  async getPaymentHistory(userId: string, page: number, limit: number) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (page < 1 || limit < 1 || limit > 100) {
        throw new ValidationError('Invalid pagination parameters');
      }

      const pagination: PaginationDTO = { page, limit };
      const result = await this.paymentRepository.getPaymentHistory(userId, pagination);

      return {
        payments: result.data.map(payment => Payment.fromData({
          id: payment.id,
          userId: payment.userId,
          courseId: payment.courseId,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.paymentMethod,
          metadata: payment.metadata as Record<string, any>,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to get payment history', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      throw new DatabaseError('Failed to retrieve payment history', 'getPaymentHistory', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Gets subscription details for a user
   */
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const subscriptions = await this.subscriptionRepository.findByUserId(userId);

      return subscriptions.map(subscription => Subscription.fromData({
        id: subscription.id,
        userId: subscription.userId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }));

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to get user subscriptions', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      throw new DatabaseError('Failed to retrieve user subscriptions', 'getUserSubscriptions', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Validates refund eligibility for an enrollment
   */
  async validateRefundEligibility(enrollmentId: string) {
    const enrollment = await this.enrollmentRepository.findById(enrollmentId);
    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    if (!enrollment.paymentId) {
      return {
        eligible: false,
        reason: 'No payment associated with this enrollment',
        refundPolicy: DEFAULT_REFUND_POLICY
      };
    }

    const payment = await this.paymentRepository.findById(enrollment.paymentId);
    if (!payment || payment.status !== 'succeeded') {
      return {
        eligible: false,
        reason: 'Payment not found or not successful',
        refundPolicy: DEFAULT_REFUND_POLICY
      };
    }

    // Check if already refunded
    const existingRefunds = await this.refundRepository.findByPaymentId(payment.id);
    const totalRefunded = existingRefunds.reduce((sum, refund) => 
      sum + parseFloat(refund.amount), 0
    );

    if (totalRefunded >= parseFloat(payment.amount)) {
      return {
        eligible: false,
        reason: 'Payment has already been fully refunded',
        refundPolicy: DEFAULT_REFUND_POLICY
      };
    }

    // Calculate days since enrollment
    const daysSinceEnrollment = Math.floor(
      (Date.now() - enrollment.enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const policy = DEFAULT_REFUND_POLICY;
    const remainingAmount = (parseFloat(payment.amount) - totalRefunded).toFixed(2);

    if (daysSinceEnrollment <= policy.fullRefundDays) {
      return {
        eligible: true,
        maxRefundAmount: remainingAmount,
        refundPolicy: policy
      };
    }

    // After full refund period, calculate based on content consumption
    // For now, assume 50% refund as minimum (this would be calculated based on actual progress)
    const minimumRefundAmount = (parseFloat(remainingAmount) * (policy.minimumRefundPercentage / 100)).toFixed(2);
    
    return {
      eligible: true,
      maxRefundAmount: minimumRefundAmount,
      refundPolicy: policy
    };
  }

  /**
   * Retries failed payment processing
   */
  async retryFailedPayment(paymentId: string): Promise<Payment> {
    try {
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment not found');
      }

      if (payment.status !== 'failed') {
        throw new ConflictError('Only failed payments can be retried');
      }

      // Reset payment status to pending
      const updatedPayment = await this.paymentRepository.update(paymentId, {
        status: 'pending'
      });

      logger.info('Payment retry initiated', { paymentId });

      return Payment.fromData({
        id: updatedPayment.id,
        userId: updatedPayment.userId,
        courseId: updatedPayment.courseId,
        stripePaymentIntentId: updatedPayment.stripePaymentIntentId,
        stripeCheckoutSessionId: updatedPayment.stripeCheckoutSessionId,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        status: updatedPayment.status,
        paymentMethod: updatedPayment.paymentMethod,
        metadata: updatedPayment.metadata as Record<string, any>,
        createdAt: updatedPayment.createdAt,
        updatedAt: updatedPayment.updatedAt
      });

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }

      logger.error('Failed to retry payment', {
        error: error instanceof Error ? error.message : String(error),
        paymentId
      });

      throw new DatabaseError('Failed to retry payment', 'retryFailedPayment', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Private helper methods

  private validateCheckoutSessionParams(params: CreateCheckoutSessionParams): void {
    if (!params.courseId) {
      throw new ValidationError('Course ID is required');
    }

    if (!params.studentId) {
      throw new ValidationError('Student ID is required');
    }

    if (!params.successUrl) {
      throw new ValidationError('Success URL is required');
    }

    if (!params.cancelUrl) {
      throw new ValidationError('Cancel URL is required');
    }

    // Validate URL format
    try {
      new URL(params.successUrl);
      new URL(params.cancelUrl);
    } catch {
      throw new ValidationError('Invalid URL format for success or cancel URL');
    }
  }

  // Webhook event handlers

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const paymentId = session.metadata?.['paymentId'];
    if (!paymentId) {
      logger.warn('No payment ID in checkout session metadata', { sessionId: session.id });
      return;
    }

    const payment = await this.paymentRepository.findById(paymentId);
    if (!payment) {
      logger.error('Payment not found for checkout session', { paymentId, sessionId: session.id });
      return;
    }

    // Update payment with session details
    await this.paymentRepository.update(paymentId, {
      stripeCheckoutSessionId: session.id,
      paymentMethod: session.payment_method_types?.[0]
    });

    // Create enrollment if payment is for a course
    if (payment.courseId) {
      const enrollmentData: CreateEnrollmentDTO = {
        studentId: payment.userId,
        courseId: payment.courseId,
        paymentId: payment.id,
        status: 'active'
      };

      await this.enrollmentRepository.create(enrollmentData);

      logger.info('Enrollment created for successful payment', {
        paymentId,
        courseId: payment.courseId,
        studentId: payment.userId
      });
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);
    if (!payment) {
      logger.warn('Payment not found for payment intent', { paymentIntentId: paymentIntent.id });
      return;
    }

    await this.paymentRepository.update(payment.id, {
      status: 'succeeded',
      paymentMethod: paymentIntent.payment_method_types?.[0]
    });

    // Send success notification
    if (this.notificationService) {
      await this.notificationService.createNotification({
        recipientId: payment.userId,
        notificationType: 'payment_succeeded' as any,
        title: 'Payment Successful',
        content: `Your payment of $${payment.amount} has been processed successfully.`,
        metadata: {
          paymentId: payment.id,
          amount: payment.amount
        }
      });
    }

    logger.info('Payment marked as succeeded', { paymentId: payment.id });
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntent.id);
    if (!payment) {
      logger.warn('Payment not found for payment intent', { paymentIntentId: paymentIntent.id });
      return;
    }

    const failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';

    await this.paymentRepository.update(payment.id, {
      status: 'failed',
      metadata: {
        ...payment.metadata as Record<string, any>,
        failureReason
      }
    });

    // Send failure notification
    if (this.notificationService) {
      await this.notificationService.createNotification({
        recipientId: payment.userId,
        notificationType: 'payment_failed' as any,
        title: 'Payment Failed',
        content: `Your payment of $${payment.amount} could not be processed. Please try again or contact support.`,
        metadata: {
          paymentId: payment.id,
          amount: payment.amount,
          reason: failureReason
        }
      });
    }

    logger.info('Payment marked as failed', { 
      paymentId: payment.id, 
      reason: failureReason 
    });
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await this.subscriptionRepository.findByStripeSubscriptionId(invoice.subscription as string);
    if (!subscription) {
      logger.warn('Subscription not found for invoice', { subscriptionId: invoice.subscription });
      return;
    }

    // Update subscription period
    // Note: In a real implementation, you'd fetch the subscription details from Stripe
    // This is simplified for the example

    logger.info('Invoice payment succeeded', { 
      subscriptionId: subscription.id,
      invoiceId: invoice.id 
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription) return;

    const subscription = await this.subscriptionRepository.findByStripeSubscriptionId(invoice.subscription as string);
    if (!subscription) {
      logger.warn('Subscription not found for invoice', { subscriptionId: invoice.subscription });
      return;
    }

    // Send payment failure notification
    if (this.notificationService) {
      await this.notificationService.createNotification({
        recipientId: subscription.userId,
        notificationType: 'subscription_payment_failed' as any,
        title: 'Subscription Payment Failed',
        content: 'Your subscription payment could not be processed. Please update your payment method.',
        metadata: {
          subscriptionId: subscription.id,
          invoiceId: invoice.id
        }
      });
    }

    logger.info('Invoice payment failed', { 
      subscriptionId: subscription.id,
      invoiceId: invoice.id 
    });
  }

  private async handleSubscriptionCreated(stripeSubscription: Stripe.Subscription): Promise<void> {
    // This is typically handled by the createSubscription method
    // But we can log it for audit purposes
    logger.info('Subscription created in Stripe', { 
      stripeSubscriptionId: stripeSubscription.id 
    });
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      logger.warn('Subscription not found for update', { stripeSubscriptionId: stripeSubscription.id });
      return;
    }

    await this.subscriptionRepository.update(subscription.id, {
      status: stripeSubscription.status as any,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
    });

    logger.info('Subscription updated', { subscriptionId: subscription.id });
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      logger.warn('Subscription not found for deletion', { stripeSubscriptionId: stripeSubscription.id });
      return;
    }

    await this.subscriptionRepository.update(subscription.id, {
      status: 'canceled'
    });

    logger.info('Subscription deleted', { subscriptionId: subscription.id });
  }

  private async handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    // Handle chargeback/dispute
    logger.warn('Charge dispute created', { 
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason
    });

    // In a real implementation, you might want to:
    // 1. Find the related payment
    // 2. Update payment status
    // 3. Notify relevant parties
    // 4. Create a dispute record for tracking
  }
}