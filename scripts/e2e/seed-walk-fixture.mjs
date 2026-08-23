#!/usr/bin/env node
/**
 * seed-walk-fixture.mjs — LOCAL-ONLY, idempotent walk fixture for the
 * "Road to Ten" usability walk (plan item EV-2).
 *
 * Seeds, against the LOCAL Supabase stack and nothing else:
 *   - three auth users + profiles (organization 0000…0001 "PIFH"):
 *       walk-operator@example.invalid / Walk-Operator-2026!  role staff, crm_role crm_agent
 *       walk-admin@example.invalid    / Walk-Admin-2026!     role admin, crm_role crm_admin
 *       walk-viewer@example.invalid   / Walk-Viewer-2026!    role staff, crm_role crm_viewer
 *     (the profiles_sync_to_org_members trigger creates organization_members)
 *   - crm_feature_flags: PIFH crm.nav.simple = FALSE (owner decision: full
 *     shell), asserts the global crm.layout.v2 row exists and is enabled, and
 *     mirrors the other prod global/PIFH flag values
 *   - PIFH CRM CONFIG mirrored from prod via scripts/e2e/fixture-shapes.json
 *     (captured read-only by dump-prod-fixture-shapes.mjs — config tables only,
 *     no records): crm_modules (name/order/enabled), the MISSING crm_fields
 *     (existing local rows are left alone and diffs reported), one crm_views
 *     row per prod view (prod ids, same columns/sort/filters), one default
 *     crm_layouts row per module (prod sections incl. the core 'hero' variant)
 *   - records (statuses are checked against crm_status_vocabulary BEFORE any
 *     insert — the DB guard trigger rejects anything else):
 *       contacts: 'Wendy Walker' (phone 5550107788 in the phone COLUMN,
 *       member_number WALK-0001, Active, product + sharing_effective_date
 *       2026-09-01, producer_name 'Wen Producer'), four Pending-lane contacts
 *       with created_at spread over days — 'Pat Pending' (5550107701) is the
 *       oldest — and 30 filler contacts so the list pages at 25/page (≥32)
 *       leads: 'Lee Lead'  ·  advisors: 'Wen Producer'  ·  members: 3 rows
 *       one legacy crm_notes row on Wendy
 *     Every fixture record carries data.walk_fixture = true and a deterministic
 *     uuid, so re-runs UPDATE in place — never duplicate.
 *
 * SAFETY
 *   - Refuses any Supabase URL or DB URL whose host is not 127.0.0.1/localhost
 *     (exit 2). Pointing it at prod by env var fails before any network call.
 *   - Never deletes. Never prints keys.
 *   - Does NOT run `supabase start/db push/db reset` — those target PROD in
 *     this repo. Apply pending migrations first with
 *     scripts/e2e/apply-local-migrations.sh.
 *
 * USAGE (defaults are the public local demo stack)
 *   node scripts/e2e/seed-walk-fixture.mjs
 *   LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
 *   LOCAL_SERVICE_ROLE_KEY=<local service-role key> \
 *   LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     node scripts/e2e/seed-walk-fixture.mjs
 *   node scripts/e2e/seed-walk-fixture.mjs --verify-only   # checks, no writes
 *
 * Exit codes: 0 seeded + verified · 1 verification failed · 2 refused/config.
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Local-only guard — runs before anything else.
// ---------------------------------------------------------------------------
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DEMO_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const SUPABASE_URL = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.LOCAL_SERVICE_ROLE_KEY || LOCAL_DEMO_SERVICE_KEY;
const LOCAL_DEMO_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const ANON_KEY = process.env.LOCAL_ANON_KEY || LOCAL_DEMO_ANON_KEY;
const DB_URL = process.env.LOCAL_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const VERIFY_ONLY = process.argv.includes('--verify-only');

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
for (const [label, url] of [
  ['LOCAL_SUPABASE_URL', SUPABASE_URL],
  ['LOCAL_DB_URL', DB_URL],
]) {
  const h = hostOf(url);
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(h)) {
    console.error(`REFUSED: ${label} host "${h || url}" is not local (127.0.0.1/localhost). This fixture only ever seeds the local stack.`);
    process.exit(2);
  }
}

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const shapes = JSON.parse(readFileSync(path.join(HERE, 'fixture-shapes.json'), 'utf8'));
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const NS = 'crm-eco-walk-fixture-2026';
/** Deterministic uuid (v5-style, sha1) so re-runs hit the same rows. */
function uuid5(name) {
  const h = createHash('sha1').update(NS + ':' + name).digest('hex').slice(0, 32).split('');
  h[12] = '5';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
const daysAgo = (d, hours = 0) => new Date(Date.now() - d * 86400e3 - hours * 3600e3).toISOString();
function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
function psql(sql) {
  return execFileSync('psql', [DB_URL, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim();
}
const failures = [];
function check(ok, msg) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
}

// ---------------------------------------------------------------------------
// FIXTURE CONTRACT (shared with the Playwright harness — keep in sync)
// ---------------------------------------------------------------------------
export const WALK_USERS = [
  { key: 'operator', email: 'walk-operator@example.invalid', password: 'Walk-Operator-2026!', role: 'staff', crm_role: 'crm_agent', full_name: 'Walk Operator' },
  { key: 'admin', email: 'walk-admin@example.invalid', password: 'Walk-Admin-2026!', role: 'admin', crm_role: 'crm_admin', full_name: 'Walk Admin' },
  { key: 'viewer', email: 'walk-viewer@example.invalid', password: 'Walk-Viewer-2026!', role: 'staff', crm_role: 'crm_viewer', full_name: 'Walk Viewer' },
];
export const ANCHOR = {
  first_name: 'Wendy',
  last_name: 'Walker',
  phone: '5550107788',
  email: 'wendy.walker@example.invalid',
  member_number: 'WALK-0001',
  status: 'Active',
  product: 'Sedera Access+',
  sharing_entity: 'Sedera',
  sharing_effective_date: '2026-09-01',
  producer_name: 'Wen Producer',
};
const PENDING_STATUS = 'Pending';
const PENDING = [
  { first: 'Pat', last: 'Pending', phone: '5550107701', days: 60 }, // oldest
  { first: 'Penny', last: 'Pending', phone: '5550107702', days: 41 },
  { first: 'Paul', last: 'Pending', phone: '5550107703', days: 23 },
  { first: 'Pia', last: 'Pending', phone: '5550107704', days: 9 },
];
const FILLER_FIRST = ['Ana', 'Ben', 'Cara', 'Dev', 'Elin', 'Finn', 'Gia', 'Hugo', 'Iris', 'Jon', 'Kai', 'Lena', 'Mo', 'Nia', 'Oren', 'Pri', 'Quin', 'Rae', 'Sol', 'Tess', 'Uma', 'Vik', 'Wren', 'Xan', 'Yara', 'Zed', 'Abe', 'Bea', 'Cal', 'Dee'];
const FILLER_LAST = ['Alder', 'Birch', 'Cedar', 'Dune', 'Elm', 'Fern', 'Grove', 'Heath', 'Isle', 'Juniper', 'Kelp', 'Larch', 'Moss', 'Nook', 'Oak', 'Pine', 'Quill', 'Reed', 'Sage', 'Thorn', 'Umber', 'Vale', 'Willow', 'Xenia', 'Yew', 'Zinnia', 'Ash', 'Bay', 'Cove', 'Dell'];
const FILLER_STATUS = ['Active', 'Active', 'Inactive', 'Cancelled', 'Active', 'In Process'];
const FILLER_COUNT = 30;

// ---------------------------------------------------------------------------
// 1) auth users + profiles
// ---------------------------------------------------------------------------
async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function seedUsers() {
  const profileIds = {};
  for (const u of WALK_USERS) {
    const meta = { full_name: u.full_name, organization_id: ORG_ID, role: u.role };
    let user = await findUserByEmail(u.email);
    if (!user) {
      const { data, error } = await sb.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true, user_metadata: meta });
      if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
      user = data.user;
      console.log(`user created   ${u.email}`);
    } else {
      const { error } = await sb.auth.admin.updateUserById(user.id, { password: u.password, email_confirm: true, user_metadata: meta });
      if (error) throw new Error(`updateUser ${u.email}: ${error.message}`);
      console.log(`user updated   ${u.email}`);
    }
    // handle_new_user created the profile from user_metadata on INSERT; make it
    // canonical either way (re-runs, users created before this script).
    const existing = must(await sb.from('profiles').select('id').eq('user_id', user.id).maybeSingle(), 'profile lookup');
    const row = {
      user_id: user.id,
      organization_id: ORG_ID,
      email: u.email,
      full_name: u.full_name,
      display_name: u.full_name,
      role: u.role,
      crm_role: u.crm_role,
      is_active: true,
    };
    let profileId;
    if (existing) {
      must(await sb.from('profiles').update(row).eq('id', existing.id), `profile update ${u.email}`);
      profileId = existing.id;
    } else {
      profileId = uuid5(`profile:${u.email}`);
      must(await sb.from('profiles').insert({ id: profileId, ...row }), `profile insert ${u.email}`);
    }
    // Trigger inserts organization_members ON CONFLICT DO NOTHING — make sure the
    // membership is active + default even if an older row existed.
    must(
      await sb.from('organization_members').update({ is_active: true, is_default: true }).eq('organization_id', ORG_ID).eq('user_id', user.id),
      `org member ${u.email}`,
    );
    profileIds[u.key] = profileId;
  }
  return profileIds;
}

