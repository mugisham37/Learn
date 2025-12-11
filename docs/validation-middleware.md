# Input Validation Middleware

This document describes the input validation middleware implementation for the Learning Platform Backend. The middleware provides comprehensive request validation using JSON Schema (via Zod) to ensure all inputs are validated before processing.

## Overview

The input validation middleware validates incoming requests against predefined schemas and rejects invalid requests with detailed error messages. It supports validation of:

- Request body
- Query parameters
- Path parameters
- Headers

## Requirements

This implementation satisfies **Requirement 13.1**: "WHEN user input is received, THEN the Platform SHALL validate all inputs using JSON Schema before processing and reject invalid requests"

## Features

- **Comprehensive Validation**: Validates request body, query parameters, path parameters, and headers
- **Detailed Error Messages**: Provides specific error details for each validation failure
- **Type Safety**: Uses Zod schemas for runtime validation and TypeScript type inference
- **Performance Optimized**: Efficient validation with minimal overhead
- **Fastify Integration**: Seamlessly integrates with Fastify's preHandler system
- **Flexible Configuration**: Supports partial validation (e.g., only body or only query parameters)
- **Error Context**: Includes request context in error logs for debugging

## Usage

### Basic Usage

```typescript
import { createValidationMiddleware } from '@shared/middleware/validation.js';
import { z } from 'zod';

// Define validation schema
const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  age: z.number().int().positive('Age must be a positive integer'),
});

// Create validation middleware
const validation = createValidationMiddleware({
  body: userSchema,
});

// Use with Fastify route
fastify.post('/users', {
  preHandler: [validation],
}, async (request, reply) => {
  // request.body is now validated and typed
  const userData = request.body; // TypeScript knows this is validated
  // ... handle request
});
```

### Query Parameter Validation

```typescript
const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)),
  sort: z.string().optional(),
});

const validation = createValidationMiddleware({
  querystring: paginationSchema,
});

fastify.get('/users', {
  preHandler: [validation],
}, async (request, reply) => {
  const { page, limit, sort } = request.query;
  // ... handle paginated request
});
```

### Path Parameter Validation

```typescript
const idParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

const validation = createValidationMiddleware({
  params: idParamSchema,
});

fastify.get('/users/:id', {
  preHandler: [validation],
}, async (request, reply) => {
  const { id } = request.params; // Validated UUID
  // ... handle request
});
```

### Combined Validation

```typescript
const validation = createValidationMiddleware({
  body: userSchema,
  querystring: paginationSchema,
  params: idParamSchema,
  headers: z.object({
    'content-type': z.string().includes('application/json'),
    authorization: z.string().startsWith('Bearer '),
  }),
});

fastify.put('/users/:id', {
  preHandler: [validation],
}, async (request, reply) => {
  // All parts of the request are validated
  const { id } = request.params;
  const userData = request.body;
  const { page, limit } = request.query;
  const validatedHeaders = (request as any).validatedHeaders;
  // ... handle request
});
```

## Common Schemas

The platform provides pre-built schemas for common validation patterns:

```typescript
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  paginationSchema,
  searchSchema,
  roleSchema,
  difficultySchema,
} from '@shared/schemas/common.js';

// Use pre-built schemas
const validation = createValidationMiddleware({
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
  }),
  querystring: paginationSchema,
  params: z.object({
    id: uuidSchema,
  }),
});
```

## Endpoint-Specific Schemas

Pre-built schemas for common endpoints:

```typescript
import {
  registerUserSchema,
  loginUserSchema,
  createCourseSchema,
  updateProfileSchema,
} from '@shared/schemas/endpoints.js';

// User registration
const registerValidation = createValidationMiddleware({
  body: registerUserSchema,
});

// Course creation
const createCourseValidation = createValidationMiddleware({
  body: createCourseSchema,
});
```

## Error Handling

When validation fails, the middleware throws a `ValidationError` with detailed information:

```typescript
// Example validation error response
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed: 3 error(s)",
  "validationErrors": [
    {
      "field": "body.email",
      "message": "Invalid email format",
      "code": "invalid_string"
    },
    {
      "field": "body.age",
      "message": "Age must be a positive integer",
      "code": "too_small"
    },
    {
      "field": "query.page",
      "message": "Page must be at least 1",
      "code": "too_small"
    }
  ]
}
```

## Advanced Usage

### Custom Transformations

```typescript
const schema = z.object({
  email: z.string().email().transform(email => email.toLowerCase()),
  tags: z.string().transform(str => str.split(',').map(tag => tag.trim())),
  isActive: z.string().transform(str => str === 'true'),
});
```

### Conditional Validation

```typescript
const schema = z.object({
  type: z.enum(['student', 'educator']),
  studentId: z.string().optional(),
  institutionId: z.string().optional(),
}).refine(data => {
  if (data.type === 'student') {
    return !!data.studentId;
  }
  if (data.type === 'educator') {
    return !!data.institutionId;
  }
  return true;
}, {
  message: "Student ID required for students, Institution ID required for educators",
});
```

