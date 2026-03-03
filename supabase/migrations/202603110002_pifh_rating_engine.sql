-- ============================================================================
-- PHASE D + E: Rating Structure + Premium Calculation Engine
-- rating_areas, age_bands, plan_rates, calculate_premium()
-- ============================================================================

-- ============================================================================
-- D.1  Rating Areas — geographic rate zones (state + county)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rating_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  county text,
  rating_area_code text NOT NULL,
  fips_code text,
  metro_area text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rating_area_code)
);

CREATE INDEX IF NOT EXISTS idx_rating_areas_state ON rating_areas(state);
CREATE INDEX IF NOT EXISTS idx_rating_areas_code ON rating_areas(rating_area_code);

COMMENT ON TABLE rating_areas IS 'Geographic rating zones for premium calculation';

-- Seed major state rating areas
INSERT INTO rating_areas (state, rating_area_code) VALUES
  ('FL', 'FL-001'), ('FL', 'FL-002'), ('FL', 'FL-003'),
  ('TX', 'TX-001'), ('TX', 'TX-002'), ('TX', 'TX-003'),
  ('CA', 'CA-001'), ('CA', 'CA-002'), ('CA', 'CA-003'),
  ('NY', 'NY-001'), ('NY', 'NY-002'),
  ('GA', 'GA-001'), ('GA', 'GA-002'),
  ('NC', 'NC-001'), ('NC', 'NC-002'),
  ('IL', 'IL-001'), ('IL', 'IL-002'),
  ('PA', 'PA-001'), ('PA', 'PA-002'),
  ('OH', 'OH-001'), ('OH', 'OH-002'),
  ('AZ', 'AZ-001'), ('AZ', 'AZ-002'),
  ('VA', 'VA-001'), ('VA', 'VA-002'),
  ('TN', 'TN-001'),
  ('SC', 'SC-001'),
  ('AL', 'AL-001'),
  ('CO', 'CO-001'),
  ('MI', 'MI-001'),
  ('NJ', 'NJ-001'),
  ('WA', 'WA-001'),
  ('DEFAULT', 'DEFAULT-001')
ON CONFLICT (rating_area_code) DO NOTHING;

-- ============================================================================
-- D.2  Age Bands — ACA 3:1 standard age band structure
-- ============================================================================
CREATE TABLE IF NOT EXISTS age_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_age integer NOT NULL,
  max_age integer NOT NULL,
  band_label text NOT NULL,
  age_factor numeric(6,4) DEFAULT 1.0000,
  is_child boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(min_age, max_age)
);

CREATE INDEX IF NOT EXISTS idx_age_bands_range ON age_bands(min_age, max_age);

COMMENT ON TABLE age_bands IS 'Age band structure for ACA 3:1 ratio rating';

-- Standard ACA age bands (0-14 child, then 5-year adult bands)
INSERT INTO age_bands (min_age, max_age, band_label, age_factor, is_child) VALUES
  (0,  14,  '0-14',   0.6350, true),
  (15, 17,  '15-17',  0.6350, true),
  (18, 20,  '18-20',  0.6350, false),
  (21, 24,  '21-24',  1.0000, false),
  (25, 29,  '25-29',  1.0040, false),
  (30, 34,  '30-34',  1.1350, false),
  (35, 39,  '35-39',  1.2520, false),
  (40, 44,  '40-44',  1.4530, false),
  (45, 49,  '45-49',  1.7060, false),
  (50, 54,  '50-54',  2.0000, false),
  (55, 59,  '55-59',  2.2300, false),
  (60, 64,  '60-64',  2.7140, false),
  (65, 99,  '65+',    3.0000, false)
ON CONFLICT (min_age, max_age) DO NOTHING;

-- ============================================================================
-- D.3  Plan Rates — the 1M+ row rate table
-- ============================================================================
CREATE TABLE IF NOT EXISTS plan_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rating_area_id uuid NOT NULL REFERENCES rating_areas(id),
  age_band_id uuid NOT NULL REFERENCES age_bands(id),
  tobacco boolean DEFAULT false,
  monthly_rate numeric(10,2) NOT NULL,
  effective_year integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Critical composite index for rate lookup performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_rates_lookup
  ON plan_rates(plan_id, rating_area_id, age_band_id, tobacco, effective_year);

