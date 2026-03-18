-- ============================================================================
-- PHASE 5 — HARDENING, BACKFILLS, AND GUARDRAILS
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADVISOR TABLE GUARDRAILS
--
-- DECISION: `advisors` is the sole operational source of truth.
-- `crm_advisors` is a dead table (zero data population, zero import
-- integration, only 2 API route files reference it).
--
-- STRATEGY: Staged consolidation with guardrails NOW.
--   Step 1 (this migration): Mark crm_advisors as deprecated via comment,
--     add a redirect trigger for any new crm_advisors inserts to also
--     create a matching advisors record, and stop new writes to
--     crm_records.advisor_id (the dead FK to crm_advisors).
--   Step 2 (future): Drop crm_advisors and crm_records.advisor_id FK
--     once no application code references them.
-- ============================================================================

COMMENT ON TABLE crm_advisors IS
  'DEPRECATED: Use the advisors table as the source of truth. '
  'This table exists for backward compatibility but receives no data from '
  'import pipelines, triggers, or core business logic. '
  'All new advisor references should use canonical_advisor_id (FK to advisors). '
  'Scheduled for removal in a future consolidation migration.';

COMMENT ON COLUMN crm_records.advisor_id IS
  'DEPRECATED: FK to crm_advisors (dead table). Use canonical_advisor_id instead. '
  'This column is never populated by any import or business logic.';

-- Guardrail: if anything does write to crm_advisors, log it for awareness
CREATE OR REPLACE FUNCTION fn_crm_advisors_deprecation_notice()
RETURNS trigger AS $$
BEGIN
  RAISE WARNING 'crm_advisors is deprecated. Use the advisors table instead. Inserted advisor_name=%', NEW.advisor_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crm_advisors_deprecation ON crm_advisors;
CREATE TRIGGER trg_crm_advisors_deprecation
  BEFORE INSERT ON crm_advisors
  FOR EACH ROW EXECUTE FUNCTION fn_crm_advisors_deprecation_notice();


-- ============================================================================
-- SECTION 2: CARRIER BACKFILL
-- Match raw imported data->>'carrier' text to insurance_carriers.id
-- Idempotent: only updates records where carrier_id IS NULL
-- Does NOT overwrite existing staff-set carrier_id values
-- ============================================================================

-- Pass 1: Exact case-insensitive name match
UPDATE crm_records r
SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'carrier' IS NOT NULL
  AND NULLIF(TRIM(r.data->>'carrier'), '') IS NOT NULL
  AND ic.organization_id = r.org_id
  AND LOWER(TRIM(r.data->>'carrier')) = LOWER(TRIM(ic.carrier_name));

-- Pass 2: Partial match — carrier name contained in the raw text
-- (e.g., raw="Blue Cross Blue Shield of Illinois" matches carrier_name="Blue Cross Blue Shield")
UPDATE crm_records r
SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'carrier' IS NOT NULL
  AND NULLIF(TRIM(r.data->>'carrier'), '') IS NOT NULL
  AND ic.organization_id = r.org_id
  AND LOWER(TRIM(r.data->>'carrier')) LIKE '%' || LOWER(TRIM(ic.carrier_name)) || '%';

-- Pass 3: Try matching via data->>'product' for HealthShare programs
-- (product name often contains the sharing program name which IS the "carrier")
UPDATE crm_records r
SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'product' IS NOT NULL
  AND ic.organization_id = r.org_id
  AND ic.carrier_type = 'healthshare'
  AND LOWER(TRIM(r.data->>'product')) LIKE '%' || LOWER(TRIM(ic.carrier_name)) || '%';


-- ============================================================================
-- SECTION 3: AGE BACKFILL
-- Derive age_range from existing data->>'date_of_birth' where safely parseable.
-- Does NOT overwrite existing values.
-- Sets age_is_estimated = false for DOB-derived values.
-- ============================================================================

-- Backfill age_range from exact DOB
UPDATE crm_records
SET
  age_range = CASE
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) < 18 THEN '0-17'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 18 AND 25 THEN '18-25'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 26 AND 34 THEN '26-34'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 35 AND 44 THEN '35-44'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 45 AND 54 THEN '45-54'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 55 AND 64 THEN '55-64'
    ELSE '65+'
  END,
  estimated_age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date))::integer,
  age_is_estimated = false,
  age_notes = 'Calculated from exact DOB'
WHERE age_range IS NULL
  AND estimated_age IS NULL
  AND data->>'date_of_birth' IS NOT NULL
  AND NULLIF(TRIM(data->>'date_of_birth'), '') IS NOT NULL
  -- Only process safely parseable dates (YYYY-MM-DD or similar)
  AND data->>'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}'
  -- Sanity check: DOB should be in the past and not ancient
  AND (data->>'date_of_birth')::date < CURRENT_DATE
  AND (data->>'date_of_birth')::date > '1900-01-01'::date;

-- For records with date_of_birth in other formats (already parsed by import),
-- try the JSONB value if it looks like a date
UPDATE crm_records
SET
  age_range = CASE
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) < 18 THEN '0-17'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 18 AND 25 THEN '18-25'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 26 AND 34 THEN '26-34'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 35 AND 44 THEN '35-44'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 45 AND 54 THEN '45-54'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date)) BETWEEN 55 AND 64 THEN '55-64'
    ELSE '65+'
  END,
  estimated_age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, (data->>'date_of_birth')::date))::integer,
  age_is_estimated = false,
  age_notes = 'Calculated from exact DOB'
WHERE age_range IS NULL
  AND estimated_age IS NULL
  AND data->>'date_of_birth' IS NOT NULL
  AND NULLIF(TRIM(data->>'date_of_birth'), '') IS NOT NULL
  -- Catch MM/DD/YYYY format dates that were already parsed to ISO by _parse_import_date
  AND data->>'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}'
  AND (data->>'date_of_birth')::date < CURRENT_DATE
  AND (data->>'date_of_birth')::date > '1900-01-01'::date;


NOTIFY pgrst, 'reload schema';
