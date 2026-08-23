#!/usr/bin/env node
/**
 * Data Health sweep — deterministic data-quality audit of the live PIFH book.
 *
 *   node scripts/audit-crm-data-health.mjs [--json out] [--md out] [--as-of YYYY-MM-DD]
 *   npm run audit:data-health
 *
 * Runs the Data Health v1 rule catalog (apps/crm/src/lib/crm/data-health/
 * score.ts — the catalog and score formula live THERE, this script is thin
 * glue) against production, prints the per-rule table + score, and writes the
 * PII-free report to apps/crm/src/lib/crm/data-health/report.latest.json.
 *
 * READ-ONLY: every query is a SELECT/count. Credentials come from
 * apps/crm/.env.local (service role); the key is never printed. Output carries
 * record IDS and COUNTS only — never names, phones, emails, or DOBs.
 *
 * Determinism: every time-relative rule keys off --as-of (default: today UTC),
 * which is stamped into the report, so two runs over unchanged data produce
 * identical counts.
 *
 * Requires Node with native TypeScript type stripping (Node >= 23; this repo
 * runs 26) because it imports the catalog straight from the TS module.
 *
 * PARITY WITH apps/crm/src/lib/crm/data-health/rules.ts IS THE CONTRACT.
 * PostgREST cannot execute a statement, so this script re-implements each
 * rule's predicate in JS. The 2026-08-23 field-correctness pass found the two
 * implementations had silently diverged on FIVE rules (lifecycle.no-owner 425
 * vs 444, twins.contact-member 85 vs 128, lifecycle.null-status 4 vs 5,
 * dates.impossible 7 vs 48, refs.orphan-* org-scoping), so the committed
 * report did not come from the committed catalog. Every rule below now names
 * the SQL it mirrors, sweeps the same module set, and reads the same columns.
 * If you change one side, change the other in the same commit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  RULE_CATALOG,
  FORMULA_VERSION,
  computeScore,
} from '../apps/crm/src/lib/crm/data-health/score.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = path.join(
  REPO_ROOT,
  'apps/crm/src/lib/crm/data-health/report.latest.json',
);

const ORG = '00000000-0000-0000-0000-000000000001';
/** The person modules the record rules sweep (module ids resolved live). */
const PERSON_MODULE_KEYS = new Set(['contacts', 'leads', 'members']);
const SAMPLE_LIMIT = 20;

/** Mirrors PENDING_CONTACT_STATUSES (lib/crm/pending-activation.ts). */
const PENDING_STATUSES = new Set([
  'Pending',
  'Pending HS Member',
  'Pending Member',
  'Enrolled',
  'Enrolled - Pending Start',
  'Approved Pending',
]);

/** Mirrors JSONB_START_DATE_KEYS (lib/crm/resolve-effective-start-date.ts). */
const START_DATE_KEYS = [
  'current_year_start_date',
  'original_start_date',
  'start_date',
  'sharing_effective_date',
  'insurance_effective_date',
  'health_insurance_start_date',
  'effective_date',
  'vision_start_date',
  'dental_start_date',
];

// ---------------------------------------------------------------- CLI / env

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const asOfArg = argValue('--as-of');
if (asOfArg && !/^\d{4}-\d{2}-\d{2}$/.test(asOfArg)) {
  console.error('--as-of must be YYYY-MM-DD');
  process.exit(2);
}
const asOf = asOfArg ?? new Date().toISOString().slice(0, 10);

