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
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          apollo: {
            name: 'apollo',
            test: /[\\/]node_modules[\\/](@apollo|graphql)[\\/]/,
            chunks: 'all',
            priority: 10,
          },
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 5,
          },
        },
      };
    }

    return config;
  },

  // Headers for security and performance
  async headers() {
    const headers = [];

    // Security headers for all routes
    headers.push({
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    });

    // CORS headers for API routes
    headers.push({
      source: '/api/(.*)',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: process.env.CORS_ORIGIN || 'http://localhost:3000',
        },
        {
          key: 'Access-Control-Allow-Methods',
          value: 'GET, POST, PUT, DELETE, OPTIONS',
        },
        {
          key: 'Access-Control-Allow-Headers',
          value: 'Content-Type, Authorization',
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
