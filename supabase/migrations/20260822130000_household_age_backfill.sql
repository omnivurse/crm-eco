-- ============================================================================
-- Household backfill: move ages typed into the Spouse / Child NAME boxes into
-- the new age fields (PIFH)
-- ----------------------------------------------------------------------------
-- Before 20260822120000 the only per-person field was the name box, so reps
-- wrote "Yes - 45", "45", "yes" or "no" in it. Measured on 2026-08-22 across
-- all 16,283 live records: 196 age markers (spouse 53, child_1 71, child_2 52,
-- child_3 18, child_4 2) and 159 yes/no markers, on 199 distinct records.
--
-- For every slot whose name box holds ONLY such a marker:
--   "Yes - 45" / "45"  → <slot>_age = 45 (unless the slot already has an age
--                        or a DOB), <slot>_age_as_of = the Zoho modified time
--                        the record arrived with when it parses, else the
--                        record's updated_at (the best available bound on
--                        when the age was written); has_spouse / has_kids = true
--   "yes" / "y"        → has_spouse / has_kids = true
--   "no" / "n" / "none"→ spouse: has_spouse = false unless already set;
--                        child: has_kids = false only when no other child slot
--                        holds anything and nothing in this pass said yes
-- and the marker text is removed from the name box so it reads as an empty
-- name rather than a number — always, even when the age could not be written,
-- so a marker that a later import re-introduces is cleaned again on re-run.
-- The original text is kept verbatim under
-- data->'household_backfill_source'->{slot}, and the record's has_spouse /
-- has_kids as they were BEFORE the first touch under ->'_prior' — together
-- that is the undo. Name boxes that hold anything else (a real name, a note,
-- a date) are NOT touched.
--
-- Triggers stay enabled: set_record_title regenerates the heading from data on
-- every data change from every write path, so this behaves like any save; the
-- NOTICE below reports how many touched records carry a heading that differs
-- from the generated one, for the push log.
--
-- Safe to re-run. Rollback (per record): restore data->>slot from
-- household_backfill_source, remove <slot>_age / <slot>_age_as_of, set
-- has_spouse / has_kids back to household_backfill_source->'_prior'
-- (dropping the key when that value is null), remove household_backfill_source.
-- ============================================================================

DO $$
DECLARE
  v_org     constant uuid := '00000000-0000-0000-0000-000000000001';
  v_slots   constant text[] := ARRAY['spouse','child_1','child_2','child_3','child_4','child_5'];
  r         record;
  v_slot    text;
  v_other   text;
  v_val     text;
  v_m       text[];
  v_age     int;
  v_asof    date;
  v_patch   jsonb;
  v_drop    text[];
  v_src     jsonb;
  v_mt      text;
  v_busy    boolean;
  v_rows    int := 0;
  v_ages    int := 0;
  v_yesno   int := 0;
  v_titles  int := 0;
