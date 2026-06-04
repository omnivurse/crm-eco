-- Migration: Plan Type Classification
-- ====================================
-- Adds plan_type to plans table for insurance vs healthshare distinction.
-- Adds CHECK constraint and index to members.plan_type.
-- Adds plan_id FK to members for direct plan reference.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ADD plan_type TO plans TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS plan_type text
    CHECK (plan_type IN ('healthshare', 'insurance', 'medicaid', 'short_term'));

-- Backfill from coverage_category / product_line if available
UPDATE plans
SET plan_type = CASE
  WHEN LOWER(coverage_category) LIKE '%share%' OR LOWER(product_line) LIKE '%share%' THEN 'healthshare'
  WHEN LOWER(coverage_category) LIKE '%medicaid%' OR LOWER(product_line) LIKE '%medicaid%' THEN 'medicaid'
  WHEN LOWER(coverage_category) LIKE '%short%' OR LOWER(product_line) LIKE '%short%' THEN 'short_term'
  ELSE 'insurance'
END
WHERE plan_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_plans_plan_type
  ON plans (organization_id, plan_type);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CONSTRAIN members.plan_type + ADD plan_id FK
-- ═══════════════════════════════════════════════════════════════════════════════

-- members.plan_type already exists as unconstrained text — add CHECK
ALTER TABLE members
  ADD CONSTRAINT chk_members_plan_type
    CHECK (plan_type IS NULL OR plan_type IN ('healthshare', 'insurance', 'medicaid', 'short_term'));

-- Add direct plan reference for quick lookups
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id) ON DELETE SET NULL;

-- Add active_plan_type as computed-friendly column (denormalized for dashboard speed)
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS active_plan_type text
    CHECK (active_plan_type IS NULL OR active_plan_type IN ('healthshare', 'insurance', 'medicaid', 'short_term'));

CREATE INDEX IF NOT EXISTS idx_members_plan_type
  ON members (organization_id, plan_type) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_members_active_plan_type
  ON members (organization_id, active_plan_type) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_members_plan_id
  ON members (plan_id) WHERE plan_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. SYNC active_plan_type FROM plan ON membership CHANGE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_member_active_plan_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_type text;
BEGIN
  -- On membership insert/update, sync plan_type to member
  IF NEW.status = 'active' THEN
    SELECT p.plan_type INTO v_plan_type
    FROM plans p WHERE p.id = NEW.plan_id;

    UPDATE members
    SET active_plan_type = v_plan_type,
        plan_id = NEW.plan_id,
        plan_type = COALESCE(plan_type, v_plan_type)
    WHERE id = NEW.member_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_plan_type ON memberships;
CREATE TRIGGER trg_sync_member_plan_type
  AFTER INSERT OR UPDATE OF status, plan_id ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION sync_member_active_plan_type();


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
