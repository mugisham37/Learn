/**
 * Email Verification API Route
 * 
 * Next.js API route that handles email verification using the backend GraphQL API.
 * Supports both sending verification emails and verifying tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

const SEND_VERIFICATION_MUTATION = `
  mutation SendEmailVerification($input: SendEmailVerificationInput!) {
    sendEmailVerification(input: $input)
  }
`;

const VERIFY_EMAIL_MUTATION = `
  mutation VerifyEmail($input: VerifyEmailInput!) {
    verifyEmail(input: $input) {
      success
      user {
        id
        email
        emailVerified
      }
    }
  }
`;

interface SendVerificationInput {
  email: string;
}

interface VerifyEmailInput {
  token: string;
  email: string;
}

interface VerifyEmailResponse {
  data: {
    verifyEmail: {
      success: boolean;
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
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

interface SendVerificationResponse {
  data: {
    sendEmailVerification: boolean;
  };
  errors?: Array<{
    message: string;
    extensions?: {
      code: string;
    };
  }>;
}

// POST: Send verification email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (token) {
      // Verify email with token
      return await verifyEmail({ token, email });
    } else if (email) {
      // Send verification email
      return await sendVerificationEmail({ email });
    } else {
      return NextResponse.json(
        { error: 'Email or token is required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Email verification API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Email verification failed',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// GET: Verify email with token from URL params
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      return NextResponse.json(
        { error: 'Token and email are required' },
        { status: 400 }
      );
    }

    return await verifyEmail({ token, email });
  } catch (error) {
    console.error('Email verification API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Email verification failed',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

async function sendVerificationEmail(input: SendVerificationInput) {
  const { email } = input;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
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
      query: SEND_VERIFICATION_MUTATION,
      variables: {
        input: { email },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  const data = await response.json() as SendVerificationResponse;

  // Check for GraphQL errors
  if (data.errors && data.errors.length > 0) {
    const error = data.errors[0];
    return NextResponse.json(
      { 
        error: error.message,
        code: error.extensions?.code || 'VERIFICATION_SEND_FAILED'
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Verification email sent successfully'
  });
}

async function verifyEmail(input: VerifyEmailInput) {
  const { token, email } = input;

  // Validate input
  if (!token || !email) {
    return NextResponse.json(
      { error: 'Token and email are required' },
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
      query: VERIFY_EMAIL_MUTATION,
      variables: {
        input: { token, email },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  const data = await response.json() as VerifyEmailResponse;

  // Check for GraphQL errors
  if (data.errors && data.errors.length > 0) {
    const error = data.errors[0];
    return NextResponse.json(
      { 
        error: error.message,
        code: error.extensions?.code || 'EMAIL_VERIFICATION_FAILED'
      },
      { status: 400 }
    );
  }

  if (!data.data?.verifyEmail) {
    return NextResponse.json(
      { error: 'Invalid verification response' },
      { status: 500 }
    );
  }

  const { success, user } = data.data.verifyEmail;

  return NextResponse.json({
    success,
    user,
    message: success ? 'Email verified successfully' : 'Email verification failed'
  });
}