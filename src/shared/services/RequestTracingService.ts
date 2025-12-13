/**
 * Request Tracing Service
 * 
 * Implements distributed request tracing with unique request IDs, correlation
 * across services, and comprehensive request flow tracking. Integrates with
 * logging and monitoring systems for end-to-end observability.
 * 
 * Requirements: 17.3
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

import { FastifyRequest } from 'fastify';

import { logger } from '../utils/logger.js';

/**
 * Request trace context
 */
export interface RequestTraceContext {
  requestId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  startTime: number;
  metadata: Record<string, unknown>;
}

/**
 * Trace span for tracking operations
 */
export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, unknown>;
  logs: Array<{
    timestamp: number;
    level: string;
    message: string;
    fields?: Record<string, unknown>;
  }>;
  status: 'ok' | 'error' | 'timeout';
  error?: Error;
}

/**
 * Request trace data
 */
export interface RequestTrace {
  traceId: string;
  requestId: string;
  spans: Map<string, TraceSpan>;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata: Record<string, unknown>;
}

/**
 * Request tracing service interface
 */
export interface IRequestTracingService {
  // Context management
  createTraceContext(request: FastifyRequest): RequestTraceContext;
  getCurrentContext(): RequestTraceContext | undefined;
  setContext(context: RequestTraceContext): void;
  
  // Span management
  startSpan(operationName: string, parentSpanId?: string): TraceSpan;
  finishSpan(spanId: string, status?: 'ok' | 'error' | 'timeout', error?: Error): void;
  addSpanTag(spanId: string, key: string, value: unknown): void;
  addSpanLog(spanId: string, level: string, message: string, fields?: Record<string, unknown>): void;
  
  // Trace management
  getTrace(traceId: string): RequestTrace | undefined;
  finishTrace(traceId: string): void;
  
  // Utilities
  generateRequestId(): string;
  generateTraceId(): string;
  generateSpanId(): string;
  
  // Middleware integration
  extractTraceHeaders(headers: Record<string, unknown>): Partial<RequestTraceContext>;
  injectTraceHeaders(context: RequestTraceContext): Record<string, string>;
}

/**
 * Request tracing service implementation
 */
