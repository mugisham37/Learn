/**
 * Job Event Logger
 * 
 * Comprehensive logging system for job events with structured logging,
 * event correlation, and performance tracking.
 */

import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * Job event types
 */
export type JobEventType = 
  | 'job:created'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:stalled'
  | 'job:retry'
  | 'job:removed'
  | 'queue:paused'
  | 'queue:resumed'
  | 'queue:drained'
  | 'worker:started'
  | 'worker:stopped';

/**
 * Job event data structure
 */
export interface JobEvent {
  id: string;
  type: JobEventType;
  timestamp: Date;
  queueName: string;
  jobId?: string;
  workerId?: string;
  data?: Record<string, unknown>;
  metadata?: {
    duration?: number;
    attempt?: number;
    progress?: number;
    error?: {
      message: string;
      stack?: string;
      code?: string;
    };
    performance?: {
      memoryUsage?: number;
      cpuUsage?: number;
      queueDepth?: number;
    };
  };
}

/**
 * Job performance metrics
 */
export interface JobPerformanceMetrics {
  queueName: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageDuration: number;
  medianDuration: number;
  p95Duration: number;
  throughputPerMinute: number;
  errorRate: number;
  lastUpdated: Date;
}

/**
 * Job Event Logger for comprehensive job monitoring
 */
export class JobEventLogger extends EventEmitter {
  private static instance: JobEventLogger;
  private events: JobEvent[] = [];
  private performanceMetrics = new Map<string, JobPerformanceMetrics>();
  private jobTimings = new Map<string, { startTime: Date; queueName: string }>();
  
  private constructor() {
    super();
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): JobEventLogger {
    if (!JobEventLogger.instance) {
      JobEventLogger.instance = new JobEventLogger();
    }
    return JobEventLogger.instance;
  }
  
  /**
   * Log a job event
   */
  public logEvent(
    type: JobEventType,
    queueName: string,
    jobId?: string,
    data?: Record<string, unknown>,
    metadata?: JobEvent['metadata']
  ): JobEvent {
    const eventId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const event: JobEvent = {
      id: eventId,
      type,
      timestamp: new Date(),
      queueName,
      jobId,
      data,
      metadata
    };
    
    // Store event
    this.events.push(event);
    
    // Track job timing
    if (type === 'job:started' && jobId) {
      this.jobTimings.set(jobId, {
        startTime: event.timestamp,
        queueName
      });
    }
    
    // Calculate duration for completed/failed jobs
    if ((type === 'job:completed' || type === 'job:failed') && jobId) {
      const timing = this.jobTimings.get(jobId);
      if (timing) {
        const duration = event.timestamp.getTime() - timing.startTime.getTime();
        event.metadata = {
          ...event.metadata,
          duration
        };
        this.jobTimings.delete(jobId);
        
        // Update performance metrics
        this.updatePerformanceMetrics(queueName, type === 'job:completed', duration);
      }
    }
    
    // Structured logging
    this.logStructuredEvent(event);
    
    // Emit event for listeners
    this.emit('event', event);
    this.emit(type, event);
    
    // Keep only recent events in memory
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
    
    return event;
  }
  
  /**
   * Log job creation
   */
  public logJobCreated(queueName: string, jobId: string, jobData: any): JobEvent {
    return this.logEvent('job:created', queueName, jobId, jobData);
  }
  
  /**
   * Log job start
   */
  public logJobStarted(queueName: string, jobId: string, workerId?: string): JobEvent {
    return this.logEvent('job:started', queueName, jobId, undefined, { workerId });
  }
  
  /**
   * Log job progress
   */
  public logJobProgress(queueName: string, jobId: string, progress: number): JobEvent {
    return this.logEvent('job:progress', queueName, jobId, undefined, { progress });
  }
  
  /**
   * Log job completion
   */
  public logJobCompleted(queueName: string, jobId: string, result?: any): JobEvent {
    return this.logEvent('job:completed', queueName, jobId, { result });
  }
  
