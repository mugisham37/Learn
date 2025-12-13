/**
 * Example: Optimized GraphQL Resolver
 *
 * This example demonstrates how to use the response optimization features
 * in GraphQL resolvers to reduce payload sizes and improve performance.
 *
 * Requirements: 15.6
 */

import { GraphQLResolveInfo } from 'graphql';
import { GraphQLContext } from '../apolloServer.js';
import {
  optimizeResponse,
  optimizeListResponse,
  withResponseOptimization,
  extractPaginationInput,
  PaginationInput,
} from '../responseOptimization.js';
import {
  createFieldSelection,
  isFieldRequested,
  getNestedFieldSelection,
} from '../fieldSelection.js';

// Example: Basic optimized resolver
export const getOptimizedUser = async (
  parent: any,
  args: { id: string },
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => {
  // Fetch user data (this would typically come from a service/repository)
  const userData = {
    id: args.id,
    email: 'user@example.com',
    profile: {
      fullName: 'John Doe',
      bio: 'Software developer',
      avatarUrl: 'https://example.com/avatar.jpg',
      timezone: 'UTC',
      language: 'en',
      preferences: {
        notifications: true,
        theme: 'dark',
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    // These might be null in some cases
    lastLogin: null,
    deletedAt: null,
  };

  // Apply response optimization
  const { data } = optimizeResponse(userData, info);
  return data;
};

// Example: Optimized list resolver with pagination
export const getOptimizedCourses = async (
  parent: any,
  args: {
    filter?: {
      category?: string;
      difficulty?: string;
      instructorId?: string;
    };
    pagination?: PaginationInput;
  },
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => {
  const paginationInput = extractPaginationInput(args.pagination || {});

  // Check if we need to fetch related data based on requested fields
  const selection = createFieldSelection(info);
  const needsInstructor = selection
    .getNestedSelection('edges')
    ?.getNestedSelection('node')
    ?.hasField('instructor');

  const needsModules = selection
    .getNestedSelection('edges')
    ?.getNestedSelection('node')
    ?.hasField('modules');

  // Fetch courses (this would typically come from a service/repository)
  // Only fetch related data if it's requested in the query
  const courses = [
    {
      id: '1',
      title: 'JavaScript Fundamentals',
      description: 'Learn the basics of JavaScript',
      slug: 'javascript-fundamentals',
      category: 'programming',
      difficulty: 'beginner',
      price: 99.99,
      // Only include instructor if requested
      instructor: needsInstructor
        ? {
            id: 'instructor-1',
            email: 'instructor@example.com',
            profile: {
              fullName: 'Jane Smith',
              bio: 'Experienced developer',
            },
          }
        : undefined,
      // Only include modules if requested
      modules: needsModules
        ? [
            {
              id: 'module-1',
              title: 'Introduction',
              orderNumber: 1,
            },
          ]
        : undefined,
      enrollmentCount: 150,
      averageRating: 4.5,
      createdAt: new Date(),
      // Null values that will be removed
      publishedAt: null,
      archivedAt: null,
    },
  ];

  const totalCount = 1; // This would come from your data source

  // Create optimized connection with field selection and null removal
  return optimizeListResponse(courses, paginationInput, info, totalCount);
};

// Example: Using the withResponseOptimization wrapper
export const getOptimizedUserProfile = withResponseOptimization(
  async (
    parent: any,
    args: { userId: string },
    context: GraphQLContext,
    info: GraphQLResolveInfo
  ) => {
    // Fetch user profile data
    const profile = {
      id: args.userId,
      fullName: 'John Doe',
      bio: 'Software developer passionate about learning',
      avatarUrl: 'https://example.com/avatar.jpg',
      timezone: 'America/New_York',
      language: 'en',
      preferences: {
        emailNotifications: true,
        pushNotifications: false,
        theme: 'dark',
        language: 'en',
      },
      // These might be null
      linkedInUrl: null,
      githubUrl: null,
      websiteUrl: null,
    };

    return profile;
  }
);

// Example: Conditional data fetching based on field selection
export const getOptimizedCourse = async (
  parent: any,
  args: { id: string },
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => {
  // Check what fields are requested to avoid unnecessary data fetching
  const includeInstructor = isFieldRequested(info, 'instructor');
  const includeModules = isFieldRequested(info, 'modules');
  const includeEnrollments = isFieldRequested(info, 'enrollments');
  const includeAnalytics = isFieldRequested(info, 'analytics');

  // Base course data
  const course = {
    id: args.id,
    title: 'Advanced React Patterns',
    description: 'Learn advanced React patterns and best practices',
    slug: 'advanced-react-patterns',
    category: 'programming',
    difficulty: 'advanced',
    price: 199.99,
    status: 'published',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Conditionally fetch and include related data
  if (includeInstructor) {
    (course as any).instructor = {
      id: 'instructor-1',
      email: 'instructor@example.com',
      profile: {
        fullName: 'Jane Smith',
        bio: 'React expert with 10+ years experience',
      },
    };
  }

  if (includeModules) {
    // Get nested field selection for modules to optimize further
    const moduleSelection = getNestedFieldSelection(info, 'modules');
    const includeLessons = moduleSelection?.hasField('lessons');

    (course as any).modules = [
      {
        id: 'module-1',
        title: 'Advanced Hooks',
        description: 'Deep dive into React hooks',
        orderNumber: 1,
        // Only include lessons if requested
        lessons: includeLessons
          ? [
              {
                id: 'lesson-1',
                title: 'Custom Hooks',
                type: 'video',
                duration: 1800,
              },
            ]
          : undefined,
      },
    ];
  }

  if (includeEnrollments) {
    (course as any).enrollmentCount = 250;
    (course as any).activeEnrollments = 180;
  }

  if (includeAnalytics) {
    (course as any).analytics = {
      totalEnrollments: 250,
      completionRate: 0.85,
      averageRating: 4.7,
      totalRevenue: 49750,
    };
  }

  // Apply optimization
  const { data } = optimizeResponse(course, info);
  return data;
};

// Example: Optimized resolver with error handling
export const getOptimizedUserCourses = async (
  parent: any,
  args: {
    userId: string;
    status?: 'enrolled' | 'completed' | 'in_progress';
    pagination?: PaginationInput;
  },
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => {
  try {
    const paginationInput = extractPaginationInput(args.pagination || {});

    // Simulate fetching user courses
    const courses = [
      {
        id: '1',
        title: 'JavaScript Fundamentals',
        progress: {
          percentage: 75,
          completedLessons: 15,
          totalLessons: 20,
        },
        enrolledAt: new Date('2024-01-15'),
        lastAccessedAt: new Date('2024-01-20'),
        // Null values
        completedAt: null,
        certificateId: null,
      },
    ];

    const totalCount = 1;

    return optimizeListResponse(courses, paginationInput, info, totalCount);
  } catch (error) {
    // Log error and return optimized error response
    console.error('Failed to fetch user courses:', error);

    // Return empty connection with error information
    return optimizeListResponse([], {}, info, 0);
  }
};

// Example: Performance monitoring with optimization
export const getOptimizedAnalytics = async (
  parent: any,
  args: {
    courseId?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
  },
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => {
  const startTime = Date.now();

  try {
    // Check what analytics data is requested
    const needsCourseMetrics = isFieldRequested(info, 'courseMetrics');
    const needsStudentMetrics = isFieldRequested(info, 'studentMetrics');
    const needsTrendData = isFieldRequested(info, 'trendData');

    const analytics: any = {
      id: 'analytics-1',
      generatedAt: new Date(),
    };

    // Only fetch expensive data if requested
    if (needsCourseMetrics) {
      analytics.courseMetrics = {
        totalEnrollments: 1250,
        activeEnrollments: 890,
        completionRate: 0.72,
        averageRating: 4.3,
        totalRevenue: 124750,
      };
    }

    if (needsStudentMetrics) {
      analytics.studentMetrics = {
        totalStudents: 1250,
        activeStudents: 890,
        averageProgressPercentage: 0.65,
        averageTimeSpent: 3600, // seconds
      };
    }

    if (needsTrendData) {
      analytics.trendData = {
        enrollmentTrend: [
          { date: '2024-01-01', count: 50 },
          { date: '2024-01-02', count: 75 },
        ],
        completionTrend: [
          { date: '2024-01-01', rate: 0.7 },
          { date: '2024-01-02', rate: 0.72 },
        ],
      };
    }

    const processingTime = Date.now() - startTime;

    // Log performance metrics
    console.log(`Analytics query processed in ${processingTime}ms`, {
      courseMetrics: needsCourseMetrics,
      studentMetrics: needsStudentMetrics,
      trendData: needsTrendData,
    });

    // Apply optimization
    const { data, metrics } = optimizeResponse(analytics, info, {
      enableFieldSelection: true,
      removeNullValues: true,
      enableCompressionHints: true,
      logOptimizations: true,
      maxPayloadSize: 5 * 1024 * 1024, // 5MB
      warnThreshold: 1024 * 1024, // 1MB
    });

    return data;
  } catch (error) {
    console.error('Analytics query failed:', error);
    throw error;
  }
};