CREATE INDEX IF NOT EXISTS idx_plan_rates_plan_year ON plan_rates(plan_id, effective_year);
CREATE INDEX IF NOT EXISTS idx_plan_rates_year ON plan_rates(effective_year);

COMMENT ON TABLE plan_rates IS 'Plan rate table — optimized for 1M+ rows with composite index';

-- ============================================================================
-- D.4  Tobacco Multiplier Config
-- ============================================================================
CREATE TABLE IF NOT EXISTS tobacco_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  effective_year integer NOT NULL,
  multiplier numeric(6,4) NOT NULL DEFAULT 1.5000,
  max_multiplier numeric(6,4) NOT NULL DEFAULT 1.5000,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(state, effective_year)
);

CREATE INDEX IF NOT EXISTS idx_tobacco_multipliers_lookup ON tobacco_multipliers(state, effective_year);

COMMENT ON TABLE tobacco_multipliers IS 'State-level tobacco surcharge multipliers (ACA max 1.5x)';

-- Default tobacco multiplier for all states
INSERT INTO tobacco_multipliers (state, effective_year, multiplier, max_multiplier)
VALUES ('DEFAULT', 2025, 1.5000, 1.5000),
       ('DEFAULT', 2026, 1.5000, 1.5000),
       ('DEFAULT', 2027, 1.5000, 1.5000)
ON CONFLICT (state, effective_year) DO NOTHING;

-- ============================================================================
-- D.5  Seed sample plan_rates for PIF health share plans
-- ============================================================================
DO $$
DECLARE
  v_plan record;
  v_area record;
  v_band record;
  v_base_rate numeric;
  v_area_factor numeric;
