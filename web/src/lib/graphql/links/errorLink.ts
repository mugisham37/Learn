/**
 * Error Handling Link
 * 
 * Apollo Link that provides comprehensive error handling with user-friendly
 * messages, error classification, and integration with error tracking services.
 * 
 * This link integrates with the comprehensive error handling system.
 */

import { onError } from '@apollo/client/link/error';
import { ServerError } from '@apollo/client';
import { errorHandler } from '../../errors';
import type { ClassifiedError, ErrorType } from '../../../types';

// The error handling logic is now handled by the comprehensive error handling system
// imported from '../../errors'

/**
 * Creates the error handling link
 */
export function createErrorLink() {
  return onError((errorContext) => {
    // Type assertion to work around Apollo Client v4 type issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { graphQLErrors, networkError, operation } = errorContext as any;
    
    const operationName = operation.operationName;
    const variables = operation.variables;

    const context = {
      operation: operationName || 'unknown',
      variables,
      requestId: `gql_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    // Handle GraphQL errors using the new error handling system
    if (graphQLErrors) {
      graphQLErrors.forEach(async (error: { message: string; extensions?: { code?: string; field?: string } }) => {
        await errorHandler.handleGraphQLError(error, context);
      });
    }

    // Handle network errors using the new error handling system
    if (networkError) {
      const networkErrorWithDetails = {
        ...networkError,
        statusCode: (networkError as ServerError).statusCode,
        response: (networkError as ServerError).response ? 
          JSON.parse(JSON.stringify((networkError as ServerError).response)) : 
          undefined,
      };
      errorHandler.handleNetworkError(networkErrorWithDetails, undefined, context);
    }
  });
}

/**
 * Utility functions for error handling
 * These now delegate to the comprehensive error handling system
 */
export const errorUtils = {
  /**
   * Extracts field-specific errors from GraphQL errors
   */
  extractFieldErrors: (errors: { message: string; extensions?: { code?: string; field?: string } }[]): Record<string, string> => {
    return errorHandler.extractFieldErrors(errors);
  },

  /**
   * Checks if any errors are retryable
   */
  hasRetryableErrors: (errors: { message: string; extensions?: { code?: string } }[]): boolean => {
    return errors.some((error) => {
      // Simple retryable check based on error codes
      const code = error.extensions?.code;
      return code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'RATE_LIMITED';
    });
  },

  /**
   * Gets the most severe error from a list of errors
   */
  getMostSevereError: (errors: { message: string; extensions?: { code?: string; field?: string } }[]): ClassifiedError => {
    // Return the first error as a classified error
    const firstError = errors[0];
    if (!firstError) {
      return {
        type: 'UNKNOWN_ERROR' as ErrorType,
        code: 'UNKNOWN',
        message: 'Unknown error occurred',
        userMessage: 'Something went wrong. Please try again.',
        retryable: false,
      } as ClassifiedError;
    }

    return {
      type: 'UNKNOWN_ERROR' as ErrorType,
      code: firstError.extensions?.code || 'UNKNOWN',
      message: firstError.message,
      userMessage: 'Something went wrong. Please try again.',
      retryable: false,
    } as ClassifiedError;
  },

  /**
   * Compares error severity levels
   */
  compareSeverity: (a: string, b: string): number => {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    return severityOrder.indexOf(a) - severityOrder.indexOf(b);
  },
};