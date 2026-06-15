# Hawkeye Audit — Operator's Guide

The Hawkeye audit is the safety net that keeps the front-end in lockstep
with the live PIFH database. It catches drift between code and schema
**before** a deploy turns into a 500 or a silent data loss.

## What it does, end-to-end

```
+---------------------------+        +----------------------------+
|  Live PIFH (PostgreSQL)   |        |  apps/* + packages/* code  |
+-------------+-------------+        +-------------+--------------+
              |                                    |
              | refresh-schema.sh                  | inventory.mjs
              v                                    v
       .audit/schema/*.csv                  .audit/code/*.csv
              |                                    |
              +------------- crossref.mjs ---------+
                                |
                                v
                      .audit/reports/findings.json
                                |
                                | check-baseline.mjs
                                v
                       PASS / FAIL  ←  .audit/baseline.json
```

Four scripts, one job each:

| Script | What it does |
| --- | --- |
| `.audit/scripts/refresh-schema.sh` | Dumps the live schema (tables, columns, FKs, indexes, RLS, triggers, enums, applied migrations) to `.audit/schema/*.csv`. |
| `.audit/scripts/inventory.mjs` | Walks every `.ts/.tsx/.js/.mjs` in `apps/` + `packages/` and extracts every `supabase.from(...)`, `.select()`, `.eq()`, `.rpc()`, embed, etc. into `.audit/code/*.csv`. |
| `.audit/scripts/crossref.mjs` | Joins the two sets and emits structured findings (`unknown_column`, `missing_table`, `missing_rpc`, `risky_cascade`, `migration_drift`, `RLS too permissive`, …) into `.audit/reports/findings.json`. |
| `.audit/scripts/check-baseline.mjs` | Diffs the latest findings against `.audit/baseline.json`. Exits non-zero only when a NEW finding meets `AUDIT_FAIL_AT` (default `HIGH`). |

## Run it locally

You need the PIFH read-only connection string (the same one used by
`.github/workflows/pifh-deploy-gate.yml` — see `1Password → PIFH DB URL`).

```bash
# 1. set the connection target
export PIFH_SUPABASE_DB_URL='postgresql://postgres.<project_ref>@aws-1-us-east-2.pooler.supabase.com:5432/postgres'
export PGPASSWORD='...'   # if the URL doesn't already embed it

# 2. refresh schema + run the full audit
.audit/scripts/refresh-schema.sh
node .audit/scripts/inventory.mjs
node .audit/scripts/crossref.mjs
node .audit/scripts/check-baseline.mjs
```

Expected steady-state output:

```
[audit] baseline: .audit/baseline.json
[audit] frozen at: 2026-05-22T19:18:26.038Z
[audit] fail threshold: HIGH
[audit] findings now: 14
[audit] new findings: 0 (blocking: 0)
[audit] resolved findings: 0
[audit] ✅ no new findings at fail threshold.
```

## Read the findings

`jq` is your friend:

```bash
# all severities, count by category
jq '.findings | group_by(.category) | map({category: .[0].category, count: length})' \
  .audit/reports/findings.json

# just the BLOCKERs
jq '.findings[] | select(.severity == "BLOCKER")' .audit/reports/findings.json

# full detail for a specific category
jq '.findings[] | select(.category == "RLS too permissive")' .audit/reports/findings.json
```

Severity ladder:

