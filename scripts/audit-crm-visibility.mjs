#!/usr/bin/env node
/**
 * CRM visibility audit — proves every stored value can reach the screen.
 *
 * The CRM renders exactly the keys that have a `crm_fields` definition for the
 * record's module. Anything else stored in `crm_records.data` is invisible in
 * the detail view, list columns, in-record search AND CSV export. This script
 * measures that gap against the live database.
 *
 * READ-ONLY. Prints aggregate counts and KEY NAMES only — never field values,
 * so it is safe to run and paste. Requires NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (read from .env at the repo root if unset).
 *
 *   npm run audit:crm-visibility
 *
 * Exit code 1 if any record would render completely blank.
 *
 * --ux-reality  (Road to Ten RO-1) — delegates to scripts/audit-crm-ux-reality.mjs
 *   (the single implementation of the PIFH live-reality PASS/FAIL table; extra
 *   flags such as --write / --offline / --refresh are passed through).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// --ux-reality (RO-1): one implementation lives in scripts/audit-crm-ux-reality.mjs.
if (process.argv.includes('--ux-reality')) {
  const target = path.join(path.dirname(fileURLToPath(import.meta.url)), 'audit-crm-ux-reality.mjs');
  const passthrough = process.argv.slice(2).filter((a) => a !== '--ux-reality');
  const r = spawnSync(process.execPath, [target, ...passthrough], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fromEnvFile(key) {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return null;
  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : null;
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || fromEnvFile('NEXT_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fromEnvFile('SUPABASE_SERVICE_ROLE_KEY');
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

/** Zoho audit/system metadata — intentionally not shown in the CRM form. */
const SYSTEM_KEYS = new Set([
  'last_activity_time', 'change_log_time', 'record_id', 'created_by', 'modified_by',
  'zoho_module', 'created_time', 'created_by_id', 'modified_time', 'modified_by_id',
  'lead_owner_id', 'external_username', 'first_visit', 'most_recent_visit',
  'visitor_score', 'number_of_chats', 'days_visited', 'first_page_visited',
  'average_time_spent_minutes', 'referrer', 'contact_name', 'auto_cancelled_at',
  'auto_cancelled_reason', 'linked_member_id', 'contact_status', 'imported_at',
  'import_batch', 'row_number', 'unsubscribed_mode', 'unsubscribed_time',
  'membership_changes', 'scheduled_plan_change', 'dependents_json', 'layout', 'tag',
  // Provenance written by 20260822130000_household_age_backfill: the original
  // "Yes - 45"-style text moved out of the Spouse/Child name boxes. Undo data,
  // not a form field.
  'household_backfill_source',
  // Mirrors of indexed crm_records columns — surfaced through the column, not
  // as a duplicate JSONB form row.
  'owner_id', 'status', 'stage', 'is_converted', 'import_source',
  'source_record_id', 'canonical_advisor_id',
]);

/**
 * Legacy keys the app projects onto a defined canonical key at read time
 * (apps/crm/src/lib/crm/legacy-key-projection.ts and lead-contact-sharing-fields.ts).
 * Their values DO reach the screen, so they are visible even though the legacy
 * key itself has no crm_fields row. Keep in sync with those modules.
 */
const PROJECTED_BY_MODULE = {
  contacts: new Set([
    'primary_member_gender', 'city', 'state', 'zip_code', 'postal_code',
    'address_line1', 'company_name', 'email2', 'referral', 'source',
    'e123_member_id', 'member_number', 'start_date', 'original_start_date',
    'carrier', 'monthly_premium', 'monthly_share', 'share_amount',
  ]),
  leads: new Set([
    'mailing_city', 'mailing_state', 'mailing_zip', 'postal_code',
    'company_name', 'email2', 'source',
    'e123_member_id', 'member_number', 'start_date', 'original_start_date',
    'carrier', 'monthly_premium', 'monthly_share', 'share_amount',
  ]),
  members: new Set([
    'primary_member_gender', 'mailing_city', 'mailing_state', 'mailing_zip',
    'postal_code', 'e123_member_id', 'member_number', 'start_date',
    'original_start_date', 'carrier', 'monthly_premium', 'monthly_share',
    'share_amount',
  ]),
};

