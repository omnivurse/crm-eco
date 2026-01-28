/*
  Ops Module Enhancements

  1. vendor_credentials - Secure credential storage for vendor APIs
  2. vendor_job_configs - Vendor-specific job configurations
  3. vendor_eligibility_runs - Track eligibility check runs per vendor
  4. ops_audit_log - Audit every run/schedule change/retry
  5. Permissions: ops.read, ops.run_jobs, ops.admin
  6. Extended job types for vendor eligibility
*/

-- Create vendor_credentials table (secure credential storage)
CREATE TABLE IF NOT EXISTS public.vendor_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_code text NOT NULL, -- arm, sedera, zion, etc.
  credential_type text NOT NULL CHECK (credential_type IN (
    'api_key',
    'oauth2',
    'sftp',
    'basic_auth',
    'certificate'
  )),
  name text NOT NULL,
  -- Encrypted credential data stored as JSONB (encrypted at rest by Supabase)
  -- Never returned to client, only used server-side
  credentials_encrypted jsonb NOT NULL DEFAULT '{}',
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'staging', 'production')),
  is_active boolean NOT NULL DEFAULT true,
  last_verified_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, vendor_code, credential_type, environment)
);

-- Create vendor_job_configs table
CREATE TABLE IF NOT EXISTS public.vendor_job_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_code text NOT NULL,
  job_type text NOT NULL CHECK (job_type IN (
    'eligibility_check',
    'enrollment_sync',
    'termination_sync',
    'roster_pull',
    'claims_submission',
    'payment_reconciliation',
    'age_up_out_report',
    'custom'
  )),
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}',
  -- Scheduling
  schedule_enabled boolean NOT NULL DEFAULT false,
  schedule_cron text,
  schedule_timezone text DEFAULT 'America/New_York',
  -- Retry settings
  retry_enabled boolean NOT NULL DEFAULT true,
  retry_max_attempts integer DEFAULT 3,
  retry_delay_seconds integer DEFAULT 300,
  -- Alerts
  alert_on_failure boolean NOT NULL DEFAULT true,
  alert_recipients jsonb DEFAULT '[]',
  -- Stats
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  total_runs integer DEFAULT 0,
  total_successes integer DEFAULT 0,
  total_failures integer DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, vendor_code, job_type)
);

-- Create vendor_eligibility_runs table
CREATE TABLE IF NOT EXISTS public.vendor_eligibility_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_run_id uuid REFERENCES public.job_runs(id) ON DELETE SET NULL,
  vendor_code text NOT NULL,
  run_type text NOT NULL CHECK (run_type IN (
    'full_sync',
    'incremental',
    'single_member',
    'batch',
    'retry'
  )),
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  -- Request/response tracking
  request_payload jsonb,
  response_payload jsonb,
  -- Stats
  members_checked integer DEFAULT 0,
  members_eligible integer DEFAULT 0,
  members_ineligible integer DEFAULT 0,
  members_pending integer DEFAULT 0,
  members_error integer DEFAULT 0,
  -- Timing
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  -- Error handling
  error_message text,
  error_details jsonb,
  retry_count integer DEFAULT 0,
  retried_from_id uuid REFERENCES public.vendor_eligibility_runs(id) ON DELETE SET NULL,
  -- Audit
  triggered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled', 'webhook', 'retry', 'system')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create ops_audit_log table
CREATE TABLE IF NOT EXISTS public.ops_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'job_run_started',
    'job_run_completed',
    'job_run_failed',
    'job_run_cancelled',
    'job_run_retried',
    'schedule_created',
    'schedule_updated',
    'schedule_deleted',
    'schedule_activated',
    'schedule_paused',
    'credential_created',
    'credential_updated',
    'credential_deleted',
    'credential_verified',
    'config_created',
    'config_updated',
    'config_deleted',
    'eligibility_run_started',
    'eligibility_run_completed',
    'eligibility_run_failed'
  )),
  entity_type text NOT NULL, -- job_definition, job_run, vendor_credential, vendor_job_config, vendor_eligibility_run
  entity_id uuid NOT NULL,
  vendor_code text,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text,
  actor_email text,
  changes jsonb, -- {field: {old: x, new: y}}
  metadata jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create age_up_out_results table (for Sedera Age Up/Out reporting)
