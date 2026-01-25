/*
  # SLA Metrics Tracking System

  1. New Tables
    - `sla_metrics`
      - Tracks SLA compliance for tickets with first response and resolution times
      - Links to tickets table for comprehensive tracking
      - Calculates breach status based on 4-hour response / 24-hour resolution targets
  
  2. Features
    - Automatic SLA calculation triggers on ticket status changes
    - First response tracking (4-hour target)
    - Resolution time tracking (24-hour target)
    - Breach detection and logging
    - Historical SLA performance data
    - Agent-specific SLA metrics
  
  3. Security
    - RLS policies for role-based access
    - Staff and above can view metrics
    - Automatic trigger updates ensure data integrity
*/

-- Create SLA metrics table
CREATE TABLE IF NOT EXISTS public.sla_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  
  -- First Response SLA (4-hour target)
  first_response_target_minutes integer DEFAULT 240, -- 4 hours
  first_response_at timestamptz,
  first_response_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_response_duration_minutes integer,
  first_response_met boolean,
  first_response_breach_minutes integer DEFAULT 0,
  
  -- Resolution SLA (24-hour target)
  resolution_target_minutes integer DEFAULT 1440, -- 24 hours
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_duration_minutes integer,
  resolution_met boolean,
  resolution_breach_minutes integer DEFAULT 0,
  
  -- Overall SLA status
  sla_status text DEFAULT 'pending', -- 'pending', 'met', 'breached', 'at_risk'
  overall_breach boolean DEFAULT false,
  
  -- Metadata
  ticket_priority text,
  ticket_category text,
  assigned_agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  ticket_created_at timestamptz NOT NULL,
  last_calculated_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(ticket_id)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sla_metrics_ticket_id ON public.sla_metrics(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_first_response_met ON public.sla_metrics(first_response_met);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_resolution_met ON public.sla_metrics(resolution_met);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_sla_status ON public.sla_metrics(sla_status);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_overall_breach ON public.sla_metrics(overall_breach);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_assigned_agent ON public.sla_metrics(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sla_metrics_ticket_priority ON public.sla_metrics(ticket_priority);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_ticket_created ON public.sla_metrics(ticket_created_at DESC);

-- Enable RLS
ALTER TABLE public.sla_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Staff and above can view metrics
CREATE POLICY "sla_metrics_view_all"
  ON public.sla_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- Only system can insert/update (via triggers)
CREATE POLICY "sla_metrics_system_insert"
  ON public.sla_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "sla_metrics_system_update"
  ON public.sla_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Function to calculate SLA metrics
CREATE OR REPLACE FUNCTION public.calculate_sla_metrics(p_ticket_id uuid)
RETURNS void AS $$
DECLARE
  v_ticket record;
  v_first_response_at timestamptz;
  v_first_response_by uuid;
  v_first_response_minutes integer;
  v_first_response_met boolean;
  v_first_response_breach integer;
  v_resolved_at timestamptz;
  v_resolved_by uuid;
  v_resolution_minutes integer;
  v_resolution_met boolean;
  v_resolution_breach integer;
  v_sla_status text;
  v_overall_breach boolean;
BEGIN
  -- Get ticket details
  SELECT t.*, t.created_at, t.status, t.priority, t.category, t.assignee_id
  INTO v_ticket
  FROM public.tickets t
  WHERE t.id = p_ticket_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate first response metrics
  -- First response is the first comment by staff/agent on the ticket
  SELECT c.created_at, c.author_id
  INTO v_first_response_at, v_first_response_by
  FROM public.ticket_comments c
  JOIN public.profiles p ON c.author_id = p.id
  WHERE c.ticket_id = p_ticket_id
  AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
  ORDER BY c.created_at ASC
  LIMIT 1;
  
  IF v_first_response_at IS NOT NULL THEN
    v_first_response_minutes := EXTRACT(EPOCH FROM (v_first_response_at - v_ticket.created_at)) / 60;
    v_first_response_met := v_first_response_minutes <= 240; -- 4 hours
    v_first_response_breach := GREATEST(0, v_first_response_minutes - 240);
  END IF;
  
  -- Calculate resolution metrics
  IF v_ticket.status IN ('resolved', 'closed') THEN
    v_resolved_at := v_ticket.updated_at;
    v_resolved_by := v_ticket.assignee_id;
    v_resolution_minutes := EXTRACT(EPOCH FROM (v_resolved_at - v_ticket.created_at)) / 60;
    v_resolution_met := v_resolution_minutes <= 1440; -- 24 hours
    v_resolution_breach := GREATEST(0, v_resolution_minutes - 1440);
  END IF;
  
  -- Determine overall SLA status
  v_overall_breach := COALESCE(NOT v_first_response_met, false) OR COALESCE(NOT v_resolution_met, false);
  
  IF v_ticket.status IN ('resolved', 'closed') THEN
    IF v_overall_breach THEN
      v_sla_status := 'breached';
    ELSE
      v_sla_status := 'met';
    END IF;
  ELSE
    -- Check if ticket is at risk of breaching
    IF v_first_response_at IS NULL THEN
      IF EXTRACT(EPOCH FROM (now() - v_ticket.created_at)) / 60 > 180 THEN -- 3 hours (75% of target)
        v_sla_status := 'at_risk';
      ELSE
        v_sla_status := 'pending';
      END IF;
    ELSE
      IF EXTRACT(EPOCH FROM (now() - v_ticket.created_at)) / 60 > 1080 THEN -- 18 hours (75% of target)
        v_sla_status := 'at_risk';
      ELSE
        v_sla_status := 'pending';
      END IF;
    END IF;
  END IF;
  
  -- Insert or update SLA metrics
  INSERT INTO public.sla_metrics (
    ticket_id,
    first_response_at,
    first_response_by,
    first_response_duration_minutes,
    first_response_met,
    first_response_breach_minutes,
    resolved_at,
    resolved_by,
    resolution_duration_minutes,
    resolution_met,
    resolution_breach_minutes,
    sla_status,
    overall_breach,
    ticket_priority,
    ticket_category,
    assigned_agent_id,
    ticket_created_at,
    last_calculated_at
  ) VALUES (
    p_ticket_id,
    v_first_response_at,
    v_first_response_by,
    v_first_response_minutes,
    v_first_response_met,
    v_first_response_breach,
    v_resolved_at,
    v_resolved_by,
    v_resolution_minutes,
    v_resolution_met,
    v_resolution_breach,
    v_sla_status,
    v_overall_breach,
    v_ticket.priority,
    v_ticket.category,
    v_ticket.assignee_id,
    v_ticket.created_at,
    now()
  )
  ON CONFLICT (ticket_id) DO UPDATE SET
    first_response_at = EXCLUDED.first_response_at,
    first_response_by = EXCLUDED.first_response_by,
    first_response_duration_minutes = EXCLUDED.first_response_duration_minutes,
    first_response_met = EXCLUDED.first_response_met,
    first_response_breach_minutes = EXCLUDED.first_response_breach_minutes,
    resolved_at = EXCLUDED.resolved_at,
    resolved_by = EXCLUDED.resolved_by,
    resolution_duration_minutes = EXCLUDED.resolution_duration_minutes,
    resolution_met = EXCLUDED.resolution_met,
    resolution_breach_minutes = EXCLUDED.resolution_breach_minutes,
    sla_status = EXCLUDED.sla_status,
    overall_breach = EXCLUDED.overall_breach,
    ticket_priority = EXCLUDED.ticket_priority,
    ticket_category = EXCLUDED.ticket_category,
    assigned_agent_id = EXCLUDED.assigned_agent_id,
    last_calculated_at = now(),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to calculate SLA on ticket changes
CREATE OR REPLACE FUNCTION public.trigger_calculate_sla_metrics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.calculate_sla_metrics(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tickets_sla_update ON public.tickets;
CREATE TRIGGER trg_tickets_sla_update
AFTER INSERT OR UPDATE OF status, assignee_id ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_sla_metrics();

-- Trigger to calculate SLA on first comment (first response)
CREATE OR REPLACE FUNCTION public.trigger_calculate_sla_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.calculate_sla_metrics(NEW.ticket_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ticket_comments_sla_update ON public.ticket_comments;
CREATE TRIGGER trg_ticket_comments_sla_update
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_sla_on_comment();

-- Function to get SLA compliance percentage
CREATE OR REPLACE FUNCTION public.get_sla_compliance_percentage(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_tickets bigint,
  first_response_met bigint,
  first_response_percentage numeric,
  resolution_met bigint,
  resolution_percentage numeric,
  overall_met bigint,
  overall_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_tickets,
    COUNT(*) FILTER (WHERE sm.first_response_met = true)::bigint AS first_response_met,
    ROUND(COUNT(*) FILTER (WHERE sm.first_response_met = true)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 2) AS first_response_percentage,
    COUNT(*) FILTER (WHERE sm.resolution_met = true)::bigint AS resolution_met,
    ROUND(COUNT(*) FILTER (WHERE sm.resolution_met = true)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 2) AS resolution_percentage,
    COUNT(*) FILTER (WHERE sm.overall_breach = false AND sm.sla_status = 'met')::bigint AS overall_met,
    ROUND(COUNT(*) FILTER (WHERE sm.overall_breach = false AND sm.sla_status = 'met')::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 2) AS overall_percentage
  FROM public.sla_metrics sm
  WHERE (p_start_date IS NULL OR sm.ticket_created_at >= p_start_date)
    AND (p_end_date IS NULL OR sm.ticket_created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get agent SLA performance
CREATE OR REPLACE FUNCTION public.get_agent_sla_performance(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  agent_email text,
  total_tickets bigint,
  first_response_met bigint,
  first_response_percentage numeric,
  resolution_met bigint,
  resolution_percentage numeric,
  avg_first_response_minutes numeric,
  avg_resolution_minutes numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS agent_id,
    COALESCE(p.full_name, p.email) AS agent_name,
    p.email AS agent_email,
    COUNT(sm.id)::bigint AS total_tickets,
    COUNT(*) FILTER (WHERE sm.first_response_met = true)::bigint AS first_response_met,
    ROUND(COUNT(*) FILTER (WHERE sm.first_response_met = true)::numeric / NULLIF(COUNT(sm.id)::numeric, 0) * 100, 2) AS first_response_percentage,
    COUNT(*) FILTER (WHERE sm.resolution_met = true)::bigint AS resolution_met,
    ROUND(COUNT(*) FILTER (WHERE sm.resolution_met = true)::numeric / NULLIF(COUNT(sm.id)::numeric, 0) * 100, 2) AS resolution_percentage,
    ROUND(AVG(sm.first_response_duration_minutes), 0) AS avg_first_response_minutes,
    ROUND(AVG(sm.resolution_duration_minutes), 0) AS avg_resolution_minutes
  FROM public.profiles p
  LEFT JOIN public.sla_metrics sm ON sm.assigned_agent_id = p.id
    AND (p_start_date IS NULL OR sm.ticket_created_at >= p_start_date)
    AND (p_end_date IS NULL OR sm.ticket_created_at <= p_end_date)
  WHERE p.role IN ('staff', 'agent', 'admin', 'super_admin')
  GROUP BY p.id, p.full_name, p.email
  HAVING COUNT(sm.id) > 0
  ORDER BY resolution_percentage DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing tickets with SLA metrics
DO $$
DECLARE
  ticket_record RECORD;
BEGIN
  FOR ticket_record IN 
    SELECT id FROM public.tickets 
    ORDER BY created_at DESC 
    LIMIT 1000
  LOOP
    PERFORM public.calculate_sla_metrics(ticket_record.id);
  END LOOP;
END $$;

-- Grant permissions
GRANT SELECT ON public.sla_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_sla_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sla_compliance_percentage TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agent_sla_performance TO authenticated;
