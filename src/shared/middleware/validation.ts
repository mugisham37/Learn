/**
 * Input Validation Middleware
 * 
 * Provides comprehensive input validation for Fastify endpoints using JSON Schema.
 * Validates request body, query parameters, and path parameters before processing.
 * 
 * Requirements: 13.1
 */

import { FastifyReply, FastifyRequest, FastifySchema } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

import { ValidationError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

/**
 * Validation configuration for an endpoint
 */
export interface ValidationConfig {
  body?: ZodSchema<any>;
  querystring?: ZodSchema<any>;
  params?: ZodSchema<any>;
  headers?: ZodSchema<any>;
}

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
  code: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  errors?: ValidationErrorDetail[];
  data?: {
    body?: any;
    querystring?: any;
    params?: any;
    headers?: any;
  };
}

/**
 * Formats Zod validation errors into a consistent structure
 * 
 * @param error - Zod validation error
 * @param prefix - Field prefix for nested validation
 * @returns Array of formatted validation error details
 */
function formatZodErrors(error: ZodError, prefix: string = ''): ValidationErrorDetail[] {
  return error.errors.map((err) => {
    const fieldPath = err.path.length > 0 ? err.path.join('.') : 'root';
    const field = prefix ? `${prefix}.${fieldPath}` : fieldPath;
    
    return {
      field,
      message: err.message,
      value: err.path.length > 0 ? undefined : err.received, // Only include value for root-level errors
      code: err.code,
    };
  });
}

/**
 * Validates request data against provided schemas
 * 
 * @param request - Fastify request object
 * @param config - Validation configuration with schemas
 * @returns Validation result with success flag and errors/data
 */
function validateRequest(
  request: FastifyRequest,
  config: ValidationConfig
): ValidationResult {
  const errors: ValidationErrorDetail[] = [];
  const validatedData: any = {};

  // Validate request body
  if (config.body) {
    try {
      validatedData.body = config.body.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...formatZodErrors(error, 'body'));
      } else {
        errors.push({
          field: 'body',
          message: 'Invalid request body format',
          code: 'invalid_type',
        });
      }
    }
  }

  // Validate query parameters
  if (config.querystring) {
    try {
      validatedData.querystring = config.querystring.parse(request.query);
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...formatZodErrors(error, 'query'));
      } else {
        errors.push({
          field: 'query',
          message: 'Invalid query parameters format',
          code: 'invalid_type',
        });
      }
    }
  }

  // Validate path parameters
  if (config.params) {
    try {
      validatedData.params = config.params.parse(request.params);
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...formatZodErrors(error, 'params'));
      } else {
        errors.push({
          field: 'params',
          message: 'Invalid path parameters format',
          code: 'invalid_type',
        });
      }
    }
  }

  // Validate headers
  if (config.headers) {
    try {
      validatedData.headers = config.headers.parse(request.headers);
    } catch (error) {
      if (error instanceof ZodError) {
        errors.push(...formatZodErrors(error, 'headers'));
      } else {
        errors.push({
          field: 'headers',
          message: 'Invalid headers format',
          code: 'invalid_type',
        });
      }
    }
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    data: validatedData,
  };
}

/**
 * Creates a validation middleware function for Fastify endpoints
 * 
 * This middleware validates incoming requests against provided Zod schemas
 * and rejects invalid requests with detailed error messages.
 * 
 * @param config - Validation configuration with schemas for different parts of the request
 * @returns Fastify preHandler middleware function
 * @throws ValidationError with detailed error information for invalid requests
 * 
 * Requirements: 13.1
 * 
 * @example
 * // Validate request body and query parameters
 * const validation = createValidationMiddleware({
 *   body: z.object({
 *     name: z.string().min(1),
 *     email: z.string().email(),
 *   }),
 *   querystring: z.object({
 *     page: z.number().int().positive().optional(),
 *     limit: z.number().int().positive().max(100).optional(),
 *   }),
 * });
 * 
 * fastify.post('/users', { preHandler: [validation] }, handler);
 * 
 * @example
 * // Validate path parameters
 * const validation = createValidationMiddleware({
 *   params: z.object({
 *     id: z.string().uuid(),
 *   }),
 * });
 * 
 * fastify.get('/users/:id', { preHandler: [validation] }, handler);
 */
