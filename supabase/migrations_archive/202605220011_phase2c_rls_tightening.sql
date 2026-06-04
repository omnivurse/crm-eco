-- =========================================================================
-- Phase 2C — RLS tightening (pre-enrollment hardening)
--
-- Scope: 4 critical drops + 1 scope-down. No data touched.
-- Backed by docs/audit/PHASE_2C_RLS_TRIAGE.md.
--
-- After Phase 2A migration 010, the live PIFH DB has 14 policies whose
-- `qual` or `with_check` is the literal `true` for a non-service role.
-- This migration removes the 4 that are actually dangerous and tightens
-- the 1 that leaks cross-org data. The remaining 9 are reference-catalog
-- reads we accept as intentional (see triage doc).
--
-- Idempotent: every DROP uses IF EXISTS, every CREATE replaces.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. DROP `document_links.doc_links_anon_select`
--    Anyone could `SELECT * FROM document_links` and harvest share-tokens.
--    The doc-download edge function uses service_role to look up tokens,
--    so the anon SELECT policy is unused. Removing it eliminates the leak.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "doc_links_anon_select" ON public.document_links;

-- -------------------------------------------------------------------------
-- 2. DROP `billing_job_runs.billing_job_runs_insert_service`
--    Public role with WITH CHECK (true) lets anyone fabricate billing job
--    runs. The cron/worker writes as service_role (existing
--    `*_service_role` policy stays in place). Drop the public one.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "billing_job_runs_insert_service" ON public.billing_job_runs;

-- -------------------------------------------------------------------------
-- 3. DROP `email_tracking_events."System can insert tracking events"`
--    Public WITH CHECK (true) lets anyone forge open/click/bounce events.
--    Webhook receivers (Resend, etc.) authenticate via service_role and
--    insert through the existing service_role policy.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert tracking events" ON public.email_tracking_events;

-- -------------------------------------------------------------------------
-- 4. DROP `price_change_audit.price_change_audit_insert`
--    Public WITH CHECK (true) breaks audit integrity. Only the pricing
--    job (service_role) is allowed to write to this table.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "price_change_audit_insert" ON public.price_change_audit;

-- -------------------------------------------------------------------------
-- 5. SCOPE `crm_role_permissions.role_perms_select`
--    Previous version was `USING (true)` for `authenticated` (set in
--    migration 010). That leaks the role-permission map across orgs.
--    Replace with a per-org check: you can see the mapping iff
--      • the role is a SYSTEM template (organization_id IS NULL), OR
--      • you are a CRM member of the owning org.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "role_perms_select" ON public.crm_role_permissions;

CREATE POLICY "role_perms_select" ON public.crm_role_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_roles r
      WHERE r.id = crm_role_permissions.role_id
        AND (
          r.organization_id IS NULL
          OR is_crm_member(r.organization_id)
        )
    )
  );

COMMIT;
