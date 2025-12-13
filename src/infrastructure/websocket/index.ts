/**
 * Socket.io WebSocket Configuration
 *
 * Manages real-time communication infrastructure with authentication,
 * room management, and Redis adapter for horizontal scaling.
 *
 * Requirements: 9.6, 9.7, 9.8
 */

import { createAdapter } from '@socket.io/redis-adapter';
import { FastifyInstance } from 'fastify';
import { verify } from 'jsonwebtoken';
import { Server as SocketIOServer, Socket } from 'socket.io';

import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import { secrets } from '../../shared/utils/secureConfig.js';
import { redis } from '../cache/index.js';

/**
 * Extended Socket interface with authenticated user data
 */
export interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: 'student' | 'educator' | 'admin';
  enrolledCourses?: string[];
}

/**
 * Room naming conventions for different types of real-time communication
 */
export const SocketRooms = {
  // User-specific room for private notifications
  user: (userId: string) => `user:${userId}`,

  // Course-specific room for course-wide communications
  course: (courseId: string) => `course:${courseId}`,

  // Direct conversation between two users
  conversation: (userId1: string, userId2: string) => {
    // Ensure consistent room naming regardless of parameter order
    const [user1, user2] = [userId1, userId2].sort();
    return `conversation:${user1}:${user2}`;
  },

  // Discussion thread room for thread-specific updates
  thread: (threadId: string) => `thread:${threadId}`,

  // Lesson-specific room for lesson activities
  lesson: (lessonId: string) => `lesson:${lessonId}`,

  // Quiz session room for real-time quiz interactions
  quiz: (quizId: string, userId: string) => `quiz:${quizId}:${userId}`,
} as const;

/**
 * Socket.io server instance
 */
let io: SocketIOServer | null = null;

/**
 * Creates and configures Socket.io server with Fastify integration
 */
