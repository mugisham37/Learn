# Configuration Guide

This document provides comprehensive information about configuring the Learning Management System frontend application.

## Overview

The application uses a sophisticated configuration system that supports multiple environments, validation, monitoring, and error tracking. All configuration is centralized and validated on startup to ensure proper operation.

## Environment Files

The application supports multiple environment configurations:

- `.env.local` - Local development overrides
- `.env.development` - Development environment defaults
- `.env.staging` - Staging environment configuration
- `.env.production` - Production environment configuration
- `.env.local.example` - Template for local configuration

### Environment Priority

Next.js loads environment variables in the following order (higher priority overrides lower):

1. `.env.local` (highest priority, ignored by git)
2. `.env.{NODE_ENV}` (environment-specific)
3. `.env` (default)

## Configuration Categories

### Core Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Node.js environment | `development` | Yes |
| `NEXT_PUBLIC_APP_ENV` | Application environment | `development` | Yes |

### GraphQL Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_GRAPHQL_ENDPOINT` | GraphQL API endpoint | `http://localhost:4000/graphql` | Yes |
| `NEXT_PUBLIC_WS_ENDPOINT` | WebSocket endpoint | `ws://localhost:4000/graphql` | Yes |

### Authentication Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_JWT_SECRET` | JWT signing secret (min 32 chars) | - | Yes |
| `NEXT_PUBLIC_JWT_ACCESS_TOKEN_EXPIRY` | Access token expiry | `15m` | No |
| `NEXT_PUBLIC_JWT_REFRESH_TOKEN_EXPIRY` | Refresh token expiry | `30d` | No |
| `NEXT_PUBLIC_TOKEN_STORAGE_KEY` | Token storage key | `lms-auth-token` | No |
| `NEXT_PUBLIC_REFRESH_TOKEN_STORAGE_KEY` | Refresh token storage key | `lms-refresh-token` | No |

### Upload Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_MAX_FILE_SIZE` | Maximum file size | `100MB` | No |
| `NEXT_PUBLIC_MAX_VIDEO_SIZE` | Maximum video size | `500MB` | No |
| `NEXT_PUBLIC_ALLOWED_FILE_TYPES` | Allowed file types (comma-separated) | `image/*,video/*,application/pdf` | No |
| `NEXT_PUBLIC_CONCURRENT_UPLOADS` | Concurrent upload limit | `3` | No |

### AWS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_AWS_REGION` | AWS region | `us-east-1` | No |
| `NEXT_PUBLIC_S3_BUCKET_NAME` | S3 bucket name | - | If uploads enabled |
| `NEXT_PUBLIC_CLOUDFRONT_DOMAIN` | CloudFront domain | - | No |

### Error Tracking Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | - | No |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Sentry environment | `development` | No |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Application release version | `1.0.0` | No |
| `NEXT_PUBLIC_SENTRY_SAMPLE_RATE` | Error sampling rate (0-1) | `1.0` | No |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Performance sampling rate (0-1) | `0.1` | No |

### Performance Monitoring

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING` | Enable performance monitoring | `true` | No |
| `NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE` | Performance sampling rate (0-1) | `0.1` | No |

### Cache Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_CACHE_TTL` | Default cache TTL (ms) | `300000` | No |
| `NEXT_PUBLIC_CACHE_MAX_SIZE` | Maximum cache size (bytes) | `52428800` | No |
| `NEXT_PUBLIC_ENABLE_CACHE_PERSISTENCE` | Enable cache persistence | `true` | No |

### Real-time Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_WS_RECONNECT_ATTEMPTS` | WebSocket reconnect attempts | `5` | No |
| `NEXT_PUBLIC_WS_RECONNECT_INTERVAL` | Reconnect interval (ms) | `1000` | No |
| `NEXT_PUBLIC_WS_HEARTBEAT_INTERVAL` | Heartbeat interval (ms) | `30000` | No |

### Security Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_ENABLE_CSRF_PROTECTION` | Enable CSRF protection | `true` | No |
| `NEXT_PUBLIC_ENABLE_XSS_PROTECTION` | Enable XSS protection | `true` | No |
| `NEXT_PUBLIC_SECURE_COOKIES` | Use secure cookies | `false` (dev), `true` (prod) | No |

### Rate Limiting

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_RATE_LIMIT_MAX` | Maximum requests | `100` | No |
| `NEXT_PUBLIC_RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` | No |

### Feature Flags

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | Enable analytics | `true` | No |
| `NEXT_PUBLIC_ENABLE_NOTIFICATIONS` | Enable notifications | `true` | No |
| `NEXT_PUBLIC_ENABLE_REAL_TIME` | Enable real-time features | `true` | No |
| `NEXT_PUBLIC_ENABLE_FILE_UPLOADS` | Enable file uploads | `true` | No |

### API Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_API_TIMEOUT` | API request timeout (ms) | `30000` | No |
| `NEXT_PUBLIC_UPLOAD_TIMEOUT` | Upload timeout (ms) | `300000` | No |

