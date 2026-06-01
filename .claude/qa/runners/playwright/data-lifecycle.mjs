#!/usr/bin/env node
// qa-data-lifecycle runner: write → read → cache trace for every form in manifest.
//
// For each form: sign in as tenant A, navigate, fill with marker, submit, query DB,
// reload, verify display, navigate to list view, verify presence, cleanup.

import { createClient } from '@supabase/supabase-js';
import {
  parseArgs, loadJson, writeOutput,
  refuseIfProduction, paused,
  finding, specialistOutput, marker,
} from '../_lib/findings.mjs';
import {
  loadPlaywright, signInBrowserContext, openInstrumentedPage,
  navigateSafe, slug, waitForSubmitOutcome, readByMarker, appBaseUrl,
} from './lib.mjs';

const SPECIALIST = 'qa-data-lifecycle';
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

  const { chromium } = await loadPlaywright();
  const supabase = config.supabase || {};
  const supabaseUrl = supabase.local_url || (supabase.test_project_ref ? `https://${supabase.test_project_ref}.supabase.co` : null);
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const tenantA = (supabase.test_tenants || [])[0];

  if (!supabaseUrl || !anonKey || !tenantA) {
    return done([finding({
      category: 'data', severity: 'P1', confidence: 1.0,
      title: 'data-lifecycle preflight failed',
      what_broken: 'Need supabase URL, SUPABASE_ANON_KEY, and at least one test tenant.',
      location: 'config',
      suggested_fix: 'Populate .claude/qa/config.json and SUPABASE_ANON_KEY env.',
    })], 0, []);
  }

  const browser = await chromium.launch({ headless: true });
  const findings = [];
  let writes = 0;
  let testedCount = 0;
  const errors = [];

  try {
    for (const app of (manifest.apps || [])) {
      const baseUrl = appBaseUrl(config, app.name);
      const forms = app.forms || [];

      for (const form of forms) {
        if (await paused()) { errors.push('Aborted by PAUSE'); break; }
        try {
          const result = await testForm({
            browser, baseUrl, supabaseUrl, anonKey, tenantA,
            form, app, config,
          });
          findings.push(...result.findings);
          writes += result.writes;
          testedCount++;
        } catch (err) {
          errors.push(`Form ${form.route}: ${err.message}`);
          findings.push(finding({
            category: 'data', severity: 'P3', confidence: 0.5,
            title: `Could not test form at ${form.route}`,
            what_broken: err.message,
            location: `route:${form.route}`,
            suggested_fix: 'Check that the dev server is running and the route is reachable.',
          }));
        }
      }
    }
  } finally {
    await browser.close();
  }

  const totalForms = (manifest.apps || []).reduce((n, a) => n + (a.forms || []).length, 0);
  return done(findings, writes, errors, { forms_tested: testedCount, total_forms: totalForms });
}