export async function createSocketServer(fastify: FastifyInstance): Promise<SocketIOServer> {
  // Note: Socket.io creates its own HTTP server, no need to register WebSocket plugin

  // Create Socket.io server instance
  io = new SocketIOServer(fastify.server, {
    path: config.websocket.path,
    cors: {
      origin: config.websocket.corsOrigin.split(','),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Connection timeout
    connectTimeout: 45000,
    // Ping timeout
    pingTimeout: 60000,
    // Ping interval
    pingInterval: 25000,
    // Allow upgrades (polling to websocket)
    allowUpgrades: true,
    // Transport options
    transports: ['websocket', 'polling'],
    // HTTP compression threshold
    httpCompression: true,
  });

  // Configure Redis adapter for horizontal scaling (requirement 9.8)
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  // Wait for Redis clients to be ready
  await Promise.all([
    new Promise<void>((resolve) => {
      if (pubClient.status === 'ready') {
        resolve();
      } else {
        pubClient.once('ready', resolve);
      }
    }),
    new Promise<void>((resolve) => {
      if (subClient.status === 'ready') {
        resolve();
      } else {
        subClient.once('ready', resolve);
      }
    }),
  ]);

  // Create and set Redis adapter
  const redisAdapter = createAdapter(pubClient, subClient);
  io.adapter(redisAdapter);

  // Authentication middleware (requirement 9.6)
  io.use(async (socket, next) => {
    try {
      await authenticateSocket(socket, next);
    } catch (error) {
      logger.error('Socket authentication error', {
        error: error instanceof Error ? error.message : String(error),
        socketId: socket.id,
      });
      next(new Error('Authentication failed'));
    }
  });

  // Connection event handler
  io.on('connection', async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    logger.info('Socket connected', {
      socketId: authSocket.id,
      userId: authSocket.userId,
      userRole: authSocket.userRole,
    });

    // Join user-specific room for private notifications
    await authSocket.join(SocketRooms.user(authSocket.userId));

    // Join course rooms if user is enrolled (requirement 9.7)
    if (authSocket.enrolledCourses && authSocket.enrolledCourses.length > 0) {
      for (const courseId of authSocket.enrolledCourses) {
        await authSocket.join(SocketRooms.course(courseId));
      }
    }

    // Handle presence updates
    await handleUserPresence(authSocket, 'online');

    // Set up event handlers
    setupSocketEventHandlers(authSocket);

    // Handle disconnection
    authSocket.on('disconnect', async (reason) => {
      logger.info('Socket disconnected', {
        socketId: authSocket.id,
        userId: authSocket.userId,
        reason,
      });

      // Update presence with delay for reconnection
      setTimeout(() => {
        void (async () => {
          try {
            const userSockets = await io?.in(SocketRooms.user(authSocket.userId)).fetchSockets();
            if (!userSockets || userSockets.length === 0) {
              // User has no active connections, mark as offline
              await handleUserPresence(authSocket, 'offline');
            }
          } catch (error) {
            logger.error('Error updating user presence on disconnect', {
              userId: authSocket.userId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
      }, 5000); // 5-second delay for reconnection
    });
  });

  logger.info('Socket.io server configured successfully', {
    path: config.websocket.path,
    corsOrigin: config.websocket.corsOrigin,
  });

  return io;
}

/**
 * Authentication middleware for WebSocket connections
 * Validates JWT token and attaches user context to socket
 */
function authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
  try {
    // Extract token from auth header or query parameter
    const token = (socket.handshake.auth as any)?.token || (socket.handshake.query as any)?.token;

    if (!token) {
      throw new Error('No authentication token provided');
    }

    // Verify JWT token
    const decoded = verify(token, secrets.getJwtConfig().secret) as {
      userId: string;
      role: 'student' | 'educator' | 'admin';
      enrolledCourses?: string[];
    };

    // Attach user data to socket
    (socket as any).userId = decoded.userId;
    (socket as any).userRole = decoded.role;
    (socket as any).enrolledCourses = decoded.enrolledCourses;

    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
}

/**
 * Sets up event handlers for authenticated socket
 */
function setupSocketEventHandlers(socket: AuthenticatedSocket): void {
  // Join course room (for educators creating courses or students enrolling)
  socket.on('join-course', async (courseId: string) => {
    try {
      // TODO: Validate user has access to course
      await socket.join(SocketRooms.course(courseId));

      logger.info('User joined course room', {
        userId: socket.userId,
        courseId,
        socketId: socket.id,
      });

      socket.emit('joined-course', { courseId });
    } catch (error) {
      logger.error('Error joining course room', {
        userId: socket.userId,
        courseId,
        error: error instanceof Error ? error.message : String(error),
      });

      socket.emit('error', { message: 'Failed to join course room' });
    }
  });

  // Leave course room
  socket.on('leave-course', async (courseId: string) => {
    try {
      await socket.leave(SocketRooms.course(courseId));

      logger.info('User left course room', {
        userId: socket.userId,
        courseId,
        socketId: socket.id,
      });

      socket.emit('left-course', { courseId });
    } catch (error) {
      logger.error('Error leaving course room', {
        userId: socket.userId,
        courseId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Join conversation room
  socket.on('join-conversation', async (otherUserId: string) => {
    try {
      const conversationRoom = SocketRooms.conversation(socket.userId, otherUserId);
      await socket.join(conversationRoom);

      logger.info('User joined conversation room', {
        userId: socket.userId,
        otherUserId,
        conversationRoom,
        socketId: socket.id,
      });

      socket.emit('joined-conversation', { otherUserId, room: conversationRoom });
    } catch (error) {
      logger.error('Error joining conversation room', {
        userId: socket.userId,
        otherUserId,
        error: error instanceof Error ? error.message : String(error),
      });

      socket.emit('error', { message: 'Failed to join conversation room' });
    }
  });

  // Join discussion thread room
  socket.on('join-thread', async (threadId: string) => {
    try {
      await socket.join(SocketRooms.thread(threadId));

      logger.info('User joined thread room', {
        userId: socket.userId,
        threadId,
        socketId: socket.id,
      });

      socket.emit('joined-thread', { threadId });
    } catch (error) {
      logger.error('Error joining thread room', {
        userId: socket.userId,
        threadId,
        error: error instanceof Error ? error.message : String(error),
      });

      socket.emit('error', { message: 'Failed to join thread room' });
    }
  });

  // Typing indicator for conversations
  socket.on('typing-start', (data: { conversationId?: string; threadId?: string }) => {
    try {
      const room = data.conversationId
        ? SocketRooms.conversation(socket.userId, data.conversationId)
        : data.threadId
          ? SocketRooms.thread(data.threadId)
          : null;

      if (room) {
        socket.to(room).emit('user-typing', {
          userId: socket.userId,
          type: 'start',
        });
      }
    } catch (error) {
      logger.error('Error broadcasting typing start', {
        userId: socket.userId,
        data,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Stop typing indicator
  socket.on('typing-stop', (data: { conversationId?: string; threadId?: string }) => {
    try {
      const room = data.conversationId
        ? SocketRooms.conversation(socket.userId, data.conversationId)
        : data.threadId
          ? SocketRooms.thread(data.threadId)
          : null;

      if (room) {
        socket.to(room).emit('user-typing', {
          userId: socket.userId,
          type: 'stop',
        });
      }
    } catch (error) {
      logger.error('Error broadcasting typing stop', {
        userId: socket.userId,
        data,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Handle quiz session events
  socket.on('join-quiz', async (quizId: string) => {
    try {
      const quizRoom = SocketRooms.quiz(quizId, socket.userId);
      await socket.join(quizRoom);

      socket.emit('joined-quiz', { quizId, room: quizRoom });
    } catch (error) {
      logger.error('Error joining quiz room', {
        userId: socket.userId,
        quizId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Handles user presence updates and broadcasts to relevant rooms
 */
async function handleUserPresence(
  socket: AuthenticatedSocket,
  status: 'online' | 'offline'
): Promise<void> {
  try {
    // Broadcast presence to course rooms
    if (socket.enrolledCourses && socket.enrolledCourses.length > 0) {
      for (const courseId of socket.enrolledCourses) {
        socket.to(SocketRooms.course(courseId)).emit('user-presence', {
          userId: socket.userId,
          status,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Store presence in Redis for persistence
    const presenceKey = `presence:${socket.userId}`;
    if (status === 'online') {
      await redis.setex(
        presenceKey,
        300,
        JSON.stringify({
          // 5-minute TTL
          status,
          lastSeen: new Date().toISOString(),
          socketId: socket.id,
        })
      );
    } else {
      await redis.del(presenceKey);
    }

    logger.debug('User presence updated', {
      userId: socket.userId,
      status,
    });
  } catch (error) {
    logger.error('Error handling user presence', {
      userId: socket.userId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Gets the Socket.io server instance
 */
export function getSocketServer(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io server not initialized. Call createSocketServer first.');
  }
  return io;
}

/**
 * Emits an event to a specific user
 */
export function emitToUser(userId: string, event: string, data: Record<string, unknown>): void {
  try {
    if (!io) {
      throw new Error('Socket.io server not initialized');
    }

    io.to(SocketRooms.user(userId)).emit(event, data);

    logger.debug('Event emitted to user', {
      userId,
      event,
      dataKeys: Object.keys(data || {}),
    });
  } catch (error) {
    logger.error('Error emitting to user', {
      userId,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Emits an event to a specific room
 */
export function emitToRoom(room: string, event: string, data: Record<string, unknown>): void {
  try {
    if (!io) {
      throw new Error('Socket.io server not initialized');
    }

    io.to(room).emit(event, data);

    logger.debug('Event emitted to room', {
      room,
      event,
      dataKeys: Object.keys(data || {}),
    });
  } catch (error) {
    logger.error('Error emitting to room', {
      room,
      event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Emits an event to all users in a course
 */
export function emitToCourse(courseId: string, event: string, data: Record<string, unknown>): void {
  emitToRoom(SocketRooms.course(courseId), event, data);
}

/**
 * Emits an event to a conversation between two users
 */
export function emitToConversation(
  userId1: string,
  userId2: string,
  event: string,
  data: Record<string, unknown>
): void {
  emitToRoom(SocketRooms.conversation(userId1, userId2), event, data);
}

/**
 * Emits an event to a discussion thread
 */
export function emitToThread(threadId: string, event: string, data: Record<string, unknown>): void {
  emitToRoom(SocketRooms.thread(threadId), event, data);
}

/**
 * Gets online users in a course
 */
export async function getOnlineUsersInCourse(courseId: string): Promise<string[]> {
  try {
    if (!io) {
      return [];
    }

    const sockets = await io.in(SocketRooms.course(courseId)).fetchSockets();
    return sockets.map((socket: any) => (socket as AuthenticatedSocket).userId).filter(Boolean);
  } catch (error) {
    logger.error('Error getting online users in course', {
      courseId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Gets user presence status from Redis
 */
export async function getUserPresence(userId: string): Promise<{
  status: 'online' | 'offline';
  lastSeen?: string;
} | null> {
  try {
    const presenceKey = `presence:${userId}`;
    const presence = await redis.get(presenceKey);

    if (!presence) {
      return { status: 'offline' };
    }

    return JSON.parse(presence);
  } catch (error) {
    logger.error('Error getting user presence', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: 'offline' };
  }
}

/**
 * Gracefully closes the Socket.io server
 */
export async function closeSocketServer(): Promise<void> {
  try {
    if (io) {
      await new Promise<void>((resolve) => {
        io!.close(() => {
          logger.info('Socket.io server closed successfully');
          resolve();
        });
      });
      io = null;
    }
  } catch (error) {
    logger.error('Error closing Socket.io server', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
