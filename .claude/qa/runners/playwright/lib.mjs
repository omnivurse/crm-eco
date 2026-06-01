// Shared Playwright helpers for QA Agent Kit runners.
// Imports playwright dynamically so the runner can fail clean if it's not installed.

import { createClient } from '@supabase/supabase-js';

export async function loadPlaywright() {
  try {
    const { chromium, devices } = await import('playwright');
    return { chromium, devices };
  } catch (err) {
    throw new Error('Playwright not installed in this project. Run `npm i -D playwright && npx playwright install chromium`.');
  }
}

export async function loadAxe() {
  try {
    const axe = await import('axe-playwright');
    return axe;
  } catch {
    throw new Error('axe-playwright not installed. Run `npm i -D axe-playwright`.');
  }
}

/**
 * Sign in a tenant via Supabase auth and return cookies the browser context can use.
 * For Next.js + Supabase SSR, the session cookies are what matter — set them on the context.
 */
export async function signInBrowserContext(context, baseUrl, supabaseUrl, anonKey, tenant) {
  const pw = process.env[tenant.password_env];
  if (!pw) throw new Error(`Missing env ${tenant.password_env}`);

  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: tenant.email, password: pw });
  if (error) throw new Error(`Sign in failed for ${tenant.label}: ${error.message}`);

  // Set Supabase auth cookies on the browser context.
  // Cookie name convention: sb-<project-ref>-auth-token (Supabase SSR default).
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'localhost';
  const url = new URL(baseUrl);
  const cookieValue = JSON.stringify([
    data.session.access_token,
    data.session.refresh_token,
    null, null, null,
  ]);

  await context.addCookies([{
    name: `sb-${projectRef}-auth-token`,
    value: encodeURIComponent(cookieValue),
    domain: url.hostname,
    path: '/',
    httpOnly: false,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
  }]);

  return { session: data.session, supabaseClient: client };
}

/**
 * Open a page, instrument console + network capture, return helpers.
 */
export async function openInstrumentedPage(context) {
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFailures = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      networkFailures.push({ url: resp.url(), status: resp.status() });
    }
  });

  return { page, consoleErrors, networkFailures, pageErrors };
}

/**
 * Navigate with a timeout + screenshot-on-failure.
 */
export async function navigateSafe(page, url, { timeout = 15000, artifactsDir, slug } = {}) {
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout });
    return { ok: true, status: response?.status() ?? 0 };
  } catch (err) {
    if (artifactsDir && slug) {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(artifactsDir, { recursive: true });
      await page.screenshot({ path: `${artifactsDir}/${slug}-nav-error.png`, fullPage: true }).catch(() => {});
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Slugify a URL or string for use in filenames.
 */
export function slug(s) {
  return String(s).replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/**
 * Detect any visible "success" indicator after a form submit:
 *  - URL changed
 *  - A toast / status with success role appeared
 *  - A redirect to a detail page (URL now has an ID-like segment)
 */
export async function waitForSubmitOutcome(page, beforeUrl, { timeout = 5000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (page.url() !== beforeUrl) return { kind: 'url_changed', url: page.url() };
    const toast = await page.locator('[role="status"], [role="alert"], .toast, [data-sonner-toast]').first().textContent({ timeout: 200 }).catch(() => null);
    if (toast && /success|saved|created|added|updated/i.test(toast)) return { kind: 'toast', text: toast };
    await page.waitForTimeout(200);
  }
  return { kind: 'none' };
}

/**
 * Read a value from Supabase as tenant A (used for cross-checks after form submit).
 */
export async function readByMarker(supabaseClient, table, markerColumn, markerValue) {
  const { data, error } = await supabaseClient.from(table).select('*').eq(markerColumn, markerValue);
  if (error) throw new Error(`Read failed on ${table}: ${error.message}`);
  return data || [];
}

/**
 * Pick a base URL for an app from config.
 */
export function appBaseUrl(config, appName) {
  const app = (config.apps || []).find(a => a.name === appName) || (config.apps || [])[0];
  if (!app) throw new Error('No apps configured');
  return app.dev_url || app.preview_url;
}
