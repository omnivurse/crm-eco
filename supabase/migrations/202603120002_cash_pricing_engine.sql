-- ============================================================================
-- CASH PRICING / URGENT CARE SEARCH ENGINE
-- ZIP-based procedure price comparison across providers
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. medical_procedures — master catalog of searchable procedures
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS medical_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  procedure_code text NOT NULL,
  procedure_name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'urgent_care', 'imaging', 'lab', 'preventive', 'specialist',
    'dental', 'vision', 'therapy', 'pharmacy', 'other'
  )),
  description text,
  cpt_codes text[] DEFAULT '{}',
  avg_national_price numeric(10,2),
  search_keywords text[] DEFAULT '{}',
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, procedure_code)
);

CREATE INDEX IF NOT EXISTS idx_med_procedures_org ON medical_procedures(organization_id);
CREATE INDEX IF NOT EXISTS idx_med_procedures_category ON medical_procedures(category);
CREATE INDEX IF NOT EXISTS idx_med_procedures_active ON medical_procedures(is_active) WHERE is_active = true;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. provider_locations — facilities that offer cash pricing
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS provider_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'urgent_care' CHECK (provider_type IN (
    'urgent_care', 'imaging_center', 'lab', 'hospital', 'clinic', 'pharmacy', 'other'
  )),
  address_line1 text,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone text,
  website text,
  hours_of_operation jsonb DEFAULT '{}'::jsonb,
  accepting_patients boolean DEFAULT true,
  rating numeric(2,1),
  review_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_locs_org ON provider_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_provider_locs_zip ON provider_locations(zip);
CREATE INDEX IF NOT EXISTS idx_provider_locs_type ON provider_locations(provider_type);
CREATE INDEX IF NOT EXISTS idx_provider_locs_coords ON provider_locations(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provider_locs_active ON provider_locations(is_active) WHERE is_active = true;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. procedure_prices — cash prices per procedure per provider location
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS procedure_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES medical_procedures(id) ON DELETE CASCADE,
  provider_location_id uuid NOT NULL REFERENCES provider_locations(id) ON DELETE CASCADE,
  cash_price numeric(10,2) NOT NULL,
  discounted_price numeric(10,2),
  price_range_low numeric(10,2),
  price_range_high numeric(10,2),
  last_verified_at timestamptz DEFAULT now(),
  source text DEFAULT 'manual',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(procedure_id, provider_location_id)
);

CREATE INDEX IF NOT EXISTS idx_proc_prices_procedure ON procedure_prices(procedure_id);
CREATE INDEX IF NOT EXISTS idx_proc_prices_provider ON procedure_prices(provider_location_id);
CREATE INDEX IF NOT EXISTS idx_proc_prices_active ON procedure_prices(is_active) WHERE is_active = true;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. search_procedure_prices() — core pricing search function
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_procedure_prices(
  p_zip_code text,
  p_procedure_name text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_radius_miles numeric DEFAULT 50,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  procedure_id uuid,
  procedure_code text,
  procedure_name text,
  category text,
  avg_national_price numeric,
  provider_location_id uuid,
  provider_name text,
  provider_type text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  latitude numeric,
  longitude numeric,
  cash_price numeric,
  discounted_price numeric,
  price_range_low numeric,
  price_range_high numeric,
  distance_miles numeric,
  rating numeric,
  review_count integer,
  last_verified_at timestamptz
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
  -- Resolve ZIP to approximate lat/lng from provider_locations
  SELECT pl.latitude, pl.longitude INTO v_lat, v_lng
  FROM provider_locations pl
  WHERE pl.zip = p_zip_code AND pl.latitude IS NOT NULL
  LIMIT 1;

  -- Fall back to healthcare_locations
  IF v_lat IS NULL THEN
    SELECT hl.latitude, hl.longitude INTO v_lat, v_lng
    FROM healthcare_locations hl
    WHERE hl.zip = p_zip_code AND hl.latitude IS NOT NULL
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    mp.id                   AS procedure_id,
    mp.procedure_code,
    mp.procedure_name,
    mp.category,
    mp.avg_national_price,
    pl.id                   AS provider_location_id,
    pl.name                 AS provider_name,
    pl.provider_type,
    pl.address_line1        AS address,
    pl.city,
    pl.state,
    pl.zip,
    pl.phone,
    pl.latitude,
    pl.longitude,
    pp.cash_price,
    pp.discounted_price,
    pp.price_range_low,
    pp.price_range_high,
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
    pl.rating,
    pl.review_count,
    pp.last_verified_at
  FROM procedure_prices pp
  INNER JOIN medical_procedures mp ON mp.id = pp.procedure_id
  INNER JOIN provider_locations pl ON pl.id = pp.provider_location_id
  WHERE pp.is_active = true
    AND mp.is_active = true
    AND pl.is_active = true
    AND (
      p_procedure_name IS NULL
      OR mp.procedure_name ILIKE '%' || p_procedure_name || '%'
      OR mp.procedure_code ILIKE '%' || p_procedure_name || '%'
      OR p_procedure_name = ANY(mp.search_keywords)
    )
    AND (p_category IS NULL OR mp.category = p_category)
    AND (
      v_lat IS NULL OR pl.latitude IS NULL
      OR (
        3959.0 * acos(
          LEAST(1.0,
            cos(radians(v_lat)) * cos(radians(pl.latitude)) *
            cos(radians(pl.longitude) - radians(v_lng)) +
            sin(radians(v_lat)) * sin(radians(pl.latitude))
          )
        ) <= p_radius_miles
      )
    )
  ORDER BY
    CASE WHEN v_lat IS NOT NULL AND pl.latitude IS NOT NULL THEN
      3959.0 * acos(
        LEAST(1.0,
          cos(radians(v_lat)) * cos(radians(pl.latitude)) *
          cos(radians(pl.longitude) - radians(v_lng)) +
          sin(radians(v_lat)) * sin(radians(pl.latitude))
        )
      )
    ELSE 99999 END,
    pp.cash_price ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_procedure_prices TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE medical_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_prices ENABLE ROW LEVEL SECURITY;

-- medical_procedures: org-scoped read, admin write
CREATE POLICY "mp_org_read" ON medical_procedures
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "mp_admin_write" ON medical_procedures
  FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- provider_locations: org-scoped read, admin write
CREATE POLICY "pl_org_read" ON provider_locations
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "pl_admin_write" ON provider_locations
  FOR ALL TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- procedure_prices: read via procedure org scope, admin write
CREATE POLICY "pp_org_read" ON procedure_prices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_procedures mp
      WHERE mp.id = procedure_prices.procedure_id
        AND mp.organization_id = get_user_organization_id()
    )
  );

