# Frontend Foundation Layer

A comprehensive, production-ready foundation layer for a Next.js frontend application that communicates with a GraphQL-based Learning Management System backend.

## Project Setup Complete ✅

This project has been initialized with all core infrastructure and dependencies required for building a type-safe, performant, and developer-friendly frontend application.

### What's Been Set Up

#### 1. Core Dependencies ✅
- **Next.js 16** - React framework with App Router
- **TypeScript 5** - Strict type safety enabled
- **Apollo Client 4** - GraphQL client with caching
- **GraphQL Code Generator** - Automatic type generation from schema
- **Vitest** - Fast unit testing framework
- **fast-check** - Property-based testing library
- **React Testing Library** - Component testing utilities
- **jose** - JWT token handling
- **date-fns** - Date manipulation utilities
- **zod** - Runtime validation
- **graphql-ws** - WebSocket subscriptions

#### 2. TypeScript Configuration ✅
- Strict mode enabled with comprehensive type checking
- Path aliases configured for clean imports:
  - `@/*` → `./src/*`
  - `@/lib/*` → `./src/lib/*`
  - `@/hooks/*` → `./src/hooks/*`
  - `@/types/*` → `./src/types/*`
  - `@/components/*` → `./src/components/*`
  - `@/utils/*` → `./src/utils/*`
  - `@/test/*` → `./src/test/*`
- Exact optional property types
- No unchecked indexed access
- No implicit returns
- No fallthrough cases in switch statements

#### 3. Testing Infrastructure ✅
- **Vitest** configured with jsdom environment
- **Property-based testing** utilities with fast-check
- Minimum 100 iterations per property test (as required by spec)
- Test data generators for GraphQL-compatible data
- Property test patterns (round-trip, idempotence, invariants, metamorphic)
- Mock providers and test factories
- Global test configuration and setup

#### 4. GraphQL Code Generation ✅
- Automatic type generation from GraphQL schema
- TypeScript types for queries, mutations, and subscriptions
- React Apollo hooks generation
- Form input types generation
- Introspection result for development tools
- Watch mode for development
- Strict scalar type mappings
- Consistent naming conventions

#### 5. Code Quality Tools ✅
- **ESLint** configured with Next.js and TypeScript rules
- **Prettier** configured for consistent formatting
- Pre-commit hooks ready for integration
- Strict linting rules with warnings for `any` types

#### 6. Project Structure ✅
```
web/
├── src/
│   ├── lib/              # Core infrastructure
│   │   ├── graphql/      # Apollo Client (to be implemented)
│   │   ├── auth/         # Authentication (to be implemented)
│   │   └── config.ts     # Configuration ✅
│   ├── hooks/            # React hooks (to be implemented)
│   ├── types/            # TypeScript types
│   │   ├── schema.ts     # Generated GraphQL types ✅
│   │   ├── forms.ts      # Generated form types ✅
│   │   └── index.ts      # Custom types ✅
│   ├── test/             # Testing utilities
│   │   ├── setup.ts      # Test setup ✅
│   │   └── property-test-utils.ts  # Property testing ✅
│   └── graphql/          # GraphQL operations
│       └── operations.graphql  # Sample operations ✅
├── scripts/
│   └── extract-schema.js # Schema extraction ✅
├── codegen.yml           # Code generation config ✅
├── vitest.config.ts      # Test configuration ✅
├── tsconfig.json         # TypeScript config ✅
├── .eslintrc.json        # ESLint config ✅
└── .prettierrc.json      # Prettier config ✅
```

## Getting Started

### Prerequisites
- Node.js 20+ installed
- Backend GraphQL server running (optional for development)

### Installation
Dependencies are already installed. If you need to reinstall:
```bash
npm install
```

### Development Commands

#### Run Development Server
```bash
npm run dev
```

#### Generate GraphQL Types
```bash
# Extract schema from running backend and generate types
npm run codegen

# Watch mode for automatic regeneration
npm run codegen:watch

# Development mode (extract + watch)
npm run codegen:dev
```

