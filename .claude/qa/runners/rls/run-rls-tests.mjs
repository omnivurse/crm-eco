#!/usr/bin/env node
// qa-auth-rls runner: two-tenant + anon RLS probe.
// Inserts a marker row as tenant A, attempts cross-tenant access as B + anon, cleans up.
//
// Usage:
//   node run-rls-tests.mjs --config=<path> --manifest=<path> [--out=<path>]
//
// Env required:
//   SUPABASE_ANON_KEY
//   <tenant.password_env> for each tenant in config.supabase.test_tenants

import { createClient } from '@supabase/supabase-js';
import {
  parseArgs, loadJson, writeOutput,
  refuseIfProduction, paused,
  finding, specialistOutput, marker,
} from '../_lib/findings.mjs';

const SPECIALIST = 'qa-auth-rls';
const args = parseArgs(process.argv);
const startedAt = new Date().toISOString();

async function main() {
  if (!args.config || !args.manifest) {
    process.stderr.write('Usage: --config=<path> --manifest=<path> [--out=<path>]\n');
    process.exit(2);
  }

  const config = await loadJson(args.config, 'config');
  const manifest = await loadJson(args.manifest, 'manifest');

  try {
    refuseIfProduction(config);
  } catch (err) {
    return done([finding({
      category: 'auth', severity: 'P0', confidence: 1.0,
      title: 'Refused to run RLS suite',
      what_broken: err.message,
      location: 'config',
      suggested_fix: 'Use a dedicated test Supabase project, never the production project.',
    })], 0, []);
  }

  if (await paused()) {
    return done([], 0, ['Kill switch (.claude/qa/PAUSE) is present — aborted.']);
  }

  const supabase = config.supabase || {};
  const url = supabase.local_url || (supabase.test_project_ref ? `https://${supabase.test_project_ref}.supabase.co` : null);
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const [tenantA, tenantB] = supabase.test_tenants || [];

  const preflightErrors = [];
  if (!url) preflightErrors.push('No Supabase URL (set supabase.local_url or supabase.test_project_ref)');
  if (!anonKey) preflightErrors.push('SUPABASE_ANON_KEY env var not set');
  if (!tenantA || !tenantB) preflightErrors.push('Need at least two test_tenants in config');

  if (preflightErrors.length) {
    return done([finding({
      category: 'auth', severity: 'P1', confidence: 1.0,
      title: 'RLS suite preflight failed',
      what_broken: preflightErrors.join('; '),
      location: 'config',
      suggested_fix: 'Populate .claude/qa/config.json and set required env vars.',
    })], 0, preflightErrors);
  }

  // Sign in both tenants
  const cA = await signIn(url, anonKey, tenantA);
  const cB = await signIn(url, anonKey, tenantB);
  const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });

  const tables = (manifest.database?.tables || []).filter(t => t.rls_enabled === true);
  const findings = [];
  let writes = 0;
  let testedCount = 0;
  const errors = [];

  for (const table of tables) {
    if (await paused()) { errors.push('Aborted mid-run by PAUSE file'); break; }
    try {
      findings.push(...staticPolicyChecks(table));
      const probeFindings = await dynamicTenantProbe(table, cA, cB, anonClient, tenantA, tenantB);
      findings.push(...probeFindings);
      writes += 1; // we inserted one row per table
      testedCount++;
    } catch (err) {
      errors.push(`Table ${table.name}: ${err.message}`);
      findings.push(finding({
        category: 'auth', severity: 'P3', confidence: 0.5,
        title: `Could not probe ${table.name}`,
        what_broken: err.message,
        location: `table:${table.name}`,
        suggested_fix: 'Check tenant grants on this table or add column hints to manifest.',
      }));
    }
  }

  return done(findings, writes, errors, { tables_tested: testedCount, total_rls_tables: tables.length });
}

async function signIn(url, anonKey, tenant) {
  const c = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const pw = process.env[tenant.password_env];
  if (!pw) throw new Error(`Missing env ${tenant.password_env} for tenant ${tenant.label}`);
  const { error } = await c.auth.signInWithPassword({ email: tenant.email, password: pw });
  if (error) throw new Error(`Sign in failed for ${tenant.label}: ${error.message}`);
  return c;
}

function staticPolicyChecks(table) {
  const out = [];
  const policies = table.policies || [];
  const commands = new Set(policies.map(p => p.command));

  // user_metadata in policy text = antipattern
  for (const p of policies) {
    if (p.definition && /user_metadata/i.test(p.definition)) {
      out.push(finding({
        category: 'auth', severity: 'P1', confidence: 0.9,
        title: `Policy ${p.name} on ${table.name} uses user_metadata`,
        what_broken: 'user_metadata is user-controllable. A user can set any claim there and bypass authorization.',
        location: `table:${table.name} policy:${p.name}`,
        evidence: [p.definition.slice(0, 240)],
        suggested_fix: 'Replace user_metadata checks with auth.uid() + a server-managed role/membership table lookup.',
      }));
    }
  }

  // Missing per-command policies
  if (!commands.has('ALL')) {
    for (const cmd of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      if (!commands.has(cmd)) {
        out.push(finding({
          category: 'auth', severity: cmd === 'SELECT' ? 'P0' : 'P1', confidence: 0.85,
          title: `${table.name} has RLS enabled but no ${cmd} policy`,
          what_broken: `RLS is on, but no ${cmd} policy exists. Default-deny means no one can perform this operation. If that's intentional, fine — otherwise the app will silently fail.`,
          location: `table:${table.name}`,
          suggested_fix: `Either add a ${cmd} policy or document that ${cmd} is intentionally blocked.`,
        }));
      }
    }
  }

  // FOR ALL policies are usually too coarse
  for (const p of policies) {
    if (p.command === 'ALL') {
      out.push(finding({
        category: 'auth', severity: 'P2', confidence: 0.7,
        title: `Policy ${p.name} on ${table.name} uses FOR ALL`,
        what_broken: 'FOR ALL policies cover SELECT/INSERT/UPDATE/DELETE with one rule. This often means USING and WITH CHECK collapse into the same expression — risky for UPDATE and DELETE.',
        location: `table:${table.name} policy:${p.name}`,
        suggested_fix: 'Split into per-command policies (FOR SELECT, FOR INSERT, FOR UPDATE, FOR DELETE) for clearer intent and audit.',
      }));
    }
  }

  return out;
}

