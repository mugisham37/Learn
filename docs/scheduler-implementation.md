# Scheduler Service Implementation

## Overview

This document describes the implementation of Task 127: "Set up scheduled tasks with node-cron". The implementation provides a unified scheduler service that coordinates all scheduled tasks in the learning platform backend.

## Architecture

The scheduler implementation follows a layered architecture:

```
┌─────────────────────────────────────────┐
│           SchedulerService              │
│        (Unified Coordinator)            │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼───┐    ┌─────▼─────┐    ┌────▼────┐
│ Cron  │    │ Analytics │    │ Cleanup │
│ Jobs  │    │Scheduler  │    │Services │
└───────┘    └───────────┘    └─────────┘
```

## Components

### 1. SchedulerService (Unified Coordinator)

**File**: `src/shared/services/SchedulerService.ts`

The main coordinator that manages all scheduled tasks:

- **Purpose**: Centralized management of all cron jobs
- **Features**:
  - Unified configuration
  - Health monitoring
  - Manual task triggering
  - Graceful shutdown
  - Status reporting

### 2. CronJobService (Enhanced)

**File**: `src/shared/services/CronJobService.ts`

Enhanced to include all required scheduled tasks:

- **Daily Analytics Updates** (00:00 UTC)
- **Weekly Trend Reports** (Sunday 01:00 UTC)
- **Monthly Executive Summaries** (1st of month 02:00 UTC)
- **Daily Session Cleanup** (03:00 UTC)
- **Daily Log Pruning** (04:00 UTC)
- **Secret Rotation** (05:00 UTC)

### 3. SessionCleanupService

**File**: `src/shared/services/SessionCleanupService.ts`

Handles cleanup of expired sessions and tokens:

- **Features**:
  - Expired refresh token cleanup from Redis
  - Unverified account removal
  - Password reset token cleanup
  - User-specific session cleanup
  - Configurable retention periods

### 4. LogPruningService

**File**: `src/shared/services/LogPruningService.ts`

Manages log file cleanup and compression:

- **Features**:
  - Old log file removal
  - Log file compression
  - Size-based rotation
  - Count-based cleanup
  - Configurable retention policies

### 5. AnalyticsScheduler (Existing)

**File**: `src/shared/services/AnalyticsScheduler.ts`

Handles analytics-specific scheduled tasks (already implemented).

## Scheduled Tasks

| Task | Schedule | Description | Service |
|------|----------|-------------|---------|
| Daily Analytics Updates | `0 0 * * *` | Update course and student analytics | AnalyticsScheduler |
| Weekly Trend Reports | `0 1 * * 0` | Generate weekly trend reports | AnalyticsScheduler |
| Monthly Executive Summaries | `0 2 1 * *` | Generate monthly summaries | AnalyticsScheduler |
| Daily Session Cleanup | `0 3 * * *` | Clean expired sessions/tokens | SessionCleanupService |
| Daily Log Pruning | `0 4 * * *` | Prune old log files | LogPruningService |
| Secret Rotation | `0 5 * * *` | Rotate expired secrets | SecretRotationService |

## Configuration

### Environment-Based Enablement

```typescript
const config = {
  enabled: process.env.NODE_ENV === 'production',
  timezone: 'UTC',
  // ... other config
};
```

### Service-Specific Configuration

```typescript
const schedulerConfig = {
  analytics: {
    enableHourlyMetrics: true,
    enableDailyAnalytics: true,
    enableWeeklyReports: true,
    enableMonthlyReports: true,
  },
  sessionCleanup: {
    expiredTokenRetentionDays: 7,
    unverifiedAccountRetentionDays: 30,
    passwordResetTokenRetentionHours: 24,
  },
  logPruning: {
    retentionDays: 30,
    maxFileSizeMB: 100,
    maxFiles: 10,
    compressOldLogs: true,
  },
};
```

## Integration

### Application Startup

The scheduler is integrated into the main application startup:

```typescript
// src/index.ts
const { initializeSchedulerService } = await import('./shared/services/SchedulerService.js');
const schedulerService = initializeSchedulerService({
  enabled: config.nodeEnv === 'production',
  timezone: 'UTC',
});
await schedulerService.initialize();
```

### Graceful Shutdown

```typescript
// src/index.ts (shutdown handler)
const { shutdownSchedulerService } = await import('./shared/services/SchedulerService.js');
await shutdownSchedulerService();
```

## Monitoring and Health Checks

### Status Monitoring

