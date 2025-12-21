/**
 * Server-side Data Fetching Utilities
 * 
 * Provides utilities for fetching data on the server-side with proper
 * authentication, caching, and error handling for Next.js pages.
 * 
 * Requirements: 8.3, 8.5
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverGraphQL } from '@/lib/graphql/serverClient';
import { nextCache } from '@/lib/cache/nextCacheIntegration';

/**
 * Authentication utilities for server-side
 */
export const serverAuth = {
  /**
   * Get access token from cookies
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const cookieStore = await cookies();
      return cookieStore.get('access-token')?.value || null;
    } catch (error) {
      console.warn('Unable to access cookies:', error);
      return null;
    }
  },

  /**
   * Require authentication - redirect if not authenticated
   */
  async requireAuth(): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) {
      redirect('/login');
    }
    return token;
  },

  /**
   * Get current user or redirect to login
   */
  async getCurrentUser() {
    const token = await this.requireAuth();
    const result = await serverGraphQL.fetchCurrentUser(token);
    
    if (result.errors || !result.data?.me) {
      redirect('/login');
    }
    
    return result.data.me;
  },

  /**
   * Check if user has required role
   */
  async requireRole(requiredRoles: string[]) {
    const user = await this.getCurrentUser();
    
    if (!requiredRoles.includes(user.role)) {
      redirect('/unauthorized');
    }
    
    return user;
  },
};

/**
 * Data fetching utilities with caching
 */