CREATE TABLE IF NOT EXISTS public.age_up_out_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.vendor_eligibility_runs(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  -- Member info at time of run (cached)
  member_name text NOT NULL,
  member_email text,
  member_dob date NOT NULL,
  current_age integer NOT NULL,
  -- Status
  status text NOT NULL CHECK (status IN ('aging_up', 'aging_out', 'age_limit_reached', 'ok')),
  event_type text NOT NULL CHECK (event_type IN ('age_up', 'age_out', 'dependent_age_out', 'primary_age_out')),
  event_date date NOT NULL, -- When the age event occurs/occurred
  days_until_event integer, -- Negative if past
  -- Plan info
  plan_name text,
  current_tier text,
  new_tier text, -- For age-up events
  -- Action taken
  action_required boolean NOT NULL DEFAULT true,
  action_taken text,
  action_date timestamptz,
  action_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendor_credentials_org ON public.vendor_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_credentials_vendor ON public.vendor_credentials(vendor_code);
CREATE INDEX IF NOT EXISTS idx_vendor_credentials_active ON public.vendor_credentials(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_vendor_job_configs_org ON public.vendor_job_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_job_configs_vendor ON public.vendor_job_configs(vendor_code);
CREATE INDEX IF NOT EXISTS idx_vendor_job_configs_type ON public.vendor_job_configs(job_type);

CREATE INDEX IF NOT EXISTS idx_vendor_eligibility_runs_org ON public.vendor_eligibility_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_eligibility_runs_vendor ON public.vendor_eligibility_runs(vendor_code);
CREATE INDEX IF NOT EXISTS idx_vendor_eligibility_runs_status ON public.vendor_eligibility_runs(status);
CREATE INDEX IF NOT EXISTS idx_vendor_eligibility_runs_created ON public.vendor_eligibility_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_log_org ON public.ops_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_event ON public.ops_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_entity ON public.ops_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_vendor ON public.ops_audit_log(vendor_code) WHERE vendor_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_created ON public.ops_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_age_up_out_results_org ON public.age_up_out_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_age_up_out_results_run ON public.age_up_out_results(run_id);
CREATE INDEX IF NOT EXISTS idx_age_up_out_results_member ON public.age_up_out_results(member_id);
CREATE INDEX IF NOT EXISTS idx_age_up_out_results_status ON public.age_up_out_results(status);
CREATE INDEX IF NOT EXISTS idx_age_up_out_results_event_date ON public.age_up_out_results(event_date);

-- Enable RLS
ALTER TABLE public.vendor_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_job_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_eligibility_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_up_out_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_credentials (VERY restricted - admin only, no credential data exposed)
CREATE POLICY "Admins can view credential metadata"
  ON public.vendor_credentials FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can manage credentials"
  ON public.vendor_credentials FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for vendor_job_configs
CREATE POLICY "Users can view vendor job configs"
  ON public.vendor_job_configs FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage vendor job configs"
  ON public.vendor_job_configs FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for vendor_eligibility_runs
CREATE POLICY "Users can view eligibility runs"
  ON public.vendor_eligibility_runs FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create eligibility runs"
  ON public.vendor_eligibility_runs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

CREATE POLICY "Admins can update eligibility runs"
  ON public.vendor_eligibility_runs FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for ops_audit_log (read-only for users, insert by system)
CREATE POLICY "Users can view ops audit logs"
  ON public.ops_audit_log FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert audit logs"
  ON public.ops_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for age_up_out_results
CREATE POLICY "Users can view age up/out results"
  ON public.age_up_out_results FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage age up/out results"
  ON public.age_up_out_results FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_vendor_credentials_updated_at ON public.vendor_credentials;
CREATE TRIGGER update_vendor_credentials_updated_at
  BEFORE UPDATE ON public.vendor_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendor_job_configs_updated_at ON public.vendor_job_configs;
CREATE TRIGGER update_vendor_job_configs_updated_at
  BEFORE UPDATE ON public.vendor_job_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_age_up_out_results_updated_at ON public.age_up_out_results;
CREATE TRIGGER update_age_up_out_results_updated_at
  BEFORE UPDATE ON public.age_up_out_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add vendor eligibility job type to job_definitions
DO $$
BEGIN
  ALTER TABLE public.job_definitions
    DROP CONSTRAINT IF EXISTS job_definitions_job_type_check;

  ALTER TABLE public.job_definitions
    ADD CONSTRAINT job_definitions_job_type_check
    CHECK (job_type IN (
      'eligibility_check',
      'billing_run',
      'commission_calculation',
      'nacha_export',
      'nacha_import',
      'member_import',
      'agent_import',
      'report_generation',
      'data_sync',
      'cleanup',
      'custom',
      'vendor_eligibility',
      'vendor_enrollment_sync',
      'vendor_termination_sync',
      'vendor_roster_pull',
      'age_up_out_check'
    ));
END $$;

-- Add vendor_code to job_definitions and job_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_definitions' AND column_name = 'vendor_code'
  ) THEN
    ALTER TABLE public.job_definitions ADD COLUMN vendor_code text;
    CREATE INDEX IF NOT EXISTS idx_job_definitions_vendor ON public.job_definitions(vendor_code) WHERE vendor_code IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_runs' AND column_name = 'vendor_code'
  ) THEN
    ALTER TABLE public.job_runs ADD COLUMN vendor_code text;
    CREATE INDEX IF NOT EXISTS idx_job_runs_vendor ON public.job_runs(vendor_code) WHERE vendor_code IS NOT NULL;
  END IF;
