-- ============================================================================
-- Dual-Capacity Role Architecture
-- Adds product_type enforcement so a single advisor/agent can sell:
--   • health_insurance only
--   • health_share only
--   • both (dual-capacity)
--
-- ADDITIVE ONLY — does not alter existing columns or break existing queries.
-- ============================================================================

-- 1. Create product_type enum
DO $$ BEGIN
  CREATE TYPE public.product_type_enum AS ENUM ('health_insurance', 'health_share');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add capacities to advisors (what they are licensed/authorized to sell)
ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS capacities text[] DEFAULT '{}';

COMMENT ON COLUMN public.advisors.capacities IS
  'Product types this advisor can sell: health_insurance, health_share, or both';

-- 3. Add product_type to products table (nullable for backward compatibility)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text;

COMMENT ON COLUMN public.products.product_type IS
  'Product classification: health_insurance or health_share';

-- 4. Add product_type to commissions table for separate tracking
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS product_type text;

COMMENT ON COLUMN public.commissions.product_type IS
  'Product type for this commission: health_insurance or health_share';

-- 5. Add product_type to commission_rates for rate differentiation
ALTER TABLE public.commission_rates
  ADD COLUMN IF NOT EXISTS product_type text;

COMMENT ON COLUMN public.commission_rates.product_type IS
  'Product type these rates apply to: health_insurance or health_share';

-- 6. Create index for commission queries by product_type
CREATE INDEX IF NOT EXISTS idx_commissions_product_type
  ON public.commissions (organization_id, product_type)
  WHERE product_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_rates_product_type
  ON public.commission_rates (organization_id, product_type)
  WHERE product_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_product_type
  ON public.products (organization_id, product_type)
  WHERE product_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_advisors_capacities
  ON public.advisors USING gin (capacities)
  WHERE capacities != '{}';


-- ============================================================================
-- 7. Validation function: ensures advisor has capacity for the product type
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_advisor_capacity(
  p_advisor_id uuid,
  p_product_type text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacities text[];
BEGIN
  -- If no product_type specified, allow (backward compatibility)
  IF p_product_type IS NULL OR p_product_type = '' THEN
    RETURN true;
  END IF;

  -- Validate product_type value
  IF p_product_type NOT IN ('health_insurance', 'health_share') THEN
    RAISE EXCEPTION 'Invalid product_type: %. Must be health_insurance or health_share', p_product_type;
  END IF;

  -- Get advisor capacities
  SELECT capacities INTO v_capacities
  FROM advisors
  WHERE id = p_advisor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advisor % not found', p_advisor_id;
  END IF;

  -- Empty capacities = no restriction (backward compatibility for existing advisors)
  IF v_capacities IS NULL OR array_length(v_capacities, 1) IS NULL THEN
    RETURN true;
  END IF;

  -- Check if advisor has the required capacity
  RETURN p_product_type = ANY(v_capacities);
END;
$$;

COMMENT ON FUNCTION public.validate_advisor_capacity IS
  'Validates that an advisor has the capacity (role) to sell a given product type';


-- ============================================================================
-- 8. Trigger: enforce capacity on commission insert/update
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_validate_commission_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce if product_type is set
  IF NEW.product_type IS NOT NULL AND NEW.advisor_id IS NOT NULL THEN
    IF NOT validate_advisor_capacity(NEW.advisor_id, NEW.product_type) THEN
      RAISE EXCEPTION 'Advisor % does not have capacity for product type %',
        NEW.advisor_id, NEW.product_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_capacity_check ON public.commissions;
CREATE TRIGGER trg_commission_capacity_check
  BEFORE INSERT OR UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validate_commission_capacity();


-- ============================================================================
-- 9. RPC: Get commissions summary split by product type
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_commission_summary_by_product_type(
  p_advisor_id uuid,
  p_org_id uuid,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL
)
RETURNS TABLE (
  product_type text,
  total_commissions numeric,
  commission_count bigint,
  avg_commission numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(c.product_type, 'unclassified') AS product_type,
    COALESCE(SUM(c.commission_amount), 0) AS total_commissions,
    COUNT(*) AS commission_count,
    COALESCE(AVG(c.commission_amount), 0) AS avg_commission
  FROM commissions c
  WHERE c.advisor_id = p_advisor_id
    AND c.organization_id = p_org_id
    AND (p_period_start IS NULL OR c.commission_period >= p_period_start)
    AND (p_period_end IS NULL OR c.commission_period <= p_period_end)
  GROUP BY COALESCE(c.product_type, 'unclassified')
  ORDER BY total_commissions DESC;
END;
$$;


-- ============================================================================
-- 10. RPC: Get advisors filtered by capacity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_advisors_by_capacity(
  p_org_id uuid,
  p_product_type text
)
RETURNS SETOF advisors
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_product_type IS NULL THEN
    -- No filter — return all active advisors
    RETURN QUERY
    SELECT * FROM advisors
    WHERE organization_id = p_org_id
      AND status = 'active'
    ORDER BY last_name, first_name;
  ELSE
    -- Filter by capacity (include advisors with empty capacities for backward compat)
    RETURN QUERY
    SELECT * FROM advisors
    WHERE organization_id = p_org_id
      AND status = 'active'
      AND (
        capacities = '{}'
        OR capacities IS NULL
        OR p_product_type = ANY(capacities)
      )
    ORDER BY last_name, first_name;
  END IF;
END;
$$;


-- ============================================================================
-- 11. RLS policies for capacity-scoped access
-- ============================================================================

-- Products: advisors can only see products matching their capacity
-- (Keep existing policies, add capacity-aware policy for advisors)
DO $$ BEGIN
  DROP POLICY IF EXISTS "advisors_see_capacity_products" ON public.products;
  -- Note: This is additive. Existing admin SELECT policies remain.
  -- Advisors with capacities set can only see matching products.
  -- Advisors with empty capacities see all (backward compat).
  CREATE POLICY "advisors_see_capacity_products" ON public.products
    FOR SELECT
    USING (
      -- Product has no type = visible to everyone
      product_type IS NULL
      OR EXISTS (
        SELECT 1 FROM advisors a
        JOIN profiles p ON p.id = a.profile_id
        WHERE p.user_id = auth.uid()
          AND a.organization_id = products.organization_id
          AND (
            a.capacities = '{}'
            OR a.capacities IS NULL
            OR products.product_type = ANY(a.capacities)
          )
      )
      -- Admins/staff see everything
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
          AND p.organization_id = products.organization_id
          AND p.role IN ('owner', 'admin', 'staff')
      )
    );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ============================================================================
-- Done. All changes are additive and backward-compatible.
-- Existing queries continue to work unchanged.
-- ============================================================================
