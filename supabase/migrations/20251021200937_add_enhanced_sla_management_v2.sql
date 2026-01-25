/*
  # Enhanced SLA Management System
  
  ## Overview
  Enterprise-grade SLA management with customizable policies, escalation matrix,
  business hours calendar, holiday management, and multi-tier notifications.
  
  ## 1. New Tables
  
  ### `sla_policies`
  Customizable SLA policies based on ticket properties
  
  ### `business_hours`
  Business hours configuration by day of week
  
  ### `holidays`
  Holiday calendar for SLA calculation
  
  ### `sla_escalations`
  Escalation rules when SLA thresholds are reached
  
  ### `sla_events`
  Audit trail of SLA events and escalations
*/

-- Create SLA event type enum
DO $$ BEGIN
  CREATE TYPE sla_event_type AS ENUM ('started', 'paused', 'resumed', 'breached', 'escalated', 'met');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sla_policies table
CREATE TABLE IF NOT EXISTS sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  priority integer DEFAULT 100,
  conditions jsonb NOT NULL DEFAULT '{}',
  first_response_minutes integer NOT NULL DEFAULT 60,
  resolution_hours integer NOT NULL DEFAULT 24,
  business_hours_only boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create business_hours table
CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_working_day boolean DEFAULT true,
  start_time time NOT NULL DEFAULT '09:00:00',
  end_time time NOT NULL DEFAULT '17:00:00',
  timezone text DEFAULT 'America/New_York',
  UNIQUE(day_of_week)
);

-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  is_recurring boolean DEFAULT false,
  year integer,
  UNIQUE(date, name)
);

-- Create sla_escalations table
CREATE TABLE IF NOT EXISTS sla_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_policy_id uuid REFERENCES sla_policies(id) ON DELETE CASCADE NOT NULL,
  escalation_level integer NOT NULL,
  threshold_percentage numeric NOT NULL CHECK (threshold_percentage > 0 AND threshold_percentage <= 100),
  notify_roles text[] DEFAULT '{}',
  notify_users uuid[] DEFAULT '{}',
  actions jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  UNIQUE(sla_policy_id, escalation_level)
);

-- Create sla_events table
CREATE TABLE IF NOT EXISTS sla_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  event_type sla_event_type NOT NULL,
  sla_policy_id uuid REFERENCES sla_policies(id) ON DELETE SET NULL,
  escalation_level integer,
  due_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sla_policies_priority ON sla_policies(priority);
CREATE INDEX IF NOT EXISTS idx_sla_policies_active ON sla_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_sla_escalations_policy ON sla_escalations(sla_policy_id);
CREATE INDEX IF NOT EXISTS idx_sla_escalations_level ON sla_escalations(escalation_level);
CREATE INDEX IF NOT EXISTS idx_sla_events_ticket ON sla_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_events_type ON sla_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sla_events_created_at ON sla_events(created_at);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- Enable Row Level Security
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "sla_policies_staff_read" ON sla_policies FOR SELECT USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('staff', 'it', 'admin', 'super_admin'))
);

CREATE POLICY "sla_policies_admin_all" ON sla_policies FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
);

CREATE POLICY "business_hours_staff_read" ON business_hours FOR SELECT USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('staff', 'it', 'admin', 'super_admin'))
);

CREATE POLICY "business_hours_admin_all" ON business_hours FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
);

CREATE POLICY "holidays_public_read" ON holidays FOR SELECT USING (true);

CREATE POLICY "holidays_admin_all" ON holidays FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
);

CREATE POLICY "sla_escalations_staff_read" ON sla_escalations FOR SELECT USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('staff', 'it', 'admin', 'super_admin'))
);

CREATE POLICY "sla_escalations_admin_all" ON sla_escalations FOR ALL USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
);

CREATE POLICY "sla_events_staff_read" ON sla_events FOR SELECT USING (
  EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('staff', 'it', 'admin', 'super_admin'))
);

CREATE POLICY "sla_events_system_insert" ON sla_events FOR INSERT WITH CHECK (true);

