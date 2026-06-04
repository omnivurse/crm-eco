-- Migration: Agency Model + Scoping
-- ==================================
-- Phase C1: Dedicated agency tables with RLS
--
-- Existing context:
--   advisors.agent_role = 'Agency' marks agency owners
--   advisors have branding fields (logo_url, primary_color, etc.)
--   organizations contain all advisors (multi-tenant)
--
-- This migration adds:
--   1. agencies          — one row per agency (links to advisor with agent_role='Agency')
--   2. agency_users      — junction: which advisors belong to which agency
--   3. agency_settings   — per-agency configuration (overrides, branding, compliance)
--   4. RLS policies      — org admins see all, agency admins see their own, advisors see their metrics

-- ═══════════════════════════════════════════════════════════════════════════════
-- C1.1 — AGENCIES TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agencies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_advisor_id  uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  name              text NOT NULL,
  code              text,                        -- short agency code (e.g. 'ABC-001')
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'suspended')),
  -- Branding (inherits from advisor, can override)
  logo_url          text,
  primary_color     text DEFAULT '#1e40af',
  secondary_color   text DEFAULT '#3b82f6',
  header_bg_color   text DEFAULT '#1e3a8a',
  header_text_color text DEFAULT '#ffffff',
  company_name      text,
  website_url       text,
  -- Contact
  phone             text,
  email             text,
  address           jsonb DEFAULT '{}'::jsonb,   -- {street, city, state, zip, country}
  -- Metadata
  settings          jsonb DEFAULT '{}'::jsonb,   -- arbitrary agency-level config
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_agencies_org
  ON agencies (organization_id);

CREATE INDEX IF NOT EXISTS idx_agencies_owner
  ON agencies (owner_advisor_id);

