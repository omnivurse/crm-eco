#!/usr/bin/env node
/**
 * Wave 3 — Tenant Apps isolation audit (static, read-only)
 *
 * Scans API route handlers under each app's src/app/api tree for tenant guard patterns.
 *
 * Usage:
 *   node scripts/wave3-tenant-apps.mjs
 *   node scripts/wave3-tenant-apps.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const ROOT = process.cwd();
const APPS = ['crm', 'portal', 'admin', 'advisor-portal', 'website', 'doublehelixhub'];

function walkApiRoutes(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkApiRoutes(p, acc);
    else if (entry.name === 'route.ts') acc.push(p);
  }
  return acc;
}

function classifyRoute(filePath, src) {
  const rel = path.relative(ROOT, filePath);
  const app = rel.split(path.sep)[1] ?? 'unknown';
  const flags = {
    auth: /getAuthProfile|getAuthUser|requireAuth|requireAdminRole|requireActiveTenant|requireActiveMembership|getAdminProfile|getMemberForUser|getActiveTenant|supabase\.auth\.getUser/.test(
      src,
    ),
    org: /organization_id|org_id|getActiveTenant|tenantSupabase|fromTenant|profile\.organization_id|requireActiveMembership|getMemberForUser/.test(
      src,
    ),
    delegated: /from ['"]@\/lib\/data\//.test(src),
    service: /createServiceRoleClient|getServiceRole|SUPABASE_SERVICE_ROLE_KEY/.test(src),
    cron: /CRON_SECRET|verifyCron|authorization.*Bearer/i.test(src),
    webhook: /webhook|stripe-signature|authorize\.net/i.test(src),
    public: /\/api\/health|\/api\/public|enroll\/draft|enroll\/submit|enroll\/public|scheduling\/public|scheduling\/book|tracking\/|webforms\/|team\/invite\/signup|oauth\/callback/i.test(
      rel,
    ),
  };

  let risk = 'ok';
  let note = '';

  if (flags.delegated) {
    risk = 'ok';
    note = 'Tenant guard via @/lib/data (requireActiveMembership)';
  } else if (flags.public) {
    risk = 'review';
    note = 'Intentional public or token/slug-gated route — verify org stamp';
  } else if (flags.service && !flags.auth && !flags.cron && !flags.webhook) {
    if (flags.public && /enroll\/draft/.test(rel)) {
      risk = 'review';
      note = 'Public enroll draft — service role validates landing slug only';
    } else if (/enroll\/submit/.test(rel)) {
      risk = 'review';
      note = 'Public enroll submit — verify org stamped from landing page';
    } else {
      risk = 'high';
      note = 'Service role without session auth or cron guard';
    }
  } else if (!flags.auth && !flags.service && !flags.cron && !flags.webhook && !flags.public) {
    risk = 'review';
    note = 'No obvious auth pattern — verify intentional public route';
  } else if (flags.auth && !flags.org && app !== 'website' && !flags.webhook && !flags.cron) {
    risk = 'review';
    note = 'Authenticated but no explicit org filter in handler (may rely on RLS only)';
  }

  return { app, file: rel, risk, note, ...flags };
}

function main() {
  const routes = [];
  for (const app of APPS) {
    const dir = path.join(ROOT, 'apps', app, 'src/app/api');
    for (const file of walkApiRoutes(dir)) {
      routes.push(classifyRoute(file, fs.readFileSync(file, 'utf8')));
    }
  }

  const byRisk = {
    high: routes.filter((r) => r.risk === 'high'),
    review: routes.filter((r) => r.risk === 'review'),
    ok: routes.filter((r) => r.risk === 'ok'),
  };

  if (args.has('--json')) {
    console.log(JSON.stringify({ total: routes.length, ...byRisk }, null, 2));
    return;
  }

  console.log('=== DHH Wave 3 — Tenant Apps API Audit ===\n');
  console.log(`Total API routes: ${routes.length}`);
  console.log(`High risk: ${byRisk.high.length}`);
  console.log(`Review: ${byRisk.review.length}`);
  console.log(`OK / guarded: ${byRisk.ok.length}\n`);

  if (byRisk.high.length) {
    console.log('--- HIGH (fix first) ---');
    for (const r of byRisk.high) console.log(`  [${r.app}] ${r.file} — ${r.note}`);
  }

  const reviewSample = byRisk.review.slice(0, 15);
  if (reviewSample.length) {
    console.log('\n--- REVIEW (sample) ---');
    for (const r of reviewSample) console.log(`  [${r.app}] ${r.file} — ${r.note}`);
    if (byRisk.review.length > reviewSample.length) {
      console.log(`  ... +${byRisk.review.length - reviewSample.length} more`);
    }
  }

  console.log('\nSee docs/audit/DHH-REPAIR-WAVE3-TENANT-APPS.md');
}

main();
