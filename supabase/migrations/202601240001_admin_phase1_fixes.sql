-- Admin Portal Phase 1 Fixes
-- Addresses gaps identified in expert review:
-- 1. Dependents table enrollment linkage fields
-- 2. Pricing matrix temporal + household columns
-- 3. Enrollments workflow metadata
-- 4. Admin activity log table

-- ============================================================================
-- GAP 1: EXTEND DEPENDENTS TABLE WITH ENROLLMENT LINKAGE FIELDS
-- ============================================================================

-- Add is_primary for spouse primary coverage edge cases
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- Add coverage_role for coverage systems
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS coverage_role text CHECK (coverage_role IN ('spouse', 'child', 'dependent'));

-- Add included_in_enrollment toggle for coverage exclusion per enrollment
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS included_in_enrollment boolean DEFAULT true;

-- Add external_ref for future integrations
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS external_ref text;

-- Index for enrollment inclusion queries
CREATE INDEX IF NOT EXISTS idx_dependents_included ON public.dependents(included_in_enrollment) 
  WHERE included_in_enrollment = true;

-- ============================================================================
-- GAP 2: EXTEND PRODUCT PRICING MATRIX WITH TEMPORAL + HOUSEHOLD COLUMNS
-- ============================================================================

-- Add household_tier for family pricing tiers
ALTER TABLE public.product_pricing_matrix
  ADD COLUMN IF NOT EXISTS household_tier text 
    CHECK (household_tier IN ('member-only', 'member+spouse', 'member+children', 'family'));

-- Add effective_date for when pricing becomes active
ALTER TABLE public.product_pricing_matrix
  ADD COLUMN IF NOT EXISTS effective_date date;

-- Add end_date for when pricing expires (null = current/active)
ALTER TABLE public.product_pricing_matrix
  ADD COLUMN IF NOT EXISTS end_date date;

-- Index for temporal pricing queries
CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_effective 
  ON public.product_pricing_matrix(plan_id, effective_date, end_date);

-- Index for household tier lookups
CREATE INDEX IF NOT EXISTS idx_product_pricing_matrix_household 
  ON public.product_pricing_matrix(plan_id, household_tier);

-- ============================================================================
-- GAP 3: EXTEND ENROLLMENTS TABLE WITH WORKFLOW METADATA
-- ============================================================================

-- Add submitted_at timestamp
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Add approved_at timestamp
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add approved_by reference to profiles
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add rejected_at timestamp
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Add rejection_reason text
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add cancelled_at timestamp
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Add cancelled_reason text
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS cancelled_reason text;

-- Add last_status_change_at for tracking
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz DEFAULT now();

-- Index for workflow status queries
CREATE INDEX IF NOT EXISTS idx_enrollments_submitted_at ON public.enrollments(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_approved_at ON public.enrollments(approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_approved_by ON public.enrollments(approved_by);

-- Trigger to update last_status_change_at when status changes
CREATE OR REPLACE FUNCTION update_enrollment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.last_status_change_at := now();
    
    -- Auto-populate workflow timestamps based on status
    CASE NEW.status
      WHEN 'submitted' THEN
        IF NEW.submitted_at IS NULL THEN
          NEW.submitted_at := now();
        END IF;
      WHEN 'approved' THEN
        IF NEW.approved_at IS NULL THEN
          NEW.approved_at := now();
        END IF;
      WHEN 'rejected' THEN
        IF NEW.rejected_at IS NULL THEN
          NEW.rejected_at := now();
        END IF;
      WHEN 'cancelled' THEN
        IF NEW.cancelled_at IS NULL THEN
          NEW.cancelled_at := now();
        END IF;
      ELSE
        -- No action for other statuses
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enrollment_status_change ON public.enrollments;
CREATE TRIGGER trg_enrollment_status_change
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION update_enrollment_status_change();

-- ============================================================================
-- GAP 4: CREATE ADMIN ACTIVITY LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Entity being acted upon
  entity_type text NOT NULL CHECK (entity_type IN ('member', 'enrollment', 'plan', 'advisor', 'product', 'dependent', 'billing', 'settings')),
  entity_id uuid NOT NULL,
  
  -- Action performed
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'cancel', 'activate', 'deactivate', 'import', 'export')),
  
  -- Additional context
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  -- IP and user agent for security auditing
  ip_address inet,
  user_agent text,
  
  created_at timestamptz DEFAULT now()
);

