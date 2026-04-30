-- =============================================================================
-- Pay It Forward (canonical org) — harden crm_records.module_id
-- -----------------------------------------------------------------------------
-- Rows on 000…0001 whose module_id points outside that org break RLS embeds
-- (`crm_modules` join) and the CRM shows “record not found”.
--
-- Mirrors server-side `alignMisalignedRecordModule` as a bulk idempotent heal.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_org    CONSTANT uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_fb     uuid;
  n_keyed  bigint;
  n_fb     bigint;
  n_null   bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org) THEN
    RETURN;
  END IF;

  SELECT cm.id INTO v_fb
  FROM public.crm_modules cm
  WHERE cm.org_id = v_org AND cm.key = 'contacts' AND cm.is_enabled = true
  ORDER BY cm.display_order NULLS LAST
  LIMIT 1;

  IF v_fb IS NULL THEN
    SELECT cm.id INTO v_fb
    FROM public.crm_modules cm
    WHERE cm.org_id = v_org AND cm.is_enabled = true
    ORDER BY cm.display_order NULLS LAST, cm.created_at
    LIMIT 1;
  END IF;

  IF v_fb IS NULL THEN
    RAISE NOTICE '[pifh-module-heal] no fallback module row for org % — skipped', v_org;
    RETURN;
  END IF;

  UPDATE public.crm_records r
     SET module_id = canon.id,
         updated_at = now()
    FROM public.crm_modules wrong,
         public.crm_modules canon
   WHERE r.org_id = v_org
     AND r.module_id = wrong.id
     AND wrong.org_id IS DISTINCT FROM r.org_id
     AND canon.org_id = r.org_id
     AND canon.key = wrong.key
     AND canon.is_enabled = true;

  GET DIAGNOSTICS n_keyed = ROW_COUNT;
  IF n_keyed > 0 THEN
    RAISE NOTICE '[pifh-module-heal] same-key remap: %', n_keyed;
  END IF;

  UPDATE public.crm_records
     SET module_id = v_fb,
         updated_at = now()
   WHERE org_id = v_org
     AND EXISTS (
       SELECT 1
       FROM public.crm_modules mm
       WHERE mm.id = crm_records.module_id
         AND mm.org_id IS DISTINCT FROM crm_records.org_id
     );

  GET DIAGNOSTICS n_fb = ROW_COUNT;
  IF n_fb > 0 THEN
    RAISE NOTICE '[pifh-module-heal] fallback remap (contacts / first enabled): %', n_fb;
  END IF;

  UPDATE public.crm_records
     SET module_id = v_fb,
         updated_at = now()
   WHERE org_id = v_org AND module_id IS NULL;

  GET DIAGNOSTICS n_null = ROW_COUNT;
  IF n_null > 0 THEN
    RAISE NOTICE '[pifh-module-heal] NULL module_id → fallback: %', n_null;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
