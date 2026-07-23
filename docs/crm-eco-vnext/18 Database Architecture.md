# 18 — Database Architecture

> Part of the CRM-ECO vNext Master Build Prompt Package. See `README.md`.
> **Foundation prompt.**

---

## Original Prompt (synthesized in package voice)

Document and modernize the **database architecture**: every table, relationship, RLS policy, index, trigger, stored procedure, generated column, and migration. Guarantee tenant isolation, referential integrity, performance (indexes for every hot query), auditability, and a clean migration history. Define the canonical entity model and eliminate duplicate sources of truth.

---

## Current State

Supabase Postgres with mature, RLS-first schema. Active migrations in `supabase/migrations/`; history in `supabase/migrations_archive/`.

Domain areas (verified, see `docs/03_CRM_ECO_CURRENT_STATE.md` for column-level detail):

- **Enrollment**: `enrollments`, `enrollment_steps`, `enrollment_audit_log`, `plans`, `memberships`, `dependents`, `enrollment_links(+visits/conversions/analytics)`, `import_jobs(+rows)`.
- **Billing**: `payment_profiles`, `billing_schedules`, `billing_transactions` (generated `net_amount`), `billing_failures`, `invoices` (generated `balance_due`).
- **Commissions**: `agent_levels`, `commission_rates`, `commissions`, `commission_adjustments`, `advisor_commission_summary`, `commission_payment_batches`, `commission_payouts`, `commission_ledger`, `payout_item_ledger_links` + RPCs/triggers.
- **CRM records**: `crm_records`, `crm_modules`, `crm_fields`, `crm_views`, `crm_layouts`.
- **Security/audit**: `organizations`, `organization_members`, `profiles`, `crm_roles/permissions/*`, `unified_audit_logs`, `phi_access_log`, `tenant_audit_log`.
- RLS helpers: `get_user_organization_id()`, `get_user_role()`, `get_user_advisor_id()`, `user_organization_ids()`, `has_crm_role()`.

## Gap Analysis

| vNext area | Status |
|---|---|
| Tenant isolation via RLS | Present (strong) |
| Generated columns / triggers | Present (billing, commissions) |
| Audit tables | Present |
| **Duplicate entity model** | **Members exist twice** (`members` vs `crm_records` module=members); tasks twice (`tasks` vs `crm_tasks`) |
| Canonical entity registry | Missing |
| Domain-event stream table | Missing (needed by `12`/`19`) |
| Index coverage audit | Unknown — needs review per hot query |
| Migration ordering hygiene | Prior out-of-order incidents (see actuarial work) |

## Build Notes

- The central schema decision: **one canonical Member**. Either make `crm_records` a projection of `members` or vice-versa; today they are synced parallel models (`lead-conversion-sync.ts`, `@crm-eco/lib/members`). Record the choice as an ADR — it's load-bearing for `03`.
- Add a **domain-events** table (append-only, tenant-scoped) to back the shared automation engine (`12`).
- Keep the "aggregate-only SECURITY DEFINER function" pattern for any reporting/PHI surface (`10`, `14`).
- Audit indexes for every list-view filter/sort the shared table module (`02`) exposes.
- Preserve hash-chained `unified_audit_logs` integrity; never mutate historical rows.
