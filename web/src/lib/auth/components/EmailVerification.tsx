/**
 * Email Verification Components
 *
 * React components for handling email verification workflow including
 * sending verification emails and verifying tokens.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useAuthActions } from '../authHooks';

interface EmailVerificationFormProps {
  email?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Component for sending email verification
 */
export function EmailVerificationForm({
  email: initialEmail = '',
  onSuccess,
  onError,
}: EmailVerificationFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { sendVerificationEmail } = useAuthActions();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!email) {
        const error = 'Email is required';
        setMessage(error);
        onError?.(error);
        return;
      }

      setIsLoading(true);
      setMessage('');

      try {
        const result = await sendVerificationEmail(email);
        setMessage(result.message);
        onSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send verification email';
        setMessage(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [email, sendVerificationEmail, onSuccess, onError]
  );

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div>
        <label htmlFor='email' className='block text-sm font-medium text-gray-700'>
          Email Address
        </label>
        <input
          type='email'
          id='email'
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100'
          placeholder='Enter your email address'
        />
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.includes('successfully') || message.includes('sent')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      <button
        type='submit'
        disabled={isLoading || !email}
        className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed'
      >
        {isLoading ? 'Sending...' : 'Send Verification Email'}
      </button>
    </form>
  );
}

interface EmailVerificationHandlerProps {
  token: string;
  email: string;
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
}

/**
 * Component for handling email verification with token
 */
export function EmailVerificationHandler({
  token,
  email,
  onSuccess,
  onError,
  redirectTo = '/dashboard',
}: EmailVerificationHandlerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const { verifyEmailWithRedirect } = useAuthActions();

  const handleVerification = useCallback(async () => {
    if (!token || !email) {
      const error = 'Invalid verification link';
      setMessage(error);
      onError?.(error);
      return;
    }

    setIsLoading(true);
    setMessage('Verifying your email...');

    try {
      const result = await verifyEmailWithRedirect(token, email, redirectTo);

      if (result.success) {
        setMessage('Email verified successfully! Redirecting...');
        setIsVerified(true);
        onSuccess?.(result.user);
      } else {
        const error = 'Email verification failed';
        setMessage(error);
        onError?.(error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Email verification failed';
      setMessage(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [token, email, verifyEmailWithRedirect, redirectTo, onSuccess, onError]);

  // Auto-verify on mount
  React.useEffect(() => {
    handleVerification();
  }, [handleVerification]);

  return (
    <div className='max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md'>
      <div className='text-center'>
        <h2 className='text-2xl font-bold text-gray-900 mb-4'>Email Verification</h2>

        {isLoading && (
          <div className='flex items-center justify-center mb-4'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          </div>
        )}

        {message && (
          <div
            className={`p-4 rounded-md text-sm mb-4 ${
              isVerified || message.includes('successfully')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : message.includes('Verifying')
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message}
          </div>
        )}

        {!isLoading && !isVerified && (
          <button
            onClick={handleVerification}
            className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