  /**
   * Log job failure
   */
  public logJobFailed(queueName: string, jobId: string, error: Error, attempt?: number): JobEvent {
    return this.logEvent('job:failed', queueName, jobId, undefined, {
      attempt,
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      }
    });
  }
  
  /**
   * Log job stalled
   */
  public logJobStalled(queueName: string, jobId: string): JobEvent {
    return this.logEvent('job:stalled', queueName, jobId);
  }
  
  /**
   * Log job retry
   */
  public logJobRetry(queueName: string, jobId: string, attempt: number): JobEvent {
    return this.logEvent('job:retry', queueName, jobId, undefined, { attempt });
  }
  
  /**
   * Log queue operations
   */
  public logQueuePaused(queueName: string): JobEvent {
    return this.logEvent('queue:paused', queueName);
  }
  
  public logQueueResumed(queueName: string): JobEvent {
    return this.logEvent('queue:resumed', queueName);
  }
  
  public logQueueDrained(queueName: string): JobEvent {
    return this.logEvent('queue:drained', queueName);
  }
  
  /**
   * Log worker operations
   */
  public logWorkerStarted(queueName: string, workerId: string): JobEvent {
    return this.logEvent('worker:started', queueName, undefined, undefined, { workerId });
  }
  
  public logWorkerStopped(queueName: string, workerId: string): JobEvent {
    return this.logEvent('worker:stopped', queueName, undefined, undefined, { workerId });
  }
  
  /**
   * Get events by queue
   */
  public getEventsByQueue(queueName: string, limit: number = 100): JobEvent[] {
    return this.events
      .filter(event => event.queueName === queueName)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get events by type
   */
  public getEventsByType(type: JobEventType, limit: number = 100): JobEvent[] {
    return this.events
      .filter(event => event.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get events by job ID
   */
  public getEventsByJobId(jobId: string): JobEvent[] {
    return this.events
      .filter(event => event.jobId === jobId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
  
  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(queueName?: string): JobPerformanceMetrics[] {
    if (queueName) {
      const metrics = this.performanceMetrics.get(queueName);
      return metrics ? [metrics] : [];
    }
    
    return Array.from(this.performanceMetrics.values());
  }
  
  /**
   * Get event statistics
   */
  public getEventStats(timeRange?: { start: Date; end: Date }): {
    totalEvents: number;
    eventsByType: Record<JobEventType, number>;
    eventsByQueue: Record<string, number>;
    timeRange: { start: Date; end: Date };
  } {
    let events = this.events;
    
    if (timeRange) {
      events = events.filter(event => 
        event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
      );
    }
    
    const eventsByType = {} as Record<JobEventType, number>;
    const eventsByQueue = {} as Record<string, number>;
    
    events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByQueue[event.queueName] = (eventsByQueue[event.queueName] || 0) + 1;
    });
    
    const actualTimeRange = timeRange || {
      start: events.length > 0 ? events[0].timestamp : new Date(),
      end: new Date()
    };
    
    return {
      totalEvents: events.length,
      eventsByType,
      eventsByQueue,
      timeRange: actualTimeRange
    };
  }
  
  /**
   * Export events for analysis
   */
  public exportEvents(
    format: 'json' | 'csv' = 'json',
    filters?: {
      queueName?: string;
      type?: JobEventType;
      startDate?: Date;
      endDate?: Date;
    }
  ): string {
    let events = this.events;
    
    // Apply filters
    if (filters) {
      if (filters.queueName) {
        events = events.filter(e => e.queueName === filters.queueName);
      }
      if (filters.type) {
        events = events.filter(e => e.type === filters.type);
      }
      if (filters.startDate) {
        events = events.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        events = events.filter(e => e.timestamp <= filters.endDate!);
      }
    }
    
    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    } else {
      // CSV format
      const headers = ['id', 'type', 'timestamp', 'queueName', 'jobId', 'duration', 'error'];
      const rows = events.map(event => [
        event.id,
        event.type,
        event.timestamp.toISOString(),
        event.queueName,
        event.jobId || '',
        event.metadata?.duration || '',
        event.metadata?.error?.message || ''
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }
  
  /**
   * Log structured event with appropriate log level
   */
  private logStructuredEvent(event: JobEvent): void {
    const logData = {
      eventId: event.id,
      eventType: event.type,
      queueName: event.queueName,
      jobId: event.jobId,
      timestamp: event.timestamp,
      ...event.metadata
    };
    
    switch (event.type) {
      case 'job:failed':
      case 'job:stalled':
        logger.error(`Job event: ${event.type}`, logData);
        break;
      case 'job:retry':
        logger.warn(`Job event: ${event.type}`, logData);
        break;
      case 'job:completed':
      case 'job:started':
        logger.info(`Job event: ${event.type}`, logData);
        break;
      default:
        logger.debug(`Job event: ${event.type}`, logData);
        break;
    }
  }
  
  /**
   * Update performance metrics for a queue
   */
  private updatePerformanceMetrics(queueName: string, completed: boolean, duration: number): void {
    let metrics = this.performanceMetrics.get(queueName);
    
    if (!metrics) {
      metrics = {
        queueName,
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        averageDuration: 0,
        medianDuration: 0,
        p95Duration: 0,
        throughputPerMinute: 0,
        errorRate: 0,
        lastUpdated: new Date()
      };
    }
    
    metrics.totalJobs++;
    if (completed) {
      metrics.completedJobs++;
    } else {
      metrics.failedJobs++;
    }
    
    // Update duration metrics (simplified calculation)
    metrics.averageDuration = (metrics.averageDuration + duration) / 2;
    metrics.errorRate = metrics.failedJobs / metrics.totalJobs;
    metrics.lastUpdated = new Date();
    
    // Calculate throughput (jobs per minute in last hour)
    const recentEvents = this.events.filter(event => 
      event.queueName === queueName &&
      (event.type === 'job:completed' || event.type === 'job:failed') &&
      event.timestamp.getTime() > Date.now() - 60 * 60 * 1000
    );
    metrics.throughputPerMinute = recentEvents.length / 60;
    
    this.performanceMetrics.set(queueName, metrics);
  }
  
  /**
   * Clean up old events to prevent memory leaks
   */
  private cleanupOldEvents(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    
    this.events = this.events.filter(event => event.timestamp > cutoff);
    
    // Clean up old job timings
    for (const [jobId, timing] of this.jobTimings.entries()) {
      if (timing.startTime < cutoff) {
        this.jobTimings.delete(jobId);
      }
    }
    
    logger.debug('Cleaned up old job events', {
      remainingEvents: this.events.length,
      remainingTimings: this.jobTimings.size
    });
  }
}