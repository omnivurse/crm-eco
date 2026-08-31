-- ============================================================================
-- Product card: one Coverage End Date, two start dates (PIFH)
-- ----------------------------------------------------------------------------
-- The Product ("insurance") card showed FOUR start dates and no end date at
-- all. Measured across 7,655 contacts on 2026-08-30:
--
--   original_start_date       indexed column   5,569   KEEP
--   current_year_start_date   indexed column   5,502   KEEP
--   start_date                JSONB only       5,566   legacy Zoho mirror
--   insurance_effective_date  JSONB only           2   dead
--
-- The two keepers are not redundant — of the records holding both, 4,295
-- DIFFER and only 1,207 match. Original enrolment and current plan year are
-- separate facts.
--
-- The missing end date was not missing at all: `cancellation_date` sits on
-- contacts.insurance and was suppressed in the UI as a "legacy duplicate"
-- (LEGACY_DUPLICATE_END_DATE_KEYS). With no visible field, nobody filled one
-- in — 6,421 records carry status Cancelled and 4 contacts carry a
-- cancellation date. This gives that column its label back.
--
-- WHY cancellation_date AND NOT A NEW coverage_end_date KEY: it is the indexed
-- column, so it filters, sorts and reports; it is already defined here; and it
-- is the exact key the scheduled-cancel job writes. `coverage_end_date`,
-- `end_date`, `termination_date` and `insurance_end_date` hold 0 records
-- between them — a new key would be a sixth spelling of a thing already spelt
-- five ways.
--
-- READ THIS BEFORE USING THE FIELD. Any coverage end date makes
-- resolveEffectiveEndDate() non-null, and the scheduled-cancel job then flips
-- the record to Cancelled on the 1st of that month
-- (lib/crm/scheduled-end-date-cancel.ts). That is the intended meaning of
-- "coverage ended", but it is NOT a neutral date box, so the tooltip says so
-- in the field itself. Cancellation behaviour is unchanged by this migration:
-- MEMBERSHIP_CANCELLATION_END_DATE_KEYS still lists cancellation_date first.
--
-- Record data is NOT touched. The two retired start dates are hidden in the UI
-- only, and only where they AGREE with original_start_date — the 11 rows that
-- disagree and the 2 that are mirror-only stay visible for review
-- (lib/crm/product-start-date-fields.ts). Every value stays in JSONB.
--
-- Idempotent: label/tooltip rewritten only when they differ; the members field
-- is ON CONFLICT DO NOTHING. Safe to re-run.
--
-- Rollback:
--   UPDATE public.crm_fields
--      SET label = 'Cancellation Date', tooltip = NULL
--    WHERE key = 'cancellation_date' AND label = 'Coverage End Date'
--      AND module_id IN (SELECT id FROM public.crm_modules
--                         WHERE org_id = '00000000-0000-0000-0000-000000000001');
--   DELETE FROM public.crm_fields
--    WHERE key = 'cancellation_date'
--      AND metadata->>'source' = 'product_dates_20260831';
-- ============================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

DO $$
DECLARE
  v_org    constant uuid := '00000000-0000-0000-0000-000000000001';
  v_source constant text := 'product_dates_20260831';
  v_label  constant text := 'Coverage End Date';
  v_tip    constant text :=
    'The day coverage ends. Setting this schedules the record to move to '
    'Cancelled on the 1st of that month — leave it blank while coverage is active.';
  v_mod   record;
  v_n     int;
  v_lbl   int := 0;
  v_added int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RAISE NOTICE '20260831120000_product_coverage_end_date: org % not present (fresh database) — skipped', v_org;
    RETURN;
  END IF;

  FOR v_mod IN
    SELECT id, key FROM public.crm_modules
     WHERE org_id = v_org AND key IN ('contacts', 'members')
     ORDER BY key
  LOOP
    -- Label + definition on the existing column-backed field. Scoped to the
    -- Product band: leads keep `cancellation_date` in their `system` section as
    -- the back-office stamp it has always been, and are not touched here.
    UPDATE public.crm_fields
       SET label   = v_label,
           tooltip = v_tip,
           section = 'insurance',
           display_order = 15,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('source', v_source)
     WHERE module_id = v_mod.id
       AND key = 'cancellation_date'
       AND (label IS DISTINCT FROM v_label OR tooltip IS DISTINCT FROM v_tip);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_lbl := v_lbl + v_n;

    -- members has no cancellation_date field at all, so a member's coverage end
    -- had nowhere to go. organization_id is set explicitly: crm_fields RLS
    -- reads it, and a NULL would define the field then hide it from everyone.
    INSERT INTO public.crm_fields
      (org_id, organization_id, module_id, key, label, type, options, validation,
       section, display_order, width, required, tooltip, metadata)
    VALUES
      (v_org, v_org, v_mod.id, 'cancellation_date', v_label, 'date',
       '[]'::jsonb, '{}'::jsonb, 'insurance', 15, 'half', false, v_tip,
       jsonb_build_object('source', v_source))
    ON CONFLICT (module_id, key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_added := v_added + v_n;
  END LOOP;

  RAISE NOTICE 'product coverage end date: % relabelled, % added', v_lbl, v_added;
END $$;

-- ============================================================================
-- Verify (read-only):
--
--   SELECT m.key AS module, f.key, f.label, f.section, f.display_order, f.tooltip
--     FROM public.crm_fields f JOIN public.crm_modules m ON m.id = f.module_id
--    WHERE f.key = 'cancellation_date'
--    ORDER BY m.key;
--   -- expect contacts + members = "Coverage End Date" in section `insurance`;
--   -- leads unchanged in `system`.
--
--   -- The 13 records whose legacy start_date still disagrees — these keep
--   -- showing the mirror field until somebody reconciles them.
--   SELECT id, title, data->>'start_date' AS legacy, original_start_date::date
--     FROM public.crm_records
--    WHERE org_id = '00000000-0000-0000-0000-000000000001' AND deleted_at IS NULL
--      AND data->>'start_date' IS NOT NULL
--      AND (original_start_date IS NULL
--           OR (data->>'start_date')::date <> original_start_date::date)
--    ORDER BY title;
-- ============================================================================
