/**
 * Users and Authentication Schema
 * 
 * Database schema definitions for user management and authentication
 * Includes users table, user profiles, and related authentication data
 */

import { pgTable, uuid, varchar, boolean, timestamp, text, jsonb, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Role Enum
 * Defines the three user roles in the system
 */
export const roleEnum = pgEnum('role', ['student', 'educator', 'admin']);

/**
 * Users Table
 * Core user entity with authentication credentials and role information
 * 
 * Requirements:
 * - 1.1: Email validation and registration
 * - 1.2: Email uniqueness enforcement
 * - 2.1: Role-based access control
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: roleEnum('role').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  verificationToken: varchar('verification_token', { length: 255 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => ({
  // Index on email for fast lookups during login and registration
  emailIdx: index('users_email_idx').on(table.email),
  // Index on role for role-based queries and authorization checks
  roleIdx: index('users_role_idx').on(table.role),
  // Unique constraint on email is already enforced by .unique() above
}));

/**
 * User Profiles Table
 * Extended user profile information and preferences
 * 
 * Requirements:
 * - 1.1: User registration with profile data
 * - 2.1: User profile management
 */
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  language: varchar('language', { length: 10 }).default('en').notNull(),
  notificationPreferences: jsonb('notification_preferences').default({}).notNull(),
  privacySettings: jsonb('privacy_settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index on userId for fast profile lookups
  userIdIdx: uniqueIndex('user_profiles_user_id_idx').on(table.userId),
}));

/**
 * Type exports for use in application code
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
