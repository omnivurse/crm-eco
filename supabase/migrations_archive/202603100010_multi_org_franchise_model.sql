-- Migration: Multi-Org Franchise Model (Parent/Child Orgs)
-- =========================================================
-- Phase D1: A parent org (franchisor) can manage and analyze child orgs
-- (franchisees) WITHOUT breaking isolation.
--
-- Design principles:
--   1. Default: STRICT isolation — no cross-org reads
--   2. Cross-org reads ONLY via explicit delegation AND only for analytics endpoints
--   3. Parent never reads child raw records — only aggregated metrics via reporting MV
--   4. Delegations are granular: specific permissions per relationship
--
-- Existing isolation:
--   - All tables have organization_id (NOT NULL enforced)
--   - RLS universally uses get_user_organization_id()
--   - Helper functions: get_user_organization_id(), get_user_role(), get_user_advisor_id()
--   - mv_advisor_monthly_performance includes organization_id

-- ═══════════════════════════════════════════════════════════════════════════════
-- D1.1 — ORG RELATIONSHIPS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_relationships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  child_org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'franchise'
                    CHECK (relationship_type IN ('franchise', 'subsidiary', 'affiliate', 'reseller')),
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'pending', 'terminated')),
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate relationships
  UNIQUE(parent_org_id, child_org_id),
  -- Prevent self-referencing
  CHECK (parent_org_id != child_org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_relationships_parent
  ON org_relationships (parent_org_id, status);

CREATE INDEX IF NOT EXISTS idx_org_relationships_child
  ON org_relationships (child_org_id, status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- D1.2 — ORG DELEGATIONS (explicit cross-org permission grants)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_delegations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  child_org_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delegated_role  text NOT NULL DEFAULT 'analytics_viewer'
                  CHECK (delegated_role IN (
                    'analytics_viewer',     -- aggregated metrics only
                    'roster_viewer',        -- see advisor names/counts (no PII beyond name)
                    'compliance_auditor',   -- see compliance status
                    'full_admin'            -- full management (rarely used)
                  )),
  -- Granular permissions
  permissions     jsonb NOT NULL DEFAULT '{
    "view_aggregated_analytics": true,
    "view_advisor_roster": false,
    "view_commission_totals": true,
    "view_enrollment_totals": true,
    "view_product_breakdown": true,
    "view_monthly_trends": true,
    "view_individual_advisors": false,
    "view_raw_records": false,
    "manage_child_settings": false
  }'::jsonb,
  granted_by      uuid REFERENCES profiles(id),
  expires_at      timestamptz,              -- NULL = no expiry
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'revoked', 'expired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One delegation per role per relationship
  UNIQUE(parent_org_id, child_org_id, delegated_role),
  CHECK (parent_org_id != child_org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_delegations_parent
  ON org_delegations (parent_org_id, status);

CREATE INDEX IF NOT EXISTS idx_org_delegations_child
  ON org_delegations (child_org_id, status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- D1.3 — RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE org_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_delegations ENABLE ROW LEVEL SECURITY;

-- ---- org_relationships ----

-- Users can see relationships where their org is parent or child
CREATE POLICY "users_view_own_relationships" ON org_relationships
  FOR SELECT USING (
    parent_org_id = (SELECT get_user_organization_id())
    OR child_org_id = (SELECT get_user_organization_id())
  );

-- Only parent org owners/admins can manage relationships
CREATE POLICY "parent_admin_manage_relationships" ON org_relationships
  FOR ALL USING (
    parent_org_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- ---- org_delegations ----

-- Parent org users see delegations they granted
CREATE POLICY "parent_view_delegations" ON org_delegations
  FOR SELECT USING (
    parent_org_id = (SELECT get_user_organization_id())
  );

-- Child org owners see delegations granted to them
CREATE POLICY "child_view_delegations" ON org_delegations
  FOR SELECT USING (
    child_org_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Only parent org owners can manage delegations
CREATE POLICY "parent_admin_manage_delegations" ON org_delegations
  FOR ALL USING (
    parent_org_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- D1.4 — HELPER FUNCTIONS (SECURITY DEFINER — never bypass isolation in RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check if parent org has active delegation to view child org analytics
CREATE OR REPLACE FUNCTION has_delegation(
  p_parent_org_id uuid,
  p_child_org_id  uuid,
  p_permission    text DEFAULT 'view_aggregated_analytics'
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM org_delegations d
    JOIN org_relationships r
      ON r.parent_org_id = d.parent_org_id
     AND r.child_org_id = d.child_org_id
     AND r.status = 'active'
    WHERE d.parent_org_id = p_parent_org_id
      AND d.child_org_id = p_child_org_id
      AND d.status = 'active'
      AND (d.expires_at IS NULL OR d.expires_at > now())
      AND (d.permissions->>p_permission)::boolean = true
  );
END;
$$;


-- Get all child org IDs for a parent (active relationships only)
CREATE OR REPLACE FUNCTION get_child_org_ids(p_parent_org_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT child_org_id
  FROM org_relationships
  WHERE parent_org_id = p_parent_org_id
    AND status = 'active';
$$;


-- Get all parent org IDs for a child (active relationships only)
CREATE OR REPLACE FUNCTION get_parent_org_ids(p_child_org_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT parent_org_id
  FROM org_relationships
  WHERE child_org_id = p_child_org_id
    AND status = 'active';
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- D1.5 — CROSS-ORG AGGREGATED REPORTING (NEVER exposes raw records)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Franchise dashboard: aggregated metrics across all child orgs
-- Only returns data for children where active delegation exists with
-- 'view_aggregated_analytics' permission.
CREATE OR REPLACE FUNCTION get_franchise_analytics(
  p_parent_org_id uuid,
  p_months        int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff      date := (date_trunc('month', current_date) - (p_months || ' months')::interval)::date;
  v_caller_org  uuid;
  v_summary     jsonb;
  v_by_child    jsonb;
  v_by_product  jsonb;
  v_monthly     jsonb;
BEGIN
  -- Verify caller belongs to the parent org
  v_caller_org := (SELECT get_user_organization_id());
  IF v_caller_org != p_parent_org_id THEN
    RAISE EXCEPTION 'ACCESS_DENIED: caller org (%) != parent org (%)', v_caller_org, p_parent_org_id;
  END IF;

  -- Aggregated summary across ALL delegated children
  SELECT jsonb_build_object(
    'total_production',   COALESCE(sum(m.total_commissions), 0),
    'total_enrollments',  COALESCE(sum(m.total_enrollments), 0),
    'active_advisors',    count(DISTINCT m.advisor_id),
    'child_org_count',    count(DISTINCT m.organization_id),
    'paid_commissions',   COALESCE(sum(m.paid_commissions), 0),
    'pending_commissions', COALESCE(sum(m.pending_commissions), 0)
  ) INTO v_summary
  FROM mv_advisor_monthly_performance m
  WHERE m.organization_id IN (
    SELECT child_org_id FROM org_delegations
    WHERE parent_org_id = p_parent_org_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
      AND (permissions->>'view_aggregated_analytics')::boolean = true
  )
  AND m.month >= v_cutoff;

  -- Per-child org breakdown (aggregated, no individual advisors)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY total DESC), '[]'::jsonb) INTO v_by_child
  FROM (
    SELECT jsonb_build_object(
      'org_id',             m.organization_id,
      'org_name',           o.name,
      'total_commissions',  COALESCE(sum(m.total_commissions), 0),
      'total_enrollments',  COALESCE(sum(m.total_enrollments), 0),
      'active_advisors',    count(DISTINCT m.advisor_id),
      'paid_commissions',   COALESCE(sum(m.paid_commissions), 0)
    ) AS row_data,
    sum(m.total_commissions) AS total
    FROM mv_advisor_monthly_performance m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.organization_id IN (
      SELECT child_org_id FROM org_delegations
      WHERE parent_org_id = p_parent_org_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
        AND (permissions->>'view_aggregated_analytics')::boolean = true
    )
    AND m.month >= v_cutoff
    GROUP BY m.organization_id, o.name
  ) sub;

  -- Product type breakdown (aggregated across children)
  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_by_product
  FROM (
    SELECT jsonb_build_object(
      'product_type',      m.product_type,
      'total_commissions', COALESCE(sum(m.total_commissions), 0),
      'total_enrollments', COALESCE(sum(m.total_enrollments), 0)
    ) AS row_data
    FROM mv_advisor_monthly_performance m
    WHERE m.organization_id IN (
      SELECT child_org_id FROM org_delegations
      WHERE parent_org_id = p_parent_org_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
        AND (permissions->>'view_aggregated_analytics')::boolean = true
    )
    AND m.month >= v_cutoff
    GROUP BY m.product_type
  ) sub;

  -- Monthly trend (aggregated across children)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY month), '[]'::jsonb) INTO v_monthly
  FROM (
    SELECT jsonb_build_object(
      'month',             m.month,
      'total_commissions', COALESCE(sum(m.total_commissions), 0),
      'total_enrollments', COALESCE(sum(m.total_enrollments), 0),
      'active_advisors',   count(DISTINCT m.advisor_id),
      'active_orgs',       count(DISTINCT m.organization_id)
    ) AS row_data, m.month
    FROM mv_advisor_monthly_performance m
    WHERE m.organization_id IN (
      SELECT child_org_id FROM org_delegations
      WHERE parent_org_id = p_parent_org_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
        AND (permissions->>'view_aggregated_analytics')::boolean = true
    )
    AND m.month >= v_cutoff
    GROUP BY m.month
  ) sub;

  RETURN jsonb_build_object(
    'parent_org_id', p_parent_org_id,
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'by_child_org', COALESCE(v_by_child, '[]'::jsonb),
    'by_product', COALESCE(v_by_product, '[]'::jsonb),
    'monthly', COALESCE(v_monthly, '[]'::jsonb)
  );
END;
$$;


-- Per-child analytics (only if parent has delegation)
-- Returns aggregated metrics for a SINGLE child org.
-- NEVER exposes raw records or individual advisor data
-- unless 'view_individual_advisors' permission is granted.
CREATE OR REPLACE FUNCTION get_franchise_child_analytics(
  p_parent_org_id uuid,
  p_child_org_id  uuid,
  p_months        int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff      date := (date_trunc('month', current_date) - (p_months || ' months')::interval)::date;
  v_caller_org  uuid;
  v_can_view    boolean;
  v_can_roster  boolean;
  v_summary     jsonb;
  v_monthly     jsonb;
  v_top_advisors jsonb := '[]'::jsonb;
BEGIN
  -- Verify caller belongs to parent org
  v_caller_org := (SELECT get_user_organization_id());
  IF v_caller_org != p_parent_org_id THEN
    RAISE EXCEPTION 'ACCESS_DENIED: caller org mismatch';
  END IF;

  -- Check delegation
  v_can_view := has_delegation(p_parent_org_id, p_child_org_id, 'view_aggregated_analytics');
  IF NOT v_can_view THEN
    RAISE EXCEPTION 'NO_DELEGATION: no active analytics delegation for this child org';
  END IF;

  v_can_roster := has_delegation(p_parent_org_id, p_child_org_id, 'view_individual_advisors');

  -- Summary for this child
  SELECT jsonb_build_object(
    'total_production',   COALESCE(sum(m.total_commissions), 0),
    'total_enrollments',  COALESCE(sum(m.total_enrollments), 0),
    'active_advisors',    count(DISTINCT m.advisor_id),
    'paid_commissions',   COALESCE(sum(m.paid_commissions), 0),
    'pending_commissions', COALESCE(sum(m.pending_commissions), 0)
  ) INTO v_summary
  FROM mv_advisor_monthly_performance m
  WHERE m.organization_id = p_child_org_id
    AND m.month >= v_cutoff;

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
    WHERE m.organization_id = p_child_org_id
      AND m.month >= v_cutoff
    GROUP BY m.month
  ) sub;

  -- Top advisors (only if roster permission granted)
  IF v_can_roster THEN
    SELECT COALESCE(jsonb_agg(row_data ORDER BY total DESC), '[]'::jsonb) INTO v_top_advisors
    FROM (
      SELECT jsonb_build_object(
        'advisor_id',       m.advisor_id,
        'first_name',       a.first_name,
        'last_name',        a.last_name,
        'total_commissions', sum(m.total_commissions),
        'total_enrollments', sum(m.total_enrollments)
      ) AS row_data,
      sum(m.total_commissions) AS total
      FROM mv_advisor_monthly_performance m
      JOIN advisors a ON a.id = m.advisor_id
      WHERE m.organization_id = p_child_org_id
        AND m.month >= v_cutoff
      GROUP BY m.advisor_id, a.first_name, a.last_name
      ORDER BY sum(m.total_commissions) DESC
      LIMIT 10
    ) sub;
  END IF;

  RETURN jsonb_build_object(
    'child_org_id', p_child_org_id,
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'monthly', COALESCE(v_monthly, '[]'::jsonb),
    'top_advisors', v_top_advisors,
    'permissions', jsonb_build_object(
      'can_view_roster', v_can_roster
    )
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- D1.6 — FRANCHISE MANAGEMENT FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create a franchise relationship + default analytics delegation
CREATE OR REPLACE FUNCTION create_franchise_relationship(
  p_parent_org_id     uuid,
  p_child_org_id      uuid,
  p_relationship_type text DEFAULT 'franchise',
  p_granted_by        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rel_id uuid;
  v_del_id uuid;
BEGIN
  -- Verify caller is in parent org
  IF (SELECT get_user_organization_id()) != p_parent_org_id THEN
    RAISE EXCEPTION 'ACCESS_DENIED: must be in parent org';
  END IF;

  -- Prevent circular references
  IF EXISTS (
    SELECT 1 FROM org_relationships
    WHERE parent_org_id = p_child_org_id AND child_org_id = p_parent_org_id
  ) THEN
    RAISE EXCEPTION 'CIRCULAR_REF: child org is already a parent of this org';
  END IF;

  -- Create relationship
  INSERT INTO org_relationships (parent_org_id, child_org_id, relationship_type)
  VALUES (p_parent_org_id, p_child_org_id, p_relationship_type)
  ON CONFLICT (parent_org_id, child_org_id) DO UPDATE
    SET status = 'active',
        relationship_type = p_relationship_type,
        updated_at = now()
  RETURNING id INTO v_rel_id;

  -- Create default analytics_viewer delegation
  INSERT INTO org_delegations (
    parent_org_id, child_org_id, delegated_role,
    permissions, granted_by
  ) VALUES (
    p_parent_org_id, p_child_org_id, 'analytics_viewer',
    '{
      "view_aggregated_analytics": true,
      "view_advisor_roster": false,
      "view_commission_totals": true,
      "view_enrollment_totals": true,
      "view_product_breakdown": true,
      "view_monthly_trends": true,
      "view_individual_advisors": false,
      "view_raw_records": false,
      "manage_child_settings": false
    }'::jsonb,
    p_granted_by
  )
  ON CONFLICT (parent_org_id, child_org_id, delegated_role) DO UPDATE
    SET status = 'active',
        updated_at = now()
  RETURNING id INTO v_del_id;

  RETURN jsonb_build_object(
    'relationship_id', v_rel_id,
    'delegation_id', v_del_id,
    'status', 'active'
  );
END;
$$;


-- Revoke franchise relationship (terminates relationship + revokes all delegations)
CREATE OR REPLACE FUNCTION revoke_franchise_relationship(
  p_parent_org_id uuid,
  p_child_org_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_del_count int;
BEGIN
  -- Verify caller is in parent org
  IF (SELECT get_user_organization_id()) != p_parent_org_id THEN
    RAISE EXCEPTION 'ACCESS_DENIED: must be in parent org';
  END IF;

  -- Terminate relationship
  UPDATE org_relationships
  SET status = 'terminated', updated_at = now()
  WHERE parent_org_id = p_parent_org_id AND child_org_id = p_child_org_id;

  -- Revoke all delegations
  UPDATE org_delegations
  SET status = 'revoked', updated_at = now()
  WHERE parent_org_id = p_parent_org_id AND child_org_id = p_child_org_id
    AND status = 'active';

  GET DIAGNOSTICS v_del_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'terminated',
    'delegations_revoked', v_del_count
  );
END;
$$;


-- Update delegation permissions for a child org
CREATE OR REPLACE FUNCTION update_delegation_permissions(
  p_delegation_id uuid,
  p_permissions   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delegation record;
BEGIN
  SELECT * INTO v_delegation FROM org_delegations WHERE id = p_delegation_id;

  IF v_delegation IS NULL THEN
    RAISE EXCEPTION 'DELEGATION_NOT_FOUND';
  END IF;

  -- Verify caller is in parent org
  IF (SELECT get_user_organization_id()) != v_delegation.parent_org_id THEN
    RAISE EXCEPTION 'ACCESS_DENIED: must be in parent org';
  END IF;

  -- CRITICAL: Never allow view_raw_records via this path
  IF (p_permissions->>'view_raw_records')::boolean = true THEN
    RAISE EXCEPTION 'FORBIDDEN: raw record access cannot be granted via delegation';
  END IF;

  UPDATE org_delegations
  SET permissions = p_permissions,
      updated_at = now()
  WHERE id = p_delegation_id;

  RETURN jsonb_build_object(
    'delegation_id', p_delegation_id,
    'permissions', p_permissions,
    'updated', true
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
