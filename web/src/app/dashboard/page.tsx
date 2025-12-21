/**
 * Dashboard Page
 *
 * Server-side rendered dashboard with user data, enrollments, and featured courses.
 * Demonstrates Next.js framework integration with GraphQL server-side data fetching.
 *
 * Requirements: 8.3, 8.4
 */

import { Suspense } from 'react';
import Image from 'next/image';
import { ProtectedLayout } from '@/components/layouts/ProtectedLayout';
import { pageData } from '@/lib/ssr/dataFetching';
import type { DashboardData } from '@/types/admin';

/**
 * Dashboard content component
 */
function DashboardContent({ dashboardData }: { dashboardData: DashboardData }) {
  const { user, recentEnrollments, featuredCourses, stats } = dashboardData;

  return (
    <div className='space-y-6'>
      {/* Welcome Section */}
      <div className='bg-white rounded-lg shadow p-6'>
        <h1 className='text-2xl font-bold text-gray-900 mb-2'>
          Welcome back, {user.profile?.fullName || user.email}!
        </h1>
        <p className='text-gray-600'>Here&apos;s what&apos;s happening with your learning journey.</p>
      </div>

      {/* Stats Grid */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex items-center'>
            <div className='shrink-0'>
              <div className='w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center'>
                <span className='text-white text-sm font-medium'>📚</span>
              </div>
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500'>Total Enrollments</p>
              <p className='text-2xl font-semibold text-gray-900'>{stats.totalEnrollments}</p>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex items-center'>
            <div className='shrink-0'>
              <div className='w-8 h-8 bg-green-500 rounded-md flex items-center justify-center'>
                <span className='text-white text-sm font-medium'>✅</span>
              </div>
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500'>Completed Courses</p>
              <p className='text-2xl font-semibold text-gray-900'>{stats.completedCourses}</p>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg shadow p-6'>
          <div className='flex items-center'>
            <div className='shrink-0'>
              <div className='w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center'>
                <span className='text-white text-sm font-medium'>🎯</span>
              </div>
            </div>
            <div className='ml-4'>
              <p className='text-sm font-medium text-gray-500'>In Progress</p>
              <p className='text-2xl font-semibold text-gray-900'>
                {stats.totalEnrollments - stats.completedCourses}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Enrollments */}
      <div className='bg-white rounded-lg shadow'>
        <div className='px-6 py-4 border-b border-gray-200'>
          <h2 className='text-lg font-medium text-gray-900'>Recent Enrollments</h2>
        </div>
        <div className='p-6'>
          {recentEnrollments.length > 0 ? (
            <div className='space-y-4'>
              {recentEnrollments.map(enrollment => (
                <div key={enrollment.id} className='flex items-center space-x-4'>
                  <div className='shrink-0'>
                    {enrollment.course.thumbnailUrl ? (
                      <Image
                        src={enrollment.course.thumbnailUrl}
                        alt={enrollment.course.title}
                        width={48}
                        height={48}
                        className='rounded-md object-cover'
                      />
                    ) : (
                      <div className='w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center'>
                        <span className='text-gray-500 text-xs'>📖</span>
                      </div>
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-gray-900 truncate'>
                      {enrollment.course.title}
                    </p>
                    <p className='text-sm text-gray-500'>
                      by {enrollment.course.instructor.profile.fullName}
                    </p>
                  </div>
                  <div className='shrink-0'>
                    <div className='w-16 bg-gray-200 rounded-full h-2'>
                      <div
                        className='bg-blue-600 h-2 rounded-full'
                        style={{ width: `${enrollment.progressPercentage}%` }}
                      ></div>
                    </div>
                    <p className='text-xs text-gray-500 mt-1'>{enrollment.progressPercentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-8'>
              <p className='text-gray-500'>No enrollments yet.</p>
              <a
                href='/courses'
                className='mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700'
              >
                Browse Courses
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Featured Courses */}
      <div className='bg-white rounded-lg shadow'>
        <div className='px-6 py-4 border-b border-gray-200'>
          <h2 className='text-lg font-medium text-gray-900'>Featured Courses</h2>
        </div>
        <div className='p-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {featuredCourses.map(course => (
              <div key={course.id} className='border border-gray-200 rounded-lg overflow-hidden'>
                {course.thumbnailUrl ? (
                  <Image
                    src={course.thumbnailUrl}
                    alt={course.title}
                    width={400}
                    height={128}
                    className='w-full h-32 object-cover'
                  />
                ) : (
                  <div className='w-full h-32 bg-gray-200 flex items-center justify-center'>
                    <span className='text-gray-500'>📚</span>
                  </div>
                )}
                <div className='p-4'>
                  <h3 className='text-sm font-medium text-gray-900 mb-1'>{course.title}</h3>
                  <p className='text-xs text-gray-500 mb-2'>
                    by {course.instructor.profile.fullName}
                  </p>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium text-blue-600'>${course.price}</span>
                    <a
                      href={`/courses/${course.slug}`}
                      className='text-xs text-blue-600 hover:text-blue-800'
                    >
                      View Course
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading component
 */
function DashboardLoading() {
  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <div className='animate-pulse'>
          <div className='h-8 bg-gray-200 rounded w-1/3 mb-2'></div>
          <div className='h-4 bg-gray-200 rounded w-2/3'></div>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {[1, 2, 3].map(i => (
          <div key={i} className='bg-white rounded-lg shadow p-6'>
            <div className='animate-pulse'>
              <div className='h-16 bg-gray-200 rounded'></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dashboard page with server-side data fetching
 */
export default async function DashboardPage() {
  // Fetch dashboard data on server-side
  const dashboardData = await pageData.dashboardPage();

  return (
    <ProtectedLayout>
      <Suspense fallback={<DashboardLoading />}>
        <DashboardContent dashboardData={dashboardData} />
      </Suspense>
    </ProtectedLayout>
  );
}

/**
 * Metadata for the page
 */
export const metadata = {
  title: 'Dashboard - Learning Management System',
  description: 'Your personalized learning dashboard with course progress and recommendations.',
};

/**
 * Revalidation configuration
 */
export const revalidate = 60; // 1 minute
