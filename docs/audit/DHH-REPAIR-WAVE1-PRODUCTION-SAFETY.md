# DHH Wave 1 — Production Safety Repair Playbook

**Project key:** DHH  
**Wave:** 1 of 6 (target: Production Safety 55 → 100)  
**Approval:** Explicit — 2026-06-15 (all phases authorized; executing Wave 1 first)  
**Operator:** You + Cursor agent (paired execution)

---

## Wave 1 scorecard (what 100 means here)

| Gate | Done when |
|---|---|
| Secrets | No prod service-role in git; keys rotated; Vercel-only storage |
| Migration ledger | Repo timestamps unique; prod ledger matches incremental files |
| Schema truth | Hawkeye refresh ≤7 days old; 0 BLOCKER / 0 new HIGH |
| Apply discipline | Staging rehearsed → prod push with verification + watch window |
| CI safety | Hawkeye on PRs; cross-tenant specs planned (Wave 3) |

---

## Already completed in repo (this session)

| Step | Status | Evidence |
|---|---|---|
| Fix duplicate migration timestamp `202606140002` | ✅ Done | Renamed to `202606140008_rls_activity_log_partitions_enterprise_verification.sql` |
| Stop tracking `.env.vercel` | ✅ Done | `git rm --cached .env.vercel` + added to `.gitignore` |
| Add `.env.vercel.example` | ✅ Done | Placeholder template at repo root |
| Operator script | ✅ Done | `scripts/wave1-production-safety.mjs` |

---

## Step 1 — Rotate Supabase keys (YOU — ~15 min)

**Issue:** `DHH-AUDIT-005` (P0)

The file `.env.vercel` contained a live **service_role** JWT. It is removed from the git index but may still exist in git history.

### 1a. Rotate in Supabase Dashboard

Project: **PIF-ECO-V2** (`sffisarikcreyyjzdjvb`)

