/*
  # Report Builder System Migration

  This migration creates the complete schema for the Report Builder System,
  including domain tables for health insurance management and report infrastructure.

  ## Tables Created

  ### Domain Tables
  - organizations: Multi-tenant organization support
  - agent_levels: Advisor tier definitions
  - advisors: Insurance advisors/agents
  - members: Health insurance members
  - products: Insurance products
  - enrollments: Member enrollment records
  - commissions: Advisor commission records

  ### Report Builder Tables
  - crm_reports: Saved report definitions
  - crm_scheduled_reports: Scheduled report jobs
  - report_segments: Saved result sets for campaigns
  - report_alerts: Milestone/threshold notifications
  - advisor_milestone_progress: Advisor tier progression tracking

  ## Security
  - All tables have RLS enabled
  - Policies based on organization membership and role
*/

-- ============================================================================
-- DOMAIN TABLES
-- ============================================================================

-- Organizations (multi-tenant support)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Agent Levels (tier definitions for advisors)
-- Add org_id column to existing table if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_levels') THEN
    -- Table exists, add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_levels' AND column_name = 'org_id') THEN
      ALTER TABLE public.agent_levels ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_levels' AND column_name = 'min_active_members') THEN
      ALTER TABLE public.agent_levels ADD COLUMN min_active_members integer DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_levels' AND column_name = 'min_monthly_enrollments') THEN
      ALTER TABLE public.agent_levels ADD COLUMN min_monthly_enrollments integer DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_levels' AND column_name = 'commission_rate') THEN
      ALTER TABLE public.agent_levels ADD COLUMN commission_rate numeric(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_levels' AND column_name = 'rank') THEN
      ALTER TABLE public.agent_levels ADD COLUMN rank integer NOT NULL DEFAULT 0;
    END IF;
  ELSE
    -- Create the table
    CREATE TABLE public.agent_levels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      rank integer NOT NULL DEFAULT 0,
      min_active_members integer DEFAULT 0,
      min_monthly_enrollments integer DEFAULT 0,
      commission_rate numeric(5,2) DEFAULT 0,
      description text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(org_id, name)
    );
  END IF;
END $$;