### Development Tools

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_ENABLE_DEV_TOOLS` | Enable development tools | `false` | No |
| `NEXT_PUBLIC_ENABLE_GRAPHQL_PLAYGROUND` | Enable GraphQL playground | `false` | No |
| `NEXT_PUBLIC_ENABLE_REDUX_DEVTOOLS` | Enable Redux DevTools | `false` | No |
| `NEXT_PUBLIC_ENABLE_APOLLO_DEVTOOLS` | Enable Apollo DevTools | `false` | No |
| `NEXT_PUBLIC_LOG_LEVEL` | Logging level | `info` | No |

## Environment-Specific Configurations

### Development Environment

- Development tools enabled
- Relaxed security settings
- Verbose logging
- Full error tracking
- Local backend endpoints

### Staging Environment

- Production-like security
- Moderate error sampling
- Staging backend endpoints
- Performance monitoring enabled
- Development tools disabled

### Production Environment

- Strict security settings
- Minimal error sampling
- Production backend endpoints
- Optimized performance settings
- All development tools disabled

## Configuration Validation

The application automatically validates all configuration on startup. Validation includes:

- Required variables are present
- JWT secret meets minimum length requirements
- URLs are properly formatted
- Numeric values are within valid ranges
- Environment-specific requirements are met

### Validation Errors

Common validation errors and solutions:

| Error | Solution |
|-------|----------|
| "JWT secret must be at least 32 characters" | Set a longer `NEXT_PUBLIC_JWT_SECRET` |
| "GraphQL endpoint is required" | Set `NEXT_PUBLIC_GRAPHQL_ENDPOINT` |
| "S3 bucket name is required when file uploads are enabled" | Set `NEXT_PUBLIC_S3_BUCKET_NAME` or disable uploads |
| "Development tools should be disabled in production" | Set `NEXT_PUBLIC_ENABLE_DEV_TOOLS=false` |

## Configuration Monitoring

The application includes built-in configuration monitoring that:

- Checks service connectivity
- Validates configuration health
- Reports issues in real-time
- Provides debugging information

### Health Check Endpoints

The monitoring system checks:

- GraphQL API connectivity
- WebSocket connection
- Authentication configuration
- File upload configuration
- Error tracking setup

## Scripts

Use these npm scripts for configuration management:

```bash
# Validate configuration
npm run config:validate

# Check service health
npm run config:check

# Run full configuration test
npm run config:test

# Switch to different environments
npm run env:development
npm run env:staging
npm run env:production
```

## Troubleshooting

### Common Issues

1. **Configuration validation fails on startup**
   - Check all required environment variables are set
   - Verify JWT secret is at least 32 characters
   - Ensure URLs are properly formatted

2. **Services show as unhealthy**
   - Verify backend server is running
   - Check network connectivity
   - Validate endpoint URLs

3. **Error tracking not working**
   - Verify Sentry DSN is correct
   - Check sample rates are between 0 and 1
   - Ensure environment is properly set

4. **File uploads failing**
   - Verify S3 bucket name is set
   - Check AWS region configuration
   - Validate file type restrictions

### Debug Mode

Enable debug logging by setting:
```bash
NEXT_PUBLIC_LOG_LEVEL=debug
```

This will provide detailed information about:
- Configuration loading
- Service health checks
- Error tracking initialization
- Performance monitoring setup

## Security Considerations

### Production Checklist

- [ ] JWT secret is cryptographically secure (32+ characters)
- [ ] Sentry DSN is configured for error tracking
- [ ] Development tools are disabled
- [ ] Secure cookies are enabled
- [ ] CSRF protection is enabled
- [ ] Rate limiting is configured appropriately
- [ ] Error sampling rates are optimized for production

### Environment Variables Security

- Never commit `.env.local` to version control
- Use different JWT secrets for each environment
- Rotate secrets regularly
- Use environment-specific Sentry projects
- Validate all configuration on deployment

## Migration Guide

When updating configuration:

1. Update environment variable names in all environment files
2. Run configuration validation: `npm run config:validate`
3. Test service connectivity: `npm run config:check`
4. Update documentation
5. Deploy with proper environment variables

## Support

For configuration issues:

1. Check the console for detailed error messages
2. Run `npm run config:test` to validate setup
3. Review this documentation
4. Check the application logs for initialization errors