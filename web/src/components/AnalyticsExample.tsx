/**
 * Analytics Example Component
 * 
 * Example usage of analytics hooks to demonstrate the implemented functionality.
 * This shows how to use the analytics module hooks in real components.
 */

import React from 'react';
import {
  useCourseAnalytics,
  useStudentMetrics,
  useDashboardData,
  useReportGeneration,
  useTrendingCourses,
} from '../hooks/useAnalytics';

/**
 * Course Analytics Dashboard Component
 */
export function CourseAnalyticsDashboard({ courseId }: { courseId: string }) {
  const { data: analytics, loading, error } = useCourseAnalytics(courseId);

  if (loading) return <div>Loading course analytics...</div>;
  if (error) return <div>Error loading analytics: {error.message}</div>;
  if (!analytics) return <div>No analytics data available</div>;

  return (
    <div className="course-analytics">
      <h2>Course Analytics</h2>
      <div className="metrics-grid">
        <div className="metric">
          <h3>Total Enrollments</h3>
          <p>{analytics.totalEnrollments}</p>
        </div>
        <div className="metric">
          <h3>Completion Rate</h3>
          <p>{analytics.completionRate}%</p>
        </div>
        <div className="metric">
          <h3>Average Rating</h3>
          <p>{analytics.averageRating || 'N/A'}</p>
        </div>
        <div className="metric">
          <h3>Total Revenue</h3>
          <p>${analytics.totalRevenue}</p>
        </div>
      </div>
      
      <div className="engagement-metrics">
        <h3>Engagement Metrics</h3>
        <ul>
          <li>Average Session Duration: {analytics.engagementMetrics.averageSessionDuration} minutes</li>
          <li>Discussion Participation: {analytics.engagementMetrics.discussionParticipationRate}%</li>
          <li>Assignment Submission Rate: {analytics.engagementMetrics.assignmentSubmissionRate}%</li>
          <li>Student Retention Rate: {analytics.engagementMetrics.studentRetentionRate}%</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Student Metrics Dashboard Component
 */
export function StudentMetricsDashboard({ userId }: { userId?: string }) {
  const { data: metrics, loading, error } = useStudentMetrics(userId);

  if (loading) return <div>Loading student metrics...</div>;
  if (error) return <div>Error loading metrics: {error.message}</div>;
  if (!metrics) return <div>No metrics data available</div>;

  return (
    <div className="student-metrics">
      <h2>Your Learning Progress</h2>
      <div className="progress-overview">
        <div className="stat">
          <h3>Courses Completed</h3>
          <p>{metrics.coursesCompleted} / {metrics.totalCoursesEnrolled}</p>
        </div>
        <div className="stat">
          <h3>Current Streak</h3>
          <p>{metrics.currentStreakDays} days</p>
        </div>
        <div className="stat">
          <h3>Performance Level</h3>
          <p>{metrics.performanceSummary.performanceLevel}</p>
        </div>
        <div className="stat">
          <h3>Engagement Level</h3>
          <p>{metrics.performanceSummary.engagementLevel}</p>
        </div>
      </div>
      
      <div className="learning-streak">
        <h3>Learning Streak</h3>
        <p>Current: {metrics.learningStreak.currentStreak} days</p>
        <p>Longest: {metrics.learningStreak.longestStreak} days</p>
        <p>Last Activity: {new Date(metrics.learningStreak.lastActivityDate).toLocaleDateString()}</p>
      </div>
      
      <div className="badges">
        <h3>Badges Earned ({metrics.badgesEarned.length})</h3>
        <div className="badge-list">
          {metrics.badgesEarned.map((badge: string, index: number) => (
            <span key={index} className="badge">{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Role-based Dashboard Component
 */
export function RoleDashboard() {
  const { data: dashboard, loading, error } = useDashboardData();

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <div>Error loading dashboard: {error.message}</div>;
  if (!dashboard) return <div>No dashboard data available</div>;

  return (
    <div className="role-dashboard">
      <h2>Dashboard</h2>
      
      {dashboard.studentMetrics && (
        <div className="student-dashboard">
          <h3>Student Dashboard</h3>
          <div className="quick-stats">
            <p>Enrolled Courses: {dashboard.studentMetrics.enrolledCourses}</p>
            <p>Completed Courses: {dashboard.studentMetrics.completedCourses}</p>
            <p>Current Streak: {dashboard.studentMetrics.currentStreak} days</p>
            <p>Badges Earned: {dashboard.studentMetrics.badgesEarned}</p>
          </div>
          
          <div className="upcoming-deadlines">
            <h4>Upcoming Deadlines</h4>
            {dashboard.studentMetrics.upcomingDeadlines.map((deadline: { assignmentName: string; courseName: string; dueDate: string }, index: number) => (
              <div key={index} className="deadline">
                <p>{deadline.assignmentName} - {deadline.courseName}</p>
                <p>Due: {new Date(deadline.dueDate).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {dashboard.educatorMetrics && (
        <div className="educator-dashboard">
          <h3>Educator Dashboard</h3>
          <div className="educator-stats">
            <p>Total Courses: {dashboard.educatorMetrics.totalCourses}</p>
            <p>Published Courses: {dashboard.educatorMetrics.publishedCourses}</p>
            <p>Total Students: {dashboard.educatorMetrics.totalStudents}</p>
            <p>Average Rating: {dashboard.educatorMetrics.averageRating}</p>
            <p>Pending Grading: {dashboard.educatorMetrics.pendingGrading}</p>
          </div>
        </div>
      )}
      
      {dashboard.adminMetrics && (
        <div className="admin-dashboard">
          <h3>Admin Dashboard</h3>
          <div className="platform-health">
            <h4>Platform Health</h4>
            <p>Total Users: {dashboard.adminMetrics.platformHealth.totalUsers}</p>
            <p>Active Users: {dashboard.adminMetrics.platformHealth.activeUsers}</p>
            <p>Total Courses: {dashboard.adminMetrics.platformHealth.totalCourses}</p>
            <p>Completion Rate: {dashboard.adminMetrics.platformHealth.completionRate}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Course Report Generator Component
 */
export function CourseReportGenerator({ courseId }: { courseId: string }) {
  const [dateRange, setDateRange] = React.useState({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  });

  const { data: report, loading, error, refetch } = useReportGeneration({
    courseId,
    dateRange,
  });

  const handleGenerateReport = () => {
    refetch();
  };

  if (loading) return <div>Generating report...</div>;
  if (error) return <div>Error generating report: {error.message}</div>;

  return (
    <div className="course-report">
      <h2>Course Report Generator</h2>
      
      <div className="date-range-selector">
        <label>
          Start Date:
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          />
        </label>
        <label>
          End Date:
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          />
        </label>
        <button onClick={handleGenerateReport}>Generate Report</button>
      </div>
      
      {report && (
        <div className="report-content">
          <h3>Report for {report.courseName}</h3>
          <p>Instructor: {report.instructorName}</p>
          <p>Period: {new Date(report.reportPeriod.startDate).toLocaleDateString()} - {new Date(report.reportPeriod.endDate).toLocaleDateString()}</p>
          
          <div className="enrollment-trends">
            <h4>Enrollment Trends</h4>
            <p>Total Enrollments: {report.enrollmentTrends.totalEnrollments}</p>
            <p>New Enrollments: {report.enrollmentTrends.newEnrollments}</p>
            <p>Completed: {report.enrollmentTrends.completedEnrollments}</p>
            <p>Dropped: {report.enrollmentTrends.droppedEnrollments}</p>
          </div>
          
          <div className="performance-metrics">
            <h4>Performance Metrics</h4>
            <p>Completion Rate: {report.performanceMetrics.completionRate}%</p>
            <p>Average Quiz Score: {report.performanceMetrics.averageQuizScore}%</p>
            <p>Assignment Submission Rate: {report.performanceMetrics.assignmentSubmissionRate}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Trending Courses Widget Component
 */
export function TrendingCoursesWidget() {
  const dateRange = {
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  };

  const { data: trendingCourses, loading, error } = useTrendingCourses(5, dateRange);

  if (loading) return <div>Loading trending courses...</div>;
  if (error) return <div>Error loading trending courses: {error.message}</div>;
  if (!trendingCourses || trendingCourses.length === 0) return <div>No trending courses found</div>;

  return (
    <div className="trending-courses">
      <h3>Trending Courses</h3>
      <div className="course-list">
        {trendingCourses.map((courseAnalytics, index) => (
          <div key={courseAnalytics.courseId} className="trending-course">
            <div className="rank">#{index + 1}</div>
            <div className="course-info">
              <h4>{courseAnalytics.course.title}</h4>
              <p>Instructor: {courseAnalytics.course.instructor.profile?.fullName}</p>
              <p>Enrollments: {courseAnalytics.totalEnrollments}</p>
              <p>Completion Rate: {courseAnalytics.completionRate}%</p>
              <p>Rating: {courseAnalytics.averageRating || 'N/A'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}