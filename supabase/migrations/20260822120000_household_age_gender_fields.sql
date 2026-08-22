-- ============================================================================
-- Household members: gender + age per Spouse / Child slot (PIFH)
-- ----------------------------------------------------------------------------
-- The first conversation with a prospect captures "spouse, 45, female; two kids,
-- 20 and 18" — not names and not dates of birth. The Family section only had a
-- NAME text box and a DOB per slot, so ages were being typed into the name box
-- ("Yes - 45", "45"). For each of spouse, child_1 … child_5 this adds:
--   <slot>_gender      select  Male / Female (same options as the contact's own Gender)
--   <slot>_age         number  current age (0–120), for when the date of birth is unknown
--   <slot>_age_as_of   date    the day that age was recorded — set by a trigger so
--                              the number keeps its meaning as the years pass
-- and re-orders each slot to read Gender → Age → Age recorded on → DOB → Name →
-- SSN / Address / Phone / Email, relabelling the bare "Spouse" / "Child N" name
-- boxes as "… Name". has_spouse / has_kids already exist on both modules
-- (contacts: family_* sections; leads: core), so the paired backfill
-- (20260822130000) can write them on either. Nothing becomes required.
-- Lead → contact conversion copies the whole lead blob (202606180002), so
-- these keys carry over unchanged.
--
-- Additive and idempotent. Rollback:
--   DELETE FROM crm_fields WHERE metadata->>'source' = 'household_age_gender_20260822';
--   DROP TRIGGER IF EXISTS crm_household_age_as_of_trg ON crm_records;
--   DROP FUNCTION IF EXISTS crm_household_age_as_of();
--   (the relabel / reorder UPDATEs below are cosmetic; previous values are
--    recorded in metadata->'previous' on each touched row)
-- ============================================================================

DO $$
DECLARE
  v_org      constant uuid := '00000000-0000-0000-0000-000000000001';
  v_source   constant text := 'household_age_gender_20260822';
  v_contacts uuid;
  v_leads    uuid;
  v_slot     text;
  v_i        int;
  v_base     int;
  v_label    text;
  v_section  text;
  v_added    int := 0;
  v_moved    int := 0;
  v_n        int;
  v_new_keys text[];
BEGIN
  SELECT id INTO v_contacts FROM public.crm_modules WHERE org_id = v_org AND key = 'contacts';
  SELECT id INTO v_leads    FROM public.crm_modules WHERE org_id = v_org AND key = 'leads';
  IF v_contacts IS NULL OR v_leads IS NULL THEN
    RAISE EXCEPTION 'PIFH contacts/leads module not found — refusing to run against a bare database';
  END IF;

  -- The keys we are about to claim. If any already exists with a different
  -- origin, stop: it means the name is already in use for something else
  -- (the contact_role lesson, 20260821180000).
  SELECT array_agg(s || sfx)
    INTO v_new_keys
    FROM unnest(ARRAY['spouse','child_1','child_2','child_3','child_4','child_5']) s,
         unnest(ARRAY['_gender','_age','_age_as_of']) sfx;
  SELECT count(*) INTO v_n
    FROM public.crm_fields
   WHERE module_id IN (v_contacts, v_leads)
     AND key = ANY (v_new_keys)
     AND COALESCE(metadata->>'source','') <> v_source;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'household keys already defined with another meaning (% rows) — inspect before proceeding', v_n;
  END IF;
  -- Both modules must already carry the yes/no flags the backfill writes.
  IF (SELECT count(DISTINCT module_id) FROM public.crm_fields
       WHERE module_id IN (v_contacts, v_leads) AND key IN ('has_spouse','has_kids')) < 2 THEN
    RAISE EXCEPTION 'has_spouse / has_kids are not defined on both contacts and leads — define them before the backfill';
  END IF;

  -- ---------------------------------------------------------------------
  -- 1. New fields, per slot, per module. Section + order are chosen so the
  --    slot reads Gender → Age → Age recorded on → DOB → Name → the rest.
  -- ---------------------------------------------------------------------
  FOR v_i IN 0..5 LOOP
    v_slot  := CASE WHEN v_i = 0 THEN 'spouse' ELSE 'child_' || v_i END;
    v_label := CASE WHEN v_i = 0 THEN 'Spouse' ELSE 'Child ' || v_i END;

    -- contacts: spouse block starts at 30 (has_spouse), children at 40 (has_kids)
    v_section := CASE WHEN v_i = 0 THEN 'family_spouse' ELSE 'family_children' END;
    v_base    := CASE WHEN v_i = 0 THEN 31 ELSE 41 + (v_i - 1) * 9 END;
    INSERT INTO public.crm_fields
      (org_id, module_id, key, label, type, options, validation, section, display_order, width, required, tooltip, metadata)
    VALUES
      (v_org, v_contacts, v_slot || '_gender', v_label || ' Gender', 'select', '["Male","Female"]'::jsonb, '{}'::jsonb,
         v_section, v_base, 'half', false, NULL, jsonb_build_object('source', v_source)),
      (v_org, v_contacts, v_slot || '_age', v_label || ' Age', 'number', '[]'::jsonb, '{"min": 0, "max": 120}'::jsonb,
         v_section, v_base + 1, 'half', false,
         'Current age when the date of birth is not known. The date it was recorded is kept automatically, so the age stays right as years pass.',
         jsonb_build_object('source', v_source)),
      (v_org, v_contacts, v_slot || '_age_as_of', v_label || ' Age Recorded On', 'date', '[]'::jsonb, '{}'::jsonb,
         v_section, v_base + 2, 'half', false,
         'Filled in automatically when the age is entered or changed.',
         jsonb_build_object('source', v_source))
    ON CONFLICT (module_id, key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;

    -- leads: single 'family' section (has_spouse / has_kids live in core);
    -- spouse block 28–32, children from 34 in blocks of 5
    v_base := CASE WHEN v_i = 0 THEN 28 ELSE 34 + (v_i - 1) * 5 END;
    INSERT INTO public.crm_fields
      (org_id, module_id, key, label, type, options, validation, section, display_order, width, required, tooltip, metadata)
    VALUES
      (v_org, v_leads, v_slot || '_gender', v_label || ' Gender', 'select', '["Male","Female"]'::jsonb, '{}'::jsonb,
         'family', v_base, 'half', false, NULL, jsonb_build_object('source', v_source)),
      (v_org, v_leads, v_slot || '_age', v_label || ' Age', 'number', '[]'::jsonb, '{"min": 0, "max": 120}'::jsonb,
         'family', v_base + 1, 'half', false,
         'Current age when the date of birth is not known. The date it was recorded is kept automatically, so the age stays right as years pass.',
         jsonb_build_object('source', v_source)),
      (v_org, v_leads, v_slot || '_age_as_of', v_label || ' Age Recorded On', 'date', '[]'::jsonb, '{}'::jsonb,
         'family', v_base + 2, 'half', false,
         'Filled in automatically when the age is entered or changed.',
         jsonb_build_object('source', v_source))
    ON CONFLICT (module_id, key) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_added := v_added + v_n;
  END LOOP;

  -- ---------------------------------------------------------------------
  -- 2. Relabel the bare name boxes and re-order the existing slot fields so
  --    the new ones sit where they belong. Ordering is per section, so these
  --    numbers only need to be consistent inside family_spouse /
  --    family_children (contacts) and family (leads). Previous values are
  --    kept in metadata->'previous' for an exact undo.
  -- ---------------------------------------------------------------------
  WITH target AS (
    -- contacts
    SELECT v_contacts AS module_id, 'has_spouse'          AS key, NULL::text AS new_label, 30 AS ord UNION ALL
    SELECT v_contacts, 'spouse_dob',          NULL,           34 UNION ALL
    SELECT v_contacts, 'spouse',              'Spouse Name',  35 UNION ALL
    SELECT v_contacts, 'spouse_ss_number',    NULL,           36 UNION ALL
    SELECT v_contacts, 'spouse_address',      NULL,           37 UNION ALL
    SELECT v_contacts, 'spouse_phone_number', NULL,           38 UNION ALL
    SELECT v_contacts, 'spouse_email',        NULL,           39 UNION ALL
    SELECT v_contacts, 'has_kids',            NULL,           40 UNION ALL
    SELECT v_contacts, 'child_'||i||'_dob',          NULL,                 41 + (i-1)*9 + 3 FROM generate_series(1,5) i UNION ALL
    SELECT v_contacts, 'child_'||i,                  'Child '||i||' Name', 41 + (i-1)*9 + 4 FROM generate_series(1,5) i UNION ALL
    SELECT v_contacts, 'child_'||i||'_ss_number',    NULL,                 41 + (i-1)*9 + 5 FROM generate_series(1,5) i UNION ALL
    SELECT v_contacts, 'child_'||i||'_address',      NULL,                 41 + (i-1)*9 + 6 FROM generate_series(1,5) i UNION ALL
    SELECT v_contacts, 'child_'||i||'_phone_number', NULL,                 41 + (i-1)*9 + 7 FROM generate_series(1,5) i UNION ALL
    SELECT v_contacts, 'child_'||i||'_email',        NULL,                 41 + (i-1)*9 + 8 FROM generate_series(1,5) i UNION ALL
    -- leads
    SELECT v_leads, 'spouse_dob',       NULL,                 31 UNION ALL
    SELECT v_leads, 'spouse',           'Spouse Name',        32 UNION ALL
    SELECT v_leads, 'child_'||i||'_dob', NULL,                34 + (i-1)*5 + 3 FROM generate_series(1,5) i UNION ALL
    SELECT v_leads, 'child_'||i,         'Child '||i||' Name', 34 + (i-1)*5 + 4 FROM generate_series(1,5) i
  ),
  upd AS (
    UPDATE public.crm_fields f
       SET display_order = t.ord,
           -- only relabel the bare generic label; leave any customised label alone
           label = CASE
                     WHEN t.new_label IS NOT NULL
                      AND f.label IN ('Spouse', 'Child 1', 'Child 2', 'Child 3', 'Child 4', 'Child 5')
                     THEN t.new_label ELSE f.label END,
           metadata = COALESCE(f.metadata, '{}'::jsonb)
                      || jsonb_build_object('previous',
                           COALESCE(f.metadata->'previous', '{}'::jsonb)
                           || jsonb_build_object(v_source, jsonb_build_object('label', f.label, 'display_order', f.display_order)))
      FROM target t
     WHERE f.module_id = t.module_id AND f.key = t.key
       AND (f.display_order IS DISTINCT FROM t.ord
            OR (t.new_label IS NOT NULL AND f.label IN ('Spouse','Child 1','Child 2','Child 3','Child 4','Child 5')))
     RETURNING 1
  )
  SELECT count(*) INTO v_moved FROM upd;

  RAISE NOTICE 'household fields: % added, % existing rows relabelled/re-ordered', v_added, v_moved;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Keep "<slot>_age_as_of" honest without anyone having to think about it.
--    Whenever an age is entered or changed and the caller did not supply a
--    recorded-on date, stamp today; when an age is cleared, clear the date.
--    Callers that DO set the date (the backfill, the CSV-update path) keep
--    theirs. A representation-only change (45 → 45.0, "45" → 45) is not a
--    change. Untouched on every other update — the function only rewrites
--    NEW.data when an age actually changed, so it cannot disturb unrelated
--    writes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_household_age_as_of()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_slot    text;
  v_new_age text;
  v_old_age text;
  v_new_at  text;
  v_old_at  text;
BEGIN
  IF NEW.data IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH v_slot IN ARRAY ARRAY['spouse','child_1','child_2','child_3','child_4','child_5'] LOOP
    v_new_age := NULLIF(btrim(NEW.data->>(v_slot || '_age')), '');
    v_old_age := CASE WHEN TG_OP = 'UPDATE' THEN NULLIF(btrim(OLD.data->>(v_slot || '_age')), '') END;

    -- Changed, and not merely re-spelled (45 → 45.0). The IS NOT NULL guards
    -- keep the comparison from collapsing to NULL on INSERT / first entry.
    IF v_new_age IS DISTINCT FROM v_old_age
       AND NOT (v_new_age IS NOT NULL AND v_old_age IS NOT NULL
                AND v_new_age ~ '^-?\d+(\.\d+)?$' AND v_old_age ~ '^-?\d+(\.\d+)?$'
                AND v_new_age::numeric = v_old_age::numeric) THEN
      v_new_at := NULLIF(btrim(NEW.data->>(v_slot || '_age_as_of')), '');
      v_old_at := CASE WHEN TG_OP = 'UPDATE' THEN NULLIF(btrim(OLD.data->>(v_slot || '_age_as_of')), '') END;

      IF v_new_age IS NULL THEN
        NEW.data := NEW.data - (v_slot || '_age_as_of');
      ELSIF v_new_at IS NOT DISTINCT FROM v_old_at THEN
        NEW.data := NEW.data || jsonb_build_object(v_slot || '_age_as_of', to_char(CURRENT_DATE, 'YYYY-MM-DD'));
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_household_age_as_of_trg ON public.crm_records;
CREATE TRIGGER crm_household_age_as_of_trg
  BEFORE INSERT OR UPDATE OF data ON public.crm_records
  FOR EACH ROW EXECUTE FUNCTION public.crm_household_age_as_of();

COMMENT ON FUNCTION public.crm_household_age_as_of() IS
  'Stamps <slot>_age_as_of (spouse, child_1..5) when an age is entered/changed without a date; clears it when the age is cleared. No-op otherwise.';