async function testForm({ browser, baseUrl, supabaseUrl, anonKey, tenantA, form, app, config }) {
  const findings = [];
  let writes = 0;
  const formSlug = slug(form.route);
  const artifactsDir = args['artifacts-dir'] || '/tmp/qa-data-lifecycle';

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { supabaseClient } = await signInBrowserContext(context, baseUrl, supabaseUrl, anonKey, tenantA);
  const { page, consoleErrors, pageErrors } = await openInstrumentedPage(context);

  try {
    // Navigate to form
    const formUrl = baseUrl + form.route;
    const nav = await navigateSafe(page, formUrl, { artifactsDir, slug: formSlug });
    if (!nav.ok) {
      findings.push(finding({
        category: 'data', severity: 'P2', confidence: 0.9,
        title: `Form route ${form.route} did not load`,
        what_broken: nav.error,
        location: `route:${form.route}`,
        suggested_fix: 'Verify the route exists and the dev server is running.',
      }));
      return { findings, writes };
    }

    // Fill marker into all text inputs
    const markerValue = marker('qa-form');
    const inputs = await page.$$('input[type="text"], input:not([type]), textarea, input[type="email"]');
    let filledCount = 0;
    for (const input of inputs) {
      const name = await input.getAttribute('name') || '';
      if (/password|confirm/i.test(name)) continue; // skip password fields
      const type = await input.getAttribute('type');
      if (type === 'email') {
        await input.fill(`qa-${Date.now()}@example.invalid`).catch(() => {});
      } else {
        await input.fill(markerValue).catch(() => {});
      }
      filledCount++;
    }

    if (filledCount === 0) {
      findings.push(finding({
        category: 'data', severity: 'P3', confidence: 0.6,
        title: `No fillable inputs found on ${form.route}`,
        what_broken: 'Form discovery flagged this route but the runner found no <input> or <textarea> elements.',
        location: `route:${form.route}`,
        suggested_fix: 'Update discovery heuristic, or this may be a non-form route mis-classified.',
      }));
      return { findings, writes };
    }

    // Submit
    const beforeUrl = page.url();
    const submitBtn = await page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Submit"), button:has-text("Create"), button:has-text("Add")').first();
    if (!await submitBtn.count()) {
      findings.push(finding({
        category: 'data', severity: 'P2', confidence: 0.8,
        title: `No submit button on ${form.route}`,
        what_broken: 'Form has inputs but no detectable submit button.',
        location: `route:${form.route}`,
        suggested_fix: 'Ensure the submit button has type="submit" or recognizable label.',
      }));
      return { findings, writes };
    }
    await submitBtn.click();
    writes++;

    const outcome = await waitForSubmitOutcome(page, beforeUrl, { timeout: 6000 });
    if (outcome.kind === 'none') {
      findings.push(finding({
        category: 'data', severity: 'P2', confidence: 0.7,
        title: `No success indicator after submit on ${form.route}`,
        what_broken: 'Submitted form but observed no URL change, toast, or confirmation within 6s.',
        location: `route:${form.route}`,
        evidence: [`form_slug:${formSlug}`],
        suggested_fix: 'Add a toast or redirect on success. Silent submit confuses users.',
      }));
      await page.screenshot({ path: `${artifactsDir}/${formSlug}-no-outcome.png`, fullPage: true }).catch(() => {});
    }

    // Query DB to confirm row exists
    let dbRow = null;
    if (form.table_hint) {
      try {
        const rows = await readByMarker(supabaseClient, form.table_hint, 'name', markerValue);
        // Try common marker columns: name, title, label, content
        const found = rows.length > 0 ? rows : await readByMarker(supabaseClient, form.table_hint, 'title', markerValue).catch(() => []);
        dbRow = found[0] || null;
      } catch (err) {
        // table_hint may be wrong — log and continue
      }

      if (!dbRow) {
        findings.push(finding({
          category: 'data', severity: 'P0', confidence: 0.7,
          title: `Phantom success on ${form.route}`,
          what_broken: `Form indicated success but no row appeared in ${form.table_hint} with marker ${markerValue}. Either the write didn't happen, the marker landed in a different column, or the table_hint is wrong.`,
          location: `route:${form.route} table:${form.table_hint}`,
          evidence: [`marker:${markerValue}`],
          suggested_fix: 'Trace the submit handler — confirm it actually writes to the expected table.',
        }));
      }
    }

    // Reload and verify marker rendered
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    const visibleAfterReload = await page.locator(`text=${markerValue}`).count() > 0;
    if (dbRow && !visibleAfterReload) {
      // Try the inferred list view
      const listRoute = inferListRoute(form.route);
      if (listRoute) {
        await navigateSafe(page, baseUrl + listRoute, { artifactsDir, slug: `${formSlug}-list` });
        const visibleOnList = await page.locator(`text=${markerValue}`).count() > 0;
        if (!visibleOnList) {
          findings.push(finding({
            category: 'data', severity: 'P0', confidence: 0.85,
            title: `Stale display after write on ${form.route}`,
            what_broken: `Row exists in DB (id=${dbRow.id}) but is not rendered on ${form.route} or ${listRoute} after submit + reload. This is the classic frontend-backend truth gap.`,
            location: `route:${form.route}`,
            evidence: [`db_row_id:${dbRow.id}`, `marker:${markerValue}`],
            suggested_fix: 'Add cache invalidation: router.refresh(), revalidatePath, revalidateTag, or React Query invalidateQueries on submit success.',
          }));
        }
      }
    }

    // Cleanup
    if (dbRow && form.table_hint) {
      await supabaseClient.from(form.table_hint).delete().eq('id', dbRow.id).then(() => {}, () => {});
    }

    // Surface any console errors during the lifecycle
    if (consoleErrors.length || pageErrors.length) {
      findings.push(finding({
        category: 'data', severity: 'P2', confidence: 0.7,
        title: `Console errors during ${form.route} lifecycle`,
        what_broken: `${consoleErrors.length} console errors and ${pageErrors.length} page errors observed.`,
        location: `route:${form.route}`,
        evidence: consoleErrors.slice(0, 5).map(e => e.text).concat(pageErrors.slice(0, 5).map(e => e.message)),
        suggested_fix: 'Inspect console output; fix any TypeError/undefined that breaks rendering.',
      }));
    }

  } finally {
    await context.close();
  }

  return { findings, writes };
}

function inferListRoute(formRoute) {
  // /contacts/new → /contacts ; /admin/users/new → /admin/users
  const m = formRoute.match(/^(.+?)\/(new|create|add|edit\/[^/]+)$/);
  return m ? m[1] : null;
}

async function done(findings, writes, errors, coverage = {}) {
  const output = specialistOutput({
    specialist: SPECIALIST,
    tier: '1+',
    findings,
    coverage,
    errors,
    writesPerformed: writes,
    startedAt,
  });
  await writeOutput(output, args.out);
}

main().catch(async (err) => {
  process.stderr.write(`Harness error: ${err.stack || err.message}\n`);
  await writeOutput(specialistOutput({
    specialist: SPECIALIST, tier: '1+', findings: [], errors: [err.message], startedAt,
  }), args.out);
  process.exit(1);
});
