# DHH Issue Register — Phase 7

**Project key:** DHH  
**Date:** 2026-06-15  
**Status:** Open items from Hawkeye cross-ref + workflow deep dive + prior audit carry-forward  

Prior audit: [CRM-ECO-Product-Audit-2026-06-01.md](./CRM-ECO-Product-Audit-2026-06-01.md). Items marked **CARRY-FORWARD** should be verified against current code before repair — not re-audited from scratch.

---

## Issue ID: `DHH-AUDIT-001`

**Priority:** P1  
**Category:** Data Sync / Database  

**Title:** Code references `dependent_coverage_periods` but table absent from May 22 schema snapshot  

**Evidence:**

- File: `apps/portal/src/app/billing/page.tsx` (line 164)
- File: `apps/portal/src/app/dependents/actions.ts` (line 128)
- File: `apps/crm/src/app/crm/members/coverage-actions.ts` (multiple)
- Table: `dependent_coverage_periods`
- Hawkeye: `.audit/reports/findings.json` — BLOCKER "Missing tables"
- Migration exists: `supabase/migrations/202606130001_add_dependent_coverage_periods.sql`

**Problem:** Portal billing and dependent management query a table that was not on prod when the schema snapshot was taken. Runtime queries fail with missing relation until migration is applied.

**Why It Matters:** Active feature work (family coverage history, billing display) breaks in production if migration is pending.

**Root Cause:** Schema drift — code merged ahead of prod migration apply.

**Recommended Fix:** Rehearse and apply `202606130001` on staging then prod; refresh Hawkeye schema snapshot.

**Files Likely Affected:** Portal billing/dependents, CRM coverage actions, `packages/lib/src/members/dependentCoverage.ts`

**Database Changes Needed:** Yes — apply existing migration  
**Migration Needed:** Yes (already authored)  
**Risk of Fix:** Low — additive table + RLS  
**Rollback Strategy:** Drop table if empty; revert app deploy  

**Verification Steps:**

1. `\d dependent_coverage_periods` on prod after apply
2. Portal `/billing` loads family coverage section
3. Hawkeye crossref — BLOCKER cleared

**Status:** **Done (Wave 1, 2026-06-15)** — table confirmed on live prod; Hawkeye BLOCKER cleared

---

## Issue ID: `DHH-AUDIT-002`

**Priority:** P2  
**Category:** Database / Workflow  

**Title:** Missing RPC `repair_converted_contact_insurance_data` called after lead→contact conversion  

**Evidence:**

- File: `apps/crm/src/app/api/crm/leads/convert-to-contact/route.ts` (line 71)
- Function: `repair_converted_contact_insurance_data`
- Hawkeye: BLOCKER "Missing RPCs"

**Problem:** Post-conversion insurance/health-sharing field repair RPC does not exist on snapshot schema. Conversion succeeds; repair step logs warning only.

**Why It Matters:** Converted contacts may lose insurance premium / health-sharing fields that lived on the lead JSONB.

**Root Cause:** RPC referenced in belt-and-suspenders code but never migrated (or named differently on prod).

**Recommended Fix:** Confirm live prod function catalog; create idempotent migration if missing, or remove dead RPC call if RPC was renamed.

**Migration Needed:** TBD after live DB check  
**Status:** **Done (Wave 1, 2026-06-15)** — RPC confirmed on live prod

---

## Issue ID: `DHH-AUDIT-003`

**Priority:** P1  
**Category:** Database / Production Safety  

**Title:** 22 repo migrations not applied on PIFH (schema drift)  

**Evidence:**

- Hawkeye: `.audit/reports/findings.json` — HIGH "Migration drift"
- Includes: baseline squash rows, linter phases, dependent coverage, FK index phases

**Problem:** Local migration ledger diverges from prod. Fresh environments and Hawkeye cross-ref produce false BLOCKERs; deploy order is unclear.

**Why It Matters:** Cannot trust "migration file exists = prod has structure."

