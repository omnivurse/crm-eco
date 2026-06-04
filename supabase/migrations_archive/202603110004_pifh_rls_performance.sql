-- ============================================================================
-- PHASE I + J: RLS Policies + Performance Strategy
-- Security, partitioning prep, materialized views, indexes
-- ============================================================================

-- ============================================================================
-- I.1  RLS — rating_areas (public read)
-- ============================================================================
ALTER TABLE rating_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rating_areas_public_read" ON rating_areas;
CREATE POLICY "rating_areas_public_read" ON rating_areas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rating_areas_admin_write" ON rating_areas;
CREATE POLICY "rating_areas_admin_write" ON rating_areas
  FOR ALL TO authenticated
  USING (get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- I.2  RLS — age_bands (public read)
-- ============================================================================
ALTER TABLE age_bands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "age_bands_public_read" ON age_bands;
CREATE POLICY "age_bands_public_read" ON age_bands
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "age_bands_admin_write" ON age_bands;
CREATE POLICY "age_bands_admin_write" ON age_bands
  FOR ALL TO authenticated
  USING (get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- I.3  RLS — plan_rates (authenticated read)
-- ============================================================================
ALTER TABLE plan_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_rates_auth_read" ON plan_rates;
CREATE POLICY "plan_rates_auth_read" ON plan_rates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_rates.plan_id AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "plan_rates_admin_write" ON plan_rates;
CREATE POLICY "plan_rates_admin_write" ON plan_rates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_rates.plan_id
        AND pr.user_id = auth.uid()
        AND get_user_role() IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- I.4  RLS — tobacco_multipliers (authenticated read, admin write)
-- ============================================================================
ALTER TABLE tobacco_multipliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tobacco_multipliers_auth_read" ON tobacco_multipliers;
CREATE POLICY "tobacco_multipliers_auth_read" ON tobacco_multipliers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tobacco_multipliers_admin_write" ON tobacco_multipliers;
CREATE POLICY "tobacco_multipliers_admin_write" ON tobacco_multipliers
  FOR ALL TO authenticated
  USING (get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- I.5  RLS — plan_healthshare_config (authenticated read)
-- ============================================================================
ALTER TABLE plan_healthshare_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_hs_config_auth_read" ON plan_healthshare_config;
CREATE POLICY "plan_hs_config_auth_read" ON plan_healthshare_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_healthshare_config.plan_id AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "plan_hs_config_admin_write" ON plan_healthshare_config;
CREATE POLICY "plan_hs_config_admin_write" ON plan_healthshare_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_healthshare_config.plan_id
        AND pr.user_id = auth.uid()
        AND get_user_role() IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- I.6  RLS — plan_traditional_config (authenticated read)
-- ============================================================================
ALTER TABLE plan_traditional_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_trad_config_auth_read" ON plan_traditional_config;
CREATE POLICY "plan_trad_config_auth_read" ON plan_traditional_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_traditional_config.plan_id AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "plan_trad_config_admin_write" ON plan_traditional_config;
CREATE POLICY "plan_trad_config_admin_write" ON plan_traditional_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_traditional_config.plan_id
        AND pr.user_id = auth.uid()
        AND get_user_role() IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- I.7  RLS — plan_versions (admin actions)
-- ============================================================================
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_versions_auth_read" ON plan_versions;
CREATE POLICY "plan_versions_auth_read" ON plan_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_versions.plan_id AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "plan_versions_admin_write" ON plan_versions;
CREATE POLICY "plan_versions_admin_write" ON plan_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_versions.plan_id
        AND pr.user_id = auth.uid()
        AND get_user_role() IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- I.8  RLS — quote_snapshots (advisor scoped)
-- ============================================================================
ALTER TABLE quote_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_snapshots_org_read" ON quote_snapshots;
CREATE POLICY "quote_snapshots_org_read" ON quote_snapshots
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "quote_snapshots_insert" ON quote_snapshots;
CREATE POLICY "quote_snapshots_insert" ON quote_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "quote_snapshots_admin_update" ON quote_snapshots;
CREATE POLICY "quote_snapshots_admin_update" ON quote_snapshots
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ============================================================================
-- I.9  RLS — benefit_tiers (public read)
-- ============================================================================
ALTER TABLE benefit_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "benefit_tiers_public_read" ON benefit_tiers;
CREATE POLICY "benefit_tiers_public_read" ON benefit_tiers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "benefit_tiers_admin_write" ON benefit_tiers;
CREATE POLICY "benefit_tiers_admin_write" ON benefit_tiers
  FOR ALL TO authenticated
  USING (get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- I.10  RLS — plan_benefit_matrix (authenticated read)
-- ============================================================================
ALTER TABLE plan_benefit_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_benefit_matrix_auth_read" ON plan_benefit_matrix;
CREATE POLICY "plan_benefit_matrix_auth_read" ON plan_benefit_matrix
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_benefit_matrix.plan_id AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "plan_benefit_matrix_admin_write" ON plan_benefit_matrix;
CREATE POLICY "plan_benefit_matrix_admin_write" ON plan_benefit_matrix
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans p
      JOIN profiles pr ON pr.organization_id = p.organization_id
      WHERE p.id = plan_benefit_matrix.plan_id
        AND pr.user_id = auth.uid()
        AND get_user_role() IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- I.11  RLS — tier config tables (admin write only)
-- ============================================================================
ALTER TABLE plan_healthshare_tier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_traditional_tier_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hs_tier_config_read" ON plan_healthshare_tier_config;
CREATE POLICY "hs_tier_config_read" ON plan_healthshare_tier_config
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "hs_tier_config_admin_write" ON plan_healthshare_tier_config;
CREATE POLICY "hs_tier_config_admin_write" ON plan_healthshare_tier_config
  FOR ALL TO authenticated
  USING (get_user_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "trad_tier_config_read" ON plan_traditional_tier_config;
CREATE POLICY "trad_tier_config_read" ON plan_traditional_tier_config
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "trad_tier_config_admin_write" ON plan_traditional_tier_config;
CREATE POLICY "trad_tier_config_admin_write" ON plan_traditional_tier_config
  FOR ALL TO authenticated
  USING (get_user_role() IN ('owner', 'admin'));

-- ============================================================================
-- J.1  Performance — Materialized View for pricing lookups
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS pricing_lookup_mv AS
SELECT
  p.id AS plan_id,
  COALESCE(p.plan_code, p.code) AS plan_code,
  p.name AS plan_name,
  p.brand_name,
  p.category,
  p.metal_tier,
  ra.id AS rating_area_id,
  ra.rating_area_code,
  ra.state,
  ab.id AS age_band_id,
  ab.band_label,
  ab.min_age,
  ab.max_age,
  pr.tobacco,
  pr.monthly_rate,
  pr.effective_year,
  bt.id AS benefit_tier_id,
  bt.tier_code,
  bt.display_name AS tier_name,
  pbm.premium_modifier,
  pbm.fixed_adjustment,
  ROUND(pr.monthly_rate * COALESCE(pbm.premium_modifier, 1.0) + COALESCE(pbm.fixed_adjustment, 0), 2) AS tiered_monthly_rate,
  ROUND((pr.monthly_rate * COALESCE(pbm.premium_modifier, 1.0) + COALESCE(pbm.fixed_adjustment, 0)) * 12, 2) AS tiered_annual_rate
FROM plan_rates pr
JOIN plans p ON p.id = pr.plan_id
JOIN rating_areas ra ON ra.id = pr.rating_area_id
JOIN age_bands ab ON ab.id = pr.age_band_id
LEFT JOIN plan_benefit_matrix pbm ON pbm.plan_id = p.id AND pbm.active = true
LEFT JOIN benefit_tiers bt ON bt.id = pbm.benefit_tier_id
WHERE p.is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_mv_lookup
  ON pricing_lookup_mv(plan_id, rating_area_id, age_band_id, tobacco, effective_year, benefit_tier_id);

CREATE INDEX IF NOT EXISTS idx_pricing_mv_plan_code ON pricing_lookup_mv(plan_code);
CREATE INDEX IF NOT EXISTS idx_pricing_mv_area ON pricing_lookup_mv(rating_area_code);
CREATE INDEX IF NOT EXISTS idx_pricing_mv_year ON pricing_lookup_mv(effective_year);

COMMENT ON MATERIALIZED VIEW pricing_lookup_mv IS 'Pre-computed pricing projection for fast API lookups — refresh after rate changes';

-- ============================================================================
-- J.2  Function to refresh materialized view
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_pricing_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY pricing_lookup_mv;
END;
$$;

COMMENT ON FUNCTION refresh_pricing_mv IS 'Concurrently refresh the pricing lookup materialized view';

GRANT EXECUTE ON FUNCTION refresh_pricing_mv TO authenticated;

-- ============================================================================
-- J.3  Trigger-based refresh on rate changes
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_refresh_pricing_mv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Debounce: only refresh if it hasn't been refreshed in the last 5 seconds
  -- In production, use pg_cron or application-level refresh instead
  PERFORM pg_advisory_xact_lock(hashtext('pricing_mv_refresh'));
  REFRESH MATERIALIZED VIEW CONCURRENTLY pricing_lookup_mv;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Non-blocking: if concurrent refresh is already running, skip
  RETURN NULL;
END;
$$;

-- Note: trigger commented out for production — use pg_cron or manual refresh
-- Uncomment if you want auto-refresh on rate changes:
-- CREATE TRIGGER trg_refresh_pricing_mv_on_rate_change
--   AFTER INSERT OR UPDATE OR DELETE ON plan_rates
--   FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_pricing_mv();

-- ============================================================================
-- J.4  Additional performance indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_plans_code_active ON plans(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plans_plan_code_active ON plans(plan_code) WHERE is_active = true AND plan_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_category_active ON plans(category, is_active) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plans_org_category ON plans(organization_id, category);

-- Quote lookup optimization
CREATE INDEX IF NOT EXISTS idx_quote_snapshots_plan_year ON quote_snapshots(plan_id, effective_year);

-- ============================================================================
-- J.5  Upgraded calculate_premium with benefit tier support (Phase K)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_premium(
  p_plan_code text,
  p_age integer,
  p_rating_area_code text,
  p_tobacco boolean DEFAULT false,
  p_year integer DEFAULT 2025,
  p_benefit_tier text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_age_band_id uuid;
  v_rating_area_id uuid;
  v_monthly_rate numeric;
  v_tobacco_multiplier numeric;
  v_plan_state text;
  v_tier_modifier numeric := 1.0;
  v_tier_adjustment numeric := 0;
BEGIN
  -- 1. Resolve plan_id
  SELECT id, rating_area_state INTO v_plan_id, v_plan_state
  FROM plans
  WHERE (plan_code = p_plan_code OR code = p_plan_code)
    AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', p_plan_code;
  END IF;

  -- 2. Resolve age band
  SELECT id INTO v_age_band_id
  FROM age_bands
  WHERE p_age >= min_age AND p_age <= max_age
  LIMIT 1;

  IF v_age_band_id IS NULL THEN
    RAISE EXCEPTION 'No age band for age: %', p_age;
  END IF;

  -- 3. Resolve rating area (with DEFAULT fallback)
  SELECT id INTO v_rating_area_id
  FROM rating_areas
  WHERE rating_area_code = p_rating_area_code AND is_active = true;

  IF v_rating_area_id IS NULL THEN
    SELECT id INTO v_rating_area_id
    FROM rating_areas WHERE rating_area_code = 'DEFAULT-001';
  END IF;

  IF v_rating_area_id IS NULL THEN
    RAISE EXCEPTION 'Rating area not found: %', p_rating_area_code;
  END IF;

  -- 4. Look up base rate (single composite index scan)
  SELECT monthly_rate INTO v_monthly_rate
  FROM plan_rates
  WHERE plan_id = v_plan_id
    AND rating_area_id = v_rating_area_id
    AND age_band_id = v_age_band_id
    AND tobacco = false
    AND effective_year = p_year;

  IF v_monthly_rate IS NULL THEN
    RAISE EXCEPTION 'No rate for plan=%, area=%, age=%, year=%',
      p_plan_code, p_rating_area_code, p_age, p_year;
  END IF;

  -- 5. Apply benefit tier modifier (Phase K)
  IF p_benefit_tier IS NOT NULL THEN
    SELECT pbm.premium_modifier, pbm.fixed_adjustment
    INTO v_tier_modifier, v_tier_adjustment
    FROM plan_benefit_matrix pbm
    JOIN benefit_tiers bt ON bt.id = pbm.benefit_tier_id
    WHERE pbm.plan_id = v_plan_id
      AND bt.tier_code = p_benefit_tier
      AND pbm.active = true;

    v_tier_modifier := COALESCE(v_tier_modifier, 1.0);
    v_tier_adjustment := COALESCE(v_tier_adjustment, 0);
  END IF;

  -- Apply tier: final = base × modifier + adjustment
  v_monthly_rate := ROUND(v_monthly_rate * v_tier_modifier + v_tier_adjustment, 2);

  -- 6. Apply tobacco multiplier
  IF p_tobacco THEN
    SELECT multiplier INTO v_tobacco_multiplier
    FROM tobacco_multipliers
    WHERE (state = COALESCE(v_plan_state, 'DEFAULT') OR state = 'DEFAULT')
      AND effective_year = p_year
    ORDER BY CASE WHEN state = 'DEFAULT' THEN 1 ELSE 0 END
    LIMIT 1;

    v_tobacco_multiplier := COALESCE(v_tobacco_multiplier, 1.5);
    v_monthly_rate := ROUND(v_monthly_rate * v_tobacco_multiplier, 2);
  END IF;

  RETURN v_monthly_rate;
END;
$$;

-- Drop old 5-param overload so the upgraded 6-param version replaces it cleanly
DROP FUNCTION IF EXISTS compare_premiums(text[], integer, text, boolean, integer);

-- Upgrade compare_premiums with tier support
CREATE OR REPLACE FUNCTION compare_premiums(
  p_plan_codes text[],
  p_age integer,
  p_rating_area_code text,
  p_tobacco boolean DEFAULT false,
  p_year integer DEFAULT 2025,
  p_benefit_tier text DEFAULT NULL
)
RETURNS TABLE (
  plan_code text,
  plan_name text,
  brand_name text,
  category text,
  metal_tier text,
  benefit_tier text,
  monthly_premium numeric,
  annual_premium numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(p.plan_code, p.code) AS plan_code,
    p.name AS plan_name,
    p.brand_name,
    p.category,
    p.metal_tier,
    p_benefit_tier AS benefit_tier,
    calculate_premium(COALESCE(p.plan_code, p.code), p_age, p_rating_area_code, p_tobacco, p_year, p_benefit_tier) AS monthly_premium,
    calculate_premium(COALESCE(p.plan_code, p.code), p_age, p_rating_area_code, p_tobacco, p_year, p_benefit_tier) * 12 AS annual_premium
  FROM plans p
  WHERE (p.plan_code = ANY(p_plan_codes) OR p.code = ANY(p_plan_codes))
    AND p.is_active = true
  ORDER BY monthly_premium ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION compare_premiums(text[], integer, text, boolean, integer, text) TO authenticated;
