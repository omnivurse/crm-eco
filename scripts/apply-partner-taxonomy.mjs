#!/usr/bin/env node
/**
 * Apply 20260830120000_partner_relationship_types_and_industry.sql via PostgREST.
 *
 * WHY THIS EXISTS. That migration is configuration only — it writes `crm_fields`
 * and `crm_layouts` rows and touches no record data — so the service role can
 * perform it through PostgREST. This box has no `supabase` CLI, no
 * SUPABASE_DB_URL / SUPABASE_DB_PASSWORD and no exec_sql RPC, so `supabase db
 * push` is not available here.
 *
 * The .sql file remains the source of truth. This script mirrors it step for
 * step, guard for guard. Running `supabase db push` later is still correct and
 * will be a no-op: every step below is idempotent the same way the SQL is
 * (options rewritten only when they differ, fields ON CONFLICT DO NOTHING,
 * layout section skipped when already present). It also records the version in
 * the migration ledger, which this script deliberately does NOT touch.
 *
 *   node scripts/apply-partner-taxonomy.mjs            # dry run, writes nothing
 *   node scripts/apply-partner-taxonomy.mjs --apply    # perform the writes
 *
 * Robin Anderson (contact d4e6fcca) is tagged in the same pass — the first
 * Referring Partner, and the record that prompted the taxonomy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ORG = '00000000-0000-0000-0000-000000000001';
const SOURCE = 'partner_taxonomy_20260830';
const APPLY = process.argv.includes('--apply');

const envPath = path.resolve(process.cwd(), 'apps/crm/.env.local');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = (k) =>
  process.env[k] ?? (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');

const URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// The exact values from the migration.
// ---------------------------------------------------------------------------
const REL_OPTIONS = [
  'Member', 'Advisor', 'Agency', 'Partner', 'Referring Partner',
  'DPC Provider', 'Provider', 'Employee', 'Personal',
];
const REL_TOOLTIP =
  'Partner = delivers services to PIFH members (MEC, virtual care, DPC). ' +
  'Referring Partner = sends us referrals from another field (insurance, financial, fitness).';

const INDUSTRY = [
  'Insurance - Property & Casualty', 'Insurance - Life & Annuity', 'Insurance - Medicare',
  'Insurance - Group Benefits', 'Financial Advisor / Wealth Management',
  'CPA / Accounting / Bookkeeping', 'Attorney / Legal', 'Mortgage / Lending', 'Real Estate',
  'Payroll / HR / PEO', 'Business Consultant / Coach', 'Health & Fitness / Personal Training',
  'Chiropractic', 'Nutrition / Wellness', 'Behavioral Health', 'Direct Primary Care / Clinic',
  'Telehealth / Virtual Care', 'Dental', 'Vision', 'Pharmacy / Rx', 'Labs & Imaging',
  'Association / Chamber of Commerce', 'Faith Community / Ministry', 'Nonprofit',
  'Employer / Business Owner', 'Technology / Software', 'Marketing / Media', 'Other',
];
const SERVICES = [
  'MEC / Minimum Essential Coverage', 'Virtual Care / Telehealth', 'Direct Primary Care',
  'Concierge / Member Advocacy', 'Pharmacy / Rx', 'Dental', 'Vision', 'Labs & Imaging',
  'Behavioral Health', 'Wellness / Fitness', 'Benefits Administration / TPA', 'Other',
];

const PARTNER_SECTION = { key: 'partner', label: 'Partner Details', columns: 2, accent: 'indigo' };

/** organization_id is set EXPLICITLY: both crm_fields RLS policies read it, so a
 *  NULL there would define the fields and then hide them from every non-service
 *  caller. trg_sync_org_tenant_key does mirror org_id, but RLS is too important
 *  to leave to a trigger. */
const partnerFields = (moduleId) => [
  {
    org_id: ORG, organization_id: ORG, module_id: moduleId,
    key: 'partner_industry', label: 'Partner Industry', type: 'select',
    options: INDUSTRY, validation: {}, section: 'partner',
    display_order: 10, width: 'half', required: false,
    tooltip: 'The industry this partner works in. Referral reports group by this.',
    metadata: { source: SOURCE },
  },
  {
    org_id: ORG, organization_id: ORG, module_id: moduleId,
    key: 'partner_services', label: 'Services Provided', type: 'multiselect',
    options: SERVICES, validation: {}, section: 'partner',
    display_order: 20, width: 'half', required: false,
    tooltip: 'What a PIFH service partner delivers to members. Leave blank for a referring partner.',
    metadata: { source: SOURCE },
  },
  {
    org_id: ORG, organization_id: ORG, module_id: moduleId,
    key: 'partner_since', label: 'Partner Since', type: 'date',
    options: [], validation: {}, section: 'partner',
    display_order: 30, width: 'half', required: false,
    tooltip: 'When the partner relationship started.',
    metadata: { source: SOURCE },
  },
];