// ---------------------------------------------------------------------------
// 2) feature flags
// ---------------------------------------------------------------------------
async function seedFlags() {
  const wanted = shapes.feature_flags.filter((f) => f.scope === 'global' || f.scope === 'pifh');
  // Owner decision (docs/ux/decisions-2026-08-22.md, non-goals): PIFH keeps the
  // full navigation shell → crm.nav.simple = false. fixture-shapes.json carries
  // the same value from prod; pin it explicitly so a stale snapshot cannot flip it.
  const navSimple = wanted.find((f) => f.scope === 'pifh' && f.flag_key === 'crm.nav.simple');
  if (navSimple) navSimple.enabled = false;
  else wanted.push({ scope: 'pifh', organization_id: ORG_ID, flag_key: 'crm.nav.simple', enabled: false, rollout_percentage: 0, description: 'Simple tenant navigation: flat sidebar driven by enabled crm_modules, no top module tabs.' });

  for (const f of wanted) {
    const orgId = f.scope === 'global' ? null : ORG_ID;
    let q = sb.from('crm_feature_flags').select('id,enabled').eq('flag_key', f.flag_key);
    q = orgId ? q.eq('organization_id', orgId) : q.is('organization_id', null);
    const existing = must(await q.maybeSingle(), `flag ${f.flag_key}`);
    if (existing) {
      if (existing.enabled !== f.enabled) must(await sb.from('crm_feature_flags').update({ enabled: f.enabled }).eq('id', existing.id), `flag update ${f.flag_key}`);
    } else {
      must(
        await sb.from('crm_feature_flags').insert({ organization_id: orgId, flag_key: f.flag_key, enabled: f.enabled, rollout_percentage: f.rollout_percentage ?? 0, description: f.description ?? null }),
        `flag insert ${f.flag_key}`,
      );
    }
  }
  const v2 = must(await sb.from('crm_feature_flags').select('enabled').eq('flag_key', 'crm.layout.v2').is('organization_id', null).maybeSingle(), 'layout.v2');
  if (!v2?.enabled) throw new Error('global crm.layout.v2 flag row missing or disabled — apply migrations first (202607140006)');
  console.log(`flags mirrored  ${wanted.length} (crm.nav.simple@PIFH=false, crm.layout.v2@global=true)`);
}

