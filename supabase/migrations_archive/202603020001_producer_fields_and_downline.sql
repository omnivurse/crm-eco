-- ============================================================================
-- PRODUCER FIELDS & DOWNLINE VISIBILITY
-- Adds extended producer information fields to advisors table,
-- creates get_advisor_downline_ids() function for hierarchy traversal,
-- and updates RLS policies so advisors can see their downline's records.
-- ============================================================================

-- ============================================================================
-- SECTION 1: ADD PRODUCER FIELDS TO ADVISORS TABLE
-- ============================================================================
DO $$
BEGIN
  -- Human-readable producer code (e.g. "WENDY")
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'producer_code') THEN
    ALTER TABLE advisors ADD COLUMN producer_code text;
  END IF;

  -- External Admin123 system agent ID
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'admin123_agent_id') THEN
    ALTER TABLE advisors ADD COLUMN admin123_agent_id text;
  END IF;

  -- Producer type (Agent Affiliate, Managing General Agent, etc.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'producer_type') THEN
    ALTER TABLE advisors ADD COLUMN producer_type text;
  END IF;

  -- Mobile phone (separate from office phone)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'mobile_phone') THEN
    ALTER TABLE advisors ADD COLUMN mobile_phone text;
  END IF;

  -- Website URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'website_url') THEN
    ALTER TABLE advisors ADD COLUMN website_url text;
  END IF;

  -- Master Click Funnel URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'master_click_funnel') THEN
    ALTER TABLE advisors ADD COLUMN master_click_funnel text;
  END IF;

  -- MPB Certified flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'mpb_certified') THEN
    ALTER TABLE advisors ADD COLUMN mpb_certified boolean DEFAULT false;
  END IF;

  -- MPB E&O Current flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'mpb_eo_current') THEN
    ALTER TABLE advisors ADD COLUMN mpb_eo_current boolean DEFAULT false;
  END IF;

  -- CRM Owner flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'crm_owner') THEN
    ALTER TABLE advisors ADD COLUMN crm_owner boolean DEFAULT false;
  END IF;

  -- Referring affiliate (self-referencing FK)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'referring_affiliate_id') THEN
    ALTER TABLE advisors ADD COLUMN referring_affiliate_id uuid REFERENCES advisors(id);
  END IF;

  -- Setup fee waived flag
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'setup_fee_waived') THEN
    ALTER TABLE advisors ADD COLUMN setup_fee_waived boolean DEFAULT false;
  END IF;

  -- Compliance training completed date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'compliance_training_completed') THEN
    ALTER TABLE advisors ADD COLUMN compliance_training_completed date;
  END IF;

  -- Producer owner (the supervising producer, may differ from parent)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'advisors' AND column_name = 'producer_owner_id') THEN
    ALTER TABLE advisors ADD COLUMN producer_owner_id uuid REFERENCES advisors(id);
  END IF;
END $$;

-- Unique index on producer_code (only where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_advisors_producer_code
  ON advisors (organization_id, producer_code)
  WHERE producer_code IS NOT NULL;

-- Index for referring affiliate lookups
CREATE INDEX IF NOT EXISTS idx_advisors_referring_affiliate_id
  ON advisors (referring_affiliate_id)
  WHERE referring_affiliate_id IS NOT NULL;

-- Index for producer owner lookups
CREATE INDEX IF NOT EXISTS idx_advisors_producer_owner_id
  ON advisors (producer_owner_id)
  WHERE producer_owner_id IS NOT NULL;

-- Index for admin123 agent ID lookups
CREATE INDEX IF NOT EXISTS idx_advisors_admin123_agent_id
  ON advisors (organization_id, admin123_agent_id)
  WHERE admin123_agent_id IS NOT NULL;


-- ============================================================================
-- SECTION 2: DOWNLINE FUNCTIONS
-- ============================================================================

-- Returns all descendant advisor IDs (full recursive downline tree)
CREATE OR REPLACE FUNCTION get_advisor_downline_ids(p_advisor_id uuid)
RETURNS SETOF uuid AS $$
WITH RECURSIVE downline AS (
  SELECT id FROM advisors WHERE parent_advisor_id = p_advisor_id

  UNION ALL

  SELECT a.id
  FROM advisors a
  JOIN downline d ON a.parent_advisor_id = d.id
)
SELECT id FROM downline;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_advisor_downline_ids(uuid) TO authenticated;

-- Helper: check if the current user's advisor record has downline containing a given advisor_id
DROP FUNCTION IF EXISTS is_in_my_downline(uuid);
CREATE FUNCTION is_in_my_downline(p_advisor_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM get_advisor_downline_ids(get_user_advisor_id()) dl
    WHERE dl = p_advisor_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION is_in_my_downline(uuid) TO authenticated;


-- ============================================================================
-- SECTION 3: UPDATE RLS POLICIES FOR DOWNLINE VISIBILITY
-- ============================================================================

-- ----- MEMBERS: allow advisors to see their downline's members -----
DROP POLICY IF EXISTS "Advisors can view their assigned members" ON members;
CREATE POLICY "Advisors can view their assigned members"
  ON members FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND (
      advisor_id = get_user_advisor_id()
      OR advisor_id IN (SELECT get_advisor_downline_ids(get_user_advisor_id()))
    )
  );

DROP POLICY IF EXISTS "Advisors can update their assigned members" ON members;
CREATE POLICY "Advisors can update their assigned members"
  ON members FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND (
      advisor_id = get_user_advisor_id()
      OR advisor_id IN (SELECT get_advisor_downline_ids(get_user_advisor_id()))
    )
  );