BEGIN
  FOR v_plan IN
    SELECT p.id, p.code, p.category FROM plans p
    WHERE p.code IN ('PIF-ESS-2025','PIF-DIR-2025','PIF-CP-2025','PIF-SHSA-2025','PIF-PREM-2025','PIF-PHSA-2025',
                     'PIF-BRZ-5000','PIF-SLV-4000','PIF-GLD-2000','PIF-PLT-0')
  LOOP
    -- Set base rate per plan
    v_base_rate := CASE v_plan.code
      WHEN 'PIF-ESS-2025'  THEN 189.00
      WHEN 'PIF-DIR-2025'  THEN 229.00
      WHEN 'PIF-CP-2025'   THEN 309.00
      WHEN 'PIF-SHSA-2025' THEN 245.00
      WHEN 'PIF-PREM-2025' THEN 449.00
      WHEN 'PIF-PHSA-2025' THEN 389.00
      WHEN 'PIF-BRZ-5000'  THEN 295.00
      WHEN 'PIF-SLV-4000'  THEN 385.00
      WHEN 'PIF-GLD-2000'  THEN 475.00
      WHEN 'PIF-PLT-0'     THEN 595.00
      ELSE 300.00
    END;

    FOR v_area IN SELECT id, rating_area_code FROM rating_areas WHERE is_active = true
    LOOP
      -- Area factor (DEFAULT = 1.0, major metro areas slightly higher)
      v_area_factor := CASE
        WHEN v_area.rating_area_code LIKE 'NY%' THEN 1.15
        WHEN v_area.rating_area_code LIKE 'CA%' THEN 1.12
        WHEN v_area.rating_area_code LIKE 'FL%' THEN 1.05
        WHEN v_area.rating_area_code LIKE 'TX%' THEN 1.03
        ELSE 1.00
      END;

      FOR v_band IN SELECT id, age_factor FROM age_bands
      LOOP
        -- Non-tobacco rate
        INSERT INTO plan_rates (plan_id, rating_area_id, age_band_id, tobacco, monthly_rate, effective_year)
        VALUES (v_plan.id, v_area.id, v_band.id, false,
                ROUND(v_base_rate * v_band.age_factor * v_area_factor, 2), 2025)
        ON CONFLICT (plan_id, rating_area_id, age_band_id, tobacco, effective_year) DO NOTHING;

        -- Tobacco rate (1.5x ACA max)
        INSERT INTO plan_rates (plan_id, rating_area_id, age_band_id, tobacco, monthly_rate, effective_year)
        VALUES (v_plan.id, v_area.id, v_band.id, true,
                ROUND(v_base_rate * v_band.age_factor * v_area_factor * 1.5, 2), 2025)
        ON CONFLICT (plan_id, rating_area_id, age_band_id, tobacco, effective_year) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- E.1  Premium Calculation Function
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_premium(
  p_plan_code text,
  p_age integer,
  p_rating_area_code text,
  p_tobacco boolean DEFAULT false,
  p_year integer DEFAULT 2025
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
BEGIN
  -- 1. Resolve plan_id via indexed plan_code lookup
  SELECT id, rating_area_state
  INTO v_plan_id, v_plan_state
  FROM plans
  WHERE (plan_code = p_plan_code OR code = p_plan_code)
    AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', p_plan_code;
  END IF;

  -- 2. Resolve age band via indexed range lookup
  SELECT id INTO v_age_band_id
  FROM age_bands
  WHERE p_age >= min_age AND p_age <= max_age
  LIMIT 1;

  IF v_age_band_id IS NULL THEN
    RAISE EXCEPTION 'No age band for age: %', p_age;
  END IF;

  -- 3. Resolve rating area via indexed code lookup
  SELECT id INTO v_rating_area_id
  FROM rating_areas
  WHERE rating_area_code = p_rating_area_code
    AND is_active = true;

  -- Fallback to DEFAULT area if specific area not found
  IF v_rating_area_id IS NULL THEN
    SELECT id INTO v_rating_area_id
    FROM rating_areas
    WHERE rating_area_code = 'DEFAULT-001';
  END IF;

  IF v_rating_area_id IS NULL THEN
    RAISE EXCEPTION 'Rating area not found: %', p_rating_area_code;
  END IF;

  -- 4. Look up rate via composite index (single index scan)
  SELECT monthly_rate INTO v_monthly_rate
  FROM plan_rates
  WHERE plan_id = v_plan_id
    AND rating_area_id = v_rating_area_id
    AND age_band_id = v_age_band_id
    AND tobacco = false  -- Always get non-tobacco base rate
    AND effective_year = p_year;

  IF v_monthly_rate IS NULL THEN
    RAISE EXCEPTION 'No rate found for plan=%, area=%, age=%, year=%',
      p_plan_code, p_rating_area_code, p_age, p_year;
  END IF;

  -- 5. Apply tobacco multiplier from configurable table
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

  -- 6. Return final monthly premium
  RETURN v_monthly_rate;
END;
$$;

COMMENT ON FUNCTION calculate_premium IS 'Enterprise premium calculation: plan_code, age, area, tobacco, year → monthly rate';

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION calculate_premium TO authenticated;

-- ============================================================================
-- E.2  Batch Premium Comparison Function
-- ============================================================================
CREATE OR REPLACE FUNCTION compare_premiums(
  p_plan_codes text[],
  p_age integer,
  p_rating_area_code text,
  p_tobacco boolean DEFAULT false,
  p_year integer DEFAULT 2025
)
RETURNS TABLE (
  plan_code text,
  plan_name text,
  brand_name text,
  category text,
  metal_tier text,
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
    calculate_premium(COALESCE(p.plan_code, p.code), p_age, p_rating_area_code, p_tobacco, p_year) AS monthly_premium,
    calculate_premium(COALESCE(p.plan_code, p.code), p_age, p_rating_area_code, p_tobacco, p_year) * 12 AS annual_premium
  FROM plans p
  WHERE (p.plan_code = ANY(p_plan_codes) OR p.code = ANY(p_plan_codes))
    AND p.is_active = true
  ORDER BY monthly_premium ASC;
END;
$$;

COMMENT ON FUNCTION compare_premiums IS 'Compare premiums across multiple plans for a given age/area/tobacco/year';

GRANT EXECUTE ON FUNCTION compare_premiums TO authenticated;
