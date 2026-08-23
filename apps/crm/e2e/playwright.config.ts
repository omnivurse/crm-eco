/**
 * CRM click-walk runner (EV-1). LOCAL Supabase stack only — the webServer env
 * block forces `next dev` at the local keys regardless of apps/crm/.env.local,
 * and global-setup's traps prove it before a single click is counted.
 *
 *   npm run walk:crm            (apps/crm)      WALK_ROLE=admin npm run walk:crm
 *   npm run test:e2e            (repo root)
 */
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import {
  BASE_URL,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY,
  LOCAL_SUPABASE_URL,
  authStatePath,
  desktopViewport,
} from './env';

const isCI = !!process.env.CI;
const storageState = authStatePath();

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  // Retries are always 0: a retried task would be counted twice in walk.json.
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['json', { outputFile: './report/last-run.json' }]],
  outputDir: './artifacts/test-results',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'desktop-1440',
      // E2E_FORCE_VIEWPORT_WIDTH (negative run) narrows this; the breakpoint trap must then fail.
      use: { ...devices['Desktop Chrome'], viewport: desktopViewport(), storageState },
    },
    {
      // The Road-to-Ten plan names 1280px; the walk recorded 1440 / 1024 / 390,
      // so the `xl` branch AT the boundary (Tailwind xl = min-width:1280px) was
      // inferred from 1440 rather than seen. This project walks it for real.
      //
      // Deliberately cheap: `grep` scopes it to the density rows only — T2 /
      // T2-above-fold (persona) and RP-header-density (record) — the two tests
      // whose assertions are about what fits and what the header shows at a
      // given width. It is a fixed 1280 (not `desktopViewport()`), so the
      // E2E_FORCE_VIEWPORT_WIDTH negative run still proves TRAP:breakpoint via
      // global-setup and desktop-1440.
      name: 'desktop-1280',
      grep: [/T2 coverage at a glance/, /header density at rest/],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, storageState },
    },
    {
      name: 'tablet-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, storageState },
    },
    {
      name: 'mobile-390',
      // iPhone 14 descriptor defaults to WebKit; the walk is chromium-only.
      use: { ...devices['iPhone 14'], browserName: 'chromium', storageState },
    },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: path.resolve(__dirname, '..'),
    // /lock answers 200 without auth or cookie (the PIN page), so it is a safe readiness probe.
    url: `${BASE_URL}/lock`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Next.js never overrides env already in process.env, so these beat .env.local.
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_SUPABASE_ANON_KEY,
      SUPABASE_URL: LOCAL_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
      // Both flags are strict `=== 'true'` checks (session-lock.ts:6, mfa.ts:29); '' keeps them off
      // even if .env.local sets them.
      NEXT_PUBLIC_ENABLE_SESSION_LOCK: '',
      CRM_ENFORCE_MFA: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
