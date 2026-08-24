import bundleAnalyzer from '@next/bundle-analyzer';
import { noIndexRouteHeaders } from '../../packages/ui/src/lib/pin-lock-headers.js';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * The click-walk harness stamps an identity for the source it is building
 * (`apps/crm/e2e/build-id.ts`) so its `server-mode` trap can refuse a stale
 * `next start` that `reuseExistingServer` would otherwise adopt. Writing it
 * through `generateBuildId` puts it in `.next/BUILD_ID` and in every document's
 * flight payload, i.e. it describes the BUILD ON DISK and cannot be faked by
 * restarting an old build under a fresh env.
 *
 * Unset everywhere else — normal builds and the Vercel deploy keep Next's own
 * default build id, and the key is simply absent from the config.
 */
const walkBuildId = process.env.WALK_BUILD_ID;

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(walkBuildId ? { generateBuildId: () => walkBuildId } : {}),
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  transpilePackages: ['@crm-eco/ui', '@crm-eco/lib', '@crm-eco/shared', '@crm-eco/enrollment'],

  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    optimizePackageImports: [
      'lucide-react',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      'framer-motion',
      'date-fns',
      '@tanstack/react-table',
      '@tanstack/react-virtual',
    ],
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.gravatar.com',
      },
    ],
  },

  // Compiler optimizations (webpack-only — build script uses --webpack to ensure these apply)
  // When migrating to Turbopack, replace with a custom transform or Babel plugin.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Safety net for cached/installed clients from before the DHH rebrand:
  // the old app shell still requests the removed SVG assets. Serve the new
  // PNGs under the old URLs so those clients don't 404 until they refresh.
  async rewrites() {
    return [
      { source: '/logo.svg', destination: '/logo.png' },
      { source: '/favicon.svg', destination: '/favicon-32.png' },
    ];
  },

  // Headers for static asset caching
  async headers() {
    return [
      ...noIndexRouteHeaders(),
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
