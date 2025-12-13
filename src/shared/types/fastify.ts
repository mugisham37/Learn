/**
 * Extended Fastify Types
 *
 * Type definitions for Fastify extensions and plugins
 */

import { FastifyRequest } from 'fastify';
import { UserContext } from './index.js';

/**
 * Multipart file interface (from @fastify/multipart)
 */
export interface MultipartFile {
  filename: string;
  mimetype: string;
  encoding: string;
  toBuffer(): Promise<Buffer>;
  file: NodeJS.ReadableStream;
  fieldname: string;
}

/**
 * Extended FastifyRequest with multipart support
 */
export interface FastifyRequestWithMultipart extends FastifyRequest {
  isMultipart(): boolean;
  file(): Promise<MultipartFile | undefined>;
  files(): AsyncIterableIterator<MultipartFile>;
}

/**
 * Extended FastifyRequest with user context
 */
export interface AuthenticatedFastifyRequest extends FastifyRequest {
  user: UserContext;
}

/**
 * Extended FastifyRequest with trace context
 */
export interface TraceContext {
  requestId: string;
  traceId: string;
  spanId: string;
  metadata: Record<string, unknown>;
}

export interface FastifyRequestWithTracing extends FastifyRequest {
  traceContext?: TraceContext;
}

/**
 * Extended FastifyRequest with Sentry transaction
 */
export interface SentryTransaction {
  setTag(key: string, value: string): void;
  setStatus(status: string): void;
  finish(): void;
}

export interface FastifyRequestWithSentry extends FastifyRequest {
  sentryTransaction?: SentryTransaction;
}

/**
 * Combined request interface with all extensions
 */
export interface ExtendedFastifyRequest extends FastifyRequest {
  user?: UserContext;
  traceContext?: TraceContext;
  sentryTransaction?: SentryTransaction;
  isMultipart?(): boolean;
  file?(): Promise<MultipartFile | undefined>;
  files?(): AsyncIterableIterator<MultipartFile>;
}

/**
 * Type guard for authenticated requests
 */
export function isAuthenticatedRequest(request: FastifyRequest): request is AuthenticatedFastifyRequest {
  return 'user' in request && request.user !== undefined;
}

/**
 * Type guard for multipart requests
 */
export function isMultipartRequest(request: FastifyRequest): request is FastifyRequestWithMultipart {
  return 'isMultipart' in request && typeof request.isMultipart === 'function';
}

/**
 * Type guard for traced requests
 */
export function isTracedRequest(request: FastifyRequest): request is FastifyRequestWithTracing {
  return 'traceContext' in request && request.traceContext !== undefined;
}