CREATE POLICY "pp_admin_write" ON procedure_prices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM medical_procedures mp
      WHERE mp.id = procedure_prices.procedure_id
        AND mp.organization_id = get_user_organization_id()
        AND get_user_role() IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM medical_procedures mp
      WHERE mp.id = procedure_prices.procedure_id
        AND mp.organization_id = get_user_organization_id()
        AND get_user_role() IN ('owner', 'admin')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Seed sample procedures and provider pricing
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_org_id uuid;
  v_proc_uc uuid; v_proc_mammo uuid; v_proc_lab uuid;
  v_proc_xray uuid; v_proc_ultra uuid;
  v_loc_uc_tampa uuid; v_loc_uc_orlando uuid; v_loc_uc_miami uuid;
  v_loc_uc_jax uuid; v_loc_uc_stpete uuid;
  v_loc_img_tampa uuid; v_loc_img_orlando uuid; v_loc_img_miami uuid;
  v_loc_lab_tampa uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- ── Insert medical procedures ──────────────────────────────────────────────
  INSERT INTO medical_procedures (organization_id, procedure_code, procedure_name, category, description, cpt_codes, avg_national_price, search_keywords, sort_order) VALUES
    (v_org_id, 'urgent_care_visit', 'Urgent Care Visit',     'urgent_care', 'Walk-in visit for non-emergency illness or injury',  ARRAY['99213','99214'], 200.00, ARRAY['urgent','walk-in','sick visit','injury'], 1),
    (v_org_id, 'mammogram',         'Mammogram (Screening)', 'imaging',     'Screening mammogram for breast cancer detection',    ARRAY['77067'],         250.00, ARRAY['mammogram','breast','screening','cancer'], 2),
    (v_org_id, 'lab_tests',         'Basic Lab Panel',       'lab',         'CBC, metabolic panel, lipid panel blood tests',       ARRAY['80053','85025'], 100.00, ARRAY['blood test','lab','cbc','metabolic','lipid'], 3),
    (v_org_id, 'xray',             'X-Ray (Single View)',    'imaging',     'Standard diagnostic X-ray imaging',                  ARRAY['71046'],         125.00, ARRAY['xray','x-ray','radiograph'], 4),
    (v_org_id, 'ultrasound',       'Ultrasound',             'imaging',     'Diagnostic ultrasound imaging',                      ARRAY['76856'],         300.00, ARRAY['ultrasound','sonogram','sono'], 5)
  ON CONFLICT (organization_id, procedure_code) DO NOTHING;

  SELECT id INTO v_proc_uc    FROM medical_procedures WHERE organization_id = v_org_id AND procedure_code = 'urgent_care_visit';
  SELECT id INTO v_proc_mammo FROM medical_procedures WHERE organization_id = v_org_id AND procedure_code = 'mammogram';
  SELECT id INTO v_proc_lab   FROM medical_procedures WHERE organization_id = v_org_id AND procedure_code = 'lab_tests';
  SELECT id INTO v_proc_xray  FROM medical_procedures WHERE organization_id = v_org_id AND procedure_code = 'xray';
  SELECT id INTO v_proc_ultra FROM medical_procedures WHERE organization_id = v_org_id AND procedure_code = 'ultrasound';

  -- ── Insert provider locations ──────────────────────────────────────────────
  -- Urgent care centers
  INSERT INTO provider_locations (id, organization_id, name, provider_type, address_line1, city, state, zip, latitude, longitude, phone, rating, review_count) VALUES
    (gen_random_uuid(), v_org_id, 'QuickCare Urgent Care - Tampa',   'urgent_care',    '3401 W Kennedy Blvd',  'Tampa',         'FL', '33609', 27.9480, -82.5070, '(813) 555-1100', 4.2, 187),
    (gen_random_uuid(), v_org_id, 'QuickCare Urgent Care - Orlando', 'urgent_care',    '1450 S Orange Ave',    'Orlando',       'FL', '32806', 28.5260, -81.3800, '(407) 555-2100', 4.1, 210),
    (gen_random_uuid(), v_org_id, 'QuickCare Urgent Care - Miami',   'urgent_care',    '1500 NW 12th Ave',     'Miami',         'FL', '33136', 25.7910, -80.2110, '(305) 555-3100', 4.0, 320),
    (gen_random_uuid(), v_org_id, 'QuickCare Urgent Care - Jax',     'urgent_care',    '700 W 8th St',         'Jacksonville',  'FL', '32209', 30.3525, -81.6730, '(904) 555-4100', 4.3, 165),
    (gen_random_uuid(), v_org_id, 'BayCare Walk-In - St Pete',       'urgent_care',    '501 6th Ave S',        'St Petersburg', 'FL', '33701', 27.7683, -82.6401, '(727) 555-5100', 4.4, 140)
  ON CONFLICT DO NOTHING;

  -- Imaging centers
  INSERT INTO provider_locations (id, organization_id, name, provider_type, address_line1, city, state, zip, latitude, longitude, phone, rating, review_count) VALUES
    (gen_random_uuid(), v_org_id, 'ClearView Imaging - Tampa',   'imaging_center', '2901 W Swann Ave',    'Tampa',   'FL', '33609', 27.9370, -82.5020, '(813) 555-1200', 4.5, 92),
    (gen_random_uuid(), v_org_id, 'Sunshine Imaging - Orlando',  'imaging_center', '50 W Underwood St',   'Orlando', 'FL', '32806', 28.5240, -81.3760, '(407) 555-2200', 4.6, 78),
    (gen_random_uuid(), v_org_id, 'South Florida Imaging',       'imaging_center', '1601 NW 12th Ave',    'Miami',   'FL', '33136', 25.7920, -80.2090, '(305) 555-3200', 4.4, 115)
  ON CONFLICT DO NOTHING;

  -- Lab
  INSERT INTO provider_locations (id, organization_id, name, provider_type, address_line1, city, state, zip, latitude, longitude, phone, rating, review_count) VALUES
    (gen_random_uuid(), v_org_id, 'LabFirst Diagnostics - Tampa', 'lab', '4100 W Boy Scout Blvd', 'Tampa', 'FL', '33607', 27.9530, -82.5250, '(813) 555-1300', 4.3, 156)
  ON CONFLICT DO NOTHING;

  -- ── Re-select location IDs ─────────────────────────────────────────────────
  SELECT id INTO v_loc_uc_tampa   FROM provider_locations WHERE organization_id = v_org_id AND name = 'QuickCare Urgent Care - Tampa';
  SELECT id INTO v_loc_uc_orlando FROM provider_locations WHERE organization_id = v_org_id AND name = 'QuickCare Urgent Care - Orlando';
  SELECT id INTO v_loc_uc_miami   FROM provider_locations WHERE organization_id = v_org_id AND name = 'QuickCare Urgent Care - Miami';
  SELECT id INTO v_loc_uc_jax     FROM provider_locations WHERE organization_id = v_org_id AND name = 'QuickCare Urgent Care - Jax';
  SELECT id INTO v_loc_uc_stpete  FROM provider_locations WHERE organization_id = v_org_id AND name = 'BayCare Walk-In - St Pete';
  SELECT id INTO v_loc_img_tampa  FROM provider_locations WHERE organization_id = v_org_id AND name = 'ClearView Imaging - Tampa';
  SELECT id INTO v_loc_img_orlando FROM provider_locations WHERE organization_id = v_org_id AND name = 'Sunshine Imaging - Orlando';
  SELECT id INTO v_loc_img_miami  FROM provider_locations WHERE organization_id = v_org_id AND name = 'South Florida Imaging';
  SELECT id INTO v_loc_lab_tampa  FROM provider_locations WHERE organization_id = v_org_id AND name = 'LabFirst Diagnostics - Tampa';

  -- ── Insert procedure prices ────────────────────────────────────────────────
  -- Urgent care visits
  IF v_proc_uc IS NOT NULL THEN
    INSERT INTO procedure_prices (procedure_id, provider_location_id, cash_price, discounted_price, price_range_low, price_range_high) VALUES
      (v_proc_uc, v_loc_uc_tampa,   175.00, 149.00, 150.00, 225.00),
      (v_proc_uc, v_loc_uc_orlando, 185.00, 157.00, 160.00, 235.00),
      (v_proc_uc, v_loc_uc_miami,   210.00, 178.00, 180.00, 275.00),
      (v_proc_uc, v_loc_uc_jax,     165.00, 140.00, 140.00, 210.00),
      (v_proc_uc, v_loc_uc_stpete,  180.00, 153.00, 155.00, 230.00)
    ON CONFLICT (procedure_id, provider_location_id) DO NOTHING;
  END IF;

  -- Mammogram
  IF v_proc_mammo IS NOT NULL THEN
    INSERT INTO procedure_prices (procedure_id, provider_location_id, cash_price, discounted_price, price_range_low, price_range_high) VALUES
      (v_proc_mammo, v_loc_img_tampa,   225.00, 189.00, 175.00, 325.00),
      (v_proc_mammo, v_loc_img_orlando, 240.00, 199.00, 185.00, 340.00),
      (v_proc_mammo, v_loc_img_miami,   275.00, 229.00, 200.00, 375.00)
    ON CONFLICT (procedure_id, provider_location_id) DO NOTHING;
  END IF;

  -- X-Ray
  IF v_proc_xray IS NOT NULL THEN
    INSERT INTO procedure_prices (procedure_id, provider_location_id, cash_price, discounted_price, price_range_low, price_range_high) VALUES
      (v_proc_xray, v_loc_img_tampa,   100.00, 85.00,  75.00, 175.00),
      (v_proc_xray, v_loc_img_orlando, 110.00, 94.00,  80.00, 185.00),
      (v_proc_xray, v_loc_img_miami,   130.00, 110.00, 90.00, 200.00)
    ON CONFLICT (procedure_id, provider_location_id) DO NOTHING;
  END IF;

  -- Ultrasound
  IF v_proc_ultra IS NOT NULL THEN
    INSERT INTO procedure_prices (procedure_id, provider_location_id, cash_price, discounted_price, price_range_low, price_range_high) VALUES
      (v_proc_ultra, v_loc_img_tampa,   275.00, 229.00, 200.00, 400.00),
      (v_proc_ultra, v_loc_img_orlando, 290.00, 245.00, 215.00, 425.00),
      (v_proc_ultra, v_loc_img_miami,   325.00, 275.00, 240.00, 475.00)
    ON CONFLICT (procedure_id, provider_location_id) DO NOTHING;
  END IF;

  -- Lab tests
  IF v_proc_lab IS NOT NULL AND v_loc_lab_tampa IS NOT NULL THEN
    INSERT INTO procedure_prices (procedure_id, provider_location_id, cash_price, discounted_price, price_range_low, price_range_high) VALUES
      (v_proc_lab, v_loc_lab_tampa, 65.00, 49.00, 40.00, 150.00)
    ON CONFLICT (procedure_id, provider_location_id) DO NOTHING;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. updated_at triggers (reuse function from healthcare availability migration)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_medical_procedures_updated ON medical_procedures;
CREATE TRIGGER trg_medical_procedures_updated
  BEFORE UPDATE ON medical_procedures
  FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();

DROP TRIGGER IF EXISTS trg_provider_locations_updated ON provider_locations;
CREATE TRIGGER trg_provider_locations_updated
  BEFORE UPDATE ON provider_locations
  FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();

DROP TRIGGER IF EXISTS trg_procedure_prices_updated ON procedure_prices;
CREATE TRIGGER trg_procedure_prices_updated
  BEFORE UPDATE ON procedure_prices
  FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE — Cash Pricing Engine
-- ═══════════════════════════════════════════════════════════════════════════════
