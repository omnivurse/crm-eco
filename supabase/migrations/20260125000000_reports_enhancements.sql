-- ============================================================================
-- Reports & Analytics Feature Enhancement
-- Migration: 20260125000000_reports_enhancements.sql
-- Description: Add report tracking columns and run history table
-- ============================================================================

-- Add columns to crm_reports for enhanced tracking
ALTER TABLE public.crm_reports
ADD COLUMN IF NOT EXISTS run_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Create index for favorite reports queries
CREATE INDEX IF NOT EXISTS idx_crm_reports_favorite
ON public.crm_reports(organization_id, is_favorite)
WHERE is_favorite = true;

-- Create index for last_run_at queries
CREATE INDEX IF NOT EXISTS idx_crm_reports_last_run
ON public.crm_reports(organization_id, last_run_at DESC);

-- ============================================================================
-- Report Run History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_run_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.crm_reports(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  executed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  executed_at timestamptz DEFAULT now() NOT NULL,
  duration_ms integer,
  row_count integer,
  status text DEFAULT 'completed' NOT NULL,
  error_message text,
  filters_used jsonb DEFAULT '[]'::jsonb,
  export_format text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for report_run_history
CREATE INDEX IF NOT EXISTS idx_report_run_history_report
ON public.report_run_history(report_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_run_history_org
ON public.report_run_history(organization_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_run_history_user
ON public.report_run_history(executed_by, executed_at DESC);

-- ============================================================================
-- Row Level Security for report_run_history
-- ============================================================================

ALTER TABLE public.report_run_history ENABLE ROW LEVEL SECURITY;

-- Users can view their organization's report history
CREATE POLICY "Users can view their org report history"
  ON public.report_run_history
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Users can insert history for their organization
CREATE POLICY "Users can insert report history for their org"
  ON public.report_run_history
  FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Only allow deletion by admins (through service role)
CREATE POLICY "Admins can delete report history"
  ON public.report_run_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'owner')
      AND organization_id = report_run_history.organization_id
    )
  );

-- ============================================================================
-- Function to increment run count and update last_run_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_report_run_count(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_reports
  SET
    run_count = COALESCE(run_count, 0) + 1,
    last_run_at = now()
  WHERE id = p_report_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_report_run_count(uuid) TO authenticated;

-- ============================================================================
-- Function to log report run
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_report_run(
  p_report_id uuid,
  p_org_id uuid,
  p_user_id uuid,
  p_duration_ms integer,
  p_row_count integer,
  p_status text DEFAULT 'completed',
  p_error_message text DEFAULT NULL,
  p_filters_used jsonb DEFAULT '[]'::jsonb,
  p_export_format text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history_id uuid;
BEGIN
  -- Insert history record
  INSERT INTO public.report_run_history (
    report_id,
    organization_id,
    executed_by,
    duration_ms,
    row_count,
    status,
    error_message,
    filters_used,
    export_format
  ) VALUES (
    p_report_id,
    p_org_id,
    p_user_id,
    p_duration_ms,
    p_row_count,
    p_status,
    p_error_message,
    p_filters_used,
    p_export_format
  )
  RETURNING id INTO v_history_id;

  -- Update report run count if successful
  IF p_status = 'completed' THEN
    PERFORM public.increment_report_run_count(p_report_id);
  END IF;

  RETURN v_history_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_report_run(uuid, uuid, uuid, integer, integer, text, text, jsonb, text) TO authenticated;

-- ============================================================================
-- Scheduled Reports Table (for future use)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.crm_reports(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  cron_expression text NOT NULL,
  timezone text DEFAULT 'UTC' NOT NULL,
  export_format text DEFAULT 'csv' NOT NULL,
  recipients jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for report_schedules
CREATE INDEX IF NOT EXISTS idx_report_schedules_report
ON public.report_schedules(report_id);

CREATE INDEX IF NOT EXISTS idx_report_schedules_org
ON public.report_schedules(organization_id, is_active);

CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run
ON public.report_schedules(next_run_at)
WHERE is_active = true;

-- RLS for report_schedules
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org report schedules"
  ON public.report_schedules
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their org report schedules"
  ON public.report_schedules
  FOR ALL
  USING (
    organization_id = (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT organization_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );
