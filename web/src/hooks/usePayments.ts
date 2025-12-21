/**
 * Payments Module Hooks
 * 
 * Comprehensive React hooks for payment processing, subscription management,
 * and refund workflows with Stripe integration.
 * 
 * Features:
 * - Stripe checkout session creation
 * - Payment history and transaction details
 * - Subscription management (create, cancel, view)
 * - Refund processing and eligibility checking
 * - Payment method management
 * - Invoice generation and downloads
 * 
 * Requirements: 2.1
 */

import { useQuery, useMutation, useLazyQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

// ============================================================================
// GraphQL Response Types (temporary until schema integration is complete)
// ============================================================================

interface GraphQLResponse<T = unknown> {
  [key: string]: T;
}

// ============================================================================
// GraphQL Operations
// ============================================================================

const CREATE_CHECKOUT_SESSION = gql`
  mutation CreateCheckoutSession($input: CreateCheckoutSessionInput!) {
    createCheckoutSession(input: $input) {
      sessionId
      sessionUrl
      paymentId
    }
  }
`;

const GET_PAYMENT_HISTORY = gql`
  query GetPaymentHistory($input: PaymentHistoryInput) {
    getPaymentHistory(input: $input) {
      payments {
        id
        userId
        courseId
        stripePaymentIntentId
        stripeCheckoutSessionId
        amount
        currency
        status
        paymentMethod
        metadata
        createdAt
        updatedAt
        course {
          id
          title
          thumbnailUrl
        }
        refunds {
          id
          amount
          reason
          status
          createdAt
        }
      }
      total
      page
      limit
      totalPages
    }
  }
`;

const GET_PAYMENT = gql`
  query GetPayment($id: ID!) {
    getPayment(id: $id) {
      id
      userId
      courseId
      stripePaymentIntentId
      stripeCheckoutSessionId
      amount
      currency
      status
      paymentMethod
      metadata
      createdAt
      updatedAt
      course {
        id
        title
        description
        thumbnailUrl
        instructor {
          id
          profile {
            fullName
          }
        }
      }
      refunds {
        id
        amount
        reason
        status
        createdAt
      }
    }
  }
`;

const GET_USER_SUBSCRIPTIONS = gql`
  query GetUserSubscriptions {
    getUserSubscriptions {
      id
      userId
      stripeSubscriptionId
      stripeCustomerId
      planId
      status
      currentPeriodStart
      currentPeriodEnd
      cancelAtPeriodEnd
      daysRemaining
      isActive
      isExpired
      createdAt
      updatedAt
    }
  }
`;

const GET_SUBSCRIPTION = gql`
  query GetSubscription($id: ID!) {
    getSubscription(id: $id) {
      id
      userId
      stripeSubscriptionId
      stripeCustomerId
      planId
      status
      currentPeriodStart
      currentPeriodEnd
      cancelAtPeriodEnd
      daysRemaining
      isActive
      isExpired
      createdAt
      updatedAt
    }
  }
`;

const CREATE_SUBSCRIPTION = gql`
  mutation CreateSubscription($input: CreateSubscriptionInput!) {
    createSubscription(input: $input) {
      id
      userId
      stripeSubscriptionId
      stripeCustomerId
      planId
      status
      currentPeriodStart
      currentPeriodEnd
      cancelAtPeriodEnd
      daysRemaining
      isActive
      isExpired
      createdAt
      updatedAt
    }
  }
`;

const CANCEL_SUBSCRIPTION = gql`
  mutation CancelSubscription($input: CancelSubscriptionInput!) {
    cancelSubscription(input: $input) {
      id
      userId
      stripeSubscriptionId
      stripeCustomerId
      planId
      status
      currentPeriodStart
      currentPeriodEnd
      cancelAtPeriodEnd
      daysRemaining
      isActive
      isExpired
      createdAt
      updatedAt
    }
  }
`;

const REQUEST_REFUND = gql`
  mutation RequestRefund($input: RequestRefundInput!) {
    requestRefund(input: $input) {
      id
      paymentId
      enrollmentId
      stripeRefundId
      amount
      reason
      status
      createdAt
      updatedAt
      payment {
        id
        amount
        currency
        course {
          id
          title
        }
      }
    }
  }
`;

const GET_REFUND_ELIGIBILITY = gql`
  query GetRefundEligibility($enrollmentId: ID!) {
    getRefundEligibility(enrollmentId: $enrollmentId) {
      eligible
      reason
      maxRefundAmount
      refundPolicy {
        fullRefundDays
        contentConsumptionThreshold
        minimumRefundPercentage
        administrativeFeePercentage
      }
    }
  }
`;

const GET_REFUND = gql`
  query GetRefund($id: ID!) {
    getRefund(id: $id) {
      id
      paymentId
      enrollmentId
      stripeRefundId
      amount
      reason
      status
      createdAt
      updatedAt
      payment {
        id
        amount
        currency
        course {
          id
          title
        }
      }
      enrollment {
        id
        course {
          id
          title
        }
      }
    }
  }
`;

// ============================================================================
// Type Definitions
// ============================================================================

export interface Payment {
  id: string;
  userId: string;
  courseId?: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    title: string;
    description?: string;
    thumbnailUrl?: string;
    instructor?: {
      id: string;
      profile: {
        fullName: string;
      };
    };
  };
  refunds: Refund[];
}

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planId: string;
  status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  enrollmentId?: string;
  stripeRefundId?: string;
  amount: number;
  reason?: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  payment?: {
    id: string;
    amount: number;
    currency: string;
    course?: {
      id: string;
      title: string;
    };
  };
  enrollment?: {
    id: string;
    course: {
      id: string;
      title: string;
    };
  };
}

