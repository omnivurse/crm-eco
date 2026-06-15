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

  section('Top tenant tables — RLS + org-scoped SELECT policies');
  execSync(
    `psql "${url}" -c "
WITH org_tables AS (
  SELECT c.table_name,
         (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname='public' AND p.tablename=c.table_name AND p.cmd IN ('SELECT','ALL')) AS policies,
         (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname='public' AND p.tablename=c.table_name AND p.cmd IN ('SELECT','ALL')
             AND (p.qual ILIKE '%organization_id%' OR p.qual ILIKE '%org_id%'
                  OR p.qual ILIKE '%get_user_organization%' OR p.qual ILIKE '%auth.uid()%'
                  OR p.qual ILIKE '%owner_id%' OR p.qual ILIKE '%user_id%')) AS scoped
  FROM information_schema.tables c
  JOIN pg_class pc ON pc.relname = c.table_name
  JOIN pg_namespace n ON n.oid = pc.relnamespace AND n.nspname = 'public'
  WHERE c.table_schema = 'public' AND c.table_type = 'BASE TABLE'
    AND pc.relkind = 'r' AND pc.relrowsecurity
    AND EXISTS (
      SELECT 1 FROM information_schema.columns col
       WHERE col.table_schema='public' AND col.table_name=c.table_name
         AND col.column_name IN ('organization_id','org_id')
    )
)
SELECT table_name, policies, scoped,
       CASE WHEN policies = 0 THEN 'NO_POLICIES'
            WHEN scoped = 0 THEN 'REVIEW'
            ELSE 'OK' END AS status
FROM org_tables
ORDER BY policies ASC, table_name
LIMIT 50
"`,
    { stdio: 'inherit' },
  );

  section('crm_smart_search RPC health');
  console.log(q(`
    SELECT CASE WHEN proconfig::text ILIKE '%extensions%'
      THEN 'OK' ELSE 'MISSING_EXTENSIONS_IN_SEARCH_PATH' END
    FROM pg_proc WHERE proname = 'crm_smart_search' AND pronamespace = 'public'::regnamespace LIMIT 1
  `));

  console.log('\nDone. See docs/audit/DHH-REPAIR-WAVE2-TENANT-DB.md');
}

main();