#### Testing
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui

# Coverage report
npm run test:coverage
```

#### Code Quality
```bash
# Lint code
npm run lint

# Format code (when prettier is configured)
npx prettier --write .
```

### Configuration

#### Environment Variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
NEXT_PUBLIC_WS_ENDPOINT=ws://localhost:4000/graphql
NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
NEXT_PUBLIC_JWT_SECRET=your-secret-key
```

#### GraphQL Schema
The project includes a placeholder schema. To use the real backend schema:
1. Start the backend server
2. Run `npm run codegen`
3. Types will be automatically generated in `src/types/schema.ts`

## Property-Based Testing

This project uses property-based testing to ensure correctness across many input variations.

### Configuration
- Minimum 100 iterations per test (as required by spec)
- Configurable seed for reproducibility
- Verbose mode in development

### Usage Example
```typescript
import { propertyTest, generators } from '@/test/property-test-utils';
import * as fc from 'fast-check';

/**
 * Feature: frontend-foundation, Property 1: Example Property
 */
propertyTest(
  'should maintain invariant',
  fc.tuple(generators.id(), generators.email()),
  ([id, email]) => {
    // Test logic here
    expect(id).toBeTruthy();
    expect(email).toContain('@');
  }
);
```

### Available Generators
- `generators.id()` - UUID
- `generators.email()` - Email address
- `generators.userProfile()` - Complete user object
- `generators.course()` - Course object
- `generators.enrollment()` - Enrollment object
- `generators.uploadProgress()` - Upload progress
- And many more...

## Next Steps

The foundation is ready! Here's what comes next:

### Task 2: GraphQL Client Foundation
- [ ] Create Apollo Client configuration
- [ ] Implement authentication link
- [ ] Create error handling link
- [ ] Implement retry link with exponential backoff

### Task 3: Authentication System
- [ ] Build JWT token management
- [ ] Create React Context for auth state
- [ ] Implement role-based access control
- [ ] Set up secure token storage

### Task 4: Core Data Fetching Hooks
- [ ] Create domain-specific hooks for all backend modules
- [ ] Implement consistent API patterns
- [ ] Add optimistic updates

### Task 5: Real-time Subscription System
- [ ] Implement WebSocket connection management
- [ ] Create subscription hooks
- [ ] Add automatic reconnection

## Testing Strategy

### Dual Testing Approach
1. **Unit Tests**: Specific examples, edge cases, error conditions
2. **Property Tests**: Universal properties across all inputs

Both are complementary and necessary for comprehensive coverage.

### Running Tests
```bash
# All tests
npm test

# Specific test file
npm test src/lib/__tests__/config.test.ts

# Watch mode
npm run test:watch
```

## Architecture

### Module Organization
- `lib/` - Core infrastructure (GraphQL, auth, uploads, subscriptions)
- `hooks/` - Domain-specific React hooks
- `types/` - TypeScript type definitions
- `test/` - Testing utilities and setup

### Integration with Backend
The foundation layer maps to the backend's 11 core modules:
1. Users - Authentication, profiles
2. Courses - Course management
3. Content - File uploads, video processing
4. Assessments - Quizzes, assignments
5. Enrollments - Progress tracking
6. Communication - Messaging, discussions
7. Notifications - Real-time notifications
8. Payments - Stripe integration
9. Search - Elasticsearch integration
10. Analytics - Progress analytics
11. Admin - Platform administration

## Contributing

### Code Style
- Use TypeScript strict mode
- Follow ESLint rules
- Format with Prettier
- Write tests for new features
- Document public APIs with JSDoc

### Testing Requirements
- Write both unit tests and property tests
- Property tests must run minimum 100 iterations
- Tag property tests with feature and property number
- Use test data generators for consistency

## Documentation

- [Requirements](.kiro/specs/frontend-foundation/requirements.md)
- [Design](.kiro/specs/frontend-foundation/design.md)
- [Tasks](.kiro/specs/frontend-foundation/tasks.md)

## License

Private - Learning Management System Project
