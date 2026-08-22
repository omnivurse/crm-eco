import { noIndexRouteHeaders } from '../../packages/ui/src/lib/pin-lock-headers.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm-eco/ui', '@crm-eco/lib', '@crm-eco/shared', '@crm-eco/enrollment'],

  experimental: {
    optimizePackageImports: ['recharts', 'framer-motion', 'lucide-react', 'date-fns'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
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

export default nextConfig;
