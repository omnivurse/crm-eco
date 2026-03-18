-- ============================================================================
-- PHASE 2, MIGRATION 1 — CANONICAL NORMALIZATION MODEL
-- Adds canonical fields to crm_records for lane classification,
-- advisor/agent ownership normalization, and import traceability.
-- Also creates the advisor identity bridge view.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add canonical columns to crm_records
-- ============================================================================

-- Lane classifier: healthshare vs traditional insurance
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS market_type text;

-- Canonical advisor FK (points to advisors table — the hierarchy source)
-- This is ADDITIVE: does NOT touch existing advisor_id FK (which points to crm_advisors)
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS canonical_advisor_id uuid
  REFERENCES advisors(id) ON DELETE SET NULL;

-- Canonical display names (normalized from raw import data)
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS normalized_advisor_name text;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS normalized_agent_name text;

-- Normalization tracking
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS normalization_status text;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS normalization_notes text;

-- Import traceability
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS import_source text;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS source_record_id text;
ALTER TABLE crm_records ADD COLUMN IF NOT EXISTS import_batch_id text;


-- ============================================================================
-- SECTION 2: Constraints
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_market_type
    CHECK (market_type IS NULL OR market_type IN ('healthshare', 'traditional_insurance', 'unknown'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE crm_records
    ADD CONSTRAINT chk_crm_records_normalization_status
    CHECK (normalization_status IS NULL OR normalization_status IN ('normalized', 'needs_review', 'unresolved'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- SECTION 3: Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crm_records_market_type
  ON crm_records (org_id, market_type) WHERE market_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_canonical_advisor
  ON crm_records (org_id, canonical_advisor_id) WHERE canonical_advisor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_normalization_status
  ON crm_records (org_id, normalization_status) WHERE normalization_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_import_source
  ON crm_records (org_id, import_source) WHERE import_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_source_record_id
  ON crm_records (org_id, source_record_id) WHERE source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_normalized_advisor_name
  ON crm_records (org_id, normalized_advisor_name) WHERE normalized_advisor_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_records_normalized_agent_name
  ON crm_records (org_id, normalized_agent_name) WHERE normalized_agent_name IS NOT NULL;


-- ============================================================================
-- SECTION 4: Register canonical fields in crm_fields (for UI visibility)
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
-- SECTION 5: Advisor Identity Bridge View
-- Connects the two advisor tables without destructive FK changes.
-- Use bridge_status to identify unlinked records for manual review.
-- ============================================================================

CREATE OR REPLACE VIEW advisor_identity_bridge AS

-- Advisors that exist in the advisors table (may or may not have crm_advisors match)
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
    -- Link via shared auth user (most reliable)
    (p.user_id IS NOT NULL AND ca.user_id = p.user_id)
    -- Fallback: name match
    OR LOWER(TRIM(ca.advisor_name)) = LOWER(TRIM(a.first_name || ' ' || a.last_name))
  )
)

UNION ALL

-- crm_advisors that have NO match in the advisors table
SELECT
  NULL                                           AS advisor_id,
  ca.organization_id,
  ca.advisor_name                                AS advisor_full_name,
  NULL                                           AS first_name,
  NULL                                           AS last_name,
  NULL                                           AS advisor_email,
  NULL                                           AS advisor_phone,
  NULL                                           AS producer_code,
  NULL                                           AS parent_advisor_id,
  NULL                                           AS commission_tier,
  NULL                                           AS advisor_status,
  NULL                                           AS advisor_profile_id,
  ca.id                                          AS crm_advisor_id,
  ca.advisor_name                                AS crm_advisor_name,
  ca.agency_name                                 AS crm_agency_name,
  ca.user_id                                     AS crm_user_id,
  ca.is_active                                   AS crm_advisor_active,
  NULL                                           AS profile_id,
  ca.user_id                                     AS auth_user_id,
  'crm_advisors_only'                            AS bridge_status
FROM crm_advisors ca
WHERE NOT EXISTS (
  SELECT 1 FROM advisors a
  WHERE a.organization_id = ca.organization_id
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.advisor_id = a.id AND p.user_id = ca.user_id
      )
      OR LOWER(TRIM(ca.advisor_name)) = LOWER(TRIM(a.first_name || ' ' || a.last_name))
    )
);

COMMENT ON VIEW advisor_identity_bridge IS
  'Bridge view connecting advisors (hierarchy/commissions) and crm_advisors (CRM segmentation). '
  'Use bridge_status to identify unlinked records: bridged, advisors_only, or crm_advisors_only.';


-- ============================================================================
-- SECTION 6: Column comments
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

NOTIFY pgrst, 'reload schema';
