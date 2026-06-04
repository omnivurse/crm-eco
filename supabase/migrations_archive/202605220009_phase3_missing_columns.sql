-- =========================================================================
-- Phase 3 — Add columns that the frontend has been writing/reading from
-- but which never existed in the live schema. Every change here is
-- additive (ADD COLUMN IF NOT EXISTS, ALTER ... DROP NOT NULL) so it is
-- safe to apply to PIFH without data loss.
--
-- The grouping mirrors the Phase 3 audit buckets. See docs/audit/REMEDIATION_PLAN.md.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. profiles.member_id  → link a portal auth user directly to a member row
-- -------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_member_id
  ON profiles (member_id)
  WHERE member_id IS NOT NULL;

-- Backfill profiles.member_id by matching email within the same org.
-- Idempotent: only fills rows that are currently null. Uses a correlated
-- subquery rather than UPDATE...FROM so it's safe under RLS.
UPDATE profiles p
SET member_id = (
  SELECT m.id
  FROM members m
  WHERE m.organization_id = p.organization_id
    AND lower(m.email) = lower(p.email)
  ORDER BY m.created_at
  LIMIT 1
)
WHERE p.member_id IS NULL
  AND p.email IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. invoices.member_id  → invoices need to point at a member, not just
--    a CRM record (contact_id). Used by the admin invoice generator and
--    the portal billing pages.
-- -------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_member_id
  ON invoices (member_id)
  WHERE member_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 3. memberships.enrollment_id  → connect a membership back to the
--    enrollment that created it (self-serve approval flow).
-- -------------------------------------------------------------------------
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_enrollment_id
  ON memberships (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 4. report_run_history  → support template-based reports that have no
--    row in crm_reports. Make report_id nullable and add a template_key
--    column to distinguish "report id 12345" from "advisor template X".
-- -------------------------------------------------------------------------
ALTER TABLE report_run_history
  ALTER COLUMN report_id DROP NOT NULL;

ALTER TABLE report_run_history
  ADD COLUMN IF NOT EXISTS template_key text;

CREATE INDEX IF NOT EXISTS idx_report_run_history_template_key
  ON report_run_history (template_key)
  WHERE template_key IS NOT NULL;

-- -------------------------------------------------------------------------
-- 5. commission_transactions  → bonus/override accounting fields used by
--    the commissions list & summary screens.
-- -------------------------------------------------------------------------
ALTER TABLE commission_transactions
  ADD COLUMN IF NOT EXISTS is_bonus       boolean   DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS bonus_reason   text,
  ADD COLUMN IF NOT EXISTS bonus_type_id  uuid,
  ADD COLUMN IF NOT EXISTS effective_date date;

-- -------------------------------------------------------------------------
-- 6. email_templates  → per-template sender info used by the comms editor.
-- -------------------------------------------------------------------------
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS from_name  text,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS reply_to   text;

-- -------------------------------------------------------------------------
-- 7. email_campaigns.error_message  → preserve failure reason for ops.
-- -------------------------------------------------------------------------
ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS error_message text;

-- -------------------------------------------------------------------------
-- 8. email_domains  → MX verification and combined last_verified_at clock.
-- -------------------------------------------------------------------------
ALTER TABLE email_domains
  ADD COLUMN IF NOT EXISTS mx_verified      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- -------------------------------------------------------------------------
-- 9. advisor_playbooks.target_modules  → which CRM modules a playbook
--    applies to. Default Deals matches the existing API default.
-- -------------------------------------------------------------------------
ALTER TABLE advisor_playbooks
  ADD COLUMN IF NOT EXISTS target_modules text[] DEFAULT ARRAY['Deals'];

-- -------------------------------------------------------------------------
-- 10. crm_workflows.nodes/edges  → visual workflow builder state.
-- -------------------------------------------------------------------------
ALTER TABLE crm_workflows
  ADD COLUMN IF NOT EXISTS nodes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS edges jsonb DEFAULT '[]'::jsonb;

-- -------------------------------------------------------------------------
-- 11. product_benefit_types.plan_id  → matches product_iua /
--     product_age_brackets which already have plan_id. Scoped to a plan
--     via FK; cascade so deleting a plan removes its pricing matrix.
-- -------------------------------------------------------------------------
ALTER TABLE product_benefit_types
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_benefit_types_plan_id
  ON product_benefit_types (plan_id)
  WHERE plan_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 12. billing_transactions.nacha_job_id  → link batched ACH transactions
--     to the NACHA file that exported them. No FK — the NACHA jobs table
--     varies by tenant configuration.
-- -------------------------------------------------------------------------
ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS nacha_job_id uuid;

CREATE INDEX IF NOT EXISTS idx_billing_transactions_nacha_job_id
  ON billing_transactions (nacha_job_id)
  WHERE nacha_job_id IS NOT NULL;

COMMIT;
