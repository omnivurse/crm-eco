-- ============================================================================
-- HEALTHCARE NETWORK INTELLIGENCE ENGINE
-- Provider network grouping, cost-optimized routing, coverage scoring
-- ============================================================================

-- ============================================================================
-- 1. provider_networks -- master catalog of named networks
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_networks (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  network_code      text         NOT NULL,
  network_name      text         NOT NULL,
  network_type      text         NOT NULL DEFAULT 'ppo'
    CHECK (network_type IN ('ppo', 'hmo', 'epo', 'pos', 'preferred', 'open', 'custom')),
  carrier_id        uuid         REFERENCES insurance_carriers(id) ON DELETE SET NULL,
  description       text,
  coverage_states   text[]       DEFAULT '{}',
  effective_date    date         DEFAULT CURRENT_DATE,
  end_date          date,
  is_active         boolean      NOT NULL DEFAULT true,
  metadata          jsonb        NOT NULL DEFAULT '{}',
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_network_org_code
    UNIQUE (organization_id, network_code)
);

COMMENT ON TABLE provider_networks IS 'Named provider networks (PPO, HMO, preferred, etc.)';
COMMENT ON COLUMN provider_networks.carrier_id IS 'Optional link to insurance_carriers — which carrier owns/manages this network';
COMMENT ON COLUMN provider_networks.coverage_states IS 'US state codes where this network is available';

-- ============================================================================
-- 2. network_providers -- providers linked to networks with tier info
-- ============================================================================
CREATE TABLE IF NOT EXISTS network_providers (
  id                      uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id              uuid         NOT NULL REFERENCES provider_networks(id) ON DELETE CASCADE,
  healthcare_location_id  uuid         REFERENCES healthcare_locations(id) ON DELETE CASCADE,
  provider_location_id    uuid         REFERENCES provider_locations(id) ON DELETE CASCADE,
  CONSTRAINT chk_at_least_one_location
    CHECK (healthcare_location_id IS NOT NULL OR provider_location_id IS NOT NULL),
  network_tier            text         NOT NULL DEFAULT 'in_network'
    CHECK (network_tier IN ('in_network_preferred', 'in_network', 'out_of_network')),
  tier_discount_pct       numeric(5,2) DEFAULT 0,
  specialty_tags          text[]       DEFAULT '{}',
  accepting_new_patients  boolean      DEFAULT true,
  effective_date          date         DEFAULT CURRENT_DATE,
  end_date                date,
  credentialed_at         timestamptz,
  notes                   text,
  is_active               boolean      NOT NULL DEFAULT true,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT uq_network_hl
    UNIQUE NULLS NOT DISTINCT (network_id, healthcare_location_id),
  CONSTRAINT uq_network_pl
    UNIQUE NULLS NOT DISTINCT (network_id, provider_location_id)
);

COMMENT ON TABLE network_providers IS 'Provider-to-network membership with tier classification';
COMMENT ON COLUMN network_providers.network_tier IS 'in_network_preferred | in_network | out_of_network';
COMMENT ON COLUMN network_providers.tier_discount_pct IS 'Percentage discount for this tier (0 = no special discount)';

-- ============================================================================
-- 3. network_plan_links -- which plans use which networks
-- ============================================================================
CREATE TABLE IF NOT EXISTS network_plan_links (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id      uuid         NOT NULL REFERENCES provider_networks(id) ON DELETE CASCADE,
  plan_id         uuid         NOT NULL REFERENCES insurance_plans(id) ON DELETE CASCADE,
  is_primary      boolean      DEFAULT true,
  created_at      timestamptz  NOT NULL DEFAULT now(),

  UNIQUE (network_id, plan_id)
);

COMMENT ON TABLE network_plan_links IS 'Maps insurance plans to their provider networks';

