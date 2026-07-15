-- =============================================================================
-- Enable the redesigned record-detail shell (Layout V2) for everyone
-- =============================================================================
--
-- The "clean redesign" record-detail shell (RecordDetailShellV2 + the full-width
-- coverage snapshot banner and auto-fitting field sections in DynamicRecordForm)
-- has been built and shipped in code, but it is gated behind the
-- `crm.layout.v2` feature flag, whose GLOBAL default row was seeded `enabled =
-- false`. So every user still rendered the classic shell and never saw the new
-- layout.
--
-- This flips the global default to `enabled = true`, so isLayoutV2Enabled()
-- resolves true for all orgs that don't have an explicit org-scoped override and
-- for all users without a per-user `ui_preferences.crm_layout_v2` override.
-- (Precedence, unchanged: user override > org row > global row > code fallback.)
--
-- Purely a config flip — no schema change, no record data touched. Reversible:
-- set enabled = false to roll back to the classic shell instantly.
-- =============================================================================

-- Flip the existing global row on (organization_id IS NULL == the global default).
UPDATE public.crm_feature_flags
   SET enabled = true
 WHERE flag_key = 'crm.layout.v2'
   AND organization_id IS NULL;

-- Defensive: create the global row enabled on any environment where it is
-- missing (e.g. a fresh DB), so the layout is on there too. The partial unique
-- index uq_crm_feature_flags_global_key guarantees at most one global row.
INSERT INTO public.crm_feature_flags (flag_key, organization_id, enabled, description)
SELECT 'crm.layout.v2', NULL, true, 'Redesigned record-detail shell (Layout V2).'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_feature_flags
   WHERE flag_key = 'crm.layout.v2' AND organization_id IS NULL
);

NOTIFY pgrst, 'reload schema';
