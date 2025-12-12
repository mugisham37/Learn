/**
 * CDN Caching Configuration Utilities
 * 
 * Provides utilities for configuring CloudFront and other CDN caching
 * behaviors for static content and API responses.
 * 
 * Requirements: 15.4, 15.5
 */

import { logger } from './logger.js';

/**
 * CDN cache behavior configuration
 */
export interface CDNCacheBehavior {
  /** Path pattern to match */
  pathPattern: string;
  /** Cache duration in seconds */
  ttl: number;
  /** Minimum TTL in seconds */
  minTtl?: number;
  /** Maximum TTL in seconds */
  maxTtl?: number;
  /** Whether to compress responses */
  compress?: boolean;
  /** Allowed HTTP methods */
  allowedMethods?: string[];
  /** Cached HTTP methods */
  cachedMethods?: string[];
  /** Query string forwarding behavior */
  queryStringBehavior?: 'none' | 'whitelist' | 'all';
  /** Whitelisted query string parameters */
  queryStringWhitelist?: string[];
  /** Headers to forward to origin */
  forwardedHeaders?: string[];
  /** Cookie forwarding behavior */
  cookieBehavior?: 'none' | 'whitelist' | 'all';
  /** Whitelisted cookies */
  cookieWhitelist?: string[];
}

/**
 * Predefined CDN cache behaviors for different content types
 */
export const CDNCacheBehaviors = {
  /** Static assets (images, CSS, JS) - long cache */
  STATIC_ASSETS: {
    pathPattern: '/static/*',
    ttl: 31536000, // 1 year
    minTtl: 86400, // 1 day
    maxTtl: 31536000, // 1 year
    compress: true,
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    queryStringBehavior: 'none',
    cookieBehavior: 'none',
  } as CDNCacheBehavior,

  /** Video content - long cache with range requests */
  VIDEO_CONTENT: {
    pathPattern: '/videos/*',
    ttl: 86400, // 1 day
    minTtl: 3600, // 1 hour
    maxTtl: 604800, // 1 week
    compress: false, // Videos are already compressed
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    queryStringBehavior: 'whitelist',
    queryStringWhitelist: ['v', 'quality', 'format'],
    forwardedHeaders: ['Range', 'If-Range'],
    cookieBehavior: 'none',
  } as CDNCacheBehavior,

  /** API responses - short cache with authentication */
  API_RESPONSES: {
    pathPattern: '/api/*',
    ttl: 300, // 5 minutes
    minTtl: 0,
    maxTtl: 3600, // 1 hour
    compress: true,
    allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
    cachedMethods: ['GET', 'HEAD'],
    queryStringBehavior: 'all',
    forwardedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    cookieBehavior: 'whitelist',
    cookieWhitelist: ['session', 'csrf-token'],
  } as CDNCacheBehavior,

  /** GraphQL endpoint - minimal cache with authentication */
  GRAPHQL: {
    pathPattern: '/graphql',
    ttl: 60, // 1 minute
    minTtl: 0,
    maxTtl: 300, // 5 minutes
    compress: true,
    allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'],
    cachedMethods: ['GET', 'HEAD'],
    queryStringBehavior: 'all',
    forwardedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Request-ID'],
    cookieBehavior: 'all',
  } as CDNCacheBehavior,

  /** Course thumbnails and images - medium cache */
  COURSE_IMAGES: {
    pathPattern: '/images/courses/*',
    ttl: 604800, // 1 week
    minTtl: 3600, // 1 hour
    maxTtl: 2592000, // 30 days
    compress: true,
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    queryStringBehavior: 'whitelist',
    queryStringWhitelist: ['w', 'h', 'q', 'format'],
    cookieBehavior: 'none',
  } as CDNCacheBehavior,

  /** User avatars - medium cache */
  USER_AVATARS: {
    pathPattern: '/images/avatars/*',
    ttl: 86400, // 1 day
    minTtl: 3600, // 1 hour
    maxTtl: 604800, // 1 week
    compress: true,
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    queryStringBehavior: 'whitelist',
    queryStringWhitelist: ['size', 'format'],
    cookieBehavior: 'none',
  } as CDNCacheBehavior,

  /** Health checks - no cache */
  HEALTH_CHECKS: {
    pathPattern: '/health*',
    ttl: 0,
    minTtl: 0,
    maxTtl: 0,
    compress: false,
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: [],
    queryStringBehavior: 'none',
    cookieBehavior: 'none',
  } as CDNCacheBehavior,
} as const;

/**
 * Generate CloudFront cache behavior configuration
 */
export function generateCloudFrontBehavior(behavior: CDNCacheBehavior): any {
  return {
    PathPattern: behavior.pathPattern,
    TargetOriginId: 'api-origin',
    ViewerProtocolPolicy: 'redirect-to-https',
    AllowedMethods: behavior.allowedMethods || ['GET', 'HEAD'],
    CachedMethods: behavior.cachedMethods || ['GET', 'HEAD'],
    Compress: behavior.compress || false,
    DefaultTTL: behavior.ttl,
    MinTTL: behavior.minTtl || 0,
    MaxTTL: behavior.maxTtl || behavior.ttl,
    ForwardedValues: {
      QueryString: behavior.queryStringBehavior !== 'none',
      QueryStringCacheKeys: behavior.queryStringWhitelist || [],
      Headers: behavior.forwardedHeaders || [],
      Cookies: {
        Forward: behavior.cookieBehavior || 'none',
        WhitelistedNames: behavior.cookieWhitelist || [],
      },
    },
  };
}

