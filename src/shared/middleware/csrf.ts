/**
 * CSRF Protection Middleware
 * 
 * Implements Cross-Site Request Forgery protection through multiple mechanisms:
 * - SameSite cookie attributes
 * - CSRF token generation and validation
 * - Custom header requirements for state-changing requests
 * - Origin and referer header verification
 * 
 * Requirements: 13.8
 */

import * as crypto from 'crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { config } from '../../config/index.js';
import { secureConfig } from '../utils/secureConfig.js';
import { AuthenticationError, ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

/**
 * CSRF token configuration
 */
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_CUSTOM_HEADER = 'x-requested-with';
const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * HTTP methods that require CSRF protection
 */
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Allowed origins for CSRF protection
 */
const ALLOWED_ORIGINS = config.cors.origin;

/**
 * Generates a cryptographically secure CSRF token
 * 
 * @returns Base64-encoded CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64url');
}

/**
 * Validates CSRF token by comparing with the token stored in cookie
 * 
 * @param providedToken - Token provided in request header
 * @param cookieToken - Token stored in cookie
 * @returns True if tokens match, false otherwise
 */
function validateCSRFToken(providedToken: string, cookieToken: string): boolean {
  if (!providedToken || !cookieToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(providedToken, 'base64url'),
    Buffer.from(cookieToken, 'base64url')
  );
}

/**
 * Validates origin header against allowed origins
 * 
 * @param origin - Origin header value
 * @returns True if origin is allowed, false otherwise
 */
function validateOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return false;
  }

  // Check if origin is in allowed origins list
  return ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*');
}

/**
 * Validates referer header against allowed origins
 * 
 * @param referer - Referer header value
 * @returns True if referer is from allowed origin, false otherwise
 */
function validateReferer(referer: string | undefined): boolean {
  if (!referer) {
    return false;
  }

  try {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    
    return ALLOWED_ORIGINS.includes(refererOrigin) || ALLOWED_ORIGINS.includes('*');
  } catch {
    return false;
  }
}

/**
 * CSRF protection middleware
 * 
 * Validates CSRF tokens and headers for state-changing requests.
 * Sets secure cookie attributes and validates origin/referer headers.
 * 
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @throws ValidationError if CSRF validation fails
 * 
 * Requirements: 13.8
 */
export async function csrfProtection(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id;
  const method = request.method;
  const origin = request.headers.origin;
  const referer = request.headers.referer;

  try {
    // Skip CSRF protection for safe methods (GET, HEAD, OPTIONS)
    if (!STATE_CHANGING_METHODS.includes(method)) {
      logger.debug(
        { requestId, method },
        'CSRF protection skipped for safe HTTP method'
      );
      return;
    }

    // Validate origin header
    if (!validateOrigin(origin)) {
      logger.warn(
        { requestId, method, origin, allowedOrigins: ALLOWED_ORIGINS },
        'CSRF protection failed: Invalid or missing origin header'
      );
      throw new ValidationError('Invalid or missing origin header');
    }

    // Validate referer header as additional protection
    if (!validateReferer(referer)) {
      logger.warn(
        { requestId, method, referer, allowedOrigins: ALLOWED_ORIGINS },
        'CSRF protection failed: Invalid or missing referer header'
      );
      throw new ValidationError('Invalid or missing referer header');
    }

    // Require custom header for state-changing requests
    const customHeader = request.headers[CSRF_CUSTOM_HEADER];
    if (!customHeader) {
      logger.warn(
        { requestId, method, requiredHeader: CSRF_CUSTOM_HEADER },
        'CSRF protection failed: Missing required custom header'
      );
      throw new ValidationError(`Missing required header: ${CSRF_CUSTOM_HEADER}`);
    }

    // Get CSRF token from header
    const providedToken = request.headers[CSRF_TOKEN_HEADER] as string;
    if (!providedToken) {
      logger.warn(
        { requestId, method, requiredHeader: CSRF_TOKEN_HEADER },
        'CSRF protection failed: Missing CSRF token header'
      );
      throw new ValidationError(`Missing required header: ${CSRF_TOKEN_HEADER}`);
    }

    // Get CSRF token from cookie
    const cookieToken = request.cookies[CSRF_COOKIE_NAME];
    if (!cookieToken) {
      logger.warn(
        { requestId, method, cookieName: CSRF_COOKIE_NAME },
        'CSRF protection failed: Missing CSRF token cookie'
      );
      throw new ValidationError('Missing CSRF token cookie');
    }

    // Validate CSRF token
    if (!validateCSRFToken(providedToken, cookieToken)) {
      logger.warn(
        { requestId, method },
        'CSRF protection failed: Invalid CSRF token'
      );
      throw new ValidationError('Invalid CSRF token');
    }

    logger.debug(
      { requestId, method, origin, referer },
      'CSRF protection validation successful'
    );
  } catch (error) {
    // If it's already a ValidationError, rethrow it
    if (error instanceof ValidationError) {
      throw error;
    }

    // Log unexpected errors
    logger.error(
      {
        requestId,
        method,
        origin,
        referer,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Unexpected error during CSRF protection'
    );

    // Throw generic validation error for unexpected errors
    throw new ValidationError('CSRF protection validation failed');
  }
}

/**
 * Sets CSRF token cookie with secure attributes
 * 
 * @param reply - Fastify reply object
 * @param token - CSRF token to set in cookie
 */
export function setCSRFTokenCookie(reply: FastifyReply, token: string): void {
  const isProduction = config.nodeEnv === 'production';

  reply.setCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // Only send over HTTPS in production
    sameSite: 'strict', // Strict SameSite policy for CSRF protection
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

/**
 * Endpoint to get CSRF token
 * This should be called by the frontend to obtain a CSRF token
 * 
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 * @returns CSRF token
 */
export async function getCSRFToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ csrfToken: string }> {
  const token = generateCSRFToken();
  
  // Set the token in a secure cookie
  setCSRFTokenCookie(reply, token);
  
  logger.debug(
    { requestId: request.id },
    'CSRF token generated and set in cookie'
  );

  // Return the token so frontend can include it in headers
  return { csrfToken: token };
}

/**
 * Registers CSRF protection plugin with Fastify
 * 
 * @param fastify - Fastify instance
 */
export async function registerCSRFProtection(fastify: FastifyInstance): Promise<void> {
  // Register cookie plugin for cookie parsing
  const cookiePlugin = await import('@fastify/cookie');
  await fastify.register(cookiePlugin.default, {
    secret: secureConfig.getSessionSecret(),
  });

  // Add CSRF token endpoint
  fastify.get('/api/csrf-token', getCSRFToken);

  // Add CSRF protection hook for all routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip CSRF protection for the CSRF token endpoint itself
    if (request.url === '/api/csrf-token') {
      return;
    }

    // Skip CSRF protection for health check endpoints
    if (request.url.startsWith('/health')) {
      return;
    }

    // Apply CSRF protection
    await csrfProtection(request, reply);
  });

  logger.info('CSRF protection registered successfully');
}

/**
 * Middleware factory for applying CSRF protection to specific routes
 * 
 * @returns Fastify preHandler middleware function
 */
export function requireCSRFProtection() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await csrfProtection(request, reply);
  };
}
