# CSRF Protection Implementation

This document describes the CSRF (Cross-Site Request Forgery) protection implementation for the learning platform backend.

## Overview

The CSRF protection implementation provides multiple layers of security:

1. **SameSite Cookie Attributes**: Cookies are set with `SameSite=Strict` to prevent cross-site requests
2. **CSRF Token Validation**: Double-submit cookie pattern with token validation
3. **Custom Header Requirements**: State-changing requests must include `X-Requested-With` header
4. **Origin/Referer Validation**: Validates request origin against allowed origins

## Requirements Satisfied

- **Requirement 13.8**: CSRF protection with SameSite cookies, token validation, custom headers, and origin verification

## Implementation Details

### CSRF Token Generation

```typescript
import { generateCSRFToken } from '../shared/middleware/csrf.js';

const token = generateCSRFToken(); // Returns base64url-encoded token
```

### Server Integration

The CSRF protection is automatically registered in the server:

```typescript
import { registerCSRFProtection } from '../shared/middleware/csrf.js';

await registerCSRFProtection(server);
```

### Cookie Configuration

Cookies are set with secure attributes:

- `httpOnly: true` - Prevents JavaScript access
- `secure: true` - HTTPS only in production
- `sameSite: 'strict'` - Strict SameSite policy
- `maxAge: 86400` - 24-hour expiration

### Protected Methods

The following HTTP methods require CSRF protection:
- POST
- PUT
- PATCH
- DELETE

Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF protection.

## Client Usage

### 1. Obtain CSRF Token

```javascript
// Get CSRF token from server
const response = await fetch('/api/csrf-token', {
  credentials: 'include' // Include cookies
});

const { csrfToken } = await response.json();
```

### 2. Include Token in Requests

```javascript
// Include CSRF token in state-changing requests
const response = await fetch('/api/some-endpoint', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    'X-Requested-With': 'XMLHttpRequest'
  },
  body: JSON.stringify(data)
});
```

### 3. GraphQL Requests

For GraphQL requests, include the CSRF token:

```javascript
const response = await fetch('/graphql', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    'X-Requested-With': 'XMLHttpRequest'
  },
  body: JSON.stringify({
    query: '...',
    variables: { ... }
  })
});
```

## Security Features

### Double-Submit Cookie Pattern

- CSRF token is stored in both a cookie and returned to the client
- Client must include the token in the request header
- Server validates that both values match

### Timing-Safe Comparison

Token validation uses `crypto.timingSafeEqual()` to prevent timing attacks.

### Origin Validation

Requests are validated against configured allowed origins:

```typescript
// From config
cors: {
  origin: ['http://localhost:3001', 'https://yourdomain.com']
}
```

### Referer Validation

Additional validation of the `Referer` header as a backup to origin validation.

## Error Responses

CSRF protection failures return HTTP 400 with descriptive error messages:

- `Invalid or missing origin header`
- `Invalid or missing referer header`
- `Missing required header: x-requested-with`
- `Missing required header: x-csrf-token`
- `Missing CSRF token cookie`
- `Invalid CSRF token`

## Testing

The implementation includes comprehensive tests:

- Token generation validation
- Server integration tests
- Protection mechanism validation
- Valid request flow testing

Run tests with:

```bash
npm test -- src/shared/middleware/__tests__/csrf-integration.test.ts
```

## Production Considerations

1. **HTTPS Required**: Secure cookies require HTTPS in production
2. **Origin Configuration**: Ensure allowed origins are properly configured
3. **Token Rotation**: CSRF tokens are generated per session
4. **Error Handling**: Failed CSRF validation is logged for monitoring

## Exempted Endpoints

The following endpoints are exempt from CSRF protection:

- `/api/csrf-token` - Token generation endpoint
- `/health/*` - Health check endpoints
- All GET, HEAD, OPTIONS requests

## Integration with Authentication

CSRF protection works alongside JWT authentication:

1. Authentication validates user identity
2. CSRF protection prevents unauthorized state changes
3. Both mechanisms work together for comprehensive security