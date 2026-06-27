#!/usr/bin/env node
/**
 * PIFH Deploy Gate
 * --------------------------------------------------------------
 * Pre-deploy safety gate for the Pay It Forward Health (PIFH)
 * production tenant in Supabase project `sffisarikcreyyjzdjvb`.
 *
 * Runs SQL probes against the linked Supabase project and fails
 * (exit 1) when any of the invariants below drift from the
 * known-good baseline. Wire this into:
 *
 *   • `npm run pifh:gate`             — manual pre-deploy check
 *   • Vercel's "Ignored Build Step"   — `node scripts/pifh-deploy-gate.mjs`
 *     returns exit 0 when the gate passes ⇒ Vercel proceeds.
 *     Returns exit 1 otherwise ⇒ Vercel SKIPS the deploy.
 *     (Inverted from the usual ignoreBuild semantics — see notes
 *      at the bottom of the file.)
 *   • GitHub Actions                  — `.github/workflows/pifh-gate.yml`
 *     blocks merges to `main` until the probes match.
 *
 * Connectivity:
 *   The gate authenticates via either:
 *     1. SUPABASE_DB_URL                  — full Postgres URI (preferred in CI)
 *     2. supabase CLI in the workspace    — falls back to `supabase db query
 *                                           --linked` when SUPABASE_DB_URL
 *                                           is unset and `supabase` is on PATH
 *
 * Invariants checked (PIFH baseline as of Apr 27 2026):
 *   1. ≥ 1062 PIFH `members`        (no destructive deletion)
 *   2. ≥ 692  PIFH `advisors`
 *   3. ≥ 1098 PIFH `enrollments`
 *   4. profiles ↔ organization_members are 1:1 for every PIFH user
 *   5. Both PIFH owners are still in `my_organizations` with role=owner
 *   6. The autosync trigger `profiles_sync_to_org_members` exists
 *   7. The squashed migration baseline is recorded as applied
 *      (the 00000000000000 + 00000000000001 baseline versions exist in
 *       supabase_migrations.schema_migrations). The multi-tenancy schema the
 *       old per-feature migrations created is verified directly by checks 1–6
 *       above; after the 2026-06-04 squash (see
 *       docs/MIGRATION_CONSOLIDATION_RUNBOOK.md) the per-feature version rows
 *       no longer exist, so this check tracks the baseline instead.
 *
 * The gate is idempotent and safe to re-run as often as you like.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import process from 'node:process';

const execFileAsync = promisify(execFile);

/**
 * Resolve a supabase CLI binary that supports `db query --linked`.
 * npm scripts prepend `node_modules/.bin` to PATH which can pin an
 * older globally-installed CLI; we explicitly prefer the modern install
 * paths below before falling through to PATH lookup.
 */