-- Insert default business hours
INSERT INTO business_hours (day_of_week, is_working_day, start_time, end_time)
VALUES 
  (0, false, '09:00:00', '17:00:00'),
  (1, true, '09:00:00', '17:00:00'),
  (2, true, '09:00:00', '17:00:00'),
  (3, true, '09:00:00', '17:00:00'),
  (4, true, '09:00:00', '17:00:00'),
  (5, true, '09:00:00', '17:00:00'),
  (6, false, '09:00:00', '17:00:00')
ON CONFLICT (day_of_week) DO NOTHING;

-- Insert default SLA policies
INSERT INTO sla_policies (name, description, priority, conditions, first_response_minutes, resolution_hours)
VALUES 
  ('Urgent Priority SLA', 'Fast response for urgent tickets', 10, '{"priority": ["urgent"]}', 15, 4),
  ('High Priority SLA', 'Standard high priority response', 20, '{"priority": ["high"]}', 30, 8),
  ('Normal Priority SLA', 'Regular business SLA', 30, '{"priority": ["normal", "medium"]}', 120, 24),
  ('Low Priority SLA', 'Extended response time', 40, '{"priority": ["low"]}', 240, 72),
  ('Default SLA', 'Fallback SLA', 100, '{}', 60, 24)
ON CONFLICT DO NOTHING;

-- Insert holidays for 2025
INSERT INTO holidays (name, date, is_recurring, year)
VALUES 
  ('New Year''s Day', '2025-01-01', true, 2025),
  ('Independence Day', '2025-07-04', true, 2025),
  ('Christmas', '2025-12-25', true, 2025)
ON CONFLICT (date, name) DO NOTHING;

-- Function to match ticket to SLA policy
CREATE OR REPLACE FUNCTION match_sla_policy(ticket_data jsonb)
RETURNS uuid AS $$
DECLARE
  matched_policy_id uuid;
BEGIN
  SELECT id INTO matched_policy_id
  FROM sla_policies
  WHERE is_active = true
  AND (
    conditions = '{}'::jsonb
    OR (
      (conditions->>'priority' IS NULL OR ticket_data->>'priority' = ANY(SELECT jsonb_array_elements_text(conditions->'priority')))
    )
  )
  ORDER BY priority ASC
  LIMIT 1;
  
  RETURN matched_policy_id;
END;
$$ LANGUAGE plpgsql;

-- Function to apply SLA policy to ticket
CREATE OR REPLACE FUNCTION apply_sla_to_ticket()
RETURNS TRIGGER AS $$
DECLARE
  policy_id uuid;
  policy_record RECORD;
  calculated_due_at timestamptz;
BEGIN
  IF NEW.sla_due_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  policy_id := match_sla_policy(to_jsonb(NEW));
  
  IF policy_id IS NOT NULL THEN
    SELECT * INTO policy_record FROM sla_policies WHERE id = policy_id;
    
    calculated_due_at := NEW.created_at + (policy_record.resolution_hours || ' hours')::interval;
    
    NEW.sla_due_at := calculated_due_at;
    
    INSERT INTO sla_events (ticket_id, event_type, sla_policy_id, due_at)
    VALUES (NEW.id, 'started', policy_id, calculated_due_at);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to apply SLA on ticket creation
DROP TRIGGER IF EXISTS apply_sla_on_ticket_creation ON tickets;
CREATE TRIGGER apply_sla_on_ticket_creation
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION apply_sla_to_ticket();

-- Create view for SLA compliance dashboard
CREATE OR REPLACE VIEW sla_compliance_dashboard AS
SELECT 
  sp.name as policy_name,
  COUNT(t.id) as total_tickets,
  COUNT(CASE WHEN tm.sla_breached THEN 1 END) as breached_count,
  COUNT(CASE WHEN NOT tm.sla_breached AND t.status IN ('resolved', 'closed') THEN 1 END) as met_count,
  (COUNT(CASE WHEN NOT tm.sla_breached AND t.status IN ('resolved', 'closed') THEN 1 END)::float / 
   NULLIF(COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END), 0) * 100)::numeric(5,2) as compliance_rate
FROM sla_policies sp
LEFT JOIN sla_events se ON se.sla_policy_id = sp.id AND se.event_type = 'started'
LEFT JOIN tickets t ON t.id = se.ticket_id
LEFT JOIN ticket_metrics tm ON tm.ticket_id = t.id
WHERE sp.is_active = true
GROUP BY sp.id, sp.name
ORDER BY sp.priority;
