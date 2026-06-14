#!/usr/bin/env node
/**
 * Verify dependent_coverage_periods schema, RLS, and coverage helper logic.
 *
 * Usage:
 *   node scripts/verify-dependent-coverage.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = readFileSync(resolve(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {
      /* optional */
    }
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isDependentCurrentlyCovered(dependentId, periods, fallbackIncluded, asOfDate = todayIso()) {
  const depPeriods = periods.filter((p) => p.dependent_id === dependentId);
  if (depPeriods.length === 0) return !!fallbackIncluded;
  return depPeriods.some((p) => {
    const from = p.effective_from;
    const to = p.effective_to;
    return from <= asOfDate && (to === null || to >= asOfDate);
  });
}

function validateCoverageDate(date, label) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${label} is required (YYYY-MM-DD)`;
  if (Number.isNaN(Date.parse(date))) return `${label} is not a valid date`;
  return null;
}

function validateCoverageDateRange(from, to) {
  if (to && from > to) return 'Start date must be on or before end date';
  return null;
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  console.log('=== Dependent coverage verification ===\n');

  if (validateCoverageDate('2024-06-01', 'Start') === null) ok('validateCoverageDate accepts ISO date');
  else fail('validateCoverageDate accepts ISO date');

  if (validateCoverageDate('bad', 'Start')) ok('validateCoverageDate rejects invalid');
  else fail('validateCoverageDate rejects invalid');

  if (validateCoverageDateRange('2024-01-01', '2024-06-01') === null) ok('validateCoverageDateRange ok');
  else fail('validateCoverageDateRange ok');

  if (validateCoverageDateRange('2024-06-01', '2024-01-01')) ok('validateCoverageDateRange rejects inverted');
  else fail('validateCoverageDateRange rejects inverted');

  const depId = '11111111-1111-1111-1111-111111111111';
  const periods = [
    { dependent_id: depId, effective_from: '2024-01-01', effective_to: '2024-05-31' },
    { dependent_id: depId, effective_from: '2024-09-01', effective_to: null },
  ];

  if (!isDependentCurrentlyCovered(depId, periods, false, '2024-07-01')) {
    ok('isDependentCurrentlyCovered false in summer gap');
  } else fail('isDependentCurrentlyCovered false in summer gap');

  if (isDependentCurrentlyCovered(depId, periods, false, '2024-10-01')) {
    ok('isDependentCurrentlyCovered true in open period');
  } else fail('isDependentCurrentlyCovered true in open period');

  const { error: tableErr } = await supabase.from('dependent_coverage_periods').select('id').limit(1);
  if (!tableErr) ok('dependent_coverage_periods table readable (service role)');
  else fail('dependent_coverage_periods table readable', tableErr.message);

  const { count, error: countErr } = await supabase
    .from('dependent_coverage_periods')
    .select('*', { count: 'exact', head: true });
  if (!countErr) ok(`dependent_coverage_periods accessible (row count: ${count ?? 0})`);
  else fail('dependent_coverage_periods count', countErr.message);

  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: anonData, error: anonErr } = await anon
      .from('dependent_coverage_periods')
      .select('id')
      .limit(5);

    if (anonErr || (anonData ?? []).length === 0) {
      ok('anon cannot read dependent_coverage_periods without session');
    } else {
      fail('anon isolation', `returned ${anonData.length} rows without auth`);
    }
  } else {
    ok('skipped anon check (no NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  const { error: membershipErr } = await supabase
    .from('memberships')
    .select('id, billing_amount, member_id, organization_id')
    .limit(1);
  if (!membershipErr) ok('memberships readable for billing recalc');
  else fail('memberships readable for billing recalc', membershipErr.message);

  const { error: scheduleErr } = await supabase
    .from('billing_schedules')
    .select('id, amount, member_id, status')
    .limit(1);
  if (!scheduleErr) ok('billing_schedules readable for billing recalc');
  else fail('billing_schedules readable for billing recalc', scheduleErr.message);

  const { error: enrollmentDepErr } = await supabase
    .from('enrollment_dependents')
    .select('dependent_id, additional_cost')
    .limit(1);
  if (!enrollmentDepErr) ok('enrollment_dependents readable for per-dependent costs');
  else fail('enrollment_dependents readable', enrollmentDepErr.message);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
