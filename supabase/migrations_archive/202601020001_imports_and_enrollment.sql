-- CRM-ECO: Import Jobs & Enrollment Engine Migration
-- Creates tables for CSV imports tracking and the enrollment engine

-- ============================================================================
-- IMPORT JOBS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  entity_type text NOT NULL CHECK (entity_type IN ('member', 'advisor', 'lead')),
  source_name text,
  file_name text,
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  inserted_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON public.import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON public.import_jobs(created_at DESC);

-- ============================================================================
-- IMPORT JOB ROWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  entity_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'inserted', 'updated', 'skipped', 'error')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_import_job_rows_job ON public.import_job_rows(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_job_rows_status ON public.import_job_rows(status);

-- ============================================================================
-- PLANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  name text NOT NULL,
  code text NOT NULL,
  external_vendor_code text,
  product_line text,
  coverage_category text,
  network_type text,
  tier text,
  description text,

  rating_area_state text,
  effective_start_date date,
  effective_end_date date,

  monthly_share numeric(12,2),
  enrollment_fee numeric(12,2),
  iua_amount numeric(12,2),
  max_annual_share numeric(12,2),

  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  custom_fields jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_org ON public.plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_org_code ON public.plans(organization_id, code);

-- ============================================================================
-- MEMBERSHIPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL,

  membership_number text,
  external_vendor_membership_id text,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'terminated', 'paused')),
  effective_date date NOT NULL,
  end_date date,

  billing_amount numeric(12,2),
  billing_currency text DEFAULT 'USD',
  billing_frequency text DEFAULT 'monthly',
  billing_status text DEFAULT 'ok'
    CHECK (billing_status IN ('ok', 'delinquent', 'cancelled')),

  funding_type text,
  primary_reason_for_joining text,
  cancellation_reason text,

  custom_fields jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_member ON public.memberships(member_id);
CREATE INDEX IF NOT EXISTS idx_memberships_plan ON public.memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_memberships_advisor ON public.memberships(advisor_id);

-- ============================================================================
-- ENROLLMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  enrollment_number text,
  primary_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  advisor_id uuid REFERENCES public.advisors(id) ON DELETE SET NULL,

  enrollment_source text,
  channel text,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'submitted', 'approved', 'rejected', 'cancelled')),

  selected_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  requested_effective_date date,
  effective_date date,

  household_size int,
  has_mandate_warning boolean DEFAULT false,
  has_age65_warning boolean DEFAULT false,

  external_vendor_enrollment_id text,

  snapshot jsonb DEFAULT '{}'::jsonb,
  custom_fields jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_org ON public.enrollments(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_primary_member ON public.enrollments(primary_member_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_advisor ON public.enrollments(advisor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_lead ON public.enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_created_at ON public.enrollments(created_at DESC);

-- ============================================================================
-- ENROLLMENT STEPS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.enrollment_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,

  step_key text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  payload jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_steps_enrollment ON public.enrollment_steps(enrollment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_steps_enrollment_key ON public.enrollment_steps(enrollment_id, step_key);

-- ============================================================================
-- ENROLLMENT AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.enrollment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  event_type text NOT NULL,
  old_status text,
  new_status text,
  message text,
  data_before jsonb,
  data_after jsonb,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_audit_enrollment ON public.enrollment_audit_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_audit_created_at ON public.enrollment_audit_log(created_at DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_plans_updated_at 
  BEFORE UPDATE ON plans 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at 
  BEFORE UPDATE ON memberships 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at 
  BEFORE UPDATE ON enrollments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrollment_steps_updated_at 
  BEFORE UPDATE ON enrollment_steps 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- IMPORT JOBS POLICIES
-- ============================================================================
CREATE POLICY "Users can view import jobs in their organization"
  ON import_jobs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can create import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id() 
    AND get_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "Admins can update import jobs"
  ON import_jobs FOR UPDATE
  USING (
    organization_id = get_user_organization_id() 
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- IMPORT JOB ROWS POLICIES
-- ============================================================================
CREATE POLICY "Users can view import job rows"
  ON import_job_rows FOR SELECT
  USING (
    import_job_id IN (SELECT id FROM import_jobs WHERE organization_id = get_user_organization_id())
  );

CREATE POLICY "Admins can create import job rows"
  ON import_job_rows FOR INSERT
  WITH CHECK (
    import_job_id IN (
      SELECT id FROM import_jobs 
      WHERE organization_id = get_user_organization_id() 
      AND get_user_role() IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can update import job rows"
  ON import_job_rows FOR UPDATE
  USING (
    import_job_id IN (
      SELECT id FROM import_jobs 
      WHERE organization_id = get_user_organization_id() 
      AND get_user_role() IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- PLANS POLICIES
-- ============================================================================
CREATE POLICY "Users can view plans in their organization"
  ON plans FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage plans"
  ON plans FOR ALL
  USING (
    organization_id = get_user_organization_id() 
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- MEMBERSHIPS POLICIES
-- ============================================================================
CREATE POLICY "Admins can view all memberships"
  ON memberships FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can view their members' memberships"
  ON memberships FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND (
      advisor_id = get_user_advisor_id()
      OR member_id IN (SELECT id FROM members WHERE advisor_id = get_user_advisor_id())
    )
  );

CREATE POLICY "Admins can manage memberships"
  ON memberships FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- ============================================================================
-- ENROLLMENTS POLICIES
-- ============================================================================
CREATE POLICY "Admins can view all enrollments"
  ON enrollments FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can view their enrollments"
  ON enrollments FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND (
      advisor_id = get_user_advisor_id()
      OR primary_member_id IN (SELECT id FROM members WHERE advisor_id = get_user_advisor_id())
    )
  );

CREATE POLICY "Admins can manage enrollments"
  ON enrollments FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can create and update their enrollments"
  ON enrollments FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

CREATE POLICY "Advisors can update their enrollments"
  ON enrollments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() = 'advisor'
    AND advisor_id = get_user_advisor_id()
  );

-- ============================================================================
-- ENROLLMENT STEPS POLICIES
-- ============================================================================
CREATE POLICY "Users can view enrollment steps"
  ON enrollment_steps FOR SELECT
  USING (
    enrollment_id IN (SELECT id FROM enrollments WHERE organization_id = get_user_organization_id())
  );

CREATE POLICY "Users can manage enrollment steps"
  ON enrollment_steps FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

CREATE POLICY "Advisors can manage their enrollment steps"
  ON enrollment_steps FOR ALL
  USING (
    enrollment_id IN (
      SELECT id FROM enrollments 
      WHERE organization_id = get_user_organization_id()
      AND advisor_id = get_user_advisor_id()
    )
  );

-- ============================================================================
-- ENROLLMENT AUDIT LOG POLICIES (Read-only from app)
-- ============================================================================
CREATE POLICY "Users can view enrollment audit logs"
  ON enrollment_audit_log FOR SELECT
  USING (
    enrollment_id IN (SELECT id FROM enrollments WHERE organization_id = get_user_organization_id())
  );

CREATE POLICY "System can insert audit logs"
  ON enrollment_audit_log FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

-- ============================================================================
-- GENERATE ENROLLMENT NUMBER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_enrollment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.enrollment_number IS NULL THEN
    NEW.enrollment_number := 'ENR-' || to_char(now(), 'YYYYMMDD') || '-' || 
      LPAD(nextval('enrollment_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for enrollment numbers
CREATE SEQUENCE IF NOT EXISTS enrollment_number_seq START 1;

CREATE TRIGGER set_enrollment_number
  BEFORE INSERT ON enrollments
  FOR EACH ROW EXECUTE FUNCTION generate_enrollment_number();

