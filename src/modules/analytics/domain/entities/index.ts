/**
 * Analytics Domain Entities
 * 
 * Exports all domain entities for the analytics module
 */

export { 
  CourseAnalytics, 
  type CourseAnalyticsData, 
  type EngagementMetrics 
} from './CourseAnalytics.js';

export { 
  StudentAnalytics, 
  type StudentAnalyticsData, 
  type LearningStreak, 
  type SkillProgress, 
  type Badge 
} from './StudentAnalytics.js';

export { 
  AnalyticsEvent, 
  type AnalyticsEventData, 
  type EventContext, 
  type LearningEventData, 
  type EngagementEventData, 
  type SystemEventData, 
  type EventType 
} from './AnalyticsEvent.js';