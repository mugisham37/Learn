/**
 * SubscriptionProvider Tests
 * 
 * Unit tests for the SubscriptionProvider component and related hooks.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { vi, describe, it, expect } from 'vitest';
import { SubscriptionProvider, useConnectionStatus, useIsConnected } from '../SubscriptionProvider';
// import { AuthProvider } from '../../auth/authProvider';

// Mock the auth hooks
vi.mock('../../auth/authHooks', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: '1', email: 'test@example.com' },
  }),
}));

// Test component that uses subscription hooks
function TestComponent() {
  const connectionStatus = useConnectionStatus();
  const isConnected = useIsConnected();

  return (
    <div>
      <div data-testid="connection-status">
        {connectionStatus.connected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="is-connected">
        {isConnected ? 'true' : 'false'}
      </div>
      <div data-testid="reconnect-attempts">
        {connectionStatus.reconnectAttempts}
      </div>
    </div>
  );
}

// Wrapper component with all required providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MockedProvider mocks={[]} addTypename={false}>
      <SubscriptionProvider>
        {children}
      </SubscriptionProvider>
    </MockedProvider>
  );
}

describe('SubscriptionProvider', () => {
  it('should provide connection status to child components', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    // Initially should be connected (mocked authenticated state)
    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
      expect(screen.getByTestId('reconnect-attempts')).toHaveTextContent('0');
    });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSubscriptionContext must be used within a SubscriptionProvider');

    consoleSpy.mockRestore();
  });

  it('should handle custom reconnection config', async () => {
    const customConfig = {
      maxAttempts: 5,
      initialDelay: 500,
    };

    render(
      <TestWrapper>
        <SubscriptionProvider reconnectionConfig={customConfig}>
          <TestComponent />
        </SubscriptionProvider>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
    });
  });

  it('should handle disabled auto-reconnect', async () => {
    render(
      <TestWrapper>
        <SubscriptionProvider enableAutoReconnect={false}>
          <TestComponent />
        </SubscriptionProvider>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
    });
  });
});

describe('Connection Status Hooks', () => {
  it('should provide connection status', async () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true');
    });
  });
});