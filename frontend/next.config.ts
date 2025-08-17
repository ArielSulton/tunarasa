/* eslint-disable @typescript-eslint/require-await */
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',

  // API routes configuration
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.BACKEND_URL ?? 'http://localhost:8000'}/api/v1/:path*`,
      },
    ]
  },

  // Environment variables for client
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000',
    NEXT_PUBLIC_GRAFANA_URL: process.env.NEXT_PUBLIC_GRAFANA_URL ?? 'http://localhost:3030',
    // Supabase configuration - explicitly set defaults for client-side
    NEXT_PUBLIC_ENABLE_SUPABASE_AUTH: process.env.NEXT_PUBLIC_ENABLE_SUPABASE_AUTH ?? 'false',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },

  // Generate build ID to force dynamic rendering for problematic pages
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },

  // Image optimization
  images: {
    remotePatterns: [
      // Development localhost patterns
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
      // Production domain patterns
      {
        protocol: 'https',
        hostname: 'tunarasa.my.id',
      },
      {
        protocol: 'https',
        hostname: 'api.tunarasa.my.id',
      },
      {
        protocol: 'https',
        hostname: 'grafana.tunarasa.my.id',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers
  async headers() {
    return [
      {
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
      },
    ]
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: [
        // Development origins
        'localhost:3000',
        'localhost:5000',
        '127.0.0.1:3000',
        '127.0.0.1:5000',
        // Production origins
        'tunarasa.my.id',
        'api.tunarasa.my.id',
      ],
    },
  },

  // Webpack configuration (for production builds)
  webpack: (config, { dev, isServer }) => {
    // Only apply webpack config for production builds
    if (!dev) {
      // Handle Node.js modules that aren't available in browser environment
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          fs: false,
          net: false,
          tls: false,
          crypto: false,
          stream: false,
          util: false,
          url: false,
          zlib: false,
          http: false,
          https: false,
          assert: false,
          os: false,
          path: false,
        }
      }
    }

    return config
  },

  // TypeScript configuration - Skip for faster builds
  typescript: {
    ignoreBuildErrors: true,
  },

  // ESLint configuration - Skip for faster builds
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
