/**
 * Protected Layout Component
 * 
 * Provides role-based layout protection with authentication checks.
 * Handles loading states, error boundaries, and role-specific UI elements.
 * 
 * Requirements: 8.1, 8.4
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ErrorBoundary } from '@/lib/errors';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallbackPath?: string;
  showSidebar?: boolean;
  showHeader?: boolean;
  className?: string;
}

interface LayoutConfig {
  showSidebar: boolean;
  showHeader: boolean;
  sidebarItems: SidebarItem[];
  headerActions: HeaderAction[];
}

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  roles?: string[];
  badge?: string;
}

interface HeaderAction {
  id: string;
  label: string;
  onClick: () => void;
  icon?: string;
  roles?: string[];
}

/**
 * Get layout configuration based on user role
 */
function getLayoutConfig(userRole: string): LayoutConfig {
  const baseConfig: LayoutConfig = {
    showSidebar: true,
    showHeader: true,
    sidebarItems: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'dashboard',
      },
      {
        id: 'courses',
        label: 'Courses',
        href: '/courses',
        icon: 'book',
      },
      {
        id: 'profile',
        label: 'Profile',
        href: '/profile',
        icon: 'user',
      },
    ],
    headerActions: [
      {
        id: 'notifications',
        label: 'Notifications',
        onClick: () => {},
        icon: 'bell',
      },
    ],
  };

  // Role-specific configurations
  switch (userRole) {
    case 'ADMIN':
      return {
        ...baseConfig,
        sidebarItems: [
          ...baseConfig.sidebarItems,
          {
            id: 'admin',
            label: 'Admin Panel',
            href: '/admin',
            icon: 'settings',
            roles: ['ADMIN'],
          },
          {
            id: 'analytics',
            label: 'Analytics',
            href: '/analytics',
            icon: 'chart',
            roles: ['ADMIN', 'EDUCATOR'],
          },
          {
            id: 'users',
            label: 'User Management',
            href: '/admin/users',
            icon: 'users',
            roles: ['ADMIN'],
          },
        ],
        headerActions: [
          ...baseConfig.headerActions,
          {
            id: 'admin-tools',
            label: 'Admin Tools',
            onClick: () => {},
            icon: 'tool',
            roles: ['ADMIN'],
          },
        ],
      };

    case 'EDUCATOR':
      return {
        ...baseConfig,
        sidebarItems: [
          ...baseConfig.sidebarItems,
          {
            id: 'my-courses',
            label: 'My Courses',
            href: '/courses/manage',
            icon: 'book-open',
            roles: ['EDUCATOR', 'ADMIN'],
          },
          {
            id: 'create-course',
            label: 'Create Course',
            href: '/courses/create',
            icon: 'plus',
            roles: ['EDUCATOR', 'ADMIN'],
          },
          {
            id: 'analytics',
            label: 'Analytics',
            href: '/analytics',
            icon: 'chart',
            roles: ['EDUCATOR', 'ADMIN'],
          },
        ],
        headerActions: [
          ...baseConfig.headerActions,
          {
            id: 'create-content',
            label: 'Create Content',
            onClick: () => {},
            icon: 'plus-circle',
            roles: ['EDUCATOR', 'ADMIN'],
          },
        ],
      };

    case 'STUDENT':
    default:
      return {
        ...baseConfig,
        sidebarItems: [
          ...baseConfig.sidebarItems,
          {
            id: 'my-learning',
            label: 'My Learning',
            href: '/learning',
            icon: 'graduation-cap',
          },
          {
            id: 'certificates',
            label: 'Certificates',
            href: '/certificates',
            icon: 'award',
          },
        ],
      };
  }
}

/**
 * Filter items based on user roles
 */
function filterByRole<T extends { roles?: string[] }>(
  items: T[],
  userRole: string
): T[] {
  return items.filter(item => 
    !item.roles || item.roles.includes(userRole)
  );
}

/**
 * Sidebar Component
 */
