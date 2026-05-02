-- Collapse the legacy `insurance_*` fields into the new `health_insurance_*` schema.
--
-- Migration 003 hid the duplicate "Insurance Products" section and moved the
-- Phase-2 `insurance_*` field ROWS into the `health_insurance` section. That
-- left reps seeing two carrier dropdowns, two plan-name inputs, etc., side by
-- side under one section header. This migration removes that duplication:
--
--   1. For each record under contacts/leads/members, copy each legacy JSONB
--      value into the corresponding new key — but only when the new key is
--      empty/missing, so we never overwrite real ACA data with shorthand.
--   2. Delete the legacy field rows from `crm_fields` so the form renders one
--      input per piece of information. The original JSONB values stay in
--      `crm_records.data` (we only remove the *field config*, not the data),
--      so the historical values are recoverable by re-adding the field rows.
--
-- `insurance_client_pays` is intentionally preserved: there's no direct equivalent
-- in the new schema (it's the post-subsidy net pay, which `premium - tax_credit`
-- approximates but reps sometimes record explicitly). It already lives in the
-- `health_insurance` section after migration 003, so it renders as one extra
-- "Client Pays" line and stays editable.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Copy legacy → new JSONB values, only when new key has no value yet.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
  pair record;
  new_data jsonb;
  legacy_val jsonb;
  new_val_text text;
BEGIN
  FOR r IN
    SELECT cr.id, cr.data
      FROM public.crm_records cr
      JOIN public.crm_modules m ON m.id = cr.module_id
     WHERE m.key IN ('contacts', 'leads', 'members')
       AND cr.data IS NOT NULL
       AND (
            cr.data ? 'insurance_carrier'
         OR cr.data ? 'insurance_plan_name'
         OR cr.data ? 'insurance_full_cost'
         OR cr.data ? 'insurance_subsidy_amount'
         OR cr.data ? 'insurance_effective_date'
         OR cr.data ? 'insurance_status'
       )
  LOOP
    new_data := r.data;
    FOR pair IN
      SELECT * FROM (VALUES
        ('insurance_carrier',         'health_insurance_carrier'),
        ('insurance_plan_name',       'health_insurance_plan_name'),
        ('insurance_full_cost',       'health_insurance_premium'),
        ('insurance_subsidy_amount',  'health_insurance_tax_credit_amount'),
        ('insurance_effective_date',  'health_insurance_start_date'),
        ('insurance_status',          'health_insurance_status')
      ) AS t(legacy_key, new_key)
    LOOP
      legacy_val := new_data->pair.legacy_key;
      new_val_text := new_data->>pair.new_key;
      IF legacy_val IS NOT NULL
         AND legacy_val::text NOT IN ('null', '""')
         AND (new_val_text IS NULL OR new_val_text = '')
      THEN
        new_data := jsonb_set(new_data, ARRAY[pair.new_key], legacy_val, true);
      END IF;
    END LOOP;

    IF new_data IS DISTINCT FROM r.data THEN
      UPDATE public.crm_records
         SET data = new_data,
             updated_at = now()
       WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Remove the duplicate field rows. Field config only — JSONB data preserved.
-- ────────────────────────────────────────────────────────────────────────────
DELETE FROM public.crm_fields f
 USING public.crm_modules m
 WHERE m.id = f.module_id
   AND m.key IN ('contacts', 'leads', 'members')
   AND f.key IN (
     'insurance_carrier',
     'insurance_plan_name',
     'insurance_full_cost',
     'insurance_subsidy_amount',
     'insurance_effective_date',
     'insurance_status'
   );

NOTIFY pgrst, 'reload schema';
