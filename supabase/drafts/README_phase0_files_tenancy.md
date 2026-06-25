# Phase 0 — `public.files` Tenancy Hardening (DRAFTS)

**Status:** DESIGN ONLY. Nothing here has been applied to any database, and these files are
intentionally in `supabase/drafts/` (NOT `supabase/migrations/`) so they do not auto-run.

**What this closes:** the one real cross-tenant leak found in the white-label readiness audit —
`public.files` has a `visibility='org'` SELECT policy with **no organization predicate**
(`baseline.sql:74852`) and no org column to key on. Any authenticated user can read every org's
"org-visible" files. Latent with one tenant; a live leak the moment a second tenant exists.

**Target project:** `sffisarikcreyyjzdjvb` (PIF-ECO-V2 production).
**Pre-req:** confirm the Supabase CLI / connection is authenticated to the account that OWNS this
ref before running anything (at audit time the local CLI was logged into a different account).

## Files

| File | Role |
|---|---|
| `202606230001_files_org_isolation_additive.sql` (A1) | add nullable `organization_id`+`org_id`, attach existing `sync_org_tenant_key` trigger, add covering indexes. Fully additive. |
| `202606230002_files_org_backfill_and_rls.sql` (A2) | backfill org via `owner_id → profiles` (+ single-membership fallback), then split-per-command org RLS **incl. the §5.2 leak fix**. |
| `202606230003_files_org_fk_notnull.sql` (A3) | promote `organization_id` to FK + NOT NULL. Deferred. |
| `202606230004_dual_org_column_audit.READONLY.sql` | read-only diagnostic: confirms `files` is the only leaker; computes V1. |
| `../../packages/lib/src/enrollment/__tests__/db/files-crm-money-cross-tenant.db.spec.ts` | staging cross-tenant denial test (files + crm_records + payments). |

## Apply order & gates (🔒 = approval checkpoint)

1. Run `…_dual_org_column_audit.READONLY.sql` (Q1/Q2) on **staging** → confirm `files` is the only
   policy reported as `no org predicate`.
2. Apply **A1**. (No gate — fully additive.)
3. Apply the **A2 backfill** section. Compute **V1** = audit Q4 (files rows still unresolved).
   - If the single-shot `UPDATE` risks `lock_timeout='5s'`, use the **keyset-batched** variant in
     A2 instead (re-run until 0 rows).
4. Triage unresolved rows (owner has no profile-org and no single active membership). **A3 cannot
   run until V1 = 0.**
5. 🔒 Apply **A2 §5.1–5.5 RLS**. §5.2 (the `visibility='org'` policy replace) is the only
   non-additive action — apply it only past this gate; its rollback is staged in the same file.
6. Run `files-crm-money-cross-tenant.db.spec.ts` on staging → the `files` isolation test should go
   **FAIL → PASS** across §5.2; the crm_records/payments control tests stay green.
7. 🔒 Apply **A3**. Decide `ON DELETE RESTRICT` (recommended for DMS/compliance) vs house-default
   `CASCADE` for the FK before applying.

## Rollback
Each SQL file ends with a `-- Rollback (Ax):` block. The only non-additive action (A2 §5.2)
restores the original policy verbatim. Backfilled column values are non-destructive and are left
in place on rollback.

## Promotion to a real migration
When approved: move the chosen files into `supabase/migrations/` with fresh sequential timestamps,
regenerate DB types, and apply through the normal pipeline. Keep the `.READONLY.sql` audit in
`drafts/` (it is a diagnostic, not a migration).

## Not included here (next materialization)
The **Questionnaire Engine** migration (Phase 2) is designed but intentionally not materialized yet
— its base table/enum/RLS blocks need a final diff against live DDL before leaving `drafts/`, and
it is gated behind this Phase 0 work regardless.
