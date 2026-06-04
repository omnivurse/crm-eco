# Migration Consolidation Runbook (Squash 368 → 1 Baseline)

> **Status:** ✅ COMPLETE — PR #23 merged to `main` 2026-06-04 14:49 UTC (merge commit `08ce538`).
> Baseline + companion are the only two migrations in the repo; prod ledger reconciled to match
> (now exactly 2 rows). The first Preview run caught two issues (see §10): a replay blocker
> (`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`, stripped) and a cross-schema gap (auth
> trigger / storage policies / cron jobs missing from a `--schema=public` dump), fixed by adding
> companion migration `00000000000001_baseline_cross_schema.sql` (built from LIVE prod).
> **Post-merge correction (see §11):** the *additive* ledger (368 history rows + 2 baselines = 370)
> made the manual `supabase db push` guard AND the Supabase GitHub **deploy Migrate step** fail with
> *"Remote migration versions not found in local migrations directory."* The fix was the canonical
> squash completion — **delete the 368 remote-only ledger rows** (keep the 2 baselines). After that,
> `supabase db push --dry-run` → *"Remote database is up to date."* (exit 0). Reversible from
> `.backups/baseline/ledger_pre_reconcile_*.txt`.
> **Author:** DB consolidation audit, 2026-06-03 (updated 2026-06-04).
> **Live production project:** `sffisarikcreyyjzdjvb` ("PIF-ECO-V2", org `khhfyzojnmmjplgeroug`).
> **Staging project:** `cammurefjywnzxnmuyfv` ("crm-eco-staging", org `bmfqoyiitfeiiqzobeou`) —
> *different org, NOT reachable by the Supabase MCP token (which sees only the prod org). Staging
> ledger reconciliation is a follow-up; see §7.3.*
> **Golden rule for this work:** zero data loss, zero drift, nothing breaks. Read-only discovery →
> design additive/reversible → rehearse (rolled-back) → validate on a non-prod replica →
> cut over → verify → keep a one-command rollback ready. **No production write happens without
> explicit human approval at the gate in Phase 4.**

---

## 0. TL;DR

We have **368 migrations** that are **100% applied and in-sync** with production (zero drift, zero
duplicate prefixes). The problem is *volume*, not correctness. We will replace the 368 historical
files with **a schema baseline + a small companion migration** generated from the live database,
archive the originals, and reconcile the migration ledger so it contains **exactly the two baseline
rows** (`00000000000000` baseline + `00000000000001` companion). The companion restores the app's
non-`public` objects (auth signup trigger, storage RLS policies, cron jobs) that a `--schema=public`
dump can't capture. No tables are dropped (see §2.2 — there are no provably-dead tables). No data is
touched.

> **⚠️ Ledger reconciliation — what actually worked (corrected 2026-06-04, see §11):** the original
> plan kept all 368 history rows and *added* the 2 baselines (370 total, "Option A — additive").
> **That left both `supabase db push` and the Supabase deploy Migrate step failing** the remote-ahead
> guard (*"Remote migration versions not found in local migrations directory"*). The working end-state
> is the **canonical** one: ledger == repo == the 2 baseline rows only. We got there by first
> inserting the 2 baselines (Phase 4) and then **deleting the 368 now-archived versions** (Phase 4b)
> once the merge proved the additive state breaks the deploy.

> **Extensions note (2026-06-04):** the baseline is `pg_dump --schema=public`, which omits
> `CREATE EXTENSION`. One extension is a hard replay dependency — **`pg_trgm` in schema `public`**
> (8 indexes use `public.gin_trgm_ops`). The baseline therefore prepends an idempotent
> `CREATE EXTENSION IF NOT EXISTS` block (pg_trgm + btree_gin in `public`; pgcrypto + uuid-ossp in
> `extensions`). `pg_cron`/`hypopg`/`vector` are intentionally omitted — no public object depends on
> them at DDL time (function-body refs are safe because the dump sets `check_function_bodies=false`).

