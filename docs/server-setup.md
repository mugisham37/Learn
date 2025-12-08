# Fastify Server Setup

This document describes the Fastify server implementation for the Learning Platform Backend.

## Overview

The server is built using Fastify 4.x, a high-performance web framework for Node.js. It includes:

- **CORS support** for cross-origin requests
- **Security headers** via Helmet
- **Request logging** with unique request IDs
- **Graceful shutdown** handling
- **Health check endpoints**
- **Global error handling**

## Architecture

### Server Module (`src/server.ts`)

The server module exports three main functions:

1. **`createServer()`**: Creates and configures a Fastify instance
2. **`startServer(server)`**: Starts the server on the configured host and port
3. **`stopServer(server)`**: Gracefully shuts down the server

### Application Entry Point (`src/index.ts`)

The main application file:

- Validates configuration on startup
- Creates the Fastify server instance
- Handles graceful shutdown signals (SIGTERM, SIGINT)
- Handles uncaught exceptions and unhandled rejections

## Configuration

Server configuration is managed through environment variables (see `.env.example`):

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3001,http://localhost:3000
CORS_CREDENTIALS=true
```

## Features

### 1. Request Logging

Every request is logged with:
- Unique request ID (UUID v4)
- HTTP method and URL
- Client IP address
- User agent
- Response status code
- Response time

### 2. CORS Configuration

CORS is configured to:
- Accept requests from configured origins
- Support credentials (cookies, authorization headers)
- Allow common HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS)
- Expose custom headers (X-Request-ID, rate limit headers)

### 3. Security Headers

Helmet adds security headers including:
- X-DNS-Prefetch-Control
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security (in production)

### 4. Health Check Endpoints

#### Basic Health Check
```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

#### Deep Health Check
```
GET /health/deep
```

Returns health status including dependency checks (database, Redis, etc.):
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "checks": {
    "database": "not_implemented",
    "redis": "not_implemented"
  }
}
```

### 5. Error Handling

The server includes:

- **404 Handler**: Returns structured error for non-existent routes
- **Global Error Handler**: Catches all errors and returns consistent error responses
- **Development vs Production**: Error details are hidden in production

Error response format:
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "requestId": "uuid-v4"
}
```

### 6. Graceful Shutdown

The server handles shutdown signals properly:

1. Receives SIGTERM or SIGINT signal
2. Stops accepting new connections
3. Waits for existing requests to complete
4. Closes database connections and other resources
5. Exits the process

## Running the Server

### Development Mode

```bash
# Start with auto-reload
npm run dev

# Or use the dedicated server script
npm run dev:server
```

### Production Mode

```bash
# Build the application
npm run build

# Start the server
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run server tests specifically
npm test -- src/server.test.ts --run

# Run tests in watch mode
npm run test:watch
```

## Available Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API information |
| GET | `/health` | Basic health check |
| GET | `/health/deep` | Deep health check with dependencies |

## Next Steps

The following features will be added in subsequent tasks:

- [ ] Database connection integration
- [ ] Redis connection integration
- [ ] Authentication middleware
- [ ] Authorization middleware
- [ ] Rate limiting
- [ ] GraphQL server integration
- [ ] WebSocket support
- [ ] Module route registration

## Troubleshooting

### Server won't start

1. Check that required environment variables are set (JWT_SECRET, SESSION_SECRET, DATABASE_URL)
2. Verify the port is not already in use
3. Check the logs for specific error messages

### CORS errors

1. Verify CORS_ORIGIN includes your frontend URL
2. Check that CORS_CREDENTIALS is set correctly
3. Ensure the frontend sends the correct Origin header

### Health checks failing

1. Verify the server is running
2. Check that the port is accessible
3. Review server logs for errors

## Performance Considerations

- **Request timeout**: 30 seconds (configurable)
- **Body size limit**: Based on MAX_FILE_SIZE_MB environment variable
- **Trust proxy**: Enabled in production for proper IP detection
- **Logging**: JSON format in production, pretty format in development

## Security Best Practices

1. Always use HTTPS in production
2. Set appropriate CORS origins (never use '*' in production)
3. Keep Helmet security headers enabled
4. Regularly update dependencies
5. Use environment variables for sensitive configuration
6. Enable rate limiting (to be implemented)
7. Validate all user input (to be implemented)