// ---------------------------------------------------------------------------
// 3) modules / fields / views / layouts — mirror prod config
// ---------------------------------------------------------------------------
async function seedModules() {
  const local = must(await sb.from('crm_modules').select('id,key').eq('org_id', ORG_ID), 'modules');
  const byKey = new Map(local.map((m) => [m.key, m.id]));
  for (const m of shapes.modules) {
    const row = { name: m.name, name_plural: m.name_plural, icon: m.icon, description: m.description, is_system: m.is_system, is_enabled: m.is_enabled, display_order: m.display_order };
    if (byKey.has(m.key)) {
      must(await sb.from('crm_modules').update(row).eq('id', byKey.get(m.key)), `module update ${m.key}`);
    } else {
      must(await sb.from('crm_modules').insert({ id: m.prod_id, org_id: ORG_ID, organization_id: ORG_ID, key: m.key, ...row }), `module insert ${m.key}`);
      byKey.set(m.key, m.prod_id);
    }
  }
  console.log(`modules         ${shapes.modules.length} mirrored (${shapes.modules.filter((m) => m.is_enabled).map((m) => m.key).join(', ')} enabled)`);
  return byKey;
}

async function seedFields(modByKey) {
  const local = must(
    await sb.from('crm_fields').select('id,module_id,key,label,type,section,options,validation,default_value,tooltip,display_order,width,required,is_system,is_indexed,is_title_field,is_pinned,metadata').eq('org_id', ORG_ID).limit(5000),
    'fields',
  );
  const have = new Map(local.map((f) => [`${f.module_id}:${f.key}`, f]));
  const MIRRORED = ['label', 'type', 'required', 'is_system', 'is_indexed', 'is_title_field', 'options', 'validation', 'default_value', 'tooltip', 'display_order', 'section', 'width', 'is_pinned', 'metadata'];
  const shapeRow = (f) => ({
    label: f.label,
    type: f.type,
    required: f.required ?? false,
    is_system: f.is_system ?? false,
    is_indexed: f.is_indexed ?? false,
    is_title_field: f.is_title_field ?? false,
    options: f.options ?? [],
    validation: f.validation ?? {},
    default_value: f.default_value ?? null,
    tooltip: f.tooltip ?? null,
    display_order: f.display_order ?? 0,
    section: f.section ?? 'main',
    width: f.width ?? 'full',
    is_pinned: f.is_pinned ?? false,
    metadata: f.metadata ?? {},
  });
  const inserts = [];
  const aligned = [];
  for (const f of shapes.fields) {
    const moduleId = modByKey.get(f.module_key);
    if (!moduleId) continue;
    const want = shapeRow(f);
    const cur = have.get(`${moduleId}:${f.key}`);
    if (cur) {
      // Existing local rows (supabase/seed.sql + applied migrations) are ALIGNED
      // to prod so the walk sees prod labels/types/sections — config mirror, not
      // invention. Only columns that differ are written.
      const patch = {};
      for (const k of MIRRORED) if (JSON.stringify(cur[k] ?? null) !== JSON.stringify(want[k] ?? null)) patch[k] = want[k];
      if (Object.keys(patch).length) {
        must(await sb.from('crm_fields').update(patch).eq('id', cur.id), `field align ${f.module_key}.${f.key}`);
        aligned.push(`${f.module_key}.${f.key} ${Object.keys(patch).join('/')}`);
      }
      continue;
    }
    inserts.push({ id: uuid5(`field:${f.module_key}:${f.key}`), org_id: ORG_ID, organization_id: ORG_ID, module_id: moduleId, key: f.key, ...want });
  }
  for (let i = 0; i < inserts.length; i += 200) {
    must(await sb.from('crm_fields').upsert(inserts.slice(i, i + 200), { onConflict: 'module_id,key', ignoreDuplicates: true }), 'fields insert');
  }
  console.log(`fields          ${inserts.length} missing inserted, ${have.size} already present (${aligned.length} aligned to prod)`);
  for (const d of aligned.slice(0, 20)) console.log(`   aligned  ${d}`);
  if (aligned.length > 20) console.log(`   … ${aligned.length - 20} more`);
}

