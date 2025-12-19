/**
 * Error Handling Link
 * 
 * Apollo Link that provides comprehensive error handling with user-friendly
 * messages, error classification, and integration with error tracking services.
 * 
 * This link integrates with the comprehensive error handling system.
 */

import { onError, ErrorResponse } from '@apollo/client/link/error';
import { ServerError } from '@apollo/client';
import { errorHandler } from '../../errors';
import type { ClassifiedError, ErrorType } from '../../../types';

// The error handling logic is now handled by the comprehensive error handling system
// imported from '../../errors'

/**
 * Creates the error handling link
 */
export function createErrorLink() {
  return onError(({ graphQLErrors, networkError, operation }) => {
    const operationName = operation.operationName;
    const variables = operation.variables;

    const context = {
      operation: operationName,
      variables,
      requestId: `gql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Handle GraphQL errors using the new error handling system
    if (graphQLErrors) {
      graphQLErrors.forEach(async (error) => {
        await errorHandler.handleGraphQLError(error, context);
      });
    }

    // Handle network errors using the new error handling system
    if (networkError) {
      errorHandler.handleNetworkError(networkError as ServerError, undefined, context);
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
      const classified = errorHandler['errorClassifier'].classifyGraphQLError(error);
      return classified.retryable;
    });
  },

  /**
   * Gets the most severe error from a list of errors
   */
  getMostSevereError: (errors: { message: string; extensions?: { code?: string; field?: string } }[]): ClassifiedError => {
    // Find the most severe error by classification
    let mostSevere: ClassifiedError | null = null;
    
    for (const error of errors) {
      const classified = errorHandler['errorClassifier'].classifyGraphQLError(error);
      
      if (!mostSevere || this.compareSeverity(classified.severity, mostSevere.severity) > 0) {
        mostSevere = classified;
      }
    }

    return mostSevere || {
      type: 'UNKNOWN_ERROR' as ErrorType,
      code: 'UNKNOWN',
      message: 'Unknown error occurred',
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