-- =============================================================================
-- PIFH: restore the full CRM tab strip + contextual sidebar
-- =============================================================================
--
-- 20260817180100 enabled crm.nav.simple for Pay It Forward Health, which hid
-- the 7-tab module bar (CRM / Communications / Revenue / Operations /
-- Analytics / Integrations / Settings) and replaced the sidebar with a short
-- flat list. Operators need those links back.
--
-- Scope: ONE configuration row. Additive. No schema change, no record data.
-- Idempotent (no-op when the flag is already off or the row is absent).
--
-- ROLLBACK:
--   UPDATE public.crm_feature_flags SET enabled = true
--    WHERE flag_key = 'crm.nav.simple'
--      AND organization_id = '00000000-0000-0000-0000-000000000001';
-- =============================================================================

UPDATE public.crm_feature_flags
SET
  enabled = false,
  description = 'Simple tenant navigation (disabled: restore full tab strip and contextual sidebar).',
  updated_at = now()
WHERE flag_key = 'crm.nav.simple'
  AND organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND enabled = true;

NOTIFY pgrst, 'reload schema';