async function seedViews(modByKey) {
  let n = 0;
  for (const v of shapes.views) {
    const moduleId = modByKey.get(v.module_key);
    if (!moduleId) continue;
    const existing = must(await sb.from('crm_views').select('id').eq('module_id', moduleId).eq('name', v.name).maybeSingle(), `view ${v.name}`);
    const row = { columns: v.columns, filters: v.filters ?? [], sort: v.sort ?? [], is_default: v.is_default, is_shared: v.is_shared ?? true, created_by: null };
    if (existing) must(await sb.from('crm_views').update(row).eq('id', existing.id), `view update ${v.name}`);
    else must(await sb.from('crm_views').insert({ id: v.prod_id, org_id: ORG_ID, organization_id: ORG_ID, module_id: moduleId, name: v.name, ...row }), `view insert ${v.name}`);
    n++;
  }
  console.log(`views           ${n} mirrored (prod ids, columns, sort, filters)`);
}

async function seedLayouts(modByKey) {
  let n = 0;
  for (const l of shapes.layouts) {
    const moduleId = modByKey.get(l.module_key);
    if (!moduleId) continue;
    const existing = must(await sb.from('crm_layouts').select('id').eq('module_id', moduleId).eq('name', l.name).maybeSingle(), `layout ${l.name}`);
    const id = existing?.id ?? l.prod_id;
    if (l.is_default) {
      // uq_crm_layouts_one_default_per_module: demote any other default first.
      must(await sb.from('crm_layouts').update({ is_default: false }).eq('module_id', moduleId).eq('is_default', true).neq('id', id), `layout demote ${l.module_key}`);
    }
    const row = { config: l.config, is_default: l.is_default };
    if (existing) must(await sb.from('crm_layouts').update(row).eq('id', id), `layout update ${l.name}`);
    else must(await sb.from('crm_layouts').insert({ id, org_id: ORG_ID, organization_id: ORG_ID, module_id: moduleId, name: l.name, ...row }), `layout insert ${l.name}`);
    n++;
  }
  console.log(`layouts         ${n} mirrored (prod sections incl. core 'hero')`);
}