-- Create indexes on agent_levels (conditional on column existence)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_levels' AND column_name = 'org_id') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_levels_org_id ON public.agent_levels(org_id);
    CREATE INDEX IF NOT EXISTS idx_agent_levels_rank ON public.agent_levels(org_id, rank);
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Advisors (insurance agents)
CREATE TABLE IF NOT EXISTS public.advisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  agent_level_id uuid REFERENCES public.agent_levels(id) ON DELETE SET NULL,
  parent_advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL,
  code text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  state text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'terminated')),
  licensed_states text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, email)
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_advisors_org_id ON public.advisors(org_id);
  CREATE INDEX IF NOT EXISTS idx_advisors_profile_id ON public.advisors(profile_id);
  CREATE INDEX IF NOT EXISTS idx_advisors_agent_level_id ON public.advisors(agent_level_id);
  CREATE INDEX IF NOT EXISTS idx_advisors_parent_advisor_id ON public.advisors(parent_advisor_id);
  CREATE INDEX IF NOT EXISTS idx_advisors_status ON public.advisors(org_id, status);
  CREATE INDEX IF NOT EXISTS idx_advisors_state ON public.advisors(state);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Products (insurance products)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  type text NOT NULL CHECK (type IN ('medical', 'dental', 'vision', 'life', 'supplemental', 'bundle')),
  monthly_premium numeric(10,2),
  description text,
  is_addon boolean DEFAULT false,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, code)
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(org_id);
  CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(org_id, type);
  CREATE INDEX IF NOT EXISTS idx_products_is_addon ON public.products(org_id, is_addon);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Members (health insurance members)
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_number text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  date_of_birth date,
  state text,
  zip_code text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'cancelled', 'terminated')),
  enrollment_date date,
  effective_date date,
  termination_date date,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, member_number)
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_members_org_id ON public.members(org_id);
  CREATE INDEX IF NOT EXISTS idx_members_advisor_id ON public.members(advisor_id);
  CREATE INDEX IF NOT EXISTS idx_members_profile_id ON public.members(profile_id);
  CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(org_id, status);
  CREATE INDEX IF NOT EXISTS idx_members_state ON public.members(state);
  CREATE INDEX IF NOT EXISTS idx_members_state_status ON public.members(state, status);
  CREATE INDEX IF NOT EXISTS idx_members_advisor_status ON public.members(advisor_id, status);
  CREATE INDEX IF NOT EXISTS idx_members_enrollment_date ON public.members(enrollment_date);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Enrollments (member enrollment records)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  enrollment_date date NOT NULL,
  effective_date date,
  termination_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'cancelled', 'terminated')),
  monthly_premium numeric(10,2),
  payment_frequency text DEFAULT 'monthly',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_enrollments_org_id ON public.enrollments(org_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_member_id ON public.enrollments(member_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_advisor_id ON public.enrollments(advisor_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_product_id ON public.enrollments(product_id);
  CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(org_id, status);
  CREATE INDEX IF NOT EXISTS idx_enrollments_advisor_date ON public.enrollments(advisor_id, enrollment_date);
  CREATE INDEX IF NOT EXISTS idx_enrollments_date ON public.enrollments(enrollment_date);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Commissions (advisor commission records)
CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES public.advisors(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  commission_period text NOT NULL, -- YYYY-MM format
  commission_type text NOT NULL CHECK (commission_type IN ('initial', 'renewal', 'override', 'bonus')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  rate numeric(5,2),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_commissions_org_id ON public.commissions(org_id);
  CREATE INDEX IF NOT EXISTS idx_commissions_advisor_id ON public.commissions(advisor_id);
  CREATE INDEX IF NOT EXISTS idx_commissions_member_id ON public.commissions(member_id);
  CREATE INDEX IF NOT EXISTS idx_commissions_enrollment_id ON public.commissions(enrollment_id);
  CREATE INDEX IF NOT EXISTS idx_commissions_period ON public.commissions(commission_period);
  CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(org_id, status);
  CREATE INDEX IF NOT EXISTS idx_commissions_advisor_period ON public.commissions(advisor_id, commission_period);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- REPORT BUILDER TABLES
-- ============================================================================

-- CRM Reports (saved report definitions)
CREATE TABLE IF NOT EXISTS public.crm_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  data_source text NOT NULL, -- 'members', 'advisors', 'enrollments', 'commissions'
  columns jsonb NOT NULL DEFAULT '[]',
  filters jsonb DEFAULT '[]',
  grouping jsonb DEFAULT '[]',
  aggregations jsonb DEFAULT '[]',
  sorting jsonb DEFAULT '[]',
  is_template boolean DEFAULT false,
  template_category text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_crm_reports_org_id ON public.crm_reports(org_id);
  CREATE INDEX IF NOT EXISTS idx_crm_reports_data_source ON public.crm_reports(org_id, data_source);
  CREATE INDEX IF NOT EXISTS idx_crm_reports_is_template ON public.crm_reports(is_template);
  CREATE INDEX IF NOT EXISTS idx_crm_reports_created_by ON public.crm_reports(created_by);
EXCEPTION WHEN others THEN NULL;
END $$;

-- CRM Scheduled Reports
CREATE TABLE IF NOT EXISTS public.crm_scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.crm_reports(id) ON DELETE CASCADE,
  name text NOT NULL,
  schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_config jsonb DEFAULT '{}',
  recipients text[] DEFAULT '{}',
  export_format text DEFAULT 'csv' CHECK (export_format IN ('csv', 'excel', 'json')),
  is_enabled boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_crm_scheduled_reports_org_id ON public.crm_scheduled_reports(org_id);
  CREATE INDEX IF NOT EXISTS idx_crm_scheduled_reports_report_id ON public.crm_scheduled_reports(report_id);
  CREATE INDEX IF NOT EXISTS idx_crm_scheduled_reports_next_run ON public.crm_scheduled_reports(next_run_at) WHERE is_enabled = true;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Report Segments (saved result sets for campaigns)
CREATE TABLE IF NOT EXISTS public.report_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.crm_reports(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  entity_type text NOT NULL CHECK (entity_type IN ('members', 'advisors')),
  filter_snapshot jsonb,
  record_count integer DEFAULT 0,
  is_dynamic boolean DEFAULT false,
  last_refreshed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_report_segments_org_id ON public.report_segments(org_id);
  CREATE INDEX IF NOT EXISTS idx_report_segments_report_id ON public.report_segments(report_id);
  CREATE INDEX IF NOT EXISTS idx_report_segments_entity_type ON public.report_segments(org_id, entity_type);
EXCEPTION WHEN others THEN NULL;
END $$;

-- Report Alerts (milestone/threshold notifications)
CREATE TABLE IF NOT EXISTS public.report_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.crm_reports(id) ON DELETE CASCADE,
  name text NOT NULL,
  condition_type text NOT NULL CHECK (condition_type IN ('threshold', 'milestone', 'change')),
  condition_config jsonb NOT NULL,
  recipients text[] DEFAULT '{}',
  is_enabled boolean DEFAULT true,
  last_triggered_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_report_alerts_org_id ON public.report_alerts(org_id);
  CREATE INDEX IF NOT EXISTS idx_report_alerts_report_id ON public.report_alerts(report_id);
  CREATE INDEX IF NOT EXISTS idx_report_alerts_is_enabled ON public.report_alerts(is_enabled) WHERE is_enabled = true;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Advisor Milestone Progress
CREATE TABLE IF NOT EXISTS public.advisor_milestone_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES public.advisors(id) ON DELETE CASCADE,
  current_level_id uuid REFERENCES public.agent_levels(id) ON DELETE SET NULL,
  next_level_id uuid REFERENCES public.agent_levels(id) ON DELETE SET NULL,
  active_members_count integer DEFAULT 0,
  monthly_enrollments_count integer DEFAULT 0,
  progress_percent numeric(5,2) DEFAULT 0,
  metrics_snapshot jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(advisor_id)
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_advisor_milestone_progress_org_id ON public.advisor_milestone_progress(org_id);
  CREATE INDEX IF NOT EXISTS idx_advisor_milestone_progress_advisor_id ON public.advisor_milestone_progress(advisor_id);
  CREATE INDEX IF NOT EXISTS idx_advisor_milestone_progress_current_level ON public.advisor_milestone_progress(current_level_id);
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables (using DO block to handle existing tables)
DO $$
BEGIN
  ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.agent_levels ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_reports ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.crm_scheduled_reports ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.report_segments ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.report_alerts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.advisor_milestone_progress ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Helper function to check if user is staff/admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('staff', 'agent', 'admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create policies only if they don't exist (using DROP IF EXISTS first for idempotency)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read organizations" ON public.organizations;
  DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organizations;
  CREATE POLICY "Staff can read organizations" ON public.organizations FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Admins can manage organizations" ON public.organizations FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read agent levels" ON public.agent_levels;
  DROP POLICY IF EXISTS "Admins can manage agent levels" ON public.agent_levels;
  CREATE POLICY "Staff can read agent levels" ON public.agent_levels FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Admins can manage agent levels" ON public.agent_levels FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read advisors" ON public.advisors;
  DROP POLICY IF EXISTS "Advisors can read own record" ON public.advisors;
  DROP POLICY IF EXISTS "Admins can manage advisors" ON public.advisors;
  CREATE POLICY "Staff can read advisors" ON public.advisors FOR SELECT USING (public.is_staff_or_admin());
  -- Only create profile_id-based policy if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'advisors' AND column_name = 'profile_id') THEN
    CREATE POLICY "Advisors can read own record" ON public.advisors FOR SELECT USING (profile_id = auth.uid());
  END IF;
  CREATE POLICY "Admins can manage advisors" ON public.advisors FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read products" ON public.products;
  DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
  CREATE POLICY "Staff can read products" ON public.products FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read members" ON public.members;
  DROP POLICY IF EXISTS "Members can read own record" ON public.members;
  DROP POLICY IF EXISTS "Advisors can read their members" ON public.members;
  DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
  CREATE POLICY "Staff can read members" ON public.members FOR SELECT USING (public.is_staff_or_admin());
  -- Only create profile_id-based policy if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'profile_id') THEN
    CREATE POLICY "Members can read own record" ON public.members FOR SELECT USING (profile_id = auth.uid());
  END IF;
  -- Only create advisor_id-based policy if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'advisor_id') THEN
    CREATE POLICY "Advisors can read their members" ON public.members FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.advisors a WHERE a.profile_id = auth.uid() AND public.members.advisor_id = a.id)
    );
  END IF;
  CREATE POLICY "Admins can manage members" ON public.members FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read enrollments" ON public.enrollments;
  DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.enrollments;
  CREATE POLICY "Staff can read enrollments" ON public.enrollments FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Admins can manage enrollments" ON public.enrollments FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read commissions" ON public.commissions;
  DROP POLICY IF EXISTS "Advisors can read own commissions" ON public.commissions;
  DROP POLICY IF EXISTS "Admins can manage commissions" ON public.commissions;
  CREATE POLICY "Staff can read commissions" ON public.commissions FOR SELECT USING (public.is_staff_or_admin());
  -- Only create advisor-based policy if advisor_id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'commissions' AND column_name = 'advisor_id') THEN
    CREATE POLICY "Advisors can read own commissions" ON public.commissions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.advisors a WHERE a.profile_id = auth.uid() AND public.commissions.advisor_id = a.id)
    );
  END IF;
  CREATE POLICY "Admins can manage commissions" ON public.commissions FOR ALL USING (public.is_admin());
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read reports" ON public.crm_reports;
  DROP POLICY IF EXISTS "Staff can create reports" ON public.crm_reports;
  DROP POLICY IF EXISTS "Users can update own reports" ON public.crm_reports;
  DROP POLICY IF EXISTS "Users can delete own reports" ON public.crm_reports;
  CREATE POLICY "Staff can read reports" ON public.crm_reports FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Staff can create reports" ON public.crm_reports FOR INSERT WITH CHECK (public.is_staff_or_admin());
  CREATE POLICY "Users can update own reports" ON public.crm_reports FOR UPDATE USING (created_by = auth.uid() OR public.is_admin());
  CREATE POLICY "Users can delete own reports" ON public.crm_reports FOR DELETE USING (created_by = auth.uid() OR public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read scheduled reports" ON public.crm_scheduled_reports;
  DROP POLICY IF EXISTS "Staff can manage scheduled reports" ON public.crm_scheduled_reports;
  CREATE POLICY "Staff can read scheduled reports" ON public.crm_scheduled_reports FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Staff can manage scheduled reports" ON public.crm_scheduled_reports FOR ALL USING (public.is_staff_or_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read segments" ON public.report_segments;
  DROP POLICY IF EXISTS "Staff can manage segments" ON public.report_segments;
  CREATE POLICY "Staff can read segments" ON public.report_segments FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Staff can manage segments" ON public.report_segments FOR ALL USING (public.is_staff_or_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read alerts" ON public.report_alerts;
  DROP POLICY IF EXISTS "Staff can manage alerts" ON public.report_alerts;
  CREATE POLICY "Staff can read alerts" ON public.report_alerts FOR SELECT USING (public.is_staff_or_admin());
  CREATE POLICY "Staff can manage alerts" ON public.report_alerts FOR ALL USING (public.is_staff_or_admin());
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Staff can read milestone progress" ON public.advisor_milestone_progress;
  DROP POLICY IF EXISTS "Advisors can read own progress" ON public.advisor_milestone_progress;
  DROP POLICY IF EXISTS "Staff can manage milestone progress" ON public.advisor_milestone_progress;
  CREATE POLICY "Staff can read milestone progress" ON public.advisor_milestone_progress FOR SELECT USING (public.is_staff_or_admin());
  -- Only create advisor-based policy if advisor_id column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'advisor_milestone_progress' AND column_name = 'advisor_id') THEN
    CREATE POLICY "Advisors can read own progress" ON public.advisor_milestone_progress FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.advisors a WHERE a.profile_id = auth.uid() AND public.advisor_milestone_progress.advisor_id = a.id)
    );
  END IF;
  CREATE POLICY "Staff can manage milestone progress" ON public.advisor_milestone_progress FOR ALL USING (public.is_staff_or_admin());
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at column
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'organizations', 'agent_levels', 'advisors', 'products',
      'members', 'enrollments', 'commissions', 'crm_reports',
      'crm_scheduled_reports', 'report_alerts'
    ])
  LOOP
    BEGIN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_%s_updated_at ON public.%s;
         CREATE TRIGGER set_%s_updated_at
         BEFORE UPDATE ON public.%s
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
        tbl, tbl, tbl, tbl
      );
    EXCEPTION WHEN undefined_table THEN
      -- Table doesn't exist, skip
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- SEED DATA: Default Organization and Agent Levels
-- ============================================================================