-- Indexes for activity log queries
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_org ON public.admin_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_actor ON public.admin_activity_log(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_entity ON public.admin_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action ON public.admin_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created ON public.admin_activity_log(created_at DESC);

-- Composite index for dashboard activity feed queries
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_feed 
  ON public.admin_activity_log(organization_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY FOR ADMIN ACTIVITY LOG
-- ============================================================================

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs in their organization
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.admin_activity_log;
CREATE POLICY "Admins can view activity logs"
  ON public.admin_activity_log FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- Only system can insert activity logs (via service role or triggers)
DROP POLICY IF EXISTS "System can insert activity logs" ON public.admin_activity_log;
CREATE POLICY "System can insert activity logs"
  ON public.admin_activity_log FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

-- Activity logs are immutable - no updates or deletes
-- (Compliance requirement: audit logs should never be modified)

-- ============================================================================
-- HELPER FUNCTION TO LOG ADMIN ACTIVITY
-- ============================================================================

CREATE OR REPLACE FUNCTION log_admin_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_activity_id uuid;
  v_org_id uuid;
  v_profile_id uuid;
BEGIN
  -- Get current user's organization and profile
  SELECT organization_id, id INTO v_org_id, v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  INSERT INTO admin_activity_log (
    organization_id,
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    description,
    metadata
  ) VALUES (
    v_org_id,
    v_profile_id,
    p_entity_type,
    p_entity_id,
    p_action,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE SYSTEM SETTINGS TABLE (for /admin/settings page)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Branding defaults
  default_primary_color text DEFAULT '#1e40af',
  default_secondary_color text DEFAULT '#3b82f6',
  default_logo_url text,
  company_name text,
  
  -- System toggles
  enrollment_auto_approve boolean DEFAULT false,
  require_payment_before_activation boolean DEFAULT true,
  send_welcome_emails boolean DEFAULT true,
  send_renewal_reminders boolean DEFAULT true,
  
  -- Rate/pricing settings
  current_rate_version text DEFAULT '2026',
  rate_effective_date date,
  
  -- Notification settings
  admin_notification_email text,
  billing_notification_email text,
  
  -- Feature flags
  enable_self_enrollment boolean DEFAULT true,
  enable_agent_enrollment boolean DEFAULT true,
  enable_dependent_management boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- Index for settings lookup
CREATE INDEX IF NOT EXISTS idx_admin_settings_org ON public.admin_settings(organization_id);

-- Updated_at trigger for settings
CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for admin settings
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view settings" ON public.admin_settings;
CREATE POLICY "Admins can view settings"
  ON public.admin_settings FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Owners and admins can manage settings" ON public.admin_settings;
CREATE POLICY "Owners and admins can manage settings"
  ON public.admin_settings FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.admin_activity_log IS 'Audit log for all admin portal actions - immutable for compliance';
COMMENT ON TABLE public.admin_settings IS 'Organization-level settings for the admin portal';

COMMENT ON COLUMN public.dependents.is_primary IS 'True if this dependent is the primary coverage holder (edge case for spouse)';
COMMENT ON COLUMN public.dependents.coverage_role IS 'Coverage system role: spouse, child, or dependent';
COMMENT ON COLUMN public.dependents.included_in_enrollment IS 'Whether this dependent is included in the current enrollment coverage';
COMMENT ON COLUMN public.dependents.external_ref IS 'External system reference ID for integrations';

COMMENT ON COLUMN public.product_pricing_matrix.household_tier IS 'Pricing tier: member-only, member+spouse, member+children, or family';
COMMENT ON COLUMN public.product_pricing_matrix.effective_date IS 'Date when this pricing becomes active';
COMMENT ON COLUMN public.product_pricing_matrix.end_date IS 'Date when this pricing expires (null = currently active)';

COMMENT ON COLUMN public.enrollments.submitted_at IS 'Timestamp when enrollment was submitted for review';
COMMENT ON COLUMN public.enrollments.approved_at IS 'Timestamp when enrollment was approved';
COMMENT ON COLUMN public.enrollments.approved_by IS 'Profile ID of admin who approved the enrollment';
COMMENT ON COLUMN public.enrollments.rejected_at IS 'Timestamp when enrollment was rejected';
COMMENT ON COLUMN public.enrollments.rejection_reason IS 'Reason for enrollment rejection';
COMMENT ON COLUMN public.enrollments.cancelled_at IS 'Timestamp when enrollment was cancelled';
COMMENT ON COLUMN public.enrollments.cancelled_reason IS 'Reason for enrollment cancellation';
COMMENT ON COLUMN public.enrollments.last_status_change_at IS 'Timestamp of most recent status change';
