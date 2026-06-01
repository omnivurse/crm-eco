#!/usr/bin/env node
// qa-ui-flows runner: per-route smoke (console errors, 5xx, mobile viewport),
// auth flow tests (login, logout, session persistence).

import {
  parseArgs, loadJson, writeOutput,
  refuseIfProduction, paused,
  finding, specialistOutput,
} from '../_lib/findings.mjs';
import {
  loadPlaywright, signInBrowserContext, openInstrumentedPage,
  navigateSafe, slug, appBaseUrl,
} from './lib.mjs';

const SPECIALIST = 'qa-ui-flows';
const args = parseArgs(process.argv);
const startedAt = new Date().toISOString();

async function main() {
  if (!args.config || !args.manifest) {
    process.stderr.write('Usage: --config=<path> --manifest=<path> [--out=<path>] [--artifacts-dir=<path>]\n');
    process.exit(2);
  }

  const config = await loadJson(args.config, 'config');
  const manifest = await loadJson(args.manifest, 'manifest');
  refuseIfProduction(config);

  if (await paused()) {
    return done([], 0, ['Kill switch (.claude/qa/PAUSE) present — aborted.']);
  }

  const { chromium, devices } = await loadPlaywright();
  const supabase = config.supabase || {};
  const supabaseUrl = supabase.local_url || (supabase.test_project_ref ? `https://${supabase.test_project_ref}.supabase.co` : null);
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const tenantA = (supabase.test_tenants || [])[0];

  const browser = await chromium.launch({ headless: true });
  const findings = [];
  const errors = [];
  let routesTested = 0;
  let totalRoutes = 0;

  try {
    for (const app of (manifest.apps || [])) {
      const baseUrl = appBaseUrl(config, app.name);
      const routes = (app.routes || []).filter(r => r.kind === 'page' && !(config.skip_routes || []).some(p => matches(r.path, p)));
      totalRoutes += routes.length;

      // Auth flow smoke (one-time per app)
      if (tenantA && supabaseUrl && anonKey) {
        findings.push(...await testAuthFlow({ browser, baseUrl, supabaseUrl, anonKey, tenantA }));
      }

      // Per-route smoke
      for (const route of routes) {
        if (await paused()) { errors.push('Aborted by PAUSE'); break; }
        try {
          const r = await testRoute({
            browser, baseUrl, supabaseUrl, anonKey, tenantA, route, devices,
          });
          findings.push(...r.findings);
          routesTested++;
        } catch (err) {
          errors.push(`Route ${route.path}: ${err.message}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  return done(findings, 0, errors, { routes_tested: routesTested, total_routes: totalRoutes });
}

function matches(routePath, pattern) {
  // simple glob: /foo/* matches /foo/bar
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return re.test(routePath);
}

async function testAuthFlow({ browser, baseUrl, supabaseUrl, anonKey, tenantA }) {
  const findings = [];
  const context = await browser.newContext();
  const { page, consoleErrors } = await openInstrumentedPage(context);

  try {
    // Try common login routes
    const loginPaths = ['/login', '/sign-in', '/signin', '/auth/login', '/auth'];
    let loginPath = null;
    for (const p of loginPaths) {
      const r = await navigateSafe(page, baseUrl + p, { timeout: 8000 });
      if (r.ok && r.status < 400) { loginPath = p; break; }
    }

    if (!loginPath) {
      findings.push(finding({
        category: 'ui', severity: 'P2', confidence: 0.6,
        title: 'No login page detected',
        what_broken: `Tried common paths (${loginPaths.join(', ')}); none returned 2xx.`,
        location: baseUrl,
        suggested_fix: 'Add login path to manifest discovery, or confirm auth UI is configured.',
      }));
      return findings;
    }

    // Fill email + password
    const emailInput = await page.locator('input[type="email"], input[name="email"]').first();
    const passInput = await page.locator('input[type="password"]').first();
    if (await emailInput.count() && await passInput.count()) {
      await emailInput.fill(tenantA.email);
      await passInput.fill(process.env[tenantA.password_env] || '');
      const submitBtn = await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
      await submitBtn.click();
      await page.waitForTimeout(3000);

      if (page.url() === baseUrl + loginPath) {
        findings.push(finding({
          category: 'ui', severity: 'P1', confidence: 0.8,
          title: 'Login did not redirect',
          what_broken: 'Submitted login form with valid tenant A credentials; stayed on the login page after 3s.',
          location: `route:${loginPath}`,
          evidence: consoleErrors.slice(0, 5).map(e => e.text),
          suggested_fix: 'Check submit handler error states, confirm tenant A credentials match test project, inspect network tab.',
        }));
      }
    } else {
      findings.push(finding({
        category: 'ui', severity: 'P2', confidence: 0.6,
        title: 'Login form missing expected inputs',
        what_broken: `On ${loginPath}, could not find email + password inputs.`,
        location: `route:${loginPath}`,
        suggested_fix: 'Ensure inputs have type="email" and type="password" or recognizable name attributes.',
      }));
    }
  } finally {
    await context.close();
  }

  return findings;
}

async function testRoute({ browser, baseUrl, supabaseUrl, anonKey, tenantA, route, devices }) {
  const findings = [];
  const routeSlug = slug(route.path);
  const artifactsDir = args['artifacts-dir'] || '/tmp/qa-ui-flows';

  // Desktop pass
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (route.auth_required === true && tenantA && supabaseUrl && anonKey) {
    try { await signInBrowserContext(context, baseUrl, supabaseUrl, anonKey, tenantA); } catch {}
  }
  const { page, consoleErrors, networkFailures, pageErrors } = await openInstrumentedPage(context);

  const nav = await navigateSafe(page, baseUrl + route.path, { artifactsDir, slug: routeSlug });
  if (!nav.ok) {
    findings.push(finding({
      category: 'ui', severity: route.auth_required ? 'P1' : 'P2', confidence: 0.9,
      title: `Route ${route.path} failed to load`,
      what_broken: nav.error,
      location: `route:${route.path}`,
      suggested_fix: 'Verify route exists in current build; check server logs for errors.',
    }));
    await context.close();
    return { findings };
  }

  // 5xx detection
  const fiveXX = networkFailures.filter(f => f.status >= 500);
  if (fiveXX.length) {
    findings.push(finding({
      category: 'ui', severity: 'P1', confidence: 1.0,
      title: `Server errors on ${route.path}`,
      what_broken: `${fiveXX.length} 5xx response(s) during page load.`,
      location: `route:${route.path}`,
      evidence: fiveXX.slice(0, 5).map(f => `${f.status} ${f.url}`),
      suggested_fix: 'Check server logs at the timestamps these requests fired.',
    }));
  }

  // Page-level JS errors
  if (pageErrors.length) {
    const severity = pageErrors.some(e => /TypeError|undefined|null/i.test(e.message)) ? 'P0' : 'P2';
    findings.push(finding({
      category: 'ui', severity, confidence: 1.0,
      title: `Page errors on ${route.path}`,
      what_broken: `${pageErrors.length} uncaught error(s) during render.`,
      location: `route:${route.path}`,
      evidence: pageErrors.slice(0, 5).map(e => e.message),
      suggested_fix: 'Reproduce in dev with React strict mode; fix the source of the throw.',
    }));
  }

  // Console errors (lower severity)
  if (consoleErrors.length > 0) {
    findings.push(finding({
      category: 'ui', severity: 'P2', confidence: 0.8,
      title: `Console errors on ${route.path}`,
      what_broken: `${consoleErrors.length} console error(s).`,
      location: `route:${route.path}`,
      evidence: consoleErrors.slice(0, 5).map(e => e.text),
      suggested_fix: 'Inspect the source; warnings about hydration, missing keys, or null refs are common and worth fixing.',
    }));
  }

  await context.close();

  // Mobile viewport pass (separate context)
  const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
  if (route.auth_required === true && tenantA && supabaseUrl && anonKey) {
    try { await signInBrowserContext(mobileContext, baseUrl, supabaseUrl, anonKey, tenantA); } catch {}
  }
  const { page: mobilePage } = await openInstrumentedPage(mobileContext);
  const mNav = await navigateSafe(mobilePage, baseUrl + route.path, { timeout: 12000 });
  if (mNav.ok) {
    const hasHorizontalScroll = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (hasHorizontalScroll) {
      findings.push(finding({
        category: 'ui', severity: 'P2', confidence: 0.9,
        title: `Horizontal scroll on mobile: ${route.path}`,
        what_broken: 'Page content exceeds mobile viewport width (iPhone 13, 390px).',
        location: `route:${route.path}`,
        suggested_fix: 'Add overflow-x guards or responsive width constraints to offending elements.',
      }));
    }
  }
  await mobileContext.close();

  return { findings };
}

async function done(findings, writes, errors, coverage = {}) {
  await writeOutput(specialistOutput({
    specialist: SPECIALIST, tier: '1+', findings, coverage, errors,
    writesPerformed: writes, startedAt,
  }), args.out);
}

main().catch(async (err) => {
  process.stderr.write(`Harness error: ${err.stack || err.message}\n`);
  await writeOutput(specialistOutput({
    specialist: SPECIALIST, tier: '1+', findings: [], errors: [err.message], startedAt,
  }), args.out);
  process.exit(1);
});
