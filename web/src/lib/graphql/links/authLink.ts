/**
 * Authentication Link
 *
 * Apollo Link that automatically injects JWT tokens into GraphQL requests
 * and handles token refresh on authentication errors with backend integration.
 */

import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { Observable } from '@apollo/client/utilities';
import { tokenManager } from '../../auth/tokenStorage';

/**
 * Creates the authentication link that injects JWT tokens
 * Handles both development (localStorage) and production (httpOnly cookies) modes
 */
export function createAuthLink() {
  return setContext(async (_, { headers }) => {
    let accessToken = tokenManager.getAccessToken();

    // In development, handle token refresh if needed
    if (process.env.NODE_ENV !== 'production') {
      // Check if token needs refresh
      if (accessToken && tokenManager.isTokenExpired(accessToken)) {
        try {
          accessToken = await tokenManager.refreshAccessToken();
        } catch (error) {
          console.warn('Token refresh failed, proceeding without token:', error);
          accessToken = null;
        }
      }
    }

    // Return headers with authorization if token is available
    // In production, tokens are handled via httpOnly cookies automatically
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
 * Creates an error link that handles authentication errors with backend integration
 */
export function createAuthErrorLink() {
  return onError(errorContext => {
    // Type assertion to work around Apollo Client v4 type issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { graphQLErrors, networkError, operation, forward } = errorContext as any;

    // Handle GraphQL authentication errors
    if (graphQLErrors) {
      for (const error of graphQLErrors) {
        if (error.extensions?.code === 'UNAUTHENTICATED') {
          // In production, cookies are handled automatically by the browser
          // In development, try to refresh token and retry the operation
          if (process.env.NODE_ENV !== 'production') {
            return new Observable(observer => {
              tokenManager
                .refreshAccessToken()
                .then(newToken => {
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
                .catch(refreshError => {
                  // Refresh failed, clear tokens and redirect to login
                  tokenManager.clearTokens();

                  // Emit authentication error event for app-level handling
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:token-expired'));
                  }

                  observer.error(refreshError);
                });
            });
          } else {
            // In production, emit token expired event immediately
            // The server-side cookie handling will manage the refresh
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('auth:token-expired'));
            }
          }
        }
      }
    }

    // Handle network authentication errors (401)
    if (networkError && 'statusCode' in networkError && networkError.statusCode === 401) {
      // In development, try to refresh token
      if (process.env.NODE_ENV !== 'production') {
        return new Observable(observer => {
          tokenManager
            .refreshAccessToken()
            .then(newToken => {
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
            .catch(refreshError => {
              tokenManager.clearTokens();

              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:token-expired'));
              }

              observer.error(refreshError);
            });
        });
      } else {
        // In production, emit token expired event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:token-expired'));
        }
      }
    }

    // If no authentication errors, let other error handlers deal with it
    return;
  });
}

/**
 * Export auth link creation functions
 */
