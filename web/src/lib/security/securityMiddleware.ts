/**
 * Security Middleware
 * 
 * Comprehensive security middleware that integrates all security features
 * including CSRF protection, input validation, rate limiting, and security headers.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityConfig, SECURITY_CONSTANTS } from './securityConfig';
import { CSRFProtector } from './csrfProtection';
import { XSSProtector } from './xssProtection';
import type { SecurityEvent } from './securityTypes';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting configuration
 */
const RATE_LIMITS = {
  // General API requests
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  // Authentication requests
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  // File upload requests
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
  // GraphQL mutations
  mutation: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50,
  },
};

/**
 * Get client identifier for rate limiting
 */
function getClientId(request: NextRequest): string {
  // In production, use a combination of IP, user agent, and user ID
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Create a hash of IP + User Agent for privacy
  return btoa(`${ip}:${userAgent}`).slice(0, 32);
}

/**
 * Check rate limit for client
 */
function checkRateLimit(
  clientId: string, 
  endpoint: keyof typeof RATE_LIMITS
): { allowed: boolean; remaining: number; resetTime: number } {
  const config = RATE_LIMITS[endpoint];
  const now = Date.now();
  const key = `${clientId}:${endpoint}`;
  
  let entry = rateLimitStore.get(key);
  
  // Reset if window has passed
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Get security headers
 */
function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    ...SECURITY_CONSTANTS.SECURITY_HEADERS,
  };
  
  // Add Content Security Policy
  const csp = securityConfig.contentSecurityPolicy;
  if (csp && csp.directives) {
    const cspString = Object.entries(csp.directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
    
    if (csp.reportOnly) {
      headers['Content-Security-Policy-Report-Only'] = cspString;
    } else {
      headers['Content-Security-Policy'] = cspString;
    }
  }
  
  return headers;
}

/**
 * Validate request input
 */
async function validateRequestInput(request: NextRequest): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    // Check content type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers.get('content-type');
      
      if (!contentType) {
        errors.push('Content-Type header is required');
      } else if (!contentType.includes('application/json') && 
                 !contentType.includes('multipart/form-data') &&
                 !contentType.includes('application/x-www-form-urlencoded')) {
        errors.push('Invalid Content-Type');
      }
    }
    
    // Validate request size
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > SECURITY_CONSTANTS.MAX_CONTENT_LENGTH) {
        errors.push('Request body too large');
      }
    }
    
    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
    for (const header of suspiciousHeaders) {
      if (request.headers.get(header)) {
        errors.push(`Suspicious header detected: ${header}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: ['Request validation failed'],
    };
  }
}

/**
 * Log security event
 */
function logSecurityEvent(event: SecurityEvent, request: NextRequest): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Security Event]', {
      ...event,
      url: request.url,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });
  }
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with Sentry or other monitoring service
  }
}

/**
 * Security middleware function
 */
export async function securityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  
  // Skip security middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return null;
  }
  
  try {
    // 1. Input validation
    const inputValidation = await validateRequestInput(request);
    if (!inputValidation.valid) {
      logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: { 
          reason: 'input_validation_failed',
          errors: inputValidation.errors,
        },
        severity: 'medium',
      }, request);
      
      return NextResponse.json(
        { error: 'Invalid request', details: inputValidation.errors },
        { status: 400 }
      );
    }
    
    // 2. Rate limiting
    const clientId = getClientId(request);
    let rateLimitType: keyof typeof RATE_LIMITS = 'api';
    
    if (pathname.startsWith('/api/auth/')) {
      rateLimitType = 'auth';
    } else if (pathname.includes('/upload')) {
      rateLimitType = 'upload';
    } else if (pathname.startsWith('/api/graphql') && request.method === 'POST') {
      rateLimitType = 'mutation';
    }
    
    const rateLimit = checkRateLimit(clientId, rateLimitType);
    
    if (!rateLimit.allowed) {
      logSecurityEvent({
        type: 'security_error',
        timestamp: new Date(),
        details: { 
          reason: 'rate_limit_exceeded',
          endpoint: rateLimitType,
          clientId: clientId.slice(0, 8) + '...',
        },
        severity: 'high',
      }, request);
      
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS[rateLimitType].maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    // 3. CSRF protection for mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const requiresCSRF = CSRFProtector.requiresCSRFProtection({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        requiresCSRF: true,
      });
      
      if (requiresCSRF && securityConfig.csrfProtection.enabled) {
        const csrfToken = request.headers.get(securityConfig.csrfProtection.tokenHeader);
        
        if (!csrfToken) {
          logSecurityEvent({
            type: 'csrf_violation',
            timestamp: new Date(),
            details: { reason: 'missing_csrf_token' },
            severity: 'high',
          }, request);
          
          return NextResponse.json(
            { error: 'CSRF token required' },
            { status: 403 }
          );
        }
        
        const isValidCSRF = await CSRFProtector.validateCSRFToken(csrfToken);
        if (!isValidCSRF) {
          logSecurityEvent({
            type: 'csrf_violation',
            timestamp: new Date(),
            details: { reason: 'invalid_csrf_token' },
            severity: 'high',
          }, request);
          
          return NextResponse.json(
            { error: 'Invalid CSRF token' },
            { status: 403 }
          );
        }
      }
    }
    
    // 4. Create response with security headers
    const response = NextResponse.next();
    
    // Add security headers
    const securityHeaders = getSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', RATE_LIMITS[rateLimitType].maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
    
    return response;
    
  } catch (error) {
    logSecurityEvent({
      type: 'security_error',
      timestamp: new Date(),
      details: { 
        reason: 'middleware_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      severity: 'critical',
    }, request);
    
    // Don't block the request on middleware errors
    return NextResponse.next();
  }
}

/**
 * Clean up rate limit store (call periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
if (typeof window === 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}