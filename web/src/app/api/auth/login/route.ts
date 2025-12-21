/**
 * Login API Route
 *
 * Next.js API route that proxies login requests to the backend GraphQL API.
 * Handles JWT token management and secure cookie setting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user {
        id
        email
        role
        emailVerified
        profile {
          fullName
          avatarUrl
        }
        createdAt
        updatedAt
      }
    }
  }
`;

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  data: {
    login: {
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        role: string;
        emailVerified: boolean;
        profile: {
          fullName: string;
          avatarUrl?: string;
        };
        createdAt: string;
        updatedAt: string;
      };
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
    const { email, password } = body as LoginInput;

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Call backend GraphQL API
    const response = await fetch(config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: LOGIN_MUTATION,
        variables: {
          input: { email, password },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = (await response.json()) as LoginResponse;

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      const error = data.errors[0];
      return NextResponse.json(
        {
          error: error.message,
          code: error.extensions?.code || 'LOGIN_FAILED',
        },
        { status: 401 }
      );
    }

    if (!data.data?.login) {
      return NextResponse.json({ error: 'Invalid login response' }, { status: 500 });
    }

    const { accessToken, refreshToken, user } = data.data.login;

    // Create response with user data
    const responseData = {
      accessToken,
      refreshToken,
      user,
    };

    // Create response with secure cookies in production
    const nextResponse = NextResponse.json(responseData);

    if (process.env.NODE_ENV === 'production') {
      // Set httpOnly cookies for production security
      nextResponse.cookies.set('access-token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });

      nextResponse.cookies.set('refresh-token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Login API error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Login failed',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