```typescript
const status = await schedulerService.getStatus();
// Returns:
// {
//   isInitialized: boolean,
//   isEnabled: boolean,
//   environment: string,
//   timezone: string,
//   totalJobs: number,
//   activeJobs: number,
//   failedJobs: number,
//   lastHealthCheck: Date,
//   services: {
//     cronJobService: boolean,
//     analyticsScheduler: boolean,
//     sessionCleanup: boolean,
//     logPruning: boolean,
//   }
// }
```

### Health Checks

```typescript
const isHealthy = await schedulerService.healthCheck();
```

### Detailed Statistics

```typescript
const stats = await schedulerService.getDetailedStats();
// Returns detailed stats from all services
```

## Manual Task Execution

Tasks can be manually triggered for testing or emergency execution:

```typescript
// Trigger specific tasks
await schedulerService.triggerTask('daily-session-cleanup');
await schedulerService.triggerTask('daily-log-pruning');
await schedulerService.triggerTask('daily-analytics-updates');
```

## Error Handling

### Comprehensive Logging

All scheduler operations include detailed logging:

```typescript
logger.info('Starting scheduled task', { taskName });
logger.error('Scheduled task failed', { 
  taskName, 
  error: error.message,
  duration: Date.now() - startTime 
});
```

### Retry Logic

- Built-in retry logic for failed tasks
- Exponential backoff for transient failures
- Dead letter queue for permanently failed tasks

### Graceful Degradation

- Individual service failures don't affect other services
- Health checks identify problematic services
- Manual intervention capabilities

## Testing

### Test Script

A comprehensive test script is provided:

```bash
npm run test:scheduler
```

**File**: `scripts/test-scheduler.ts`

### Unit Testing

Each service includes comprehensive unit tests:

- CronJobService tests
- SessionCleanupService tests
- LogPruningService tests
- SchedulerService integration tests

## Security Considerations

### Token Cleanup

- Expired refresh tokens are securely removed
- Password reset tokens have short TTL
- Unverified accounts are cleaned up

### Log Security

- Sensitive data is redacted before logging
- Old logs are securely deleted
- Compressed logs maintain security

### Access Control

- Scheduler operations require appropriate permissions
- Manual triggers are logged and audited
- Health check endpoints are secured

## Performance Considerations

### Batch Processing

- Large datasets are processed in batches
- Configurable batch sizes for different operations
- Memory-efficient processing

### Resource Management

- Connection pooling for database operations
- Redis pipeline operations for efficiency
- Graceful resource cleanup

### Monitoring

- Performance metrics collection
- Resource usage tracking
- Bottleneck identification

## Deployment Considerations

### Environment Configuration

- Production: All tasks enabled
- Staging: Limited task execution
- Development: Tasks disabled by default

### Scaling

- Horizontal scaling support
- Distributed locking for singleton tasks
- Load balancing considerations

### Monitoring

- CloudWatch integration
- Custom metrics
- Alerting rules

## Troubleshooting

### Common Issues

1. **Tasks Not Running**
   - Check environment configuration
   - Verify service initialization
   - Review health check status

2. **Performance Issues**
   - Monitor batch sizes
   - Check resource utilization
   - Review log retention settings

3. **Failed Tasks**
   - Check error logs
   - Verify service dependencies
   - Test manual execution

### Debug Commands

```bash
# Test scheduler functionality
npm run test:scheduler

# Check service status
curl http://localhost:3000/health/deep

# Manual task execution (via API)
POST /admin/scheduler/trigger
{
  "taskName": "daily-session-cleanup"
}
```

## Requirements Compliance

This implementation satisfies all requirements from Task 127:

- ✅ **Install node-cron**: Already installed and configured
- ✅ **Create cron job scheduler**: SchedulerService provides unified coordination
- ✅ **Schedule daily analytics updates (midnight UTC)**: Implemented via AnalyticsScheduler
- ✅ **Schedule weekly trend reports (Sunday)**: Implemented via AnalyticsScheduler
- ✅ **Schedule monthly executive summaries (1st of month)**: Implemented via AnalyticsScheduler
- ✅ **Schedule daily session cleanup**: Implemented via SessionCleanupService
- ✅ **Schedule daily log pruning**: Implemented via LogPruningService
- ✅ **Requirements 14.7**: All scheduled tasks execute as specified

## Future Enhancements

### Planned Improvements

1. **Dynamic Task Configuration**
   - Runtime task modification
   - Configuration hot-reloading
   - A/B testing for schedules

2. **Advanced Monitoring**
   - Real-time dashboards
   - Predictive failure detection
   - Performance optimization

3. **Enhanced Security**
   - Task execution auditing
   - Role-based access control
   - Encrypted task payloads

### Extension Points

- Custom task plugins
- External scheduler integration
- Multi-tenant task isolation