async function dynamicTenantProbe(table, cA, cB, anonClient, tenantA, tenantB) {
  const out = [];
  const tableName = table.name;
  const tenancyCol = table.tenancy_column;

  if (!tenancyCol || tenancyCol === 'unknown') {
    out.push(finding({
      category: 'auth', severity: 'P2', confidence: 0.7,
      title: `${tableName} has RLS but no detected tenancy column`,
      what_broken: 'Discovery could not infer how this table is tenant-scoped. Probe skipped.',
      location: `table:${tableName}`,
      suggested_fix: 'Add `tenancy_column` hint to manifest (manually or via discovery heuristic), or verify the table is genuinely shared across tenants.',
    }));
    return out;
  }

  // Build a minimal insert payload
  const probeMarker = marker('qa-rls');
  const insertData = { [tenancyCol]: tenantA.org_id };
  for (const col of (table.columns || [])) {
    if (!col.nullable && !insertData[col.name] && !['id','created_at','updated_at'].includes(col.name)) {
      if (col.type?.includes('text') || col.type?.includes('varchar')) insertData[col.name] = probeMarker;
      else if (col.type?.includes('int') || col.type?.includes('numeric')) insertData[col.name] = 0;
      else if (col.type?.includes('bool')) insertData[col.name] = false;
      else if (col.type?.includes('json')) insertData[col.name] = {};
      // unknown types — leave unset, let DB error
    }
  }

  const { data: inserted, error: insertErr } = await cA.from(tableName).insert(insertData).select().single();
  if (insertErr) {
    out.push(finding({
      category: 'auth', severity: 'P3', confidence: 0.5,
      title: `Could not seed probe row in ${tableName}`,
      what_broken: `Tenant A INSERT failed: ${insertErr.message}`,
      location: `table:${tableName}`,
      suggested_fix: 'Check INSERT policy permits tenant A, or add required-column hints to manifest.',
    }));
    return out;
  }

  const probeId = inserted.id;

  try {
    // Tenant B SELECT
    const { data: bRead } = await cB.from(tableName).select('*').eq('id', probeId);
    if (bRead && bRead.length > 0) {
      out.push(finding({
        category: 'auth', severity: 'P0', confidence: 1.0,
        title: `Cross-tenant SELECT leak on ${tableName}`,
        what_broken: `Tenant B (${tenantB.label}) successfully read row ${probeId} created by tenant A (${tenantA.label}). This is a data exposure incident.`,
        location: `table:${tableName}`,
        evidence: [`probe_id=${probeId}`, `tenant_a=${tenantA.label}`, `tenant_b=${tenantB.label}`],
        suggested_fix: `Add or fix SELECT RLS policy. Typical pattern:\nUSING (${tenancyCol} IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))`,
      }));
    }

    // Tenant B UPDATE
    const { data: bUpdated } = await cB.from(tableName).update({ [tenancyCol]: tenantA.org_id }).eq('id', probeId).select();
    if (bUpdated && bUpdated.length > 0) {
      out.push(finding({
        category: 'auth', severity: 'P0', confidence: 1.0,
        title: `Cross-tenant UPDATE leak on ${tableName}`,
        what_broken: `Tenant B updated row ${probeId} owned by tenant A.`,
        location: `table:${tableName}`,
        evidence: [`probe_id=${probeId}`],
        suggested_fix: 'Add UPDATE RLS policy with USING + WITH CHECK on the tenancy column.',
      }));
    }

    // Anon SELECT
    const { data: anonRead } = await anonClient.from(tableName).select('*').eq('id', probeId);
    if (anonRead && anonRead.length > 0) {
      out.push(finding({
        category: 'auth', severity: 'P0', confidence: 1.0,
        title: `Anonymous role can read ${tableName}`,
        what_broken: `An unauthenticated request returned the probe row. If this table holds PII/PHI/billing data, this is a P0 incident.`,
        location: `table:${tableName}`,
        evidence: [`probe_id=${probeId}`],
        suggested_fix: 'Disable anon access on this table, or add an explicit policy that excludes the anon role.',
      }));
    }

    // Tenant B DELETE
    const { count: bDelCount } = await cB.from(tableName).delete({ count: 'exact' }).eq('id', probeId);
    if (bDelCount && bDelCount > 0) {
      out.push(finding({
        category: 'auth', severity: 'P0', confidence: 1.0,
        title: `Cross-tenant DELETE leak on ${tableName}`,
        what_broken: `Tenant B deleted row ${probeId} owned by tenant A.`,
        location: `table:${tableName}`,
        evidence: [`probe_id=${probeId}`],
        suggested_fix: 'Add DELETE RLS policy with USING on the tenancy column.',
      }));
      return out; // row already deleted
    }
  } finally {
    // Cleanup as tenant A
    await cA.from(tableName).delete().eq('id', probeId).then(() => {}, () => {});
  }

  return out;
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
  const output = specialistOutput({
    specialist: SPECIALIST,
    tier: '1+',
    findings: [],
    errors: [err.message],
    startedAt,
  });
  await writeOutput(output, args.out);
  process.exit(1);
});