export interface CheckoutSession {
  sessionId: string;
  sessionUrl: string;
  paymentId: string;
}

export interface PaymentHistory {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RefundEligibility {
  eligible: boolean;
  reason?: string;
  maxRefundAmount?: number;
  refundPolicy: {
    fullRefundDays: number;
    contentConsumptionThreshold: number;
    minimumRefundPercentage: number;
    administrativeFeePercentage: number;
  };
}

export interface CreateCheckoutSessionInput {
  courseId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionInput {
  planId: string;
  metadata?: Record<string, string>;
}

export interface CancelSubscriptionInput {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
  reason?: string;
}

export interface RequestRefundInput {
  enrollmentId: string;
  reason: string;
  amount?: string;
}

export interface PaymentHistoryInput {
  page?: number;
  limit?: number;
}

// ============================================================================
// Stripe Checkout Hook
// ============================================================================

/**
 * Hook for creating Stripe checkout sessions
 * 
 * @returns Object with createCheckoutSession function and state
 */
export function useStripeCheckout() {
  const { user } = useAuth();
  const [createCheckoutSessionMutation, { data, loading, error, reset }] = useMutation(
    CREATE_CHECKOUT_SESSION,
    {
      errorPolicy: 'all',
      onError: (error) => {
        console.error('Checkout session creation failed:', error);
      }
    }
  );

  const createCheckoutSession = useCallback(
    async (input: CreateCheckoutSessionInput): Promise<CheckoutSession> => {
      if (!user) {
        throw new Error('Authentication required');
      }

      try {
        const result = await createCheckoutSessionMutation({
          variables: { input },
        });

        if (result.error) {
          throw new Error(result.error.message || 'Failed to create checkout session');
        }

        return result.data?.createCheckoutSession as CheckoutSession;
      } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
      }
    },
    [createCheckoutSessionMutation, user]
  );

