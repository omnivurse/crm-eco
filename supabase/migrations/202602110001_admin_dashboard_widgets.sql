/*
  Admin Dashboard Widgets Schema

  1. job_definitions - Configurable scheduled jobs
  2. job_runs - History of job executions
  3. recent_page_visits - Track admin page visits for "Recently Visited"

  Uses existing `tasks` table for ToDo functionality
*/

-- Create job_definitions table
CREATE TABLE IF NOT EXISTS public.job_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  job_type text NOT NULL CHECK (job_type IN (
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
    'custom'
  )),
  schedule_cron text, -- Cron expression for scheduled jobs
  schedule_timezone text DEFAULT 'America/New_York',
  is_active boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}', -- Job-specific configuration
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create job_runs table
CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_definition_id uuid REFERENCES public.job_definitions(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  result jsonb, -- Success result data
  error_message text,
  error_details jsonb,
  records_processed integer DEFAULT 0,
  records_succeeded integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  logs jsonb DEFAULT '[]', -- Array of log entries
  triggered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'webhook', 'system')) DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create recent_page_visits table
CREATE TABLE IF NOT EXISTS public.recent_page_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_path text NOT NULL,
  page_title text,
  page_icon text, -- Lucide icon name
  entity_type text, -- member, agent, product, etc.
  entity_id uuid,
  entity_name text, -- Cached name for display
  visited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, page_path) -- Only keep latest visit per path per user
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_definitions_org ON public.job_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_definitions_type ON public.job_definitions(job_type);
CREATE INDEX IF NOT EXISTS idx_job_definitions_active ON public.job_definitions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_definitions_next_run ON public.job_definitions(next_run_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_job_runs_org ON public.job_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_definition ON public.job_runs(job_definition_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON public.job_runs(status);
CREATE INDEX IF NOT EXISTS idx_job_runs_type ON public.job_runs(job_type);
CREATE INDEX IF NOT EXISTS idx_job_runs_created ON public.job_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recent_page_visits_profile ON public.recent_page_visits(profile_id);
CREATE INDEX IF NOT EXISTS idx_recent_page_visits_org ON public.recent_page_visits(organization_id);
CREATE INDEX IF NOT EXISTS idx_recent_page_visits_visited ON public.recent_page_visits(visited_at DESC);

-- Enable RLS
ALTER TABLE public.job_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_page_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_definitions
CREATE POLICY "Users can read job definitions in their org"
  ON public.job_definitions FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage job definitions"
  ON public.job_definitions FOR ALL TO authenticated
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

-- RLS Policies for job_runs
CREATE POLICY "Users can read job runs in their org"
  ON public.job_runs FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create job runs"
  ON public.job_runs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

CREATE POLICY "Admins can update job runs"
  ON public.job_runs FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for recent_page_visits
CREATE POLICY "Users can read their own page visits"
  ON public.recent_page_visits FOR SELECT TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own page visits"
  ON public.recent_page_visits FOR ALL TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_job_definitions_updated_at ON public.job_definitions;
CREATE TRIGGER update_job_definitions_updated_at
  BEFORE UPDATE ON public.job_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up old page visits (keep only last 20 per user)
CREATE OR REPLACE FUNCTION public.cleanup_recent_page_visits()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.recent_page_visits
  WHERE profile_id = NEW.profile_id
    AND id NOT IN (
      SELECT id FROM public.recent_page_visits
      WHERE profile_id = NEW.profile_id
      ORDER BY visited_at DESC
      LIMIT 20
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS cleanup_recent_page_visits_trigger ON public.recent_page_visits;
CREATE TRIGGER cleanup_recent_page_visits_trigger
  AFTER INSERT ON public.recent_page_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_recent_page_visits();

-- Add organization_id to tasks table if not present (for admin filtering)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'tasks'
    AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.tasks
    ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_tasks_organization ON public.tasks(organization_id);
  END IF;
END $$;
