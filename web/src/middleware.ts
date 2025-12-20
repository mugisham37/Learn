/**
 * Next.js Middleware for Authentication and Route Protection
 * 
 * Handles JWT token validation, automatic refresh, and route protection
 * based on user roles and authentication status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/courses',
  '/profile',
  '/settings',
  '/admin',
];

// Routes that require specific roles
const ROLE_PROTECTED_ROUTES = {
  '/admin': ['ADMIN'],
  '/courses/create': ['EDUCATOR', 'ADMIN'],
  '/courses/manage': ['EDUCATOR', 'ADMIN'],
  '/analytics': ['EDUCATOR', 'ADMIN'],
};

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/about',
  '/contact',
];

/**
 * Parse JWT token payload
 */
function parseJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    if (!payload) return null;
    
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload || !payload.exp) return true;
  
  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime = payload.exp;
  
  // Consider token expired if it expires within 5 minutes
  return expirationTime <= currentTime + (5 * 60);
}

/**
 * Attempt to refresh access token
 */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch(`${config.appUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.accessToken || null;
  } catch {
    return null;
  }
}

/**
 * Check if route requires authentication
 */
function requiresAuth(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if route requires specific role
 */
function getRequiredRoles(pathname: string): string[] | null {
  for (const [route, roles] of Object.entries(ROLE_PROTECTED_ROUTES)) {
    if (pathname.startsWith(route)) {
      return roles;
    }
  }
  return null;
}

/**
 * Check if user has required role
 */
function hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get tokens from cookies
  let accessToken = request.cookies.get('access-token')?.value;
  const refreshToken = request.cookies.get('refresh-token')?.value;

  // Check if route requires authentication
  const needsAuth = requiresAuth(pathname);
  const requiredRoles = getRequiredRoles(pathname);

  // If route doesn't require auth and user is not on a public route, allow access
  if (!needsAuth && !requiredRoles) {
    return NextResponse.next();
  }

  // If no access token, try to refresh if refresh token exists
  if (!accessToken && refreshToken) {
    const newAccessToken = await refreshAccessToken(refreshToken);
    if (newAccessToken) {
      accessToken = newAccessToken;
      
      // Set new access token in response
      const response = NextResponse.next();
      response.cookies.set('access-token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });
      
      // Continue with the new token
      return response;
    }
  }

  // If access token exists but is expired, try to refresh
  if (accessToken && isTokenExpired(accessToken) && refreshToken) {
    const newAccessToken = await refreshAccessToken(refreshToken);
    if (newAccessToken) {
      accessToken = newAccessToken;
      
      // Set new access token in response
      const response = NextResponse.next();
      response.cookies.set('access-token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });
      
      // Continue with the new token
      return response;
    } else {
      // Refresh failed, clear cookies
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('access-token');
      response.cookies.delete('refresh-token');
      return response;
    }
  }

  // If route requires authentication and no valid token, redirect to login
  if (needsAuth && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If route requires specific roles, check user role
  if (requiredRoles && accessToken) {
    const payload = parseJWT(accessToken);
    if (!payload || !payload.role) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    if (!hasRequiredRole(payload.role, requiredRoles)) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (accessToken && ['/login', '/register'].includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};