  return {
    createCheckoutSession,
    data: (data as GraphQLResponse)?.createCheckoutSession,
    loading,
    error,
    reset,
  };
}

// ============================================================================
// Payment History Hook
// ============================================================================

/**
 * Hook for fetching payment history with pagination
 * 
 * @param input - Pagination and filter options
 * @returns Query result with payment history
 */
export function usePaymentHistory(
  input: PaymentHistoryInput = { page: 1, limit: 20 }
) {
  const { user } = useAuth();
  const { data, loading, error, refetch, fetchMore } = useQuery(GET_PAYMENT_HISTORY, {
    variables: { input },
    skip: !user,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
  });

  const fetchMorePayments = useCallback(
    async (page: number) => {
      if (!fetchMore) return;

      try {
        await fetchMore({
          variables: {
            input: { ...input, page },
          },
          updateQuery: (prev, { fetchMoreResult }) => {
            if (!fetchMoreResult?.getPaymentHistory) return prev;

            const newPayments = fetchMoreResult.getPaymentHistory.payments;
            const existingPayments = prev?.getPaymentHistory?.payments || [];

            return {
              getPaymentHistory: {
                ...fetchMoreResult.getPaymentHistory,
                payments: page === 1 ? newPayments : [...existingPayments, ...newPayments],
              },
            };
          },
        });
      } catch (error) {
        console.error('Error fetching more payments:', error);
        throw error;
      }
    },
    [fetchMore, input]
  );

  return {
    data: (data as GraphQLResponse)?.getPaymentHistory,
    loading,
    error,
    refetch,
    fetchMore: fetchMorePayments,
  };
}

/**
 * Hook for fetching a specific payment by ID
 * 
 * @param paymentId - Payment ID to fetch
 * @returns Query result with payment details
 */
export function usePayment(paymentId: string) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(GET_PAYMENT, {
    variables: { id: paymentId },
    skip: !user || !paymentId,
    errorPolicy: 'all',
  });

  return {
    data: (data as GraphQLResponse)?.getPayment,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Subscription Management Hooks
// ============================================================================

/**
 * Hook for fetching user subscriptions
 * 
 * @returns Query result with user subscriptions
 */
export function useSubscriptionManagement() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(GET_USER_SUBSCRIPTIONS, {
    skip: !user,
    errorPolicy: 'all',
  });

  const [createSubscriptionMutation] = useMutation(CREATE_SUBSCRIPTION, {
    errorPolicy: 'all',
    update: (cache, { data }) => {
      if (data?.createSubscription) {
        // Update the cache with the new subscription
        const existingData = cache.readQuery({ query: GET_USER_SUBSCRIPTIONS });
        if (existingData) {
          cache.writeQuery({
            query: GET_USER_SUBSCRIPTIONS,
            data: {
              getUserSubscriptions: [
                ...(existingData as unknown as { getUserSubscriptions: Subscription[] }).getUserSubscriptions,
                data.createSubscription,
              ],
            },
          });
        }
      }
    },
  });

  const [cancelSubscriptionMutation] = useMutation(CANCEL_SUBSCRIPTION, {
    errorPolicy: 'all',
    update: (cache, { data }) => {
      if (data?.cancelSubscription) {
        // Update the subscription in cache
        const subscriptionId = cache.identify(data.cancelSubscription);
        if (subscriptionId) {
          cache.modify({
            id: subscriptionId,
            fields: {
              status: () => data.cancelSubscription.status,
              cancelAtPeriodEnd: () => data.cancelSubscription.cancelAtPeriodEnd,
              updatedAt: () => data.cancelSubscription.updatedAt,
            },
          });
        }
      }
    },
  });

  const createSubscription = useCallback(
    async (input: CreateSubscriptionInput): Promise<Subscription> => {
      if (!user) {
        throw new Error('Authentication required');
      }

      try {
        const result = await createSubscriptionMutation({
          variables: { input },
        });

        if (result.error) {
          throw new Error(result.error.message || 'Failed to create subscription');
        }

        return result.data?.createSubscription as Subscription;
      } catch (error) {
        console.error('Error creating subscription:', error);
        throw error;
      }
    },
    [createSubscriptionMutation, user]
  );

  const cancelSubscription = useCallback(
    async (input: CancelSubscriptionInput): Promise<Subscription> => {
      if (!user) {
        throw new Error('Authentication required');
      }

      try {
        const result = await cancelSubscriptionMutation({
          variables: { input },
        });

        if (result.error) {
          throw new Error(result.error.message || 'Failed to cancel subscription');
        }

        return result.data?.cancelSubscription as Subscription;
      } catch (error) {
        console.error('Error canceling subscription:', error);
        throw error;
      }
    },
    [cancelSubscriptionMutation, user]
  );

  return {
    data: (data as GraphQLResponse)?.getUserSubscriptions,
    loading,
    error,
    refetch,
    createSubscription,
    cancelSubscription,
  };
}

/**
 * Hook for fetching a specific subscription by ID
 * 
 * @param subscriptionId - Subscription ID to fetch
 * @returns Query result with subscription details
 */
export function useSubscription(subscriptionId: string) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(GET_SUBSCRIPTION, {
    variables: { id: subscriptionId },
    skip: !user || !subscriptionId,
    errorPolicy: 'all',
  });

