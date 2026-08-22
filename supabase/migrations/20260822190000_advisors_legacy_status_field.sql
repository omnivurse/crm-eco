-- ============================================================================
-- Advisors: define the "Legacy status (imported)" field like the other modules
-- ----------------------------------------------------------------------------
-- 20260821160000 normalised 18 advisor records ("Active ADVISOR" → Active) and
-- kept the original under data.legacy_status — but only contacts / leads /
-- members had a crm_fields definition for that key, so on advisors the value
-- was invisible (audit:crm-visibility: "18 legacy_status advisors"). Same
-- read-only system field, same section, so the undo trail is visible
-- everywhere it exists.
-- Additive, idempotent. Rollback: DELETE FROM crm_fields WHERE key =
-- 'legacy_status' AND metadata->>'source' = 'advisors_legacy_status_20260822'.
-- ============================================================================
DO $$
DECLARE
  v_org constant uuid := '00000000-0000-0000-0000-000000000001';
  v_advisors uuid; v_n int;
BEGIN
  SELECT id INTO v_advisors FROM public.crm_modules WHERE org_id = v_org AND key = 'advisors';
  IF v_advisors IS NULL THEN
    RAISE EXCEPTION 'PIFH advisors module not found — refusing to run against a bare database';
  END IF;
  INSERT INTO public.crm_fields
    (org_id, module_id, key, label, type, options, validation, section, display_order, width, required, tooltip, metadata)
  VALUES
    (v_org, v_advisors, 'legacy_status', 'Legacy status (imported)', 'text', '[]'::jsonb, '{}'::jsonb,
       'system', 990, 'half', false,
       'The status label this record carried before the vocabulary cleanup — kept for the audit trail.',
       jsonb_build_object('source', 'advisors_legacy_status_20260822', 'read_only', true))
  ON CONFLICT (module_id, key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'advisors legacy_status field: % added', v_n;
END $$;