-- ============================================================================
-- 4. network_coverage_zips -- pre-computed ZIP-level coverage summary
-- ============================================================================
CREATE TABLE IF NOT EXISTS network_coverage_zips (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id          uuid         NOT NULL REFERENCES provider_networks(id) ON DELETE CASCADE,
  zip_code            text         NOT NULL,
  state               text,
  provider_count      integer      NOT NULL DEFAULT 0,
  preferred_count     integer      NOT NULL DEFAULT 0,
  specialty_coverage  jsonb        NOT NULL DEFAULT '{}',
  coverage_score      numeric(5,2) NOT NULL DEFAULT 0,
  last_computed_at    timestamptz  NOT NULL DEFAULT now(),

  UNIQUE (network_id, zip_code)
);

COMMENT ON TABLE network_coverage_zips IS 'Pre-computed ZIP-level network coverage for fast lookups and scoring';
COMMENT ON COLUMN network_coverage_zips.coverage_score IS 'Weighted score 0-100 based on provider count, category breadth, and preferred tier ratio';

-- ============================================================================
-- 5. Indexes
-- ============================================================================

-- provider_networks
CREATE INDEX IF NOT EXISTS idx_networks_org
  ON provider_networks (organization_id);
CREATE INDEX IF NOT EXISTS idx_networks_type
  ON provider_networks (organization_id, network_type);