  return {
    data: (data as GraphQLResponse)?.getSubscription,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Refund Processing Hooks
// ============================================================================

/**
 * Hook for processing refunds
 * 
 * @returns Object with refund processing functions and state
 */
export function useRefundProcessing() {
  const { user } = useAuth();
  const [requestRefundMutation, { data, loading, error, reset }] = useMutation(
    REQUEST_REFUND,
    {
      errorPolicy: 'all',
      onError: (error) => {
        console.error('Refund request failed:', error);
      }
    }
  );

  const [getRefundEligibility] = useLazyQuery(GET_REFUND_ELIGIBILITY, {
    errorPolicy: 'all',
  });

  const requestRefund = useCallback(
    async (input: RequestRefundInput): Promise<Refund> => {
      if (!user) {
        throw new Error('Authentication required');
      }

      try {
        const result = await requestRefundMutation({
          variables: { input },
        });

        if (result.error) {
          throw new Error(result.error.message || 'Failed to request refund');
        }

        return result.data?.requestRefund as Refund;
      } catch (error) {
        console.error('Error requesting refund:', error);
        throw error;
      }
    },
    [requestRefundMutation, user]
  );

  const checkRefundEligibility = useCallback(
    async (enrollmentId: string): Promise<RefundEligibility> => {
      if (!user) {
        throw new Error('Authentication required');
      }

      try {
        const result = await getRefundEligibility({
          variables: { enrollmentId },
        });

        if (result.error) {
          throw new Error(result.error.message || 'Failed to check refund eligibility');
        }

        return result.data?.getRefundEligibility as RefundEligibility;
      } catch (error) {
        console.error('Error checking refund eligibility:', error);
        throw error;
      }
    },
    [getRefundEligibility, user]
  );

  return {
    requestRefund,
    checkRefundEligibility,
    data: (data as GraphQLResponse)?.requestRefund,
    loading,
    error,
    reset,
  };
}

/**
 * Hook for fetching a specific refund by ID
 * 
 * @param refundId - Refund ID to fetch
 * @returns Query result with refund details
 */
export function useRefund(refundId: string) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useQuery(GET_REFUND, {
    variables: { id: refundId },
    skip: !user || !refundId,
    errorPolicy: 'all',
  });

  return {
    data: (data as GraphQLResponse)?.getRefund,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// Payment Method Management Hooks
// ============================================================================

/**
 * Hook for managing payment methods
 * Note: This would typically integrate with Stripe's Setup Intents API
 * For now, providing a placeholder structure
 * 
 * @returns Object with payment method management functions
 */
export function usePaymentMethods() {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Placeholder implementation - would integrate with Stripe Elements
  const addPaymentMethod = useCallback(async (paymentMethodData: unknown) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      // This would typically call a backend endpoint to save the payment method
      // For now, just simulate the operation
      console.log('Adding payment method:', paymentMethodData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local state
      const newMethod = {
        id: `pm_${Date.now()}`,
        type: (paymentMethodData as { type: string }).type,
        last4: (paymentMethodData as { last4: string }).last4,
        brand: (paymentMethodData as { brand: string }).brand,
        isDefault: paymentMethods.length === 0,
      };
      
      setPaymentMethods(prev => [...prev, newMethod]);
      return newMethod;
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, paymentMethods.length]);

  const removePaymentMethod = useCallback(async (paymentMethodId: string) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      // This would typically call a backend endpoint to remove the payment method
      console.log('Removing payment method:', paymentMethodId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      setPaymentMethods(prev => prev.filter((method: { id: string }) => method.id !== paymentMethodId));
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const setDefaultPaymentMethod = useCallback(async (paymentMethodId: string) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      // This would typically call a backend endpoint to set the default payment method
      console.log('Setting default payment method:', paymentMethodId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      setPaymentMethods(prev => 
        prev.map((method: { id: string; isDefault: boolean }) => ({
          ...method,
          isDefault: method.id === paymentMethodId
        }))
      );
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    paymentMethods,
    loading,
    error,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
  };
}

// ============================================================================
// Invoice Generation and Download Hooks
// ============================================================================

/**
 * Hook for generating and downloading invoices
 * Note: This would typically integrate with backend invoice generation
 * For now, providing a placeholder structure
 * 
 * @returns Object with invoice functions
 */
export function useInvoices() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateInvoice = useCallback(async (paymentId: string) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    setLoading(true);
    setError(null);

    try {
      // This would typically call a backend endpoint to generate an invoice
      console.log('Generating invoice for payment:', paymentId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Return invoice data
      return {
        id: `inv_${Date.now()}`,
        paymentId,
        invoiceNumber: `INV-${Date.now()}`,
        downloadUrl: `/api/invoices/inv_${Date.now()}/download`,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      setError(error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const downloadInvoice = useCallback(async (invoiceId: string) => {
    if (!user) {
      throw new Error('Authentication required');
    }

    try {
      // This would typically download the invoice file
      console.log('Downloading invoice:', invoiceId);
      
      // Simulate download
      const link = document.createElement('a');
      link.href = `/api/invoices/${invoiceId}/download`;
      link.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      throw error;
    }
  }, [user]);

  return {
    loading,
    error,
    generateInvoice,
    downloadInvoice,
  };
}

// ============================================================================
// Composite Hooks
// ============================================================================

/**
 * Main payments hook that combines all payment-related functionality
 * 
 * @returns Object with all payment hooks and utilities
 */
export function usePayments() {
  const checkout = useStripeCheckout();
  const paymentHistory = usePaymentHistory();
  const subscriptions = useSubscriptionManagement();
  const refunds = useRefundProcessing();
  const paymentMethods = usePaymentMethods();
  const invoices = useInvoices();

  return {
    // Checkout functionality
    checkout,
    
    // Payment history
    paymentHistory,
    
    // Subscription management
    subscriptions,
    
    // Refund processing
    refunds,
    
    // Payment methods
    paymentMethods,
    
    // Invoices
    invoices,
    
    // Utility functions
    utils: {
      formatCurrency: (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency.toUpperCase(),
        }).format(amount / 100); // Assuming amounts are in cents
      },
      
      formatPaymentStatus: (status: string) => {
        switch (status) {
          case 'PENDING':
            return 'Processing';
          case 'SUCCEEDED':
            return 'Completed';
          case 'FAILED':
            return 'Failed';
          case 'REFUNDED':
            return 'Refunded';
          default:
            return status;
        }
      },
      
      formatSubscriptionStatus: (status: string) => {
        switch (status) {
          case 'ACTIVE':
            return 'Active';
          case 'CANCELED':
            return 'Canceled';
          case 'PAST_DUE':
            return 'Past Due';
          case 'UNPAID':
            return 'Unpaid';
          default:
            return status;
        }
      },
    },
  };
}

// Export individual hooks for specific use cases