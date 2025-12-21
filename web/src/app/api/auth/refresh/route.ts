/**
 * Refresh Token API Route
 *
 * Next.js API route that handles JWT token refresh using the backend GraphQL API.
 * Implements token rotation for enhanced security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

interface RefreshTokenInput {
  refreshToken: string;
}

interface RefreshTokenResponse {
  data: {
    refreshToken: {
      accessToken: string;
      refreshToken: string;
    };
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
    const body = await request.json();
    let { refreshToken } = body as RefreshTokenInput;

    // In production, try to get refresh token from httpOnly cookie first
    if (process.env.NODE_ENV === 'production' && !refreshToken) {
      refreshToken = request.cookies.get('refresh-token')?.value;
    }

    // Validate input
    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 });
    }

    // Call backend GraphQL API
    const response = await fetch(config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: REFRESH_TOKEN_MUTATION,
        variables: {
          input: { refreshToken },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = (await response.json()) as RefreshTokenResponse;

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      const error = data.errors[0];

      // Clear cookies on refresh failure
      const errorResponse = NextResponse.json(
        {
          error: error.message,
          code: error.extensions?.code || 'TOKEN_REFRESH_FAILED',
        },
        { status: 401 }
      );

      if (process.env.NODE_ENV === 'production') {
        errorResponse.cookies.delete('access-token');
        errorResponse.cookies.delete('refresh-token');
      }

      return errorResponse;
    }

    if (!data.data?.refreshToken) {
      return NextResponse.json({ error: 'Invalid refresh response' }, { status: 500 });
    }

    const { accessToken, refreshToken: newRefreshToken } = data.data.refreshToken;

    // Create response with new tokens
    const responseData = {
      accessToken,
      refreshToken: newRefreshToken,
    };

    // Create response with updated secure cookies in production
    const nextResponse = NextResponse.json(responseData);

    if (process.env.NODE_ENV === 'production') {
      // Update httpOnly cookies with new tokens
      nextResponse.cookies.set('access-token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });

      nextResponse.cookies.set('refresh-token', newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Token refresh API error:', error);

    // Clear cookies on error
    const errorResponse = NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Token refresh failed',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );

    if (process.env.NODE_ENV === 'production') {
      errorResponse.cookies.delete('access-token');
      errorResponse.cookies.delete('refresh-token');
    }

    return errorResponse;
  }
}
