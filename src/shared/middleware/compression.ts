/**
 * Compression Middleware
 * 
 * Implements gzip and brotli compression for HTTP responses.
 * Provides intelligent compression based on content type and size.
 * 
 * Requirements: 15.5
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createGzip, createBrotliCompress } from 'zlib';
import { pipeline } from 'stream/promises';
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
function shouldCompress(contentType: string, allowedTypes: string[]): boolean {
  if (!contentType) return false;
  
  const type = contentType.toLowerCase().split(';')[0].trim();
  return allowedTypes.some(allowed => type.includes(allowed));
}

/**
 * Determines the best compression algorithm based on Accept-Encoding header
 */
function getBestCompression(acceptEncoding: string, preferBrotli: boolean): 'br' | 'gzip' | null {
  if (!acceptEncoding) return null;
  
  const encoding = acceptEncoding.toLowerCase();
  
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
export function createCompressionMiddleware(options: CompressionOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  return async function compressionMiddleware(
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
      return;
    }

    const acceptEncoding = request.headers['accept-encoding'] as string;
    const compression = getBestCompression(acceptEncoding, config.preferBrotli);
    
    if (!compression) {
      return;
    }

    // Hook into the response to compress the payload
    reply.addHook('onSend', async (request, reply, payload) => {
      // Skip if no payload or payload too small
      if (!payload || (typeof payload === 'string' && payload.length < config.threshold)) {
        return payload;
      }

      // Check content type
      const contentType = reply.getHeader('content-type') as string;
      if (!shouldCompress(contentType, config.contentTypes)) {
        return payload;
      }

      try {
        let compressedPayload: Buffer;
        
        if (compression === 'br') {
          // Brotli compression
          const brotli = createBrotliCompress({
            params: {
              [require('zlib').constants.BROTLI_PARAM_QUALITY]: config.level,
            },
          });
          
          compressedPayload = await compressStream(payload, brotli);
          reply.header('content-encoding', 'br');
        } else {
          // Gzip compression
          const gzip = createGzip({ level: config.level });
          compressedPayload = await compressStream(payload, gzip);
          reply.header('content-encoding', 'gzip');
        }

        // Update content length
        reply.header('content-length', compressedPayload.length);
        
        // Add Vary header for proper caching
        const varyHeader = reply.getHeader('vary') as string;
        const varyValues = varyHeader ? varyHeader.split(',').map(v => v.trim()) : [];
        if (!varyValues.includes('Accept-Encoding')) {
          varyValues.push('Accept-Encoding');
          reply.header('vary', varyValues.join(', '));
        }

        logger.debug('Response compressed successfully', {
          method: request.method,
          url: request.url,
          compression,
          originalSize: typeof payload === 'string' ? payload.length : payload.length,
          compressedSize: compressedPayload.length,
          ratio: Math.round((1 - compressedPayload.length / (typeof payload === 'string' ? payload.length : payload.length)) * 100),
        });

        return compressedPayload;
      } catch (error) {
        logger.error('Compression failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          method: request.method,
          url: request.url,
          compression,
        });
        
        // Return original payload if compression fails
        return payload;
      }
    });
  };
}

/**
 * Compresses a payload using the specified compression stream
 */
async function compressStream(payload: string | Buffer, compressionStream: any): Promise<Buffer> {
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
export async function registerCompression(
  fastify: FastifyInstance,
  options: CompressionOptions = {}
): Promise<void> {
  const middleware = createCompressionMiddleware(options);
  
  // Register as a global hook
  fastify.addHook('preHandler', middleware);
  
  logger.info('Compression middleware registered', {
    threshold: options.threshold || DEFAULT_OPTIONS.threshold,
    level: options.level || DEFAULT_OPTIONS.level,
    preferBrotli: options.preferBrotli ?? DEFAULT_OPTIONS.preferBrotli,
  });
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