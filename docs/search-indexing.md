# Search Indexing Strategy

This document describes the search indexing strategy implementation for the learning platform backend.

## Overview

The search indexing system provides automatic indexing of courses and lessons into Elasticsearch for full-text search capabilities. It includes:

- **Event-driven indexing**: Automatically indexes content when courses/lessons are created or updated
- **Bulk reindexing**: Scripts for initial data load and recovery operations
- **Retry mechanisms**: Failed indexing jobs are automatically retried with exponential backoff
- **Queue-based processing**: Uses BullMQ for reliable background job processing

## Architecture

### Components

1. **SearchIndexingQueue**: BullMQ-based queue for processing indexing jobs
2. **SearchIndexingEventHandlers**: Event handlers that listen to course/lesson domain events
3. **SearchIndexingService**: Main service that coordinates indexing operations
4. **EventBus**: Simple event bus for domain event publishing and subscription

### Event Flow

```
Course/Lesson Operation → Domain Event → Event Handler → Indexing Queue → Elasticsearch
```

## Usage

### Automatic Indexing

The system automatically indexes content when:

- A course is created, updated, published, or archived
- A lesson is added, updated, or removed
- Modules are added, removed, or reordered

### Manual Operations

#### Initialize Search Indexing

```typescript
import { initializeSearchIndexing } from './src/modules/search/index.js';

// Initialize with default settings
await initializeSearchIndexing();

// Initialize with custom configuration
await initializeSearchIndexing({
  enableEventHandlers: true,
  enableBulkReindexing: true,
  bulkReindexBatchSize: 100,
});
```

#### Manual Indexing

```typescript
import { indexCourse, indexLesson } from './src/modules/search/index.js';

// Index a specific course
await indexCourse('course-id-123');

// Index a specific lesson
await indexLesson('lesson-id-456', 'course-id-123');
```

#### Bulk Reindexing

Use the command-line script for bulk operations:

```bash
# Reindex all content
npm run reindex:search -- --type=all

# Reindex only courses
npm run reindex:search -- --type=courses --batch-size=50

# Reindex only lessons
npm run reindex:search -- --type=lessons

# Dry run to see what would be reindexed
npm run reindex:search -- --type=all --dry-run

# Skip health check (useful for recovery scenarios)
npm run reindex:search -- --type=all --skip-health-check

# Verbose monitoring
npm run reindex:search -- --type=all --verbose
```

### Application Integration

#### Startup Integration

```typescript
import { initializeApplicationServices } from './src/shared/services/index.js';

// Initialize all services including search indexing
await initializeApplicationServices({
  searchIndexing: {
    enabled: true,
    enableEventHandlers: true,
    enableBulkReindexing: true,
    bulkReindexBatchSize: 100,
  },
});
```

#### Service Integration Example

```typescript
import { eventBus } from './src/shared/services/EventBus.js';
import { CourseCreatedEvent } from './src/modules/courses/domain/events/CourseEvents.js';

// In your course service
async function createCourse(courseData: any): Promise<Course> {
  // Create the course
  const course = await courseRepository.create(courseData);
  
  // Publish event for search indexing
  const event = new CourseCreatedEvent(
    course.id,
    course.instructorId,
    course.title
  );
  
  await eventBus.publish(event);
  
  return course;
}
```

## Configuration

### Environment Variables

The search indexing system uses the same Elasticsearch and Redis configuration as the main application:

```env
# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Queue Configuration

The indexing queue is configured with:

- **Concurrency**: 5 workers for moderate throughput
- **Retry attempts**: 5 attempts with exponential backoff
- **Job retention**: 100 completed jobs, 200 failed jobs
- **Priority levels**: 1-8 (higher numbers = higher priority)

### Priority Levels

- **8**: Course/lesson removals (highest priority)
- **7**: Course publishing
- **6**: Course updates
- **5**: Course/lesson creation
- **4**: Reordering operations
- **3**: Bulk reindexing (lowest priority)

## Monitoring

### Health Checks

```typescript
import { getSearchIndexingHealth } from './src/modules/search/index.js';