BEGIN
  -- Informational: headings that will be regenerated because they differ from
  -- what generate_record_title derives from the data today.
  SELECT count(*) INTO v_titles
    FROM public.crm_records
   WHERE org_id = v_org
     AND deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM unnest(v_slots) s
        WHERE data->>s ~* '^\s*((yes|y)\s*[-–:]\s*)?\d{1,3}\s*$'
           OR data->>s ~* '^\s*(yes|y|no|n|none)\s*$')
     AND title IS DISTINCT FROM public.generate_record_title(data);
  RAISE NOTICE 'household backfill: % of the records to be touched have a heading that differs from the generated one (set_record_title will regenerate it, as on any save)', v_titles;

  FOR r IN
    SELECT id, data, updated_at
      FROM public.crm_records
     WHERE org_id = v_org
       AND deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM unnest(v_slots) s
          WHERE data->>s ~* '^\s*((yes|y)\s*[-–:]\s*)?\d{1,3}\s*$'
             OR data->>s ~* '^\s*(yes|y|no|n|none)\s*$')
  LOOP
    v_patch := '{}'::jsonb;
    v_drop  := ARRAY[]::text[];
    v_src   := COALESCE(r.data->'household_backfill_source', '{}'::jsonb);
    IF NOT (v_src ? '_prior') THEN
      v_src := v_src || jsonb_build_object('_prior',
                 jsonb_build_object('has_spouse', r.data->'has_spouse', 'has_kids', r.data->'has_kids'));
    END IF;

    -- When was this written? Prefer the Zoho modified time the record arrived
    -- with (importers have stored it under either key); fall back to
    -- updated_at. Never let an odd string abort the run.
    v_asof := NULL;
    v_mt := COALESCE(NULLIF(btrim(r.data->>'modified_time'), ''),
                     NULLIF(btrim(r.data->>'zoho_modified_time'), ''),
                     NULLIF(btrim(r.data->>'last_modified_time'), ''));
    BEGIN
      IF v_mt ~ '^\d{4}-\d{2}-\d{2}' THEN
        v_asof := left(v_mt, 10)::date;
      ELSIF v_mt ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN
        v_asof := to_date(split_part(v_mt, ' ', 1), 'MM/DD/YYYY');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_asof := NULL;
    END;
    IF v_asof IS NULL OR v_asof > CURRENT_DATE OR v_asof < DATE '1990-01-01' THEN
      v_asof := r.updated_at::date;
    END IF;

    FOREACH v_slot IN ARRAY v_slots LOOP
      v_val := NULLIF(btrim(r.data->>v_slot), '');
      CONTINUE WHEN v_val IS NULL;

      v_m := regexp_match(v_val, '^\s*(?:(?:yes|y)\s*[-–:]\s*)?(\d{1,3})\s*$', 'i');
      IF v_m IS NOT NULL THEN
        v_age := v_m[1]::int;
        CONTINUE WHEN v_age > 110;   -- not an age; leave the box alone
        -- Only write the age when the slot has neither an age (someone may
        -- have entered one since) nor a DOB (a bare digit beside a DOB is an
        -- ordinal, not an age). The marker leaves the name box either way.
        IF NULLIF(btrim(r.data->>(v_slot || '_age')), '') IS NULL
           AND NULLIF(btrim(r.data->>(v_slot || '_dob')), '') IS NULL THEN
          v_patch := v_patch
            || jsonb_build_object(v_slot || '_age', v_age,
                                  v_slot || '_age_as_of', to_char(v_asof, 'YYYY-MM-DD'));
          v_ages := v_ages + 1;
        END IF;
        -- an age marker is evidence the person exists, whether or not the age is written
        v_patch := v_patch
          || CASE WHEN v_slot = 'spouse' THEN '{"has_spouse": true}'::jsonb ELSE '{"has_kids": true}'::jsonb END;
        IF NOT (v_src ? v_slot) THEN v_src := v_src || jsonb_build_object(v_slot, v_val); END IF;
        v_drop := v_drop || v_slot;

      ELSIF v_val ~* '^\s*(yes|y)\s*$' THEN
        v_patch := v_patch
          || CASE WHEN v_slot = 'spouse' THEN '{"has_spouse": true}'::jsonb ELSE '{"has_kids": true}'::jsonb END;
        IF NOT (v_src ? v_slot) THEN v_src := v_src || jsonb_build_object(v_slot, v_val); END IF;
        v_drop := v_drop || v_slot;
        v_yesno := v_yesno + 1;

      ELSIF v_val ~* '^\s*(no|n|none)\s*$' THEN
        IF v_slot = 'spouse' THEN
          IF NULLIF(btrim(r.data->>'has_spouse'), '') IS NULL THEN
            v_patch := v_patch || '{"has_spouse": false}'::jsonb;
          END IF;
        ELSIF NULLIF(btrim(r.data->>'has_kids'), '') IS NULL
              AND (v_patch->>'has_kids') IS DISTINCT FROM 'true' THEN
          -- "no children" only when no other child slot says otherwise
          v_busy := false;
          FOREACH v_other IN ARRAY v_slots LOOP
            CONTINUE WHEN v_other = v_slot OR v_other = 'spouse';
            IF (NULLIF(btrim(r.data->>v_other), '') IS NOT NULL
                AND NOT (r.data->>v_other ~* '^\s*(no|n|none)\s*$'))
               OR NULLIF(btrim(r.data->>(v_other || '_dob')), '') IS NOT NULL
               OR NULLIF(btrim(r.data->>(v_other || '_age')), '') IS NOT NULL THEN
              v_busy := true;
            END IF;
          END LOOP;
          IF NOT v_busy THEN
            v_patch := v_patch || '{"has_kids": false}'::jsonb;
          END IF;
        END IF;
        IF NOT (v_src ? v_slot) THEN v_src := v_src || jsonb_build_object(v_slot, v_val); END IF;
        v_drop := v_drop || v_slot;
        v_yesno := v_yesno + 1;
      END IF;
    END LOOP;

    IF cardinality(v_drop) > 0 THEN
      UPDATE public.crm_records
         SET data = (data - v_drop) || v_patch
                    || jsonb_build_object('household_backfill_source', v_src)
       WHERE id = r.id;
      v_rows := v_rows + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'household backfill: % records updated — % ages moved, % yes/no markers resolved', v_rows, v_ages, v_yesno;
END $$;
