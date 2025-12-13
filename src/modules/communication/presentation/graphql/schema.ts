/**
 * GraphQL Schema for Communication Module
 *
 * Defines GraphQL types, inputs, and schema for messaging, discussions,
 * announcements, and real-time communication operations.
 *
 * Requirements: 21.1, 21.2, 21.4
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for communication module
 */
export const communicationTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # User type (from users module)
  type User {
    id: ID!
    email: String!
    role: String!
    profile: UserProfile
    createdAt: DateTime!
  }

  type UserProfile {
    fullName: String!
    bio: String
    avatarUrl: String
  }

  # Course type (from courses module)
  type Course {
    id: ID!
    title: String!
    instructor: User!
  }

  # Enums
  enum VoteType {
    UPVOTE
    REMOVE_VOTE
  }

  enum PresenceStatus {
    ONLINE
    OFFLINE
    AWAY
  }

  # Message Types
  type Message {
    id: ID!
    sender: User!
    recipient: User!
    conversationId: String!
    subject: String
    content: String!
    attachments: [MessageAttachment!]!
    isRead: Boolean!
    readAt: DateTime
    parentMessage: Message
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type MessageAttachment {
    id: String!
    fileName: String!
    fileUrl: String!
    fileSize: Int!
    mimeType: String!
    uploadedAt: DateTime!
  }

  type Conversation {
    id: String!
    participants: [User!]!
    lastMessage: Message
    unreadCount: Int!
    updatedAt: DateTime!
  }

  # Discussion Types
  type DiscussionThread {
    id: ID!
    course: Course!
    author: User!
    category: String!
    title: String!
    content: String!
    isPinned: Boolean!
    isLocked: Boolean!
    viewCount: Int!
    replyCount: Int!
    posts: [DiscussionPost!]!
    lastActivityAt: DateTime!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type DiscussionPost {
    id: ID!
    thread: DiscussionThread!
    author: User!
    parentPost: DiscussionPost
    content: String!
    upvoteCount: Int!
    isSolution: Boolean!
    editedAt: DateTime
    editHistory: [PostEdit!]!
    isDeleted: Boolean!
    replies: [DiscussionPost!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PostEdit {
    previousContent: String!
    editedAt: DateTime!
  }

  # Announcement Types
  type Announcement {
    id: ID!
    course: Course!
    educator: User!
    title: String!
    content: String!
    scheduledFor: DateTime
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Real-time Types
  type PresenceUpdate {
    userId: ID!
    user: User!
    status: PresenceStatus!
    courseId: ID
    lastSeen: DateTime!
  }

  type TypingIndicator {
    userId: ID!
    user: User!
    conversationId: String
    threadId: ID
    isTyping: Boolean!
  }

  # Connection types for pagination
  type MessageConnection {
    edges: [MessageEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type MessageEdge {
    node: Message!
    cursor: String!
  }

  type ConversationConnection {
    edges: [ConversationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ConversationEdge {
    node: Conversation!
    cursor: String!
  }

  type DiscussionThreadConnection {
    edges: [DiscussionThreadEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type DiscussionThreadEdge {
    node: DiscussionThread!
    cursor: String!
  }

  type DiscussionPostConnection {
    edges: [DiscussionPostEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type DiscussionPostEdge {
    node: DiscussionPost!
    cursor: String!
  }

  type AnnouncementConnection {
    edges: [AnnouncementEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AnnouncementEdge {
    node: Announcement!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Input Types
  input MessageInput {
    subject: String
    content: String!
    attachments: [MessageAttachmentInput!]
    parentMessageId: ID
  }

  input MessageAttachmentInput {
    fileName: String!
    fileUrl: String!
    fileSize: Int!
    mimeType: String!
  }

  input CreateThreadInput {
    category: String!
    title: String!
    content: String!
  }

  input UpdateThreadInput {
    title: String
    content: String
    category: String
    isPinned: Boolean
    isLocked: Boolean
  }

  input ReplyToThreadInput {
    content: String!
    parentPostId: ID
  }

  input UpdatePostInput {
    content: String!
  }

  input AnnouncementInput {
    title: String!
    content: String!
    scheduledFor: DateTime
  }

  input UpdateAnnouncementInput {
    title: String
    content: String
    scheduledFor: DateTime
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input MessageFilter {
    conversationId: String
    isRead: Boolean
  }

  input ThreadFilter {
    category: String
    isPinned: Boolean
    isLocked: Boolean
    authorId: ID
  }

  input AnnouncementFilter {
    publishedOnly: Boolean
    scheduledOnly: Boolean
  }

  # Mutations
  type Mutation {
    # Message mutations
    sendMessage(recipientId: ID!, input: MessageInput!): Message!
    markMessageAsRead(messageId: ID!): Boolean!
    markConversationAsRead(conversationId: String!): Boolean!
    deleteMessage(messageId: ID!): Boolean!

    # Discussion mutations
    createDiscussionThread(courseId: ID!, input: CreateThreadInput!): DiscussionThread!
    updateDiscussionThread(threadId: ID!, input: UpdateThreadInput!): DiscussionThread!
    deleteDiscussionThread(threadId: ID!): Boolean!
    replyToThread(threadId: ID!, input: ReplyToThreadInput!): DiscussionPost!
    updatePost(postId: ID!, input: UpdatePostInput!): DiscussionPost!
    deletePost(postId: ID!): Boolean!
    votePost(postId: ID!, voteType: VoteType!): DiscussionPost!
    markSolution(postId: ID!): DiscussionPost!

    # Announcement mutations
    createAnnouncement(courseId: ID!, input: AnnouncementInput!): Announcement!
    updateAnnouncement(announcementId: ID!, input: UpdateAnnouncementInput!): Announcement!
    deleteAnnouncement(announcementId: ID!): Boolean!
    publishAnnouncement(announcementId: ID!): Announcement!

    # Real-time mutations
    updatePresence(status: PresenceStatus!, courseId: ID): Boolean!
    startTyping(conversationId: String, threadId: ID): Boolean!
    stopTyping(conversationId: String, threadId: ID): Boolean!
  }

  # Queries
  type Query {
    # Message queries
    conversations(pagination: PaginationInput): ConversationConnection!

    conversationMessages(conversationId: String!, pagination: PaginationInput): MessageConnection!

    unreadMessageCount: Int!

    # Discussion queries
    discussionThreads(
      courseId: ID!
      filter: ThreadFilter
      pagination: PaginationInput
    ): DiscussionThreadConnection!

    discussionThread(threadId: ID!): DiscussionThread

    threadPosts(threadId: ID!, pagination: PaginationInput): DiscussionPostConnection!

    # Announcement queries
    announcements(
      courseId: ID!
      filter: AnnouncementFilter
      pagination: PaginationInput
    ): AnnouncementConnection!

    announcement(announcementId: ID!): Announcement

    # Real-time queries
    coursePresence(courseId: ID!): [PresenceUpdate!]!
  }

  # Subscriptions
  type Subscription {
    # Message subscriptions
    messageReceived(userId: ID!): Message!
    conversationUpdated(userId: ID!): Conversation!

    # Discussion subscriptions
    newDiscussionPost(threadId: ID!): DiscussionPost!
    threadUpdated(threadId: ID!): DiscussionThread!
    postVoted(postId: ID!): DiscussionPost!

    # Announcement subscriptions
    announcementPublished(courseId: ID!): Announcement!

    # Real-time subscriptions
    userPresence(courseId: ID!): PresenceUpdate!
    typingIndicator(conversationId: String, threadId: ID): TypingIndicator!
  }
`;