const ROBIN_CONTACT_ID = 'd4e6fcca-4cda-47b4-b911-60e4cbc68d5f';
const ROBIN_PATCH = {
  relationship_type: 'Referring Partner',
  partner_industry: 'Financial Advisor / Wealth Management',
  company: 'Wealth Strategies',
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const log = [];
const step = (msg) => { log.push(msg); console.log(msg); };
const die = (msg) => { console.error(`\nABORT: ${msg}`); process.exit(1); };

console.log(`\n${APPLY ? '=== APPLY ===' : '=== DRY RUN (no writes) ==='}  ${URL}\n`);

// --- guard: the org must exist (the SQL's fresh-database check) --------------
{
  const { data, error } = await sb.from('organizations').select('id').eq('id', ORG).maybeSingle();
  if (error) die(error.message);
  if (!data) die(`org ${ORG} not present — nothing to configure`);
}

const { data: modules, error: modErr } = await sb
  .from('crm_modules').select('id,key').eq('org_id', ORG).in('key', ['contacts', 'leads', 'members']);
if (modErr) die(modErr.message);
if (!modules?.length) die('no contacts/leads/members module — refusing to no-op silently');
const moduleIds = modules.map((m) => m.id);
const keyOf = Object.fromEntries(modules.map((m) => [m.id, m.key]));

// --- guard 0: refuse to collide with an existing partner_* meaning -----------
{
  const { data, error } = await sb
    .from('crm_fields').select('key,module_id,metadata')
    .in('module_id', moduleIds)
    .in('key', ['partner_industry', 'partner_services', 'partner_since']);
  if (error) die(error.message);
  const foreign = (data ?? []).filter((f) => f.metadata?.source !== SOURCE);
  if (foreign.length) {
    die(`partner_* keys already defined with another meaning (${foreign.length} rows) — inspect before proceeding`);
  }
}

// --- 1. relationship_type: options + definition ------------------------------
{
  const { data, error } = await sb
    .from('crm_fields').select('id,module_id,options,tooltip,metadata')
    .in('module_id', moduleIds).eq('key', 'relationship_type');
  if (error) die(error.message);
  for (const f of data ?? []) {
    if (same(f.options, REL_OPTIONS) && f.tooltip === REL_TOOLTIP) {
      step(`  relationship_type [${keyOf[f.module_id]}] already current — skipped`);
      continue;
    }
    const metadata = {
      ...(f.metadata ?? {}),
      previous: {
        ...(f.metadata?.previous ?? {}),
        [SOURCE]: { options: f.options, tooltip: f.tooltip ?? '' },
      },
    };
    step(`  relationship_type [${keyOf[f.module_id]}] ${f.options?.length ?? 0} -> ${REL_OPTIONS.length} options, tooltip set`);
    if (APPLY) {
      const { error: e } = await sb.from('crm_fields')
        .update({ options: REL_OPTIONS, tooltip: REL_TOOLTIP, metadata }).eq('id', f.id).select('id');
      if (e) die(`relationship_type update: ${e.message}`);
    }
  }
}

// --- 2. the partner section fields (insert-if-absent) ------------------------
{
  const { data: existing, error } = await sb
    .from('crm_fields').select('key,module_id').in('module_id', moduleIds)
    .in('key', ['partner_industry', 'partner_services', 'partner_since']);
  if (error) die(error.message);
  const have = new Set((existing ?? []).map((f) => `${f.module_id}:${f.key}`));
  const rows = modules.flatMap((m) => partnerFields(m.id)).filter((r) => !have.has(`${r.module_id}:${r.key}`));
  step(`  partner fields to add: ${rows.length} (${modules.length} modules x 3, ${have.size} already present)`);
  if (APPLY && rows.length) {
    const { error: e } = await sb.from('crm_fields').insert(rows).select('id');
    if (e) die(`partner field insert: ${e.message}`);
  }
}

// --- 3. layouts: Partner Details directly under Main -------------------------
{
  const { data: layouts, error } = await sb
    .from('crm_layouts').select('id,name,module_id,config').eq('org_id', ORG).in('module_id', moduleIds);
  if (error) die(error.message);
  for (const l of layouts ?? []) {
    const sections = Array.isArray(l.config?.sections) ? l.config.sections : null;
    if (!sections) { step(`  layout "${l.name}" [${keyOf[l.module_id]}] has no sections array — skipped`); continue; }
    if (sections.some((s) => s?.key === 'partner')) { step(`  layout "${l.name}" [${keyOf[l.module_id]}] already has Partner Details — skipped`); continue; }
    const mainAt = sections.findIndex((s) => s?.key === 'main');
    if (mainAt < 0) { step(`  layout "${l.name}" [${keyOf[l.module_id]}] has no Main band — skipped (app appends it)`); continue; }
    const next = [...sections.slice(0, mainAt + 1), PARTNER_SECTION, ...sections.slice(mainAt + 1)];
    step(`  layout "${l.name}" [${keyOf[l.module_id]}]: Partner Details inserted at position ${mainAt + 2}`);
    if (APPLY) {
      const { error: e } = await sb.from('crm_layouts')
        .update({ config: { ...l.config, sections: next } }).eq('id', l.id).select('id');
      if (e) die(`layout update: ${e.message}`);
    }
  }
}

// --- 4. Robin Anderson — the first Referring Partner -------------------------
{
  const { data: robin, error } = await sb
    .from('crm_records').select('id,title,status,data').eq('id', ROBIN_CONTACT_ID).maybeSingle();
  if (error) die(error.message);
  if (!robin) die(`contact ${ROBIN_CONTACT_ID} not found`);
  const nextData = { ...robin.data, ...ROBIN_PATCH };
  step(`  ${robin.title}: ${Object.entries(ROBIN_PATCH).map(([k, v]) => `${k}="${v}"`).join(', ')}`);
  if (APPLY) {
    const { error: e } = await sb.from('crm_records').update({ data: nextData }).eq('id', robin.id).select('id');
    if (e) die(`Robin update: ${e.message}`);
  }
}

// --- verify ------------------------------------------------------------------
if (APPLY) {
  console.log('\n--- verify ---');
  const { data: rel } = await sb.from('crm_fields').select('module_id,options,tooltip')
    .in('module_id', moduleIds).eq('key', 'relationship_type');
  for (const f of rel ?? []) {
    console.log(`  ${keyOf[f.module_id]}.relationship_type: ${same(f.options, REL_OPTIONS) ? 'OK' : 'MISMATCH'} · tooltip ${f.tooltip === REL_TOOLTIP ? 'OK' : 'MISSING'}`);
  }
  const { data: pf } = await sb.from('crm_fields').select('key,module_id,type,section,organization_id')
    .in('module_id', moduleIds).in('key', ['partner_industry', 'partner_services', 'partner_since']);
  const nullOrg = (pf ?? []).filter((f) => !f.organization_id).length;
  console.log(`  partner fields: ${pf?.length ?? 0}/9 present, ${nullOrg} with NULL organization_id (must be 0 — RLS reads it)`);

  const { data: lay } = await sb.from('crm_layouts').select('name,module_id,config').eq('org_id', ORG).in('module_id', moduleIds);
  for (const l of lay ?? []) {
    const ks = (l.config?.sections ?? []).map((s) => s?.key);
    const i = ks.indexOf('partner');
    console.log(`  layout "${l.name}" [${keyOf[l.module_id]}]: ${i < 0 ? 'no partner section' : `main>partner ${ks[i - 1] === 'main' ? 'OK' : `(after "${ks[i - 1]}")`}`}`);
  }

  // relationship_type distribution — Provider / DPC Provider must be untouched.
  const counts = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('crm_records').select('data')
      .eq('org_id', ORG).is('deleted_at', null).range(from, from + 999);
    if (error) { console.error(error.message); break; }
    for (const r of data) { const v = r.data?.relationship_type; if (v) counts[v] = (counts[v] ?? 0) + 1; }
    if (data.length < 1000) break;
  }
  console.log('  relationship_type counts:', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' · '));

  const { data: r2 } = await sb.from('crm_records').select('title,data').eq('id', ROBIN_CONTACT_ID).maybeSingle();
  console.log(`  ${r2?.title}: relationship_type="${r2?.data?.relationship_type}" partner_industry="${r2?.data?.partner_industry}"`);
}

console.log(APPLY ? '\nApplied.' : '\nDry run complete — re-run with --apply to perform these writes.');
