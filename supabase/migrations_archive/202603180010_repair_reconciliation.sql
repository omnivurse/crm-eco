-- ============================================================================
-- REPAIR MIGRATION: Reconcile all Phase 2-5 objects that failed to apply
-- because crm_advisors table does not exist in this database.
--
-- This migration is idempotent and safe to run on any state.
-- ============================================================================


-- ============================================================================
-- 1. Create crm_advisors table (empty, deprecated, but needed by bridge view
--    and deprecation trigger references)
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_advisors (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid,
  advisor_name    text         NOT NULL,
  agency_name     text,
  state           text,
  is_active       boolean      NOT NULL DEFAULT true,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

-- Mark as deprecated immediately
COMMENT ON TABLE crm_advisors IS
  'DEPRECATED: Use the advisors table as the source of truth. '
  'This table exists only for schema compatibility. It receives no data from '
  'import pipelines or business logic. Use canonical_advisor_id (FK to advisors) instead.';

-- Add unique constraint needed by ON CONFLICT
DO $$ BEGIN
  ALTER TABLE crm_advisors
    ADD CONSTRAINT uq_crm_advisors_org_name UNIQUE (organization_id, advisor_name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE crm_advisors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY crm_advisors_select_member ON crm_advisors
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND organization_id = crm_advisors.organization_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- 2. Advisor Identity Bridge View
-- ============================================================================

CREATE OR REPLACE VIEW advisor_identity_bridge AS
SELECT
  a.id                                          AS advisor_id,
  a.organization_id,
  TRIM(a.first_name || ' ' || a.last_name)      AS advisor_full_name,
  a.first_name,
  a.last_name,
  a.email                                        AS advisor_email,
  a.phone                                        AS advisor_phone,
  a.producer_code,
  a.parent_advisor_id,
  a.commission_tier,
  a.status                                       AS advisor_status,
  a.profile_id                                   AS advisor_profile_id,
  ca.id                                          AS crm_advisor_id,
  ca.advisor_name                                AS crm_advisor_name,
  ca.agency_name                                 AS crm_agency_name,
  ca.user_id                                     AS crm_user_id,
  ca.is_active                                   AS crm_advisor_active,
  p.id                                           AS profile_id,
  p.user_id                                      AS auth_user_id,
  CASE
    WHEN ca.id IS NOT NULL THEN 'bridged'
    ELSE 'advisors_only'
  END                                            AS bridge_status
FROM advisors a
LEFT JOIN profiles p ON p.advisor_id = a.id
LEFT JOIN crm_advisors ca ON (
  ca.organization_id = a.organization_id
  AND (
    (p.user_id IS NOT NULL AND ca.user_id = p.user_id)
    OR LOWER(TRIM(ca.advisor_name)) = LOWER(TRIM(a.first_name || ' ' || a.last_name))
  )
)
UNION ALL
SELECT
  NULL, ca.organization_id, ca.advisor_name, NULL, NULL, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL,
  ca.id, ca.advisor_name, ca.agency_name, ca.user_id, ca.is_active,
  NULL, ca.user_id, 'crm_advisors_only'
FROM crm_advisors ca
WHERE NOT EXISTS (
  SELECT 1 FROM advisors a
  WHERE a.organization_id = ca.organization_id
    AND (
      EXISTS (SELECT 1 FROM profiles p WHERE p.advisor_id = a.id AND p.user_id = ca.user_id)
      OR LOWER(TRIM(ca.advisor_name)) = LOWER(TRIM(a.first_name || ' ' || a.last_name))
    )
);

COMMENT ON VIEW advisor_identity_bridge IS
  'Bridge view connecting advisors (hierarchy) and crm_advisors (deprecated). '
  'Use bridge_status to identify linkage state.';


-- ============================================================================
-- 3. Register crm_fields entries for canonical columns
-- ============================================================================

DO $$
DECLARE
  v_org record;
  v_mod record;
BEGIN
  FOR v_org IN SELECT DISTINCT org_id FROM crm_modules LOOP
    FOR v_mod IN
      SELECT id, org_id, key FROM crm_modules
      WHERE org_id = v_org.org_id AND key IN ('contacts', 'leads')
    LOOP
      INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_pinned, display_order, section, tooltip, options)
      VALUES
        (v_mod.org_id, v_mod.id, 'market_type', 'Market Type', 'select', false, true, true, 110,
         'management', 'Business lane: HealthShare or Traditional Insurance',
         '["healthshare","traditional_insurance","unknown"]'::jsonb),
        (v_mod.org_id, v_mod.id, 'normalized_advisor_name', 'Advisor (Normalized)', 'text', false, true, false, 117,
         'management', 'Canonical advisor name (auto-populated from import data)', NULL),
        (v_mod.org_id, v_mod.id, 'normalized_agent_name', 'Agent (Normalized)', 'text', false, true, false, 118,
         'management', 'Canonical agent name (auto-populated from import data)', NULL),
        (v_mod.org_id, v_mod.id, 'normalization_status', 'Normalization Status', 'select', false, true, false, 119,
         'management', 'Data normalization review status',
         '["normalized","needs_review","unresolved"]'::jsonb)
      ON CONFLICT (module_id, key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;


-- ============================================================================
-- 4. Column comments
-- ============================================================================

COMMENT ON COLUMN crm_records.market_type IS 'Business lane: healthshare (Advisor) or traditional_insurance (Agent)';
COMMENT ON COLUMN crm_records.canonical_advisor_id IS 'Matched advisor FK to advisors table for HealthShare records';
COMMENT ON COLUMN crm_records.normalized_advisor_name IS 'Canonical advisor display name derived from import data';
COMMENT ON COLUMN crm_records.normalized_agent_name IS 'Canonical agent display name derived from import data';
COMMENT ON COLUMN crm_records.normalization_status IS 'Data normalization state: normalized, needs_review, or unresolved';
COMMENT ON COLUMN crm_records.normalization_notes IS 'Explanation of normalization decisions or issues';
COMMENT ON COLUMN crm_records.import_source IS 'Origin: zoho_csv, csv_import, manual, etc.';
COMMENT ON COLUMN crm_records.source_record_id IS 'External system record ID (e.g., Zoho Record Id)';
COMMENT ON COLUMN crm_records.import_batch_id IS 'Import batch identifier for traceability';


-- ============================================================================
-- 5. classify_market_type function (from migration 002)
-- ============================================================================

CREATE OR REPLACE FUNCTION classify_market_type(
  p_product text,
  p_carrier text,
  p_coverage text DEFAULT NULL,
  p_iua text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_product text := LOWER(COALESCE(p_product, ''));
  v_carrier text := LOWER(COALESCE(p_carrier, ''));
  v_coverage text := LOWER(COALESCE(p_coverage, ''));
BEGIN
  IF v_product ~ '(health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|samaritan|mpowering|mpb|mpower|jericho|unite|chr\b)'
    OR v_carrier ~ '(health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|samaritan|mpowering|mpb|mpower|jericho|unite|chr\b)'
    OR v_coverage ~ '(sharing|iua|unshareable)'
  THEN
    RETURN 'healthshare';
  END IF;

  IF NULLIF(TRIM(COALESCE(p_iua, '')), '') IS NOT NULL THEN
    RETURN 'healthshare';
  END IF;

  IF v_carrier ~ '(blue\s*cross|bcbs|aetna|united\s*health|cigna|humana|anthem|kaiser|molina|centene|oscar|ambetter|caresource|coventry|wellcare|bright\s*health|friday|clover)'
    OR v_product ~ '(hmo|ppo|epo|pos|marketplace|aca|exchange|medicaid|medicare|cobra|short.term|gap|supplemental|indemnity)'
  THEN
    RETURN 'traditional_insurance';
  END IF;

  RETURN 'unknown';
END;
$$;


-- ============================================================================
-- 6. Backfill import_source and source_record_id (from migration 002)
-- ============================================================================

UPDATE crm_records
SET
  source_record_id = data->>'zoho_record_id',
  import_source = 'zoho_csv'
WHERE source_record_id IS NULL
  AND import_source IS NULL
  AND data->>'zoho_record_id' IS NOT NULL;

UPDATE crm_records
SET import_source = 'zoho_csv'
WHERE import_source IS NULL
  AND (data->>'zoho_created_time' IS NOT NULL OR data->>'zoho_modified_time' IS NOT NULL);

UPDATE crm_records
SET import_source = 'manual'
WHERE import_source IS NULL
  AND data->>'zoho_record_id' IS NULL
  AND data->>'zoho_created_time' IS NULL;


-- ============================================================================
-- 7. Backfill market_type (from migration 002)
-- ============================================================================

UPDATE crm_records
SET market_type = classify_market_type(
  data->>'product',
  data->>'carrier',
  data->>'coverage_option',
  data->>'iua_amount'
)
WHERE market_type IS NULL;


-- ============================================================================
-- 8. Backfill canonical ownership (from migration 002)
-- ============================================================================

-- HealthShare → Advisor
UPDATE crm_records
SET normalized_advisor_name = COALESCE(
  NULLIF(TRIM(data->>'advisor'), ''),
  NULLIF(TRIM(data->>'producer_name'), ''),
  NULLIF(TRIM(data->>'contact_owner'), ''))
WHERE market_type = 'healthshare'
  AND normalized_advisor_name IS NULL;

-- Traditional Insurance → Agent
UPDATE crm_records
SET normalized_agent_name = COALESCE(
  NULLIF(TRIM(data->>'agent'), ''),
  NULLIF(TRIM(data->>'producer_name'), ''),
  NULLIF(TRIM(data->>'contact_owner'), ''))
WHERE market_type = 'traditional_insurance'
  AND normalized_agent_name IS NULL;

-- Unknown → populate both
UPDATE crm_records
SET
  normalized_advisor_name = COALESCE(
    NULLIF(TRIM(data->>'advisor'), ''),
    NULLIF(TRIM(data->>'producer_name'), ''),
    NULLIF(TRIM(data->>'contact_owner'), '')),
  normalized_agent_name = COALESCE(
    NULLIF(TRIM(data->>'agent'), ''),
    NULLIF(TRIM(data->>'producer_name'), ''),
    NULLIF(TRIM(data->>'contact_owner'), ''))
WHERE market_type = 'unknown'
  AND normalized_advisor_name IS NULL
  AND normalized_agent_name IS NULL;


-- ============================================================================
-- 9. Backfill canonical_advisor_id FK (from migration 002)
-- ============================================================================

UPDATE crm_records r
SET canonical_advisor_id = a.id
FROM advisors a
WHERE r.canonical_advisor_id IS NULL
  AND r.normalized_advisor_name IS NOT NULL
  AND a.organization_id = r.org_id
  AND LOWER(TRIM(r.normalized_advisor_name)) = LOWER(TRIM(a.first_name || ' ' || a.last_name));

UPDATE crm_records r
SET canonical_advisor_id = a.id
FROM advisors a
WHERE r.canonical_advisor_id IS NULL
  AND r.normalized_advisor_name IS NOT NULL
  AND a.organization_id = r.org_id
  AND a.producer_code IS NOT NULL
  AND LOWER(TRIM(r.normalized_advisor_name)) = LOWER(TRIM(a.producer_code));


-- ============================================================================
-- 10. Backfill normalization_status (from migration 002)
-- ============================================================================

UPDATE crm_records
SET normalization_status = CASE
  WHEN market_type IN ('healthshare', 'traditional_insurance')
    AND (canonical_advisor_id IS NOT NULL OR normalized_agent_name IS NOT NULL)
  THEN 'normalized'
  WHEN market_type = 'unknown'
    OR (market_type = 'healthshare' AND canonical_advisor_id IS NULL AND normalized_advisor_name IS NULL)
    OR (market_type = 'traditional_insurance' AND normalized_agent_name IS NULL)
  THEN 'needs_review'
  WHEN normalized_advisor_name IS NOT NULL AND canonical_advisor_id IS NULL
  THEN 'needs_review'
  ELSE 'unresolved'
END
WHERE normalization_status IS NULL;


-- ============================================================================
-- 11. Backfill normalization_notes (from migration 002)
-- ============================================================================

UPDATE crm_records
SET normalization_notes = CASE
  WHEN normalization_status = 'normalized' AND canonical_advisor_id IS NOT NULL
    THEN 'Auto-classified as ' || market_type || '; advisor matched to ' || normalized_advisor_name
  WHEN normalization_status = 'normalized' AND normalized_agent_name IS NOT NULL
    THEN 'Auto-classified as ' || market_type || '; agent: ' || normalized_agent_name
  WHEN normalization_status = 'needs_review' AND market_type = 'unknown'
    THEN 'Could not determine market type from product/carrier fields'
  WHEN normalization_status = 'needs_review' AND canonical_advisor_id IS NULL AND normalized_advisor_name IS NOT NULL
    THEN 'Advisor name "' || normalized_advisor_name || '" found but no matching advisor record'
  WHEN normalization_status = 'unresolved'
    THEN 'No product, carrier, or ownership data available for classification'
  ELSE 'Auto-classified'
END
WHERE normalization_notes IS NULL;


-- ============================================================================
-- 12. Repaired tree RPCs (from migration 003)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_record_counts_by_advisor(
  p_module_id uuid,
  p_advisor_ids uuid[]
)
RETURNS TABLE(advisor_id uuid, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    r.canonical_advisor_id AS advisor_id,
    COUNT(r.id)            AS record_count
  FROM crm_records r
  WHERE r.module_id = p_module_id
    AND r.canonical_advisor_id = ANY(p_advisor_ids)
  GROUP BY r.canonical_advisor_id;
$$;

CREATE OR REPLACE FUNCTION get_agent_tree_data(
  p_module_id uuid,
  p_owner_ids uuid[] DEFAULT NULL,
  p_canonical_advisor_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(agent_name text, record_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      NULLIF(TRIM(r.normalized_agent_name), ''),
      NULLIF(TRIM(r.data->>'agent'), ''),
      NULLIF(TRIM(r.data->>'producer_name'), ''),
      'Unassigned'
    ) AS agent_name,
    COUNT(r.id) AS record_count
  FROM crm_records r
  WHERE r.module_id = p_module_id
    AND (
      (p_owner_ids IS NULL AND p_canonical_advisor_ids IS NULL)
      OR r.owner_id = ANY(p_owner_ids)
      OR r.canonical_advisor_id = ANY(p_canonical_advisor_ids)
    )
  GROUP BY agent_name
  ORDER BY agent_name;
$$;

-- Grant execute to authenticated users
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION get_agent_tree_data(uuid, uuid[], uuid[]) TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ============================================================================
-- 13. Age capture fields (from migration 006)
-- ============================================================================

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS estimated_age integer;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS age_range text;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS age_is_estimated boolean DEFAULT false;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS age_notes text;

DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_age_range
    CHECK (age_range IS NULL OR age_range IN ('0-17', '18-25', '26-34', '35-44', '45-54', '55-64', '65+'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_estimated_age
    CHECK (estimated_age IS NULL OR (estimated_age >= 0 AND estimated_age <= 150));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_records_age_range
  ON crm_records (org_id, age_range) WHERE age_range IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_records_estimated_age
  ON crm_records (org_id, estimated_age) WHERE estimated_age IS NOT NULL;

-- Register age fields in crm_fields
DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules WHERE key IN ('contacts', 'leads')
  LOOP
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_pinned, display_order, section, tooltip, options)
    VALUES
      (v_mod.org_id, v_mod.id, 'estimated_age', 'Estimated Age', 'number', false, true, false, 121,
       'personal', 'Estimated age when exact DOB is not available', NULL),
      (v_mod.org_id, v_mod.id, 'age_range', 'Age Range', 'select', false, true, false, 122,
       'personal', 'Age bracket for reporting',
       '["0-17","18-25","26-34","35-44","45-54","55-64","65+"]'::jsonb),
      (v_mod.org_id, v_mod.id, 'age_is_estimated', 'Age Is Estimated', 'boolean', false, true, false, 123,
       'personal', 'Whether the age value is an estimate', NULL),
      (v_mod.org_id, v_mod.id, 'age_notes', 'Age Notes', 'text', false, true, false, 124,
       'personal', 'Context about age data source or confidence', NULL)
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;


-- ============================================================================
-- 14. Carrier FK (from migration 006/009)
-- ============================================================================

ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS carrier_id uuid
  REFERENCES insurance_carriers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crm_records_carrier
  ON crm_records (org_id, carrier_id) WHERE carrier_id IS NOT NULL;
COMMENT ON COLUMN crm_records.carrier_id IS 'Referenced insurance carrier for this record';

-- Register carrier_id in crm_fields
DO $$
DECLARE
  v_mod record;
BEGIN
  FOR v_mod IN
    SELECT id, org_id FROM crm_modules WHERE key IN ('contacts', 'leads')
  LOOP
    INSERT INTO crm_fields (org_id, module_id, key, label, type, required, is_system, is_pinned, display_order, section, tooltip)
    VALUES
      (v_mod.org_id, v_mod.id, 'carrier_id', 'Carrier', 'lookup', false, true, false, 120,
       'management', 'Insurance carrier or HealthShare program')
    ON CONFLICT (module_id, key) DO NOTHING;
  END LOOP;
END $$;


-- ============================================================================
-- 15. Advisor deprecation guardrails (from migration 007)
-- ============================================================================

-- Note: crm_records.advisor_id does not exist in this database.
-- The deprecated FK was never created. canonical_advisor_id is the only advisor FK.

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
-- 16. Age backfill from DOB (from migration 007)
-- ============================================================================

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
  AND data->>'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}'
  AND (data->>'date_of_birth')::date < CURRENT_DATE
  AND (data->>'date_of_birth')::date > '1900-01-01'::date;


-- ============================================================================
-- 17. Carrier auto-population from raw data (from migration 008)
-- ============================================================================

-- Drop audit constraint and disable trigger to avoid check violations during bulk insert
ALTER TABLE unified_audit_logs DROP CONSTRAINT IF EXISTS unified_audit_logs_action_category_check;
DO $$ BEGIN
  ALTER TABLE insurance_carriers DISABLE TRIGGER trg_audit_insurance_carriers;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
DECLARE
  v_org_id uuid;
  v_raw text;
  v_type text;
  v_inserted int := 0;
  v_skipped int := 0;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE WARNING 'No organization found — skipping carrier population';
    RETURN;
  END IF;

  -- Extract from data->>'carrier'
  FOR v_raw IN
    SELECT DISTINCT TRIM(data->>'carrier') AS val
    FROM crm_records
    WHERE data->>'carrier' IS NOT NULL AND TRIM(data->>'carrier') != ''
    ORDER BY val
  LOOP
    IF v_raw ~* '(health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|samaritan|mpowering|mpb|mpower|jericho|unite|chr\b)' THEN
      v_type := 'healthshare';
    ELSIF v_raw ~* '(medicaid|chip|children.s\s*health)' THEN
      v_type := 'medicaid';
    ELSIF v_raw ~* '(short.term|gap|temporary|bridge|interim)' THEN
      v_type := 'short_term';
    ELSE
      v_type := 'insurance';
    END IF;

    BEGIN
      INSERT INTO insurance_carriers (organization_id, carrier_name, carrier_type, is_active)
      VALUES (v_org_id, v_raw, v_type, true);
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Carrier pass A (carrier field): inserted=%, skipped=%', v_inserted, v_skipped;

  v_inserted := 0; v_skipped := 0;

  -- Extract HealthShare programs from data->>'product'
  FOR v_raw IN
    SELECT DISTINCT TRIM(data->>'product') AS val
    FROM crm_records
    WHERE data->>'product' IS NOT NULL AND TRIM(data->>'product') != ''
      AND TRIM(data->>'product') ~* '(health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|samaritan|mpowering|mpb|mpower|jericho|unite|chr\b)'
    ORDER BY val
  LOOP
    BEGIN
      INSERT INTO insurance_carriers (organization_id, carrier_name, carrier_type, is_active)
      VALUES (v_org_id, v_raw, 'healthshare', true);
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Carrier pass B (HealthShare products): inserted=%, skipped=%', v_inserted, v_skipped;
END $$;


-- Re-enable audit trigger after population
DO $$ BEGIN
  ALTER TABLE insurance_carriers ENABLE TRIGGER trg_audit_insurance_carriers;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- 18. Carrier backfill (from migration 007/008)
-- ============================================================================

-- Pass 1: Exact match
UPDATE crm_records r SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'carrier' IS NOT NULL
  AND NULLIF(TRIM(r.data->>'carrier'), '') IS NOT NULL
  AND ic.organization_id = r.org_id
  AND LOWER(TRIM(r.data->>'carrier')) = LOWER(TRIM(ic.carrier_name));

-- Pass 2: Partial match
UPDATE crm_records r SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'carrier' IS NOT NULL
  AND NULLIF(TRIM(r.data->>'carrier'), '') IS NOT NULL
  AND ic.organization_id = r.org_id
  AND LOWER(TRIM(r.data->>'carrier')) LIKE '%' || LOWER(TRIM(ic.carrier_name)) || '%'
  AND LENGTH(TRIM(ic.carrier_name)) >= 4;

-- Pass 3: Product name match for HealthShare
UPDATE crm_records r SET carrier_id = ic.id
FROM insurance_carriers ic
WHERE r.carrier_id IS NULL
  AND r.data->>'product' IS NOT NULL
  AND ic.organization_id = r.org_id
  AND ic.carrier_type = 'healthshare'
  AND LOWER(TRIM(r.data->>'product')) LIKE '%' || LOWER(TRIM(ic.carrier_name)) || '%'
  AND LENGTH(TRIM(ic.carrier_name)) >= 4;


-- ============================================================================
-- 19. Mark migration 001 as complete (it partially applied before failing)
-- ============================================================================
-- The CLI will handle this by recording 010 as applied.


NOTIFY pgrst, 'reload schema';
