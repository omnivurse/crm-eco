#!/usr/bin/env node
// qa-accessibility runner: axe-core via axe-playwright on every page route.

import {
  parseArgs, loadJson, writeOutput,
  refuseIfProduction, paused,
  finding, specialistOutput,
} from '../_lib/findings.mjs';
import {
  loadPlaywright, loadAxe, signInBrowserContext, openInstrumentedPage,
  navigateSafe, slug, appBaseUrl,
} from './lib.mjs';

const SPECIALIST = 'qa-accessibility';
const args = parseArgs(process.argv);
const startedAt = new Date().toISOString();

const IMPACT_TO_SEVERITY = {
  critical: 'P1',
  serious: 'P2',
  moderate: 'P2',
  minor: 'P3',
};

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

  const { chromium } = await loadPlaywright();
  const { injectAxe, getViolations } = await loadAxe();
  const supabase = config.supabase || {};
  const supabaseUrl = supabase.local_url || (supabase.test_project_ref ? `https://${supabase.test_project_ref}.supabase.co` : null);
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const tenantA = (supabase.test_tenants || [])[0];

  const browser = await chromium.launch({ headless: true });
  const findings = [];
  const errors = [];
  let routesScanned = 0;
  let totalRoutes = 0;

  // Aggregate same-violation-across-routes to dedupe
  const violationAggregator = new Map(); // id => { rule, impact, routes: [] }

  try {
    for (const app of (manifest.apps || [])) {
      const baseUrl = appBaseUrl(config, app.name);
      const routes = (app.routes || []).filter(r => r.kind === 'page' && !(config.skip_routes || []).some(p => matches(r.path, p)));
      totalRoutes += routes.length;

      for (const route of routes) {
        if (await paused()) { errors.push('Aborted by PAUSE'); break; }
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        if (route.auth_required === true && tenantA && supabaseUrl && anonKey) {
          try { await signInBrowserContext(context, baseUrl, supabaseUrl, anonKey, tenantA); } catch {}
        }
        const { page } = await openInstrumentedPage(context);

        try {
          const nav = await navigateSafe(page, baseUrl + route.path, { timeout: 12000 });
          if (!nav.ok) {
            errors.push(`a11y nav failed: ${route.path} (${nav.error})`);
            continue;
          }
          await injectAxe(page);
          const violations = await getViolations(page, null, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          });
          for (const v of violations) {
            const key = v.id;
            if (!violationAggregator.has(key)) {
              violationAggregator.set(key, {
                rule: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
                routes: [], nodeCount: 0,
              });
            }
            const agg = violationAggregator.get(key);
            agg.routes.push(route.path);
            agg.nodeCount += v.nodes.length;
          }
          routesScanned++;
        } catch (err) {
          errors.push(`Route ${route.path}: ${err.message}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  // Build findings from aggregated violations
  for (const agg of violationAggregator.values()) {
    const severity = IMPACT_TO_SEVERITY[agg.impact] || 'P3';
    const location = agg.routes.length > 5
      ? `${agg.routes.length} routes (${agg.routes.slice(0, 3).join(', ')}, ...)`
      : agg.routes.join(', ');
    findings.push(finding({
      category: 'a11y', severity,
      confidence: 0.95,
      title: `a11y: ${agg.rule} (${agg.impact})`,
      what_broken: `${agg.help}. Found ${agg.nodeCount} node(s) across ${agg.routes.length} route(s).`,
      location,
      evidence: [agg.helpUrl, ...agg.routes.slice(0, 5).map(r => `route:${r}`)],
      suggested_fix: `See ${agg.helpUrl} for remediation guidance.`,
    }));
  }

  return done(findings, 0, errors, { routes_scanned: routesScanned, total_routes: totalRoutes });
}

function matches(routePath, pattern) {
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return re.test(routePath);
}

async function done(findings, writes, errors, coverage = {}) {
  await writeOutput(specialistOutput({
    specialist: SPECIALIST, tier: '0', findings, coverage, errors,
    writesPerformed: writes, startedAt,
  }), args.out);
}

main().catch(async (err) => {
  process.stderr.write(`Harness error: ${err.stack || err.message}\n`);
  await writeOutput(specialistOutput({
    specialist: SPECIALIST, tier: '0', findings: [], errors: [err.message], startedAt,
  }), args.out);
  process.exit(1);
});
