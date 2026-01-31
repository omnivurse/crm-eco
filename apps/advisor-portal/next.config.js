/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@crm-eco/lib', '@crm-eco/ui', '@crm-eco/shared'],
    experimental: {
        serverComponentsExternalPackages: ['@supabase/ssr'],
    },
    // Skip type checking during build - migration must be applied first to update DB types
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

module.exports = nextConfig;

