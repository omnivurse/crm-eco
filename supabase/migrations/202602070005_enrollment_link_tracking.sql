-- ============================================================================
-- ENROLLMENT LINK TRACKING SYSTEM
-- Track enrollment links, visits, and conversions for advisor marketing
-- ============================================================================

-- ============================================================================
-- ENROLLMENT LINKS (Custom tracking links per advisor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES advisors(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  target_url text,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  is_active boolean DEFAULT true,
  requires_password boolean DEFAULT false,
  password_hash text,
  max_uses integer,
  expires_at timestamptz,
  total_visits integer DEFAULT 0,
  unique_visits integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_links_organization_id ON enrollment_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_links_advisor_id ON enrollment_links(advisor_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_links_slug ON enrollment_links(slug);
CREATE INDEX IF NOT EXISTS idx_enrollment_links_is_active ON enrollment_links(is_active) WHERE is_active = true;

-- ============================================================================
-- ENROLLMENT LINK VISITS (Track every visit to enrollment links)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_link_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES enrollment_links(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  visitor_id text,
  visited_at timestamptz DEFAULT now(),
  duration_seconds integer,
  ip_address text,
  user_agent text,
  device_type text,
  browser text,
  browser_version text,
  os text,
  os_version text,
  country text,
  country_code text,
  region text,
  city text,
  postal_code text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  timezone text,
  referrer_url text,
  referrer_domain text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  landing_page text,
  converted boolean DEFAULT false,
  conversion_id uuid,
  converted_at timestamptz,
  page_views integer DEFAULT 1,
  scroll_depth_percent integer,
  interactions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_organization_id ON enrollment_link_visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_link_id ON enrollment_link_visits(link_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_session_id ON enrollment_link_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_visitor_id ON enrollment_link_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_visited_at ON enrollment_link_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_converted ON enrollment_link_visits(converted) WHERE converted = true;
CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_country ON enrollment_link_visits(country);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_visits_device_type ON enrollment_link_visits(device_type);

-- ============================================================================
-- ENROLLMENT LINK CONVERSIONS (When a visit leads to an enrollment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_link_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES enrollment_links(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES enrollment_link_visits(id) ON DELETE SET NULL,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  converted_at timestamptz DEFAULT now(),
  time_to_convert_seconds integer,
  visits_before_conversion integer DEFAULT 1,
  first_touch_at timestamptz,
  last_touch_at timestamptz,
  attribution_model text DEFAULT 'last_touch',
  conversion_value numeric(10,2),
  lifetime_value numeric(12,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_link_conversions_organization_id ON enrollment_link_conversions(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_conversions_link_id ON enrollment_link_conversions(link_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_conversions_visit_id ON enrollment_link_conversions(visit_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_conversions_enrollment_id ON enrollment_link_conversions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_conversions_converted_at ON enrollment_link_conversions(converted_at DESC);

-- ============================================================================
-- ENROLLMENT LINK ANALYTICS (Aggregated stats by time period)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollment_link_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES enrollment_links(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES advisors(id) ON DELETE SET NULL,
  period_date date NOT NULL,
  period_type text NOT NULL,
  total_visits integer DEFAULT 0,
  unique_visitors integer DEFAULT 0,
  new_visitors integer DEFAULT 0,
  returning_visitors integer DEFAULT 0,
  desktop_visits integer DEFAULT 0,
  mobile_visits integer DEFAULT 0,
  tablet_visits integer DEFAULT 0,
  avg_duration_seconds numeric(10,2) DEFAULT 0,
  avg_page_views numeric(10,2) DEFAULT 0,
  bounce_rate numeric(5,2) DEFAULT 0,
  total_conversions integer DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  conversion_value numeric(12,2) DEFAULT 0,
  avg_time_to_convert_seconds numeric(12,2) DEFAULT 0,
  top_referrers jsonb DEFAULT '[]'::jsonb,
  top_countries jsonb DEFAULT '[]'::jsonb,
  top_devices jsonb DEFAULT '[]'::jsonb,
  calculated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(link_id, period_date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_link_analytics_organization_id ON enrollment_link_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_analytics_link_id ON enrollment_link_analytics(link_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_analytics_period_date ON enrollment_link_analytics(period_date);
CREATE INDEX IF NOT EXISTS idx_enrollment_link_analytics_period_type ON enrollment_link_analytics(period_type);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update link stats on visit
CREATE OR REPLACE FUNCTION update_link_visit_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE enrollment_links
  SET
    total_visits = total_visits + 1,
    unique_visits = (
      SELECT COUNT(DISTINCT COALESCE(visitor_id, session_id))
      FROM enrollment_link_visits
      WHERE link_id = NEW.link_id
    )
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollment_link_visit_stats_trigger ON enrollment_link_visits;
CREATE TRIGGER enrollment_link_visit_stats_trigger
  AFTER INSERT ON enrollment_link_visits
  FOR EACH ROW EXECUTE FUNCTION update_link_visit_stats();

-- Trigger to update link stats and visit on conversion
CREATE OR REPLACE FUNCTION update_link_conversion_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the link stats
  UPDATE enrollment_links
  SET
    total_conversions = total_conversions + 1,
    conversion_rate = CASE
      WHEN total_visits > 0 THEN ((total_conversions + 1)::numeric / total_visits * 100)
      ELSE 0
    END
  WHERE id = NEW.link_id;

  -- Mark the visit as converted
  IF NEW.visit_id IS NOT NULL THEN
    UPDATE enrollment_link_visits
    SET
      converted = true,
      conversion_id = NEW.id,
      converted_at = NEW.converted_at
    WHERE id = NEW.visit_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollment_link_conversion_stats_trigger ON enrollment_link_conversions;
CREATE TRIGGER enrollment_link_conversion_stats_trigger
  AFTER INSERT ON enrollment_link_conversions
  FOR EACH ROW EXECUTE FUNCTION update_link_conversion_stats();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE enrollment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_link_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_link_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_link_analytics ENABLE ROW LEVEL SECURITY;

-- Enrollment Links policies
DROP POLICY IF EXISTS "Users can view enrollment links" ON enrollment_links;
CREATE POLICY "Users can view enrollment links"
  ON enrollment_links FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Admins can manage all links" ON enrollment_links;
CREATE POLICY "Admins can manage all links"
  ON enrollment_links FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Advisors can manage their own links" ON enrollment_links;
CREATE POLICY "Advisors can manage their own links"
  ON enrollment_links FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

-- Enrollment Link Visits policies
DROP POLICY IF EXISTS "Admins can view all visits" ON enrollment_link_visits;
CREATE POLICY "Admins can view all visits"
  ON enrollment_link_visits FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Advisors can view their link visits" ON enrollment_link_visits;
CREATE POLICY "Advisors can view their link visits"
  ON enrollment_link_visits FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND link_id IN (SELECT id FROM enrollment_links WHERE advisor_id = get_user_advisor_id())
  );

DROP POLICY IF EXISTS "System can insert visits" ON enrollment_link_visits;
CREATE POLICY "System can insert visits"
  ON enrollment_link_visits FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Enrollment Link Conversions policies
DROP POLICY IF EXISTS "Admins can view all conversions" ON enrollment_link_conversions;
CREATE POLICY "Admins can view all conversions"
  ON enrollment_link_conversions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Advisors can view their conversions" ON enrollment_link_conversions;
CREATE POLICY "Advisors can view their conversions"
  ON enrollment_link_conversions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

DROP POLICY IF EXISTS "System can insert conversions" ON enrollment_link_conversions;
CREATE POLICY "System can insert conversions"
  ON enrollment_link_conversions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Enrollment Link Analytics policies
DROP POLICY IF EXISTS "Users can view link analytics" ON enrollment_link_analytics;
CREATE POLICY "Users can view link analytics"
  ON enrollment_link_analytics FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "System can manage analytics" ON enrollment_link_analytics;
CREATE POLICY "System can manage analytics"
  ON enrollment_link_analytics FOR ALL
  USING (organization_id = get_user_organization_id());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create default enrollment link for advisor
CREATE OR REPLACE FUNCTION create_default_advisor_link()
RETURNS TRIGGER AS $$
DECLARE
  v_slug text;
BEGIN
  -- Generate slug from name
  v_slug := lower(regexp_replace(
    NEW.first_name || '-' || NEW.last_name,
    '[^a-zA-Z0-9]', '-', 'g'
  ));

  -- Ensure uniqueness by appending random chars if needed
  WHILE EXISTS (SELECT 1 FROM enrollment_links WHERE organization_id = NEW.organization_id AND slug = v_slug) LOOP
    v_slug := v_slug || '-' || substring(md5(random()::text) from 1 for 4);
  END LOOP;

  -- Create the default link
  INSERT INTO enrollment_links (
    organization_id, advisor_id, name, slug, description
  ) VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.first_name || ' ' || NEW.last_name || ' - Default Link',
    v_slug,
    'Default enrollment link for ' || NEW.first_name || ' ' || NEW.last_name
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_advisor_default_link_trigger ON advisors;
CREATE TRIGGER create_advisor_default_link_trigger
  AFTER INSERT ON advisors
  FOR EACH ROW EXECUTE FUNCTION create_default_advisor_link();

-- Function to track a link visit
CREATE OR REPLACE FUNCTION track_link_visit(
  p_link_slug text,
  p_session_id text,
  p_visitor_id text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_referrer_url text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_link enrollment_links%ROWTYPE;
  v_visit_id uuid;
BEGIN
  -- Get the link
  SELECT * INTO v_link
  FROM enrollment_links
  WHERE slug = p_link_slug AND is_active = true
  LIMIT 1;

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if link is expired or maxed out
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN NULL;
  END IF;

  IF v_link.max_uses IS NOT NULL AND v_link.total_visits >= v_link.max_uses THEN
    RETURN NULL;
  END IF;

  -- Insert visit
  INSERT INTO enrollment_link_visits (
    organization_id, link_id, advisor_id, session_id, visitor_id,
    ip_address, user_agent, referrer_url,
    utm_source, utm_medium, utm_campaign
  ) VALUES (
    v_link.organization_id, v_link.id, v_link.advisor_id, p_session_id, p_visitor_id,
    p_ip_address, p_user_agent, p_referrer_url,
    COALESCE(p_utm_source, v_link.utm_source),
    COALESCE(p_utm_medium, v_link.utm_medium),
    COALESCE(p_utm_campaign, v_link.utm_campaign)
  )
  RETURNING id INTO v_visit_id;

  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE enrollment_links IS 'Custom enrollment tracking links for advisors';
COMMENT ON TABLE enrollment_link_visits IS 'Tracks every visit to enrollment links';
COMMENT ON TABLE enrollment_link_conversions IS 'Records when visits convert to enrollments';
COMMENT ON TABLE enrollment_link_analytics IS 'Aggregated analytics data for enrollment links';
