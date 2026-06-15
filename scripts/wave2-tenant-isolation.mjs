#!/usr/bin/env node
/**
 * Wave 2 — Tenant DB isolation operator script (read-only probes)
 *
 * Usage:
 *   PIFH_SUPABASE_DB_URL='postgresql://...' node scripts/wave2-tenant-isolation.mjs
 *   node scripts/wave2-tenant-isolation.mjs --b1   # B1 invisible-member count only
 */

import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const url = process.env.PIFH_SUPABASE_DB_URL || process.env.SUPABASE_DB_URL;

if (!url) {
  console.error('Set PIFH_SUPABASE_DB_URL or SUPABASE_DB_URL');
  process.exit(1);
}

function q(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  return execSync(`psql "${url}" -v ON_ERROR_STOP=1 -t -A -c "${oneLine.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
  }).trim();
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function main() {
  console.log('=== DHH Wave 2 — Tenant DB Isolation (read-only) ===');

  if (args.has('--b1')) {
    section('B1 invisible members (missing members-module crm_record)');
    console.log(q(`
      SELECT count(*) FROM public.members m
       WHERE m.merged_into_id IS NULL
         AND EXISTS (SELECT 1 FROM crm_modules cm WHERE cm.organization_id = m.organization_id AND cm.key='members')
         AND NOT EXISTS (
           SELECT 1 FROM crm_records r JOIN crm_modules cm ON cm.id=r.module_id
            WHERE cm.key='members' AND cm.organization_id=m.organization_id
              AND r.system->>'source_table'='members' AND r.system->>'source_id'=m.id::text)
    `));
    return;
  }

  section('RLS enabled, zero policies');
  console.log(
    q(`
      SELECT coalesce(string_agg(relname, ', ' ORDER BY relname), '(none)')
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
    `),
  );

  section('Money/PHI tables — RLS + policy counts');
  execSync(
    `psql "${url}" -c "SELECT c.relname, c.relrowsecurity, count(p.policyname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=c.relname WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY(ARRAY['members','enrollments','billing_transactions','dependents','crm_records','profiles','payment_profiles','needs']) GROUP BY 1,2 ORDER BY 1"`,
    { stdio: 'inherit' },
  );

  section('Enrollments staff policy org-scoped');
  console.log(
    q(`
      SELECT count(*) FILTER (WHERE qual ILIKE '%organization_id%') || '/' || count(*)
      FROM pg_policies WHERE schemaname='public' AND tablename='enrollments' AND cmd='SELECT'
    `),
  );

  section('B1 invisible members');
  console.log(q(`
    SELECT count(*) FROM public.members m
     WHERE m.merged_into_id IS NULL
       AND EXISTS (SELECT 1 FROM crm_modules cm WHERE cm.organization_id = m.organization_id AND cm.key='members')
       AND NOT EXISTS (
         SELECT 1 FROM crm_records r JOIN crm_modules cm ON cm.id=r.module_id
          WHERE cm.key='members' AND cm.organization_id=m.organization_id
            AND r.system->>'source_table'='members' AND r.system->>'source_id'=m.id::text)
  `));

  section('Shared-email active member groups');
  console.log(q(`
    SELECT count(*) FROM (
      SELECT lower(email), organization_id FROM members
       WHERE email IS NOT NULL AND trim(email) <> '' AND status = 'active'
       GROUP BY 1,2 HAVING count(DISTINCT id) > 1
    ) s
  `));

  section('Reference catalog USING(true) SELECT policies');
  execSync(
    `psql "${url}" -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND qual='true' AND cmd='SELECT' AND tablename IN ('age_bands','benefit_tiers','tobacco_multipliers','rating_areas','inactive_reasons') ORDER BY 1"`,
    { stdio: 'inherit' },
  );

  console.log('\nDone. See docs/audit/DHH-REPAIR-WAVE2-TENANT-DB.md');
}

main();