The production writes in the entire procedure are confined to the
`supabase_migrations.schema_migrations` bookkeeping table — **no app schema or data is touched**:
(1) an additive `INSERT` of the 2 baseline rows (Phase 4), then (2) a guarded `DELETE` of the 368
now-archived versions to reconcile the ledger to the repo (Phase 4b). Both were rehearsed
rolled-back first, run inside a single transaction with abort-on-divergence guards, and are
reversible from the captured ledger snapshots in `.backups/baseline/`.

---

## 1. Why (discovery evidence, verified 2026-06-03)

All figures captured live from `sffisarikcreyyjzdjvb` (read-only):

| Metric | Value |
|---|---|
| Applied migrations (`schema_migrations`) | **366** (`202512290000` → `202606010006`) |
| Repo migration files | **366** — exact match, **0 drift, 0 duplicate prefixes** |
| One-off "fix/heal/backfill/reload/recover" migrations | **67 (18%)** |
| Migrations created in March 2026 alone | **130** |
| Public tables | 484 (97 populated, **387 empty**) |
| Functions / RLS policies / triggers / enums | 552 / 1,307 / 724 / 35 |
| Core data | `crm_records` 17,446 · `members` 1,062 · `advisors` 693 · `enrollments` 1,098 |

**Canonical wiring (the "correct tables"):** `crm_records` is the hub. Contacts and leads are
`module_id` variants *inside* `crm_records` (the standalone `leads` table is legacy/empty; there is
no `contacts` table). `crm_records` uses **`org_id`**, not `organization_id`.

**Why squash and not delete/rewrite:** because repo == ledger with zero drift, a baseline is a
safe, standard consolidation. New environments build from `baseline + future migrations`; prod is
untouched because every historical version stays marked applied.

---

## 2. Decisions (locked)

### 2.1 Squash strategy — **Option A (additive)**
- Baseline file: `supabase/migrations/00000000000000_baseline.sql`.
- Reconcile prod + staging ledgers with **one additive INSERT** of version `00000000000000`.
- **Keep** the 366 historical ledger rows (no `DELETE`). This is the lowest-risk option; the only
  cosmetic cost is that `supabase migration list` shows 366 "remote-only" entries, which we accept
  and note in the audit baseline.

### 2.2 Table drops — **NONE**
We tested every empty table (387) for: empty **and** no inbound FK **and** not referenced by any
function/view/trigger → 79 candidates. We then cross-checked all 79 against the app code **and**
edge functions:

> **0 of 79 were dead. All 79 are referenced in code/edge functions** — they are built, wired
> features awaiting data (ticketing, `enrollment_contracts`, NACHA, webhooks, RBAC history, etc.).

**Conclusion: do not drop tables.** Dropping any would break a referenced code path. Retiring whole
*features* is a separate product decision, out of scope for this DB-hygiene runbook.

### 2.3 Project link
Every existing runbook assumes prod (`sffisarikcreyyjzdjvb`) is the linked CLI project, but on
2026-05-29 the CLI was re-linked to `crm-eco-staging`. Decision: **staging is real → consolidate
both consistently.** After the squash, confirm the intended default link and update
`docs/PIFH_DEPLOY_SAFETY.md` step 1 and `docs/_clean/supabase/pipeline/README.md` step 0 to match
reality.

---

## 3. Pre-flight safety (DONE / re-run before execution)

1. **Backups exist.** Confirm Supabase managed backups / PITR are enabled on **both** projects
   (Dashboard → Database → Backups). This procedure does not touch data, but never proceed without
   a restore point.
2. **Restore reference captured** (read-only, already done):
   - `.backups/baseline/prod_public_schema_<ts>.sql` — full `public` schema dump (~93k lines).
   - `.backups/baseline/applied_ledger_<ts>.txt` — the 366 applied versions.
   - `.backups/` is gitignored (schema structure stays out of git).
3. **Tooling:** `psql`/`pg_dump` v18 present. **Docker is NOT available**, so
   `supabase db dump|reset|squash` (shadow-DB flows) are unavailable — we use native `pg_dump` +
   `psql` and validate on a remote replica instead of locally.

Connection strings are read from env, never hard-coded:
```bash
# Production (read for discovery; the Phase-4 write requires approval)
export PROD_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.sffisarikcreyyjzdjvb.supabase.co:5432/postgres?sslmode=require"
# (SUPABASE_DB_PASSWORD comes from .env — do not echo it)
```