/**
 * Generate Vary header for proper caching
 */
export function generateVaryHeader(behavior: CDNCacheBehavior): string {
  const varyHeaders: string[] = [];

  // Add Accept-Encoding if compression is enabled
  if (behavior.compress) {
    varyHeaders.push('Accept-Encoding');
  }

  // Add Authorization if auth headers are forwarded
  if (behavior.forwardedHeaders?.includes('Authorization')) {
    varyHeaders.push('Authorization');
  }

  // Add Accept if content negotiation is used
  if (behavior.forwardedHeaders?.includes('Accept')) {
    varyHeaders.push('Accept');
  }

  return varyHeaders.join(', ');
}

/**
 * Get appropriate cache behavior for a request path
 */
export function getCacheBehaviorForPath(path: string): CDNCacheBehavior | null {
  // Check each behavior pattern
  for (const [name, behavior] of Object.entries(CDNCacheBehaviors)) {
    const pattern = behavior.pathPattern.replace('*', '.*');
    const regex = new RegExp(`^${pattern}$`);
    
    if (regex.test(path)) {
      logger.debug('Matched CDN cache behavior', {
        path,
        behavior: name,
        pattern: behavior.pathPattern,
      });
      return behavior;
    }
  }

  logger.debug('No CDN cache behavior matched', { path });
  return null;
}

/**
 * Generate cache headers for CDN optimization
 */
export function generateCDNCacheHeaders(
  path: string,
  customBehavior?: Partial<CDNCacheBehavior>
): Record<string, string> {
  const behavior = getCacheBehaviorForPath(path);
  
  if (!behavior) {
    return {};
  }

  // Merge with custom behavior if provided
  const finalBehavior = { ...behavior, ...customBehavior };

  const headers: Record<string, string> = {};

  // Add Cache-Control header
  const cacheDirectives: string[] = [];
  
  if (finalBehavior.ttl > 0) {
    cacheDirectives.push(`max-age=${finalBehavior.ttl}`);
    
    // Add s-maxage for shared caches (CDN)
    if (finalBehavior.ttl > 300) { // Only for longer cache durations
      cacheDirectives.push(`s-maxage=${finalBehavior.ttl}`);
    }
    
    cacheDirectives.push('public');
  } else {
    cacheDirectives.push('no-cache', 'no-store', 'must-revalidate');
  }

  headers['Cache-Control'] = cacheDirectives.join(', ');

  // Add Vary header
  const varyHeader = generateVaryHeader(finalBehavior);
  if (varyHeader) {
    headers['Vary'] = varyHeader;
  }

  // Add compression hint
  if (finalBehavior.compress) {
    headers['Content-Encoding'] = 'gzip';
  }

  return headers;
}

/**
 * Middleware to add CDN-optimized cache headers
 */
export function addCDNCacheHeaders(
  path: string,
  customBehavior?: Partial<CDNCacheBehavior>
) {
  return function (request: any, reply: any, next: any) {
    const headers = generateCDNCacheHeaders(path, customBehavior);
    
    Object.entries(headers).forEach(([key, value]) => {
      reply.header(key, value);
    });

    if (next) next();
  };
}

/**
 * Generate CloudFormation template for CDN distribution
 */
export function generateCloudFormationCDNConfig(): any {
  const behaviors = Object.entries(CDNCacheBehaviors).map(([name, behavior]) => ({
    ...generateCloudFrontBehavior(behavior),
    Comment: `Cache behavior for ${name}`,
  }));

  return {
    Type: 'AWS::CloudFront::Distribution',
    Properties: {
      DistributionConfig: {
        Comment: 'Learning Platform CDN Distribution',
        Enabled: true,
        PriceClass: 'PriceClass_100', // Use only North America and Europe edge locations
        HttpVersion: 'http2',
        IPV6Enabled: true,
        Origins: [
          {
            Id: 'api-origin',
            DomainName: '${API_DOMAIN}', // To be replaced with actual domain
            CustomOriginConfig: {
              HTTPPort: 443,
              HTTPSPort: 443,
              OriginProtocolPolicy: 'https-only',
              OriginSSLProtocols: ['TLSv1.2'],
            },
          },
        ],
        DefaultCacheBehavior: generateCloudFrontBehavior(CDNCacheBehaviors.API_RESPONSES),
        CacheBehaviors: behaviors.slice(1), // Exclude default behavior
        ViewerCertificate: {
          AcmCertificateArn: '${SSL_CERTIFICATE_ARN}', // To be replaced
          SslSupportMethod: 'sni-only',
          MinimumProtocolVersion: 'TLSv1.2_2021',
        },
        CustomErrorResponses: [
          {
            ErrorCode: 404,
            ResponseCode: 404,
            ResponsePagePath: '/404.html',
            ErrorCachingMinTTL: 300,
          },
          {
            ErrorCode: 500,
            ResponseCode: 500,
            ResponsePagePath: '/500.html',
            ErrorCachingMinTTL: 0,
          },
        ],
      },
    },
  };
}

export { CDNCacheBehaviors };