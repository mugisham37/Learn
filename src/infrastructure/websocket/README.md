# WebSocket Infrastructure

This module provides real-time communication capabilities using Socket.io with Redis adapter for horizontal scaling.

## Features

- **Authentication Middleware**: JWT-based authentication for WebSocket connections
- **Room Management**: Organized rooms for courses, conversations, threads, and lessons
- **Redis Adapter**: Horizontal scaling support using Redis pub/sub
- **Presence Tracking**: Online/offline status tracking with Redis persistence
- **Event Handling**: Comprehensive event system for real-time interactions
- **Typing Indicators**: Real-time typing notifications with debouncing

## Room Structure

The system uses a structured room naming convention:

- `user:{userId}` - User-specific room for private notifications
- `course:{courseId}` - Course-wide communications
- `conversation:{user1}:{user2}` - Direct conversations (sorted user IDs)
- `thread:{threadId}` - Discussion thread updates
- `lesson:{lessonId}` - Lesson-specific activities
- `quiz:{quizId}:{userId}` - Individual quiz sessions

## Authentication

WebSocket connections are authenticated using JWT tokens passed via:
- `auth.token` in the handshake
- `token` query parameter

The token must contain:
- `userId`: User identifier
- `role`: User role (student, educator, admin)
- `enrolledCourses`: Array of course IDs (optional)

## Usage

### Server Setup

```typescript
import { createSocketServer } from './infrastructure/websocket/index.js';

// Create Socket.io server with Fastify
const io = await createSocketServer(fastifyInstance);
```

### Emitting Events

```typescript
import { emitToUser, emitToCourse, emitToConversation } from './infrastructure/websocket/index.js';

// Send notification to user
await emitToUser('user-123', 'notification-received', {
  notificationId: 'notif-456',
  type: 'message',
  title: 'New Message',
  content: 'You have a new message',
  priority: 'medium',
  timestamp: new Date().toISOString(),
});

// Send announcement to course
await emitToCourse('course-789', 'announcement-published', {
  announcementId: 'announce-101',
  courseId: 'course-789',
  title: 'Important Update',
  content: 'Class schedule has changed',
  publishedAt: new Date().toISOString(),
});
```

### Using the Realtime Service

```typescript
import { RealtimeService } from '../../shared/services/RealtimeService.js';

const realtimeService = new RealtimeService();

// Send notification
await realtimeService.emitNotification('user-123', {
  notificationId: 'notif-456',
  type: 'message',
  title: 'New Message',
  content: 'You have a new message',
  priority: 'medium',
});

// Broadcast presence
await realtimeService.broadcastPresence('user-123', 'online', ['course-789']);
```

## Client-Side Events

### Connection Events

- `connect` - Successfully connected
- `disconnect` - Connection lost
- `error` - Connection or authentication error

### Room Events

- `joined-course` - Successfully joined course room
- `left-course` - Successfully left course room
- `joined-conversation` - Successfully joined conversation room
- `joined-thread` - Successfully joined thread room
- `joined-quiz` - Successfully joined quiz room

### Real-time Events

- `notification-received` - New notification
- `message-received` - New direct message
- `discussion-post-created` - New discussion post
- `announcement-published` - New course announcement
- `user-presence` - User online/offline status
- `user-typing` - Typing indicators
- `quiz-started` - Quiz session started
- `assignment-graded` - Assignment graded

### Presence Events

- `user-presence` - User status updates
- `user-typing` - Typing start/stop indicators

## Configuration

Environment variables:

- `WEBSOCKET_PATH` - Socket.io path (default: `/socket.io`)
- `WEBSOCKET_CORS_ORIGIN` - CORS origins for WebSocket connections
- `REDIS_HOST` - Redis host for adapter
- `REDIS_PORT` - Redis port for adapter
- `REDIS_PASSWORD` - Redis password (optional)

## Error Handling

The system includes comprehensive error handling:

- Authentication failures return appropriate error messages
- Connection errors are logged with context
- Failed event emissions are logged but don't crash the server
- Redis connection issues are handled gracefully with retries

## Testing

Run tests with:

```bash
npm run test -- --run src/infrastructure/websocket
```

The tests cover:
- Room naming conventions
- Basic Socket.io server functionality
- Event emission utilities

## Requirements Satisfied

This implementation satisfies the following requirements:

- **9.6**: WebSocket connection establishment with authentication
- **9.7**: Room management for courses and conversations  
- **9.8**: Redis adapter for horizontal scaling and presence tracking