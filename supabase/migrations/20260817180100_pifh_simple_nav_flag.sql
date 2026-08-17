-- =============================================================================
-- PIFH: switch the CRM shell to the "simple" navigation profile
-- =============================================================================
--
-- The CRM shell reads the org-scoped feature flag `crm.nav.simple`
-- (apps/crm/src/lib/crm/feature-flags.ts → resolveCrmNavProfile). When it is
-- enabled for an organization, that org's users see one flat sidebar menu
-- (Dashboard, Workqueue, the org's enabled crm_modules, Tasks, Calendar,
-- Reports, Inbox) and NO top-level module tab strip, instead of the full
-- 7-tab / ~111-link Zoho layout. Orgs without a row (and the global default,
-- which stays absent) keep the full layout.
--
-- Scope: ONE configuration row for the PIFH tenant. Additive. No schema
-- change, no record data touched. Idempotent (partial unique index
-- uq_crm_feature_flags_org_key guards duplicates; WHERE NOT EXISTS keeps a
-- re-run a no-op).
--
-- ROLLBACK (instant, no data loss — either statement):
--   UPDATE public.crm_feature_flags SET enabled = false
--    WHERE flag_key = 'crm.nav.simple'
--      AND organization_id = '00000000-0000-0000-0000-000000000001';
--   -- or remove the row entirely:
--   DELETE FROM public.crm_feature_flags
--    WHERE flag_key = 'crm.nav.simple'
--      AND organization_id = '00000000-0000-0000-0000-000000000001';
-- =============================================================================

INSERT INTO public.crm_feature_flags (flag_key, organization_id, enabled, description)
SELECT
  'crm.nav.simple',
  '00000000-0000-0000-0000-000000000001'::uuid,
  true,
  'Simple tenant navigation: flat sidebar driven by enabled crm_modules, no top module tabs.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_feature_flags
   WHERE flag_key = 'crm.nav.simple'
     AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid
);

NOTIFY pgrst, 'reload schema';
