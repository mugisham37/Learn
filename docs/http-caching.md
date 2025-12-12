# HTTP Response Caching Implementation

This document describes the HTTP response caching implementation for the learning platform backend, including ETag generation, conditional requests, and CDN optimization.

## Overview

The HTTP caching system implements RFC 7234 (HTTP/1.1 Caching) standards to improve performance by:

- Reducing server load through conditional requests
- Minimizing bandwidth usage with 304 Not Modified responses
- Optimizing CDN caching for static and dynamic content
- Providing fine-grained cache control for different resource types

## Features

### 1. ETag Generation

ETags (Entity Tags) are generated for response content to enable conditional requests:

```typescript
import { generateETag } from '../shared/middleware/httpCaching.js';

// Generate strong ETag
const etag = generateETag(responseData);
// Output: "a1b2c3d4e5f6g7h8"

// Generate weak ETag
const weakETag = generateETag(responseData, { weak: true });
// Output: W/"a1b2c3d4e5f6g7h8"
```

**ETag Features:**
- SHA-256 based hashing for consistency
- Support for strong and weak ETags
- Handles strings, objects, and buffers
- Graceful fallback for circular references

### 2. Cache-Control Headers

Configurable cache control directives for different content types:

```typescript
import { CacheConfigs } from '../shared/middleware/httpCaching.js';

// Static assets - 1 year cache
CacheConfigs.STATIC_ASSETS
// Output: "max-age=31536000, public"

// API responses - 5 minutes cache
CacheConfigs.API_RESPONSES  
// Output: "max-age=300, private, must-revalidate"

// No caching for sensitive data
CacheConfigs.NO_CACHE
// Output: "max-age=0, must-revalidate, no-cache, no-store"
```

### 3. Conditional Requests

Automatic handling of `If-None-Match` headers:

```http
GET /api/courses/123
If-None-Match: "a1b2c3d4e5f6g7h8"

HTTP/1.1 304 Not Modified
ETag: "a1b2c3d4e5f6g7h8"
Cache-Control: max-age=300, private, must-revalidate
```

### 4. CDN Optimization

CloudFront-optimized caching behaviors:

```typescript
import { generateCDNCacheHeaders } from '../shared/utils/cdnCaching.js';

const headers = generateCDNCacheHeaders('/static/css/main.css');
// Output: {
//   'Cache-Control': 'max-age=31536000, s-maxage=31536000, public',
//   'Vary': 'Accept-Encoding'
// }
```

## Usage

### REST Endpoints

Add caching to individual routes:

```typescript
import { addCachingToRoute, CacheConfigs } from '../shared/middleware/httpCaching.js';

// Course catalog with public caching
addCachingToRoute(
  fastify,
  'GET',
  '/api/courses',
  CacheConfigs.COURSE_CATALOG,
  async (request, reply) => {
    const courses = await courseService.getPublicCourses();
    return courses;
  }
);

// User profile with private caching
fastify.get('/api/users/profile', {
  preHandler: [
    requireAuth,
    createHttpCachingMiddleware(CacheConfigs.USER_PROFILES)
  ]
}, async (request, reply) => {
  const profile = await userService.getProfile(request.user.id);
  return profile;
});
```

### GraphQL Queries

Caching is automatically applied to GraphQL queries based on operation patterns:

```graphql
# Public course queries - 30 minutes cache
query GetCourses($filter: CourseFilter) {
  courses(filter: $filter) {
    id
    title
    description
  }
}

# User-specific queries - 10 minutes cache  
query GetMyEnrollments {
  myEnrollments {
    id
    course {
      title
    }
    progress
  }
}

# Analytics queries - 1 hour cache
query GetDashboardMetrics {
  dashboardMetrics {
    totalCourses
    totalStudents
    revenue
  }
}
```

### Custom Cache Configuration

Create custom cache configurations:

```typescript
const customConfig: CacheConfig = {
  maxAge: 1800, // 30 minutes
  public: true,
  mustRevalidate: true,
  customDirectives: ['stale-while-revalidate=300']
};

const middleware = createHttpCachingMiddleware(customConfig, {
  includeRequestData: true, // Include query params in ETag
  weak: false // Use strong ETags
});
```

## Cache Configurations

### Predefined Configurations

| Configuration | Max Age | Visibility | Use Case |
|---------------|---------|------------|----------|
| `STATIC_ASSETS` | 1 year | Public | CSS, JS, images |
| `COURSE_CATALOG` | 30 minutes | Public | Course listings |
| `USER_PROFILES` | 10 minutes | Private | User data |
| `SEARCH_RESULTS` | 10 minutes | Public | Search responses |
| `ANALYTICS` | 1 hour | Private | Dashboard data |
| `API_RESPONSES` | 5 minutes | Private | General API |
| `NO_CACHE` | 0 | None | Sensitive data |