CREATE INDEX IF NOT EXISTS idx_networks_carrier
  ON provider_networks (carrier_id) WHERE carrier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_networks_active
  ON provider_networks (organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_networks_states
  ON provider_networks USING gin (coverage_states);

-- network_providers
CREATE INDEX IF NOT EXISTS idx_np_network
  ON network_providers (network_id);
CREATE INDEX IF NOT EXISTS idx_np_hl
  ON network_providers (healthcare_location_id) WHERE healthcare_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_np_pl
  ON network_providers (provider_location_id) WHERE provider_location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_np_tier
  ON network_providers (network_id, network_tier);
CREATE INDEX IF NOT EXISTS idx_np_active
  ON network_providers (network_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_np_specialty
  ON network_providers USING gin (specialty_tags);

-- network_plan_links
CREATE INDEX IF NOT EXISTS idx_npl_network
  ON network_plan_links (network_id);
CREATE INDEX IF NOT EXISTS idx_npl_plan
  ON network_plan_links (plan_id);

-- network_coverage_zips
CREATE INDEX IF NOT EXISTS idx_ncz_network
  ON network_coverage_zips (network_id);
CREATE INDEX IF NOT EXISTS idx_ncz_zip
  ON network_coverage_zips (zip_code);
CREATE INDEX IF NOT EXISTS idx_ncz_score
  ON network_coverage_zips (network_id, coverage_score DESC);

-- ============================================================================
-- 6. RPC: search_in_network_providers
-- Member-facing: find in-network providers near a ZIP for a given network
-- ============================================================================
CREATE OR REPLACE FUNCTION search_in_network_providers(
  p_network_id    uuid,
  p_zip_code      text,
  p_service_category text DEFAULT NULL,
  p_tier          text DEFAULT NULL,
  p_radius_miles  numeric DEFAULT 50,
  p_limit         integer DEFAULT 20
)
RETURNS TABLE (
  provider_id             uuid,
  provider_name           text,
  provider_type           text,
  address                 text,
  city                    text,
  state                   text,
  zip                     text,
  phone                   text,
  latitude                numeric,
  longitude               numeric,
  network_tier            text,
  tier_discount_pct       numeric,
  specialty_tags          text[],
  accepting_new_patients  boolean,
  distance_miles          numeric,
  source_table            text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
BEGIN
  -- Resolve ZIP center from existing locations
  SELECT hl.latitude, hl.longitude INTO v_lat, v_lng
  FROM healthcare_locations hl
  WHERE hl.zip = p_zip_code AND hl.latitude IS NOT NULL AND hl.is_active = true
  LIMIT 1;

  IF v_lat IS NULL THEN
    SELECT pl.latitude, pl.longitude INTO v_lat, v_lng
    FROM provider_locations pl
    WHERE pl.zip = p_zip_code AND pl.latitude IS NOT NULL AND pl.is_active = true
    LIMIT 1;
  END IF;

  RETURN QUERY
  (
    -- Healthcare locations branch
    SELECT
      np.id                     AS provider_id,
      hl.name                   AS provider_name,
      hl.location_type          AS provider_type,
      hl.address_line1          AS address,
      hl.city,
      hl.state,
      hl.zip,
      hl.phone,
      hl.latitude,
      hl.longitude,
      np.network_tier,
      np.tier_discount_pct,
      np.specialty_tags,
      COALESCE(np.accepting_new_patients, hl.accepting_new_patients) AS accepting_new_patients,
      CASE
        WHEN v_lat IS NOT NULL AND hl.latitude IS NOT NULL THEN
          ROUND(
            (3959.0 * acos(
              LEAST(1.0,
                cos(radians(v_lat)) * cos(radians(hl.latitude)) *
                cos(radians(hl.longitude) - radians(v_lng)) +
                sin(radians(v_lat)) * sin(radians(hl.latitude))
              )
            ))::numeric, 1
          )
        ELSE NULL
      END                       AS distance_miles,
      'healthcare_locations'::text AS source_table
    FROM network_providers np
    INNER JOIN healthcare_locations hl ON hl.id = np.healthcare_location_id
    WHERE np.network_id = p_network_id
      AND np.is_active = true
      AND hl.is_active = true
      AND (np.end_date IS NULL OR np.end_date > CURRENT_DATE)
      AND (p_tier IS NULL OR np.network_tier = p_tier)
      AND (
        p_service_category IS NULL
        OR p_service_category = ANY(np.specialty_tags)
        OR EXISTS (
          SELECT 1 FROM healthcare_location_services hls
          JOIN healthcare_services hs ON hs.id = hls.service_id
          WHERE hls.location_id = hl.id AND hs.service_category = p_service_category
        )
      )
      AND (
        v_lat IS NULL OR hl.latitude IS NULL
        OR (3959.0 * acos(
            LEAST(1.0,
              cos(radians(v_lat)) * cos(radians(hl.latitude)) *
              cos(radians(hl.longitude) - radians(v_lng)) +
              sin(radians(v_lat)) * sin(radians(hl.latitude))
            )
          ) <= p_radius_miles)
      )

    UNION ALL

    -- Provider locations branch
    SELECT
      np.id                     AS provider_id,
      pl.name                   AS provider_name,
      pl.provider_type,
      pl.address_line1          AS address,
      pl.city,
      pl.state,
      pl.zip,
      pl.phone,
      pl.latitude,
      pl.longitude,
      np.network_tier,
      np.tier_discount_pct,
      np.specialty_tags,
      COALESCE(np.accepting_new_patients, pl.accepting_patients) AS accepting_new_patients,
      CASE
        WHEN v_lat IS NOT NULL AND pl.latitude IS NOT NULL THEN
          ROUND(
            (3959.0 * acos(
              LEAST(1.0,
                cos(radians(v_lat)) * cos(radians(pl.latitude)) *
                cos(radians(pl.longitude) - radians(v_lng)) +
                sin(radians(v_lat)) * sin(radians(pl.latitude))
              )
            ))::numeric, 1
          )
        ELSE NULL
      END                       AS distance_miles,
      'provider_locations'::text AS source_table
    FROM network_providers np
    INNER JOIN provider_locations pl ON pl.id = np.provider_location_id
    WHERE np.network_id = p_network_id
      AND np.healthcare_location_id IS NULL  -- avoid double-counting
      AND np.is_active = true
      AND pl.is_active = true
      AND (np.end_date IS NULL OR np.end_date > CURRENT_DATE)
      AND (p_tier IS NULL OR np.network_tier = p_tier)
      AND (p_service_category IS NULL OR p_service_category = ANY(np.specialty_tags))
      AND (
        v_lat IS NULL OR pl.latitude IS NULL
        OR (3959.0 * acos(
            LEAST(1.0,
              cos(radians(v_lat)) * cos(radians(pl.latitude)) *
              cos(radians(pl.longitude) - radians(v_lng)) +
              sin(radians(v_lat)) * sin(radians(pl.latitude))
            )
          ) <= p_radius_miles)
      )
  )
  ORDER BY
    CASE network_tier
      WHEN 'in_network_preferred' THEN 1
      WHEN 'in_network' THEN 2
      WHEN 'out_of_network' THEN 3
    END,
    distance_miles ASC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_in_network_providers TO authenticated;
COMMENT ON FUNCTION search_in_network_providers IS 'Find in-network providers near a ZIP, sorted by tier then distance';

-- ============================================================================
-- 7. RPC: find_cheapest_in_network_provider
-- Cost-optimized routing: cheapest in-network provider for a procedure
-- ============================================================================
CREATE OR REPLACE FUNCTION find_cheapest_in_network_provider(
  p_network_id      uuid,
  p_procedure_id    uuid,
  p_zip_code        text,
  p_radius_miles    numeric DEFAULT 50,
  p_limit           integer DEFAULT 10
)
RETURNS TABLE (
  provider_location_id    uuid,
  provider_name           text,
  city                    text,
  state                   text,
  zip                     text,
  distance_miles          numeric,
  network_tier            text,
  tier_discount_pct       numeric,
  cash_price              numeric,
  discounted_price        numeric,
  effective_price         numeric,
  savings_vs_cash         numeric,
  rating                  numeric,
  review_count            integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
BEGIN
  -- Resolve ZIP center
  SELECT pl.latitude, pl.longitude INTO v_lat, v_lng
  FROM provider_locations pl
  WHERE pl.zip = p_zip_code AND pl.latitude IS NOT NULL
  LIMIT 1;

  IF v_lat IS NULL THEN
    SELECT hl.latitude, hl.longitude INTO v_lat, v_lng
    FROM healthcare_locations hl
    WHERE hl.zip = p_zip_code AND hl.latitude IS NOT NULL
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    pl.id                   AS provider_location_id,
    pl.name                 AS provider_name,
    pl.city,
    pl.state,
    pl.zip,
    CASE
      WHEN v_lat IS NOT NULL AND pl.latitude IS NOT NULL THEN
        ROUND(
          (3959.0 * acos(
            LEAST(1.0,
              cos(radians(v_lat)) * cos(radians(pl.latitude)) *
              cos(radians(pl.longitude) - radians(v_lng)) +
              sin(radians(v_lat)) * sin(radians(pl.latitude))
            )
          ))::numeric, 1
        )
      ELSE NULL
    END                     AS distance_miles,
    np.network_tier,
    np.tier_discount_pct,
    pp.cash_price,
    pp.discounted_price,
    ROUND(
      COALESCE(pp.discounted_price, pp.cash_price) *
      (1 - COALESCE(np.tier_discount_pct, 0) / 100.0), 2
    )                       AS effective_price,
    ROUND(
      pp.cash_price - (
        COALESCE(pp.discounted_price, pp.cash_price) *
        (1 - COALESCE(np.tier_discount_pct, 0) / 100.0)
      ), 2
    )                       AS savings_vs_cash,
    pl.rating,
    pl.review_count
  FROM network_providers np
  INNER JOIN provider_locations pl ON pl.id = np.provider_location_id
  INNER JOIN procedure_prices pp ON pp.provider_location_id = pl.id
  WHERE np.network_id = p_network_id
    AND pp.procedure_id = p_procedure_id
    AND np.is_active = true
    AND pl.is_active = true
    AND pp.is_active = true
    AND np.network_tier IN ('in_network_preferred', 'in_network')
    AND (np.end_date IS NULL OR np.end_date > CURRENT_DATE)
    AND (
      v_lat IS NULL OR pl.latitude IS NULL
      OR (3959.0 * acos(
          LEAST(1.0,
            cos(radians(v_lat)) * cos(radians(pl.latitude)) *
            cos(radians(pl.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(pl.latitude))
          )
        ) <= p_radius_miles)
    )
  ORDER BY
    ROUND(
      COALESCE(pp.discounted_price, pp.cash_price) *
      (1 - COALESCE(np.tier_discount_pct, 0) / 100.0), 2
    ) ASC,
    CASE np.network_tier
      WHEN 'in_network_preferred' THEN 1
      WHEN 'in_network' THEN 2
    END
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION find_cheapest_in_network_provider TO authenticated;
COMMENT ON FUNCTION find_cheapest_in_network_provider IS 'Find cheapest in-network provider for a procedure near a ZIP';

-- ============================================================================
-- 8. RPC: get_network_coverage_score
-- How well does a network cover a ZIP/region?
-- ============================================================================
CREATE OR REPLACE FUNCTION get_network_coverage_score(
  p_network_id  uuid,
  p_zip_code    text DEFAULT NULL,
  p_state       text DEFAULT NULL
)
RETURNS TABLE (
  network_id          uuid,
  network_name        text,
  network_type        text,
  zip_code            text,
  total_providers     bigint,
  preferred_providers bigint,
  specialty_coverage  jsonb,
  coverage_score      numeric,
  coverage_grade      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pn.id                AS network_id,
    pn.network_name,
    pn.network_type,
    ncz.zip_code,
    ncz.provider_count::bigint  AS total_providers,
    ncz.preferred_count::bigint AS preferred_providers,
    ncz.specialty_coverage,
    ncz.coverage_score,
    CASE
      WHEN ncz.coverage_score >= 90 THEN 'A'
      WHEN ncz.coverage_score >= 70 THEN 'B'
      WHEN ncz.coverage_score >= 50 THEN 'C'
      WHEN ncz.coverage_score >= 30 THEN 'D'
      ELSE 'F'
    END                  AS coverage_grade
  FROM provider_networks pn
  INNER JOIN network_coverage_zips ncz ON ncz.network_id = pn.id
  WHERE pn.id = p_network_id
    AND (p_zip_code IS NULL OR ncz.zip_code = p_zip_code)
    AND (p_state IS NULL OR ncz.state = p_state)
  ORDER BY ncz.coverage_score DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_network_coverage_score TO authenticated;

-- ============================================================================
-- 9. RPC: compare_network_coverage
-- Side-by-side comparison of multiple networks for a ZIP
-- ============================================================================
CREATE OR REPLACE FUNCTION compare_network_coverage(
  p_network_ids  uuid[],
  p_zip_code     text
)
RETURNS TABLE (
  network_id          uuid,
  network_name        text,
  network_type        text,
  carrier_name        text,
  total_providers     integer,
  preferred_providers integer,
  specialty_coverage  jsonb,
  coverage_score      numeric,
  coverage_grade      text,
  avg_tier_discount   numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pn.id                AS network_id,
    pn.network_name,
    pn.network_type,
    ic.carrier_name,
    COALESCE(ncz.provider_count, 0)  AS total_providers,
    COALESCE(ncz.preferred_count, 0) AS preferred_providers,
    COALESCE(ncz.specialty_coverage, '{}'::jsonb) AS specialty_coverage,
    COALESCE(ncz.coverage_score, 0)  AS coverage_score,
    CASE
      WHEN COALESCE(ncz.coverage_score, 0) >= 90 THEN 'A'
      WHEN COALESCE(ncz.coverage_score, 0) >= 70 THEN 'B'
      WHEN COALESCE(ncz.coverage_score, 0) >= 50 THEN 'C'
      WHEN COALESCE(ncz.coverage_score, 0) >= 30 THEN 'D'
      ELSE 'F'
    END                  AS coverage_grade,
    COALESCE(
      (SELECT ROUND(AVG(np2.tier_discount_pct), 2)
       FROM network_providers np2
       WHERE np2.network_id = pn.id AND np2.is_active = true),
      0
    )                    AS avg_tier_discount
  FROM provider_networks pn
  LEFT JOIN network_coverage_zips ncz
    ON ncz.network_id = pn.id AND ncz.zip_code = p_zip_code
  LEFT JOIN insurance_carriers ic ON ic.id = pn.carrier_id
  WHERE pn.id = ANY(p_network_ids)
    AND pn.is_active = true
  ORDER BY COALESCE(ncz.coverage_score, 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION compare_network_coverage TO authenticated;

-- ============================================================================
-- 10. RPC: recompute_network_coverage_zip
-- Recomputes the pre-computed coverage for a (network, zip) pair
-- ============================================================================
CREATE OR REPLACE FUNCTION recompute_network_coverage_zip(
  p_network_id uuid,
  p_zip_code   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_count integer := 0;
  v_preferred_count integer := 0;
  v_specialty jsonb := '{}'::jsonb;
  v_score numeric := 0;
  v_state text;
  v_categories_covered integer := 0;
  v_max_categories constant integer := 10;
BEGIN
  -- Count active in-network providers whose location ZIP matches
  SELECT COUNT(*), COUNT(*) FILTER (WHERE np.network_tier = 'in_network_preferred')
  INTO v_provider_count, v_preferred_count
  FROM network_providers np
  LEFT JOIN healthcare_locations hl ON hl.id = np.healthcare_location_id
  LEFT JOIN provider_locations pl ON pl.id = np.provider_location_id
  WHERE np.network_id = p_network_id
    AND np.is_active = true
    AND np.network_tier IN ('in_network_preferred', 'in_network')
    AND (hl.zip = p_zip_code OR pl.zip = p_zip_code);

  -- Compute specialty tag distribution
  SELECT COALESCE(jsonb_object_agg(tag, cnt), '{}'::jsonb)
  INTO v_specialty
  FROM (
    SELECT unnest(np.specialty_tags) AS tag, COUNT(*) AS cnt
    FROM network_providers np
    LEFT JOIN healthcare_locations hl ON hl.id = np.healthcare_location_id
    LEFT JOIN provider_locations pl ON pl.id = np.provider_location_id
    WHERE np.network_id = p_network_id
      AND np.is_active = true
      AND (hl.zip = p_zip_code OR pl.zip = p_zip_code)
    GROUP BY unnest(np.specialty_tags)
  ) sub;

  -- Count unique categories covered
  SELECT COUNT(DISTINCT tag) INTO v_categories_covered
  FROM (
    SELECT unnest(np.specialty_tags) AS tag
    FROM network_providers np
    LEFT JOIN healthcare_locations hl ON hl.id = np.healthcare_location_id
    LEFT JOIN provider_locations pl ON pl.id = np.provider_location_id
    WHERE np.network_id = p_network_id
      AND np.is_active = true
      AND (hl.zip = p_zip_code OR pl.zip = p_zip_code)
  ) sub;

  -- Resolve state from ZIP
  SELECT COALESCE(hl.state, pl.state) INTO v_state
  FROM network_providers np
  LEFT JOIN healthcare_locations hl ON hl.id = np.healthcare_location_id
  LEFT JOIN provider_locations pl ON pl.id = np.provider_location_id
  WHERE np.network_id = p_network_id
    AND (hl.zip = p_zip_code OR pl.zip = p_zip_code)
  LIMIT 1;

  -- Score formula:
  -- 40% provider depth (capped at 20 providers = full marks)
  -- 30% category breadth (categories_covered / max_categories)
  -- 30% preferred tier ratio
  v_score := ROUND(
    (LEAST(v_provider_count, 20) / 20.0) * 40 +
    (LEAST(v_categories_covered, v_max_categories)::numeric / v_max_categories) * 30 +
    (CASE WHEN v_provider_count > 0 THEN v_preferred_count::numeric / v_provider_count ELSE 0 END) * 30
  , 2);

  -- Upsert
  INSERT INTO network_coverage_zips (
    network_id, zip_code, state, provider_count, preferred_count,
    specialty_coverage, coverage_score, last_computed_at
  ) VALUES (
    p_network_id, p_zip_code, v_state, v_provider_count, v_preferred_count,
    v_specialty, v_score, now()
  )
  ON CONFLICT (network_id, zip_code) DO UPDATE SET
    state = EXCLUDED.state,
    provider_count = EXCLUDED.provider_count,
    preferred_count = EXCLUDED.preferred_count,
    specialty_coverage = EXCLUDED.specialty_coverage,
    coverage_score = EXCLUDED.coverage_score,
    last_computed_at = EXCLUDED.last_computed_at;
END;
$$;

GRANT EXECUTE ON FUNCTION recompute_network_coverage_zip TO authenticated;

-- ============================================================================
-- 11. RLS Policies
-- ============================================================================

-- provider_networks
ALTER TABLE provider_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "networks_select_member" ON provider_networks
  FOR SELECT TO authenticated
  USING (is_crm_member(organization_id));

CREATE POLICY "networks_insert_manager" ON provider_networks
  FOR INSERT TO authenticated
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

CREATE POLICY "networks_update_manager" ON provider_networks
  FOR UPDATE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']))
  WITH CHECK (has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager']));

CREATE POLICY "networks_delete_admin" ON provider_networks
  FOR DELETE TO authenticated
  USING (has_crm_role(organization_id, ARRAY['crm_admin']));

CREATE POLICY "networks_service" ON provider_networks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- network_providers (scoped via network -> organization)
ALTER TABLE network_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "np_select_member" ON network_providers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_providers.network_id
      AND is_crm_member(pn.organization_id)
  ));

CREATE POLICY "np_insert_manager" ON network_providers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_providers.network_id
      AND has_crm_role(pn.organization_id, ARRAY['crm_admin', 'crm_manager'])
  ));

CREATE POLICY "np_update_manager" ON network_providers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_providers.network_id
      AND has_crm_role(pn.organization_id, ARRAY['crm_admin', 'crm_manager'])
  ));

CREATE POLICY "np_delete_admin" ON network_providers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_providers.network_id
      AND has_crm_role(pn.organization_id, ARRAY['crm_admin'])
  ));

CREATE POLICY "np_service" ON network_providers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- network_plan_links (scoped via network -> organization)
ALTER TABLE network_plan_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "npl_select_member" ON network_plan_links
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_plan_links.network_id
      AND is_crm_member(pn.organization_id)
  ));