---

## 4. Phase 1 — Build & massage the baseline (repo-only, reversible)

The raw `pg_dump` is schema-correct but not directly replayable on a Supabase target. Massage it:

```bash
SRC=$(ls -t .backups/baseline/prod_public_schema_*.sql | head -1)
OUT="supabase/migrations/00000000000000_baseline.sql"   # do NOT move into place until Phase 3

# 1. Strip pg18 psql directives that older runners choke on
# 2. Make the schema create idempotent (public already exists on Supabase)
sed -E \
  -e '/^\\restrict /d' \
  -e '/^\\unrestrict /d' \
  -e 's/^CREATE SCHEMA public;/CREATE SCHEMA IF NOT EXISTS public;/' \
  "$SRC" > /tmp/baseline.massaged.sql

# 3. Prepend a header banner
{
  echo "-- Squashed baseline — full public schema of prod (sffisarikcreyyjzdjvb) as of <ts>."
  echo "-- Replaces 368 historical migrations (archived in supabase/migrations_archive/)."
  echo "-- See docs/MIGRATION_CONSOLIDATION_RUNBOOK.md. Generated via pg_dump --schema=public --schema-only."
  echo ""
  cat /tmp/baseline.massaged.sql
} > /tmp/00000000000000_baseline.sql

# 4. Insert the extension bootstrap right after `CREATE SCHEMA IF NOT EXISTS public;`
#    (pg_dump --schema=public omits CREATE EXTENSION; pg_trgm is a HARD replay dependency).
#    Idempotent; schemas match prod (pg_trgm/btree_gin live in public on this project).
awk '
  { print }
  /^CREATE SCHEMA IF NOT EXISTS public;$/ && !d {
    print "\nCREATE EXTENSION IF NOT EXISTS pg_trgm     WITH SCHEMA public;"
    print "CREATE EXTENSION IF NOT EXISTS btree_gin   WITH SCHEMA public;"
    print "CREATE EXTENSION IF NOT EXISTS pgcrypto    WITH SCHEMA extensions;"
    print "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA extensions;"; d=1
  }' /tmp/00000000000000_baseline.sql > /tmp/b.tmp && mv /tmp/b.tmp /tmp/00000000000000_baseline.sql
```

**Sanity checks before trusting it** (expected values verified against the 2026-06-03 dump):
```bash
grep -c 'CREATE TABLE'    /tmp/00000000000000_baseline.sql   # expect ~486 (incl. partitions)
grep -c 'CREATE POLICY'   /tmp/00000000000000_baseline.sql   # expect 1307
grep -c 'CREATE FUNCTION' /tmp/00000000000000_baseline.sql   # expect ~433 (pg_dump emits CREATE FUNCTION only for prokind='f'; the DB's 552 pg_proc entries also include aggregates/procedures)
grep -c 'CREATE TRIGGER'  /tmp/00000000000000_baseline.sql   # expect ~519
grep -c 'CREATE TYPE'     /tmp/00000000000000_baseline.sql   # expect 35 (enums)
grep -c 'CREATE SCHEMA public;' /tmp/00000000000000_baseline.sql  # expect 0 after massage (was 1; now IF NOT EXISTS)
```

> Do not place the file into `supabase/migrations/` yet — an unapplied `00000000000000` baseline in
> the push path would try to run against prod. It moves into place only in Phase 3, paired with the
> ledger reconciliation.

---

## 5. Phase 2 — Validate the baseline rebuilds the schema (NON-PROD)

Goal: prove the baseline recreates the schema **bit-for-bit** on an empty Supabase-compatible DB.

### Path 0 — PR Supabase Preview check (CHOSEN 2026-06-04; zero cost, zero creds)
This repo has the Supabase GitHub integration enabled (PRs get a **"Supabase Preview"** check that
provisions a fresh branch DB and applies the `supabase/migrations/` dir). After the Phase-3 cutover
that dir contains **only the baseline**, so the Preview check *is* the fresh-env replay validation —
in the real target environment, for free. **Gate everything on this check being green.** If it
fails, fix the baseline (most likely a missing `CREATE EXTENSION`) on the branch and re-push; prod
is never touched. A 2.9 MB baseline can't go through the MCP `execute_sql`/`apply_migration` payload
limit, which is why we use the CI preview rather than an MCP replay. Paths A–C below remain as
manual fallbacks.

