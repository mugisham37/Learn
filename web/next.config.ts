import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Environment configuration
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Enable experimental features for better performance
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: ['@apollo/client', 'graphql'],
  },

  // Webpack configuration for better bundle optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize bundle size and performance
    if (!dev && !isServer) {
      // Enhanced code splitting configuration
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Apollo Client and GraphQL optimization
          apollo: {
            name: 'apollo',
            test: /[\\/]node_modules[\\/](@apollo|graphql)[\\/]/,
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
          // Performance utilities
          performance: {
            name: 'performance',
            test: /[\\/]src[\\/]lib[\\/](performance|utils|cache|graphql)[\\/]/,
            chunks: 'all',
            priority: 15,
            minChunks: 2,
          },
          // React and core libraries
          react: {
            name: 'react',
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            chunks: 'all',
            priority: 10,
            enforce: true,
          },
          // Common vendor libraries
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 5,
            minChunks: 2,
          },
          // Default chunk for remaining code
          default: {
            minChunks: 2,
            priority: -10,
            reuseExistingChunk: true,
          },
        },
      };

      // Enable tree shaking and dead code elimination
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // Minimize bundle size
      config.optimization.minimize = true;
    }

    // Performance monitoring in development
    if (dev) {
      // Add bundle analyzer plugin for development
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      
      if (process.env.ANALYZE === 'true') {
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            analyzerPort: isServer ? 8888 : 8889,
            openAnalyzer: true,
          })
        );
      }
    }

    // Add performance budget warnings
    config.performance = {
      maxAssetSize: 250000, // 250KB
      maxEntrypointSize: 250000, // 250KB
      hints: dev ? false : 'warning',
    };

    return config;
  },

  // Headers for security and performance
  async headers() {
    const headers = [];

    // Comprehensive security headers for all routes
    headers.push({
      source: '/(.*)',
      headers: [
        // Frame protection
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        // MIME type sniffing protection
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        // XSS protection
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        // Referrer policy
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        // Permissions policy
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
        // Content Security Policy
        {
          key: 'Content-Security-Policy',
          value: process.env.NODE_ENV === 'production' 
            ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' wss: https:; media-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
            : "default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https:; connect-src 'self' wss: https: ws://localhost:*; media-src 'self' https:;",
        },
        // HSTS (only in production)
        ...(process.env.NODE_ENV === 'production' ? [{
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        }] : []),
      ],
    });

    // Enhanced CORS headers for API routes
    headers.push({
      source: '/api/(.*)',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://yourdomain.com'),
        },
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
        },
        {
          key: 'Access-Control-Allow-Credentials',
          value: 'true',
        },
        {
          key: 'Access-Control-Max-Age',
          value: '86400', // 24 hours
        },
        // Additional security headers for API
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    });

    // Cache headers for static assets
    headers.push({
      source: '/static/(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    });

    // Cache headers for images
    headers.push({
      source: '/_next/image(.*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    });

    return headers;
  },

  // Redirects for better SEO and user experience
  async redirects() {
    return [
      // Add any necessary redirects here
    ];
  },

  // Rewrites for API proxying if needed
  async rewrites() {
    const rewrites = [];

    // In development, proxy GraphQL requests to backend
    if (process.env.NODE_ENV === 'development') {
      rewrites.push({
        source: '/api/graphql',
        destination: process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
      });
    }

    return rewrites;
  },

  // Image optimization configuration
  images: {
    domains: [
      'localhost',
      // Add your CDN domains here
      ...(process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN ? [process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN] : []),
    ],
    formats: ['image/webp', 'image/avif'],
  },

  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,

  // Strict mode
  reactStrictMode: true,

  // SWC minification
  swcMinify: true,

  // Output configuration
  output: 'standalone',

  // Logging
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
};

export default nextConfig;
