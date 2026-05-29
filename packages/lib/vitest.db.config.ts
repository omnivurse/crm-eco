import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Layer 2/3 DB-integration + RLS test runner (`npm run test:db`).
 *
 * These specs talk to a real Postgres/Supabase and are intentionally EXCLUDED
 * from the default `npm run test` (which only globs `*.test.ts`). They require
 * a disposable STAGING database via env:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_SERVICE_ROLE_KEY
 * Without those, every suite here self-skips. NEVER point this at production.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.db.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