// ---------------------------------------------------------------------------
// 4) records
// ---------------------------------------------------------------------------
function loadVocabulary() {
  // crm_status_vocabulary is not exposed through PostgREST (no grants) — read it
  // the way the guard trigger does, straight from the DB.
  const out = psql(`select json_agg(json_build_object('module_key', module_key, 'statuses', statuses)) from crm_status_vocabulary where org_id='${ORG_ID}'`);
  const rows = out ? JSON.parse(out) ?? [] : [];
  if (!rows.length) throw new Error('crm_status_vocabulary has no PIFH rows — apply migrations first (20260822150000)');
  return new Map(rows.map((r) => [r.module_key, r.statuses]));
}

function buildRecords(modByKey, ownerId) {
  const contacts = modByKey.get('contacts');
  const leads = modByKey.get('leads');
  const members = modByKey.get('members');
  const advisors = modByKey.get('advisors');
  const base = (moduleId, key, createdAt, data, extra = {}) => ({
    id: uuid5(`record:${key}`),
    org_id: ORG_ID,
    organization_id: ORG_ID,
    module_id: moduleId,
    owner_id: ownerId,
    created_by: ownerId,
    created_at: createdAt,
    updated_at: createdAt,
    email: data.email ?? null,
    phone: data.phone ?? null,
    status: extra.status ?? null,
    data: { walk_fixture: true, ...data },
  });
  const recs = [];
  const advisorId = uuid5('record:advisor:wen-producer');

  // advisors module — 'Wen Producer' (D5: CRM advisors module is the producer source)
  recs.push(
    base(advisors, 'advisor:wen-producer', daysAgo(120), {
      first_name: 'Wen',
      last_name: 'Producer',
      advisor_code: 'WEN01',
      agent_role: 'Advisor',
      agency_name: 'Walk Agency',
      enrollment_code: 'WALK',
      email: 'wen.producer@example.invalid',
      phone: '5550107799',
    }),
  );

  // anchor contact
  recs.push(
    base(
      contacts,
      'contact:wendy-walker',
      daysAgo(10, 3),
      {
        first_name: ANCHOR.first_name,
        last_name: ANCHOR.last_name,
        phone: ANCHOR.phone,
        email: ANCHOR.email,
        date_of_birth: '1980-04-12',
        mailing_city: 'Austin',
        mailing_state: 'TX',
        member_number: ANCHOR.member_number,
        contact_status: ANCHOR.status,
        product: ANCHOR.product,
        sharing_entity: ANCHOR.sharing_entity,
        sharing_effective_date: ANCHOR.sharing_effective_date,
        health_insurance_plan_name: 'Walker Bronze HMO 5000',
        health_insurance_start_date: '2026-09-01',
        producer_name: ANCHOR.producer_name,
        producer_record_id: advisorId,
        referring_member: 'Mia Member',
      },
      { status: ANCHOR.status },
    ),
  );

  // pending lane — Pat is the oldest
  PENDING.forEach((p, i) => {
    recs.push(
      base(
        contacts,
        `contact:pending:${p.first.toLowerCase()}`,
        daysAgo(p.days, i),
        {
          first_name: p.first,
          last_name: p.last,
          phone: p.phone,
          email: `${p.first.toLowerCase()}.pending@example.invalid`,
          mailing_city: 'Dallas',
          mailing_state: 'TX',
          contact_status: PENDING_STATUS,
          product: 'Sedera Access+',
          sharing_entity: 'Sedera',
          sharing_effective_date: '2026-10-01',
          producer_name: ANCHOR.producer_name,
          producer_record_id: advisorId,
        },
        { status: PENDING_STATUS },
      ),
    );
  });

  // filler so the list pages at 25/page
  for (let i = 0; i < FILLER_COUNT; i++) {
    const first = FILLER_FIRST[i % FILLER_FIRST.length];
    const last = FILLER_LAST[(i * 7) % FILLER_LAST.length];
    const status = FILLER_STATUS[i % FILLER_STATUS.length];
    recs.push(
      base(
        contacts,
        `contact:filler:${i}`,
        daysAgo(2 + (i % 9), i),
        {
          first_name: first,
          last_name: last,
          phone: `55501078${String(i).padStart(2, '0')}`,
          email: `${first}.${last}.${i}@example.invalid`.toLowerCase(),
          mailing_city: ['Austin', 'Houston', 'Plano', 'Waco'][i % 4],
          mailing_state: 'TX',
          contact_status: status,
          product: ['Sedera Access+', 'Zion Essential', 'MPB Premier'][i % 3],
          sharing_entity: ['Sedera', 'Zion Health', 'MPB'][i % 3],
          producer_name: i % 5 === 0 ? ANCHOR.producer_name : 'Other Producer',
        },
        { status },
      ),
    );
  }

  // one lead
  recs.push(
    base(
      leads,
      'lead:lee-lead',
      daysAgo(4),
      {
        first_name: 'Lee',
        last_name: 'Lead',
        phone: '5550107790',
        email: 'lee.lead@example.invalid',
        city: 'Austin',
        state: 'TX',
        lead_status: 'New',
        lead_source: 'Website',
        producer: ANCHOR.producer_name,
      },
      { status: 'New' },
    ),
  );

  // members module — a few rows so the Members list is not blank
  const memberRows = [
    { key: 'members:wendy', first: 'Wendy', last: 'Walker', num: 'WALK-0001', status: 'Active', days: 10 },
    { key: 'members:mia', first: 'Mia', last: 'Member', num: 'WALK-0002', status: 'Active', days: 30 },
    { key: 'members:pat', first: 'Pat', last: 'Pending', num: 'WALK-0003', status: 'Pending', days: 60 },
  ];
  for (const m of memberRows) {
    recs.push(
      base(
        members,
        m.key,
        daysAgo(m.days, 1),
        {
          first_name: m.first,
          last_name: m.last,
          member_number: m.num,
          contact_status: m.status,
          email: `${m.first}.${m.last}@example.invalid`.toLowerCase(),
          phone: m.key === 'members:wendy' ? ANCHOR.phone : m.key === 'members:pat' ? '5550107701' : '5550107705',
          city: 'Austin',
          advisor_name: ANCHOR.producer_name,
          referral: 'Walk referral',
        },
        { status: m.status },
      ),
    );
  }
  return { recs, advisorId };
}

