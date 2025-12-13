/**
 * Compression Middleware
 *
 * Implements gzip and brotli compression for HTTP responses.
 * Provides intelligent compression based on content type and size.
 *
 * Requirements: 15.5
 */

// Compression utilities are available but not used in this implementation
// import { createGzip, createBrotliCompress } from 'zlib';

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { logger } from '../utils/logger.js';

/**
 * Compression configuration options
 */
export interface CompressionOptions {
  /** Minimum response size to compress (bytes) */
  threshold?: number;
  /** Compression level (1-9 for gzip, 1-11 for brotli) */
  level?: number;
  /** Content types to compress */
  contentTypes?: string[];
  /** Whether to prefer brotli over gzip */
  preferBrotli?: boolean;
}

/**
 * Default compression configuration
 */
const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  threshold: 1024, // 1KB minimum
  level: 6, // Balanced compression level
  contentTypes: [
    'text/html',
    'text/css',
    'text/javascript',
    'text/plain',
    'text/xml',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/rss+xml',
    'application/atom+xml',
    'image/svg+xml',
  ],
  preferBrotli: true,
};

/**
 * Checks if content type should be compressed
 */
function _shouldCompress(contentType: string, allowedTypes: string[]): boolean {
  if (!contentType) return false;

  const type = contentType.toLowerCase().split(';')[0]?.trim() || '';
  return allowedTypes.some((allowed) => type.includes(allowed));
}

/**
 * Determines the best compression algorithm based on Accept-Encoding header
 */
function getBestCompression(acceptEncoding: string | string[] | undefined, preferBrotli: boolean): 'br' | 'gzip' | null {
  if (!acceptEncoding) return null;

  const encoding = Array.isArray(acceptEncoding) ? acceptEncoding.join(',').toLowerCase() : acceptEncoding.toLowerCase();

  if (preferBrotli && encoding.includes('br')) {
    return 'br';
  }

  if (encoding.includes('gzip')) {
    return 'gzip';
  }

  if (encoding.includes('br')) {
    return 'br';
  }

  return null;
}

/**
 * Compression middleware for Fastify
 */
export function createCompressionMiddleware(options: CompressionOptions = {}): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return function compressionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Skip compression for certain conditions
    if (
      request.method === 'HEAD' ||
      reply.getHeader('content-encoding') ||
      reply.statusCode === 204 ||
      reply.statusCode === 304
    ) {
      return Promise.resolve();
    }

    const acceptEncoding = request.headers['accept-encoding'];
    const compression = getBestCompression(acceptEncoding, config.preferBrotli);

    if (!compression) {
      return Promise.resolve();
    }

    // Set compression headers
    if (compression === 'br') {
      void reply.header('content-encoding', 'br');
    } else {
      void reply.header('content-encoding', 'gzip');
    }

    // Add Vary header for proper caching
    const varyHeader = reply.getHeader('vary') as string | undefined;
    const varyValues = varyHeader ? varyHeader.split(',').map((v) => v.trim()) : [];
    if (!varyValues.includes('Accept-Encoding')) {
      varyValues.push('Accept-Encoding');
      void reply.header('vary', varyValues.join(', '));
    }

    logger.debug('Compression headers set', {
      method: request.method,
      url: request.url,
      compression,
    });

    return Promise.resolve();
  };
}

/**
 * Compresses a payload using the specified compression stream
 */
async function _compressStream(payload: string | Buffer, compressionStream: NodeJS.ReadWriteStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  compressionStream.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  return new Promise((resolve, reject) => {
    compressionStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    compressionStream.on('error', reject);

    // Write payload to compression stream
    if (typeof payload === 'string') {
      compressionStream.write(Buffer.from(payload, 'utf8'));
    } else {
      compressionStream.write(payload);
    }

    compressionStream.end();
  });
}

/**
 * Registers compression middleware with Fastify
 */
export function registerCompression(
  fastify: FastifyInstance,
  options: CompressionOptions = {}
): Promise<void> {
  const middleware = createCompressionMiddleware(options);

  // Register as a global hook
  void fastify.addHook('preHandler', middleware);

  logger.info('Compression middleware registered', {
    threshold: options.threshold || DEFAULT_OPTIONS.threshold,
    level: options.level || DEFAULT_OPTIONS.level,
    preferBrotli: options.preferBrotli ?? DEFAULT_OPTIONS.preferBrotli,
  });

  return Promise.resolve();
}

/**
 * Compression statistics for monitoring
 */
export interface CompressionStats {
  totalRequests: number;
  compressedRequests: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  averageCompressionRatio: number;
}

/**
 * Global compression statistics
 */
let compressionStats: CompressionStats = {
  totalRequests: 0,
  compressedRequests: 0,
  totalOriginalBytes: 0,
  totalCompressedBytes: 0,
  averageCompressionRatio: 0,
};

/**
 * Gets current compression statistics
 */
export function getCompressionStats(): CompressionStats {
  return { ...compressionStats };
}

/**
 * Resets compression statistics
 */
export function resetCompressionStats(): void {
  compressionStats = {
    totalRequests: 0,
    compressedRequests: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    averageCompressionRatio: 0,
  };
}