CREATE POLICY "npl_insert_manager" ON network_plan_links
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_plan_links.network_id
      AND has_crm_role(pn.organization_id, ARRAY['crm_admin', 'crm_manager'])
  ));

CREATE POLICY "npl_delete_admin" ON network_plan_links
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_plan_links.network_id
      AND has_crm_role(pn.organization_id, ARRAY['crm_admin'])
  ));

CREATE POLICY "npl_service" ON network_plan_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- network_coverage_zips (scoped via network -> organization)
ALTER TABLE network_coverage_zips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ncz_select_member" ON network_coverage_zips
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_coverage_zips.network_id
      AND is_crm_member(pn.organization_id)
  ));

CREATE POLICY "ncz_modify_manager" ON network_coverage_zips
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_networks pn
    WHERE pn.id = network_coverage_zips.network_id
      AND has_crm_role(pn.organization_id, ARRAY['crm_admin', 'crm_manager'])
  ));

CREATE POLICY "ncz_service" ON network_coverage_zips
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 12. updated_at triggers and audit logging
-- ============================================================================
CREATE TRIGGER update_provider_networks_updated_at
  BEFORE UPDATE ON provider_networks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_network_providers_updated_at
  BEFORE UPDATE ON network_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger for provider_networks (matches carrier audit pattern)
