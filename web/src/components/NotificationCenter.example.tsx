/**
 * Notification Center Example Component
 * 
 * Demonstrates comprehensive usage of the notification hooks including:
 * - Real-time notification management
 * - Notification preferences
 * - Multi-channel support
 * - Analytics and reporting
 * - Scheduling and batching
 * 
 * This is an example implementation showing best practices for
 * integrating the notification system into a React application.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  useNotificationManagement,
  useGetNotificationPreferences,
  useUpdateNotificationPreferences,
  useNotificationAnalytics,
  useMultiChannelNotifications,
  type NotificationType,
  type Priority,
  type NotificationChannel,
  type Notification,
  type NotificationFilter,
} from '../hooks';

// ============================================================================
// Example Components
// ============================================================================

interface NotificationCenterProps {
  userId: string;
  className?: string;
}

export function NotificationCenter({ userId, className }: NotificationCenterProps) {
  const [filter, setFilter] = useState<NotificationFilter>({});
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const notificationManagement = useNotificationManagement(userId, {
    filter,
    pagination: { first: 20 },
  });

  const {
    notifications,
    unreadCount,
    totalCount,
    loading,
    hasNextPage,
    fetchMore,
    markAsRead,
    markAllAsRead,
    markingAsRead,
    markingAllAsRead,
  } = notificationManagement;

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [markAllAsRead]);

  const handleFilterChange = useCallback((newFilter: NotificationFilter) => {
    setFilter(newFilter);
  }, []);

  return (
    <div className={`notification-center ${className || ''}`}>
      <NotificationHeader
        unreadCount={unreadCount}
        totalCount={totalCount}
        onMarkAllAsRead={handleMarkAllAsRead}
        onShowPreferences={() => setShowPreferences(true)}
        onShowAnalytics={() => setShowAnalytics(true)}
        markingAllAsRead={markingAllAsRead}
      />

      <NotificationFilters
        filter={filter}
        onFilterChange={handleFilterChange}
      />

      <NotificationList
        notifications={notifications}
        loading={loading}
        hasNextPage={hasNextPage}
        onMarkAsRead={handleMarkAsRead}
        onLoadMore={fetchMore || (() => Promise.resolve())}
        markingAsRead={markingAsRead}
      />

      {showPreferences && (
        <NotificationPreferencesModal
          onClose={() => setShowPreferences(false)}
        />
      )}

      {showAnalytics && (
        <NotificationAnalyticsModal
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

interface NotificationHeaderProps {
  unreadCount: number;
  totalCount: number;
  onMarkAllAsRead: () => void;
  onShowPreferences: () => void;
  onShowAnalytics: () => void;
  markingAllAsRead: boolean;
}

function NotificationHeader({
  unreadCount,
  totalCount,
  onMarkAllAsRead,
  onShowPreferences,
  onShowAnalytics,
  markingAllAsRead,
}: NotificationHeaderProps) {
  return (
    <div className="notification-header">
      <div className="header-title">
        <h2>Notifications</h2>
        <div className="notification-counts">
          <span className="unread-count">{unreadCount} unread</span>
          <span className="total-count">of {totalCount} total</span>
        </div>
      </div>

      <div className="header-actions">
        <button
          onClick={onMarkAllAsRead}
          disabled={markingAllAsRead || unreadCount === 0}
          className="mark-all-read-btn"
        >
          {markingAllAsRead ? 'Marking...' : 'Mark All Read'}
        </button>

        <button
          onClick={onShowPreferences}
          className="preferences-btn"
        >
          Preferences
        </button>

        <button
          onClick={onShowAnalytics}
          className="analytics-btn"
        >
          Analytics
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Filters Component
// ============================================================================

interface NotificationFiltersProps {
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
}

function NotificationFilters({ filter, onFilterChange }: NotificationFiltersProps) {
  const notificationTypes: NotificationType[] = [
    'NEW_MESSAGE',
    'ASSIGNMENT_DUE',
    'GRADE_POSTED',
    'COURSE_UPDATE',
    'ANNOUNCEMENT',
    'DISCUSSION_REPLY',
    'ENROLLMENT_CONFIRMED',
    'CERTIFICATE_ISSUED',
    'PAYMENT_RECEIVED',
    'REFUND_PROCESSED',
  ];

  const priorities: Priority[] = ['NORMAL', 'HIGH', 'URGENT'];

  return (
    <div className="notification-filters">
      <div className="filter-group">
        <label>Type:</label>
        <select
          value={filter.notificationType || ''}
          onChange={(e) => onFilterChange({
            ...filter,
            notificationType: e.target.value as NotificationType || undefined,
          })}
        >
          <option value="">All Types</option>
          {notificationTypes.map(type => (
            <option key={type} value={type}>
              {type.replace(/_/g, ' ').toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Priority:</label>
        <select
          value={filter.priority || ''}
          onChange={(e) => onFilterChange({
            ...filter,
            priority: e.target.value as Priority || undefined,
          })}
        >
          <option value="">All Priorities</option>
          {priorities.map(priority => (
            <option key={priority} value={priority}>
              {priority.toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Status:</label>
        <select
          value={filter.isRead === undefined ? '' : String(filter.isRead)}
          onChange={(e) => {
            const value = e.target.value;
            const newFilter: NotificationFilter = {
              ...filter,
            };
            if (value === '') {
              delete newFilter.isRead;
            } else {
              newFilter.isRead = value === 'true';
            }
            onFilterChange(newFilter);
          }}
        >
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// Notification List Component
// ============================================================================

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  hasNextPage: boolean;
  onMarkAsRead: (id: string) => void;
  onLoadMore: () => void;
  markingAsRead: boolean;
}

function NotificationList({
  notifications,
  loading,
  hasNextPage,
  onMarkAsRead,
  onLoadMore,
  markingAsRead,
}: NotificationListProps) {
  if (loading && notifications.length === 0) {
    return <div className="loading">Loading notifications...</div>;
  }

  if (notifications.length === 0) {
    return <div className="empty-state">No notifications found</div>;
  }

  return (
    <div className="notification-list">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          markingAsRead={markingAsRead}
        />
      ))}

      {hasNextPage && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="load-more-btn"
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Notification Item Component
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  markingAsRead: boolean;
}

function NotificationItem({ notification, onMarkAsRead, markingAsRead }: NotificationItemProps) {
  const handleClick = useCallback(() => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    
    // Navigate to action URL if available
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  }, [notification, onMarkAsRead]);

  const getPriorityClass = (priority: Priority) => {
    switch (priority) {
      case 'URGENT': return 'priority-urgent';
      case 'HIGH': return 'priority-high';
      default: return 'priority-normal';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div
      className={`notification-item ${!notification.isRead ? 'unread' : 'read'} ${getPriorityClass(notification.priority)}`}
      onClick={handleClick}
    >
      <div className="notification-content">
        <div className="notification-header">
          <h4 className="notification-title">{notification.title}</h4>
          <span className="notification-time">{formatDate(notification.createdAt)}</span>
        </div>
        
        <p className="notification-message">{notification.content}</p>
        
        <div className="notification-meta">
          <span className="notification-type">
            {notification.notificationType.replace(/_/g, ' ').toLowerCase()}
          </span>
          {notification.priority !== 'NORMAL' && (
            <span className={`notification-priority ${getPriorityClass(notification.priority)}`}>
              {notification.priority.toLowerCase()}
            </span>
          )}
        </div>
      </div>

      {!notification.isRead && (
        <div className="notification-actions">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            disabled={markingAsRead}
            className="mark-read-btn"
          >
            Mark as Read
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Preferences Modal Component
// ============================================================================

interface NotificationPreferencesModalProps {
  onClose: () => void;
}

function NotificationPreferencesModal({ onClose }: NotificationPreferencesModalProps) {
  const { data: preferences, loading: loadingPreferences } = useGetNotificationPreferences();
  const { mutate: updatePreferences, loading: updating } = useUpdateNotificationPreferences();

  const [localPreferences, setLocalPreferences] = useState(preferences);

  React.useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const handleSave = useCallback(async () => {
    if (!localPreferences) return;

    try {
      await updatePreferences({
        input: { preferences: localPreferences },
      });
      onClose();
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  }, [localPreferences, updatePreferences, onClose]);

  const handleChannelChange = useCallback((
    notificationType: string,
    channel: string,
    enabled: boolean
  ) => {
    if (!localPreferences) return;

    setLocalPreferences(prev => {
      if (!prev) return prev;
      const currentType = prev[notificationType as keyof typeof prev];
      if (!currentType) return prev;
      
      return {
        ...prev,
        [notificationType]: {
          ...currentType,
          [channel]: enabled,
        },
      };
    });
  }, [localPreferences]);

  if (loadingPreferences) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="loading">Loading preferences...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal preferences-modal">
        <div className="modal-header">
          <h3>Notification Preferences</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-content">
          {localPreferences && Object.entries(localPreferences).map(([type, channels]) => (
            <div key={type} className="preference-group">
              <h4>{type.replace(/([A-Z])/g, ' $1').toLowerCase()}</h4>
              <div className="channel-preferences">
                <label>
                  <input
                    type="checkbox"
                    checked={channels.email}
                    onChange={(e) => handleChannelChange(
                      type,
                      'email',
                      e.target.checked
                    )}
                  />
                  Email
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={channels.push}
                    onChange={(e) => handleChannelChange(
                      type,
                      'push',
                      e.target.checked
                    )}
                  />
                  Push
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={channels.inApp}
                    onChange={(e) => handleChannelChange(
                      type,
                      'inApp',
                      e.target.checked
                    )}
                  />
                  In-App
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updating}
            className="save-btn"
          >
            {updating ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Analytics Modal Component
// ============================================================================

interface NotificationAnalyticsModalProps {
  onClose: () => void;
}

function NotificationAnalyticsModal({ onClose }: NotificationAnalyticsModalProps) {
  const dateRange = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return {
      start: thirtyDaysAgo.toISOString(),
      end: new Date().toISOString(),
    };
  }, []);

  const {
    engagementMetrics,
    channelPerformance,
    typeBreakdown,
    loading,
    generateReport,
  } = useNotificationAnalytics({
    dateRange,
  });

  const handleExportReport = useCallback(async (format: 'pdf' | 'csv' | 'excel') => {
    try {
      await generateReport(format);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  }, [generateReport]);

  return (
    <div className="modal-overlay">
      <div className="modal analytics-modal">
        <div className="modal-header">
          <h3>Notification Analytics</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading">Loading analytics...</div>
          ) : (
            <>
              {engagementMetrics && (
                <div className="metrics-section">
                  <h4>Engagement Metrics</h4>
                  <div className="metrics-grid">
                    <div className="metric">
                      <span className="metric-label">Total Sent</span>
                      <span className="metric-value">{engagementMetrics.totalSent}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Delivery Rate</span>
                      <span className="metric-value">{(engagementMetrics.deliveryRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Open Rate</span>
                      <span className="metric-value">{(engagementMetrics.openRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Click Rate</span>
                      <span className="metric-value">{(engagementMetrics.clickRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="channel-performance-section">
                <h4>Channel Performance</h4>
                <div className="channel-list">
                  {channelPerformance.map(channel => (
                    <div key={channel.channel} className="channel-item">
                      <span className="channel-name">{channel.channel}</span>
                      <span className="channel-sent">{channel.sent} sent</span>
                      <span className="channel-delivered">{channel.delivered} delivered</span>
                      <span className="channel-engagement">{(channel.engagementRate * 100).toFixed(1)}% engagement</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="type-breakdown-section">
                <h4>Notification Types</h4>
                <div className="type-list">
                  {typeBreakdown.map(type => (
                    <div key={type.type} className="type-item">
                      <span className="type-name">{type.type.replace(/_/g, ' ')}</span>
                      <span className="type-count">{type.count}</span>
                      <span className="type-engagement">{(type.engagementRate * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <div className="export-buttons">
            <button onClick={() => handleExportReport('pdf')} className="export-btn">
              Export PDF
            </button>
            <button onClick={() => handleExportReport('csv')} className="export-btn">
              Export CSV
            </button>
            <button onClick={() => handleExportReport('excel')} className="export-btn">
              Export Excel
            </button>
          </div>
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Multi-Channel Notification Sender Example
// ============================================================================

export function MultiChannelNotificationSender() {
  const { sendMultiChannel, loading } = useMultiChannelNotifications();
  const [formData, setFormData] = useState({
    type: 'COURSE_UPDATE' as NotificationType,
    recipients: [] as string[],
    channels: ['EMAIL', 'IN_APP'] as NotificationChannel[],
    title: '',
    message: '',
    actionUrl: '',
    priority: 'NORMAL' as Priority,
  });

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await sendMultiChannel({
        type: formData.type,
        recipients: formData.recipients,
        channels: formData.channels,
        content: {
          title: formData.title,
          message: formData.message,
          ...(formData.actionUrl && { actionUrl: formData.actionUrl }),
        },
        priority: formData.priority,
        fallbackStrategy: 'cascade',
      });
      
      // Reset form
      setFormData({
        type: 'COURSE_UPDATE',
        recipients: [],
        channels: ['EMAIL', 'IN_APP'],
        title: '',
        message: '',
        actionUrl: '',
        priority: 'NORMAL',
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }, [formData, sendMultiChannel]);

  return (
    <form onSubmit={handleSend} className="multi-channel-sender">
      <h3>Send Multi-Channel Notification</h3>
      
      <div className="form-group">
        <label>Type:</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as NotificationType }))}
        >
          <option value="COURSE_UPDATE">Course Update</option>
          <option value="ASSIGNMENT_DUE">Assignment Due</option>
          <option value="GRADE_POSTED">Grade Posted</option>
          <option value="ANNOUNCEMENT">Announcement</option>
        </select>
      </div>

      <div className="form-group">
        <label>Title:</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          required
        />
      </div>

      <div className="form-group">
        <label>Message:</label>
        <textarea
          value={formData.message}
          onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          required
        />
      </div>

      <div className="form-group">
        <label>Action URL (optional):</label>
        <input
          type="url"
          value={formData.actionUrl}
          onChange={(e) => setFormData(prev => ({ ...prev, actionUrl: e.target.value }))}
        />
      </div>

      <div className="form-group">
        <label>Channels:</label>
        <div className="checkbox-group">
          {(['EMAIL', 'PUSH', 'IN_APP'] as NotificationChannel[]).map(channel => (
            <label key={channel}>
              <input
                type="checkbox"
                checked={formData.channels.includes(channel)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({ ...prev, channels: [...prev.channels, channel] }));
                  } else {
                    setFormData(prev => ({ ...prev, channels: prev.channels.filter(c => c !== channel) }));
                  }
                }}
              />
              {channel}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={loading || formData.channels.length === 0}>
        {loading ? 'Sending...' : 'Send Notification'}
      </button>
    </form>
  );
}