### Path A — Supabase preview branch (manual fallback; no creds to wire)
A branch is an ephemeral DB seeded with Supabase scaffolding (auth/extensions/roles), so the
baseline's `auth.uid()` etc. resolve.
```bash
# CLI is logged into the staging org already. Branching is a paid feature (~$/hr while alive).
supabase branches create baseline-validate --project-ref cammurefjywnzxnmuyfv
supabase branches get   baseline-validate --project-ref cammurefjywnzxnmuyfv -o env > /tmp/branch.env
# Use the branch's POSTGRES URL:
export VALIDATE_DB_URL="<branch postgres url from /tmp/branch.env>"
# ...replay + compare (below)...
supabase branches delete baseline-validate --project-ref cammurefjywnzxnmuyfv   # tear down when done
```
> Alternatively create the branch from the Dashboard, or via the Supabase MCP `create_branch` tool.
> **Correction (2026-06-04):** the Supabase MCP token is authenticated to the **prod** org
> (`khhfyzojnmmjplgeroug`, sole project `sffisarikcreyyjzdjvb`), **not** staging. A branch created
> via MCP would therefore branch *prod*; it also costs $/hr (`get_cost` → `confirm_cost`).

### Path B — Throwaway Supabase project (free tier)
Create a new empty project, then:
```bash
export VALIDATE_DB_URL="postgresql://postgres:<throwaway_pw>@db.<throwaway_ref>.supabase.co:5432/postgres?sslmode=require"
```

### Path C — Staging, into an isolated scratch schema
Only if staging is truly disposable. Requires `STAGING_SUPABASE_DB_URL` in `.env.local` (gitignored):
```
STAGING_SUPABASE_DB_URL=postgresql://postgres.cammurefjywnzxnmuyfv:<STAGING_DB_PASSWORD>@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```
> Replaying into `public` on staging assumes staging's `public` is empty/disposable. If staging
> already holds a schema, prefer Path A/B to avoid touching it.

### Replay + compare (same for any path)
```bash
psql "$VALIDATE_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/00000000000000_baseline.sql 2>&1 | tee /tmp/replay.log

# Object-count parity vs production (run the same query against PROD_DB_URL and VALIDATE_DB_URL):
psql "$VALIDATE_DB_URL" -X -A -F',' -f .audit/scripts/object_counts.sql   # see Appendix A
psql "$PROD_DB_URL"     -X -A -F',' -f .audit/scripts/object_counts.sql
```
**Pass criteria:** replay exits 0 with no errors, and tables/functions/policies/triggers/indexes
counts match prod (±0). Capture both outputs in the PR. **If anything fails, STOP** — fix the
massage step and re-validate. Do not proceed to Phase 3.

---

## 6. Phase 3 — Repo cutover (reversible via git)

Do this on a dedicated branch; **commit so the moves are isolated** from unrelated WIP.

> ✅ **As of 2026-06-04 there are NO pending migrations** — repo (368 files) == prod ledger (368).
> The two 2026-06-03 migrations are now applied, so **all 368 are archived** and only the baseline
> remains. The loop is ledger-driven (archives only versions present in the captured ledger); a
> straggler check after the move must show an empty `supabase/migrations/` before the baseline is
> dropped in. If a future run *does* have pending migrations, they must **stay** in
> `supabase/migrations/` so they apply on top of the baseline (timestamps sort after `00000000000000`).

