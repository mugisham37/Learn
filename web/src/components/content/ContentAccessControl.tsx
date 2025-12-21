/**
 * Content Access Control Component
 * 
 * Handles permission-based content access control with user-friendly
 * messaging and upgrade prompts.
 * 
 * Features:
 * - Role-based access control
 * - Course enrollment checking
 * - Subscription status validation
 * - Payment integration for upgrades
 * - Clear messaging for access restrictions
 * 
 * Requirements: 13.2, 13.3
 */

import React from 'react';
import { useCurrentUser } from '@/hooks/useUsers';
import { usePermissions } from '@/lib/auth/authHooks';
import { useCourse } from '@/hooks/useCourses';
import { useMyEnrollments } from '@/hooks/useEnrollments';

interface ContentAccessControlProps {
  courseId: string;
  lessonId: string;
  title: string;
  thumbnail?: string;
  className?: string;
}

interface AccessRestriction {
  type: 'enrollment' | 'subscription' | 'permission' | 'payment';
  message: string;
  actionText: string;
  actionUrl?: string;
  canUpgrade: boolean;
}

export function ContentAccessControl({
  courseId,
  lessonId,
  title,
  thumbnail,
  className = '',
}: ContentAccessControlProps) {
  const { data: currentUser } = useCurrentUser();
  const { hasPermission, hasRole } = usePermissions();
  const { data: course } = useCourse(courseId);
  const { data: enrollments } = useMyEnrollments();

  // Check various access restrictions
  const getAccessRestriction = (): AccessRestriction | null => {
    // Check if user is authenticated
    if (!currentUser) {
      return {
        type: 'permission',
        message: 'Please sign in to access this content',
        actionText: 'Sign In',
        actionUrl: '/login',
        canUpgrade: false,
      };
    }

    // Check basic content viewing permission
    if (!hasPermission('content:view')) {
      return {
        type: 'permission',
        message: 'You do not have permission to view content',
        actionText: 'Contact Support',
        actionUrl: '/support',
        canUpgrade: false,
      };
    }

    // Check course enrollment
    const isEnrolled = enrollments?.some(enrollment => 
      enrollment.courseId === courseId && enrollment.status === 'active'
    );

    if (!isEnrolled) {
      const isPaid = course?.price && course.price > 0;
      
      return {
        type: 'enrollment',
        message: isPaid 
          ? 'This is a premium course. Enroll to access all content.'
          : 'Enroll in this course to access the content.',
        actionText: isPaid ? 'Enroll Now' : 'Enroll Free',
        actionUrl: `/courses/${courseId}/enroll`,
        canUpgrade: true,
      };
    }

    // Check subscription status for premium content
    if (course?.isPremium && !hasRole('premium_subscriber')) {
      return {
        type: 'subscription',
        message: 'This premium content requires an active subscription',
        actionText: 'Upgrade to Premium',
        actionUrl: '/subscription/upgrade',
        canUpgrade: true,
      };
    }

    // Check payment status
    const enrollment = enrollments?.find(e => e.courseId === courseId);
    if (enrollment?.paymentStatus === 'pending') {
      return {
        type: 'payment',
        message: 'Complete your payment to access this content',
        actionText: 'Complete Payment',
        actionUrl: `/payment/complete/${enrollment.id}`,
        canUpgrade: true,
      };
    }

    return null;
  };

  const restriction = getAccessRestriction();

  if (!restriction) {
    return null; // Access granted
  }

  const handleAction = () => {
    if (restriction.actionUrl) {
      window.location.href = restriction.actionUrl;
    }
  };

  return (
    <div className={`content-access-control ${className}`}>
      <div className="access-restriction-card">
        {/* Thumbnail or placeholder */}
        <div className="content-preview">
          {thumbnail ? (
            <img 
              src={thumbnail} 
              alt={title}
              className="thumbnail"
            />
          ) : (
            <div className="thumbnail-placeholder">
              <div className="play-icon">▶️</div>
            </div>
          )}
          <div className="overlay">
            <div className="lock-icon">🔒</div>
          </div>
        </div>

        {/* Access restriction info */}
        <div className="restriction-info">
          <h3 className="content-title">{title}</h3>
          <p className="restriction-message">{restriction.message}</p>
          
          {restriction.canUpgrade && (
            <div className="upgrade-section">
              <button 
                onClick={handleAction}
                className="upgrade-button primary"
              >
                {restriction.actionText}
              </button>
              
              {restriction.type === 'enrollment' && course && (
                <div className="course-info">
                  <div className="price">
                    {course.price > 0 ? `$${course.price}` : 'Free'}
                  </div>
                  <div className="benefits">
                    <ul>
                      <li>✓ Full course access</li>
                      <li>✓ Downloadable resources</li>
                      <li>✓ Certificate of completion</li>
                      <li>✓ Lifetime access</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {restriction.type === 'subscription' && (
                <div className="subscription-info">
                  <div className="benefits">
                    <ul>
                      <li>✓ Access to all premium courses</li>
                      <li>✓ Exclusive content and features</li>
                      <li>✓ Priority support</li>
                      <li>✓ Advanced analytics</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {!restriction.canUpgrade && (
            <button 
              onClick={handleAction}
              className="action-button secondary"
            >
              {restriction.actionText}
            </button>
          )}
        </div>
      </div>

      {/* Additional context */}
      <div className="access-context">
        {restriction.type === 'enrollment' && (
          <div className="enrollment-context">
            <h4>Why enroll?</h4>
            <p>
              Enrolling gives you structured access to all course materials,
              progress tracking, and the ability to earn certificates.
            </p>
          </div>
        )}
        
        {restriction.type === 'subscription' && (
          <div className="subscription-context">
            <h4>Premium Benefits</h4>
            <p>
              Premium subscribers get access to exclusive content, advanced features,
              and priority support to accelerate their learning journey.
            </p>
          </div>
        )}
        
        {restriction.type === 'payment' && (
          <div className="payment-context">
            <h4>Secure Payment</h4>
            <p>
              Your payment is processed securely. Complete your purchase to
              immediately access all course content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Utility functions for access control
export const ContentAccessControl = {
  /**
   * Check if user can access specific content
   */
  canAccessContent: (courseId: string, lessonId: string): boolean => {
    // This would integrate with the actual permission system
    // For now, return true as a placeholder
    return true;
  },

  /**
   * Get required permission level for content
   */
  getRequiredPermission: (courseId: string, lessonId: string): string => {
    // Determine required permission based on content type
    return 'content:view';
  },

  /**
   * Check if content requires payment
   */
  requiresPayment: (courseId: string): boolean => {
    // Check if course is paid
    return false; // Placeholder
  },

  /**
   * Get upgrade URL for restricted content
   */
  getUpgradeUrl: (courseId: string, restrictionType: string): string => {
    switch (restrictionType) {
      case 'enrollment':
        return `/courses/${courseId}/enroll`;
      case 'subscription':
        return '/subscription/upgrade';
      case 'payment':
        return `/payment/${courseId}`;
      default:
        return '/';
    }
  },
};

export default ContentAccessControl;