/**
 * Logout API Route
 *
 * Next.js API route that handles user logout by invalidating tokens
 * on the backend and clearing secure cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

const LOGOUT_MUTATION = `
  mutation Logout($input: LogoutInput) {
    logout(input: $input)
  }
`;

interface LogoutInput {
  refreshToken?: string;
}

interface LogoutResponse {
  data: {
    logout: boolean;
  };
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    let refreshToken: string | undefined;

    // Try to get refresh token from request body or cookies
    try {
      const body = await request.json();
      refreshToken = body.refreshToken;
    } catch {
      // No body or invalid JSON, that's okay
    }

    // In production, try to get refresh token from httpOnly cookie
    if (process.env.NODE_ENV === 'production' && !refreshToken) {
      refreshToken = request.cookies.get('refresh-token')?.value;
    }

    // Get access token for authentication (if available)
    let accessToken: string | undefined;

    if (process.env.NODE_ENV === 'production') {
      accessToken = request.cookies.get('access-token')?.value;
    } else {
      // In development, try to get from Authorization header
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      }
    }

    // Call backend GraphQL API to invalidate tokens
    if (refreshToken) {
      const response = await fetch(config.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          query: LOGOUT_MUTATION,
          variables: {
            input: { refreshToken },
          },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as LogoutResponse;

        // Log any GraphQL errors but don't fail the logout
        if (data.errors && data.errors.length > 0) {
          console.warn('Logout GraphQL errors:', data.errors);
        }
      } else {
        console.warn('Backend logout request failed:', response.status);
      }
    }

    // Always clear cookies and return success, even if backend call fails
    // This ensures the user is logged out on the frontend
    const response = NextResponse.json({ success: true });

    if (process.env.NODE_ENV === 'production') {
      // Clear httpOnly cookies
      response.cookies.delete('access-token');
      response.cookies.delete('refresh-token');
    }

    return response;
  } catch (error) {
    console.error('Logout API error:', error);

    // Even on error, clear cookies and return success
    // The user should be logged out on the frontend
    const response = NextResponse.json({ success: true });

    if (process.env.NODE_ENV === 'production') {
      response.cookies.delete('access-token');
      response.cookies.delete('refresh-token');
    }

    return response;
  }
}
