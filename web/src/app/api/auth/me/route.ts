/**
 * Current User API Route
 * 
 * Next.js API route that fetches current user information from the backend.
 * Used for refreshing user data and session validation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

const ME_QUERY = `
  query Me {
    me {
      id
      email
      role
      emailVerified
      profile {
        fullName
        avatarUrl
        bio
        timezone
        language
      }
      notificationPreferences {
        email
        push
        sms
        inApp
      }
      createdAt
      updatedAt
    }
  }
`;

interface MeResponse {
  data: {
    me: {
      id: string;
      email: string;
      role: string;
      emailVerified: boolean;
      profile: {
        fullName: string;
        avatarUrl?: string;
        bio?: string;
        timezone?: string;
        language?: string;
      };
      notificationPreferences: {
        email: boolean;
        push: boolean;
        sms: boolean;
        inApp: boolean;
      };
      createdAt: string;
      updatedAt: string;
    };
  };
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
    };
  }>;
}

export async function GET(request: NextRequest) {
  try {
    let accessToken: string | undefined;

    // Get access token from cookies (production) or Authorization header (development)
    if (process.env.NODE_ENV === 'production') {
      accessToken = request.cookies.get('access-token')?.value;
    } else {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token provided' },
        { status: 401 }
      );
    }

    // Call backend GraphQL API
    const response = await fetch(config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: ME_QUERY,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = await response.json() as MeResponse;

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      const error = data.errors[0];
      
      // If authentication error, clear cookies
      if (error.extensions?.code === 'UNAUTHENTICATED') {
        const errorResponse = NextResponse.json(
          { 
            error: error.message,
            code: error.extensions.code
          },
          { status: 401 }
        );

        if (process.env.NODE_ENV === 'production') {
          errorResponse.cookies.delete('access-token');
          errorResponse.cookies.delete('refresh-token');
        }

        return errorResponse;
      }

      return NextResponse.json(
        { 
          error: error.message,
          code: error.extensions?.code || 'QUERY_FAILED'
        },
        { status: 400 }
      );
    }

    if (!data.data?.me) {
      return NextResponse.json(
        { error: 'Invalid user data response' },
        { status: 500 }
      );
    }

    return NextResponse.json(data.data.me);
  } catch (error) {
    console.error('Me API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch user data',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}