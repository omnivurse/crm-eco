import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: process.cwd(),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'shared': path.resolve(__dirname, './shared/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs', 'lucide-react'],
          'data-vendor': ['@supabase/supabase-js', '@tanstack/react-query', 'zustand'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'chart-vendor': ['recharts'],
          'utils': ['clsx', 'date-fns', 'framer-motion'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});