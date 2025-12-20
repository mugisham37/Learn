/**
 * Authentication Link
 * 
 * Apollo Link that automatically injects JWT tokens into GraphQL requests
 * and handles token refresh on authentication errors.
 */

import { setContext } from '@apollo/client/link/context';
import { onError, ErrorResponse } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { tokenManager } from '../../auth/tokenStorage';

// Token manager is now imported from the auth module

/**
 * Creates the authentication link that injects JWT tokens
 */
export function createAuthLink() {
  return setContext(async (_, { headers }) => {
    let accessToken = tokenManager.getAccessToken();

    // Check if token needs refresh
    if (accessToken && tokenManager.isTokenExpired(accessToken)) {
      try {
        accessToken = await tokenManager.refreshAccessToken();
      } catch (error) {
        console.warn('Token refresh failed, proceeding without token:', error);
        accessToken = null;
      }
    }

    // Return headers with authorization if token is available
    return {
      headers: {
        ...headers,
        ...(accessToken && {
          authorization: `Bearer ${accessToken}`,
        }),
      },
    };
  });
}

/**
 * Creates an error link that handles authentication errors
 */
export function createAuthErrorLink() {
  return onError((errorResponse: ErrorResponse) => {
    const { graphQLErrors, networkError, operation, forward } = errorResponse;
    
    // Handle GraphQL authentication errors
    if (graphQLErrors) {
      for (const error of graphQLErrors) {
        if (error.extensions?.code === 'UNAUTHENTICATED') {
          // Try to refresh token and retry the operation
          return new Observable(observer => {
            tokenManager.refreshAccessToken()
              .then((newToken) => {
                // Update the operation context with new token
                operation.setContext(({ headers = {} }) => ({
                  headers: {
                    ...headers,
                    authorization: `Bearer ${newToken}`,
                  },
                }));
                
                // Retry the operation with new token
                const subscription = forward(operation).subscribe(observer);
                return subscription;
              })
              .catch((refreshError) => {
                // Refresh failed, clear tokens and redirect to login
                tokenManager.clearTokens();
                
                // Emit authentication error event for app-level handling
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('auth:token-expired'));
                }
                
                observer.error(refreshError);
              });
          });
        }
      }
    }

    // Handle network authentication errors (401)
    if (networkError && 'statusCode' in networkError && networkError.statusCode === 401) {
      return new Observable(observer => {
        tokenManager.refreshAccessToken()
          .then((newToken) => {
            operation.setContext(({ headers = {} }) => ({
              headers: {
                ...headers,
                authorization: `Bearer ${newToken}`,
              },
            }));
            
            // Retry the operation with new token
            const subscription = forward(operation).subscribe(observer);
            return subscription;
          })
          .catch((refreshError) => {
            tokenManager.clearTokens();
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth:token-expired'));
            }
            
            observer.error(refreshError);
          });
      });
    }

    // If no authentication errors, let other error handlers deal with it
    return;
  });
}

/**
 * Export auth link creation functions
 */