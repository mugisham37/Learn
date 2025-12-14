/**
 * Assessments Load Test
 * 
 * Tests quiz taking and assignment submission endpoints
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { GRAPHQL_URL } from './utils/config.js';
import { loginAsTestUser, getAuthHeaders } from './utils/auth.js';
import { getRandomElement, generateRandomString } from './utils/config.js';

// Custom metrics
const quizStartSuccessRate = new Rate('quiz_start_success_rate');
const quizSubmissionSuccessRate = new Rate('quiz_submission_success_rate');