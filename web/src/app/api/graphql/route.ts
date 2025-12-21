/**
 * GraphQL Proxy API Route
 * 
 * Next.js API route that proxies GraphQL requests to the backend server.
 * Handles authentication, CORS, rate limiting, and request validation.
 * 
 * Requirements: 8.2, 8.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // per window
};

// Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

/**
 * Check rate limit
 */
function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = clientIP;
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    // Reset or initialize
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs,
    });
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  if (limit.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - limit.count };
}

/**
 * Validate GraphQL request
 */
function validateGraphQLRequest(body: any): { valid: boolean; error?: string } {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }

  if (typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  if (!body.query || typeof body.query !== 'string') {
    return { valid: false, error: 'GraphQL query is required' };
  }

  // Basic query validation
  const query = body.query.trim();
  if (query.length === 0) {
    return { valid: false, error: 'GraphQL query cannot be empty' };
  }

  if (query.length > 10000) {
    return { valid: false, error: 'GraphQL query is too large' };
  }

  // Check for potentially dangerous operations
  const dangerousPatterns = [
    /__schema/i,
    /__type/i,
    /introspection/i,
  ];

  if (process.env.NODE_ENV === 'production') {
    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return { valid: false, error: 'Introspection queries are not allowed in production' };
      }
    }
  }

  return { valid: true };
}

/**
 * Handle CORS preflight
 */
function handleCORS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
    process.env.CORS_ORIGIN || 'http://localhost:3000'
  ];

  const isAllowedOrigin = allowedOrigins.includes(origin || '');

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const corsHeaders = handleCORS(request);
  
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * POST handler for GraphQL requests
 */
export async function POST(request: NextRequest) {
  try {
    const corsHeaders = handleCORS(request);
    
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          errors: [{ 
            message: 'Rate limit exceeded. Please try again later.',
            extensions: { code: 'RATE_LIMITED' }
          }] 
        },
        { 
          status: 429,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(Date.now() + RATE_LIMIT.windowMs).toISOString(),
          }
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { 
          errors: [{ 
            message: 'Invalid JSON in request body',
            extensions: { code: 'INVALID_JSON' }
          }] 
        },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate GraphQL request
    const validation = validateGraphQLRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          errors: [{ 
            message: validation.error,
            extensions: { code: 'INVALID_REQUEST' }
          }] 
        },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Get authentication token
    let accessToken: string | undefined;
    
    // Try to get token from cookies (production) or Authorization header
    if (process.env.NODE_ENV === 'production') {
      accessToken = request.cookies.get('access-token')?.value;
    } else {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      }
    }

    // Prepare headers for backend request
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'NextJS-Frontend/1.0',
      'X-Forwarded-For': clientIP,
    };

    if (accessToken) {
      backendHeaders.Authorization = `Bearer ${accessToken}`;
    }

    // Forward request to backend GraphQL endpoint
    const backendResponse = await fetch(config.graphqlEndpoint, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      console.error(`Backend GraphQL request failed: ${backendResponse.status} ${backendResponse.statusText}`);
      
      return NextResponse.json(
        { 
          errors: [{ 
            message: 'Backend service unavailable',
            extensions: { 
              code: 'BACKEND_ERROR',
              status: backendResponse.status 
            }
          }] 
        },
        { 
          status: 502,
          headers: corsHeaders,
        }
      );
    }

    // Parse backend response
    let backendData;
    try {
      backendData = await backendResponse.json();
    } catch (error) {
      console.error('Failed to parse backend response:', error);
      
      return NextResponse.json(
        { 
          errors: [{ 
            message: 'Invalid response from backend',
            extensions: { code: 'BACKEND_PARSE_ERROR' }
          }] 
        },
        { 
          status: 502,
          headers: corsHeaders,
        }
      );
    }

    // Return response with CORS headers
    return NextResponse.json(backendData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    });

  } catch (error) {
    console.error('GraphQL proxy error:', error);
    
    return NextResponse.json(
      { 
        errors: [{ 
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_ERROR' }
        }] 
      },
      { 
        status: 500,
        headers: handleCORS(request),
      }
    );
  }
}

/**
 * GET handler - not allowed for GraphQL
 */
export async function GET(request: NextRequest) {
  const corsHeaders = handleCORS(request);
  
  return NextResponse.json(
    { 
      errors: [{ 
        message: 'GET method not allowed for GraphQL endpoint',
        extensions: { code: 'METHOD_NOT_ALLOWED' }
      }] 
    },
    { 
      status: 405,
      headers: {
        ...corsHeaders,
        'Allow': 'POST, OPTIONS',
      },
    }
  );
}