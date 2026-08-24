/**
 * CRM click-walk runner (EV-1). LOCAL Supabase stack only — the webServer env
 * block forces the local keys onto the app regardless of apps/crm/.env.local,
 * and global-setup's traps prove it before a single click is counted.
 *
 *   npm run walk:crm            (apps/crm)      WALK_ROLE=admin npm run walk:crm
 *   npm run test:e2e            (repo root)
 *
 * SERVER MODE — the walk grades a PRODUCTION build.
 * `webServer` runs `next build` and then `next start`, because the walk exists
 * to measure what ships. `next dev` is a different binary: Next 16 wraps the
 * app on the SERVER in <AppDevOverlayErrorBoundary>{[<ReplaySsrOnlyErrors/>,
 * children]} while the client hydrates without it, which shifts every useId
 * below <body> and makes genuinely-hydrating subtrees report a mismatch that
 * production cannot produce. (Verified: `grep -c AppDevOverlayErrorBoundary` is
 * 1 in app-page.runtime.dev.js and app-page-turbo.runtime.dev.js, 0 in both
 * .prod.js runtimes.) Grading hydration on that build measures the wrong thing.
 *
 * FRESHNESS — the walk grades THIS source, not the last thing built.
 * `reuseExistingServer` is on locally, so a `next start` left running answers
 * /lock like a fresh one and would be adopted with walk.json still claiming
 * today's commit. The build therefore stamps an identity (HEAD + a digest of the
 * uncommitted changes it compiled) into `.next/BUILD_ID` via next.config.mjs,
 * and `trapServerMode` refuses a server whose id is not this one. Reuse still
 * works when the server really is current — the id is stable while the source is.
 *
 * WALK_DEV=1 falls back to `next dev` for a fast local edit loop. It is not a
 * graded run and it does not pretend to be: the banner below says so, the mode
 * is stamped into walk.json as env.serverMode, and `npm run walk:crm:gate`
 * refuses a dev-mode document. CI may never use it (asserted below).
 */
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { computeWalkBuildId } from './build-id';
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
const appDir = path.resolve(__dirname, '..');

const wantsDev = process.env.WALK_DEV === '1';
if (wantsDev && isCI) {
  throw new Error('WALK_DEV=1 is a local iteration shortcut and produces an UNGRADED run — CI must record the walk against the production build.');
}
/**
 * Stamped so every downstream reader gets a declared fact rather than a guess:
 * the page-errors trap (its `next dev` allowance switches itself off in prod),
 * global-setup (which writes it into walk.json) and the gate.
 */
process.env.WALK_SERVER_MODE = wantsDev ? 'dev' : 'prod';

/**
 * The identity of the source this run is grading — HEAD plus a digest of every
 * uncommitted change `next build` would compile (see build-id.ts). `next build`
 * bakes it into `.next/BUILD_ID` via next.config.mjs, and `trapServerMode` reads
 * it back out of the served document.
 *
 * Only a graded run needs it. `next dev` has no build id ("development") and a
 * dev run is refused by the gate anyway, so WALK_DEV skips the whole mechanism
 * rather than pretending to stamp something.
 *
 * Not computed defensively: if the identity cannot be established the run cannot
 * prove which source it graded, and dying here is the correct outcome.
 */
const walkBuildId = wantsDev ? null : computeWalkBuildId(appDir);
if (walkBuildId) process.env.WALK_BUILD_ID = walkBuildId;

if (wantsDev) {
  console.warn(
    [
      '',
      '  ══════════════════════════════════════════════════════════════════',
      '   WALK_DEV=1 — this run is UNGRADED.',
      '   The walk is driving `next dev`, not the build that ships. Dev-only',
      '   hydration artefacts are excused here and cannot be trusted as',
      '   evidence. walk.json records env.serverMode="dev" and',
      '   `npm run walk:crm:gate` will REFUSE it.',
      '   Drop WALK_DEV to record a graded run.',
      '  ══════════════════════════════════════════════════════════════════',
      '',
    ].join('\n'),
  );
}

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
    // Graded runs build first and then serve the build. Both halves reuse the
    // package scripts (`build` is `next build --webpack`, `start` is
    // `next start`) so the walk can never drift from what `npm run build:crm`
    // and the Vercel deploy produce.
    command: wantsDev ? 'npm run dev' : 'npm run build && npm run start -- --port 3000',
    cwd: appDir,
    // /lock answers 200 without auth or cookie (the PIN page), so it is a safe readiness probe.
    url: `${BASE_URL}/lock`,
    reuseExistingServer: !isCI,
    // A dev server is ready in seconds; a graded run has to compile the whole
    // app first. Measured cold on this machine: `next build --webpack` 74 s,
    // `next start` ready in 90 ms. A GitHub runner is materially slower and
    // has a cold Next cache every time, so the prod budget is 10 minutes —
    // generous on purpose, because a build that times out costs a whole CI run
    // and there is no cost at all to a ceiling that is never reached.
    timeout: wantsDev ? 180_000 : 600_000,
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
      // next.config.mjs turns this into the build id, so the build carries proof
      // of which source it is. Absent under WALK_DEV (no build happens).
      ...(walkBuildId ? { WALK_BUILD_ID: walkBuildId } : {}),
    },
  },
});
