/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm-eco/ui', '@crm-eco/lib', '@crm-eco/rates', '@crm-eco/shared'],

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
};

export default nextConfig;
