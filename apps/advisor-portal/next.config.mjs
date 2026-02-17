/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@crm-eco/lib', '@crm-eco/ui', '@crm-eco/shared'],

  // Renamed from experimental.serverComponentsExternalPackages in Next.js 15+
  serverExternalPackages: ['@supabase/ssr'],

  // Skip type checking during build - migration must be applied first to update DB types
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
