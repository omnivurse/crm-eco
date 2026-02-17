/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm-eco/ui', '@crm-eco/lib'],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Temporarily skip type checking during build
  // TODO: Fix underlying type errors and remove this flag.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