**Recommended Fix:** Follow `docs/MIGRATION_CONSOLIDATION_RUNBOOK.md` — refresh schema, apply pending migrations in rehearsed order, reconcile ledger.

**Migration Needed:** Yes (batch apply with approval)  
**Status:** **Done (Wave 1, 2026-06-15)** — ledger 23/23 in sync via `supabase db push --include-all`

---

## Issue ID: `DHH-AUDIT-004`

**Priority:** P2  
**Category:** Database  

**Title:** Duplicate migration timestamp `202606140002` (two files same prefix)  

**Evidence:**

- Files: `202606140002_coverage_parity_and_repair_bridge.sql` + ~~`202606140002_rls_activity_log_partitions_enterprise_verification.sql`~~ → **`202606140008_rls_activity_log_partitions_enterprise_verification.sql`**

**Problem:** Supabase migration tracker may silently skip the second file.

**Recommended Fix:** Renumber one file to unused timestamp; verify prod ledger.

**Status:** **Done (Wave 1, 2026-06-15)** — renumbered + applied on prod

---

## Issue ID: `DHH-AUDIT-005`

**Priority:** P0  
**Category:** Security  
**Source:** CARRY-FORWARD (June 2026 product audit)

**Title:** Live production service-role key in tracked `.env.vercel`  

**Evidence:**

- File: `.env.vercel` (git-tracked)
- Project: `sffisarikcreyyjzdjvb`

**Problem:** Anyone with repo access can bypass RLS against production.

**Recommended Fix:** Rotate keys, remove from git history, add to `.gitignore`, use Vercel env only.

**Status:** **Done (Wave 1, 2026-06-15)** — untracked in git; keys rotated in Supabase + Vercel. Optional follow-up: purge old keys from git history (BFG/filter-repo).

---

## Issue ID: `DHH-AUDIT-006`

**Priority:** P1  
**Category:** Tenant / Data Integrity  
**Source:** CARRY-FORWARD

**Title:** Shared household email — second member invisible in CRM (B1)  

**Evidence:**

- Prior audit migration refs: `202605300015`, draft `202605300016`
- Workflow: W8 `getMemberForUser` email fallback

**Problem:** Duplicate `(email, organization_id)` members break portal linking and CRM visibility.

**Recommended Fix:** Apply dedup/partial unique index migration after rehearsal.

**Status:** **Done (Wave 2, 2026-06-15)** — `202606170001` applied on prod; 988 invisible members backfilled to 0; B2 name-filter stops contact ping-pong. Contacts module still email-deduped (2nd family Contact optional follow-up).

---

## Issue ID: `DHH-AUDIT-007`

**Priority:** P1  
**Category:** Workflow / Automation  
**Source:** CARRY-FORWARD

**Title:** `/api/automation/cron` unscheduled — cadences and delayed workflows stall  

**Evidence:**

- File: `apps/crm/src/app/api/automation/cron/route.ts`
- `vercel.json` — no cron entry (per June audit)

**Problem:** UI shows enrolled cadences; records never advance.

**Status:** Open — NEEDS MANUAL REVIEW of current `vercel.json`

---

## Issue ID: `DHH-AUDIT-008`

**Priority:** P1  
**Category:** Permissions / Workflow  
**Source:** CARRY-FORWARD

**Title:** Commission/payout tables SELECT-only RLS — staff approval writes fail  

**Evidence:**

- Migration: `202601150001` (commission RLS)
- Admin commission UI write paths

**Problem:** Authenticated users cannot UPDATE commission/payout rows through PostgREST.

**Status:** Open

---

## Issue ID: `DHH-AUDIT-009`

**Priority:** P2  
**Category:** Tenant  

**Title:** Reference catalog tables use `USING (true)` SELECT for authenticated  

**Evidence:**

- Hawkeye HIGH: 9 policies (age_bands, benefit_tiers, tobacco_multipliers, etc.)
- Documented in `docs/audit/PHASE_2C_RLS_TRIAGE.md`

