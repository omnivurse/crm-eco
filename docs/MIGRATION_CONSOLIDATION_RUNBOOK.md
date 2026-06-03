# Migration Consolidation Runbook (Squash 366 → 1 Baseline)

> **Status:** DRAFT — discovery + rehearsal complete, awaiting validation env + execution approval.
> **Author:** DB consolidation audit, 2026-06-03.
> **Live production project:** `sffisarikcreyyjzdjvb` ("PIF-ECO-V2", org `khhfyzojnmmjplgeroug`).
> **Staging project:** `cammurefjywnzxnmuyfv` ("crm-eco-staging", org `bmfqoyiitfeiiqzobeou`).
> **Golden rule for this work:** zero data loss, zero drift, nothing breaks. Read-only discovery →
> design additive/reversible → rehearse (rolled-back) → validate on a non-prod replica →
> cut over → verify → keep a one-command rollback ready. **No production write happens without
> explicit human approval at the gate in Phase 4.**

---

## 0. TL;DR

We have **366 migrations** that are **100% applied and in-sync** with production (zero drift, zero
duplicate prefixes). The problem is *volume*, not correctness. We will replace the 366 historical
files with **one schema baseline** generated from the live database, archive the originals, and
make `supabase db push` a clean no-op by adding **one additive row** to the migration ledger
(Option A — keep the 366 history rows). No tables are dropped (see §2.2 — there are no
provably-dead tables). No data is touched.

The only production write in the entire procedure is a single
`INSERT ... ON CONFLICT DO NOTHING` into `supabase_migrations.schema_migrations`, already
rehearsed and rolled back successfully.

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
  echo "-- Squashed baseline — represents the full public schema as of $(date -u +%Y-%m-%dT%H:%M:%SZ)."
  echo "-- Generated from live project sffisarikcreyyjzdjvb. Historical migrations archived in"
  echo "-- supabase/migrations_archive/. See docs/MIGRATION_CONSOLIDATION_RUNBOOK.md."
  echo ""
  cat /tmp/baseline.massaged.sql
} > /tmp/00000000000000_baseline.sql
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
Pick **one** path. All are non-production.

### Path A — Supabase preview branch (preferred; no creds to wire)
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
> Alternatively create the branch from the Dashboard, or via the Supabase MCP `create_branch` tool
> (the MCP is authenticated to the staging org).

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

> ⚠️ **Archive ONLY migrations that are applied on prod** (the 366 versions in the captured
> ledger). Any **un-applied / pending** migrations — e.g. the 2026-06-03 work
> `202606030001_fix_contact_titles_clobbered_by_job_title.sql` and
> `202606030002_add_contact_type_classification_field.sql` — must **stay** in `supabase/migrations/`
> so they apply on top of the baseline. The baseline represents prod-as-captured; pending
> migrations ride on top (their timestamps sort after `00000000000000`). Confirm the pending set
> right before cutover: `comm -23 <(ls supabase/migrations | sed -E 's/_.*//' | sort -u) <(sort "$LEDGER")`.

```bash
git checkout -b chore/squash-migrations
LEDGER=$(ls -t .backups/baseline/applied_ledger_*.txt | head -1)   # the 366 applied versions
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

Apply to **prod and staging** so both treat the baseline as already applied.

### 7.1 Rehearse first (safe — rolled back)
```sql
BEGIN;
SELECT count(*) AS before_count FROM supabase_migrations.schema_migrations;
INSERT INTO supabase_migrations.schema_migrations(version, name)
VALUES ('00000000000000','baseline') ON CONFLICT (version) DO NOTHING;
SELECT count(*) AS after_insert FROM supabase_migrations.schema_migrations;  -- before+1
ROLLBACK;
SELECT count(*) AS after_rollback FROM supabase_migrations.schema_migrations; -- == before
```

### 7.2 Commit (only after explicit approval)
```sql
BEGIN;
INSERT INTO supabase_migrations.schema_migrations(version, name)
VALUES ('00000000000000','baseline') ON CONFLICT (version) DO NOTHING;
SELECT count(*) FILTER (WHERE version='00000000000000') AS baseline_present,
       count(*) AS total
FROM supabase_migrations.schema_migrations;
-- verify baseline_present = 1, total = 367, THEN:
COMMIT;
```
Run against `PROD_DB_URL`, then `STAGING_*`/`VALIDATE_DB_URL` for staging. **Blast-radius guard:**
expect exactly 1 row inserted; if `total` diverges from `prior + 1`, `ROLLBACK` and investigate.

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
- [ ] Choose validation path (A branch / B throwaway / C staging) and run Phase 2.
- [ ] Confirm managed backups/PITR enabled on prod + staging.
- [x] **Pending un-applied migrations applied to prod** — done 2026-06-03 (see Execution Log).
      `202606030001` + `202606030002` are now in the prod ledger (368 total), so the final baseline
      capture will include them and the tree is clean.
- [ ] Approve the Phase 4 production ledger write (the squash baseline row).
- [ ] After squash: decide the canonical CLI link and update the two stale runbooks
      (`docs/PIFH_DEPLOY_SAFETY.md` §3 step 1, `docs/_clean/supabase/pipeline/README.md` step 0).

## Appendix D — Execution Log
**2026-06-03 ~20:48 UTC — applied 2 pending migrations to prod (`sffisarikcreyyjzdjvb`):**
- `202606030001_fix_contact_titles_clobbered_by_job_title` — rehearsed rolled-back (18 rows, idempotent,
  `data.title` preserved 18/18), then applied with a blast-radius guard (`abort if affected <> 18`).
  Result: `UPDATE 18`, post-verify `still_clobbered = 0`, total rows unchanged (15,379),
  reported record `71aaf7ba-…` now `title='Thomas Boyd'` (job title `Minister` preserved in `data`).
- `202606030002_add_contact_type_classification_field` — field `contact_category` already existed
  (created 19:53 UTC, exact match), so the migration body was a verified 0-row no-op; recorded in ledger.
- Ledger: 366 → **368** applied. Both versions present.
- Repo follow-up (pending): commit the two migration files + related app WIP, then proceed to squash.
