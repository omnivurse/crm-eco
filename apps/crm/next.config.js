/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm-eco/ui', '@crm-eco/lib', '@crm-eco/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Enable optimized package imports for better tree-shaking
    optimizePackageImports: ['lucide-react', '@dnd-kit/core', '@dnd-kit/sortable', 'framer-motion'],
  },
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },
  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Webpack optimizations for better code splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Split large vendor chunks
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          // Separate DnD kit for pipeline page
          dndkit: {
            test: /[\\/]node_modules[\\/](@dnd-kit)[\\/]/,
            name: 'dndkit',
            priority: 30,
            reuseExistingChunk: true,
          },
          // Separate Tiptap editor
          tiptap: {
            test: /[\\/]node_modules[\\/](@tiptap)[\\/]/,
            name: 'tiptap',
            priority: 30,
            reuseExistingChunk: true,
          },
          // Separate framer-motion for animations
          framer: {
            test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
            name: 'framer',
            priority: 30,
            reuseExistingChunk: true,
          },
          // Common vendor chunks
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
  // Headers for static asset caching
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
      {
        source: '/fonts/:path*',
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

module.exports = nextConfig;

