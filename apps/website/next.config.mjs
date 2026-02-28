/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm-eco/ui', '@crm-eco/lib', '@crm-eco/enrollment', '@crm-eco/rates'],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