CREATE OR REPLACE FUNCTION fn_audit_provider_networks()
RETURNS trigger AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    organization_id, app_source, actor_id,
    action, action_category, risk_level, details, changes
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'crm', NULL,
    CASE TG_OP
      WHEN 'INSERT' THEN 'network_created'
      WHEN 'UPDATE' THEN 'network_updated'
      WHEN 'DELETE' THEN 'network_deleted'
    END,
    'data_modification', 'low',
    jsonb_build_object(
      'network_name', COALESCE(NEW.network_name, OLD.network_name),
      'network_type', COALESCE(NEW.network_type, OLD.network_type)
    ),
    CASE TG_OP
      WHEN 'INSERT' THEN jsonb_build_object('new', row_to_json(NEW))
      WHEN 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
      WHEN 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD))
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_provider_networks
  AFTER INSERT OR UPDATE OR DELETE ON provider_networks
  FOR EACH ROW EXECUTE FUNCTION fn_audit_provider_networks();

-- ============================================================================
-- 13. Seed sample networks and provider memberships
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_network_ppo uuid;
  v_network_hmo uuid;
  v_network_preferred uuid;
  v_loc record;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- Create sample networks
  INSERT INTO provider_networks (organization_id, network_code, network_name, network_type, description, coverage_states)
  VALUES
    (v_org_id, 'PIFH-PPO-FL', 'PIF Health PPO Network - Florida', 'ppo',
     'Broad PPO network covering major Florida metros', ARRAY['FL']),
    (v_org_id, 'PIFH-HMO-FL', 'PIF Health HMO Network - Florida', 'hmo',
     'Managed care HMO network in Tampa Bay and Orlando', ARRAY['FL']),
    (v_org_id, 'PIFH-PREF-FL', 'PIF Preferred Provider Network', 'preferred',
     'Exclusive preferred providers with deepest discounts', ARRAY['FL'])
  ON CONFLICT (organization_id, network_code) DO NOTHING;

  SELECT id INTO v_network_ppo FROM provider_networks
    WHERE organization_id = v_org_id AND network_code = 'PIFH-PPO-FL';
  SELECT id INTO v_network_hmo FROM provider_networks
    WHERE organization_id = v_org_id AND network_code = 'PIFH-HMO-FL';
  SELECT id INTO v_network_preferred FROM provider_networks
    WHERE organization_id = v_org_id AND network_code = 'PIFH-PREF-FL';

  -- Add all healthcare_locations to PPO as in_network
  IF v_network_ppo IS NOT NULL THEN
    FOR v_loc IN SELECT id, location_type FROM healthcare_locations
      WHERE organization_id = v_org_id AND is_active = true
    LOOP
      INSERT INTO network_providers (network_id, healthcare_location_id, network_tier, specialty_tags)
      VALUES (v_network_ppo, v_loc.id, 'in_network',
        CASE v_loc.location_type
          WHEN 'clinic' THEN ARRAY['primary_care','specialist','urgent_care','lab','imaging']
          WHEN 'virtual' THEN ARRAY['telehealth','wellness']
          ELSE ARRAY['primary_care']
        END
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Add all provider_locations to PPO as in_network
  IF v_network_ppo IS NOT NULL THEN
    FOR v_loc IN SELECT id, provider_type FROM provider_locations
      WHERE organization_id = v_org_id AND is_active = true
    LOOP
      INSERT INTO network_providers (network_id, provider_location_id, network_tier, tier_discount_pct, specialty_tags)
      VALUES (v_network_ppo, v_loc.id, 'in_network', 10.00,
        ARRAY[v_loc.provider_type]
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Add Tampa/Orlando clinics to HMO as in_network_preferred
  IF v_network_hmo IS NOT NULL THEN
    FOR v_loc IN SELECT id FROM healthcare_locations
      WHERE organization_id = v_org_id AND city IN ('Tampa', 'Orlando') AND is_active = true
    LOOP
      INSERT INTO network_providers (network_id, healthcare_location_id, network_tier, tier_discount_pct, specialty_tags)
      VALUES (v_network_hmo, v_loc.id, 'in_network_preferred', 20.00,
        ARRAY['primary_care','specialist','urgent_care','lab','imaging']
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Recompute coverage for seeded data
  IF v_network_ppo IS NOT NULL THEN
    PERFORM recompute_network_coverage_zip(v_network_ppo, '33609');
    PERFORM recompute_network_coverage_zip(v_network_ppo, '32806');
    PERFORM recompute_network_coverage_zip(v_network_ppo, '33136');
    PERFORM recompute_network_coverage_zip(v_network_ppo, '32209');
  END IF;

  IF v_network_hmo IS NOT NULL THEN
    PERFORM recompute_network_coverage_zip(v_network_hmo, '33609');
    PERFORM recompute_network_coverage_zip(v_network_hmo, '32806');
  END IF;
END $$;