END $$;

-- Add retry tracking to job_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_runs' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE public.job_runs ADD COLUMN retry_count integer DEFAULT 0;
    ALTER TABLE public.job_runs ADD COLUMN retried_from_id uuid REFERENCES public.job_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Insert ops permissions
INSERT INTO public.permissions (code, name, description, category, parent_code)
VALUES
  ('ops', 'Ops', 'Operations access', 'ops', NULL),
  ('ops.read', 'Read Ops', 'View operations dashboard, jobs, and logs', 'ops', 'ops'),
  ('ops.run_jobs', 'Run Jobs', 'Manually trigger job runs and retries', 'ops', 'ops.read'),
  ('ops.admin', 'Ops Admin', 'Full ops access including credential management', 'ops', 'ops.run_jobs')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    parent_code = EXCLUDED.parent_code;

-- Function to log ops audit events
CREATE OR REPLACE FUNCTION public.log_ops_audit(
  p_org_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_vendor_code text DEFAULT NULL,
  p_changes jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_actor_profile record;
  v_audit_id uuid;
BEGIN
  SELECT id, full_name, email INTO v_actor_profile
  FROM public.profiles
  WHERE user_id = auth.uid();

  INSERT INTO public.ops_audit_log (
    organization_id,
    event_type,
    entity_type,
    entity_id,
    vendor_code,
    actor_id,
    actor_name,
    actor_email,
    changes,
    metadata
  ) VALUES (
    p_org_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_vendor_code,
    v_actor_profile.id,
    v_actor_profile.full_name,
    v_actor_profile.email,
    p_changes,
    p_metadata
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get vendor eligibility summary
CREATE OR REPLACE FUNCTION public.get_vendor_eligibility_summary(p_org_id uuid, p_vendor_code text DEFAULT NULL)
RETURNS TABLE (
  vendor_code text,
  total_runs bigint,
  successful_runs bigint,
  failed_runs bigint,
  last_run_at timestamptz,
  last_success_at timestamptz,
  avg_duration_ms numeric,
  total_members_checked bigint,
  total_eligible bigint,
  total_ineligible bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ver.vendor_code,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE ver.status = 'completed') as successful_runs,
    COUNT(*) FILTER (WHERE ver.status = 'failed') as failed_runs,
    MAX(ver.created_at) as last_run_at,
    MAX(ver.created_at) FILTER (WHERE ver.status = 'completed') as last_success_at,
    AVG(ver.duration_ms)::numeric as avg_duration_ms,
    COALESCE(SUM(ver.members_checked), 0) as total_members_checked,
    COALESCE(SUM(ver.members_eligible), 0) as total_eligible,
    COALESCE(SUM(ver.members_ineligible), 0) as total_ineligible
  FROM public.vendor_eligibility_runs ver
  WHERE ver.organization_id = p_org_id
    AND (p_vendor_code IS NULL OR ver.vendor_code = p_vendor_code)
  GROUP BY ver.vendor_code
  ORDER BY ver.vendor_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get age up/out summary
CREATE OR REPLACE FUNCTION public.get_age_up_out_summary(p_org_id uuid, p_days_ahead integer DEFAULT 90)
RETURNS TABLE (
  status text,
  event_type text,
  count bigint,
  earliest_event_date date,
  latest_event_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    auo.status,
    auo.event_type,
    COUNT(*) as count,
    MIN(auo.event_date) as earliest_event_date,
    MAX(auo.event_date) as latest_event_date
  FROM public.age_up_out_results auo
  WHERE auo.organization_id = p_org_id
    AND auo.event_date <= (CURRENT_DATE + p_days_ahead)
    AND auo.action_required = true
  GROUP BY auo.status, auo.event_type
  ORDER BY auo.status, auo.event_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-log job run events
CREATE OR REPLACE FUNCTION public.trigger_job_run_audit()
RETURNS trigger AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'job_run_started';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      CASE NEW.status
        WHEN 'completed' THEN v_event_type := 'job_run_completed';
        WHEN 'failed' THEN v_event_type := 'job_run_failed';
        WHEN 'cancelled' THEN v_event_type := 'job_run_cancelled';
        ELSE v_event_type := NULL;
      END CASE;
    END IF;
  END IF;

  IF v_event_type IS NOT NULL THEN
    INSERT INTO public.ops_audit_log (
      organization_id,
      event_type,
      entity_type,
      entity_id,
      vendor_code,
      actor_id,
      metadata
    ) VALUES (
      COALESCE(NEW.organization_id, OLD.organization_id),
      v_event_type,
      'job_run',
      COALESCE(NEW.id, OLD.id),
      NEW.vendor_code,
      NEW.triggered_by,
      jsonb_build_object(
        'job_type', NEW.job_type,
        'job_name', NEW.job_name,
        'status', NEW.status,
        'trigger_type', NEW.trigger_type,
        'duration_ms', NEW.duration_ms,
        'records_processed', NEW.records_processed
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_job_run_audit_insert ON public.job_runs;
CREATE TRIGGER trigger_job_run_audit_insert
  AFTER INSERT ON public.job_runs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_job_run_audit();

DROP TRIGGER IF EXISTS trigger_job_run_audit_update ON public.job_runs;
CREATE TRIGGER trigger_job_run_audit_update
  AFTER UPDATE ON public.job_runs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_job_run_audit();

-- Trigger to auto-log job definition changes
CREATE OR REPLACE FUNCTION public.trigger_job_definition_audit()
RETURNS trigger AS $$
DECLARE
  v_event_type text;
  v_changes jsonb := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := 'schedule_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_active != NEW.is_active THEN
      v_event_type := CASE WHEN NEW.is_active THEN 'schedule_activated' ELSE 'schedule_paused' END;
    ELSE
      v_event_type := 'schedule_updated';
      IF OLD.schedule_cron IS DISTINCT FROM NEW.schedule_cron THEN
        v_changes := v_changes || jsonb_build_object('schedule_cron', jsonb_build_object('old', OLD.schedule_cron, 'new', NEW.schedule_cron));
      END IF;
      IF OLD.name != NEW.name THEN
        v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'schedule_deleted';
  END IF;

  INSERT INTO public.ops_audit_log (
    organization_id,
    event_type,
    entity_type,
    entity_id,
    vendor_code,
    changes,
    metadata
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    v_event_type,
    'job_definition',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.vendor_code, OLD.vendor_code),
    NULLIF(v_changes, '{}'),
    jsonb_build_object(
      'name', COALESCE(NEW.name, OLD.name),
      'job_type', COALESCE(NEW.job_type, OLD.job_type),
      'is_active', COALESCE(NEW.is_active, OLD.is_active)
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_job_definition_audit_insert ON public.job_definitions;
CREATE TRIGGER trigger_job_definition_audit_insert
  AFTER INSERT ON public.job_definitions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_job_definition_audit();

DROP TRIGGER IF EXISTS trigger_job_definition_audit_update ON public.job_definitions;
CREATE TRIGGER trigger_job_definition_audit_update
  AFTER UPDATE ON public.job_definitions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_job_definition_audit();

DROP TRIGGER IF EXISTS trigger_job_definition_audit_delete ON public.job_definitions;
CREATE TRIGGER trigger_job_definition_audit_delete
  AFTER DELETE ON public.job_definitions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_job_definition_audit();