1. [Dashboard → Settings → API](https://supabase.com/dashboard/project/sffisarikcreyyjzdjvb/settings/api)
2. **Reset service_role key** → copy new key to 1Password / Vercel only
3. **Reset anon key** (recommended since both were in the same file)
4. Update **every** Vercel project env: `crm`, `portal`, `admin`, `advisor-portal`, `website`, `doublehelixhub`
5. Update GitHub Actions secret `PIFH_SUPABASE_DB_URL` if password changed (usually unchanged)

### 1b. Purge from git history (optional but recommended)

```bash
# After keys are rotated and Vercel is updated:
git filter-repo --path .env.vercel --invert-paths
# OR BFG: bfg --delete-files .env.vercel
# Force-push requires team coordination — schedule a maintenance window
```

### 1c. Local dev

```bash
vercel env pull .env.vercel   # gitignored — never commit
cp .env.vercel.example .env.vercel   # if starting fresh
```

**Verification:** `git ls-files .env.vercel` → empty. App deploy succeeds with new Vercel env.

---

## Step 2 — Refresh Hawkeye against live prod (YOU or agent with URL)

**Issue:** Stale schema (May 22) causes false BLOCKERs

```bash
export PIFH_SUPABASE_DB_URL='postgresql://postgres.<ref>@...pooler.supabase.com:5432/postgres?sslmode=require'
export PGPASSWORD='...'   # if not in URL

node scripts/wave1-production-safety.mjs --refresh
```

**Expected:**

- `.audit/schema/*.csv` regenerated
- `.audit/reports/findings.json` — target **0 BLOCKER**, **0 new HIGH**
- `node .audit/scripts/check-baseline.mjs` — pass or controlled baseline update

**If new BLOCKERs appear:** fix code or apply missing migration before prod push.

---

## Step 3 — Discover pending migrations on prod

```bash
export PIFH_SUPABASE_DB_URL='...'
node scripts/wave1-production-safety.mjs --pending
```

**Important:** After the June 2026 squash, prod ledger should contain **only**:

- `00000000000000` (baseline)
- `00000000000001` (baseline cross-schema)

Everything else in `supabase/migrations/` with a newer timestamp is **incremental** and safe to `db push`.

### Expected incremental apply order (21 files)

```
202606060001_fix_generate_record_title_name_over_job_title.sql
202606130001_add_dependent_coverage_periods.sql
202606130002_fix_lead_to_contact_carry_insurance_fields.sql
202606130003_linter_phase1_search_path.sql
202606130004_linter_phase2_mv_privileges.sql
202606130005_linter_phase3_internal_definer_revokes.sql
202606130006_linter_phase4_extensions_schema.sql
202606130007_linter_hotfix_search_path_and_job_revokes.sql
202606130008_linter_phase5_revoke_anon_definer_execute.sql
202606140001_align_contacts_health_sharing_fields.sql
202606140002_coverage_parity_and_repair_bridge.sql
202606140003_linter_phase6a_revoke_authenticated_cron_triggers.sql
202606140004_linter_phase6b_auth_helpers_private_schema.sql
202606140005_linter_phase7a_auth_rls_initplan.sql
202606140006_linter_phase7b_duplicate_indexes.sql
202606140007_linter_phase7c_split_all_rls_policies.sql
202606140008_rls_activity_log_partitions_enterprise_verification.sql
202606150001_linter_phase8a_fk_covering_indexes.sql
202606150002_linter_phase8b_staging_primary_keys.sql
202606150003_harden_lead_conversion_paths.sql
202606160001_unify_leads_to_crm_records.sql
```

Dry-run:

```bash
supabase link --project-ref sffisarikcreyyjzdjvb   # if not linked
node scripts/wave1-production-safety.mjs --dry-run
# or: supabase db push --dry-run
```

---

## Step 4 — Rehearse on staging (recommended)

Staging project: `cammurefjywnzxnmuyfv`

**Note:** Staging ledger is **diverged** from prod (dashboard-applied migrations with different version IDs). Do not assume staging = prod.

```bash
export STAGING_SUPABASE_DB_URL='postgresql://postgres.cammurefjywnzxnmuyfv:...@...'
psql "$STAGING_SUPABASE_DB_URL" -f scripts/rehearse-linter-phase8.sql
```

For full incremental push on staging:

```bash
supabase link --project-ref cammurefjywnzxnmuyfv
supabase db push --dry-run
# review → supabase db push
```

---

## Step 5 — Apply to production (explicit gate — approved)

**PROD WRITE RISK: YES**

### Pre-flight

- [ ] Keys rotated (Step 1)
- [ ] `--dry-run` clean on prod link
- [ ] Backup/PITR confirmed in Dashboard
- [ ] Low-traffic window selected

### Apply

```bash
supabase link --project-ref sffisarikcreyyjzdjvb
supabase db push
```

### Post-apply verification (30-min watch)

```sql
-- dependent coverage table exists
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'dependent_coverage_periods';

-- repair RPC exists
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'repair_converted_contact_insurance_data';

-- ledger count
SELECT count(*) FROM supabase_migrations.schema_migrations;
```

```bash
node scripts/verify-lead-contact-conversion.mjs   # needs SUPABASE_URL + SERVICE_ROLE
node scripts/wave1-production-safety.mjs --refresh
```

**Rollback trigger:** error rate ↑, migration lock timeout, portal `/billing` 500s.

**Rollback:** restore from PITR (Dashboard) — do not hand-rollback 21 migrations individually.

---

## Repair prompts (paste into Cursor)

### Prompt A — `DHH-AUDIT-005` Secrets remediation

```markdown
You are fixing DHH-AUDIT-005 (committed service-role key).

Objective: Ensure no production secrets remain in git; document rotation.

Scope:
- .gitignore, .env.vercel.example, docs/audit/*
- Do NOT commit .env.vercel with real values

Verify:
- git ls-files .env.vercel is empty
- grep repo for eyJ service_role JWT patterns (should be 0 in tracked files)

Do not push git history purge without operator approval.
```

### Prompt B — `DHH-AUDIT-003` + `004` Migration apply

```markdown
You are fixing DHH-AUDIT-003 and DHH-AUDIT-004.

Objective: Apply all incremental migrations to prod after dry-run passes.

Allowed: supabase db push, scripts/wave1-production-safety.mjs, Hawkeye refresh

Order: 202606060001 → … → 202606160001 (see Wave 1 playbook)

Safety:
- Rehearse rolled-back on staging first
- lock_timeout already set in migration files
- Abort if dry-run shows destructive unexpected DDL

Verify: Hawkeye 0 BLOCKER; dependent_coverage_periods exists; repair RPC callable
```

### Prompt C — Hawkeye baseline refresh

```markdown
You are completing Wave 1 Hawkeye refresh.

Run: PIFH_SUPABASE_DB_URL=... node scripts/wave1-production-safety.mjs --refresh

If new findings ≥ HIGH: triage before AUDIT_UPDATE_BASE=1 baseline bump.

Target: Production Safety score gate — 0 BLOCKER, 0 new HIGH.
```

---

## Wave 1 exit criteria → Production Safety 100

| # | Criterion | Owner |
|---|---|---|
| 1 | `.env.vercel` untracked; keys rotated | You (Dashboard) |
| 2 | No duplicate migration prefixes in repo | ✅ Agent |
| 3 | Prod `supabase db push` applied; ledger current | Paired |
| 4 | Hawkeye refresh; 0 BLOCKER | Paired |
| 5 | `dependent_coverage_periods` + repair RPC on prod | Paired |
| 6 | 30-min post-apply watch clean | You |

When all six are checked, update [DHH-ISSUE-REGISTER.md](./DHH-ISSUE-REGISTER.md) and proceed to **Wave 2 — Tenant DB**.

---

## What I need from you right now (single action)

Paste or set **read-only** prod DB URL so we can run Step 2–3 together:

```bash
export PIFH_SUPABASE_DB_URL='postgresql://...'
node scripts/wave1-production-safety.mjs --pending
```

If you prefer not to share the URL in chat, run that command locally and paste the **pending migration list** + **crossref severity breakdown**.

Then we execute Step 1 (key rotation) in parallel — you in Dashboard, I prep the prod push rehearsal.