const envPath = path.join(REPO_ROOT, 'apps/crm/.env.local');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const getEnv = (k) =>
  process.env[k] ??
  (envText.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim().replace(/^['"]|['"]$/g, '');
const URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ------------------------------------------------------------------ helpers

/** Page through a PostgREST query 1000 rows at a time (it truncates silently). */
async function pageAll(table, select, applyFilters, orderCol = 'id') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(select).order(orderCol).range(from, from + 999);
    if (applyFilters) q = applyFilters(q);
    const { data, error } = await q;
    if (error) {
      console.error(`[${table}] ${error.message}`);
      process.exit(2);
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function countOf(table, applyFilters) {
  let q = sb.from(table).select('*', { count: 'exact', head: true });
  if (applyFilters) q = applyFilters(q);
  const { count, error } = await q;
  if (error) {
    console.error(`[${table} count] ${error.message}`);
    process.exit(2);
  }
  return count ?? 0;
}

const blank = (v) => v === null || v === undefined || String(v).trim() === '';
/** Mirrors the SQL `lower(btrim(regexp_replace(x, '\s+', ' ', 'g')))`. */
const norm = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
/** Mirrors the SQL phone key: last 10 digits, or '' when there are none. */
const phoneKey = (v) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d === '' ? '' : d.slice(-10);
};
/** Person-head of a composite "Person - Company" name (advisors.full_name). */
const personHead = (v) => norm(String(v ?? '').split('-')[0]);
const stripLeadSuffix = (v) => String(v ?? '').replace(/\s+MPB Leads\s*$/i, '');
const overlaps = (a, b) => a.some((x) => b.includes(x));
/** Two non-blank names differ, except when one is a prefix of the other. */
const nameDrift = (a, b) => {
  if (a === '' || b === '' || a === b) return false;
  const k = Math.min(a.length, b.length);
  return !(k >= 3 && a.slice(0, k) === b.slice(0, k));
};

/** Normalize a date-ish value to YYYY-MM-DD, or null when unparseable. */
function normDate(v) {
  if (blank(v)) return null;
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function shiftDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// -------------------------------------------------------------------- sweep

async function main() {
  console.log(`Data Health sweep · org ${ORG} · asOf ${asOf} (read-only)`);

  // Module ids differ between environments — resolve them live, never hardcode.
  // EVERY module is mapped: the catalog SQL sweeps all modules for
  // lifecycle.null-status, refs.linked-member, dates.impossible and the
  // non-lead pending rules. Restricting the whole sweep to the person modules
  // is what made the committed report disagree with the catalog.
  const moduleRows = await pageAll('crm_modules', 'id,key', (q) => q.eq('org_id', ORG));
  const moduleById = Object.fromEntries(moduleRows.map((m) => [m.id, m.key]));
  const personModules = moduleRows.filter((m) => PERSON_MODULE_KEYS.has(m.key));
  if (personModules.length !== PERSON_MODULE_KEYS.size) {
    console.error(`Expected contacts/leads/members modules for org, found: ${moduleRows.map((m) => m.key).join(', ')}`);
    process.exit(2);
  }
  const isPerson = (r) => PERSON_MODULE_KEYS.has(moduleById[r.module_id]);

  // --- fetch phase (all SELECTs, minimal columns, jsonb sub-keys only) ---
  const recordSelect = [
    'id',
    'module_id',
    'status',
    'deleted_at',
    'deleted_origin',
    'delete_batch_id',
    'owner_id',
    'canonical_advisor_id',
    'advisor_id',
    'normalized_advisor_name',
    'normalized_agent_name',
    'email',
    'phone',
    'created_at',
    'updated_at',
    'stage_updated_at',
    'current_year_start_date',
    'original_start_date',
    'd_product:data->>product',
    'd_product_type:data->>product_type',
    'd_producer_name:data->>producer_name',
    'd_lead_owner:data->>lead_owner',
    'd_contact_owner:data->>contact_owner',
    'd_linked_member_id:data->>linked_member_id',
    'd_member_number:data->>member_number',
    'd_dob:data->>date_of_birth',
    'd_email:data->>email',
    'd_email2:data->>email2',
    'd_secondary_email:data->>secondary_email',
    'd_phone:data->>phone',
    'd_phone2:data->>phone2',
    'd_mobile:data->>mobile',
    'd_work_phone:data->>work_phone',
    'd_first:data->>first_name',
    'd_last:data->>last_name',
    'd_start_date:data->>start_date',
    'd_sharing_eff:data->>sharing_effective_date',
    'd_ins_eff:data->>insurance_effective_date',
    'd_hi_start:data->>health_insurance_start_date',
    'd_effective:data->>effective_date',
    'd_vision_start:data->>vision_start_date',
    'd_dental_start:data->>dental_start_date',
  ].join(',');

  const [records, notes, tasks, attachments, trashBatches, membersRows, enrollmentRows, advisors, vocabRows, productFields, importJobs] =
    await Promise.all([
      pageAll('crm_records', recordSelect, (q) => q.eq('org_id', ORG)),
      pageAll('crm_notes', 'id,record_id', (q) => q.eq('org_id', ORG).is('deleted_at', null)),
      pageAll('crm_tasks', 'id,record_id', (q) => q.eq('org_id', ORG).is('deleted_at', null)),
      pageAll('crm_attachments', 'id,record_id', (q) => q.eq('org_id', ORG).is('deleted_at', null)),
      pageAll('crm_trash_batches', 'id', (q) => q.eq('organization_id', ORG)),
      pageAll(
        'members',
        'id,member_number,effective_date,date_of_birth,deleted_at,merged_into_id,primary_enrollment_id',
        (q) => q.eq('organization_id', ORG),
      ),
      // Coverage dates live HERE, not on members.effective_date (2/997).
      pageAll('enrollments', 'id,primary_member_id,effective_date,start_date,deleted_at', (q) =>
        q.eq('organization_id', ORG),
      ),
      pageAll('advisors', 'id,full_name,deleted_at', (q) => q.eq('organization_id', ORG)),
      pageAll('crm_status_vocabulary', 'module_key,statuses', (q) => q.eq('org_id', ORG), 'module_key'),
      pageAll('crm_fields', 'key,module_id,options', (q) =>
        q.eq('org_id', ORG).in('key', ['product', 'product_type']),
      ),
      pageAll('crm_import_jobs', 'id,status,source_type,created_at,started_at,stats', (q) =>
        q.eq('org_id', ORG),
      ),
    ]);

  const [openPairs, dismissedPairs] = await Promise.all([
    countOf('crm_probable_duplicates', (q) => q.eq('org_id', ORG)),
    countOf('crm_duplicate_dismissals', (q) => q.eq('org_id', ORG)),
  ]);

  // --- derived sets ---
  const allRecordIds = new Set(records.map((r) => r.id));
  const trashBatchIds = new Set(trashBatches.map((b) => b.id));
  const memberById = new Map(membersRows.map((m) => [m.id, m]));

  // advisors.full_name is composite ("Person - Company") and one human has one
  // row per company; first_name/last_name are a naive split of that same
  // string, so they add no match a full_name check did not already give.
  // Match on the whole name OR on the person-head. (rules.ts: vocabulary.producer)
  const advisorNames = new Set();
  const advisorHeads = new Set();
  for (const a of advisors) {
    if (a.deleted_at !== null || blank(a.full_name)) continue;
    advisorNames.add(norm(a.full_name));
    advisorHeads.add(personHead(a.full_name));
  }
  const onRoster = (name) =>
    advisorNames.has(norm(name)) || advisorHeads.has(personHead(stripLeadSuffix(name)));

  const vocabByModule = Object.fromEntries(
    vocabRows.map((v) => [v.module_key, new Set(v.statuses ?? [])]),
  );
  // Options are stored EITHER as plain strings or as {label, value} objects —
  // the field-options route persists the object shape. Dropping the objects
  // (as this script used to) makes the rule report 0 forever after curation.
  const productOptions = {};
  for (const f of productFields) {
    const mod = moduleById[f.module_id];
    if (!mod) continue;
    const raw = Array.isArray(f.options) ? f.options : [];
    const opts = raw
      .filter((o) => o !== null && o !== undefined)
      .filter((o) => (typeof o === 'object' ? o.is_active !== false : true))
      .map((o) => (typeof o === 'object' ? (o.value ?? o.label ?? '') : String(o)))
      .map(norm)
      .filter((v) => v !== '');
    if (opts.length > 0) productOptions[`${mod}.${f.key}`] = new Set(opts);
  }

  // Coverage by member — BOTH link paths the catalog SQL follows.
  const enrollmentsByMember = new Map();
  const enrollmentById = new Map();
  for (const e of enrollmentRows) {
    enrollmentById.set(e.id, e);
    if (e.deleted_at !== null || !e.primary_member_id) continue;
    if (!enrollmentsByMember.has(e.primary_member_id)) enrollmentsByMember.set(e.primary_member_id, []);
    enrollmentsByMember.get(e.primary_member_id).push(e);
  }
  const coverageFor = (m) => {
    const list = [...(enrollmentsByMember.get(m.id) ?? [])];
    const primary = m.primary_enrollment_id ? enrollmentById.get(m.primary_enrollment_id) : null;
    if (primary && primary.deleted_at === null && !list.includes(primary)) list.push(primary);
    return list;
  };

  // Live records — EVERY module. Rules narrow from here exactly as their SQL does.
  const live = records.filter((r) => r.deleted_at === null && moduleById[r.module_id]);

  const resolveStart = (r) =>
    normDate(r.current_year_start_date) ??
    normDate(r.original_start_date) ??
    START_DATE_KEYS.map((k) => {
      const alias = {
        current_year_start_date: 'd_start_alias_skip', // column already checked
        original_start_date: 'd_start_alias_skip',
        start_date: 'd_start_date',
        sharing_effective_date: 'd_sharing_eff',
        insurance_effective_date: 'd_ins_eff',
        health_insurance_start_date: 'd_hi_start',
        effective_date: 'd_effective',
        vision_start_date: 'd_vision_start',
        dental_start_date: 'd_dental_start',
      }[k];
      return alias ? normDate(r[alias]) : null;
    }).find((d) => d !== null) ?? null;

  // --- evaluate the catalog ---
  // Each block names the rule it mirrors and the module set its SQL sweeps.
  const hits = Object.fromEntries(RULE_CATALOG.map((r) => [r.key, []]));
  const add = (key, id) => hits[key].push(id);
  /** Extra headline numbers (rules.ts buildContextSql), so a 0 is read in scale. */
  const contexts = {};

  /** vocabulary.producer — grouped by SPELLING; records go into the context. */
  const producerSpellings = new Map();

  for (const r of live) {
    const mod = moduleById[r.module_id];
    const vocab = vocabByModule[mod];
    const person = isPerson(r);

    // lifecycle.null-status — ALL modules (the SQL has no module join).
    if (blank(r.status)) add('lifecycle.null-status', r.id);

    // vocabulary.status — any module that has a vocabulary row.
    if (!blank(r.status) && vocab && !vocab.has(r.status)) add('vocabulary.status', r.id);

    // vocabulary.product — contacts/leads. Inert until a list is curated; the
    // context below carries what is therefore going unchecked.
    const productKey = mod === 'contacts' ? 'product' : mod === 'leads' ? 'product_type' : null;
    if (productKey) {
      const value = mod === 'contacts' ? r.d_product : r.d_product_type;
      const opts = productOptions[`${mod}.${productKey}`];
      if (!blank(value)) {
        if (opts && !opts.has(norm(value))) add('vocabulary.product', r.id);
        if (!opts) contexts['vocabulary.product'] = (contexts['vocabulary.product'] ?? 0) + 1;
      }
    }

    // vocabulary.producer — person modules, only where nothing links the record
    // to an advisor already (attribution runs on canonical_advisor_id).
    if (person && r.canonical_advisor_id === null && !blank(r.d_producer_name) && !onRoster(r.d_producer_name)) {
      const spelling = norm(r.d_producer_name);
      if (!producerSpellings.has(spelling)) producerSpellings.set(spelling, []);
      producerSpellings.get(spelling).push(r.id);
    }

    // refs.linked-member — ALL modules; the member must belong to THIS org.
    if (!blank(r.d_linked_member_id) && !memberById.has(String(r.d_linked_member_id).trim()))
      add('refs.linked-member', r.id);

    // dates.impossible (crm_records leg) — a DOB that cannot be real. The old
    // start-date-before-DOB comparison is gone: original_start_date is the
    // PRE-RENEWAL start, and comparing it to a dependent's DOB flagged a
    // placeholder-DOB cluster as a date conflict.
    // (normDate also parses M/D/YYYY where the SQL requires ISO — a deliberate
    // fail-open difference: this side can only ever catch MORE, never fewer.
    // Both implementations agree on the current book.)
    const dob = normDate(r.d_dob);
    const start = resolveStart(r);
    if (dob && (dob > asOf || dob < '1900-01-01')) add('dates.impossible', r.id);

    // dates.pending-no-start — every non-lead module ("Pending" on a lead is a
    // pipeline stage, not coverage).
    if (mod !== 'leads' && PENDING_STATUSES.has(r.status ?? '') && !start)
      add('dates.pending-no-start', r.id);

    // lifecycle.no-owner — person modules, and every place this book stores an
    // owner: leads use lead_owner, contacts use contact_owner.
    if (
      person &&
      !r.owner_id &&
      !r.canonical_advisor_id &&
      !r.advisor_id &&
      blank(r.normalized_advisor_name) &&
      blank(r.normalized_agent_name) &&
      blank(r.d_producer_name) &&
      blank(r.d_lead_owner) &&
      blank(r.d_contact_owner)
    )
      add('lifecycle.no-owner', r.id);

    // lifecycle.stale-pending — dwell on stage_updated_at, NOT updated_at,
    // which an August bulk backfill restamped across the whole book.
    const dwell = normDate(r.stage_updated_at ?? r.created_at);
    if (
      mod !== 'leads' &&
      PENDING_STATUSES.has(r.status ?? '') &&
      dwell !== null &&
      dwell < shiftDays(asOf, -45)
    )
      add('lifecycle.stale-pending', r.id);

    // completeness.unreachable — every own-person channel key this book uses.
    if (
      mod === 'contacts' &&
      [
        r.email, r.d_email, r.d_email2, r.d_secondary_email,
        r.phone, r.d_phone, r.d_phone2, r.d_mobile, r.d_work_phone,
      ].every(blank)
    )
      add('completeness.unreachable', r.id);
  }

  // vocabulary.producer — one hit per spelling (the fixable unit).
  for (const [, ids] of [...producerSpellings.entries()].sort(([a], [b]) => (a < b ? -1 : 1)))
    add('vocabulary.producer', ids.slice().sort()[0]);
  contexts['vocabulary.producer'] = [...producerSpellings.values()].reduce((n, ids) => n + ids.length, 0);

  // twins.contact-member — Members-module row vs Contacts-module row on the
  // same member number, comparing field FAMILIES (a value on the contact's
  // email2/secondary_email or phone2/mobile is the same person, not drift).
  const contactsByMemberNumber = new Map();
  for (const c of live) {
    if (moduleById[c.module_id] !== 'contacts' || blank(c.d_member_number)) continue;
    const key = String(c.d_member_number).trim();
    if (!contactsByMemberNumber.has(key)) contactsByMemberNumber.set(key, []);
    contactsByMemberNumber.get(key).push(c);
  }
  const emailFamily = (r) =>
    [r.email, r.d_email, r.d_email2, r.d_secondary_email].map(norm).filter((v) => v !== '');
  const phoneFamily = (r) =>
    [r.phone, r.d_phone, r.d_phone2, r.d_mobile].map(phoneKey).filter((v) => v !== '');
  const twinHits = new Set();
  for (const mem of live) {
    if (moduleById[mem.module_id] !== 'members' || blank(mem.d_member_number)) continue;
    for (const c of contactsByMemberNumber.get(String(mem.d_member_number).trim()) ?? []) {
      const [me, ce] = [emailFamily(mem), emailFamily(c)];
      const [mp, cp] = [phoneFamily(mem), phoneFamily(c)];
      const drift =
        (me.length > 0 && ce.length > 0 && !overlaps(me, ce)) ||
        (mp.length > 0 && cp.length > 0 && !overlaps(mp, cp)) ||
        nameDrift(norm(mem.d_first), norm(c.d_first)) ||
        (norm(mem.d_last) !== '' && norm(c.d_last) !== '' && norm(mem.d_last) !== norm(c.d_last));
      if (drift) twinHits.add(mem.id);
    }
  }
  for (const id of [...twinHits].sort()) add('twins.contact-member', id);

  // refs.orphan-* — a child row whose parent record does not exist in this org.
  // record_id IS NULL is NOT an orphan: crm_tasks.record_id is nullable by
  // design and a standalone task still shows on the calendar and organizer.
  for (const n of notes)
    if (n.record_id !== null && !allRecordIds.has(n.record_id)) add('refs.orphan-notes', n.id);
  for (const t of tasks)
    if (t.record_id !== null && !allRecordIds.has(t.record_id)) add('refs.orphan-tasks', t.id);
  for (const a of attachments)
    if (a.record_id !== null && !allRecordIds.has(a.record_id)) add('refs.orphan-attachments', a.id);
  contexts['refs.orphan-notes'] = notes.length;
  contexts['refs.orphan-tasks'] = tasks.length;
  contexts['refs.orphan-attachments'] = attachments.length;

  // refs.trash-batch — a trashed record the Trash screen cannot restore as a
  // unit: no batch stamp at all, or a batch with no receipt row. Merge losers
  // are trashed by design and are restored through the merge.
  let mergeDeletes = 0;
  for (const r of records) {
    if (r.deleted_at === null) continue;
    if ((r.deleted_origin ?? '') === 'merge') {
      mergeDeletes += 1;
      continue;
    }
    if (!r.delete_batch_id || !trashBatchIds.has(r.delete_batch_id)) add('refs.trash-batch', r.id);
  }
  contexts['refs.trash-batch'] = mergeDeletes;

  // dates.impossible (members leg) + completeness.member-core — coverage read
  // from ENROLLMENTS. members.effective_date is vestigial (2 of 997 populated).
  for (const m of membersRows) {
    if (m.deleted_at !== null || m.merged_into_id !== null) continue;
    const dob = normDate(m.date_of_birth);
    const coverage = coverageFor(m);
    if (dob) {
      if (dob > asOf || dob < '1900-01-01') add('dates.impossible', m.id);
      else if (
        coverage.some((e) => {
          const eff = normDate(e.effective_date) ?? normDate(e.start_date);
          return eff !== null && eff < dob;
        })
      )
        add('dates.impossible', m.id);
    }
    if (blank(m.member_number) || !coverage.some((e) => normDate(e.effective_date) !== null))
      add('completeness.member-core', m.id);
  }

  // ingest.stuck-imports — scoped and timed to match reap_stalled_import_jobs:
  // data_job rows wait on human approval by design, and staleness is measured
  // from the last pass heartbeat, not the first. The old 24h threshold was
  // unreachable behind a */15 reaper that terminalizes a real stall after 1h.
  const IMPORT_SOURCE_TYPES = ['csv', 'csv_upload', 'csv_update', 'export', 'zoho'];
  const stuckCutoff = `${shiftDays(asOf, -1)}T22:00:00`; // as-of midnight minus 2h
  for (const j of importJobs) {
    if (!['pending', 'validating', 'processing'].includes(j.status ?? '')) continue;
    if (!IMPORT_SOURCE_TYPES.includes(j.source_type ?? '')) continue;
    const lastActivity = [j.stats?.last_pass_at, j.started_at, j.created_at]
      .filter((v) => !blank(v))
      .map((v) => String(v))
      .sort()
      .pop();
    if ((lastActivity ?? '') < stuckCutoff) add('ingest.stuck-imports', j.id);
  }
  contexts['ingest.stuck-imports'] = importJobs.length;

  // dupes.open-pairs — queue size, not ids (pairs are not records).
  const dupeCount = openPairs;
  contexts['dupes.open-pairs'] = dismissedPairs;

  // --- report ---
  const results = RULE_CATALOG.map((rule) => ({
    ...rule,
    count: rule.key === 'dupes.open-pairs' ? dupeCount : hits[rule.key].length,
    sampleIds: (hits[rule.key] ?? []).slice(0, SAMPLE_LIMIT),
    ...(contexts[rule.key] === undefined ? {} : { contextValue: contexts[rule.key] }),
  }));
  const counts = Object.fromEntries(results.map((r) => [r.key, r.count]));
  const score = computeScore(counts);

  const report = {
    version: 1,
    formulaVersion: FORMULA_VERSION,
    generatedAt: new Date().toISOString(),
    asOf,
    org: ORG,
    score,
    context: {
      liveRecords: live.length,
      allRecords: records.length,
      members: membersRows.filter((m) => m.deleted_at === null && m.merged_into_id === null).length,
      enrollments: enrollmentRows.filter((e) => e.deleted_at === null).length,
      notes: notes.length,
      tasks: tasks.length,
      attachments: attachments.length,
      trashedRecords: records.filter((r) => r.deleted_at !== null).length,
      dismissedDuplicatePairs: dismissedPairs,
    },
    rules: results,
  };

  // --- print (ids + counts only; never PII) ---
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${pad('rule', 28)}${pad('severity', 10)}${pad('count', 8)}label`);
  for (const r of results)
    console.log(`${pad(r.key, 28)}${pad(r.severity, 10)}${pad(r.count, 8)}${r.label}`);
  console.log(
    `\nScore: ${score} / 100 (formula v${FORMULA_VERSION}) · open dupe pairs ${dupeCount} (+${dismissedPairs} dismissed)`,
  );

  const json = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(REPORT_PATH, json, 'utf8');
  console.log(`Report → ${path.relative(REPO_ROOT, REPORT_PATH)}`);

  const jsonOut = argValue('--json');
  if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), json, 'utf8');
  const mdOut = argValue('--md');
  if (mdOut) {
    const md = [
      `# Data Health — ${asOf}`,
      '',
      `Score: **${score} / 100** (formula v${FORMULA_VERSION})`,
      '',
      '| Rule | Severity | Count | Label |',
      '| --- | --- | ---: | --- |',
      ...results.map((r) => `| ${r.key} | ${r.severity} | ${r.count} | ${r.label} |`),
      '',
    ].join('\n');
    fs.writeFileSync(path.resolve(mdOut), `${md}\n`, 'utf8');
  }
}

await main();