const health = await getSearchIndexingHealth();
console.log('Search indexing health:', health);
```

### Queue Statistics

```typescript
import { getSearchIndexingService } from './src/modules/search/index.js';

const service = getSearchIndexingService();
if (service) {
  const stats = await service.getQueueStats();
  console.log('Queue stats:', stats);
}
```

### Job Status

```typescript
const jobStatus = await service.getJobStatus('job-id-123');
console.log('Job status:', jobStatus);
```

## Error Handling

### Retry Logic

Failed indexing jobs are automatically retried with:

1. **Exponential backoff**: 2s, 4s, 8s, 16s, 32s delays
2. **Maximum attempts**: 5 retries per job
3. **Dead letter queue**: Failed jobs are preserved for analysis

### Error Types

- **Elasticsearch connection errors**: Retried automatically
- **Document validation errors**: Not retried (require code fixes)
- **Timeout errors**: Retried with longer timeout
- **Rate limiting**: Retried with exponential backoff

### Recovery

If the search index becomes corrupted or out of sync:

1. **Check health**: `npm run reindex:search -- --type=all --dry-run`
2. **Bulk reindex**: `npm run reindex:search -- --type=all`
3. **Monitor progress**: Use `--verbose` flag for detailed progress

## Performance Considerations

### Indexing Performance

- **Batch size**: Default 100 items per batch (configurable)
- **Concurrency**: 5 concurrent workers (configurable)
- **Throttling**: Built-in rate limiting to prevent Elasticsearch overload

### Search Performance

- **Index refresh**: Automatic refresh after each indexing operation
- **Caching**: Search results cached in Redis
- **Aliases**: Uses Elasticsearch aliases for zero-downtime reindexing

### Resource Usage

- **Memory**: ~50MB for queue workers and event handlers
- **CPU**: Low impact, mostly I/O bound operations
- **Network**: Moderate Elasticsearch traffic during bulk operations

## Troubleshooting

### Common Issues

1. **Redis connection errors**
   - Check Redis server status
   - Verify connection configuration
   - Check network connectivity

2. **Elasticsearch connection errors**
   - Verify Elasticsearch cluster health
   - Check authentication credentials
   - Ensure indices exist and are accessible

3. **High queue backlog**
   - Monitor queue statistics
   - Check worker concurrency settings
   - Verify Elasticsearch performance

4. **Missing search results**
   - Check if content is indexed: `GET /courses/_doc/{course-id}`
   - Verify index mappings are correct
   - Run bulk reindex if necessary

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

This will show detailed information about:
- Event processing
- Queue job execution
- Elasticsearch operations
- Error details

### Manual Recovery

If automatic recovery fails:

1. **Clear failed jobs**: Access BullMQ dashboard or Redis directly
2. **Reset indices**: Delete and recreate Elasticsearch indices
3. **Full reindex**: Run bulk reindex script with `--skip-health-check`

## Development

### Testing

The search indexing system includes:

- **Unit tests**: For individual components
- **Integration tests**: For end-to-end workflows
- **Mock services**: For testing without external dependencies

### Adding New Event Types

To add indexing for new content types:

1. **Create domain events** in the appropriate module
2. **Add event handlers** in `SearchIndexingEventHandlers`
3. **Update queue job types** in `SearchIndexingQueue`
4. **Add search service methods** for the new content type

### Extending Functionality

The system is designed to be extensible:

- **Custom job types**: Add new job processors to the queue
- **Additional event sources**: Subscribe to events from other modules
- **Alternative search backends**: Implement new search repository interfaces
- **Custom retry logic**: Override default retry strategies per job type

## Security

### Access Control

- **Queue access**: Secured through Redis authentication
- **Elasticsearch access**: Uses configured credentials
- **Event publishing**: Only authenticated services can publish events

### Data Protection

- **Sensitive data**: Automatically excluded from search indices
- **Access logs**: All indexing operations are logged
- **Audit trail**: Event sourcing provides complete operation history

## Compliance

The search indexing system supports:

- **GDPR**: Right to be forgotten through content removal
- **Data retention**: Configurable retention policies
- **Audit logging**: Complete operation audit trail
- **Privacy**: Sensitive data exclusion from search indices