### GraphQL Operation Patterns

| Pattern | Configuration | Operations |
|---------|---------------|------------|
| `PUBLIC_QUERIES` | Course Catalog | `^courses$`, `^course$` |
| `USER_QUERIES` | User Profiles | `^me$`, `^myEnrollments$` |
| `ANALYTICS_QUERIES` | Analytics | `^courseAnalytics$` |
| `SEARCH_QUERIES` | Search Results | `^searchCourses$` |
| `REALTIME_QUERIES` | No Cache | `^notifications$` |
| `MUTATIONS` | No Cache | All mutations |

## CDN Integration

### CloudFront Behaviors

The system provides CloudFront-optimized cache behaviors:

```typescript
// Static assets
{
  pathPattern: '/static/*',
  ttl: 31536000, // 1 year
  compress: true,
  queryStringBehavior: 'none'
}

// API responses  
{
  pathPattern: '/api/*',
  ttl: 300, // 5 minutes
  compress: true,
  queryStringBehavior: 'all',
  forwardedHeaders: ['Authorization']
}

// Video content
{
  pathPattern: '/videos/*', 
  ttl: 86400, // 1 day
  compress: false,
  forwardedHeaders: ['Range', 'If-Range']
}
```

### Vary Headers

Appropriate `Vary` headers are set for content negotiation:

- `Vary: Accept-Encoding` - For compressed responses
- `Vary: Authorization` - For user-specific content
- `Vary: Accept` - For content type negotiation

## Performance Benefits

### Bandwidth Reduction

- 304 responses eliminate unnecessary data transfer
- ETags enable precise cache validation
- Conditional requests reduce server processing

### Server Load Reduction

- Cached responses bypass application logic
- Database queries avoided for cached data
- CDN edge caching reduces origin requests

### Latency Improvement

- Browser caching eliminates round trips
- CDN edge locations serve cached content
- Conditional requests minimize response size

## Monitoring

### Cache Hit Rates

Monitor cache effectiveness:

```typescript
// Log cache hits/misses
logger.info('Cache response', {
  url: request.url,
  method: request.method,
  etag: responseETag,
  cacheHit: request.headers['if-none-match'] === responseETag,
  responseCode: reply.statusCode
});
```

### Performance Metrics

Track caching performance:

- Cache hit ratio by endpoint
- 304 response frequency
- Average response size reduction
- CDN cache hit rates

## Best Practices

### ETag Generation

- Include relevant data in ETag calculation
- Use strong ETags for critical content
- Consider user context for personalized content

### Cache Duration

- Longer cache for static content
- Shorter cache for dynamic data
- No cache for sensitive information

### Conditional Requests

- Always check `If-None-Match` headers
- Return 304 for matching ETags
- Remove content headers for 304 responses

### CDN Configuration

- Use appropriate TTL values
- Configure compression for text content
- Forward necessary headers only

## Security Considerations

### Cache Poisoning Prevention

- Validate ETag format
- Sanitize cache keys
- Use secure hash algorithms

### Privacy Protection

- Use private caching for user data
- Avoid caching sensitive information
- Set appropriate Vary headers

### Access Control

- Respect authorization headers
- Cache user-specific content privately
- Validate cache access permissions

## Troubleshooting

### Common Issues

1. **ETags not matching**: Check data consistency and hash algorithm
2. **Cache not working**: Verify middleware order and configuration
3. **304 responses not sent**: Check If-None-Match header parsing
4. **CDN not caching**: Review cache behaviors and headers

### Debug Information

Enable debug logging:

```typescript
logger.debug('HTTP caching debug', {
  requestId,
  url: request.url,
  etag: generatedETag,
  ifNoneMatch: request.headers['if-none-match'],
  cacheControl: cacheControlHeader,
  willReturn304: etagsMatch(clientETag, generatedETag)
});
```

## Requirements Compliance

This implementation satisfies requirement 15.4:

> WHEN expensive computations are performed, THEN the Platform SHALL cache results including search results, analytics queries, and report generation

**Compliance Details:**
- ✅ Cache-Control headers added to GET endpoints
- ✅ ETag generation for resources implemented
- ✅ Conditional requests with If-None-Match supported
- ✅ 304 Not Modified responses returned for unchanged resources
- ✅ CDN caching configured for static content
- ✅ GraphQL query caching based on operation patterns
- ✅ Comprehensive test coverage provided