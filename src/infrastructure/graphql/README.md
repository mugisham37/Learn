# GraphQL DataLoader Implementation

This document explains the DataLoader implementation for preventing N+1 query problems in GraphQL resolvers.

## Overview

DataLoaders provide efficient batching and caching for GraphQL field resolvers. They solve the N+1 query problem by:

1. **Batching**: Collecting multiple individual requests and executing them as a single batch operation
2. **Caching**: Storing results within a single request to avoid duplicate queries
3. **Request Scoping**: Ensuring caches are isolated per GraphQL request

## Architecture

### DataLoader Classes

Each module has its own DataLoader class:

- **UserDataLoaders**: Handles user and user profile data
- **CourseDataLoaders**: Handles courses, modules, and lessons
- **EnrollmentDataLoaders**: Handles enrollments and progress data

### Factory Pattern

The `dataLoaderFactory.ts` provides centralized DataLoader creation and management:

```typescript
import { createDataLoaders } from './dataLoaderFactory.js';

const dataloaders = await createDataLoaders(requestId);
```

### GraphQL Context Integration

DataLoaders are added to the GraphQL context and available in all resolvers:

```typescript
export interface GraphQLContext {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  requestId: string;
  dataloaders?: {
    users?: UserDataLoaders;
    courses?: CourseDataLoaders;
    enrollments?: EnrollmentDataLoaders;
  };
}
```

## Usage Examples

### Basic DataLoader Usage

```typescript
// In a GraphQL resolver
const courseResolvers = {
  Course: {
    // Load instructor using DataLoader
    instructor: async (course: Course, _args: unknown, context: GraphQLContext) => {
      return await context.dataloaders.users?.userById.load(course.instructorId);
    },

    // Load modules using DataLoader
    modules: async (course: Course, _args: unknown, context: GraphQLContext) => {
      return await context.dataloaders.courses?.modulesByCourseId.load(course.id);
    }
  }
};
```

### Batching Example

When multiple courses need their instructors loaded:

```typescript
// Without DataLoader (N+1 problem):
// Query 1: SELECT * FROM courses WHERE ...
// Query 2: SELECT * FROM users WHERE id = 'instructor1'
// Query 3: SELECT * FROM users WHERE id = 'instructor2'
// Query 4: SELECT * FROM users WHERE id = 'instructor3'
// ... (N additional queries)

// With DataLoader (batched):
// Query 1: SELECT * FROM courses WHERE ...
// Query 2: SELECT * FROM users WHERE id IN ('instructor1', 'instructor2', 'instructor3', ...)
```

### Caching Example

Within a single request, repeated access to the same data is cached:

```typescript
// First access - loads from database
const user1 = await context.dataloaders.users?.userById.load('user-123');

// Second access - returns cached result
const user2 = await context.dataloaders.users?.userById.load('user-123');

// user1 === user2 (same object reference)
```

## DataLoader Configuration

Each DataLoader is configured with:

- **maxBatchSize**: Maximum number of keys to batch (default: 100)
- **batchScheduleFn**: Timing function for batching (default: 10ms delay)
- **cache**: Enable/disable caching (default: true)

```typescript
new DataLoader<string, User | null>(
  async (userIds: readonly string[]) => {
    // Batch loading logic
  },
  {
    cache: true,
    maxBatchSize: 100,
    batchScheduleFn: (callback: () => void) => setTimeout(callback, 10)
  }
);
```

## Available DataLoaders

### User DataLoaders

```typescript
interface UserDataLoaders {
  userById: DataLoader<string, User | null>;
  usersByIds: DataLoader<string, User[]>;
  userProfileById: DataLoader<string, UserProfile | null>;
}
```

### Course DataLoaders

```typescript
interface CourseDataLoaders {
  courseById: DataLoader<string, Course | null>;
  coursesByInstructorId: DataLoader<string, Course[]>;
  modulesByCourseId: DataLoader<string, CourseModule[]>;
  moduleById: DataLoader<string, CourseModule | null>;
  lessonsByModuleId: DataLoader<string, Lesson[]>;
  lessonById: DataLoader<string, Lesson | null>;
}
```

### Enrollment DataLoaders

```typescript
interface EnrollmentDataLoaders {
  enrollmentById: DataLoader<string, Enrollment | null>;
  enrollmentsByStudentId: DataLoader<string, Enrollment[]>;
  enrollmentsByCourseId: DataLoader<string, Enrollment[]>;
  enrollmentProgressById: DataLoader<string, EnrollmentProgressSummary | null>;
}
```

