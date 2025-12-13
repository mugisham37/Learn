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
  "Custom scalar type for date and time values in ISO 8601 format"
  scalar DateTime

  "Custom scalar type for arbitrary JSON data"
  scalar JSON

  # Enums
  "User roles defining access levels and permissions within the platform"
  enum Role {
    "Student role - can enroll in courses, submit assignments, take quizzes"
    STUDENT
    "Educator role - can create courses, grade assignments, manage content"
    EDUCATOR
    "Administrator role - full platform access including user management"
    ADMIN
  }

  # Object Types
  """
  Core user entity representing a registered platform user.
  Contains authentication information and links to detailed profile data.
  """
  type User {
    "Unique identifier for the user"
    id: ID!
    "User's email address, used for authentication and communication"
    email: String!
    "User's role determining their permissions and capabilities"
    role: Role!
    "Whether the user has verified their email address"
    emailVerified: Boolean!
    "Timestamp of the user's last login session"
    lastLogin: DateTime
    "Detailed user profile information and preferences"
    profile: UserProfile!
    "Timestamp when the user account was created"
    createdAt: DateTime!
    "Timestamp when the user account was last updated"
    updatedAt: DateTime!
  }

  """
  Extended user profile containing personal information and preferences.
  Separate from core User type to allow for flexible profile management.
  """
  type UserProfile {
    "User's full display name"
    fullName: String!
    "Optional biographical information about the user"
    bio: String
    "URL to the user's profile avatar image"
    avatarUrl: String
    "User's timezone for scheduling and time display (e.g., 'America/New_York')"
    timezone: String!
    "User's preferred language code (e.g., 'en', 'es', 'fr')"
    language: String!
    "User's notification delivery preferences across all channels"
    notificationPreferences: NotificationPreferences!
    "User's privacy and visibility settings"
    privacySettings: PrivacySettings!
  }

  """
  Comprehensive notification preferences allowing users to control
  how they receive different types of notifications across multiple channels.
  """
  type NotificationPreferences {
    "Email notification preferences"
    email: EmailNotificationSettings
    "Push notification preferences for mobile devices"
    push: PushNotificationSettings
    "In-app notification preferences"
    inApp: InAppNotificationSettings
  }

  "Email notification settings for various event types"
  type EmailNotificationSettings {
    "Receive emails for new direct messages"
    newMessage: Boolean
    "Receive emails for assignment due date reminders"
    assignmentDue: Boolean
    "Receive emails when grades are posted"
    gradePosted: Boolean
    "Receive emails for course content updates"
    courseUpdate: Boolean
    "Receive emails for course announcements"
    announcement: Boolean
    "Receive emails for discussion forum replies"
    discussionReply: Boolean
  }

  "Push notification settings for mobile devices"
  type PushNotificationSettings {
    "Receive push notifications for new direct messages"
    newMessage: Boolean
    "Receive push notifications for assignment due date reminders"
    assignmentDue: Boolean
    "Receive push notifications when grades are posted"
    gradePosted: Boolean
    "Receive push notifications for course content updates"
    courseUpdate: Boolean
    "Receive push notifications for course announcements"
    announcement: Boolean
    "Receive push notifications for discussion forum replies"
    discussionReply: Boolean
  }

  "In-app notification settings displayed within the platform interface"
  type InAppNotificationSettings {
    "Show in-app notifications for new direct messages"
    newMessage: Boolean
    "Show in-app notifications for assignment due date reminders"
    assignmentDue: Boolean
    "Show in-app notifications when grades are posted"
    gradePosted: Boolean
    "Show in-app notifications for course content updates"
    courseUpdate: Boolean
    "Show in-app notifications for course announcements"
    announcement: Boolean
    "Show in-app notifications for discussion forum replies"
    discussionReply: Boolean
  }

  """
  Privacy settings controlling the visibility of user information
  to other platform users and external parties.
  """
  type PrivacySettings {
    "Overall profile visibility level"
    profileVisibility: ProfileVisibility
    "Whether to show email address in public profile"
    showEmail: Boolean
    "Whether to show course enrollments in public profile"
    showEnrollments: Boolean
    "Whether to show earned achievements and certificates in public profile"
    showAchievements: Boolean
  }

  "Profile visibility levels determining who can view user information"
  enum ProfileVisibility {
    "Profile visible to all platform users"
    PUBLIC
    "Profile visible only to the user themselves"
    PRIVATE
    "Profile visible only to connected users (classmates, instructors)"
    CONNECTIONS
  }

  """
  Authentication response payload returned after successful login or registration.
  Contains both access and refresh tokens along with user information.
  """
  type AuthPayload {
    "Short-lived JWT access token for API authentication (15 minutes)"
    accessToken: String!
    "Long-lived refresh token for obtaining new access tokens (30 days)"
    refreshToken: String!
    "Complete user information including profile data"
    user: User!
  }

  """
  Token refresh response payload containing new authentication tokens.
  Used when access token expires but refresh token is still valid.
  """
  type RefreshTokenPayload {
    "New short-lived JWT access token for API authentication"
    accessToken: String!
    "New long-lived refresh token (token rotation for security)"
    refreshToken: String!
  }

  # Input Types
  """
  Input for user registration containing required authentication
  and profile information for new account creation.
  """
  input RegisterInput {
    "Valid email address for account authentication"
    email: String!
    "Password meeting strength requirements (min 8 chars, uppercase, lowercase, number)"
    password: String!
    "User's full display name"
    fullName: String!
    "Selected user role determining platform permissions"
    role: Role!
  }

  """
  Input for user authentication containing login credentials.
  """
  input LoginInput {
    "Registered email address"
    email: String!
    "User's password"
    password: String!
  }

  """
  Input for updating user profile information.
  All fields are optional, only provided fields will be updated.
  """
  input UpdateProfileInput {
    "Updated full display name"
    fullName: String
    "Updated biographical information"
    bio: String
    "Updated timezone (e.g., 'America/New_York')"
    timezone: String
    "Updated language preference (e.g., 'en', 'es')"
    language: String
  }

  """
  Input for updating notification preferences across all channels.
  Allows granular control over notification delivery methods.
  """
  input NotificationPreferencesInput {
    "Email notification preferences"
    email: EmailNotificationSettingsInput
    "Push notification preferences"
    push: PushNotificationSettingsInput
    "In-app notification preferences"
    inApp: InAppNotificationSettingsInput
  }

  "Input for configuring email notification preferences by event type"
  input EmailNotificationSettingsInput {
    "Enable/disable email notifications for new messages"
    newMessage: Boolean
    "Enable/disable email notifications for assignment due dates"
    assignmentDue: Boolean
    "Enable/disable email notifications for posted grades"
    gradePosted: Boolean
    "Enable/disable email notifications for course updates"
    courseUpdate: Boolean
    "Enable/disable email notifications for announcements"
    announcement: Boolean
    "Enable/disable email notifications for discussion replies"
    discussionReply: Boolean
  }

  "Input for configuring push notification preferences by event type"
  input PushNotificationSettingsInput {
    "Enable/disable push notifications for new messages"
    newMessage: Boolean
    "Enable/disable push notifications for assignment due dates"
    assignmentDue: Boolean
    "Enable/disable push notifications for posted grades"
    gradePosted: Boolean
    "Enable/disable push notifications for course updates"
    courseUpdate: Boolean
    "Enable/disable push notifications for announcements"
    announcement: Boolean
    "Enable/disable push notifications for discussion replies"
    discussionReply: Boolean
  }

  "Input for configuring in-app notification preferences by event type"
  input InAppNotificationSettingsInput {
    "Enable/disable in-app notifications for new messages"
    newMessage: Boolean
    "Enable/disable in-app notifications for assignment due dates"
    assignmentDue: Boolean
    "Enable/disable in-app notifications for posted grades"
    gradePosted: Boolean
    "Enable/disable in-app notifications for course updates"
    courseUpdate: Boolean
    "Enable/disable in-app notifications for announcements"
    announcement: Boolean
    "Enable/disable in-app notifications for discussion replies"
    discussionReply: Boolean
  }

  """
  Input for updating privacy settings controlling profile visibility
  and information sharing preferences.
  """
  input PrivacySettingsInput {
    "Overall profile visibility level"
    profileVisibility: ProfileVisibility
    "Whether to show email address in profile"
    showEmail: Boolean
    "Whether to show course enrollments in profile"
    showEnrollments: Boolean
    "Whether to show achievements and certificates in profile"
    showAchievements: Boolean
  }

  "Wrapper input for notification preferences update operation"
  input UpdateNotificationPreferencesInput {
    "Updated notification preferences configuration"
    preferences: NotificationPreferencesInput!
  }

  "Input for requesting password reset email"
  input RequestPasswordResetInput {
    "Email address of account requiring password reset"
    email: String!
  }

  "Input for resetting password with valid reset token"
  input ResetPasswordInput {
    "Password reset token received via email"
    token: String!
    "New password meeting strength requirements"
    newPassword: String!
  }

  "Input for email verification with verification token"
  input VerifyEmailInput {
    "Email verification token received via email"
    token: String!
  }

  "Input for token refresh operation"
  input RefreshTokenInput {
    "Valid refresh token for obtaining new access token"
    refreshToken: String!
  }

  "Input for user logout operation"
  input LogoutInput {
    "Optional refresh token to invalidate (recommended for security)"
    refreshToken: String
  }

  # Mutations
  type Mutation {
    # Authentication mutations
    """
    Register a new user account with email, password, and role selection.

    Example:
    mutation {
      register(input: {
        email: "student@example.com"
        password: "SecurePass123!"
        fullName: "John Doe"
        role: STUDENT
      }) {
        accessToken
        user {
          id
          email
          role
          profile {
            fullName
          }
        }
      }
    }

    Requirements: 1.1, 1.2, 1.3
    """
    register(input: RegisterInput!): AuthPayload!

    """
    Authenticate user with email and password credentials.

    Example:
    mutation {
      login(input: {
        email: "student@example.com"
        password: "SecurePass123!"
      }) {
        accessToken
        refreshToken
        user {
          id
          email
          emailVerified
        }
      }
    }

    Requirements: 1.6
    """
    login(input: LoginInput!): AuthPayload!

    """
    Obtain new access token using valid refresh token.

    Example:
    mutation {
      refreshToken(input: {
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }) {
        accessToken
        refreshToken
      }
    }

    Requirements: 1.7
    """
    refreshToken(input: RefreshTokenInput!): RefreshTokenPayload!

    """
    Log out user and invalidate refresh token.

    Example:
    mutation {
      logout(input: {
        refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      })
    }

    Requirements: 1.7
    """
    logout(input: LogoutInput): Boolean!

    # Email verification and password reset
    """
    Verify user email address using verification token sent via email.

    Example:
    mutation {
      verifyEmail(input: {
        token: "abc123def456"
      })
    }

    Requirements: 1.5
    """
    verifyEmail(input: VerifyEmailInput!): Boolean!

    """
    Request password reset email with reset token.

    Example:
    mutation {
      requestPasswordReset(input: {
        email: "user@example.com"
      })
    }

    Requirements: 1.5
    """
    requestPasswordReset(input: RequestPasswordResetInput!): Boolean!

    """
    Reset password using valid reset token and new password.

    Example:
    mutation {
      resetPassword(input: {
        token: "reset123token456"
        newPassword: "NewSecurePass123!"
      })
    }

    Requirements: 1.5
    """
    resetPassword(input: ResetPasswordInput!): Boolean!

    # Profile management
    """
    Update user profile information including name, bio, and preferences.

    Example:
    mutation {
      updateProfile(input: {
        fullName: "John Smith"
        bio: "Software engineering student"
        timezone: "America/New_York"
      }) {
        fullName
        bio
        timezone
      }
    }

    Requirements: 10.7
    """
    updateProfile(input: UpdateProfileInput!): UserProfile!

    """
    Update notification preferences across all channels and event types.

    Example:
    mutation {
      updateNotificationPreferences(input: {
        preferences: {
          email: {
            newMessage: true
            assignmentDue: true
            gradePosted: false
          }
        }
      }) {
        notificationPreferences {
          email {
            newMessage
            assignmentDue
          }
        }
      }
    }

    Requirements: 10.7
    """
    updateNotificationPreferences(input: UpdateNotificationPreferencesInput!): UserProfile!
  }

  # Queries
  type Query {
    """
    Get current authenticated user's complete profile information.
    Requires valid authentication token in Authorization header.

    Example:
    query {
      me {
        id
        email
        role
        emailVerified
        profile {
          fullName
          bio
          avatarUrl
          notificationPreferences {
            email {
              newMessage
              assignmentDue
            }
          }
        }
      }
    }

    Requirements: 21.2, 21.7
    """
    me: User!

    """
    Get user information by ID. Requires appropriate permissions:
    - Users can view their own profile
    - Educators can view enrolled students' profiles
    - Admins can view any user profile

    Example:
    query {
      user(id: "123e4567-e89b-12d3-a456-426614174000") {
        id
        email
        role
        profile {
          fullName
          bio
        }
      }
    }

    Requirements: 21.2, 2.4
    """
    user(id: ID!): User
  }
`;