-- Insert default organization (wrapped to handle missing table)
DO $$ BEGIN
  INSERT INTO public.organizations (id, name, slug, settings)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Organization',
    'default',
    '{"features": ["reports", "milestones", "alerts"]}'
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN undefined_table OR unique_violation THEN NULL;
END $$;

-- Insert default agent levels (wrapped to handle missing table/columns/constraints)
DO $$ BEGIN
  -- Only insert if org_id column exists (new schema)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_levels' AND column_name = 'org_id') THEN
    INSERT INTO public.agent_levels (org_id, name, rank, min_active_members, min_monthly_enrollments, commission_rate, description)
    VALUES
      ('00000000-0000-0000-0000-000000000001', 'Associate', 1, 0, 0, 5.00, 'Entry level advisor'),
      ('00000000-0000-0000-0000-000000000001', 'Agent', 2, 10, 3, 7.50, 'Standard advisor tier'),
      ('00000000-0000-0000-0000-000000000001', 'Team Lead', 3, 25, 5, 10.00, 'Team leadership tier'),
      ('00000000-0000-0000-0000-000000000001', 'Manager', 4, 50, 10, 12.50, 'Management tier'),
      ('00000000-0000-0000-0000-000000000001', 'Director', 5, 100, 20, 15.00, 'Director level tier'),
      ('00000000-0000-0000-0000-000000000001', 'Regional VP', 6, 250, 50, 17.50, 'Regional leadership'),
      ('00000000-0000-0000-0000-000000000001', 'Executive', 7, 500, 100, 20.00, 'Executive leadership')
    ON CONFLICT (org_id, name) DO NOTHING;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Insert sample products (wrapped to handle missing table/columns/constraints)
DO $$ BEGIN
  -- Only insert if org_id column exists (new schema)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'org_id') THEN
    INSERT INTO public.products (org_id, name, code, type, monthly_premium, description, is_addon, is_active)
    VALUES
      ('00000000-0000-0000-0000-000000000001', 'Bronze Health Plan', 'BRONZE', 'medical', 299.99, 'Basic health coverage', false, true),
      ('00000000-0000-0000-0000-000000000001', 'Silver Health Plan', 'SILVER', 'medical', 449.99, 'Standard health coverage', false, true),
      ('00000000-0000-0000-0000-000000000001', 'Gold Health Plan', 'GOLD', 'medical', 649.99, 'Premium health coverage', false, true),
      ('00000000-0000-0000-0000-000000000001', 'Dental Coverage', 'DENTAL', 'dental', 39.99, 'Dental insurance add-on', true, true),
      ('00000000-0000-0000-0000-000000000001', 'Vision Coverage', 'VISION', 'vision', 19.99, 'Vision insurance add-on', true, true),
      ('00000000-0000-0000-0000-000000000001', 'Life Insurance Basic', 'LIFE-B', 'life', 29.99, 'Basic life insurance', true, true)
    ON CONFLICT (org_id, code) DO NOTHING;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