function Sidebar({ items, userRole }: { items: SidebarItem[]; userRole: string }) {
  const filteredItems = filterByRole(items, userRole);

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
      </div>
      <nav className="px-4 pb-4">
        <ul className="space-y-2">
          {filteredItems.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
              >
                {item.icon && (
                  <span className="mr-3 text-gray-400">
                    {/* Icon placeholder - replace with actual icon component */}
                    📄
                  </span>
                )}
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/**
 * Header Component
 */
function Header({ actions, userRole, user }: { 
  actions: HeaderAction[]; 
  userRole: string;
  user: any;
}) {
  const { logout } = useAuth();
  const filteredActions = filterByRole(actions, userRole);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Learning Management System
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {filteredActions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
                title={action.label}
              >
                {action.icon && (
                  <span>
                    {/* Icon placeholder - replace with actual icon component */}
                    🔔
                  </span>
                )}
              </button>
            ))}
            
            <div className="flex items-center space-x-3">
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  {user?.profile?.fullName || user?.email}
                </p>
                <p className="text-gray-500 capitalize">
                  {userRole.toLowerCase()}
                </p>
              </div>
              
              {user?.profile?.avatarUrl ? (
                <img
                  src={user.profile.avatarUrl}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">
                    {user?.profile?.fullName?.[0] || user?.email?.[0] || '?'}
                  </span>
                </div>
              )}
              
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Loading Component
 */
function LoadingLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Error Component
 */
function ErrorLayout({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={retry}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/**
 * Protected Layout Component
 */
export function ProtectedLayout({
  children,
  requiredRoles = [],
  fallbackPath = '/login',
  showSidebar = true,
  showHeader = true,
  className = '',
}: ProtectedLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);

  // Check authentication and authorization
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push(fallbackPath);
      return;
    }

    if (requiredRoles.length > 0 && user?.role) {
      if (!requiredRoles.includes(user.role)) {
        router.push('/unauthorized');
        return;
      }
    }

    // Set layout configuration based on user role
    if (user?.role) {
      setLayoutConfig(getLayoutConfig(user.role));
    }
  }, [isAuthenticated, isLoading, user, requiredRoles, router, fallbackPath]);

  // Show loading state
  if (isLoading || !layoutConfig) {
    return <LoadingLayout />;
  }

  // Show error if not authenticated
  if (!isAuthenticated) {
    return null; // Will redirect
  }

  // Show error if insufficient permissions
  if (requiredRoles.length > 0 && user?.role && !requiredRoles.includes(user.role)) {
    return null; // Will redirect
  }

  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorLayout error={error} retry={resetError} />
      )}
    >
      <div className={`min-h-screen bg-gray-50 ${className}`}>
        {showHeader && layoutConfig.showHeader && (
          <Header
            actions={layoutConfig.headerActions}
            userRole={user.role}
            user={user}
          />
        )}
        
        <div className="flex">
          {showSidebar && layoutConfig.showSidebar && (
            <Sidebar
              items={layoutConfig.sidebarItems}
              userRole={user.role}
            />
          )}
          
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

/**
 * Role-specific layout components
 */
export function AdminLayout({ children, ...props }: Omit<ProtectedLayoutProps, 'requiredRoles'>) {
  return (
    <ProtectedLayout requiredRoles={['ADMIN']} {...props}>
      {children}
    </ProtectedLayout>
  );
}

export function EducatorLayout({ children, ...props }: Omit<ProtectedLayoutProps, 'requiredRoles'>) {
  return (
    <ProtectedLayout requiredRoles={['EDUCATOR', 'ADMIN']} {...props}>
      {children}
    </ProtectedLayout>
  );
}

export function StudentLayout({ children, ...props }: Omit<ProtectedLayoutProps, 'requiredRoles'>) {
  return (
    <ProtectedLayout requiredRoles={['STUDENT', 'EDUCATOR', 'ADMIN']} {...props}>
      {children}
    </ProtectedLayout>
  );
}

export default ProtectedLayout;