/**
 * GraphQL Schema for Users Module
 * 
 * Defines GraphQL types, inputs, and schema for user authentication,
 * authorization, and profile management operations.
 * 
 * Requirements: 21.1, 21.2, 21.3
 */

import { gql } from 'graphql-tag';

/**
 * GraphQL type definitions for users module
 */
export const userTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON

  # Enums
  enum Role {
    STUDENT
    EDUCATOR
    ADMIN
  }

  # Object Types
  type User {
    id: ID!
    email: String!
    role: Role!
    emailVerified: Boolean!
    lastLogin: DateTime
    profile: UserProfile!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserProfile {
    fullName: String!
    bio: String
    avatarUrl: String
    timezone: String!
    language: String!
    notificationPreferences: NotificationPreferences!
    privacySettings: PrivacySettings!
  }

  type NotificationPreferences {
    email: EmailNotificationSettings
    push: PushNotificationSettings
    inApp: InAppNotificationSettings
  }

  type EmailNotificationSettings {
    newMessage: Boolean
    assignmentDue: Boolean
    gradePosted: Boolean
    courseUpdate: Boolean
    announcement: Boolean
    discussionReply: Boolean
  }

  type PushNotificationSettings {
    newMessage: Boolean
    assignmentDue: Boolean
    gradePosted: Boolean
    courseUpdate: Boolean
    announcement: Boolean
    discussionReply: Boolean
  }

  type InAppNotificationSettings {
    newMessage: Boolean
    assignmentDue: Boolean
    gradePosted: Boolean
    courseUpdate: Boolean
    announcement: Boolean
    discussionReply: Boolean
  }

  type PrivacySettings {
    profileVisibility: ProfileVisibility
    showEmail: Boolean
    showEnrollments: Boolean
    showAchievements: Boolean
  }

  enum ProfileVisibility {
    PUBLIC
    PRIVATE
    CONNECTIONS
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  # Input Types
  input RegisterInput {
    email: String!
    password: String!
    fullName: String!
    role: Role!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input UpdateProfileInput {
    fullName: String
    bio: String
    timezone: String
    language: String
  }

  input NotificationPreferencesInput {
    email: EmailNotificationSettingsInput
    push: PushNotificationSettingsInput
    inApp: InAppNotificationSettingsInput
  }

  input EmailNotificationSettingsInput {
    newMessage: Boolean
    assignmentDue: Boolean
    gradePosted: Boolean
    courseUpdate: Boolean
    announcement: Boolean
    discussionReply: Boolean
  }

  input PushNotificationSettingsInput {
    newMessage: Boolean
    assignmentDue: Boolean
    gradePosted: Boolean
    courseUpdate: Boolean
    announcement: Boolean
    discussionReply: Boolean
  }

  input InAppNotificationSettingsInput {
    newMessage: Boolean
    assignmentDue: Boolean
    gradePosted: Boolean
    courseUpdate: Boolean
    announcement: Boolean
    discussionReply: Boolean
  }

  input PrivacySettingsInput {
    profileVisibility: ProfileVisibility
    showEmail: Boolean
    showEnrollments: Boolean
    showAchievements: Boolean
  }

  input UpdateNotificationPreferencesInput {
    preferences: NotificationPreferencesInput!
  }

  input RequestPasswordResetInput {
    email: String!
  }

  input ResetPasswordInput {
    token: String!
    newPassword: String!
  }

  input VerifyEmailInput {
    token: String!
  }

  # Mutations
  type Mutation {
    # Authentication mutations
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refreshToken: AuthPayload!
    logout: Boolean!
    
    # Email verification and password reset
    verifyEmail(input: VerifyEmailInput!): Boolean!
    requestPasswordReset(input: RequestPasswordResetInput!): Boolean!
    resetPassword(input: ResetPasswordInput!): Boolean!
    
    # Profile management
    updateProfile(input: UpdateProfileInput!): UserProfile!
    updateNotificationPreferences(input: UpdateNotificationPreferencesInput!): UserProfile!
  }

  # Queries
  type Query {
    # Current user query (requires authentication)
    me: User!
    
    # Get user by ID (requires appropriate permissions)
    user(id: ID!): User
  }
`;