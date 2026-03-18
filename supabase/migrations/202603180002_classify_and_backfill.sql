-- ============================================================================
-- PHASE 2, MIGRATION 2 — CLASSIFY AND BACKFILL
-- Market type classification function + backfill of all canonical fields.
-- This migration is IDEMPOTENT: safe to re-run.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Market Type Classification Function
-- Deterministic classifier based on product/carrier/coverage/IUA fields.
-- Returns: 'healthshare', 'traditional_insurance', or 'unknown'
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
  -- ----------------------------------------------------------------
  -- RULE 1: Strong HealthShare indicators (product or carrier name)
  -- ----------------------------------------------------------------
  IF v_product ~ '(health\s*share|sharing\s*(plan|program|ministry)|ministry|impact\s*health|knew\s*health|oneshare|sedera|liberty\s*health|zion\s*health|aliera|medishare|medi-share|samaritan|mpowering|mpb\b|mpower|jericho\s*share|unite\s*health|chr\b|community\s*health)'
     OR v_carrier ~ '(health\s*share|sharing|ministry|impact|knew\s*health|oneshare|sedera|liberty|zion|aliera|medishare|medi-share|samaritan|mpowering|mpb\b|mpower|jericho|unite\s*health|chr\b)'
     OR v_coverage ~ '(sharing|iua|unshareable)'
  THEN
    RETURN 'healthshare';
  END IF;

  -- ----------------------------------------------------------------
  -- RULE 2: IUA amount present → HealthShare
  -- (Initial Unshareable Amount is a HealthShare-specific concept)
  -- ----------------------------------------------------------------
  IF NULLIF(TRIM(COALESCE(p_iua, '')), '') IS NOT NULL THEN
    RETURN 'healthshare';
  END IF;

  -- ----------------------------------------------------------------
  -- RULE 3: Strong Traditional Insurance indicators
  -- ----------------------------------------------------------------
  IF v_carrier ~ '(blue\s*cross|bcbs|aetna|united\s*health|cigna|humana|anthem|kaiser|molina|centene|oscar\s*health|ambetter|caresource|coventry|wellcare|bright\s*health|clover\s*health|devoted|alignment|wellpoint|highmark|geisinger|medica\b|priority\s*health|selecthealth|premera|regence|excellus|emblem|healthfirst|tufts|harvard\s*pilgrim|fallon)'
     OR v_product ~ '(\bhmo\b|\bppo\b|\bepo\b|\bpos\b|marketplace|aca\s|exchange\s*plan|medicaid|medicare|cobra|short[\s-]*term|gap\s*(plan|coverage|insurance)|supplemental|indemnity|major\s*medical)'
  THEN
    RETURN 'traditional_insurance';
  END IF;

  -- ----------------------------------------------------------------
  -- RULE 4: Cannot determine → unknown
  -- ----------------------------------------------------------------
  RETURN 'unknown';
END;
$$;

COMMENT ON FUNCTION classify_market_type IS
  'Classifies a CRM record as healthshare, traditional_insurance, or unknown '
  'based on product name, carrier name, coverage option, and IUA amount.';


-- ============================================================================
-- SECTION 2: Backfill import_source and source_record_id
-- ============================================================================

-- Records with Zoho record IDs → zoho_csv
UPDATE crm_records
SET
  source_record_id = data->>'zoho_record_id',
  import_source = 'zoho_csv'
WHERE source_record_id IS NULL
  AND import_source IS NULL
  AND data->>'zoho_record_id' IS NOT NULL;

-- Records with Zoho timestamps but no record ID → still zoho_csv
UPDATE crm_records
SET import_source = 'zoho_csv'
WHERE import_source IS NULL
  AND (data->>'zoho_created_time' IS NOT NULL OR data->>'zoho_modified_time' IS NOT NULL);

-- Records with no Zoho indicators → manual origin
UPDATE crm_records
SET import_source = 'manual'
WHERE import_source IS NULL
  AND data->>'zoho_record_id' IS NULL
  AND data->>'zoho_created_time' IS NULL;


-- ============================================================================
-- SECTION 3: Backfill market_type
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
-- SECTION 4: Backfill normalized advisor/agent names
-- Strategy:
--   HealthShare → advisor gets producer_name / contact_owner
--   Traditional Insurance → agent gets producer_name / contact_owner
--   Unknown → both get the same best-available name
-- ============================================================================

-- HealthShare records → Advisor ownership
UPDATE crm_records
SET normalized_advisor_name = COALESCE(
  NULLIF(TRIM(data->>'advisor'), ''),
  NULLIF(TRIM(data->>'producer_name'), ''),
  NULLIF(TRIM(data->>'contact_owner'), '')
)
WHERE market_type = 'healthshare'
  AND normalized_advisor_name IS NULL;