## Cache Management

### Clearing Caches

```typescript
import { clearDataLoaderCaches } from './dataLoaderFactory.js';

// Clear all caches when data is updated
clearDataLoaderCaches(context.dataloaders);
```

### Priming Caches

```typescript
import { primeDataLoaderCaches } from './dataLoaderFactory.js';

// Prime caches with known data
primeDataLoaderCaches(context.dataloaders, {
  users: [{ id: 'user-1', email: 'test@example.com' }],
  courses: [{ id: 'course-1', title: 'Test Course' }]
});
```

## Best Practices

### 1. Always Use DataLoaders for Related Data

```typescript
// ❌ Bad: Direct database query in resolver
const instructor = await userRepository.findById(course.instructorId);

// ✅ Good: Use DataLoader
const instructor = await context.dataloaders.users?.userById.load(course.instructorId);
```

### 2. Handle Null/Undefined Gracefully

```typescript
// ✅ Good: Safe DataLoader access
const instructor = await context.dataloaders.users?.userById.load(course.instructorId);
if (!instructor) {
  throw new GraphQLError('Instructor not found');
}
```

### 3. Batch Related Operations

```typescript
// ✅ Good: Load all modules at once
const modules = await context.dataloaders.courses?.modulesByCourseId.load(course.id);

// Then load all lessons for all modules
const allLessons = await Promise.all(
  modules.map(module => 
    context.dataloaders.courses?.lessonsByModuleId.load(module.id)
  )
);
```

### 4. Clear Caches After Mutations

```typescript
const updateCourse = async (parent: unknown, args: { id: string; input: UpdateCourseInput }, context: GraphQLContext) => {
  const updatedCourse = await context.courseService.updateCourse(args.id, args.input);
  
  // Clear relevant caches
  context.dataloaders.courses?.courseById.clear(args.id);
  
  return updatedCourse;
};
```

## Performance Benefits

### Before DataLoaders (N+1 Problem)

```
Query: Get 10 courses with their instructors
- 1 query to get courses
- 10 queries to get each instructor
Total: 11 database queries
```

### After DataLoaders (Batched)

```
Query: Get 10 courses with their instructors
- 1 query to get courses
- 1 batched query to get all instructors
Total: 2 database queries
```

### Caching Benefits

```
Query: Get course details multiple times in same request
- First access: 1 database query
- Subsequent accesses: 0 database queries (cached)
```

## Testing DataLoaders

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createUserDataLoaders } from '../dataloaders.js';

describe('UserDataLoaders', () => {
  it('should batch user queries', async () => {
    const mockRepository = {
      findById: vi.fn()
    };
    
    const dataloaders = createUserDataLoaders({ userRepository: mockRepository });
    
    // Load multiple users
    const [user1, user2] = await Promise.all([
      dataloaders.userById.load('user-1'),
      dataloaders.userById.load('user-2')
    ]);
    
    // Should batch into single call
    expect(mockRepository.findById).toHaveBeenCalledTimes(2);
  });
});
```

### Integration Tests

```typescript
describe('GraphQL with DataLoaders', () => {
  it('should prevent N+1 queries', async () => {
    const query = `
      query {
        courses {
          id
          title
          instructor {
            id
            email
          }
        }
      }
    `;
    
    const result = await executeGraphQL(query, context);
    
    // Verify batching occurred
    expect(mockUserRepository.findById).toHaveBeenCalledTimes(1); // Batched call
  });
});
```

## Troubleshooting

### Common Issues

1. **DataLoader not batching**: Check that requests are made within the same event loop tick
2. **Stale cache data**: Ensure caches are cleared after mutations
3. **Memory leaks**: DataLoaders are request-scoped and should be recreated per request
4. **Type errors**: Ensure DataLoader generic types match your data models

### Debugging

```typescript
// Enable DataLoader debugging
const dataloader = new DataLoader(batchFn, {
  cache: true,
  maxBatchSize: 100,
  // Add custom name for debugging
  name: 'UserByIdLoader'
});

// Log batch operations
const batchFn = async (keys: readonly string[]) => {
  console.log(`Batching ${keys.length} user queries:`, keys);
  // ... batch loading logic
};
```

## Future Enhancements

1. **Batch Repository Methods**: Implement native batch methods in repositories
2. **Redis Caching**: Add Redis-based caching for cross-request persistence
3. **Metrics**: Add DataLoader performance metrics and monitoring
4. **Auto-generation**: Generate DataLoaders automatically from schema definitions