const isProjected = (moduleKey, key) =>
  PROJECTED_BY_MODULE[moduleKey]?.has(key) ?? false;

const isEmpty = (v) =>
  v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const { data: mods, error: modErr } = await sb.from('crm_modules').select('id, key');
if (modErr) { console.error('modules:', modErr.message); process.exit(2); }
const modKey = new Map(mods.map((m) => [m.id, m.key]));

const { data: fields, error: fieldErr } = await sb.from('crm_fields').select('module_id, key');
if (fieldErr) { console.error('fields:', fieldErr.message); process.exit(2); }
const defByModule = new Map();
for (const f of fields) {
  if (!defByModule.has(f.module_id)) defByModule.set(f.module_id, new Set());
  defByModule.get(f.module_id).add(f.key);
}

let scanned = 0, totalPopulated = 0, totalRenderable = 0, fullyBlank = 0;
const orphanBusiness = new Map();
const perModule = new Map();

for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('crm_records')
    .select('module_id, data')
    .is('deleted_at', null)
    .range(from, from + 999);
  if (error) { console.error('records:', error.message); process.exit(2); }
  if (!data?.length) break;

  for (const r of data) {
    scanned += 1;
    const defined = defByModule.get(r.module_id) ?? new Set();
    const mk = modKey.get(r.module_id) ?? 'unknown';
    const d = r.data && typeof r.data === 'object' ? r.data : {};
    let populated = 0, renderable = 0;
    for (const [k, v] of Object.entries(d)) {
      if (isEmpty(v)) continue;
      populated += 1;
      if (defined.has(k) || isProjected(mk, k)) renderable += 1;
      else if (!SYSTEM_KEYS.has(k)) {
        const byMod = orphanBusiness.get(k) ?? new Map();
        byMod.set(mk, (byMod.get(mk) ?? 0) + 1);
        orphanBusiness.set(k, byMod);
      }
    }
    totalPopulated += populated;
    totalRenderable += renderable;
    if (populated > 0 && renderable === 0) fullyBlank += 1;
    const pm = perModule.get(mk) ?? { n: 0, pop: 0, rend: 0, blank: 0 };
    pm.n += 1; pm.pop += populated; pm.rend += renderable;
    if (populated > 0 && renderable === 0) pm.blank += 1;
    perModule.set(mk, pm);
  }
  if (data.length < 1000) break;
}

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : 'n/a');
console.log(`records scanned            : ${scanned}`);
console.log(`populated values           : ${totalPopulated}`);
console.log(`renderable values          : ${totalRenderable}`);
console.log(`VISIBILITY RATE            : ${pct(totalRenderable, totalPopulated)}%`);
console.log(`records rendering BLANK    : ${fullyBlank}`);

console.log('\nper module:');
for (const [mk, v] of [...perModule.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `  ${mk.padEnd(12)} n=${String(v.n).padStart(6)}  visible=${String(pct(v.rend, v.pop)).padStart(5)}%  blank=${v.blank}`,
  );
}

const orphanRows = [...orphanBusiness.entries()]
  .map(([k, byMod]) => ({ k, total: [...byMod.values()].reduce((a, b) => a + b, 0), byMod }))
  .sort((a, b) => b.total - a.total);
const orphanTotal = orphanRows.reduce((s, r) => s + r.total, 0);
console.log(`\nhidden BUSINESS values     : ${orphanTotal} across ${orphanRows.length} keys`);
for (const r of orphanRows.slice(0, 25)) {
  console.log(
    `  ${String(r.total).padStart(6)}  ${r.k.padEnd(28)} ${[...r.byMod.entries()].map(([m, c]) => `${m}:${c}`).join(' ')}`,
  );
}

if (fullyBlank > 0) {
  console.error(`\nFAIL: ${fullyBlank} record(s) would render completely blank.`);
  process.exit(1);
}
console.log('\nOK: every record with stored data renders at least one field.');