async function seedRecords(modByKey, ownerId) {
  const vocab = loadVocabulary();
  const { recs } = buildRecords(modByKey, ownerId);
  const keyById = new Map([...modByKey].map(([k, v]) => [v, k]));
  // Vocabulary check BEFORE any write — the DB guard would reject these anyway,
  // but failing here keeps the run all-or-nothing for statuses.
  for (const r of recs) {
    const mk = keyById.get(r.module_id);
    const allowed = vocab.get(mk);
    if (allowed && r.status && !allowed.includes(r.status)) throw new Error(`status "${r.status}" is not in the ${mk} vocabulary (${allowed.join(', ')})`);
  }
  for (let i = 0; i < recs.length; i += 50) {
    must(await sb.from('crm_records').upsert(recs.slice(i, i + 50), { onConflict: 'id' }), 'records upsert');
  }
  // legacy note on the anchor
  const noteId = uuid5('note:wendy:legacy');
  must(
    await sb.from('crm_notes').upsert(
      {
        id: noteId,
        org_id: ORG_ID,
        organization_id: ORG_ID,
        record_id: uuid5('record:contact:wendy-walker'),
        body: 'Legacy note (imported): member called about enrollment paperwork; confirmed effective date 09/01.',
        created_by: ownerId,
        created_at: daysAgo(9),
        note_date: daysAgo(9).slice(0, 10),
      },
      { onConflict: 'id' },
    ),
    'note upsert',
  );
  const perModule = {};
  for (const r of recs) perModule[keyById.get(r.module_id)] = (perModule[keyById.get(r.module_id)] ?? 0) + 1;
  console.log(`records         ${recs.length} upserted ${JSON.stringify(perModule)} + 1 legacy note`);
}