export class RequestTracingService implements IRequestTracingService {
  private asyncLocalStorage = new AsyncLocalStorage<RequestTraceContext>();
  private traces = new Map<string, RequestTrace>();
  private readonly maxTraces = 1000; // Limit memory usage
  private readonly traceRetentionMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Clean up old traces periodically
    setInterval(() => {
      this.cleanupOldTraces();
    }, 60000); // Every minute
  }

  /**
   * Create trace context from Fastify request
   */
  createTraceContext(request: FastifyRequest): RequestTraceContext {
    // Extract existing trace context from headers
    const existingContext = this.extractTraceHeaders(request.headers);
    
    // Generate IDs
    const requestId = request.id || this.generateRequestId();
    const traceId = existingContext.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    // Extract user context if available
    const user = 'user' in request ? request.user : undefined;

    const context: RequestTraceContext = {
      requestId,
      traceId,
      spanId,
      parentSpanId: existingContext.parentSpanId,
      userId: user?.id,
      sessionId: existingContext.sessionId,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      method: request.method,
      url: request.url,
      startTime: Date.now(),
      metadata: {},
    };

    // Create or update trace
    this.createOrUpdateTrace(context);

    return context;
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): RequestTraceContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Set trace context
   */
  setContext(context: RequestTraceContext): void {
    this.asyncLocalStorage.enterWith(context);
  }

  /**
   * Start a new span
   */
  startSpan(operationName: string, parentSpanId?: string): TraceSpan {
    const context = this.getCurrentContext();
    const spanId = this.generateSpanId();
    
    const span: TraceSpan = {
      spanId,
      parentSpanId: parentSpanId || context?.spanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    // Add span to current trace
    if (context) {
      const trace = this.traces.get(context.traceId);
      if (trace) {
        trace.spans.set(spanId, span);
      }
    }

    logger.debug('Started span', {
      spanId,
      operationName,
      parentSpanId: span.parentSpanId,
      traceId: context?.traceId,
    });

    return span;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId: string, status: 'ok' | 'error' | 'timeout' = 'ok', error?: Error): void {
    const context = this.getCurrentContext();
    if (!context) return;

    const trace = this.traces.get(context.traceId);
    if (!trace) return;

    const span = trace.spans.get(spanId);
    if (!span) return;

    const now = Date.now();
    span.endTime = now;
    span.duration = now - span.startTime;
    span.status = status;
    
    if (error) {
      span.error = error;
      span.tags['error'] = true;
      span.tags['errorMessage'] = error.message;
      span.tags['errorName'] = error.name;
    }

    logger.debug('Finished span', {
      spanId,
      operationName: span.operationName,
      duration: span.duration,
      status,
      traceId: context.traceId,
    });
  }

  /**
   * Add tag to span
   */
  addSpanTag(spanId: string, key: string, value: unknown): void {
    const context = this.getCurrentContext();
    if (!context) return;

    const trace = this.traces.get(context.traceId);
    if (!trace) return;

    const span = trace.spans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * Add log entry to span
   */
  addSpanLog(spanId: string, level: string, message: string, fields?: Record<string, unknown>): void {
    const context = this.getCurrentContext();
    if (!context) return;

    const trace = this.traces.get(context.traceId);
    if (!trace) return;

    const span = trace.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields,
      });
    }
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): RequestTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Finish a trace
   */
  finishTrace(traceId: string): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;

      logger.debug('Finished trace', {
        traceId,
        duration: trace.duration,
        spanCount: trace.spans.size,
      });
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId(): string {
    return randomUUID();
  }

  /**
   * Generate unique trace ID
   */
  generateTraceId(): string {
    return randomUUID().replace(/-/g, '');
  }

  /**
   * Generate unique span ID
   */
  generateSpanId(): string {
    return Math.random().toString(16).substring(2, 18);
  }

  /**
   * Extract trace context from headers
   */
  extractTraceHeaders(headers: Record<string, unknown>): Partial<RequestTraceContext> {
    const context: Partial<RequestTraceContext> = {};

    // Standard trace headers
    if (headers['x-trace-id'] && typeof headers['x-trace-id'] === 'string') {
      context.traceId = headers['x-trace-id'];
    }

    if (headers['x-span-id'] && typeof headers['x-span-id'] === 'string') {
      context.parentSpanId = headers['x-span-id'];
    }

    if (headers['x-session-id'] && typeof headers['x-session-id'] === 'string') {
      context.sessionId = headers['x-session-id'];
    }

    // B3 tracing headers (Zipkin)
    if (headers['x-b3-traceid'] && typeof headers['x-b3-traceid'] === 'string') {
      context.traceId = headers['x-b3-traceid'];
    }

    if (headers['x-b3-spanid'] && typeof headers['x-b3-spanid'] === 'string') {
      context.parentSpanId = headers['x-b3-spanid'];
    }

    // Jaeger tracing headers
    if (headers['uber-trace-id'] && typeof headers['uber-trace-id'] === 'string') {
      const parts = headers['uber-trace-id'].split(':');
      if (parts.length >= 2) {
        context.traceId = parts[0];
        context.parentSpanId = parts[1];
      }
    }

    return context;
  }

  /**
   * Inject trace headers for outgoing requests
   */
  injectTraceHeaders(context: RequestTraceContext): Record<string, string> {
    return {
      'x-request-id': context.requestId,
      'x-trace-id': context.traceId,
      'x-span-id': context.spanId,
      ...(context.sessionId && { 'x-session-id': context.sessionId }),
    };
  }

  /**
   * Create or update trace
   */
  private createOrUpdateTrace(context: RequestTraceContext): void {
    let trace = this.traces.get(context.traceId);
    
    if (!trace) {
      trace = {
        traceId: context.traceId,
        requestId: context.requestId,
        spans: new Map(),
        startTime: context.startTime,
        metadata: { ...context.metadata },
      };
      
      this.traces.set(context.traceId, trace);
      
      // Limit memory usage
      if (this.traces.size > this.maxTraces) {
        const oldestTraceId = this.traces.keys().next().value;
        this.traces.delete(oldestTraceId);
      }
    }

    // Add initial span for the request
    const requestSpan: TraceSpan = {
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      operationName: `${context.method} ${context.url}`,
      startTime: context.startTime,
      tags: {
        'http.method': context.method,
        'http.url': context.url,
        'user.id': context.userId,
        'user_agent': context.userAgent,
        'client.ip': context.ip,
      },
      logs: [],
      status: 'ok',
    };

    trace.spans.set(context.spanId, requestSpan);
  }

  /**
   * Clean up old traces to prevent memory leaks
   */
  private cleanupOldTraces(): void {
    const now = Date.now();
    const cutoff = now - this.traceRetentionMs;
    
    for (const [traceId, trace] of this.traces.entries()) {
      if (trace.startTime < cutoff) {
        this.traces.delete(traceId);
      }
    }
  }
}

/**
 * Global request tracing service instance
 */
export const requestTracingService = new RequestTracingService();

/**
 * Trace decorator for functions
 */
export function trace(operationName: string) {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const span = requestTracingService.startSpan(operationName);
      
      try {
        const result = await originalMethod.apply(this, args);
        requestTracingService.finishSpan(span.spanId, 'ok');
        return result;
      } catch (error) {
        requestTracingService.finishSpan(span.spanId, 'error', error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Trace async operation
 */
export async function traceAsync<T>(
  operationName: string,
  operation: () => Promise<T>,
  tags?: Record<string, unknown>
): Promise<T> {
  const span = requestTracingService.startSpan(operationName);
  
  if (tags) {
    Object.entries(tags).forEach(([key, value]) => {
      requestTracingService.addSpanTag(span.spanId, key, value);
    });
  }

  try {
    const result = await operation();
    requestTracingService.finishSpan(span.spanId, 'ok');
    return result;
  } catch (error) {
    requestTracingService.finishSpan(span.spanId, 'error', error as Error);
    throw error;
  }
}