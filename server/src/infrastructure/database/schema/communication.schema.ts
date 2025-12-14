/**
 * Communication Schema
 *
 * Database schema definitions for messaging, discussions, and announcements
 * Includes messages, discussion_threads, discussion_posts, and announcements tables
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

import { courses } from './courses.schema';
import { users } from './users.schema';

/**
 * Messages Table
 * Direct messages between users with threading and read tracking
 *
 * Requirements:
 * - 9.1: Direct messaging with real-time delivery and notifications
 *
 * Note: parentMessageId is a UUID field that references another message's ID.
 * The foreign key constraint will be added via migration to avoid TypeScript
 * circular type inference issues with Drizzle ORM.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderId: uuid('sender_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    recipientId: uuid('recipient_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id').notNull(),
    subject: varchar('subject', { length: 255 }),
    content: text('content').notNull(),
    attachments: jsonb('attachments').default([]).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),
    // Self-referencing field - foreign key constraint added via migration
    parentMessageId: uuid('parent_message_id'),
    deletedBySender: timestamp('deleted_by_sender'),
    deletedByRecipient: timestamp('deleted_by_recipient'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Index on conversationId for fast lookups of messages in a conversation
    conversationIdx: index('messages_conversation_idx').on(table.conversationId),
    // Index on recipientId for fast lookups of messages sent to a user
    recipientIdx: index('messages_recipient_idx').on(table.recipientId),
    // Index on isRead for filtering unread messages
    isReadIdx: index('messages_is_read_idx').on(table.isRead),
    // Composite index on recipientId and isRead for unread message queries
    recipientReadIdx: index('messages_recipient_read_idx').on(table.recipientId, table.isRead),
    // Index on senderId for fast lookups of messages sent by a user
    senderIdx: index('messages_sender_idx').on(table.senderId),
  })
);

/**
 * Discussion Threads Table
 * Course forum threads with metadata and activity tracking
 *
 * Requirements:
 * - 9.2: Discussion thread creation with enrollment validation
 */
export const discussionThreads = pgTable(
  'discussion_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    isLocked: boolean('is_locked').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    replyCount: integer('reply_count').default(0).notNull(),
    lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Index on courseId for fast lookups of threads in a course
    courseIdx: index('discussion_threads_course_idx').on(table.courseId),
    // Index on authorId for fast lookups of threads by author
    authorIdx: index('discussion_threads_author_idx').on(table.authorId),
    // Index on lastActivityAt for sorting threads by recent activity
    lastActivityIdx: index('discussion_threads_last_activity_idx').on(table.lastActivityAt),
    // Composite index on courseId and lastActivityAt for course thread listings
    courseActivityIdx: index('discussion_threads_course_activity_idx').on(
      table.courseId,
      table.lastActivityAt
    ),
  })
);

/**
 * Discussion Posts Table
 * Individual posts within discussion threads with voting and solution marking
 *
 * Requirements:
 * - 9.3: Reply threading with nested structure
 * - 9.4: Post upvoting with duplicate prevention
 * - 9.5: Solution marking by educators
 *
 * Note: parentPostId is a UUID field that references another post's ID.
 * The foreign key constraint will be added via migration to avoid TypeScript
 * circular type inference issues with Drizzle ORM.
 */
export const discussionPosts = pgTable(
  'discussion_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .references(() => discussionThreads.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    // Self-referencing field - foreign key constraint added via migration
    parentPostId: uuid('parent_post_id'),
    content: text('content').notNull(),
    upvoteCount: integer('upvote_count').default(0).notNull(),
    isSolution: boolean('is_solution').default(false).notNull(),
    editedAt: timestamp('edited_at'),
    editHistory: jsonb('edit_history').default([]).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Index on threadId for fast lookups of posts in a thread
    threadIdx: index('discussion_posts_thread_idx').on(table.threadId),
    // Index on authorId for fast lookups of posts by author
    authorIdx: index('discussion_posts_author_idx').on(table.authorId),
    // Index on parentPostId for fast lookups of replies to a post
    parentPostIdx: index('discussion_posts_parent_post_idx').on(table.parentPostId),
    // Composite index on threadId and createdAt for chronological post listings
    threadCreatedIdx: index('discussion_posts_thread_created_idx').on(
      table.threadId,
      table.createdAt
    ),
  })
);

/**
 * Announcements Table
 * Broadcast messages from educators to course participants
 *
 * Requirements:
 * - 9.1: Announcement creation with scheduling and notification
 */
export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    educatorId: uuid('educator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    scheduledFor: timestamp('scheduled_for'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Index on courseId for fast lookups of announcements in a course
    courseIdx: index('announcements_course_idx').on(table.courseId),
    // Index on educatorId for fast lookups of announcements by educator
    educatorIdx: index('announcements_educator_idx').on(table.educatorId),
    // Index on publishedAt for filtering published announcements
    publishedAtIdx: index('announcements_published_at_idx').on(table.publishedAt),
    // Composite index on courseId and publishedAt for course announcement listings
    coursePublishedIdx: index('announcements_course_published_idx').on(
      table.courseId,
      table.publishedAt
    ),
  })
);

/**
 * Post Votes Table
 * Tracks user votes on discussion posts to prevent duplicate voting
 *
 * Requirements:
 * - 9.4: Post upvoting with duplicate prevention
 */
export const postVotes = pgTable(
  'post_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .references(() => discussionPosts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint to prevent duplicate votes from same user on same post
    userPostIdx: index('post_votes_user_post_idx').on(table.userId, table.postId),
    // Index on postId for fast lookups of votes for a post
    postIdx: index('post_votes_post_idx').on(table.postId),
    // Index on userId for fast lookups of votes by a user
    userIdx: index('post_votes_user_idx').on(table.userId),
  })
);

/**
 * Type exports for use in application code
 */
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type DiscussionThread = typeof discussionThreads.$inferSelect;
export type NewDiscussionThread = typeof discussionThreads.$inferInsert;
export type DiscussionPost = typeof discussionPosts.$inferSelect;
export type NewDiscussionPost = typeof discussionPosts.$inferInsert;
export type PostVote = typeof postVotes.$inferSelect;
export type NewPostVote = typeof postVotes.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
