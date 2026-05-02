-- Harden `_parse_import_date` so 2-digit-year inputs ("6/1/26") never again
-- land as low-AD years ("0026-06-01") in the database.
--
-- Original (202602150009): `text::date` first, then to_date(MM/DD/YYYY), then
-- to_date(YYYY-MM-DD). Postgres `text::date` accepts 2-digit years and parses
-- them as low-AD years under default datestyle, which is the bug source.
--
-- New version: try formats in order, validate the resulting year, and apply a
-- Y2K pivot when an explicit 2-digit-year format is used:
--   year 0..29  → +2000 (00 → 2000, 26 → 2026)
--   year 30..99 → +1900 (30 → 1930, 99 → 1999)
--
-- We also reject parse results outside 1900..2100 to catch any other ambiguous
-- formats (e.g. "6-1-26") that slip through.

CREATE OR REPLACE FUNCTION _parse_import_date(date_str text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
  v_result date;
  v_year int;
BEGIN
  IF date_str IS NULL THEN
    RETURN NULL;
  END IF;

  v_clean := btrim(date_str);
  IF v_clean = '' OR v_clean = '0000-00-00' OR lower(v_clean) IN ('null', 'n/a', '-') THEN
    RETURN NULL;
  END IF;

  -- 1. ISO YYYY-MM-DD (most common, low ambiguity)
  IF v_clean ~ '^\d{4}-\d{2}-\d{2}(\s|T|$)' THEN
    BEGIN
      v_result := to_date(substring(v_clean from 1 for 10), 'YYYY-MM-DD');
      v_year := EXTRACT(YEAR FROM v_result)::int;
      IF v_year BETWEEN 1900 AND 2100 THEN
        RETURN v_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 2. MM/DD/YYYY (US standard, 4-digit year)
  IF v_clean ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
    BEGIN
      v_result := to_date(v_clean, 'FMMM/FMDD/YYYY');
      v_year := EXTRACT(YEAR FROM v_result)::int;
      IF v_year BETWEEN 1900 AND 2100 THEN
        RETURN v_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 3. MM/DD/YY (2-digit year — apply Y2K pivot, NEVER trust raw)
  IF v_clean ~ '^\d{1,2}/\d{1,2}/\d{2}$' THEN
    BEGIN
      v_result := to_date(v_clean, 'FMMM/FMDD/YY');
      v_year := EXTRACT(YEAR FROM v_result)::int;
      -- to_date with YY may already pivot; normalise regardless.
      IF v_year BETWEEN 0 AND 29 THEN
        RETURN v_result + INTERVAL '2000 years';
      ELSIF v_year BETWEEN 30 AND 99 THEN
        RETURN v_result + INTERVAL '1900 years';
      ELSIF v_year BETWEEN 1900 AND 2100 THEN
        -- to_date already produced a sane 4-digit year (Postgres ≥ 12 pivots).
        RETURN v_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 4. YYYY/MM/DD (rare but possible)
  IF v_clean ~ '^\d{4}/\d{1,2}/\d{1,2}$' THEN
    BEGIN
      v_result := to_date(v_clean, 'YYYY/FMMM/FMDD');
      v_year := EXTRACT(YEAR FROM v_result)::int;
      IF v_year BETWEEN 1900 AND 2100 THEN
        RETURN v_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 5. MM-DD-YYYY / DD-MM-YYYY ambiguous — try MDY first
  IF v_clean ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN
    BEGIN
      v_result := to_date(v_clean, 'FMMM-FMDD-YYYY');
      v_year := EXTRACT(YEAR FROM v_result)::int;
      IF v_year BETWEEN 1900 AND 2100 THEN
        RETURN v_result;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- 6. Last-resort: explicit cast, but reject if year < 1900 to avoid the
  --    historic bug where '6/1/26'::date returned 0026-06-01.
  BEGIN
    v_result := v_clean::date;
    v_year := EXTRACT(YEAR FROM v_result)::int;
    IF v_year BETWEEN 1900 AND 2100 THEN
      RETURN v_result;
    ELSIF v_year BETWEEN 0 AND 29 THEN
      RETURN v_result + INTERVAL '2000 years';
    ELSIF v_year BETWEEN 30 AND 99 THEN
      RETURN v_result + INTERVAL '1900 years';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION _parse_import_date(text) IS
  'Parses CSV date strings safely. Tries ISO, MM/DD/YYYY, MM/DD/YY (with Y2K pivot), '
  'YYYY/MM/DD, and MM-DD-YYYY in order. Rejects results outside 1900..2100 to '
  'prevent 2-digit-year-AD bugs (e.g. ''6/1/26'' becoming 0026-06-01).';

NOTIFY pgrst, 'reload schema';