-- Traditional Insurance records → Agent ownership
UPDATE crm_records
SET normalized_agent_name = COALESCE(
  NULLIF(TRIM(data->>'agent'), ''),
  NULLIF(TRIM(data->>'producer_name'), ''),
  NULLIF(TRIM(data->>'contact_owner'), '')
)
WHERE market_type = 'traditional_insurance'
  AND normalized_agent_name IS NULL;

-- Unknown market type → populate both from best available source
UPDATE crm_records
SET
  normalized_advisor_name = COALESCE(
    NULLIF(TRIM(data->>'advisor'), ''),
    NULLIF(TRIM(data->>'producer_name'), ''),
    NULLIF(TRIM(data->>'contact_owner'), '')
  ),
  normalized_agent_name = COALESCE(
    NULLIF(TRIM(data->>'agent'), ''),
    NULLIF(TRIM(data->>'producer_name'), ''),
    NULLIF(TRIM(data->>'contact_owner'), '')
  )
WHERE market_type = 'unknown'
  AND normalized_advisor_name IS NULL
  AND normalized_agent_name IS NULL;


-- ============================================================================
-- SECTION 5: Backfill canonical_advisor_id (FK match to advisors table)
-- Deterministic name match within same organization. Safe and traceable.
-- ============================================================================

-- Pass 1: Exact full-name match (first_name || ' ' || last_name)
UPDATE crm_records r
SET canonical_advisor_id = a.id
FROM advisors a
WHERE r.canonical_advisor_id IS NULL
  AND r.normalized_advisor_name IS NOT NULL
  AND a.organization_id = r.org_id
  AND LOWER(TRIM(r.normalized_advisor_name)) = LOWER(TRIM(a.first_name || ' ' || a.last_name));

-- Pass 2: Match by producer_code (e.g., "WENDY" → advisor with producer_code = 'WENDY')
UPDATE crm_records r
SET canonical_advisor_id = a.id
FROM advisors a
WHERE r.canonical_advisor_id IS NULL
  AND r.normalized_advisor_name IS NOT NULL
  AND a.organization_id = r.org_id
  AND a.producer_code IS NOT NULL
  AND LOWER(TRIM(r.normalized_advisor_name)) = LOWER(TRIM(a.producer_code));


-- ============================================================================
-- SECTION 6: Backfill normalization_status
-- ============================================================================

UPDATE crm_records
SET normalization_status = CASE
  -- Fully normalized: known lane + resolved ownership
  WHEN market_type = 'healthshare' AND canonical_advisor_id IS NOT NULL
    THEN 'normalized'
  WHEN market_type = 'traditional_insurance' AND normalized_agent_name IS NOT NULL
    THEN 'normalized'
  -- Has ownership text but no FK match (advisor name doesn't match any advisor record)
  WHEN market_type = 'healthshare' AND normalized_advisor_name IS NOT NULL AND canonical_advisor_id IS NULL
    THEN 'needs_review'
  -- Unknown lane
  WHEN market_type = 'unknown'
    THEN 'needs_review'
  -- No ownership data at all
  WHEN normalized_advisor_name IS NULL AND normalized_agent_name IS NULL
    THEN 'unresolved'
  ELSE 'needs_review'
END
WHERE normalization_status IS NULL;


-- ============================================================================
-- SECTION 7: Backfill normalization_notes (evidence trail)
-- ============================================================================

UPDATE crm_records
SET normalization_notes = CASE
  WHEN normalization_status = 'normalized' AND canonical_advisor_id IS NOT NULL
    THEN 'Auto-classified as ' || market_type || '; advisor matched: ' || COALESCE(normalized_advisor_name, '(unknown)')
  WHEN normalization_status = 'normalized' AND normalized_agent_name IS NOT NULL
    THEN 'Auto-classified as ' || market_type || '; agent: ' || normalized_agent_name
  WHEN normalization_status = 'needs_review' AND market_type = 'unknown'
    THEN 'Could not determine market type from product=' || COALESCE(data->>'product', '(empty)') || ', carrier=' || COALESCE(data->>'carrier', '(empty)')
  WHEN normalization_status = 'needs_review' AND canonical_advisor_id IS NULL AND normalized_advisor_name IS NOT NULL
    THEN 'Advisor name "' || normalized_advisor_name || '" found but no matching advisor record in system'
  WHEN normalization_status = 'unresolved'
    THEN 'No product, carrier, or ownership data available for classification'
  ELSE 'Auto-classified'
END
WHERE normalization_notes IS NULL;

NOTIFY pgrst, 'reload schema';