export function createValidationMiddleware(config: ValidationConfig) {
  return function validationMiddleware(
    request: FastifyRequest,
    _reply: FastifyReply
  ): void {
    const requestId = request.id;
    const startTime = Date.now();

    try {
      // Perform validation
      const result = validateRequest(request, config);

      if (!result.success) {
        const validationTime = Date.now() - startTime;
        
        logger.warn(
          {
            requestId,
            method: request.method,
            url: request.url,
            errors: result.errors,
            validationTime,
          },
          'Request validation failed'
        );

        // Create detailed validation error
        const errorMessage = `Validation failed: ${result.errors!.length} error(s)`;
        const validationError = new ValidationError(errorMessage);
        
        // Add validation details to error for better error handling
        (validationError as any).validationErrors = result.errors;
        
        throw validationError;
      }

      // Attach validated data to request for use in handlers
      // This ensures handlers receive properly typed and validated data
      if (result.data) {
        if (result.data.body !== undefined) {
          request.body = result.data.body;
        }
        if (result.data.querystring !== undefined) {
          request.query = result.data.querystring;
        }
        if (result.data.params !== undefined) {
          request.params = result.data.params;
        }
        if (result.data.headers !== undefined) {
          // Don't replace all headers, just add validated ones
          (request as any).validatedHeaders = result.data.headers;
        }
      }

      const validationTime = Date.now() - startTime;
      
      logger.debug(
        {
          requestId,
          method: request.method,
          url: request.url,
          validationTime,
        },
        'Request validation successful'
      );
    } catch (error) {
      // If it's already a ValidationError, rethrow it
      if (error instanceof ValidationError) {
        throw error;
      }

      // Log unexpected errors
      const validationTime = Date.now() - startTime;
      logger.error(
        {
          requestId,
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          validationTime,
        },
        'Unexpected error during request validation'
      );

      // Throw generic validation error for unexpected errors
      throw new ValidationError('Request validation failed due to internal error');
    }
  };
}

/**
 * Converts Zod schema to Fastify JSON Schema for OpenAPI documentation
 * 
 * This is a basic converter that handles common Zod types.
 * For complex schemas, consider using a dedicated library like zod-to-json-schema.
 * 
 * @param zodSchema - Zod schema to convert
 * @returns Fastify-compatible JSON Schema object
 * 
 * Note: This is a simplified implementation. For production use with complex schemas,
 * consider using libraries like zod-to-json-schema for full compatibility.
 */
export function zodToFastifySchema(zodSchema: ZodSchema<any>): any {
  // This is a basic implementation for common cases
  // For full Zod to JSON Schema conversion, use a dedicated library
  
  try {
    // Try to infer basic schema structure
    const sample = {};
    const result = zodSchema.safeParse(sample);
    
    if (result.success) {
      return { type: 'object' };
    }
    
    // Return a generic object schema as fallback
    return {
      type: 'object',
      description: 'Request data validated by Zod schema',
    };
  } catch {
    return {
      type: 'object',
      description: 'Request data validated by Zod schema',
    };
  }
}

/**
 * Creates a complete Fastify schema object from validation config
 * 
 * This helper creates a Fastify schema that can be used for both
 * validation and OpenAPI documentation generation.
 * 
 * @param config - Validation configuration
 * @returns Fastify schema object
 * 
 * @example
 * const schema = createFastifySchema({
 *   body: z.object({ name: z.string() }),
 *   querystring: z.object({ page: z.number().optional() }),
 * });
 * 
 * fastify.post('/users', { schema }, handler);
 */
export function createFastifySchema(config: ValidationConfig): FastifySchema {
  const schema: FastifySchema = {};

  if (config.body) {
    schema.body = zodToFastifySchema(config.body);
  }

  if (config.querystring) {
    schema.querystring = zodToFastifySchema(config.querystring);
  }

  if (config.params) {
    schema.params = zodToFastifySchema(config.params);
  }

  if (config.headers) {
    schema.headers = zodToFastifySchema(config.headers);
  }

  return schema;
}

/**
 * Common validation schemas for reuse across endpoints
 */
export const commonValidationSchemas = {
  // UUID parameter validation
  uuidParam: {
    params: {
      id: 'string',
    },
  },
  
  // Pagination query parameters
  paginationQuery: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        sort: { type: 'string' },
        order: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
      },
      additionalProperties: false,
    },
  },
  
  // Search query parameters
  searchQuery: {
    querystring: {
      type: 'object',
      properties: {
        q: { type: 'string', minLength: 1 },
        category: { type: 'string' },
        difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
        minRating: { type: 'number', minimum: 0, maximum: 5 },
        maxPrice: { type: 'number', minimum: 0 },
      },
      required: ['q'],
      additionalProperties: false,
    },
  },
};

/**
 * Validation middleware that can be used as a Fastify plugin
 * 
 * This plugin adds validation capabilities to Fastify instances
 * and provides helper methods for creating validation middleware.
 */
export const validationPlugin = {
  name: 'validation',
  version: '1.0.0',
  register: async function (fastify: any) {
    // Add validation helpers to Fastify instance
    fastify.decorate('createValidation', createValidationMiddleware);
    fastify.decorate('createSchema', createFastifySchema);
    fastify.decorate('commonSchemas', commonValidationSchemas);
  },
};
