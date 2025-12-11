/**
 * Shared Services Index
 * 
 * Exports all shared services for easy importing throughout the application.
 * Provides centralized access to all service implementations.
 */

// Email services
export { getEmailQueue, initializeEmailQueue, shutdownEmailQueue } from './EmailQueue.js';
export type { EmailJobData, EmailDeliveryStatus, WebhookData } from './EmailQueue.js';

// Analytics services
export { 
  getAnalyticsQueue, 
  initializeAnalyticsQueue, 
  shutdownAnalyticsQueue 
} from './AnalyticsQueue.js';
export type { 
  AnalyticsJobData,
  RealTimeMetricsJobData,
  CourseAnalyticsJobData,
  StudentAnalyticsJobData,
  TrendReportsJobData,
  ExecutiveSummaryJobData
} from './AnalyticsQueue.js';

export { 
  getAnalyticsScheduler, 
  initializeAnalyticsScheduler, 
  shutdownAnalyticsScheduler 
} from './AnalyticsScheduler.js';
export type { SchedulerConfig } from './AnalyticsScheduler.js';

// Video processing services
export { VideoProcessingQueue } from './VideoProcessingQueue.js';
export { VideoProcessingService } from './VideoProcessingService.js';

// Content services
export { CloudFrontService } from './CloudFrontService.js';
export { ContentService } from './ContentService.js';
export { S3Service } from './S3Service.js';

// Email services
export { EmailTemplateService } from './EmailTemplateService.js';
export { SendGridEmailService } from './SendGridEmailService.js';
export { SESEmailService } from './SESEmailService.js';
export { EmailServiceFactory } from './EmailServiceFactory.js';

// Media services
export { MediaConvertService } from './MediaConvertService.js';
export { ImageProcessingService } from './ImageProcessingService.js';

// Real-time services
export { RealtimeService } from './RealtimeService.js';

// Service factory
export { ServiceFactory } from './ServiceFactory.js';

// Startup integration
export { 
  initializeApplicationServices, 
  shutdownApplicationServices,
  CourseServiceWithSearchIntegration
} from './startupIntegration.js';
export type { StartupConfig } from './startupIntegration.js';

// Event system
export { EventBus, eventBus } from './EventBus.js';
export type { DomainEvent, EventHandler, EventSubscription } from './EventBus.js';

// Search indexing
export { SearchIndexingQueue } from './SearchIndexingQueue.js';
export type { 
  SearchIndexingJobType,
  SearchIndexingJobData,
  IndexCourseJobData,
  IndexLessonJobData,
  RemoveCourseJobData,
  RemoveLessonJobData,
  RemoveLessonsByCourseJobData,
  BulkReindexJobData
} from './SearchIndexingQueue.js';

// Interfaces
export type { ICloudFrontService } from './ICloudFrontService.js';
export type { IContentService } from './IContentService.js';
export type { IEmailService, EmailOptions, EmailResult, BulkEmailResult, EmailTemplateData } from './IEmailService.js';
export type { IImageProcessingService } from './IImageProcessingService.js';
export type { IMediaConvertService } from './IMediaConvertService.js';
export type { IRealtimeService } from './IRealtimeService.js';
export type { IS3Service } from './IS3Service.js';