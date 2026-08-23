import { noIndexRouteHeaders } from '../../packages/ui/src/lib/pin-lock-headers.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@crm-eco/ui', '@crm-eco/cash-pay', '@crm-eco/lib'],
  async headers() {
    return noIndexRouteHeaders();
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@phosphor-icons/react'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