CREATE INDEX IF NOT EXISTS idx_agencies_status
  ON agencies (organization_id, status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- C1.2 — AGENCY USERS (junction table)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agency_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  advisor_id      uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'member')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  left_at         timestamptz,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE(agency_id, advisor_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_users_advisor
  ON agency_users (advisor_id);

CREATE INDEX IF NOT EXISTS idx_agency_users_agency_status
  ON agency_users (agency_id, status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- C1.3 — AGENCY SETTINGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agency_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE UNIQUE,
  -- Commission overrides
  override_rate   numeric(5,4),                  -- agency-level override percentage
  bonus_threshold numeric(12,2),                 -- production threshold for agency bonus
  bonus_rate      numeric(5,4),                  -- bonus rate when threshold met
  -- Compliance
  require_license_verification boolean DEFAULT false,
  require_appointment_verification boolean DEFAULT false,
  auto_terminate_days int,                       -- days of inactivity before auto-terminate
  -- White-label
  custom_domain   text,
  email_from_name text,
  email_from_addr text,
  -- Capacity restrictions
  allowed_capacities text[] DEFAULT '{}',        -- restrict to specific product types
  -- Metadata
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- C1.4 — RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;

-- ---- agencies ----

-- Org admins can see all agencies in org
CREATE POLICY "admin_agencies_select" ON agencies
  FOR SELECT USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Org admins can manage agencies
CREATE POLICY "admin_agencies_all" ON agencies
  FOR ALL USING (
    organization_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Agency owners/admins can see their own agency
CREATE POLICY "agency_member_select" ON agencies
  FOR SELECT USING (
    id IN (
      SELECT au.agency_id FROM agency_users au
      WHERE au.advisor_id = (SELECT get_user_advisor_id())
        AND au.status = 'active'
    )
  );

-- ---- agency_users ----

-- Org admins see all
CREATE POLICY "admin_agency_users_select" ON agency_users
  FOR SELECT USING (
    agency_id IN (
      SELECT a.id FROM agencies a
      WHERE a.organization_id = (SELECT get_user_organization_id())
    )
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Org admins manage all
CREATE POLICY "admin_agency_users_all" ON agency_users
  FOR ALL USING (
    agency_id IN (
      SELECT a.id FROM agencies a
      WHERE a.organization_id = (SELECT get_user_organization_id())
    )
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Agency owners/admins can see their own agency members
CREATE POLICY "agency_admin_users_select" ON agency_users
  FOR SELECT USING (
    agency_id IN (
      SELECT au.agency_id FROM agency_users au
      WHERE au.advisor_id = (SELECT get_user_advisor_id())
        AND au.role IN ('owner', 'admin')
        AND au.status = 'active'
    )
  );

-- Regular members can see their own membership
CREATE POLICY "member_own_select" ON agency_users
  FOR SELECT USING (
    advisor_id = (SELECT get_user_advisor_id())
  );

-- ---- agency_settings ----

-- Org admins see all agency settings
CREATE POLICY "admin_agency_settings_select" ON agency_settings
  FOR SELECT USING (
    agency_id IN (
      SELECT a.id FROM agencies a
      WHERE a.organization_id = (SELECT get_user_organization_id())
    )
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Org admins manage all agency settings
CREATE POLICY "admin_agency_settings_all" ON agency_settings
  FOR ALL USING (
    agency_id IN (
      SELECT a.id FROM agencies a
      WHERE a.organization_id = (SELECT get_user_organization_id())
    )
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Agency owners can see their settings
CREATE POLICY "agency_owner_settings_select" ON agency_settings
  FOR SELECT USING (
    agency_id IN (
      SELECT au.agency_id FROM agency_users au
      WHERE au.advisor_id = (SELECT get_user_advisor_id())
        AND au.role = 'owner'
        AND au.status = 'active'
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- C1.5 — HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Get agencies for the current user's advisor
CREATE OR REPLACE FUNCTION get_my_agencies()
RETURNS SETOF agencies
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ag.*
  FROM agencies ag
  JOIN agency_users au ON au.agency_id = ag.id
  WHERE au.advisor_id = (SELECT get_user_advisor_id())
    AND au.status = 'active'
    AND ag.status = 'active';
END;
$$;

-- Get agency members with advisor details
CREATE OR REPLACE FUNCTION get_agency_members(
  p_agency_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY a.last_name, a.first_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id',             au.id,
      'advisor_id',     au.advisor_id,
      'role',           au.role,
      'status',         au.status,
      'joined_at',      au.joined_at,
      'first_name',     a.first_name,
      'last_name',      a.last_name,
      'email',          a.email,
      'phone',          a.phone,
      'commission_tier', a.commission_tier,
      'capacities',     a.capacities,
      'agent_role',     a.agent_role
    ) AS row_data
    FROM agency_users au
    JOIN advisors a ON a.id = au.advisor_id
    WHERE au.agency_id = p_agency_id
      AND au.status = 'active'
  ) sub;

  RETURN v_result;
END;
$$;

-- Get agency-scoped analytics (wraps existing get_agency_analytics with agency-level filtering)
CREATE OR REPLACE FUNCTION get_agency_scoped_analytics(
  p_agency_id uuid,
  p_months    int DEFAULT 12,
  p_capacity_scope text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff  date := (date_trunc('month', current_date) - (p_months || ' months')::interval)::date;
  v_org_id  uuid;
  v_summary jsonb;
  v_by_type jsonb;
  v_top_advisors jsonb;
  v_monthly jsonb;
BEGIN
  -- Get org_id for this agency
  SELECT organization_id INTO v_org_id FROM agencies WHERE id = p_agency_id;

  -- Agency summary (filtered to agency members only)
  SELECT jsonb_build_object(
    'total_production',   COALESCE(sum(m.total_commissions), 0),
    'total_enrollments',  COALESCE(sum(m.total_enrollments), 0),
    'active_advisors',    count(DISTINCT m.advisor_id),
    'paid_commissions',   COALESCE(sum(m.paid_commissions), 0),
    'pending_commissions', COALESCE(sum(m.pending_commissions), 0)
  ) INTO v_summary
  FROM mv_advisor_monthly_performance m
  JOIN agency_users au ON au.advisor_id = m.advisor_id AND au.agency_id = p_agency_id AND au.status = 'active'
  WHERE m.organization_id = v_org_id
    AND m.month >= v_cutoff
    AND (p_capacity_scope IS NULL OR m.product_type = p_capacity_scope);

  -- By product type
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_by_type
  FROM (
    SELECT jsonb_build_object(
      'product_type',      m.product_type,
      'total_commissions', COALESCE(sum(m.total_commissions), 0),
      'total_enrollments', COALESCE(sum(m.total_enrollments), 0)
    ) AS row_data
    FROM mv_advisor_monthly_performance m
    JOIN agency_users au ON au.advisor_id = m.advisor_id AND au.agency_id = p_agency_id AND au.status = 'active'
    WHERE m.organization_id = v_org_id
      AND m.month >= v_cutoff
      AND (p_capacity_scope IS NULL OR m.product_type = p_capacity_scope)
    GROUP BY m.product_type
  ) sub;

  -- Top 5 advisors
  SELECT COALESCE(jsonb_agg(row_data ORDER BY total DESC), '[]'::jsonb) INTO v_top_advisors
  FROM (
    SELECT jsonb_build_object(
      'advisor_id',       m.advisor_id,
      'first_name',       a.first_name,
      'last_name',        a.last_name,
      'commission_tier',  a.commission_tier,
      'total_commissions', sum(m.total_commissions),
      'total_enrollments', sum(m.total_enrollments)
    ) AS row_data,
    sum(m.total_commissions) AS total
    FROM mv_advisor_monthly_performance m
    JOIN agency_users au ON au.advisor_id = m.advisor_id AND au.agency_id = p_agency_id AND au.status = 'active'
    JOIN advisors a ON a.id = m.advisor_id
    WHERE m.organization_id = v_org_id
      AND m.month >= v_cutoff
      AND (p_capacity_scope IS NULL OR m.product_type = p_capacity_scope)
    GROUP BY m.advisor_id, a.first_name, a.last_name, a.commission_tier
    ORDER BY sum(m.total_commissions) DESC
    LIMIT 5
  ) sub;

  -- Monthly trend
  SELECT COALESCE(jsonb_agg(row_data ORDER BY month), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT jsonb_build_object(
      'month',             m.month,
      'total_commissions', COALESCE(sum(m.total_commissions), 0),
      'total_enrollments', COALESCE(sum(m.total_enrollments), 0),
      'active_advisors',   count(DISTINCT m.advisor_id)
    ) AS row_data, m.month
    FROM mv_advisor_monthly_performance m
    JOIN agency_users au ON au.advisor_id = m.advisor_id AND au.agency_id = p_agency_id AND au.status = 'active'
    WHERE m.organization_id = v_org_id
      AND m.month >= v_cutoff
      AND (p_capacity_scope IS NULL OR m.product_type = p_capacity_scope)
    GROUP BY m.month
  ) sub;

  RETURN jsonb_build_object(
    'agency_id', p_agency_id,
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'by_product', COALESCE(v_by_type, '[]'::jsonb),
    'top_advisors', COALESCE(v_top_advisors, '[]'::jsonb),
    'monthly', COALESCE(v_monthly, '[]'::jsonb)
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- C1.6 — AUTO-CREATE AGENCY + MEMBERSHIP ON agent_role = 'Agency'
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger: when an advisor's agent_role is set to 'Agency', auto-create agency if not exists
CREATE OR REPLACE FUNCTION trg_auto_create_agency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.agent_role = 'Agency' AND (OLD IS NULL OR OLD.agent_role IS DISTINCT FROM 'Agency') THEN
    -- Create agency row if one doesn't already exist for this advisor
    INSERT INTO agencies (organization_id, owner_advisor_id, name, company_name, logo_url,
                          primary_color, secondary_color, header_bg_color, header_text_color, website_url)
    VALUES (
      NEW.organization_id, NEW.id,
      COALESCE(NEW.company_name, NEW.first_name || ' ' || NEW.last_name || ' Agency'),
      NEW.company_name, NEW.logo_url,
      NEW.primary_color, NEW.secondary_color, NEW.header_bg_color, NEW.header_text_color, NEW.website_url
    )
    ON CONFLICT DO NOTHING;

    -- Auto-add as owner member
    INSERT INTO agency_users (agency_id, advisor_id, role)
    SELECT ag.id, NEW.id, 'owner'
    FROM agencies ag
    WHERE ag.owner_advisor_id = NEW.id
    ON CONFLICT (agency_id, advisor_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_advisor_agency_create ON advisors;
CREATE TRIGGER trg_advisor_agency_create
  AFTER INSERT OR UPDATE OF agent_role ON advisors
  FOR EACH ROW
  EXECUTE FUNCTION trg_auto_create_agency();


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
