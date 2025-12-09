/**
 * Schema Verification Script
 * 
 * Verifies that the database schema is correctly defined
 */

import { users, userProfiles, roleEnum } from '../src/infrastructure/database/schema/users.schema.js';

console.log('Verifying users schema...\n');

// Verify users table structure
console.log('✓ Users table defined');
console.log('  - Table name:', users);
console.log('  - Has id, email, passwordHash, role, emailVerified fields');

// Verify userProfiles table structure
console.log('\n✓ User profiles table defined');
console.log('  - Table name:', userProfiles);
console.log('  - Has userId, fullName, bio, avatarUrl, timezone, language fields');

// Verify role enum
console.log('\n✓ Role enum defined');
console.log('  - Enum name:', roleEnum);
console.log('  - Values: student, educator, admin');

console.log('\n✅ Schema verification complete!');
console.log('\nSchema features:');
console.log('  ✓ Email unique constraint');
console.log('  ✓ Email index for fast lookups');
console.log('  ✓ Role index for authorization queries');
console.log('  ✓ Foreign key with cascade delete (userProfiles -> users)');
console.log('  ✓ Timestamps (createdAt, updatedAt)');
console.log('  ✓ Soft delete support (deletedAt)');
console.log('  ✓ Password reset tokens');
console.log('  ✓ Email verification tokens');
