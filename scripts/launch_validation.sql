-- ============================================================================
-- LAUNCH VALIDATION QUERIES
-- Run these after carrier population, backfill, and Zoho re-import
-- ============================================================================

-- ============================================================================
-- 1. CARRIER INVENTORY
-- ============================================================================

-- All carriers in the system
SELECT id, carrier_name, carrier_type, is_active, created_at
FROM insurance_carriers
ORDER BY carrier_type, carrier_name;

-- ============================================================================
-- 2. CARRIER BACKFILL COVERAGE
-- ============================================================================

SELECT
  count(*) AS total_records,
  count(*) FILTER (WHERE carrier_id IS NOT NULL) AS with_carrier_id,
  count(*) FILTER (WHERE carrier_id IS NULL) AS without_carrier_id,
  ROUND(100.0 * count(*) FILTER (WHERE carrier_id IS NOT NULL) / NULLIF(count(*), 0), 1) AS pct_matched
FROM crm_records;

-- Distinct raw carrier values still unmatched
SELECT
  TRIM(COALESCE(data->>'carrier', '')) AS raw_carrier,
  count(*) AS row_count
FROM crm_records
WHERE carrier_id IS NULL
  AND TRIM(COALESCE(data->>'carrier', '')) <> ''
GROUP BY 1
ORDER BY row_count DESC, raw_carrier;

-- ============================================================================
-- 3. LANE DISTRIBUTION
-- ============================================================================

SELECT market_type, count(*) AS record_count
FROM crm_records
GROUP BY market_type
ORDER BY count(*) DESC;

-- ============================================================================
-- 4. NORMALIZATION STATUS DISTRIBUTION
-- ============================================================================

SELECT normalization_status, count(*) AS record_count
FROM crm_records
GROUP BY normalization_status
ORDER BY count(*) DESC;

-- ============================================================================
-- 5. RECENT RECORDS CHECK (post-Feb 10 gap)
-- ============================================================================

SELECT
  count(*) AS records_since_cutoff
FROM crm_records
WHERE created_at >= DATE '2026-02-10'
   OR updated_at >= DATE '2026-02-10';

-- Monthly distribution to see the gap
SELECT
  DATE_TRUNC('month', created_at)::date AS month,
  count(*) AS records_created
FROM crm_records
GROUP BY 1
ORDER BY 1;

-- ============================================================================
-- 6. AGE BACKFILL COVERAGE
-- ============================================================================

SELECT
  count(*) AS total_records,
  count(*) FILTER (WHERE estimated_age IS NOT NULL) AS with_estimated_age,
  count(*) FILTER (WHERE age_range IS NOT NULL) AS with_age_range,
  count(*) FILTER (WHERE age_is_estimated = false AND age_notes = 'Calculated from exact DOB') AS derived_from_dob,
  count(*) FILTER (WHERE age_is_estimated = true) AS manually_estimated
FROM crm_records;

-- ============================================================================
-- 7. OWNERSHIP DISTRIBUTION
-- ============================================================================

-- Advisor ownership (HealthShare lane)
SELECT
  COALESCE(normalized_advisor_name, 'Unassigned') AS advisor,
  count(*) AS record_count,
  count(*) FILTER (WHERE canonical_advisor_id IS NOT NULL) AS with_advisor_fk
FROM crm_records
WHERE market_type = 'healthshare'
GROUP BY 1
ORDER BY record_count DESC;

-- Agent ownership (Traditional Insurance lane)
SELECT
  COALESCE(normalized_agent_name, 'Unassigned') AS agent,
  count(*) AS record_count
FROM crm_records
WHERE market_type = 'traditional_insurance'
GROUP BY 1
ORDER BY record_count DESC;

-- ============================================================================
-- 8. DUPLICATE CHECK
-- ============================================================================

SELECT title, email, count(*) AS duplicates
FROM crm_records
WHERE org_id = (SELECT id FROM organizations LIMIT 1)
GROUP BY title, email
HAVING count(*) > 2
ORDER BY count(*) DESC
LIMIT 20;

-- ============================================================================
-- 9. ADVISOR TABLE HEALTH
-- ============================================================================

-- Bridge status between advisors and crm_advisors
SELECT bridge_status, count(*) AS advisor_count
FROM advisor_identity_bridge
GROUP BY bridge_status
ORDER BY count(*) DESC;

-- Records with canonical_advisor_id set vs not
SELECT
  count(*) AS total_records,
  count(*) FILTER (WHERE canonical_advisor_id IS NOT NULL) AS with_canonical_advisor,
  count(*) FILTER (WHERE canonical_advisor_id IS NULL AND normalized_advisor_name IS NOT NULL) AS name_only_no_fk,
  count(*) FILTER (WHERE canonical_advisor_id IS NULL AND normalized_advisor_name IS NULL) AS no_advisor_at_all
FROM crm_records;

-- ============================================================================
-- 10. IMPORT SOURCE TRACKING
-- ============================================================================

SELECT
  COALESCE(import_source, 'unknown') AS source,
  count(*) AS record_count
FROM crm_records
GROUP BY 1
ORDER BY count(*) DESC;
