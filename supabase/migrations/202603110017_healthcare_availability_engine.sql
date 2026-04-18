-- ============================================================================
-- LOCAL HEALTHCARE AVAILABILITY ENGINE
-- ZIP-based service discovery for CRM + public website
-- ============================================================================

-- ============================================================================
-- 1. Healthcare Services — master catalog of available services
-- ============================================================================
CREATE TABLE IF NOT EXISTS healthcare_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_code text NOT NULL,
  service_name text NOT NULL,
  service_category text NOT NULL,
  -- Categories: primary_care, specialist, telehealth, urgent_care,
  -- dental, vision, mental_health, physical_therapy, lab, imaging,
  -- pharmacy, wellness, maternity, pediatric, chiropractic, home_health
  description text,
  provider_network text,         -- PPO, HMO, open, partner, direct
  eligibility_rules jsonb DEFAULT '{}'::jsonb,
  -- e.g. {"min_age": 0, "max_age": 64, "plan_categories": ["healthshare","traditional"]}
  icon text,
  color text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_public boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, service_code)
);

CREATE INDEX IF NOT EXISTS idx_healthcare_services_org ON healthcare_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_services_category ON healthcare_services(service_category);
CREATE INDEX IF NOT EXISTS idx_healthcare_services_active ON healthcare_services(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_healthcare_services_public ON healthcare_services(is_public, is_active) WHERE is_public = true AND is_active = true;

COMMENT ON TABLE healthcare_services IS 'Master catalog of healthcare services offered by the organization';

-- ============================================================================
-- 2. Healthcare Locations — physical provider/facility locations
-- ============================================================================
CREATE TABLE IF NOT EXISTS healthcare_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_type text NOT NULL DEFAULT 'facility',
  -- Types: facility, clinic, hospital, pharmacy, lab, office, mobile, virtual
  address_line1 text,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  county text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone text,
  fax text,
  email text,
  website text,
  hours_of_operation jsonb,
  -- e.g. {"mon": "8:00-17:00", "tue": "8:00-17:00", ...}
  accepting_new_patients boolean DEFAULT true,
  languages_spoken text[],
  handicap_accessible boolean DEFAULT true,
  parking_available boolean DEFAULT true,
  telehealth_capable boolean DEFAULT false,
  npi_number text,              -- National Provider Identifier
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_healthcare_locations_org ON healthcare_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_locations_state ON healthcare_locations(state);
CREATE INDEX IF NOT EXISTS idx_healthcare_locations_zip ON healthcare_locations(zip);
CREATE INDEX IF NOT EXISTS idx_healthcare_locations_city_state ON healthcare_locations(city, state);
CREATE INDEX IF NOT EXISTS idx_healthcare_locations_active ON healthcare_locations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_healthcare_locations_coords ON healthcare_locations(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON TABLE healthcare_locations IS 'Physical provider and facility locations with geocoordinates';

-- ============================================================================
-- 3. Healthcare Service Areas — ZIP-based coverage mapping
-- ============================================================================
CREATE TABLE IF NOT EXISTS healthcare_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES healthcare_services(id) ON DELETE CASCADE,
  location_id uuid REFERENCES healthcare_locations(id) ON DELETE SET NULL,
  zip_code text NOT NULL,
  state text,
  county text,
  radius_miles numeric(6,1) DEFAULT 0,
  -- 0 = exact ZIP match only; >0 = serves within radius
  coverage_level text DEFAULT 'full',
  -- full, partial, referral_only, telehealth_only
  max_capacity integer,
  current_utilization integer DEFAULT 0,
  waitlist_days integer DEFAULT 0,
  is_active boolean DEFAULT true,
  effective_date date DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hsa_unique_service_zip_loc
  ON healthcare_service_areas (service_id, zip_code, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_hsa_service ON healthcare_service_areas(service_id);
CREATE INDEX IF NOT EXISTS idx_hsa_zip ON healthcare_service_areas(zip_code);
CREATE INDEX IF NOT EXISTS idx_hsa_zip_active ON healthcare_service_areas(zip_code, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hsa_location ON healthcare_service_areas(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hsa_state ON healthcare_service_areas(state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hsa_coverage ON healthcare_service_areas(zip_code, coverage_level, is_active);

COMMENT ON TABLE healthcare_service_areas IS 'ZIP-code-based service availability mapping';

-- ============================================================================
-- 4. Service ↔ Location link table (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS healthcare_location_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES healthcare_locations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES healthcare_services(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  availability_notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(location_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_hls_location ON healthcare_location_services(location_id);
CREATE INDEX IF NOT EXISTS idx_hls_service ON healthcare_location_services(service_id);

COMMENT ON TABLE healthcare_location_services IS 'Which services are offered at which locations';

-- ============================================================================
-- 5. get_available_services(zip_code) — core lookup function
-- ============================================================================
CREATE OR REPLACE FUNCTION get_available_services(
  p_zip_code text,
  p_category text DEFAULT NULL,
  p_plan_category text DEFAULT NULL
)
RETURNS TABLE (
  service_id uuid,
  service_code text,
  service_name text,
  service_category text,
  description text,
  provider_network text,
  icon text,
  color text,
  coverage_level text,
  location_count bigint,
  nearest_location jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH matched_areas AS (
    -- Direct ZIP match
    SELECT
      sa.service_id,
      sa.coverage_level,
      sa.location_id
    FROM healthcare_service_areas sa
    WHERE sa.zip_code = p_zip_code
      AND sa.is_active = true
      AND (sa.end_date IS NULL OR sa.end_date > CURRENT_DATE)
      AND sa.effective_date <= CURRENT_DATE
  ),
  service_locations AS (
    SELECT
      ma.service_id,
      ma.coverage_level,
      COUNT(DISTINCT hl.id) AS loc_count,
      -- Pick nearest location (first by city match, then alphabetical)
      (
        SELECT jsonb_build_object(
          'id', nearest.id,
          'name', nearest.name,
          'address', nearest.address_line1,
          'city', nearest.city,
          'state', nearest.state,
          'zip', nearest.zip,
          'phone', nearest.phone,
          'latitude', nearest.latitude,
          'longitude', nearest.longitude,
          'telehealth_capable', nearest.telehealth_capable,
          'accepting_new_patients', nearest.accepting_new_patients
        )
        FROM healthcare_locations nearest
        WHERE nearest.id = ma.location_id
          AND nearest.is_active = true
        LIMIT 1
      ) AS nearest_loc
    FROM matched_areas ma
    LEFT JOIN healthcare_locations hl
      ON hl.id = ma.location_id AND hl.is_active = true
    GROUP BY ma.service_id, ma.coverage_level, ma.location_id
  )
  SELECT
    hs.id AS service_id,
    hs.service_code,
    hs.service_name,
    hs.service_category,
    hs.description,
    hs.provider_network,
    hs.icon,
    hs.color,
    COALESCE(sl.coverage_level, 'full') AS coverage_level,
    COALESCE(sl.loc_count, 0) AS location_count,
    sl.nearest_loc AS nearest_location
  FROM healthcare_services hs
  INNER JOIN service_locations sl ON sl.service_id = hs.id
  WHERE hs.is_active = true
    AND hs.is_public = true
    AND (p_category IS NULL OR hs.service_category = p_category)
    AND (
      p_plan_category IS NULL
      OR hs.eligibility_rules = '{}'::jsonb
      OR hs.eligibility_rules->'plan_categories' IS NULL
      OR hs.eligibility_rules->'plan_categories' @> to_jsonb(p_plan_category)
    )
  ORDER BY hs.sort_order, hs.service_name;
END;
$$;

COMMENT ON FUNCTION get_available_services IS 'ZIP-based service lookup: returns available healthcare services with location info';

GRANT EXECUTE ON FUNCTION get_available_services TO authenticated;

-- ============================================================================
-- 6. get_nearby_locations — find locations near a ZIP
-- ============================================================================
CREATE OR REPLACE FUNCTION get_nearby_locations(
  p_zip_code text,
  p_service_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  location_id uuid,
  name text,
  location_type text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  latitude numeric,
  longitude numeric,
  telehealth_capable boolean,
  accepting_new_patients boolean,
  services jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    hl.id AS location_id,
    hl.name,
    hl.location_type,
    hl.address_line1 AS address,
    hl.city,
    hl.state,
    hl.zip,
    hl.phone,
    hl.latitude,
    hl.longitude,
    hl.telehealth_capable,
    hl.accepting_new_patients,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'service_id', hs2.id,
        'service_name', hs2.service_name,
        'service_category', hs2.service_category
      ))
      FROM healthcare_location_services hls2
      JOIN healthcare_services hs2 ON hs2.id = hls2.service_id AND hs2.is_active = true
      WHERE hls2.location_id = hl.id
    ) AS services
  FROM healthcare_locations hl
  INNER JOIN healthcare_service_areas sa ON sa.location_id = hl.id
  WHERE sa.zip_code = p_zip_code
    AND sa.is_active = true
    AND hl.is_active = true
    AND (sa.end_date IS NULL OR sa.end_date > CURRENT_DATE)
    AND (p_service_id IS NULL OR sa.service_id = p_service_id)
  ORDER BY hl.name
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_nearby_locations IS 'Find healthcare locations serving a given ZIP code, optionally filtered by service';

GRANT EXECUTE ON FUNCTION get_nearby_locations TO authenticated;

-- ============================================================================
-- 7. RLS Policies
-- ============================================================================
ALTER TABLE healthcare_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_location_services ENABLE ROW LEVEL SECURITY;

-- healthcare_services: org-scoped read, admin write
DROP POLICY IF EXISTS "hs_services_org_read" ON healthcare_services;
CREATE POLICY "hs_services_org_read" ON healthcare_services
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "hs_services_admin_write" ON healthcare_services;
CREATE POLICY "hs_services_admin_write" ON healthcare_services
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- healthcare_locations: org-scoped read, admin write
DROP POLICY IF EXISTS "hs_locations_org_read" ON healthcare_locations;
CREATE POLICY "hs_locations_org_read" ON healthcare_locations
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "hs_locations_admin_write" ON healthcare_locations;
CREATE POLICY "hs_locations_admin_write" ON healthcare_locations
  FOR ALL TO authenticated
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- healthcare_service_areas: read via service org, admin write
DROP POLICY IF EXISTS "hs_areas_read" ON healthcare_service_areas;
CREATE POLICY "hs_areas_read" ON healthcare_service_areas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM healthcare_services hs
      WHERE hs.id = healthcare_service_areas.service_id
        AND hs.organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "hs_areas_admin_write" ON healthcare_service_areas;
CREATE POLICY "hs_areas_admin_write" ON healthcare_service_areas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM healthcare_services hs
      WHERE hs.id = healthcare_service_areas.service_id
        AND hs.organization_id = get_user_organization_id()
        AND get_user_role() IN ('owner', 'admin')
    )
  );

-- healthcare_location_services: read via location org, admin write
DROP POLICY IF EXISTS "hls_read" ON healthcare_location_services;
CREATE POLICY "hls_read" ON healthcare_location_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM healthcare_locations hl
      WHERE hl.id = healthcare_location_services.location_id
        AND hl.organization_id = get_user_organization_id()
    )
  );

DROP POLICY IF EXISTS "hls_admin_write" ON healthcare_location_services;
CREATE POLICY "hls_admin_write" ON healthcare_location_services
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM healthcare_locations hl
      WHERE hl.id = healthcare_location_services.location_id
        AND hl.organization_id = get_user_organization_id()
        AND get_user_role() IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 8. Seed sample healthcare services
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  INSERT INTO healthcare_services (organization_id, service_code, service_name, service_category, description, provider_network, sort_order) VALUES
    (v_org_id, 'SVC-PCP',     'Primary Care',            'primary_care',      'Annual wellness visits, preventive care, and general health management',       'PPO',  1),
    (v_org_id, 'SVC-TELE',    'Telehealth',              'telehealth',        '24/7 virtual doctor visits for non-emergency medical consultations',           'open', 2),
    (v_org_id, 'SVC-URGENT',  'Urgent Care',             'urgent_care',       'Walk-in care for non-life-threatening illnesses and injuries',                 'PPO',  3),
    (v_org_id, 'SVC-SPEC',    'Specialist Referrals',    'specialist',        'Access to board-certified specialists across multiple disciplines',            'PPO',  4),
    (v_org_id, 'SVC-MENTAL',  'Mental Health',           'mental_health',     'Counseling, therapy, and psychiatric services for behavioral health',          'PPO',  5),
    (v_org_id, 'SVC-DENTAL',  'Dental Care',             'dental',            'Preventive, restorative, and emergency dental services',                      'partner', 6),
    (v_org_id, 'SVC-VISION',  'Vision Care',             'vision',            'Eye exams, prescription lenses, and vision correction services',               'partner', 7),
    (v_org_id, 'SVC-RX',      'Prescription Discounts',  'pharmacy',          'Discounted prescriptions at participating pharmacies nationwide',              'open', 8),
    (v_org_id, 'SVC-LAB',     'Lab & Diagnostics',       'lab',               'Blood work, diagnostic testing, and health screenings',                        'PPO',  9),
    (v_org_id, 'SVC-IMAGING', 'Imaging Services',        'imaging',           'X-ray, MRI, CT scan, and ultrasound at discounted rates',                     'PPO', 10),
    (v_org_id, 'SVC-PT',      'Physical Therapy',        'physical_therapy',  'Rehabilitation and physical therapy for injuries and chronic conditions',      'PPO', 11),
    (v_org_id, 'SVC-CHIRO',   'Chiropractic Care',       'chiropractic',      'Spinal adjustments and musculoskeletal treatments',                            'partner', 12),
    (v_org_id, 'SVC-WELL',    'Wellness Programs',       'wellness',          'Health coaching, nutrition counseling, and fitness programs',                   'open', 13),
    (v_org_id, 'SVC-MAT',     'Maternity Care',          'maternity',         'Prenatal, delivery, and postnatal care for expectant mothers',                 'PPO', 14),
    (v_org_id, 'SVC-PED',     'Pediatric Care',          'pediatric',         'Comprehensive healthcare services for children and adolescents',               'PPO', 15),
    (v_org_id, 'SVC-HOME',    'Home Health',             'home_health',       'In-home nursing, therapy, and health aide services',                           'direct', 16)
  ON CONFLICT (organization_id, service_code) DO NOTHING;
END $$;

-- ============================================================================
-- 9. Seed sample locations and service areas for major FL ZIPs
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid;
  v_loc_id uuid;
  v_svc record;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN RETURN; END IF;

  -- Seed a few sample locations
  INSERT INTO healthcare_locations (organization_id, name, location_type, address_line1, city, state, zip, latitude, longitude, phone, telehealth_capable, accepting_new_patients)
  VALUES
    (v_org_id, 'DHH Health Center - Tampa',       'clinic',    '4200 W Kennedy Blvd',  'Tampa',         'FL', '33609', 27.9475, -82.5084, '(813) 555-0100', true, true),
    (v_org_id, 'DHH Health Center - Orlando',      'clinic',    '1200 S Orange Ave',    'Orlando',       'FL', '32806', 28.5255, -81.3790, '(407) 555-0200', true, true),
    (v_org_id, 'DHH Health Center - Miami',        'clinic',    '1611 NW 12th Ave',     'Miami',         'FL', '33136', 25.7907, -80.2103, '(305) 555-0300', true, true),
    (v_org_id, 'DHH Health Center - Jacksonville', 'clinic',    '655 W 8th St',         'Jacksonville',  'FL', '32209', 30.3521, -81.6723, '(904) 555-0400', true, true),
    (v_org_id, 'DHH Telehealth Hub',               'virtual',   NULL,                    'Nationwide',    'FL', '00000', NULL,    NULL,     '(800) 555-0500', true, true)
  ON CONFLICT DO NOTHING;

  -- Link all services to telehealth hub
  FOR v_svc IN SELECT id FROM healthcare_services WHERE organization_id = v_org_id AND service_category IN ('telehealth', 'pharmacy', 'wellness')
  LOOP
    SELECT id INTO v_loc_id FROM healthcare_locations WHERE organization_id = v_org_id AND name = 'DHH Telehealth Hub' LIMIT 1;
    IF v_loc_id IS NOT NULL THEN
      INSERT INTO healthcare_location_services (location_id, service_id, is_primary)
      VALUES (v_loc_id, v_svc.id, true)
      ON CONFLICT (location_id, service_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Link PCP, urgent care, specialist, mental health, lab, imaging to physical clinics
  FOR v_svc IN SELECT id FROM healthcare_services WHERE organization_id = v_org_id AND service_category IN ('primary_care', 'urgent_care', 'specialist', 'mental_health', 'lab', 'imaging', 'physical_therapy', 'maternity', 'pediatric')
  LOOP
    FOR v_loc_id IN SELECT id FROM healthcare_locations WHERE organization_id = v_org_id AND location_type = 'clinic'
    LOOP
      INSERT INTO healthcare_location_services (location_id, service_id)
      VALUES (v_loc_id, v_svc.id)
      ON CONFLICT (location_id, service_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- Seed service areas for major Florida ZIPs
  FOR v_svc IN SELECT id FROM healthcare_services WHERE organization_id = v_org_id AND is_active = true
  LOOP
    -- Tampa area
    SELECT id INTO v_loc_id FROM healthcare_locations WHERE organization_id = v_org_id AND city = 'Tampa' LIMIT 1;
    INSERT INTO healthcare_service_areas (service_id, location_id, zip_code, state, radius_miles) VALUES
      (v_svc.id, v_loc_id, '33609', 'FL', 25), (v_svc.id, v_loc_id, '33602', 'FL', 25),
      (v_svc.id, v_loc_id, '33606', 'FL', 25), (v_svc.id, v_loc_id, '33611', 'FL', 25),
      (v_svc.id, v_loc_id, '33629', 'FL', 25), (v_svc.id, v_loc_id, '33607', 'FL', 25)
    ON CONFLICT DO NOTHING;

    -- Orlando area
    SELECT id INTO v_loc_id FROM healthcare_locations WHERE organization_id = v_org_id AND city = 'Orlando' LIMIT 1;
    INSERT INTO healthcare_service_areas (service_id, location_id, zip_code, state, radius_miles) VALUES
      (v_svc.id, v_loc_id, '32806', 'FL', 25), (v_svc.id, v_loc_id, '32801', 'FL', 25),
      (v_svc.id, v_loc_id, '32803', 'FL', 25), (v_svc.id, v_loc_id, '32819', 'FL', 25)
    ON CONFLICT DO NOTHING;

    -- Miami area
    SELECT id INTO v_loc_id FROM healthcare_locations WHERE organization_id = v_org_id AND city = 'Miami' LIMIT 1;
    INSERT INTO healthcare_service_areas (service_id, location_id, zip_code, state, radius_miles) VALUES
      (v_svc.id, v_loc_id, '33136', 'FL', 25), (v_svc.id, v_loc_id, '33101', 'FL', 25),
      (v_svc.id, v_loc_id, '33130', 'FL', 25), (v_svc.id, v_loc_id, '33125', 'FL', 25)
    ON CONFLICT DO NOTHING;

    -- Jacksonville area
    SELECT id INTO v_loc_id FROM healthcare_locations WHERE organization_id = v_org_id AND city = 'Jacksonville' LIMIT 1;
    INSERT INTO healthcare_service_areas (service_id, location_id, zip_code, state, radius_miles) VALUES
      (v_svc.id, v_loc_id, '32209', 'FL', 25), (v_svc.id, v_loc_id, '32202', 'FL', 25),
      (v_svc.id, v_loc_id, '32204', 'FL', 25), (v_svc.id, v_loc_id, '32207', 'FL', 25)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- 10. updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_healthcare_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_healthcare_services_updated ON healthcare_services;
CREATE TRIGGER trg_healthcare_services_updated
  BEFORE UPDATE ON healthcare_services
  FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();

DROP TRIGGER IF EXISTS trg_healthcare_locations_updated ON healthcare_locations;
CREATE TRIGGER trg_healthcare_locations_updated
  BEFORE UPDATE ON healthcare_locations
  FOR EACH ROW EXECUTE FUNCTION update_healthcare_updated_at();
