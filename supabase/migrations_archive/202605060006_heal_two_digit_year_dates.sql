-- Heal date values whose year was parsed as a 2-digit AD year.
--
-- Symptom: contact / member detail pages show "Original Start Date: Jun 1, 0026"
-- next to "Start Date: Jun 1, 2026". Cause: `_parse_import_date()` and several
-- direct `(text)::date` casts accepted strings like "6/1/26" and Postgres
-- interpreted the 2-digit year as 26 AD, persisting `0026-06-01`. This affected
-- both the indexed DATE columns on `crm_records` and the JSONB `data` keys.
--
-- Pivot rule (uniform across every date field):
--   year 0..29  → +2000 years   (00 → 2000, 26 → 2026, 29 → 2029)
--   year 30..99 → +1900 years   (30 → 1930, 68 → 1968, 99 → 1999)
--
-- Field-by-field reasoning:
--   - Coverage start dates (start_date, sharing_effective_date, *_start_date,
--     *_effective_date, *_end_date) sit in 2014..2030 in real data → pivot is safe.
--   - DOBs (date_of_birth, spouse_dob, child_*_dob) sit in 1920..2025 → pivot is safe.
--   - Other ad-hoc dates (date_referral_paid, fulfillment_*, cirrus_registration_date,
--     wc_outreach_date, complete_date) are operational dates from 2018..now → pivot safe.
--
-- Datetime fields (cancellation_date, *_time, last_activity_time, etc.) are not
-- touched — `_parse_import_datetime()` uses `::timestamptz` which has different
-- parsing rules, and we have no evidence of corruption in those columns.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Heal indexed DATE columns on crm_records
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.crm_records
   SET original_start_date = original_start_date + INTERVAL '2000 years',
       updated_at = now()
 WHERE original_start_date IS NOT NULL
   AND EXTRACT(YEAR FROM original_start_date) BETWEEN 0 AND 29;

UPDATE public.crm_records
   SET original_start_date = original_start_date + INTERVAL '1900 years',
       updated_at = now()
 WHERE original_start_date IS NOT NULL
   AND EXTRACT(YEAR FROM original_start_date) BETWEEN 30 AND 99;

UPDATE public.crm_records
   SET current_year_start_date = current_year_start_date + INTERVAL '2000 years',
       updated_at = now()
 WHERE current_year_start_date IS NOT NULL
   AND EXTRACT(YEAR FROM current_year_start_date) BETWEEN 0 AND 29;

UPDATE public.crm_records
   SET current_year_start_date = current_year_start_date + INTERVAL '1900 years',
       updated_at = now()
 WHERE current_year_start_date IS NOT NULL
   AND EXTRACT(YEAR FROM current_year_start_date) BETWEEN 30 AND 99;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Heal JSONB date keys across every record
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
  k text;
  date_keys constant text[] := ARRAY[
    -- Coverage start / effective / end dates
    'start_date',
    'sharing_effective_date',
    'insurance_effective_date',
    'health_insurance_start_date',
    'health_insurance_end_date',
    'vision_start_date',
    'vision_end_date',
    'dental_start_date',
    'dental_end_date',
    'other_start_date',
    'other_end_date',
    'life_start_date',
    -- Birth dates
    'date_of_birth',
    'spouse_dob',
    'child_1_dob',
    'child_2_dob',
    'child_3_dob',
    'child_4_dob',
    'child_5_dob',
    -- Operational dates
    'date_referral_paid',
    'cirrus_registration_date',
    'wc_outreach_date',
    'fulfillment_letter_mailed',
    'fulfillment_email_sent',
    'complete_date',
    'next_step_date'
  ];
  current_val text;
  parsed_date date;
  fixed_date date;
  fixed_text text;
  yr int;
  new_data jsonb;
  changed boolean;
BEGIN
  FOR r IN
    SELECT id, data FROM public.crm_records
     WHERE data IS NOT NULL
       AND data != '{}'::jsonb
  LOOP
    new_data := r.data;
    changed := false;

    FOREACH k IN ARRAY date_keys LOOP
      current_val := new_data->>k;
      IF current_val IS NULL OR current_val = '' THEN
        CONTINUE;
      END IF;

      -- Only act on ISO-shaped strings; that's the format `_parse_import_date`
      -- emits via jsonb_build_object, and a 2-digit-year date column rendered
      -- as text comes out as e.g. "0026-06-01".
      IF current_val !~ '^\d{4}-\d{2}-\d{2}' THEN
        CONTINUE;
      END IF;

      BEGIN
        parsed_date := substring(current_val from 1 for 10)::date;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      yr := EXTRACT(YEAR FROM parsed_date)::int;

      IF yr BETWEEN 0 AND 29 THEN
        fixed_date := parsed_date + INTERVAL '2000 years';
      ELSIF yr BETWEEN 30 AND 99 THEN
        fixed_date := parsed_date + INTERVAL '1900 years';
      ELSE
        CONTINUE;
      END IF;

      fixed_text := to_char(fixed_date, 'YYYY-MM-DD');
      new_data := jsonb_set(new_data, ARRAY[k], to_jsonb(fixed_text), true);
      changed := true;
    END LOOP;

    IF changed THEN
      UPDATE public.crm_records
         SET data = new_data,
             updated_at = now()
       WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Re-sync indexed columns from JSONB where they still disagree (e.g. JSONB
--    was already correct but the DATE column held a stale 2-digit-year value).
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.crm_records r
   SET original_start_date = (r.data->>'start_date')::date,
       updated_at = now()
 WHERE r.data ? 'start_date'
   AND r.data->>'start_date' ~ '^\d{4}-\d{2}-\d{2}'
   AND EXTRACT(YEAR FROM (r.data->>'start_date')::date) > 1900
   AND r.original_start_date IS DISTINCT FROM (r.data->>'start_date')::date
   AND (
        r.original_start_date IS NULL
     OR EXTRACT(YEAR FROM r.original_start_date) < 1900
   );

NOTIFY pgrst, 'reload schema';