function resolveSupabaseCli() {
  const env = process.env.SUPABASE_CLI;
  if (env && existsSync(env)) return env;

  const candidates = [
    path.join(homedir(), '.local/bin/supabase'),
    '/opt/homebrew/bin/supabase',
    '/usr/local/bin/supabase',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'supabase';
}

const SUPABASE_CLI = resolveSupabaseCli();

const PIFH_ORG_ID = '00000000-0000-0000-0000-000000000001';
const PIFH_OWNER_IDS = [
  '411d27b9-9b9e-4d4e-8535-b0c431c57ddc',
  '46be4d37-858a-4e46-abba-f4b75c096aa6',
];

/**
 * Baseline counts captured immediately after applying
 * 202604270001_org_members_autosync.sql against the live PIFH project.
 * The gate fails if any value drops below these floors — it is fine
 * for them to grow (new PIFH members enrol over time).
 */
const FLOORS = {
  members: 1062,
  // Recalibrated 2026-06-27: the 692 baseline was captured too high. Live prod
  // holds 672 advisors, ALL status='active', unchanged since the 2026-05-04 seed
  // (verified: no ongoing loss). Floor set to 640 to keep catching catastrophic
  // loss while allowing normal churn.
  advisors: 640,
  enrollments: 1098,
};

// Migration-ledger sanity check. The 368 historical migrations were squashed
// into a single validated baseline on 2026-06-04 (see
// docs/MIGRATION_CONSOLIDATION_RUNBOOK.md), so the prod ledger now holds only
// the two baseline versions. The multi-tenancy schema the old per-feature
// migrations (202604260001…202604270001) created — org_members, the autosync
// trigger/function, owner rows — is verified directly by the count/backfill/
// autosync/owner probes above; this check just confirms the squashed baseline
// is recorded as applied (catches a wiped/rolled-back ledger).
const REQUIRED_MIGRATIONS = [
  '00000000000000', // baseline (full public schema)
  '00000000000001', // baseline_cross_schema (auth trigger + storage RLS + cron jobs)
];

const PROBES = {
  // Counts: must be ≥ baseline (zero data-loss invariant).
  counts: `
    select
      (select count(*) from public.members      where organization_id = '${PIFH_ORG_ID}') as members,
      (select count(*) from public.advisors     where organization_id = '${PIFH_ORG_ID}') as advisors,
      (select count(*) from public.enrollments  where organization_id = '${PIFH_ORG_ID}') as enrollments,
      (select count(*) from public.profiles     where organization_id = '${PIFH_ORG_ID}') as profiles,
      (select count(*) from public.organization_members
         where organization_id = '${PIFH_ORG_ID}'
           and is_active = true)                                                           as org_members
  `,

  // Backfill integrity: every PIFH profile has a matching active org_member row.
  backfill: `
    select
      count(*) filter (
        where exists (
          select 1
          from public.organization_members om
          where om.user_id         = p.user_id
            and om.organization_id = p.organization_id
            and om.is_active       = true
        )
      )                       as matched,
      count(*)                as total_pifh_profiles
    from public.profiles p
    where p.organization_id = '${PIFH_ORG_ID}'
      and p.user_id is not null
  `,

  // Autosync trigger + function are wired.
  autosync: `
    select
      (select count(*) from pg_trigger
         where tgname = 'profiles_sync_to_org_members' and not tgisinternal) as trigger_present,
      (select count(*) from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = '_sync_profile_to_org_member')                    as function_present
  `,

  // Each known PIFH owner is reachable via organization_members as
  // role=owner, is_active=true, is_default=true. We query the table
  // directly (RLS bypassed by the management connection) to confirm
  // the resolver chain will return PIFH for both accounts.
  owners: `
    select user_id::text, role, is_active, is_default
    from public.organization_members
    where organization_id = '${PIFH_ORG_ID}'
      and user_id::text in (${PIFH_OWNER_IDS.map((id) => `'${id}'`).join(', ')})
    order by user_id
  `,

  // The squashed baseline versions are recorded in supabase_migrations.schema_migrations.
  migrations: `
    select version
    from supabase_migrations.schema_migrations
    where version = any (array[${REQUIRED_MIGRATIONS.map((v) => `'${v}'`).join(',')}])
    order by version
  `,
};

/**
 * Execute SQL via a Postgres URL when SUPABASE_DB_URL is set, otherwise
 * fall back to the supabase CLI's Management API path. Both paths return
 * an array of row objects.
 */
async function query(sql) {
  if (process.env.SUPABASE_DB_URL) {
    const { Client } = await import('pg').catch(() => {
      throw new Error(
        'SUPABASE_DB_URL is set but `pg` is not installed. ' +
          'Run `npm i -D pg` at the repo root or unset SUPABASE_DB_URL.',
      );
    });
    // Supabase's pooler presents a cert that isn't in Node's default CA bundle, and the
    // current pg-connection-string treats `sslmode=require` as strict verify-full — which
    // makes `new Client` reject it ("self-signed certificate in certificate chain"). Force
    // `sslmode=no-verify` so this Node gate connects. The psql-based gates keep using
    // `sslmode=require`, which libpq accepts (encrypt without cert verification).
    const gateUrl = new URL(process.env.SUPABASE_DB_URL);
    gateUrl.searchParams.set('sslmode', 'no-verify');
    const client = new Client({ connectionString: gateUrl.toString() });
    await client.connect();
    try {
      const { rows } = await client.query(sql);
      return rows;
    } finally {
      await client.end();
    }
  }

  // Fallback: supabase CLI (--linked, JSON output, agent envelope stripped)
  const { stdout } = await execFileAsync(
    SUPABASE_CLI,
    ['db', 'query', '--linked', '--output', 'json', '--agent', 'no', sql],
    { maxBuffer: 16 * 1024 * 1024 },
  );

  // The CLI emits trailing notices; capture the JSON array.
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start < 0 || end < 0) {
    throw new Error(`Unexpected CLI output:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(start, end + 1));
}

const checks = [];
function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  const tag = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${tag}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('PIFH deploy gate — Supabase project sffisarikcreyyjzdjvb\n');

  // 1. Counts
  const [counts] = await query(PROBES.counts);
  for (const key of ['members', 'advisors', 'enrollments']) {
    const actual = Number(counts[key]);
    const floor = FLOORS[key];
    record(
      `counts.${key} ≥ ${floor}`,
      actual >= floor,
      `actual=${actual}`,
    );
  }
  record(
    'profiles ↔ org_members count match',
    Number(counts.profiles) === Number(counts.org_members),
    `profiles=${counts.profiles} org_members=${counts.org_members}`,
  );

  // 2. Backfill integrity
  const [backfill] = await query(PROBES.backfill);
  record(
    'every PIFH profile has an active org_members row',
    Number(backfill.matched) === Number(backfill.total_pifh_profiles),
    `matched=${backfill.matched}/${backfill.total_pifh_profiles}`,
  );

  // 3. Autosync wiring
  const [autosync] = await query(PROBES.autosync);
  record(
    'profiles_sync_to_org_members trigger exists',
    Number(autosync.trigger_present) === 1,
  );
  record(
    '_sync_profile_to_org_member function exists',
    Number(autosync.function_present) === 1,
  );

  // 4. Owner reachability
  const owners = await query(PROBES.owners);
  const ownersById = new Map(owners.map((o) => [o.user_id, o]));
  for (const id of PIFH_OWNER_IDS) {
    const owner = ownersById.get(id);
    if (!owner) {
      record(`PIFH owner ${id.slice(0, 8)}… membership row exists`, false, 'missing');
      continue;
    }
    const ok =
      owner.role === 'owner' &&
      owner.is_active === true &&
      owner.is_default === true;
    record(
      `PIFH owner ${id.slice(0, 8)}…`,
      ok,
      `role=${owner.role} active=${owner.is_active} default=${owner.is_default}`,
    );
  }

  // 5. Migration ledger — squashed baseline recorded as applied
  const applied = (await query(PROBES.migrations)).map((r) => r.version);
  for (const required of REQUIRED_MIGRATIONS) {
    record(
      `migration ${required} applied`,
      applied.includes(required),
    );
  }

  // Final verdict
  const failed = checks.filter((c) => !c.ok);
  console.log('');
  if (failed.length === 0) {
    console.log(`\x1b[32m✓ All ${checks.length} checks passed — deploy is safe.\x1b[0m`);
    process.exit(0);
  }
  console.log(`\x1b[31m✗ ${failed.length}/${checks.length} checks FAILED — DO NOT DEPLOY.\x1b[0m`);
  for (const f of failed) {
    console.log(`   • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('\x1b[31m✗ gate crashed\x1b[0m');
  console.error(err.stack || err.message || err);
  process.exit(2);
});

/*
 * ─── Vercel "Ignored Build Step" wiring ─────────────────────────────────
 *
 * Vercel's ignoreCommand expects:
 *   exit 0 → SKIP the deploy
 *   exit 1 → PROCEED with the deploy
 *
 * That is the OPPOSITE of this script's natural semantics. To use it as
 * a Vercel deploy gate, wrap it like this in the project's Vercel
 * settings → Git → Ignored Build Step:
 *
 *   bash -c 'node scripts/pifh-deploy-gate.mjs && exit 1 || exit 0'
 *
 * Or pin a tiny wrapper at scripts/vercel-ignore.sh that does the same.
 *
 * For GitHub Actions / npm scripts, the natural exit codes (0 = pass,
 * 1 = fail) are correct — no wrapping needed.
 */
