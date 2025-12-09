/**
 * Communication Schema Tests
 * 
 * Tests to verify the communication schema structure and exports
 */

import { describe, it, expect } from 'vitest';
import {
  messages,
  discussionThreads,
  discussionPosts,
  announcements,
  type Message,
  type NewMessage,
  type DiscussionThread,
  type NewDiscussionThread,
  type DiscussionPost,
  type NewDiscussionPost,
  type Announcement,
  type NewAnnouncement,
} from './communication.schema';

describe('Communication Schema', () => {
  describe('Table Definitions', () => {
    it('should export messages table', () => {
      expect(messages).toBeDefined();
      expect(typeof messages).toBe('object');
    });

    it('should export discussionThreads table', () => {
      expect(discussionThreads).toBeDefined();
      expect(typeof discussionThreads).toBe('object');
    });

    it('should export discussionPosts table', () => {
      expect(discussionPosts).toBeDefined();
      expect(typeof discussionPosts).toBe('object');
    });

    it('should export announcements table', () => {
      expect(announcements).toBeDefined();
      expect(typeof announcements).toBe('object');
    });
  });

  describe('Messages Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(messages);
      
      expect(columns).toContain('id');
      expect(columns).toContain('senderId');
      expect(columns).toContain('recipientId');
      expect(columns).toContain('conversationId');
      expect(columns).toContain('subject');
      expect(columns).toContain('content');
      expect(columns).toContain('attachments');
      expect(columns).toContain('isRead');
      expect(columns).toContain('readAt');
      expect(columns).toContain('parentMessageId');
      expect(columns).toContain('deletedBySender');
      expect(columns).toContain('deletedByRecipient');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });
  });

  describe('Discussion Threads Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(discussionThreads);
      
      expect(columns).toContain('id');
      expect(columns).toContain('courseId');
      expect(columns).toContain('authorId');
      expect(columns).toContain('category');
      expect(columns).toContain('title');
      expect(columns).toContain('content');
      expect(columns).toContain('isPinned');
      expect(columns).toContain('isLocked');
      expect(columns).toContain('viewCount');
      expect(columns).toContain('replyCount');
      expect(columns).toContain('lastActivityAt');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });
  });

  describe('Discussion Posts Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(discussionPosts);
      
      expect(columns).toContain('id');
      expect(columns).toContain('threadId');
      expect(columns).toContain('authorId');
      expect(columns).toContain('parentPostId');
      expect(columns).toContain('content');
      expect(columns).toContain('upvoteCount');
      expect(columns).toContain('isSolution');
      expect(columns).toContain('editedAt');
      expect(columns).toContain('editHistory');
      expect(columns).toContain('isDeleted');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });
  });

  describe('Announcements Table Structure', () => {
    it('should have all required columns', () => {
      const columns = Object.keys(announcements);
      
      expect(columns).toContain('id');
      expect(columns).toContain('courseId');
      expect(columns).toContain('educatorId');
      expect(columns).toContain('title');
      expect(columns).toContain('content');
      expect(columns).toContain('scheduledFor');
      expect(columns).toContain('publishedAt');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('updatedAt');
    });
  });

  describe('Type Exports', () => {
    it('should export Message types', () => {
      // Type check - will fail at compile time if types don't exist
      const message: Message = {} as Message;
      const newMessage: NewMessage = {} as NewMessage;
      
      expect(message).toBeDefined();
      expect(newMessage).toBeDefined();
    });

    it('should export DiscussionThread types', () => {
      // Type check - will fail at compile time if types don't exist
      const thread: DiscussionThread = {} as DiscussionThread;
      const newThread: NewDiscussionThread = {} as NewDiscussionThread;
      
      expect(thread).toBeDefined();
      expect(newThread).toBeDefined();
    });

    it('should export DiscussionPost types', () => {
      // Type check - will fail at compile time if types don't exist
      const post: DiscussionPost = {} as DiscussionPost;
      const newPost: NewDiscussionPost = {} as NewDiscussionPost;
      
      expect(post).toBeDefined();
      expect(newPost).toBeDefined();
    });

    it('should export Announcement types', () => {
      // Type check - will fail at compile time if types don't exist
      const announcement: Announcement = {} as Announcement;
      const newAnnouncement: NewAnnouncement = {} as NewAnnouncement;
      
      expect(announcement).toBeDefined();
      expect(newAnnouncement).toBeDefined();
    });
  });
});