// ---------------------------------------------------------------------------
// 5) verification (service-role reads + psql)
// ---------------------------------------------------------------------------
async function verify() {
  console.log('\n— verification —');
  const profs = must(await sb.from('profiles').select('email,crm_role,role,is_active,organization_id').in('email', WALK_USERS.map((u) => u.email)), 'profiles');
  for (const u of WALK_USERS) {
    const p = profs.find((x) => x.email === u.email);
    check(!!p && p.crm_role === u.crm_role && p.role === u.role && p.is_active && p.organization_id === ORG_ID, `profile ${u.email} crm_role=${u.crm_role} role=${u.role} active PIFH`);
  }
  const om = psql(`select count(*) from organization_members om join profiles p on p.user_id=om.user_id where om.organization_id='${ORG_ID}' and om.is_active and p.email in (${WALK_USERS.map((u) => `'${u.email}'`).join(',')})`);
  check(om === '3', `organization_members active rows for the 3 walk users = ${om}`);
  const mods = must(await sb.from('crm_modules').select('id,key').eq('org_id', ORG_ID), 'modules');
  const contactsId = mods.find((m) => m.key === 'contacts')?.id;
  const { count: total } = await sb.from('crm_records').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID).is('deleted_at', null);
  const { count: contactsCount } = await sb.from('crm_records').select('id', { count: 'exact', head: true }).eq('org_id', ORG_ID).eq('module_id', contactsId).is('deleted_at', null);
  check((total ?? 0) >= 32, `crm_records (PIFH, live) = ${total} ≥ 32`);
  check((contactsCount ?? 0) >= 32, `contacts records = ${contactsCount} ≥ 32 (pages at 25/page)`);
  const wendy = must(await sb.from('crm_records').select('phone,status,title,data').eq('id', uuid5('record:contact:wendy-walker')).maybeSingle(), 'wendy');
  check(wendy?.phone === ANCHOR.phone && wendy?.status === 'Active' && wendy?.title === 'Wendy Walker' && wendy?.data?.contact_status === 'Active', `anchor Wendy Walker phone column=${wendy?.phone} status=${wendy?.status} mirror=${wendy?.data?.contact_status} title=${wendy?.title}`);
  const phoneDup = psql(`select count(*) from crm_records where phone='${ANCHOR.phone}' and module_id='${contactsId}' and deleted_at is null`);
  check(phoneDup === '1', `phone ${ANCHOR.phone} unique among contacts (count=${phoneDup})`);
  const pend = psql(`select title||'|'||status||'|'||created_at::date from crm_records where org_id='${ORG_ID}' and module_id='${contactsId}' and status='Pending' and data->>'walk_fixture'='true' order by created_at asc`);
  const pendRows = pend.split('\n').filter(Boolean);
  check(pendRows.length >= 3 && pendRows[0].startsWith('Pat Pending|Pending'), `pending-lane contacts (oldest first): ${pendRows.join(' ; ')}`);
  const survived = psql(`select status||':'||count(*) from crm_records where org_id='${ORG_ID}' and data->>'walk_fixture'='true' group by status order by status`);
  check(/Active:\d+/.test(survived) && /Pending:\d+/.test(survived) && /New:1/.test(survived), `seeded statuses survived the vocabulary guard: ${survived.replace(/\n/g, ' ')}`);
  const lead = psql(`select count(*) from crm_records r join crm_modules m on m.id=r.module_id where m.key='leads' and r.org_id='${ORG_ID}' and r.title='Lee Lead'`);
  check(lead === '1', `lead 'Lee Lead' = ${lead}`);
  const adv = psql(`select count(*) from crm_records r join crm_modules m on m.id=r.module_id where m.key='advisors' and r.org_id='${ORG_ID}' and r.title='Wen Producer'`);
  check(adv === '1', `advisor record 'Wen Producer' = ${adv}`);
  const navSimple = must(await sb.from('crm_feature_flags').select('enabled').eq('organization_id', ORG_ID).eq('flag_key', 'crm.nav.simple').maybeSingle(), 'nav flag');
  check(navSimple?.enabled === false, `crm.nav.simple @PIFH enabled=${navSimple?.enabled} (owner decision: full shell)`);
  const v2 = must(await sb.from('crm_feature_flags').select('enabled').is('organization_id', null).eq('flag_key', 'crm.layout.v2').maybeSingle(), 'v2 flag');
  check(v2?.enabled === true, `crm.layout.v2 @global enabled=${v2?.enabled}`);
  const layoutsOk = psql(`select string_agg(m.key||':'||(select count(*) from crm_layouts l where l.module_id=m.id and l.is_default)||':'||coalesce((select count(*) from crm_layouts l, jsonb_array_elements(l.config->'sections') s where l.module_id=m.id and l.is_default and s->>'variant'='hero'),0), ' ' order by m.key) from crm_modules m where m.org_id='${ORG_ID}' and m.key in ('contacts','leads','members')`);
  check(/contacts:1:1/.test(layoutsOk) && /leads:1:1/.test(layoutsOk) && /members:1:1/.test(layoutsOk), `one default layout with a 'hero' section per person module: ${layoutsOk}`);
  const viewsOk = psql(`select string_agg(m.key||':'||(select count(*) from crm_views v where v.module_id=m.id and v.is_default), ' ' order by m.key) from crm_modules m where m.org_id='${ORG_ID}' and m.key in ('contacts','leads','members','advisors')`);
  check(/contacts:1/.test(viewsOk) && /leads:1/.test(viewsOk) && /members:1/.test(viewsOk), `one default view per person module: ${viewsOk}`);
  const note = psql(`select count(*) from crm_notes where record_id='${uuid5('record:contact:wendy-walker')}' and deleted_at is null`);
  check(note === '1', `legacy note on Wendy = ${note}`);
  const fields = psql(`select string_agg(m.key||':'||c, ' ' order by m.key) from (select module_id, count(*) c from crm_fields where org_id='${ORG_ID}' group by 1) f join crm_modules m on m.id=f.module_id`);
  console.log(`info  crm_fields per module: ${fields}`);
  // The exact path CrmLoginClient takes: anon client, password sign-in, then the
  // profile row read through RLS with crm_role not null (.single()).
  for (const u of WALK_USERS) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authErr } = await anon.auth.signInWithPassword({ email: u.email, password: u.password });
    if (authErr || !auth?.user) {
      check(false, `login ${u.email}: ${authErr?.message ?? 'no user'}`);
      continue;
    }
    const { data: prof, error: profErr } = await anon.from('profiles').select('id, crm_role, organization_id').eq('user_id', auth.user.id).not('crm_role', 'is', null).single();
    check(!profErr && prof?.crm_role === u.crm_role && prof?.organization_id === ORG_ID, `login ${u.email} → profile via RLS crm_role=${prof?.crm_role ?? profErr?.message}`);
    await anon.auth.signOut();
  }
  return failures.length === 0;
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`walk fixture → ${SUPABASE_URL} (db ${hostOf(DB_URL)}) ${VERIFY_ONLY ? '[verify-only]' : ''}`);
  if (!VERIFY_ONLY) {
    const org = must(await sb.from('organizations').select('id,slug').eq('id', ORG_ID).maybeSingle(), 'org');
    if (!org) throw new Error(`org ${ORG_ID} missing — supabase/seed.sql has not run on this local stack`);
    const profileIds = await seedUsers();
    await seedFlags();
    const modByKey = await seedModules();
    await seedFields(modByKey);
    await seedViews(modByKey);
    await seedLayouts(modByKey);
    await seedRecords(modByKey, profileIds.operator);
  }
  const ok = await verify();
  console.log(ok ? '\nwalk fixture OK' : `\nwalk fixture: ${failures.length} check(s) FAILED`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('walk fixture failed:', err.message);
  process.exit(1);
});
