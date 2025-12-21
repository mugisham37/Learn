/**
 * Password Reset Components
 *
 * React components for handling password reset workflow including
 * requesting password reset and confirming with token.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useAuthActions } from '../authHooks';
import type { User } from '@/types';

interface PasswordResetRequestFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Component for requesting password reset
 */
export function PasswordResetRequestForm({ onSuccess, onError }: PasswordResetRequestFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { requestPasswordResetWithFeedback } = useAuthActions();

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
        const result = await requestPasswordResetWithFeedback(email);
        setMessage(result.message);
        onSuccess?.();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to request password reset';
        setMessage(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [email, requestPasswordResetWithFeedback, onSuccess, onError]
  );

  return (
    <div className='max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md'>
      <div className='text-center mb-6'>
        <h2 className='text-2xl font-bold text-gray-900'>Reset Your Password</h2>
        <p className='mt-2 text-sm text-gray-600'>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

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
              message.includes('sent') || message.includes('exists')
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
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>
    </div>
  );
}

interface PasswordResetConfirmFormProps {
  token: string;
  email: string;
  onSuccess?: (user: User) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
}

/**
 * Component for confirming password reset with new password
 */
export function PasswordResetConfirmForm({
  token,
  email,
  onSuccess,
  onError,
  redirectTo = '/login',
}: PasswordResetConfirmFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { resetPasswordWithRedirect } = useAuthActions();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!newPassword || !confirmPassword) {
        const error = 'Both password fields are required';
        setMessage(error);
        onError?.(error);
        return;
      }

      if (newPassword !== confirmPassword) {
        const error = 'Passwords do not match';
        setMessage(error);
        onError?.(error);
        return;
      }

      if (newPassword.length < 8) {
        const error = 'Password must be at least 8 characters long';
        setMessage(error);
        onError?.(error);
        return;
      }

      setIsLoading(true);
      setMessage('');

      try {
        const result = await resetPasswordWithRedirect(token, email, newPassword, redirectTo);

        if (result.success) {
          setMessage('Password reset successfully! Redirecting to login...');
          if (result.user) {
            onSuccess?.(result.user);
          }
        } else {
          const error = 'Password reset failed';
          setMessage(error);
          onError?.(error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
        setMessage(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [
      token,
      email,
      newPassword,
      confirmPassword,
      resetPasswordWithRedirect,
      redirectTo,
      onSuccess,
      onError,
    ]
  );

  if (!token || !email) {
    return (
      <div className='max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md'>
        <div className='text-center'>
          <h2 className='text-2xl font-bold text-gray-900 mb-4'>Invalid Reset Link</h2>
          <p className='text-red-600'>This password reset link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md'>
      <div className='text-center mb-6'>
        <h2 className='text-2xl font-bold text-gray-900'>Set New Password</h2>
        <p className='mt-2 text-sm text-gray-600'>Enter your new password below.</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label htmlFor='newPassword' className='block text-sm font-medium text-gray-700'>
            New Password
          </label>
          <input
            type='password'
            id='newPassword'
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={8}
            className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100'
            placeholder='Enter new password (min 8 characters)'
          />
        </div>

        <div>
          <label htmlFor='confirmPassword' className='block text-sm font-medium text-gray-700'>
            Confirm New Password
          </label>
          <input
            type='password'
            id='confirmPassword'
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
            minLength={8}
            className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100'
            placeholder='Confirm new password'
          />
        </div>

        {message && (
          <div
            className={`p-3 rounded-md text-sm ${
              message.includes('successfully') || message.includes('Redirecting')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type='submit'
          disabled={isLoading || !newPassword || !confirmPassword}
          className='w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed'
        >
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}
