/**
 * GraphQL Response Types
 * 
 * Defines the expected structure of GraphQL responses for server-side data fetching.
 * These types should match the actual GraphQL schema when the backend is available.
 */

// Base types
export interface User {
  id: string;
  email: string;
  role: 'STUDENT' | 'EDUCATOR' | 'ADMIN';
  emailVerified: boolean;
  profile: {
    fullName: string;
    avatarUrl?: string;
    bio?: string;
    timezone?: string;
    language?: string;
  };
  notificationPreferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
    inApp: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  price: number;
  currency: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  thumbnailUrl?: string;
  instructor: {
    id: string;
    profile: {
      fullName: string;
      avatarUrl?: string;
      bio?: string;
    };
  };
  modules?: CourseModule[];
  enrollmentCount: number;
  averageRating: number;
  reviews?: {
    edges: Array<{
      node: {
        id: string;
        rating: number;
        comment: string;
        user: {
          profile: {
            fullName: string;
            avatarUrl?: string;
          };
        };
        createdAt: string;
      };
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT';
  duration: number;
  order: number;
}

export interface Enrollment {
  id: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  progress: number;
  completedAt?: string;
  course: Course;
  enrolledAt: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

// GraphQL Response wrappers
export interface GraphQLResponse<T> {
  data: T | null;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
  loading?: boolean;
}

// Query response types
export interface MeQueryResponse {
  me: User;
}

export interface CoursesQueryResponse {
  courses: {
    edges: Array<{
      node: Course;
      cursor: string;
    }>;
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export interface CourseBySlugQueryResponse {
  courseBySlug: Course;
}

export interface MyEnrollmentsQueryResponse {
  myEnrollments: {
    edges: Array<{
      node: Enrollment;
      cursor: string;
    }>;
    pageInfo: PageInfo;
    totalCount: number;
  };
}

// Input types for queries
export interface CourseFilter {
  category?: string;
  difficulty?: string;
  featured?: boolean;
}

export interface CourseSort {
  field: 'CREATED_AT' | 'UPDATED_AT' | 'TITLE' | 'RATING';
  direction: 'ASC' | 'DESC';
}

export interface EnrollmentFilter {
  status?: string;
}

// Utility types for server functions
export interface CoursesResult {
  courses: Course[];
  pageInfo: PageInfo;
  totalCount: number;
  errors?: Array<{ message: string }>;
}

export interface EnrollmentsResult {
  enrollments: Enrollment[];
  pageInfo: PageInfo;
  totalCount: number;
  errors?: Array<{ message: string }>;
}