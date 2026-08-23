import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** Unit tests for the walk harness only (the app's vitest config scopes to src/**). */
export default defineConfig({
  root: path.resolve(__dirname, '..'),
  test: {
    environment: 'node',
    include: ['e2e/**/*.test.ts'],
  },
});
