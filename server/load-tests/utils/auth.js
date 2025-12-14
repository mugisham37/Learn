/**
 * Authentication Utilities for Load Tests
 */

import http from 'k6/http';
import { check } from 'k6';
import { GRAPHQL_URL, GRAPHQL_HEADERS, TEST_USERS } from './config.js';

/**
 * Login via GraphQL and return access token
 */
export function login(email, password) {
  const loginMutation = `
    mutation Login($email: String!, $password: String!) {
      login(email: $email, password: $password) {
        accessToken
        user {
          id
          email
          role
        }
      }
    }
  `;

  const payload = {
    query: loginMutation,
    variables: {
      email,
      password,
    },
  };

  const response = http.post(GRAPHQL_URL, JSON.stringify(payload), {
    headers: GRAPHQL_HEADERS,
  });

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'login returns token': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.login && data.data.login.accessToken;
      } catch (e) {
        return false;
      }
    },
  });

  if (success && response.status === 200) {
    try {
      const data = JSON.parse(response.body);
      return {
        token: data.data.login.accessToken,
        user: data.data.login.user,
      };
    } catch (e) {
      console.error('Failed to parse login response:', e);
      return null;
    }
  }

  return null;
}

/**
 * Register a new user via GraphQL
 */
export function register(email, password, fullName, role = 'student') {
  const registerMutation = `
    mutation Register($input: RegisterInput!) {
      register(input: $input) {
        accessToken
        user {
          id
          email
          role
        }
      }
    }
  `;

  const payload = {
    query: registerMutation,
    variables: {
      input: {
        email,
        password,
        fullName,
        role: role.toUpperCase(),
      },
    },
  };

  const response = http.post(GRAPHQL_URL, JSON.stringify(payload), {
    headers: GRAPHQL_HEADERS,
  });

  const success = check(response, {
    'registration successful': (r) => r.status === 200,
    'registration returns token': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.register && data.data.register.accessToken;
      } catch (e) {
        return false;
      }
    },
  });

  if (success && response.status === 200) {
    try {
      const data = JSON.parse(response.body);
      return {
        token: data.data.register.accessToken,
        user: data.data.register.user,
      };
    } catch (e) {
      console.error('Failed to parse registration response:', e);
      return null;
    }
  }

  return null;
}

/**
 * Get authenticated headers with JWT token
 */
export function getAuthHeaders(token) {
  return {
    ...GRAPHQL_HEADERS,
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Login as a test user and return auth context
 */
export function loginAsTestUser(userType = 'student') {
  const user = TEST_USERS[userType];
  if (!user) {
    throw new Error(`Unknown user type: ${userType}`);
  }

  return login(user.email, user.password);
}