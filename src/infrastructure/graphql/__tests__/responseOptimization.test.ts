/**
 * Response Optimization Tests
 *
 * Tests for GraphQL response optimization including field selection,
 * null value removal, and payload size reduction.
 *
 * Requirements: 15.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphQLResolveInfo, buildSchema, parse, validate, execute } from 'graphql';
import {
  optimizeResponse,
  optimizeListResponse,
  getOptimizationStats,
  resetOptimizationStats,
  withResponseOptimization,
  type ResponseOptimizationConfig,
} from '../responseOptimization.js';
import {
  createFieldSelection,
  filterObjectFields,
  removeNullValues,
  optimizeGraphQLResponse,
  isFieldRequested,
} from '../fieldSelection.js';
import {
  createConnection,
  createOptimizedConnection,
  extractPaginationInput,
} from '../pagination.js';

// Mock GraphQL schema for testing
const testSchema = buildSchema(`
  type User {
    id: ID!
    email: String!
    profile: UserProfile
    createdAt: String!
    lastLogin: String
    deletedAt: String
  }

  type UserProfile {
    fullName: String!
    bio: String
    avatarUrl: String
    preferences: JSON
  }

  type Course {
    id: ID!
    title: String!
    description: String!
    instructor: User!
    modules: [Module!]!
    enrollmentCount: Int!
    averageRating: Float
    publishedAt: String
  }

  type Module {
    id: ID!
    title: String!
    lessons: [Lesson!]!
  }

  type Lesson {
    id: ID!
    title: String!
    type: String!
  }

  type Query {
    user(id: ID!): User
    courses: [Course!]!
  }

  scalar JSON
`);

// Helper function to create mock GraphQL resolve info
function createMockResolveInfo(query: string): GraphQLResolveInfo {
  const document = parse(query);
  const operationDefinition = document.definitions[0] as any;

  return {
    fieldName: 'test',
    fieldNodes: operationDefinition.selectionSet.selections,
    returnType: {} as any,
    parentType: {} as any,
    path: { key: 'test', typename: 'Query', prev: undefined },
    schema: testSchema,
    fragments: {},
    rootValue: {},
    operation: operationDefinition,
    variableValues: {},
  };
}

describe('Field Selection', () => {
  it('should create field selection from GraphQL info', () => {
    const query = `
      query {
        user(id: "1") {
          id
          email
          profile {
            fullName
            bio
          }
        }
      }
    `;

    const info = createMockResolveInfo(query);
    const selection = createFieldSelection(info);

    expect(selection.hasField('id')).toBe(true);
    expect(selection.hasField('email')).toBe(true);
    expect(selection.hasField('profile')).toBe(true);
    expect(selection.hasField('createdAt')).toBe(false);

    const profileSelection = selection.getNestedSelection('profile');
    expect(profileSelection?.hasField('fullName')).toBe(true);
    expect(profileSelection?.hasField('bio')).toBe(true);
    expect(profileSelection?.hasField('avatarUrl')).toBe(false);
  });

  it('should filter object fields based on selection', () => {
    const query = `
      query {
        user {
          id
          email
          profile {
            fullName
          }
        }
      }
    `;

    const info = createMockResolveInfo(query);
    const selection = createFieldSelection(info);

    const userData = {
      id: '1',
      email: 'test@example.com',
      profile: {
        fullName: 'John Doe',
        bio: 'Software developer',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      createdAt: '2024-01-01T00:00:00Z',
      lastLogin: null,
    };

    const filtered = filterObjectFields(userData, selection);

    expect(filtered).toEqual({
      id: '1',
      email: 'test@example.com',
      profile: {
        fullName: 'John Doe',
      },
    });
  });

  it('should handle arrays in field selection', () => {
    const query = `
      query {
        courses {
          id
          title
          modules {
            id
            title
          }
        }
      }
    `;

    const info = createMockResolveInfo(query);
    const selection = createFieldSelection(info);

    const coursesData = [
      {
        id: '1',
        title: 'Course 1',
        description: 'Description 1',
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
            lessons: [{ id: 'lesson-1', title: 'Lesson 1', type: 'video' }],
          },
        ],
        enrollmentCount: 100,
      },
    ];

    // For arrays, we need to filter each item in the array
    const filtered = coursesData.map((course) => filterObjectFields(course, selection));

    expect(filtered).toEqual([
      {
        id: '1',
        title: 'Course 1',
        modules: [
          {
            id: 'module-1',
            title: 'Module 1',
          },
        ],
      },
    ]);
  });
});

describe('Null Value Removal', () => {
  it('should remove null and undefined values', () => {
    const data = {
      id: '1',
      name: 'John',
      email: null,
      profile: {
        bio: 'Developer',
        avatar: undefined,
        preferences: {
          theme: 'dark',
          notifications: null,
        },
      },
      tags: ['javascript', null, 'react', undefined],
    };

    const cleaned = removeNullValues(data);

    expect(cleaned).toEqual({
      id: '1',
      name: 'John',
      profile: {
        bio: 'Developer',
        preferences: {
          theme: 'dark',
        },
      },
      tags: ['javascript', 'react'],
    });
  });

  it('should handle arrays with null values', () => {
    const data = [
      { id: 1, name: 'Item 1' },
      null,
      { id: 2, name: null, description: 'Item 2' },
      undefined,
    ];

    const cleaned = removeNullValues(data);

    expect(cleaned).toEqual([
      { id: 1, name: 'Item 1' },
      { id: 2, description: 'Item 2' },
    ]);
  });
});

describe('Response Optimization', () => {
  beforeEach(() => {
    resetOptimizationStats();
  });

  it('should optimize response with field selection and null removal', () => {
    const query = `
      query {
        user {
          id
          email
          profile {
            fullName
          }
        }
      }
    `;

    const info = createMockResolveInfo(query);

    const userData = {
      id: '1',
      email: 'test@example.com',
      profile: {
        fullName: 'John Doe',
        bio: 'Software developer',
        avatarUrl: null,
      },
      createdAt: '2024-01-01T00:00:00Z',
      lastLogin: null,
      deletedAt: undefined,
    };

    const config: ResponseOptimizationConfig = {
      enableFieldSelection: true,
      removeNullValues: true,
      enableCompressionHints: false,
      logOptimizations: false,
      maxPayloadSize: 1024 * 1024,
      warnThreshold: 512 * 1024,
    };

    const { data, metrics } = optimizeResponse(userData, info, config);

    expect(data).toEqual({
      id: '1',
      email: 'test@example.com',
      profile: {
        fullName: 'John Doe',
      },
    });

    expect(metrics.reductionPercentage).toBeGreaterThan(0);
    expect(metrics.fieldsRequested).toBe(3); // id, email, profile
  });

  it('should track optimization statistics', () => {
    const query = `
      query {
        user {
          id
          email
        }
      }
    `;

    const info = createMockResolveInfo(query);

    const userData = {
      id: '1',
      email: 'test@example.com',
      profile: {
        fullName: 'John Doe',
        bio: 'Software developer',
      },
      createdAt: '2024-01-01T00:00:00Z',
    };

    optimizeResponse(userData, info);

    const stats = getOptimizationStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.totalOriginalBytes).toBeGreaterThan(0);
    expect(stats.totalOptimizedBytes).toBeGreaterThan(0);
    expect(stats.totalReductionBytes).toBeGreaterThan(0);
  });

  it('should handle optimization errors gracefully', () => {
    const query = `
      query {
        user {
          id
        }
      }
    `;

    const info = createMockResolveInfo(query);

    // Create circular reference to cause JSON.stringify to fail
    const userData: any = { id: '1' };
    userData.self = userData;

    // Mock console.error to avoid noise in test output
    const originalError = console.error;
    console.error = () => {};

    const { data, metrics } = optimizeResponse(userData, info);

    // Restore console.error
    console.error = originalError;

    // Should return original data when optimization fails
    expect(data).toBe(userData);
    expect(metrics.reductionPercentage).toBe(0);
  });
});

describe('Pagination Optimization', () => {
  it('should create optimized connection with field selection', () => {
    const query = `
      query {
        courses {
          edges {
            node {
              id
              title
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;

    const info = createMockResolveInfo(query);

    const courses = [
      {
        id: '1',
        title: 'Course 1',
        description: 'Description 1',
        enrollmentCount: 100,
        averageRating: null,
      },
      {
        id: '2',
        title: 'Course 2',
        description: 'Description 2',
        enrollmentCount: 200,
        averageRating: 4.5,
      },
    ];

    const paginationInput = { first: 10 };
    const connection = optimizeListResponse(courses, paginationInput, info, 2);

    expect(connection.edges).toHaveLength(2);
    expect(connection.edges[0].node).toEqual({
      id: '1',
      title: 'Course 1',
    });
    expect(connection.edges[1].node).toEqual({
      id: '2',
      title: 'Course 2',
    });
    expect(connection.pageInfo.hasNextPage).toBe(false);
  });

  it('should extract pagination input from arguments', () => {
    const args = {
      first: 10,
      after: 'cursor123',
    };

    const paginationInput = extractPaginationInput(args);

    expect(paginationInput).toEqual({
      first: 10,
      after: 'cursor123',
      last: undefined,
      before: undefined,
    });
  });
});

describe('Resolver Wrapper', () => {
  it('should wrap resolver with automatic optimization', async () => {
    const mockResolver = async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
      return {
        id: '1',
        name: 'Test',
        description: 'Test description',
        metadata: null,
        tags: [null, 'tag1', undefined, 'tag2'],
      };
    };

    const optimizedResolver = withResponseOptimization(mockResolver);

    const query = `
      query {
        test {
          id
          name
        }
      }
    `;

    const info = createMockResolveInfo(query);
    const result = await optimizedResolver({}, {}, {}, info);

    expect(result).toEqual({
      id: '1',
      name: 'Test',
    });
  });
});

describe('Utility Functions', () => {
  it('should check if field is requested', () => {
    const query = `
      query {
        user {
          id
          email
          profile {
            fullName
          }
        }
      }
    `;

    const info = createMockResolveInfo(query);

    expect(isFieldRequested(info, 'id')).toBe(true);
    expect(isFieldRequested(info, 'email')).toBe(true);
    expect(isFieldRequested(info, 'profile')).toBe(true);
    expect(isFieldRequested(info, 'createdAt')).toBe(false);
  });

  it('should handle complex nested queries', () => {
    const query = `
      query {
        courses {
          id
          title
          instructor {
            id
            profile {
              fullName
            }
          }
          modules {
            id
            lessons {
              id
              title
            }
          }
        }
      }
    `;

    const info = createMockResolveInfo(query);
    const selection = createFieldSelection(info);

    expect(selection.hasField('id')).toBe(true);
    expect(selection.hasField('title')).toBe(true);
    expect(selection.hasField('instructor')).toBe(true);
    expect(selection.hasField('modules')).toBe(true);

    const instructorSelection = selection.getNestedSelection('instructor');
    expect(instructorSelection?.hasField('id')).toBe(true);
    expect(instructorSelection?.hasField('profile')).toBe(true);

    const profileSelection = instructorSelection?.getNestedSelection('profile');
    expect(profileSelection?.hasField('fullName')).toBe(true);

    const modulesSelection = selection.getNestedSelection('modules');
    expect(modulesSelection?.hasField('id')).toBe(true);
    expect(modulesSelection?.hasField('lessons')).toBe(true);

    const lessonsSelection = modulesSelection?.getNestedSelection('lessons');
    expect(lessonsSelection?.hasField('id')).toBe(true);
    expect(lessonsSelection?.hasField('title')).toBe(true);
  });
});