-- ----- LEADS: allow advisors to see their downline's leads -----
DROP POLICY IF EXISTS "Advisors can view their assigned leads" ON leads;
CREATE POLICY "Advisors can view their assigned leads"
  ON leads FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND (
      advisor_id = get_user_advisor_id()
      OR advisor_id IN (SELECT get_advisor_downline_ids(get_user_advisor_id()))
    )
  );

-- ----- CRM RECORDS: add advisor-scoped policy alongside existing org-wide CRM policy -----
-- The existing "CRM members can view records" policy uses is_crm_member(org_id)
-- which already grants org-wide access. We add an explicit advisor scope policy
-- for non-CRM-member advisors who should still see records owned by their downline.
DROP POLICY IF EXISTS "Advisors can view downline records" ON crm_records;
CREATE POLICY "Advisors can view downline records"
  ON crm_records FOR SELECT
  USING (
    get_user_role() = 'advisor'
    AND owner_id IN (
      SELECT p.id FROM profiles p
      JOIN advisors a ON a.profile_id = p.id
      WHERE a.id = get_user_advisor_id()
         OR a.id IN (SELECT get_advisor_downline_ids(get_user_advisor_id()))
    )
  );

-- ----- NEEDS: allow advisors to see their downline members' needs -----
DROP POLICY IF EXISTS "Advisors can view their members' needs" ON needs;
CREATE POLICY "Advisors can view their members' needs"
  ON needs FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND member_id IN (
      SELECT id FROM members
      WHERE advisor_id = get_user_advisor_id()
         OR advisor_id IN (SELECT get_advisor_downline_ids(get_user_advisor_id()))
    )
  );


-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN advisors.producer_code IS 'Human-readable producer code (e.g. WENDY)';
COMMENT ON COLUMN advisors.admin123_agent_id IS 'External Admin123 system agent ID number';
COMMENT ON COLUMN advisors.producer_type IS 'Producer type: Agent Affiliate, Managing General Agent, etc.';
COMMENT ON COLUMN advisors.mobile_phone IS 'Mobile phone number (separate from office phone)';
COMMENT ON COLUMN advisors.website_url IS 'Producer website URL';
COMMENT ON COLUMN advisors.master_click_funnel IS 'Master Click Funnel URL or subdomain';
COMMENT ON COLUMN advisors.mpb_certified IS 'Whether the producer is MPB certified';
COMMENT ON COLUMN advisors.mpb_eo_current IS 'Whether the producer has current MPB E&O coverage';
COMMENT ON COLUMN advisors.crm_owner IS 'Whether the producer is a CRM owner';
COMMENT ON COLUMN advisors.referring_affiliate_id IS 'The referring affiliate advisor who brought this producer in';
COMMENT ON COLUMN advisors.setup_fee_waived IS 'Whether the setup fee was waived for this producer';
COMMENT ON COLUMN advisors.compliance_training_completed IS 'Date when compliance training was completed';
COMMENT ON COLUMN advisors.producer_owner_id IS 'The supervising producer owner (may differ from parent_advisor)';
COMMENT ON FUNCTION get_advisor_downline_ids(uuid) IS 'Returns all descendant advisor IDs in the hierarchy tree';
COMMENT ON FUNCTION is_in_my_downline(uuid) IS 'Checks if a given advisor is in the current users downline';