```bash
git checkout -b chore/squash-migrations
LEDGER=$(ls -t .backups/baseline/applied_ledger_*.txt | head -1)   # the 368 applied versions
mkdir -p supabase/migrations_archive

# Archive exactly the applied versions; leave pending/un-applied migrations in place.
while IFS= read -r ver; do
  [ -z "$ver" ] && continue
  git mv "supabase/migrations/${ver}_"*.sql supabase/migrations_archive/ 2>/dev/null || \
    echo "WARN: no file for applied version $ver (already archived or named differently)"
done < "$LEDGER"

cp /tmp/00000000000000_baseline.sql supabase/migrations/00000000000000_baseline.sql

echo "=== Remaining in supabase/migrations/ (baseline + any pending) ==="
ls supabase/migrations/        # expect: 00000000000000_baseline.sql + un-applied migrations only

git add -A supabase/migrations supabase/migrations_archive .gitignore docs/MIGRATION_CONSOLIDATION_RUNBOOK.md .audit/scripts/object_counts.sql
git commit -m "chore(db): squash applied migrations into a single validated baseline"
```
At this point the repo is consolidated but **no DB has been touched**. `supabase db push` must NOT
be run until Phase 4 marks the baseline applied — otherwise it would try to execute the baseline
against a DB that already has everything. (Once the baseline is marked applied, `db push` will
correctly apply only the pending `2026...` migrations.)

---

## 7. Phase 4 — Ledger reconciliation (⚠️ PRODUCTION WRITE — APPROVAL GATE)

> **PROD WRITE RISK: YES** — single additive metadata row, no data/schema change. Reversible.
> **Rehearsed result (2026-06-03):** `before=366 → INSERT 0 1 → 367 → ROLLBACK → 366`.
> Re-rehearse on the current ledger before committing; expected `before=368 → 369 → ROLLBACK → 368`.

> **⚠️ Ordering — ledger write BEFORE merge.** Write the baseline row to the prod ledger *before*
> merging the PR. The Supabase GitHub integration *may* deploy migrations to prod on merge to `main`;
> with `00000000000000` already in the ledger, that deploy is a guaranteed no-op (and a manual
> `supabase db push` is too). If the row were missing at merge time, an auto-deploy could try to
> *run* the baseline against prod (which already has every object) and error. Safe sequence:
> Preview check green → rehearse → **approval gate** → INSERT row on prod → merge.

### 7.1 Rehearse first (safe — rolled back)
```sql
BEGIN;
SELECT count(*) AS before_count FROM supabase_migrations.schema_migrations;  -- expect 368
INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES
  ('00000000000000','baseline'),
  ('00000000000001','baseline_cross_schema')
ON CONFLICT (version) DO NOTHING;
SELECT count(*) AS after_insert FROM supabase_migrations.schema_migrations;  -- before+2 = 370
ROLLBACK;
SELECT count(*) AS after_rollback FROM supabase_migrations.schema_migrations; -- == before (368)
```

### 7.2 Commit (only after explicit approval)
```sql
BEGIN;
INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES
  ('00000000000000','baseline'),
  ('00000000000001','baseline_cross_schema')
ON CONFLICT (version) DO NOTHING;
SELECT count(*) FILTER (WHERE version IN ('00000000000000','00000000000001')) AS baseline_rows,
       count(*) AS total
FROM supabase_migrations.schema_migrations;
-- verify baseline_rows = 2, total = 370, THEN:
COMMIT;
```
Run against `PROD_DB_URL`. **Blast-radius guard:** expect exactly 2 rows inserted; if `total`
diverges from `prior + 2` (i.e. ≠ 370), `ROLLBACK` and investigate.

### 7.3 Staging — follow-up (not blocking)
Staging (`cammurefjywnzxnmuyfv`) is in a different org and unreachable by the Supabase MCP token; its
DB creds are not wired here. It is also where the CLI is currently linked (§2.3), so a stray
`supabase db push` against staging post-cutover would try to *run* the baseline there. Follow-ups:
(1) add the same `00000000000000` ledger row to staging once creds are available, **or** (2) re-link
the CLI to prod and treat staging as disposable. Until then, **do not run `supabase db push` while
linked to staging.**

---

## 8. Phase 5 — Verification (prove it, don't claim it)