### File Upload Validation

```typescript
const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().refine(type => 
    ['image/jpeg', 'image/png', 'application/pdf'].includes(type),
    'Invalid file type'
  ),
  size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
});
```

## Performance Considerations

- **Schema Reuse**: Create schemas once and reuse them across multiple endpoints
- **Minimal Validation**: Only validate what's necessary for each endpoint
- **Efficient Schemas**: Use specific validation rules to fail fast
- **Caching**: Zod schemas are automatically optimized and cached

```typescript
// Good: Reuse schemas
const userIdParam = z.object({ id: uuidSchema });
const getUserValidation = createValidationMiddleware({ params: userIdParam });
const updateUserValidation = createValidationMiddleware({ 
  params: userIdParam,
  body: updateUserSchema,
});

// Good: Minimal validation
const searchValidation = createValidationMiddleware({
  querystring: z.object({
    q: z.string().min(1), // Only validate what's needed
  }),
});
```

## Testing

The validation middleware includes comprehensive tests covering:

- Valid input validation
- Invalid input rejection
- Error message formatting
- Performance characteristics
- Edge cases and error conditions

```typescript
// Example test
it('should validate request body correctly', () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  });

  const middleware = createValidationMiddleware({ body: schema });
  const request = createMockRequest({
    body: { name: 'John', email: 'john@example.com' },
  });

  expect(() => middleware(request, reply)).not.toThrow();
  expect(request.body).toEqual({ name: 'John', email: 'john@example.com' });
});
```

## Integration with Fastify Schema

The middleware can generate Fastify schemas for OpenAPI documentation:

```typescript
import { createFastifySchema } from '@shared/middleware/validation.js';

const validationConfig = {
  body: userSchema,
  querystring: paginationSchema,
};

const fastifySchema = createFastifySchema(validationConfig);

fastify.post('/users', {
  schema: fastifySchema, // For OpenAPI documentation
  preHandler: [createValidationMiddleware(validationConfig)], // For validation
}, handler);
```

## Best Practices

1. **Define Schemas Once**: Create reusable schemas in the `@shared/schemas` directory
2. **Use Type Inference**: Let TypeScript infer types from Zod schemas
3. **Validate Early**: Apply validation middleware before authentication/authorization
4. **Provide Clear Messages**: Use descriptive error messages in schemas
5. **Handle Transformations**: Use Zod transforms for data normalization
6. **Test Thoroughly**: Write tests for both valid and invalid inputs
7. **Document Schemas**: Include descriptions in schemas for API documentation

```typescript
// Good schema with clear messages and descriptions
const userSchema = z.object({
  email: z.string()
    .email('Please provide a valid email address')
    .max(254, 'Email address is too long')
    .describe('User email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .describe('User password with strength requirements'),
});
```

## Security Considerations

- **Input Sanitization**: Validation middleware prevents malformed data from reaching business logic
- **Type Safety**: Runtime validation ensures data matches expected types
- **Error Information**: Validation errors don't expose sensitive system information
- **Performance**: Efficient validation prevents DoS attacks through malformed requests

## Troubleshooting

### Common Issues

1. **Schema Not Matching Request**: Ensure schema structure matches request data structure
2. **Transformation Errors**: Check that transforms handle all possible input values
3. **Performance Issues**: Use specific validation rules and avoid complex regex patterns
4. **Type Errors**: Ensure TypeScript types match Zod schema inference

### Debugging

Enable debug logging to see validation details:

```typescript
// The middleware automatically logs validation failures
// Check application logs for validation error details
```

## Migration Guide

When updating validation schemas:

1. **Backward Compatibility**: Ensure new schemas don't break existing clients
2. **Gradual Migration**: Use optional fields when adding new requirements
3. **Version Endpoints**: Consider API versioning for breaking changes
4. **Test Coverage**: Update tests when changing validation rules

## API Reference

### `createValidationMiddleware(config: ValidationConfig)`

Creates a Fastify preHandler middleware function for request validation.

**Parameters:**
- `config.body?: ZodSchema` - Schema for request body validation
- `config.querystring?: ZodSchema` - Schema for query parameter validation
- `config.params?: ZodSchema` - Schema for path parameter validation
- `config.headers?: ZodSchema` - Schema for header validation

**Returns:** Fastify preHandler middleware function

**Throws:** `ValidationError` when validation fails

### `createFastifySchema(config: ValidationConfig)`

Creates a Fastify schema object for OpenAPI documentation.

**Parameters:**
- `config: ValidationConfig` - Same configuration as validation middleware

**Returns:** Fastify schema object

### `zodToFastifySchema(schema: ZodSchema)`

Converts a Zod schema to Fastify JSON Schema format.

**Parameters:**
- `schema: ZodSchema` - Zod schema to convert

**Returns:** Fastify-compatible JSON Schema object

## Examples

See `src/shared/middleware/examples/validation-usage.ts` for comprehensive examples of using the validation middleware with different types of endpoints and validation scenarios.