/**
 * Password Reset API Route
 *
 * Next.js API route that handles password reset workflow using the backend GraphQL API.
 * Supports both requesting password reset and confirming with token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

const REQUEST_PASSWORD_RESET_MUTATION = `
  mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
    requestPasswordReset(input: $input)
  }
`;

const RESET_PASSWORD_MUTATION = `
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      success
      user {
        id
        email
      }
    }
  }
`;

interface RequestPasswordResetInput {
  email: string;
}

interface ResetPasswordInput {
  token: string;
  email: string;
  newPassword: string;
}

interface RequestPasswordResetResponse {
  data: {
    requestPasswordReset: boolean;
  };
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
    };
  }>;
}

interface ResetPasswordResponse {
  data: {
    resetPassword: {
      success: boolean;
      user: {
        id: string;
        email: string;
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
    const { email, token, newPassword } = body;

    if (token && newPassword) {
      // Reset password with token
      return await resetPassword({ token, email, newPassword });
    } else if (email) {
      // Request password reset
      return await requestPasswordReset({ email });
    } else {
      return NextResponse.json(
        {
          error:
            'Email is required for password reset request, or token and newPassword for reset confirmation',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Password reset API error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Password reset failed',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

async function requestPasswordReset(input: RequestPasswordResetInput) {
  const { email } = input;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  // Call backend GraphQL API
  const response = await fetch(config.graphqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: REQUEST_PASSWORD_RESET_MUTATION,
      variables: {
        input: { email },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  const data = (await response.json()) as RequestPasswordResetResponse;

  // Check for GraphQL errors
  if (data.errors && data.errors.length > 0) {
    const error = data.errors[0];
    return NextResponse.json(
      {
        error: error?.message || 'Password reset request failed',
        code: error?.extensions?.code || 'PASSWORD_RESET_REQUEST_FAILED',
      },
      { status: 400 }
    );
  }

  // Always return success for security (don't reveal if email exists)
  return NextResponse.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent',
  });
}

async function resetPassword(input: ResetPasswordInput) {
  const { token, email, newPassword } = input;

  // Validate input
  if (!token || !email || !newPassword) {
    return NextResponse.json(
      { error: 'Token, email, and new password are required' },
      { status: 400 }
    );
  }

  // Validate password strength
  if (newPassword.length < 8) {
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
      query: RESET_PASSWORD_MUTATION,
      variables: {
        input: { token, email, newPassword },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  const data = (await response.json()) as ResetPasswordResponse;

  // Check for GraphQL errors
  if (data.errors && data.errors.length > 0) {
    const error = data.errors[0];
    return NextResponse.json(
      {
        error: error?.message || 'Password reset failed',
        code: error?.extensions?.code || 'PASSWORD_RESET_FAILED',
      },
      { status: 400 }
    );
  }

  if (!data.data?.resetPassword) {
    return NextResponse.json({ error: 'Invalid password reset response' }, { status: 500 });
  }

  const { success, user } = data.data.resetPassword;

  return NextResponse.json({
    success,
    user,
    message: success ? 'Password reset successfully' : 'Password reset failed',
  });
}
