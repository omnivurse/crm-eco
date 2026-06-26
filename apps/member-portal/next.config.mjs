/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm-eco/ui', '@crm-eco/lib', '@crm-eco/enrollment'],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  async headers() {
    return [
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
