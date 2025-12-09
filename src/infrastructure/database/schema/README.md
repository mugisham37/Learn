# Database Schema Documentation

## Overview

This directory contains all database schema definitions using Drizzle ORM. Each schema file represents a domain module and defines the tables, enums, indexes, and relationships for that domain.

## Schema Files

### users.schema.ts
Defines user authentication and profile tables:
- **users**: Core user authentication data
- **user_profiles**: Extended user profile information
- **roleEnum**: User role enumeration (student, educator, admin)

## Usage

### Importing Schemas

```typescript
// Import specific tables
import { users, userProfiles, roleEnum } from './schema/users.schema.js';

// Import all schemas
import * as schema from './schema/index.js';
```

### Type Inference

Drizzle automatically infers TypeScript types from schema definitions:

```typescript
import { User, NewUser, UserProfile, NewUserProfile } from './schema/users.schema.js';

// User type for SELECT operations
const user: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'student@example.com',
  passwordHash: '$2b$12$...',
  role: 'student',
  emailVerified: true,
  // ... other fields
};

// NewUser type for INSERT operations
const newUser: NewUser = {
  email: 'newstudent@example.com',
  passwordHash: '$2b$12$...',
  role: 'student',
  // Optional fields can be omitted
};
```

### Using with Drizzle ORM

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { users, userProfiles } from './schema/users.schema.js';
import { eq } from 'drizzle-orm';

const db = drizzle(pool);

// Insert a new user
const [newUser] = await db.insert(users).values({
  email: 'student@example.com',
  passwordHash: hashedPassword,
  role: 'student',
}).returning();

// Query users
const allStudents = await db
  .select()
  .from(users)
  .where(eq(users.role, 'student'));

// Join with profiles
const usersWithProfiles = await db
  .select()
  .from(users)
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId));
```

## Schema Conventions

### Naming Conventions
- **Table names**: snake_case (e.g., `user_profiles`)
- **Column names**: snake_case (e.g., `email_verified`)
- **Enum names**: camelCase with 'Enum' suffix (e.g., `roleEnum`)
- **TypeScript types**: PascalCase (e.g., `User`, `UserProfile`)

### Field Types
- **IDs**: UUID with auto-generation (`uuid().primaryKey().defaultRandom()`)
- **Timestamps**: `timestamp()` with `defaultNow()` for created/updated fields
- **Booleans**: `boolean()` with explicit defaults
- **Text**: `varchar()` for limited strings, `text()` for unlimited
- **JSON**: `jsonb()` for structured data with indexing support

### Indexes
- Primary keys are automatically indexed
- Add indexes on:
  - Foreign keys
  - Frequently queried columns
  - Columns used in WHERE clauses
  - Columns used in JOIN conditions

### Foreign Keys
Always specify `onDelete` behavior:
- `cascade`: Delete related records when parent is deleted
- `set null`: Set foreign key to NULL when parent is deleted
- `restrict`: Prevent deletion if related records exist
- `no action`: Default behavior (similar to restrict)

## Migrations

### Generate Migration
After modifying schema files:
```bash
npm run db:generate
```

This creates a new migration file in the `migrations/` directory.

### Run Migrations
Apply pending migrations to the database:
```bash
npm run db:migrate
```

### Drizzle Studio
Explore the database visually:
```bash
npm run db:studio
```

## Best Practices

1. **Always add indexes** on foreign keys and frequently queried columns
2. **Use NOT NULL** for required fields to enforce data integrity
3. **Provide defaults** for boolean and timestamp fields
4. **Document complex fields** with comments
5. **Use enums** for fields with fixed set of values
6. **Implement soft deletes** with `deletedAt` timestamp when needed
7. **Add timestamps** (createdAt, updatedAt) to all tables
8. **Use JSONB** for flexible structured data that needs querying
9. **Keep schemas modular** - one file per domain module
10. **Export types** for type-safe database operations

## Schema Validation

Before committing schema changes:

1. Check TypeScript compilation:
   ```bash
   npm run build
   ```

2. Generate migration to verify schema:
   ```bash
   npm run db:generate
   ```

3. Review generated SQL in migrations folder

4. Test migration on development database:
   ```bash
   npm run db:migrate
   ```

## Troubleshooting

### Schema Not Found
Ensure the schema file is exported in `index.ts`:
```typescript
export * from './users.schema.js';
```

### Type Errors
Regenerate types after schema changes:
```bash
npm run db:generate
```

### Migration Conflicts
If multiple developers create migrations simultaneously:
1. Pull latest changes
2. Delete your local migration
3. Regenerate migration with `npm run db:generate`

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)
