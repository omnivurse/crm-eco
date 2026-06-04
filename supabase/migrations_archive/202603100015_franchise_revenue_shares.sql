-- Migration: Franchise Revenue Shares (Schema Hook)
-- =================================================
-- Adds franchise_revenue_shares table for future integration
-- with the commission engine. Does NOT auto-calculate yet —
-- prepares the schema for revenue share rules between
-- parent and child orgs.

-- ═══════════════════════════════════════════════════════════════════════════════
-- D1.7 — FRANCHISE REVENUE SHARES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS franchise_revenue_shares (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  child_org_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Revenue share configuration
  percentage      numeric(5,2) NOT NULL DEFAULT 0.00
                  CHECK (percentage >= 0 AND percentage <= 100),
  -- Scope: which commission types this share applies to
  applies_to      text NOT NULL DEFAULT 'all'
                  CHECK (applies_to IN ('all', 'signup', 'monthly', 'override', 'bonus')),
  -- Capacity scope (null = all products)
  capacity_scope  text CHECK (capacity_scope IN ('health_insurance', 'health_share')),
  -- Effective period
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,                         -- NULL = no end date
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'pending')),
  notes           text,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One share rule per scope per relationship
  UNIQUE(parent_org_id, child_org_id, applies_to, capacity_scope),
  CHECK (parent_org_id != child_org_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_franchise_rev_shares_parent
  ON franchise_revenue_shares (parent_org_id, status);

CREATE INDEX IF NOT EXISTS idx_franchise_rev_shares_child
  ON franchise_revenue_shares (child_org_id, status);

CREATE INDEX IF NOT EXISTS idx_franchise_rev_shares_active
  ON franchise_revenue_shares (parent_org_id, child_org_id)
  WHERE status = 'active';


-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE franchise_revenue_shares ENABLE ROW LEVEL SECURITY;

-- Parent org owners/admins see all shares they've configured
CREATE POLICY "parent_view_revenue_shares" ON franchise_revenue_shares
  FOR SELECT USING (
    parent_org_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin', 'admin')
  );

-- Child org owners can see shares applied to them (read-only)
CREATE POLICY "child_view_revenue_shares" ON franchise_revenue_shares
  FOR SELECT USING (
    child_org_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin')
  );

-- Only parent org owners can manage revenue shares
CREATE POLICY "parent_manage_revenue_shares" ON franchise_revenue_shares
  FOR ALL USING (
    parent_org_id = (SELECT get_user_organization_id())
    AND get_user_role() IN ('owner', 'super_admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER: Get active revenue share rules for a relationship
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_revenue_share_rules(
  p_parent_org_id uuid,
  p_child_org_id  uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             rs.id,
      'percentage',     rs.percentage,
      'applies_to',     rs.applies_to,
      'capacity_scope', rs.capacity_scope,
      'effective_from', rs.effective_from,
      'effective_to',   rs.effective_to
    ) ORDER BY rs.applies_to, rs.capacity_scope
  ), '[]'::jsonb)
  FROM franchise_revenue_shares rs
  WHERE rs.parent_org_id = p_parent_org_id
    AND rs.child_org_id = p_child_org_id
    AND rs.status = 'active'
    AND rs.effective_from <= CURRENT_DATE
    AND (rs.effective_to IS NULL OR rs.effective_to >= CURRENT_DATE);
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
