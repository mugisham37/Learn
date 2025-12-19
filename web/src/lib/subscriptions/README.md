# Real-time Subscription System

This module provides a comprehensive real-time subscription system for the frontend foundation layer. It includes WebSocket connection management, automatic reconnection, cache integration, and React hooks for common subscription patterns.

## Features

### ✅ Implemented Features

1. **SubscriptionProvider** - React Context provider for WebSocket management
   - Connection status tracking and reporting
   - Automatic reconnection with exponential backoff
   - Connection authentication and authorization handling
   - Configurable reconnection strategies

2. **Core Subscription Hooks**
   - `useMessageSubscription` - Real-time message updates
   - `useProgressSubscription` - Live progress tracking
   - `useNotificationSubscription` - Notification updates
   - `usePresenceSubscription` - User online status
   - `useMultipleSubscriptions` - Manage multiple subscriptions

3. **Cache Integration**
   - Automatic cache updates from subscription data
   - Cache invalidation strategies for real-time updates
   - Subscription cleanup on component unmount
   - Conflict resolution for concurrent updates

4. **Connection Management**
   - WebSocket connection status monitoring
   - Exponential backoff reconnection strategy
   - Connection error handling and recovery
   - Authentication-aware connection management

## Usage

### Basic Setup

```tsx
import { SubscriptionProvider } from '@/lib/subscriptions';

function App() {
  return (
    <SubscriptionProvider>
      <YourAppComponents />
    </SubscriptionProvider>
  );
}
```

### Using Subscription Hooks

```tsx
import { 
  useMessageSubscription, 
  useConnectionStatus 
} from '@/lib/subscriptions';

function ChatComponent({ userId }: { userId: string }) {
  const { data, loading, error } = useMessageSubscription(userId, {
    onSubscriptionData: (data) => {
      console.log('New message:', data);
    },
  });

  const connectionStatus = useConnectionStatus();

  return (
    <div>
      <div>Status: {connectionStatus.connected ? 'Connected' : 'Disconnected'}</div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

### Custom Reconnection Configuration

```tsx
<SubscriptionProvider
  reconnectionConfig={{
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  }}
  enableAutoReconnect={true}
>
  <App />
</SubscriptionProvider>
```

## Architecture

The subscription system is built on top of Apollo Client's GraphQL subscriptions with additional features:

- **Connection Management**: Tracks WebSocket connection state and handles reconnection
- **Cache Integration**: Automatically updates Apollo cache with subscription data
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Performance**: Efficient cache updates and cleanup to prevent memory leaks

## Files Structure

```
src/lib/subscriptions/
├── types.ts                    # Type definitions
├── SubscriptionProvider.tsx    # Main provider component
├── subscriptionHooks.ts        # Core subscription hooks
├── cacheIntegration.ts         # Cache management utilities
├── examples.ts                 # Usage examples
├── index.ts                    # Main exports
└── __tests__/                  # Test files
    └── SubscriptionProvider.test.tsx
```

## Integration with Backend

The subscription system integrates with the backend's GraphQL subscription server:

- **WebSocket Endpoint**: Configured via `NEXT_PUBLIC_WS_ENDPOINT`
- **Authentication**: JWT tokens automatically included in connection params
- **Subscriptions**: Supports all GraphQL subscription operations
- **Error Handling**: Maps backend errors to user-friendly messages

## Performance Considerations

- **Connection Pooling**: Single WebSocket connection shared across all subscriptions
- **Cache Efficiency**: Smart cache updates to minimize re-renders
- **Memory Management**: Automatic cleanup of subscriptions on component unmount
- **Reconnection Strategy**: Exponential backoff prevents server overload

## Security

- **Authentication**: JWT tokens validated on connection
- **Authorization**: Subscription-level permission checking
- **Rate Limiting**: Client-side helpers for handling rate limits
- **Error Sanitization**: Sensitive error details filtered from client

## Testing

The module includes comprehensive tests for:

- Connection status management
- Reconnection logic
- Hook behavior and cleanup
- Cache integration
- Error handling

Run tests with:
```bash
npm test src/lib/subscriptions
```

## Future Enhancements

- [ ] Subscription batching for performance
- [ ] Offline queue for failed subscriptions
- [ ] Advanced conflict resolution strategies
- [ ] Subscription analytics and monitoring
- [ ] Custom subscription middleware support