```bash
# 1. push is a clean no-op (no migration attempts)
supabase db push --dry-run            # after linking to the target; expect "remote is up to date"

# 2. data untouched — counts unchanged
psql "$PROD_DB_URL" -X -c "select
  (select count(*) from crm_records) crm_records,
  (select count(*) from members)     members,
  (select count(*) from advisors)    advisors,
  (select count(*) from enrollments) enrollments;"
# Expect: 17446 / 1062 / 693 / 1098 (±live churn)

# 3. fresh-env rebuild works (on the validation branch/project from Phase 2):
#    db reset / replay baseline → object counts match prod (already proven in Phase 2)

# 4. re-run the Hawkeye audit; accept the new "remote-only versions" as a known baseline finding
PIFH_SUPABASE_DB_URL="$PROD_DB_URL" bash .audit/scripts/refresh-schema.sh
node .audit/scripts/inventory.mjs && node .audit/scripts/crossref.mjs
```
**Watch window:** monitor app error rates / Supabase logs for the first 30 min after the ledger
commit. Pre-declared rollback trigger: any spike in `PGRST`/migration errors, or `db push`
attempting to run the baseline.

---

## 9. Rollback

Fully reversible at every stage:

- **Phase 3 (repo):** `git checkout main && git branch -D chore/squash-migrations` — restores all 366
  files. Nothing else needed (no DB change yet).
- **Phase 4 (ledger):** remove the one added row:
  ```sql
  DELETE FROM supabase_migrations.schema_migrations WHERE version='00000000000000';
  ```
  The 366 history rows were never removed, so the ledger returns to its exact prior state. Restore
  reference: `.backups/baseline/applied_ledger_<ts>.txt`.
- **Worst case (schema concern):** the captured `.backups/baseline/prod_public_schema_<ts>.sql` +
  Supabase PITR are the recovery path. No DDL/DML is run against prod in this procedure, so this
  should never be needed.

---

## 10. Validation findings (PR #23 Supabase Preview, 2026-06-04)

The first fresh-branch replay **failed fast (33s)** and proved the gate's value before any prod write:

