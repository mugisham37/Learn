/**
 * GraphQL Schema for Notifications Module
 * 
 * Defines GraphQL types, inputs, and schema for notification delivery,
 * preference management, and real-time notification subscriptions.
 * 
 * Requirements: 21.1, 21.2, 21.4
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for notifications module
 */
export const notificationTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum NotificationType {
    NEW_MESSAGE
    ASSIGNMENT_DUE
    GRADE_POSTED
    COURSE_UPDATE
    ANNOUNCEMENT
    DISCUSSION_REPLY
    ENROLLMENT_CONFIRMED
    CERTIFICATE_ISSUED
    PAYMENT_RECEIVED
    REFUND_PROCESSED
  }

  enum Priority {
    NORMAL
    HIGH
    URGENT
  }

  enum NotificationChannel {
    EMAIL
    PUSH
    IN_APP
  }

  # Object Types
  type Notification {
    id: ID!
    recipientId: ID!
    recipient: User!
    notificationType: NotificationType!
    title: String!
    content: String!
    actionUrl: String
    priority: Priority!
    isRead: Boolean!
    readAt: DateTime
    metadata: JSON
    expiresAt: DateTime
    createdAt: DateTime!
  }

  type NotificationPreference {
    notificationType: NotificationType!
    email: Boolean!
    push: Boolean!
    inApp: Boolean!
  }

  type NotificationPreferences {
    newMessage: ChannelPreferences!
    assignmentDue: ChannelPreferences!
    gradePosted: ChannelPreferences!
    courseUpdate: ChannelPreferences!
    announcement: ChannelPreferences!
    discussionReply: ChannelPreferences!
    enrollmentConfirmed: ChannelPreferences!
    certificateIssued: ChannelPreferences!
    paymentReceived: ChannelPreferences!
    refundProcessed: ChannelPreferences!
  }

  type ChannelPreferences {
    email: Boolean!
    push: Boolean!
    inApp: Boolean!
  }

  # Connection types for pagination
  type NotificationConnection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
    unreadCount: Int!
  }

  type NotificationEdge {
    node: Notification!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Input Types
  input NotificationFilter {
    notificationType: NotificationType
    priority: Priority
    isRead: Boolean
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input ChannelPreferencesInput {
    email: Boolean!
    push: Boolean!
    inApp: Boolean!
  }

  input NotificationPreferencesInput {
    newMessage: ChannelPreferencesInput
    assignmentDue: ChannelPreferencesInput
    gradePosted: ChannelPreferencesInput
    courseUpdate: ChannelPreferencesInput
    announcement: ChannelPreferencesInput
    discussionReply: ChannelPreferencesInput
    enrollmentConfirmed: ChannelPreferencesInput
    certificateIssued: ChannelPreferencesInput
    paymentReceived: ChannelPreferencesInput
    refundProcessed: ChannelPreferencesInput
  }

  input UpdateNotificationPreferencesInput {
    preferences: NotificationPreferencesInput!
  }

  input MarkNotificationReadInput {
    notificationId: ID!
  }

  input MarkAllNotificationsReadInput {
    notificationType: NotificationType
    olderThan: DateTime
  }

  # Mutations
  type Mutation {
    # Mark notifications as read
    markNotificationRead(input: MarkNotificationReadInput!): Notification!
    markAllNotificationsRead(input: MarkAllNotificationsReadInput): Boolean!
    
    # Update notification preferences
    updateNotificationPreferences(input: UpdateNotificationPreferencesInput!): NotificationPreferences!
    
    # Delete expired notifications (admin only)
    deleteExpiredNotifications: Int!
  }

  # Queries
  type Query {
    # Get user notifications with filtering and pagination
    getUserNotifications(
      filter: NotificationFilter
      pagination: PaginationInput
    ): NotificationConnection!
    
    # Get notification preferences for current user
    getNotificationPreferences: NotificationPreferences!
    
    # Get single notification by ID
    getNotification(id: ID!): Notification
    
    # Get unread notification count
    getUnreadNotificationCount(notificationType: NotificationType): Int!
  }

  # Subscriptions
  type Subscription {
    # Real-time notification delivery
    notificationReceived(userId: ID!): Notification!
    
    # Real-time notification read status updates
    notificationRead(userId: ID!): Notification!
    
    # Real-time unread count updates
    unreadCountChanged(userId: ID!): Int!
  }
`;