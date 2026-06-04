-- ============================================================================
-- MODULE: Medicaid Tracking
-- Adds Medicaid status fields to crm_records and dashboard metrics
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend crm_records with Medicaid fields
-- ----------------------------------------------------------------------------
ALTER TABLE crm_records
  ADD COLUMN IF NOT EXISTS is_medicaid          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS medicaid_start_date  date,
  ADD COLUMN IF NOT EXISTS medicaid_end_date    date,
  ADD COLUMN IF NOT EXISTS medicaid_state       text;

COMMENT ON COLUMN crm_records.is_medicaid IS 'Whether this contact is currently on Medicaid';
COMMENT ON COLUMN crm_records.medicaid_start_date IS 'When the contact started Medicaid coverage';
COMMENT ON COLUMN crm_records.medicaid_end_date IS 'When Medicaid coverage ended (null = still active)';
COMMENT ON COLUMN crm_records.medicaid_state IS 'State of Medicaid enrollment (2-char code)';

-- ----------------------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_records_medicaid
  ON crm_records (org_id, is_medicaid) WHERE is_medicaid = true;

CREATE INDEX IF NOT EXISTS idx_records_medicaid_end
  ON crm_records (org_id, medicaid_end_date)
  WHERE is_medicaid = true AND medicaid_end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_records_medicaid_state
  ON crm_records (org_id, medicaid_state)
  WHERE medicaid_state IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Dashboard metric view — medicaid_dashboard_stats
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW medicaid_dashboard_stats AS
SELECT
  r.org_id                                          AS organization_id,
  COUNT(r.id) FILTER (WHERE r.is_medicaid = true)   AS total_medicaid_members,
  COUNT(r.id) FILTER (
    WHERE r.is_medicaid = true
      AND r.medicaid_end_date IS NULL
  )                                                  AS active_medicaid,
  COUNT(r.id) FILTER (
    WHERE r.is_medicaid = true
      AND r.medicaid_end_date IS NOT NULL
  )                                                  AS former_medicaid,
  -- Transitioning: Medicaid ended in last 90 days (potential enrollment window)
  COUNT(r.id) FILTER (
    WHERE r.is_medicaid = true
      AND r.medicaid_end_date IS NOT NULL
      AND r.medicaid_end_date >= (now() - interval '90 days')
  )                                                  AS transitioning_from_medicaid,
  -- New Medicaid starts this month
  COUNT(r.id) FILTER (
    WHERE r.is_medicaid = true
      AND r.medicaid_start_date >= date_trunc('month', now())
  )                                                  AS new_medicaid_this_month
FROM crm_records r
GROUP BY r.org_id;

COMMENT ON VIEW medicaid_dashboard_stats IS 'Org-level Medicaid member counts for dashboard widgets';

-- ----------------------------------------------------------------------------
-- 4. Per-state Medicaid breakdown
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW medicaid_state_breakdown AS
SELECT
  r.org_id                                          AS organization_id,
  r.medicaid_state                                  AS state,
  COUNT(r.id)                                        AS total,
  COUNT(r.id) FILTER (WHERE r.medicaid_end_date IS NULL) AS active,
  COUNT(r.id) FILTER (
    WHERE r.medicaid_end_date IS NOT NULL
      AND r.medicaid_end_date >= (now() - interval '90 days')
  )                                                  AS transitioning
FROM crm_records r
WHERE r.is_medicaid = true AND r.medicaid_state IS NOT NULL
GROUP BY r.org_id, r.medicaid_state;

COMMENT ON VIEW medicaid_state_breakdown IS 'Medicaid member counts broken down by state';

-- ============================================================================
-- END MODULE: Medicaid Tracking
-- ============================================================================
