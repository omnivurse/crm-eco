# DHH Phase 2 — Tenant / Org Isolation Matrix (Full)

**Project key:** DHH  
**Date:** 2026-06-15  
**Source:** `.audit/schema/` (PIFH prod snapshot, 2026-05-22) + Hawkeye code inventory (2026-06-15)  

**Legend**

- **Scope:** Expected isolation boundary for SaaS use
- **Present?:** Whether the required scope column exists on the table
- **RLS:** `t` = enabled, count = policy count from snapshot
- **Risk:** LOW / MEDIUM / HIGH based on scope column + RLS + code drift

| Table | Scope | Required field | Present? | RLS | Scope fields | Risk |
|---|---|---|---|---|---|---|
| `profiles` | organization | organization_id/org_id | Yes | t (6) | organization_id, member_id | LOW |
| `crm_records` | organization | organization_id/org_id | Yes | t (8) | organization_id, org_id, owner_id | LOW |
| `enrollments` | organization | organization_id/org_id | Yes | t (9) | organization_id | LOW |
| `members` | organization | organization_id/org_id | Yes | t (9) | organization_id | LOW |
| `advisors` | organization | organization_id/org_id | Yes | t (8) | organization_id, profile_id | LOW |
| `crm_modules` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `crm_tasks` | organization | organization_id/org_id | Yes | t (7) | organization_id, org_id | LOW |
| `plans` | organization | organization_id/org_id | Yes | t (5) | organization_id | LOW |
| `billing_transactions` | organization | organization_id/org_id | Yes | t (4) | organization_id, member_id | LOW |
| `enrollment_audit_log` | organization | organization_id/org_id | Yes | t (3) | organization_id | LOW |
| `crm_fields` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `enrollment_steps` | organization | organization_id/org_id | Yes | t (4) | organization_id | LOW |
| `needs` | organization | organization_id/org_id | Yes | t (9) | organization_id, member_id | LOW |
| `crm_import_jobs` | organization | organization_id/org_id | Yes | t (6) | organization_id, org_id | LOW |
| `inbox_conversations` | organization | organization_id/org_id | Yes | t (2) | organization_id, org_id | LOW |
| `saved_views` | organization | organization_id/org_id | Yes | t (6) | organization_id | LOW |
| `commission_transactions` | organization | organization_id/org_id | Yes | t (2) | organization_id, member_id | MEDIUM |
| `organizations` | global/reference | — | Yes | t (6) | — | LOW |
| `job_runs` | organization | organization_id/org_id | Yes | t (3) | organization_id | LOW |
| `billing_schedules` | organization | organization_id/org_id | Yes | t (3) | organization_id, member_id | LOW |
| `crm_workflows` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `landing_pages` | organization | organization_id/org_id | Yes | t (3) | organization_id | LOW |
| `crm_notes` | organization | organization_id/org_id | Yes | t (7) | organization_id, org_id | LOW |
| `integration_connections` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `crm_assignment_rules` | organization | organization_id/org_id | Yes | t (3) | organization_id, org_id | LOW |
| `invoices` | organization | organization_id/org_id | Yes | t (5) | organization_id, member_id | LOW |
| `crm_reports` | organization | organization_id/org_id | Yes | t (7) | organization_id, org_id | LOW |
| `email_campaigns` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `crm_cadence_enrollments` | organization | organization_id/org_id | Yes | t (3) | organization_id, org_id | LOW |
| `dependents` | organization | organization_id/org_id | Yes | t (7) | organization_id, member_id | LOW |
| `crm_message_templates` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `sent_emails` | organization | organization_id/org_id | Yes | t (2) | organization_id, member_id | LOW |
| `vendors` | organization | organization_id/org_id | Yes | t (2) | organization_id, org_id | LOW |
| `payment_profiles` | organization | organization_id/org_id | Yes | t (3) | organization_id, member_id | LOW |
| `email_templates` | organization | organization_id/org_id | Yes | t (3) | organization_id | LOW |
| `crm_approvals` | organization | organization_id/org_id | Yes | t (6) | organization_id, org_id | LOW |
| `email_sequences` | organization | organization_id/org_id | Yes | t (2) | organization_id, org_id | LOW |
| `dependent_coverage_periods` | organization | organization_id | **MISSING IN SNAPSHOT** | — | — | **HIGH** |
| `billing_job_runs` | organization | organization_id/org_id | Yes | t (1) | organization_id | LOW |
| `insurance_carriers` | organization | organization_id/org_id | Yes | t (5) | organization_id | LOW |
| `commission_tiers` | organization | organization_id/org_id | Yes | t (2) | organization_id | LOW |
| `crm_audit_log` | organization | organization_id/org_id | Yes | t (3) | organization_id, org_id | LOW |
| `crm_layouts` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `crm_notifications` | organization | organization_id/org_id | Yes | t (5) | organization_id, org_id | LOW |
| `email_sequence_enrollments` | NEEDS MANUAL REVIEW | — | Yes | t (2) | — | LOW |
| `email_sequence_steps` | NEEDS MANUAL REVIEW | — | Yes | t (2) | — | LOW |
| `memberships` | organization | organization_id/org_id | Yes | t (4) | organization_id, member_id | LOW |
| `crm_cadences` | organization | organization_id/org_id | Yes | t (3) | organization_id, org_id | LOW |
| `billing_failures` | organization | organization_id/org_id | Yes | t (3) | organization_id, member_id | LOW |
| `payment_transactions` | organization | organization_id/org_id | Yes | t (2) | organization_id, member_id | LOW |
| `commission_adjustments` | organization | organization_id/org_id | Yes | t (3) | organization_id | LOW |
| `payables` | organization | organization_id/org_id | Yes | t (1) | organization_id | LOW |
| `payouts` | NEEDS MANUAL REVIEW | — | **MISSING IN SNAPSHOT** | — | — | MEDIUM |
| `enrollment_dependents` | organization | organization_id/org_id | Yes | t (2) | organization_id | LOW |
| `financial_audit_log` | organization | organization_id/org_id | Yes | t (1) | organization_id | LOW |
| `billing_audit_log` | organization | organization_id/org_id | Yes | t (2) | organization_id, member_id | LOW |
| `medical_claims` | NEEDS MANUAL REVIEW | — | **MISSING IN SNAPSHOT** | — | — | MEDIUM |
| `health_sharing` | NEEDS MANUAL REVIEW | — | **MISSING IN SNAPSHOT** | — | — | MEDIUM |

## Reference-catalog tables (intentionally broad read)

These are org-global pricing/reference tables with authenticated `USING (true)` SELECT policies (Hawkeye HIGH finding). Acceptable for rate lookup; document if tightening per-tenant pricing.

- `age_bands`, `benefit_tiers`, `tobacco_multipliers`, `rating_areas`
- `plan_healthshare_tier_config`, `plan_traditional_tier_config`
- `inactive_reasons` (public read)

## Activity log partitions (RLS enabled, zero policies)

`activity_log_default`, `activity_log_y2026m01` … `y2026m07` — client PostgREST reads return empty. Access expected via SECURITY DEFINER RPCs or service role only.
