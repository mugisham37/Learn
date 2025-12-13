/**
 * Admin GraphQL Schema
 *
 * GraphQL type definitions for admin-only functionality including
 * job monitoring, queue management, and system administration.
 */

export const adminTypeDefs = `
  # Job monitoring and queue management types
  
  type JobOverview {
    totalQueues: Int!
    healthyQueues: Int!
    totalJobs: Int!
    activeJobs: Int!
    failedJobs: Int!
    completedJobs: Int!
    overallHealthScore: Float!
  }
  
  type QueueStats {
    name: String!
    waiting: Int!
    active: Int!
    completed: Int!
    failed: Int!
    delayed: Int!
    paused: Boolean!
  }
  
  type QueueHealth {
    name: String!
    stats: QueueStats!
    health: QueueHealthStatus!
    completionRate: Float!
    averageProcessingTime: Int!
    queueDepth: Int!
  }
  
  enum QueueHealthStatus {
    HEALTHY
    WARNING
    ERROR
  }
  
  type JobAlert {
    severity: AlertSeverity!
    queueName: String!
    message: String!
    timestamp: DateTime!
    metadata: JSON
  }
  
  enum AlertSeverity {
    INFO
    WARNING
    ERROR
    CRITICAL
  }
  
  type CompletionRateMetric {
    rate: Float!
    completed: Int!
    failed: Int!
  }
  
  type QueueDepthMetric {
    waiting: Int!
    active: Int!
    total: Int!
  }
  
  type JobDashboard {
    overview: JobOverview!
    queues: [QueueHealth!]!
    alerts: [JobAlert!]!
    completionRates: [QueueCompletionRate!]!
    queueDepths: [QueueDepthData!]!
  }
  
  type QueueCompletionRate {
    queueName: String!
    metrics: CompletionRateMetric!
  }
  
  type QueueDepthData {
    queueName: String!
    metrics: QueueDepthMetric!
  }
  
  type RealtimeStats {
    timestamp: DateTime!
    queues: [QueueStats!]!
    systemHealth: Boolean!
  }
  
  type JobEvent {
    timestamp: DateTime!
    event: String!
    queueName: String!
    jobId: String
    details: JSON!
  }
  
  type JobRetryResult {
    success: Boolean!
    retriedCount: Int!
  }
  
  type QueueManagementResult {
    success: Boolean!
    message: String!
  }
  
  type MonitoringExport {
    exportId: String!
    downloadUrl: String!
  }
  
  type JobDetails {
    id: String!
    name: String!
    data: JSON
    progress: Int
    delay: Int
    timestamp: DateTime
    attemptsMade: Int
    failedReason: String
    stacktrace: [String!]
    returnvalue: JSON
    finishedOn: DateTime
    processedOn: DateTime
  }
  
  # Input types
  
  input JobRetryInput {
    queueName: String!
    jobId: String
    retryAll: Boolean
    maxRetries: Int
  }
  
  input QueueManagementInput {
    queueName: String!
    action: QueueAction!
    jobStatus: JobStatus
  }
  
  enum QueueAction {
    PAUSE
    RESUME
    CLEAR
    DRAIN
  }
  
  enum JobStatus {
    WAITING
    ACTIVE
    COMPLETED
    FAILED
  }
  
  # Admin queries and mutations
  
  extend type Query {
    # Job monitoring queries (admin only)
    jobDashboard: JobDashboard!
    realtimeQueueStats: RealtimeStats!
    jobEventHistory(queueName: String, limit: Int): [JobEvent!]!
    queueHealth(queueName: String): QueueHealth
    jobDetails(queueName: String!, jobId: String!): JobDetails
  }
  
  extend type Mutation {
    # Job management mutations (admin only)
    retryJobs(input: JobRetryInput!): JobRetryResult!
    manageQueue(input: QueueManagementInput!): QueueManagementResult!
    exportMonitoringData(startDate: DateTime!, endDate: DateTime!): MonitoringExport!
    clearQueueAlerts(queueName: String): Boolean!
  }
  
  # Subscriptions for real-time monitoring
  
  extend type Subscription {
    queueStatsUpdated: RealtimeStats!
    jobAlerts(severity: AlertSeverity): JobAlert!
    jobEvents(queueName: String): JobEvent!
  }
  
  # Scalar types
  
  scalar DateTime
  scalar JSON
`;