**Problem:** Any authenticated user in any org can read global rate tables. Likely intentional for pricing engine.

**Recommended Fix:** Accept with documentation OR scope reads through org-specific plan joins.

**Status:** Open — likely accepted risk

---

## Issue ID: `DHH-AUDIT-010`

**Priority:** P2  
**Category:** Database  

**Title:** Activity log partitions have RLS enabled but zero policies  

**Evidence:**

- Hawkeye MEDIUM: `activity_log_default`, `activity_log_y2026m01`–`m07`

**Problem:** Direct client reads return empty; may confuse debugging.

**Recommended Fix:** Add SELECT policy for org admins or document RPC-only access.

**Status:** Open

---

## Issue ID: `DHH-AUDIT-011`

**Priority:** P2  
**Category:** Frontend / Data Sync  

**Title:** Portal billing uses `(supabase as any)` for payment_profiles and billing_schedules  

**Evidence:**

- File: `apps/portal/src/app/billing/page.tsx` (lines 132–149)

**Problem:** Bypasses generated types — column renames won't surface at compile time.

**Recommended Fix:** Regenerate types; remove `as any` casts.

**Status:** Open

---

## Issue ID: `DHH-AUDIT-012`

**Priority:** P3  
**Category:** Technical Debt  

**Title:** Legacy `org_id` vs `organization_id` dual naming on CRM tables  

**Evidence:**

- Table: `crm_records`, `crm_modules`, `crm_fields`, etc.
- `record-create-service.ts` uses `org_id`

**Problem:** Increases query bug risk when joining to `organization_id` tables.

**Recommended Fix:** Continue strangler migration; standardize new code on `organization_id`.

**Status:** Open (in progress)

---

## Issue ID: `DHH-AUDIT-013`

**Priority:** P3  
**Category:** Testing  

**Title:** Cross-tenant DB specs exist but not run in CI  

**Evidence:**

- File: `packages/lib/src/enrollment/__tests__/db/cross-tenant.db.spec.ts`
- `.github/workflows/` — no test workflow for these specs (per June audit)

**Problem:** RLS regressions can merge undetected.

**Recommended Fix:** Add CI job with staging DB URL and run isolation specs on PR.

**Status:** Open

---

## Issue ID: `DHH-AUDIT-014`

**Priority:** P2  
**Category:** Workflow  

**Title:** Unverified PostgREST embeds (fragile joins)  

**Evidence:**

- `apps/crm/src/app/api/pricing/estimate/route.ts` — `members` embed from `crm_records`
- `apps/crm/src/app/crm/needs/page.tsx` — `crm_records` embed from `needs`
- Hawkeye MEDIUM findings

**Problem:** No direct FK — embed may fail at runtime.

**Status:** Open

---

## Issue ID: `DHH-AUDIT-015`

**Priority:** P3  
**Category:** Database / Performance  

**Title:** 199 unindexed foreign keys on prod (Supabase linter)  

**Evidence:**

- Migration prepared: `202606150001_linter_phase8a_fk_covering_indexes.sql`
- Not applied (part of DHH-AUDIT-003 drift)

**Problem:** Join and CASCADE performance degradation at scale.

**Status:** Open — migration ready, needs apply approval

---

## Summary counts

| Priority | Count |
|---|---:|
| P0 | 1 |
| P1 | 6 |
| P2 | 6 |
| P3 | 3 |
| **Total** | **16** |

## Recommended fix order

1. `DHH-AUDIT-005` — service-role key (if still exposed)
2. `DHH-AUDIT-003` + `DHH-AUDIT-004` — migration ledger hygiene
3. `DHH-AUDIT-001` — dependent coverage table apply
4. `DHH-AUDIT-002` — conversion repair RPC
5. `DHH-AUDIT-006` — shared email / member dedup
6. `DHH-AUDIT-007` — automation cron scheduling
7. `DHH-AUDIT-013` — CI cross-tenant tests
