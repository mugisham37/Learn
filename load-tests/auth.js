/**
 * Authentication Load Test
 * 
 * Tests login, registration, and token refresh endpoints
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { GRAPHQL_URL, GRAPHQL_HEADERS, TEST_USERS } from './utils/config.js';
import { login, register, getAuthHeaders } from './utils/auth.js';
import { generateRandomEmail, generateRandomString } from './utils/config.js';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const registrationSuccessRate = new Rate('registration_success_rate');
const authLatency = new Trend('auth_latency');

export const options = {
  scenarios: {
    login_load: {
      executor: 'ramping-vus',
      exec: 'loginScenario',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
    registration_load: {
      executor: 'ramping-vus',
      exec: 'registrationScenario',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.05'],
    'login_success_rate': ['rate>0.95'],
    'registration_success_rate': ['rate>0.90'],
    'auth_latency': ['p(95)<1500'],
  },
};

/**
 * Login scenario - tests existing user authentication
 */
export function loginScenario() {
  const startTime = Date.now();
  
  // Use test student credentials
  const authResult = login(TEST_USERS.student.email, TEST_USERS.student.password);
  
  const latency = Date.now() - startTime;
  authLatency.add(latency);
  
  const success = authResult && authResult.token;
  loginSuccessRate.add(success);
  
  if (success) {
    // Test authenticated request
    const meQuery = `
      query Me {
        me {
          id
          email
          role
          profile {
            fullName
          }
        }
      }
    `;
    
    const response = http.post(GRAPHQL_URL, JSON.stringify({ query: meQuery }), {
      headers: getAuthHeaders(authResult.token),
    });
    
    check(response, {
      'authenticated request successful': (r) => r.status === 200,
      'me query returns user data': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data.data && data.data.me && data.data.me.id;
        } catch (e) {
          return false;
        }
      },
    });
  }
  
  sleep(1);
}

/**
 * Registration scenario - tests new user creation
 */
export function registrationScenario() {
  const startTime = Date.now();
  
  const email = generateRandomEmail();
  const password = 'TestPassword123!';
  const fullName = `Test User ${generateRandomString(5)}`;
  
  const authResult = register(email, password, fullName, 'student');
  
  const latency = Date.now() - startTime;
  authLatency.add(latency);
  
  const success = authResult && authResult.token;
  registrationSuccessRate.add(success);
  
  if (success) {
    // Test immediate login after registration
    const loginResult = login(email, password);
    
    check(loginResult, {
      'login after registration successful': (result) => result && result.token,
    });
  }
  
  sleep(2);
}

/**
 * Mixed authentication scenario
 */
export default function() {
  const scenario = Math.random();
  
  if (scenario < 0.7) {
    // 70% login attempts
    loginScenario();
  } else {
    // 30% registration attempts
    registrationScenario();
  }
}