export const serverData = {
  /**
   * Fetch courses with caching
   */
  async fetchCourses(params: {
    category?: string;
    difficulty?: string;
    page?: number;
    limit?: number;
    featured?: boolean;
  } = {}) {
    const cacheKey = nextCache.keys.courseList(params);
    
    const result = await serverGraphQL.fetchCourses({
      first: params.limit || 12,
      ...(params.page && { after: btoa(`cursor:${(params.page - 1) * (params.limit || 12)}`) }),
      filter: {
        ...(params.category && { category: params.category }),
        ...(params.difficulty && { difficulty: params.difficulty }),
        ...(params.featured && { featured: params.featured }),
      },
    });

    return {
      courses: result.data?.courses?.edges?.map((edge: { node: unknown }) => edge.node) || [],
      pageInfo: result.data?.courses?.pageInfo || {},
      totalCount: result.data?.courses?.totalCount || 0,
      errors: result.errors,
    };
  },

  /**
   * Fetch course by slug with caching
   */
  async fetchCourse(slug: string, requireAuth: boolean = false) {
    const token = requireAuth ? await serverAuth.requireAuth() : await serverAuth.getAccessToken();
    
    const result = await serverGraphQL.fetchCourseBySlug(slug, token || undefined);
    
    if (result.errors || !result.data?.courseBySlug) {
      return null;
    }
    
    return result.data.courseBySlug;
  },

  /**
   * Fetch user enrollments with caching
   */
  async fetchUserEnrollments(params: {
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const token = await serverAuth.requireAuth();
    const user = await serverAuth.getCurrentUser();
    
    const cacheKey = nextCache.keys.userEnrollments(user.id, params);
    
    const result = await serverGraphQL.fetchUserEnrollments(token, {
      first: params.limit || 10,
      ...(params.page && { after: btoa(`cursor:${(params.page - 1) * (params.limit || 10)}`) }),
      filter: {
        ...(params.status && { status: params.status }),
      },
    });

    return {
      enrollments: result.data?.myEnrollments?.edges?.map((edge: { node: unknown }) => edge.node) || [],
      pageInfo: result.data?.myEnrollments?.pageInfo || {},
      totalCount: result.data?.myEnrollments?.totalCount || 0,
      errors: result.errors,
    };
  },

  /**
   * Fetch dashboard data
   */
  async fetchDashboardData() {
    const user = await serverAuth.getCurrentUser();
    
    // Fetch multiple data sources in parallel
    const [enrollmentsResult, coursesResult] = await Promise.all([
      this.fetchUserEnrollments({ limit: 5 }),
      this.fetchCourses({ featured: true, limit: 6 }),
    ]);

    return {
      user,
      recentEnrollments: enrollmentsResult.enrollments,
      featuredCourses: coursesResult.courses,
      stats: {
        totalEnrollments: enrollmentsResult.totalCount,
        completedCourses: enrollmentsResult.enrollments.filter((e: { status: string }) => e.status === 'COMPLETED').length,
      },
    };
  },

  /**
   * Fetch course management data for educators
   */
  async fetchEducatorData() {
    const user = await serverAuth.requireRole(['EDUCATOR', 'ADMIN']);
    
    // This would fetch educator-specific data
    // For now, return basic structure
    return {
      user,
      courses: [],
      analytics: {},
    };
  },

  /**
   * Fetch admin data
   */
  async fetchAdminData() {
    const user = await serverAuth.requireRole(['ADMIN']);
    
    // This would fetch admin-specific data
    // For now, return basic structure
    return {
      user,
      stats: {},
      recentActivity: [],
    };
  },
};

/**
 * Page-specific data fetching functions
 */
export const pageData = {
  /**
   * Home page data
   */
  async homePage() {
    const coursesResult = await serverData.fetchCourses({
      featured: true,
      limit: 8,
    });

    return {
      featuredCourses: coursesResult.courses,
      categories: [], // Would fetch from backend
    };
  },

  /**
   * Courses page data
   */
  async coursesPage(searchParams: {
    category?: string;
    difficulty?: string;
    page?: string;
  }) {
    const page = parseInt(searchParams.page || '1');
    const limit = 12;

    const result = await serverData.fetchCourses({
      ...(searchParams.category && { category: searchParams.category }),
      ...(searchParams.difficulty && { difficulty: searchParams.difficulty }),
      page,
      limit,
    });

    return {
      courses: result.courses,
      pageInfo: result.pageInfo,
      totalCount: result.totalCount,
      currentPage: page,
      totalPages: Math.ceil(result.totalCount / limit),
      filters: {
        category: searchParams.category,
        difficulty: searchParams.difficulty,
      },
    };
  },

  /**
   * Course detail page data
   */
  async courseDetailPage(slug: string) {
    const course = await serverData.fetchCourse(slug, false);
    
    if (!course) {
      return null;
    }

    // Check if user is enrolled (if authenticated)
    const token = await serverAuth.getAccessToken();
    const enrollment = null;
    
    if (token) {
      // Would fetch enrollment status
      // enrollment = await fetchEnrollmentStatus(course.id, token);
    }

    return {
      course,
      enrollment,
      relatedCourses: [], // Would fetch related courses
    };
  },

  /**
   * Dashboard page data
   */
  async dashboardPage() {
    return await serverData.fetchDashboardData();
  },

  /**
   * Learning page data
   */
  async learningPage(searchParams: {
    status?: string;
    page?: string;
  }) {
    const page = parseInt(searchParams.page || '1');
    
    const result = await serverData.fetchUserEnrollments({
      ...(searchParams.status && { status: searchParams.status }),
      page,
      limit: 10,
    });

    return {
      enrollments: result.enrollments,
      pageInfo: result.pageInfo,
      totalCount: result.totalCount,
      currentPage: page,
      filters: {
        status: searchParams.status,
      },
    };
  },

  /**
   * Profile page data
   */
  async profilePage() {
    const user = await serverAuth.getCurrentUser();
    
    return {
      user,
    };
  },
};

/**
 * Error handling for server-side data fetching
 */
export const serverError = {
  /**
   * Handle authentication errors
   */
  handleAuthError(error: { extensions?: { code?: string } }) {
    if (error?.extensions?.code === 'UNAUTHENTICATED') {
      redirect('/login');
    }
    throw error;
  },

  /**
   * Handle authorization errors
   */
  handleAuthzError(error: { extensions?: { code?: string } }) {
    if (error?.extensions?.code === 'FORBIDDEN') {
      redirect('/unauthorized');
    }
    throw error;
  },

  /**
   * Handle not found errors
   */
  handleNotFoundError(error: { extensions?: { code?: string } }) {
    if (error?.extensions?.code === 'NOT_FOUND') {
      redirect('/404');
    }
    throw error;
  },
};