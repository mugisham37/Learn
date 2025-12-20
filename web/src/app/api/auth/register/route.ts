/**
 * Register API Route
 * 
 * Next.js API route that proxies registration requests to the backend GraphQL API.
 * Handles user registration and automatic login with JWT token management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
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

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

interface RegisterResponse {
  data: {
    register: {
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
    const { email, password, fullName } = body as RegisterInput;

    // Validate input
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Basic password validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Call backend GraphQL API
    const response = await fetch(config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: REGISTER_MUTATION,
        variables: {
          input: { email, password, fullName },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = await response.json() as RegisterResponse;

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      const error = data.errors[0];
      return NextResponse.json(
        { 
          error: error.message,
          code: error.extensions?.code || 'REGISTRATION_FAILED'
        },
        { status: 400 }
      );
    }

    if (!data.data?.register) {
      return NextResponse.json(
        { error: 'Invalid registration response' },
        { status: 500 }
      );
    }

    const { accessToken, refreshToken, user } = data.data.register;

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
    console.error('Registration API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Registration failed',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}