| Severity | When you see it | When CI fails |
| --- | --- | --- |
| `BLOCKER` | Code calls a table/column/RPC that does not exist — guaranteed runtime error. | Always (any new BLOCKER fails CI). |
| `HIGH`    | Real security/integrity risk (over-permissive RLS, dangerous cascades, unapplied migrations). | New HIGHs fail CI by default (`AUDIT_FAIL_AT=HIGH`). |
| `MEDIUM`  | Suspected drift (unverified joins, dynamic chains we can't statically prove). | Reported, never blocks. |
| `LOW`     | Hygiene (unused tables/columns, missing indexes on rare filter columns). | Reported, never blocks. |
| `INFO`    | Baseline counts, summary metrics. | Reported, never blocks. |

## When a new finding appears

1. **Read the finding's `sites` array** — every entry shows the exact
   `file:line` and a code snippet.
2. **Decide:** real drift → fix the code/migration. False positive → see
   "False positives" below.
3. **Refresh the baseline only after the fix lands** in the same PR. Run:
   ```bash
   AUDIT_UPDATE_BASE=1 node .audit/scripts/check-baseline.mjs
   git add .audit/baseline.json
   ```

## When you intentionally accept a finding

Sometimes a finding is real but accepted (e.g. the 9 reference-catalog
`USING (true)` policies on `age_bands`, `tobacco_multipliers`, etc.).
Document the rationale in `docs/audit/PHASE_2C_RLS_TRIAGE.md` (or a
similar phase doc) and refresh the baseline:

```bash
AUDIT_UPDATE_BASE=1 node .audit/scripts/check-baseline.mjs
git add .audit/baseline.json docs/audit/<phase-doc>.md
git commit -m "audit: accept <finding> with rationale"
```

The next CI run will see the finding in the baseline and not block on it.

## False positives

Two known sources, both handled in `crossref.mjs`:

1. **Tables in non-public schemas** (`auth.users`, `storage.buckets`,
   `realtime.subscription`). Listed in `NON_PUBLIC_TABLES` around line
   170 of `crossref.mjs`.
2. **Dynamic table/column names** (e.g. `supabase.from(tableName)`). The
   inventory tags these as `dynamic` and the cross-ref skips them.

If you hit a new false positive, add it to the appropriate skip list in
`crossref.mjs` and add a comment explaining why.

## CI integration

The audit runs on every PR to `main` via
`.github/workflows/hawkeye-audit.yml`. The workflow:

1. Refreshes the schema from PIFH (using the `PIFH_SUPABASE_DB_URL`
   GitHub Actions secret).
2. Runs the full pipeline.
3. Fails the build if a new finding ≥ `HIGH` appears.
4. Uploads all generated CSVs + the findings JSON as a 14-day artifact
   so you can grep through them after the fact.

A manual `workflow_dispatch` with `refresh_baseline=true` will recompute
the baseline and surface a notice with the diff — but the commit itself
still needs to be made on a follow-up PR (CI cannot write to `main`
directly).

## Optional pre-push hook

A pre-push hook is provided in `.audit/scripts/pre-push.sh`. To install it
for your local clone:

```bash
ln -s ../../.audit/scripts/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

The hook runs the inventory + crossref + baseline-check (skipping the
schema refresh so it doesn't need DB credentials). Push aborts only on
NEW HIGH+ findings. Override with `git push --no-verify` if you must.

## Phase history

See `docs/audit/REMEDIATION_PLAN.md` for the running ledger of fixes,
migrations, and accepted-risk decisions that brought the audit from 141
BLOCKERs (May 22, 2026 baseline) down to 0.

## DHH logic audit (2026-06-15)

Scoped read-only audit for CRM ECO / DoubleHelixHub (project key **DHH**).
Olyron Core is out of scope.

| Document | Contents |
| --- | --- |
| [DHH-LOGIC-AUDIT-2026-06-15.md](./DHH-LOGIC-AUDIT-2026-06-15.md) | Phase 1 inventory, Phase 2 summary, Phase 5 workflow matrix |
| [DHH-PHASE2-TENANT-MATRIX-FULL.md](./DHH-PHASE2-TENANT-MATRIX-FULL.md) | Full tenant/org isolation matrix (58 tables) |
| [DHH-ISSUE-REGISTER.md](./DHH-ISSUE-REGISTER.md) | Phase 7 issue register (16 items, P0–P3) |
| [DHH-REPAIR-WAVE1-PRODUCTION-SAFETY.md](./DHH-REPAIR-WAVE1-PRODUCTION-SAFETY.md) | **Wave 1 playbook** — secrets, migrations, Hawkeye (**complete**) |
| [DHH-REPAIR-WAVE2-TENANT-DB.md](./DHH-REPAIR-WAVE2-TENANT-DB.md) | **Wave 2 playbook** — RLS probes, B1/B2 shared-email fix (**complete**) |
| [DHH-SCORECARD.md](./DHH-SCORECARD.md) | **Master scorecard** — path to 100 on all six dimensions |
| [DHH-REPAIR-WAVE4-FRONTEND-SYNC.md](./DHH-REPAIR-WAVE4-FRONTEND-SYNC.md) | **Wave 4 playbook** — Hawkeye refresh, embed fixes (**in progress**) |
| [DHH-REPAIR-WAVE3-TENANT-APPS.md](./DHH-REPAIR-WAVE3-TENANT-APPS.md) | **Wave 3 playbook** — API route audit, admin/portal tenant guards (**in progress**) |
| [CRM-ECO-Product-Audit-2026-06-01.md](./CRM-ECO-Product-Audit-2026-06-01.md) | Prior product-wide audit (carry-forward items) |
