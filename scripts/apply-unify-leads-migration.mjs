#!/usr/bin/env node
/**
 * Apply 202606160001_unify_leads_to_crm_records.sql to production with safety checks.
 * Pre-flight counts → rehearse (ROLLBACK) → apply → post-flight counts.
 */
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
dotenv.config({ path: resolve(root, '.env') });
dotenv.config({ path: resolve(root, '.env.local'), override: true });

const dbUrl =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

const pw = process.env.SUPABASE_DB_PASSWORD;
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([^.]+)/)?.[1];

const conn =
  dbUrl ||
  (pw && ref
    ? `postgresql://postgres:${encodeURIComponent(pw)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`
    : null);

if (!conn) {
  console.error('Missing DB connection (SUPABASE_DB_URL or SUPABASE_DB_PASSWORD + project URL)');
  process.exit(1);
}

const migrationPath = resolve(root, 'supabase/migrations/202606160001_unify_leads_to_crm_records.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

const PRE_COUNT_SQL = `
SELECT json_build_object(
  'legacy_leads', (SELECT count(*)::int FROM public.leads),
  'crm_leads', (SELECT count(*)::int FROM public.crm_records cr JOIN public.crm_modules m ON m.id = cr.module_id AND m.key = 'leads'),
  'crm_contacts', (SELECT count(*)::int FROM public.crm_records cr JOIN public.crm_modules m ON m.id = cr.module_id AND m.key = 'contacts'),
  'members', (SELECT count(*)::int FROM public.members),
  'activities_lead_id', (SELECT count(*)::int FROM public.activities WHERE lead_id IS NOT NULL),
  'enrollments_lead_id', (SELECT count(*)::int FROM public.enrollments WHERE lead_id IS NOT NULL),
  'lpe_lead_id', (SELECT count(*)::int FROM public.landing_page_events WHERE lead_id IS NOT NULL),
  'lead_to_contact_links', (SELECT count(*)::int FROM public.crm_record_links WHERE link_type = 'lead_to_contact'),
  'leads_table', to_regclass('public.leads')::text,
  'activities_lead_fk', (SELECT confrelid::regclass::text FROM pg_constraint WHERE conname = 'activities_lead_id_fkey')
) AS snapshot;
`;

const POST_COUNT_SQL = `
SELECT json_build_object(
  'legacy_leads', 0,
  'crm_leads', (SELECT count(*)::int FROM public.crm_records cr JOIN public.crm_modules m ON m.id = cr.module_id AND m.key = 'leads'),
  'crm_contacts', (SELECT count(*)::int FROM public.crm_records cr JOIN public.crm_modules m ON m.id = cr.module_id AND m.key = 'contacts'),
  'members', (SELECT count(*)::int FROM public.members),
  'activities_lead_id', (SELECT count(*)::int FROM public.activities WHERE lead_id IS NOT NULL),
  'enrollments_lead_id', (SELECT count(*)::int FROM public.enrollments WHERE lead_id IS NOT NULL),
  'lpe_lead_id', (SELECT count(*)::int FROM public.landing_page_events WHERE lead_id IS NOT NULL),
  'lead_to_contact_links', (SELECT count(*)::int FROM public.crm_record_links WHERE link_type = 'lead_to_contact'),
  'leads_table', to_regclass('public.leads')::text,
  'activities_lead_fk', (SELECT confrelid::regclass::text FROM pg_constraint WHERE conname = 'activities_lead_id_fkey')
) AS snapshot;
`;

function psql(sql, label) {
  const r = spawnSync('psql', [conn, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
    timeout: 120000,
  });
  if (r.error) {
    console.error(`${label} failed:`, r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`${label} failed (exit ${r.status}):`, (r.stderr || r.stdout || '').trim());
    process.exit(1);
  }
  return (r.stdout || '').trim();
}

function parseSnapshot(raw) {
  const line = raw
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('{'));
  if (!line) throw new Error(`No JSON snapshot in psql output: ${raw.slice(0, 200)}`);
  return JSON.parse(line);
}

console.log('=== Unify leads migration (production-safe) ===\n');
console.log(`Project ref: ${ref || '(from URL)'}\n`);

const pre = parseSnapshot(psql(PRE_COUNT_SQL, 'Pre-flight'));
console.log('PRE-FLIGHT:', JSON.stringify(pre, null, 2));

if (pre.legacy_leads > 0) {
  console.error(`\nABORT: public.leads has ${pre.legacy_leads} rows — migrate data before DROP.`);
  process.exit(1);
}

console.log('\nRehearsing in transaction (ROLLBACK)...');
const rehearsal = `
BEGIN;
${migrationSql}
${POST_COUNT_SQL}
ROLLBACK;
`;
const rehearsalOut = psql(rehearsal, 'Rehearsal');
const rehearsalSnap = parseSnapshot(rehearsalOut);
console.log('REHEARSAL POST (rolled back):', JSON.stringify(rehearsalSnap, null, 2));

if (rehearsalSnap.crm_leads !== pre.crm_leads || rehearsalSnap.members !== pre.members) {
  console.error('\nABORT: rehearsal changed row counts (even though rolled back — migration logic unsafe).');
  process.exit(1);
}

console.log('\nApplying migration...');
psql(migrationSql, 'Apply');

const post = parseSnapshot(psql(POST_COUNT_SQL, 'Post-flight'));
console.log('\nPOST-FLIGHT:', JSON.stringify(post, null, 2));

const checks = [
  ['crm_leads unchanged', post.crm_leads === pre.crm_leads],
  ['members unchanged', post.members === pre.members],
  ['crm_contacts unchanged', post.crm_contacts === pre.crm_contacts],
  ['lead_to_contact links unchanged', post.lead_to_contact_links === pre.lead_to_contact_links],
  ['public.leads dropped', post.leads_table === null],
  ['activities.lead_id → crm_records', post.activities_lead_fk === 'crm_records'],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(pass ? `  ✓ ${label}` : `  ✗ ${label}`);
  if (!pass) ok = false;
}

if (!ok) {
  console.error('\nPost-flight verification FAILED');
  process.exit(1);
}

console.log('\n✅ Migration applied — no data loss detected.');
