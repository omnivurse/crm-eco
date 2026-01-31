-- Advisor Portal Schema Migration
-- Adds tables and RLS for the Advisor Portal app

-- ============================================================================
-- 1. Add advisor_role to profiles (separate from crm_role for portal access)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'advisor_role'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN advisor_role text CHECK (advisor_role IN ('advisor', 'manager', 'owner_admin'));
  END IF;
END $$;

-- Link profiles to advisors via advisor_id for quick lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'advisor_id'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_advisor_id ON public.profiles(advisor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_advisor_role ON public.profiles(advisor_role) WHERE advisor_role IS NOT NULL;

-- ============================================================================
-- 2. Helper function: Get current user's advisor record
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_advisor_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT advisor_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================================
-- 3. Helper function: Check if advisor is in downline
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_in_my_downline(target_advisor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE downline AS (
    -- Start with advisors whose parent is me
    SELECT id, parent_advisor_id
    FROM public.advisors
    WHERE parent_advisor_id = public.get_my_advisor_id()
    
    UNION ALL
    
    -- Recursively get their children
    SELECT a.id, a.parent_advisor_id
    FROM public.advisors a
    INNER JOIN downline d ON a.parent_advisor_id = d.id
  )
  SELECT EXISTS (SELECT 1 FROM downline WHERE id = target_advisor_id);
$$;

-- ============================================================================
-- 4. Advisor Playbooks table (training content)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.advisor_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_json jsonb DEFAULT '{}',
  category text,
  sort_order integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisor_playbooks_org ON public.advisor_playbooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_advisor_playbooks_status ON public.advisor_playbooks(status);

-- RLS for advisor_playbooks
ALTER TABLE public.advisor_playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advisor_playbooks_org_read" ON public.advisor_playbooks;
CREATE POLICY "advisor_playbooks_org_read" ON public.advisor_playbooks
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "advisor_playbooks_admin_write" ON public.advisor_playbooks;
CREATE POLICY "advisor_playbooks_admin_write" ON public.advisor_playbooks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND organization_id = advisor_playbooks.organization_id
      AND (advisor_role IN ('manager', 'owner_admin') OR crm_role IN ('admin', 'super_admin'))
    )
  );

-- ============================================================================
-- 5. Engagement Events table (outreach activity log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.engagement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL,
  contact_id uuid, -- Can reference leads or members
  contact_type text CHECK (contact_type IN ('lead', 'member')),
  event_type text NOT NULL CHECK (event_type IN ('call', 'email', 'sms', 'meeting', 'note', 'task', 'other')),
  channel text, -- e.g., 'phone', 'email', 'in_person'
  subject text,
  body text,
  payload_json jsonb DEFAULT '{}',
  occurred_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_events_org ON public.engagement_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_actor ON public.engagement_events(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_advisor ON public.engagement_events(advisor_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_contact ON public.engagement_events(contact_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_engagement_events_occurred ON public.engagement_events(occurred_at DESC);

-- RLS for engagement_events
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engagement_events_own_read" ON public.engagement_events;
CREATE POLICY "engagement_events_own_read" ON public.engagement_events
  FOR SELECT
  USING (
    actor_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND organization_id = engagement_events.organization_id
      AND (advisor_role IN ('manager', 'owner_admin') OR crm_role IN ('admin', 'super_admin'))
    )
  );

DROP POLICY IF EXISTS "engagement_events_own_insert" ON public.engagement_events;
CREATE POLICY "engagement_events_own_insert" ON public.engagement_events
  FOR INSERT
  WITH CHECK (
    actor_profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 6. Presentation Templates table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.presentation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_json jsonb DEFAULT '{}',
  thumbnail_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentation_templates_org ON public.presentation_templates(organization_id);

-- RLS for presentation_templates
ALTER TABLE public.presentation_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presentation_templates_org_read" ON public.presentation_templates;
CREATE POLICY "presentation_templates_org_read" ON public.presentation_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "presentation_templates_admin_write" ON public.presentation_templates;
CREATE POLICY "presentation_templates_admin_write" ON public.presentation_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND organization_id = presentation_templates.organization_id
      AND (advisor_role IN ('manager', 'owner_admin') OR crm_role IN ('admin', 'super_admin'))
    )
  );

-- ============================================================================
-- 7. Presentations table (user-created presentations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.presentation_templates(id) ON DELETE SET NULL,
  contact_id uuid,
  contact_type text CHECK (contact_type IN ('lead', 'member')),
  title text NOT NULL,
  doc_json jsonb DEFAULT '{}',
  share_slug text UNIQUE,
  is_public boolean DEFAULT false,
  views_count integer DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentations_org ON public.presentations(organization_id);
CREATE INDEX IF NOT EXISTS idx_presentations_created_by ON public.presentations(created_by);
CREATE INDEX IF NOT EXISTS idx_presentations_share_slug ON public.presentations(share_slug) WHERE share_slug IS NOT NULL;

-- RLS for presentations
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presentations_own_all" ON public.presentations;
CREATE POLICY "presentations_own_all" ON public.presentations
  FOR ALL
  USING (
    created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "presentations_admin_read" ON public.presentations;
CREATE POLICY "presentations_admin_read" ON public.presentations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND organization_id = presentations.organization_id
      AND (advisor_role IN ('manager', 'owner_admin') OR crm_role IN ('admin', 'super_admin'))
    )
  );

-- Public access via share_slug (anonymous read for shared presentations)
DROP POLICY IF EXISTS "presentations_public_read" ON public.presentations;
CREATE POLICY "presentations_public_read" ON public.presentations
  FOR SELECT
  USING (
    is_public = true AND share_slug IS NOT NULL
  );

-- ============================================================================
-- 8. Update triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS advisor_playbooks_updated_at ON public.advisor_playbooks;
CREATE TRIGGER advisor_playbooks_updated_at
  BEFORE UPDATE ON public.advisor_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS presentation_templates_updated_at ON public.presentation_templates;
CREATE TRIGGER presentation_templates_updated_at
  BEFORE UPDATE ON public.presentation_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS presentations_updated_at ON public.presentations;
CREATE TRIGGER presentations_updated_at
  BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 9. Grant permissions
-- ============================================================================
GRANT SELECT ON public.advisor_playbooks TO authenticated;
GRANT SELECT, INSERT ON public.engagement_events TO authenticated;
GRANT SELECT ON public.presentation_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO authenticated;

-- Allow anon read for public presentations
GRANT SELECT ON public.presentations TO anon;