1. **Replay blocker — `permission denied to change default privileges` (SQLSTATE 42501).** The
   `pg_dump` tail emits 24 `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin|postgres IN SCHEMA
   public …` statements; a non-superuser migration role can't run them. *Everything before them
   replayed cleanly* (the error was at statement #10650, the very end), confirming the 486 tables /
   433 functions / 1307 policies / 2870 grants / `pg_trgm` all build. **Fix:** strip the 24 lines
   (Supabase pre-configures public-schema default privileges on every fresh project/branch).
2. **Cross-schema gap (Codex P1 + design review).** `--schema=public` omits app objects in other
   schemas: the `on_auth_user_created` trigger on `auth.users`, **27** `storage.objects` RLS
   policies, and **7** `cron.job` schedules. **Fix:** companion migration
   `00000000000001_baseline_cross_schema.sql`, generated from **live prod** (not migration history),
   idempotent + guarded (`SET search_path=public` for unqualified refs; cron wrapped in a
   `pg_cron`-existence check so a branch without it skips cleanly instead of failing).

Neither issue touched prod — prod already has every object; the baseline is never run against it.

## 11. Post-merge finding — additive ledger breaks the deploy (corrected to canonical squash)

**What happened.** After the Phase-4 *additive* ledger write (368 history rows + 2 baselines = 370)
and the PR #23 merge to `main`, the Supabase GitHub **production deploy** ran its DAG
(Clone → Pull → Health → Configure → **Migrate** → Seed → Deploy) and **failed at Migrate**:

```
2026/06/04 14:49:51  Remote migration versions not found in local migrations directory.
```

Branch status went `MIGRATIONS_FAILED`; the "Supabase Preview" check on the merge commit reported
`failure`. **Prod DB stayed 100% healthy** — the guard fires *before* any apply, so nothing ran;
ledger was still 370 and all data counts unchanged. (Vercel × 4 and all GitHub Actions were green.)

**Root cause.** Both the local CLI `supabase db push` *and* the platform's deploy Migrate step run a
history-consistency guard that **refuses when the remote ledger contains versions absent from the
repo's `supabase/migrations/` dir**. The docs' "only applies new migrations" is true for *forward*
application, but the guard is checked first. The additive approach left 368 versions remote-only, so
the guard tripped on every deploy and would **not** self-clear (those files are permanently archived).
The same error is visible transiently in the branch-action logs on 2026-06-03 21:0x (ledger briefly
ahead of the repo before PR #21 merged) and cleared once the repo caught up — confirming the mechanism.

**Fix (canonical squash completion).** Reconcile the ledger to the repo: keep the 2 baselines, delete
the 368 now-archived versions — exactly what the CLI itself recommends
(`supabase migration repair --status reverted <versions…>`). Executed as a guarded transaction:

```sql
BEGIN;
DELETE FROM supabase_migrations.schema_migrations
 WHERE version NOT IN ('00000000000000','00000000000001');
-- guard: abort unless before=370, after=2, baselines_remaining=2
COMMIT;
```

Result: `DELETE 368`, ledger now = 2. **Verification:** `supabase db push --dry-run` →
*"Remote database is up to date."* (exit 0); data counts unchanged
(`members/advisors/enrollments` = 1062/693/1098). Rollback reference:
`.backups/baseline/ledger_pre_reconcile_20260604_105641.txt` (all 370 `version|name` rows).

**Status note.** Per operator choice, no empty re-trigger commit was pushed, so the prod branch
status remains `MIGRATIONS_FAILED` until the **next** merge to `main`, which will deploy green
(Migrate → "All migrations are up to date") now that the ledger matches the repo.

**Lesson for future squashes:** skip the additive half-step. After validating the baseline, write the
baseline row(s) **and** revert the old versions in the same change so `ledger == repo` from the start.

## Appendix A — `object_counts.sql` (parity check)
```sql
SELECT 'tables'   AS k, count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')
UNION ALL SELECT 'views',     count(*) FROM pg_views    WHERE schemaname='public'
UNION ALL SELECT 'matviews',  count(*) FROM pg_matviews WHERE schemaname='public'
UNION ALL SELECT 'functions', count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
UNION ALL SELECT 'policies',  count(*) FROM pg_policies WHERE schemaname='public'
UNION ALL SELECT 'triggers',  count(*) FROM information_schema.triggers WHERE trigger_schema='public'
UNION ALL SELECT 'indexes',   count(*) FROM pg_indexes  WHERE schemaname='public'
UNION ALL SELECT 'enums',     count(DISTINCT t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'
ORDER BY 1;
```

## Appendix B — Related docs
- `docs/audit/REMEDIATION_PLAN.md` — the Hawkeye remediation history (141 → 0 BLOCKERs).
- `docs/PIFH_DEPLOY_SAFETY.md` — deploy gate + rollback playbook (update link step post-squash).
- `.audit/scripts/refresh-schema.sh`, `inventory.mjs`, `crossref.mjs` — the audit engine.

## Appendix C — Open items before execution
- [x] **Validation path chosen** — Path 0 (PR Supabase Preview check); see §5.
- [ ] Confirm managed backups/PITR enabled on prod (Dashboard → Database → Backups).
- [x] **Pending un-applied migrations applied to prod** — done 2026-06-03 (see Execution Log).
      `202606030001` + `202606030002` are in the prod ledger (368 total); the baseline capture
      includes them and the tree is clean.
- [x] **Baseline built + cut over** — 2026-06-04 on `chore/squash-migrations` (see Execution Log).
- [ ] **Supabase Preview check green on the PR** (the fresh-env replay validation — Phase 2).
- [ ] Approve the Phase 4 production ledger write (the squash baseline row) — **before merge**.
- [ ] After squash: decide the canonical CLI link and update the two stale runbooks
      (`docs/PIFH_DEPLOY_SAFETY.md` §3 step 1, `docs/_clean/supabase/pipeline/README.md` step 0).
- [ ] Staging ledger reconciliation (§7.3) — non-blocking follow-up.

## Appendix D — Execution Log
**2026-06-03 ~20:48 UTC — applied 2 pending migrations to prod (`sffisarikcreyyjzdjvb`):**
- `202606030001_fix_contact_titles_clobbered_by_job_title` — rehearsed rolled-back (18 rows, idempotent,
  `data.title` preserved 18/18), then applied with a blast-radius guard (`abort if affected <> 18`).
  Result: `UPDATE 18`, post-verify `still_clobbered = 0`, total rows unchanged (15,379),
  reported record `71aaf7ba-…` now `title='Thomas Boyd'` (job title `Minister` preserved in `data`).
- `202606030002_add_contact_type_classification_field` — field `contact_category` already existed
  (created 19:53 UTC, exact match), so the migration body was a verified 0-row no-op; recorded in ledger.
- Ledger: 366 → **368** applied. Both versions present.
- Repo follow-up (done): the two migration files + app WIP shipped via PR #21 to `main`.

**2026-06-04 — baseline built + repo cutover (branch `chore/squash-migrations`):**
- Captured fresh prod schema (`pg_dump --schema=public --schema-only`, pg18) →
  `.backups/baseline/prod_public_schema_20260604_083115.sql` (92,890 lines, 2.9 MB) +
  ledger snapshot (368 versions). Sanity: 486 tables / 1307 policies / 433 functions, 0 data rows —
  identical to the 2026-06-03 dump (the 2 data-only migrations changed no schema).
- Massaged → `00000000000000_baseline.sql`: stripped pg18 `\restrict`/`\unrestrict`,
  `CREATE SCHEMA public;` → `IF NOT EXISTS`, header banner, and prepended the 4-line extension
  bootstrap (pg_trgm/btree_gin in `public`; pgcrypto/uuid-ossp in `extensions`). Verified
  `check_function_bodies=false` preserved (line 20) so function-body refs to `extensions.*`/`cron.*`
  don't block replay. Dependency scan confirmed **pg_trgm is the only hard DDL-time dep**
  (8 `public.gin_trgm_ops` indexes); pgvector/btree_gin/hypopg/pg_cron not required at replay.
- Cutover: archived all **368** applied migrations to `supabase/migrations_archive/` (moved=368,
  missing=0, 0 stragglers); `supabase/migrations/` now holds only the baseline.
- Pushed → **PR #23** (https://github.com/omnivurse/crm-eco/pull/23).

**2026-06-04 — PR #23 Preview validation (v1 fail → v2 fix):**
- Supabase Preview replayed the baseline on a fresh branch and **failed at the `ALTER DEFAULT
  PRIVILEGES` tail** (perm denied) — everything before it built. Codex review also flagged the
  missing `auth.users` trigger (P1). See §10.
- **v2:** stripped the 24 `ALTER DEFAULT PRIVILEGES` lines from the baseline; added companion
  `00000000000001_baseline_cross_schema.sql` (1 auth trigger + 27 storage policies + 7 cron jobs,
  captured from live prod, idempotent/guarded). Verified all companion deps (tables/functions)
  exist in the baseline. Ledger plan updated to **two** additive rows. Re-pushed for re-validation.

**2026-06-04 ~14:40 UTC — Phase 4 ledger write (additive):** guarded `INSERT` of `00000000000000`
+ `00000000000001` into the prod ledger (rehearsed rolled-back: 368→369→ROLLBACK). Result: ledger
366→368→**370**. All Hawkeye/DB-integrity/cross-ref CI re-ran green; PR #23 went CLEAN/MERGEABLE.

**2026-06-04 14:49 UTC — merged PR #23 → `main`** (merge commit `08ce538`). Vercel × 4 deployed
green; PIFH deploy gate / CRM health / Hawkeye audit all green; ephemeral preview branch
`jeslveuykewqbrtdpcnm` auto-deleted. **But** the Supabase prod deploy **Migrate step FAILED**:
*"Remote migration versions not found in local migrations directory"* (branch status
`MIGRATIONS_FAILED`; "Supabase Preview" check on merge commit = `failure`). Prod DB untouched
(ledger still 370, data intact). See §11 for root cause.

**2026-06-04 ~14:57 UTC — Phase 4b ledger reconcile (canonical squash completion, APPROVED):**
captured full snapshot → `.backups/baseline/ledger_pre_reconcile_20260604_105641.txt` (370 rows);
rehearsed rolled-back (370→DELETE 368→2→ROLLBACK→370); then guarded committed
`DELETE … WHERE version NOT IN (2 baselines)` → `DELETE 368`, ledger **370→2**. Verified:
`supabase db push --dry-run` → *"Remote database is up to date."* (exit 0); data unchanged
(crm_records 15255 [live churn — no DML run], members 1062, advisors 693, enrollments 1098).
Operator opted **not** to push an empty re-trigger commit, so prod branch status clears to green on
the next merge to `main`. **Squash COMPLETE: repo = 2 migrations, prod ledger = 2 rows, in sync.**
