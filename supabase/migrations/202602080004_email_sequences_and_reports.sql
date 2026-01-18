-- ============================================================================
-- Phase 3: Email Sequences, Workflows & Reports
-- ============================================================================

-- ============================================================================
-- SECTION 1: Email Sequences (Drip Campaigns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  trigger_type text CHECK (trigger_type IN ('manual', 'on_create', 'on_stage_change', 'on_tag_add', 'on_field_change')),
  trigger_config jsonb DEFAULT '{}'::jsonb,
  exit_conditions jsonb DEFAULT '[]'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  total_enrolled int DEFAULT 0,
  total_completed int DEFAULT 0,
  total_exited int DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_sequences_org ON email_sequences(org_id);
CREATE INDEX idx_email_sequences_status ON email_sequences(org_id, status);

COMMENT ON TABLE email_sequences IS 'Multi-step automated email sequences (drip campaigns)';
COMMENT ON COLUMN email_sequences.trigger_type IS 'What triggers enrollment: manual, on_create, on_stage_change, on_tag_add, on_field_change';
COMMENT ON COLUMN email_sequences.trigger_config IS 'Configuration for trigger: {module_id, stage, tag, field, value}';
COMMENT ON COLUMN email_sequences.exit_conditions IS 'Array of conditions that exit enrollment: [{type, config}]';

-- ============================================================================
-- Sequence Steps
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  step_type text NOT NULL CHECK (step_type IN ('email', 'wait', 'condition', 'action')),
  name text,
  -- Timing
  delay_days int DEFAULT 0,
  delay_hours int DEFAULT 0,
  delay_minutes int DEFAULT 0,
  send_time text, -- e.g., "09:00" for specific send time
  send_days jsonb DEFAULT '[]'::jsonb, -- e.g., ["mon", "tue", "wed", "thu", "fri"]
  -- Email content
  template_id uuid REFERENCES crm_message_templates(id) ON DELETE SET NULL,
  subject text,
  body_html text,
  body_text text,
  from_name text,
  from_email text,
  -- Condition/Action config
  condition_config jsonb, -- {field, operator, value, then_step_id, else_step_id}
  action_config jsonb, -- {action_type, params}
  -- A/B testing
  is_ab_test boolean DEFAULT false,
  ab_variants jsonb DEFAULT '[]'::jsonb,
  -- Stats
  sent_count int DEFAULT 0,
  open_count int DEFAULT 0,
  click_count int DEFAULT 0,
  reply_count int DEFAULT 0,
  bounce_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sequence_steps_sequence ON email_sequence_steps(sequence_id, step_order);

COMMENT ON TABLE email_sequence_steps IS 'Individual steps within a sequence';
COMMENT ON COLUMN email_sequence_steps.step_type IS 'email=send email, wait=delay, condition=if/then, action=update field/tag';
COMMENT ON COLUMN email_sequence_steps.condition_config IS 'For conditions: {field, operator, value, then_step_id, else_step_id}';
COMMENT ON COLUMN email_sequence_steps.action_config IS 'For actions: {type: "update_field"|"add_tag"|"remove_tag", params: {...}}';

-- ============================================================================
-- Sequence Enrollments
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  email text NOT NULL,
  current_step_id uuid REFERENCES email_sequence_steps(id) ON DELETE SET NULL,
  current_step_order int DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'exited', 'bounced', 'unsubscribed')),
  enrolled_at timestamptz DEFAULT now(),
  enrolled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_step_at timestamptz,
  next_step_at timestamptz,
  completed_at timestamptz,
  exit_reason text,
  exited_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(sequence_id, record_id)
);

CREATE INDEX idx_sequence_enrollments_sequence ON email_sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_enrollments_status ON email_sequence_enrollments(sequence_id, status);
CREATE INDEX idx_sequence_enrollments_next ON email_sequence_enrollments(next_step_at) WHERE status = 'active';
CREATE INDEX idx_sequence_enrollments_record ON email_sequence_enrollments(record_id);

COMMENT ON TABLE email_sequence_enrollments IS 'Records enrolled in sequences with their progress';

-- ============================================================================
-- Sequence Step Executions (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_sequence_step_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES email_sequence_enrollments(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES email_sequence_steps(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'skipped')),
  executed_at timestamptz DEFAULT now(),
  provider_message_id text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_step_executions_enrollment ON email_sequence_step_executions(enrollment_id);
CREATE INDEX idx_step_executions_step ON email_sequence_step_executions(step_id);

-- ============================================================================
-- SECTION 2: Custom Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  module_id uuid REFERENCES crm_modules(id) ON DELETE SET NULL,
  report_type text DEFAULT 'tabular' CHECK (report_type IN ('tabular', 'summary', 'matrix', 'chart')),
  -- Configuration
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb DEFAULT '[]'::jsonb,
  grouping jsonb DEFAULT '[]'::jsonb,
  aggregations jsonb DEFAULT '[]'::jsonb,
  sorting jsonb DEFAULT '[]'::jsonb,
  -- Visualization
  chart_type text CHECK (chart_type IN ('none', 'bar', 'line', 'pie', 'donut', 'funnel', 'area')),
  chart_config jsonb DEFAULT '{}'::jsonb,
  -- Sharing
  is_shared boolean DEFAULT false,
  shared_with jsonb DEFAULT '[]'::jsonb,
  is_favorite boolean DEFAULT false,
  -- Metadata
  last_run_at timestamptz,
  run_count int DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_reports_org ON crm_reports(org_id);
CREATE INDEX idx_crm_reports_module ON crm_reports(module_id);
CREATE INDEX idx_crm_reports_created_by ON crm_reports(created_by);

COMMENT ON TABLE crm_reports IS 'Custom reports with grouping, aggregations, and charts';
COMMENT ON COLUMN crm_reports.columns IS 'Fields to include: [{field, label, width}]';
COMMENT ON COLUMN crm_reports.grouping IS 'Grouping config: [{field, order}]';
COMMENT ON COLUMN crm_reports.aggregations IS 'Aggregation config: [{field, function}] where function is count/sum/avg/min/max';

-- ============================================================================
-- Scheduled Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES crm_reports(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week int CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
  day_of_month int CHECK (day_of_month >= 1 AND day_of_month <= 31),
  time_of_day time DEFAULT '09:00',
  timezone text DEFAULT 'UTC',
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  format text DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'xlsx')),
  last_sent_at timestamptz,
  next_send_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_scheduled_reports_next ON crm_scheduled_reports(next_send_at) WHERE is_active = true;

-- ============================================================================
-- SECTION 3: Activity Calendar
-- ============================================================================

-- Activities table (if not exists - extends crm_activities)
-- Adding calendar-specific fields

ALTER TABLE crm_activities
ADD COLUMN IF NOT EXISTS all_day boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_rule text,
ADD COLUMN IF NOT EXISTS recurrence_end_date date,
ADD COLUMN IF NOT EXISTS reminder_minutes int,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS meeting_link text,
ADD COLUMN IF NOT EXISTS color text;

CREATE INDEX IF NOT EXISTS idx_activities_calendar
ON crm_activities(org_id, due_date, activity_type)
WHERE due_date IS NOT NULL;

-- ============================================================================
-- SECTION 4: Recent Views Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS crm_recent_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  module_id uuid REFERENCES crm_modules(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now(),
  view_count int DEFAULT 1,
  UNIQUE(user_id, record_id)
);

CREATE INDEX idx_recent_views_user ON crm_recent_views(user_id, viewed_at DESC);
CREATE INDEX idx_recent_views_record ON crm_recent_views(record_id);

-- Function to upsert recent view
CREATE OR REPLACE FUNCTION upsert_recent_view(
  p_org_id uuid,
  p_user_id uuid,
  p_record_id uuid,
  p_module_id uuid
) RETURNS void AS $$
BEGIN
  INSERT INTO crm_recent_views (org_id, user_id, record_id, module_id, viewed_at, view_count)
  VALUES (p_org_id, p_user_id, p_record_id, p_module_id, now(), 1)
  ON CONFLICT (user_id, record_id)
  DO UPDATE SET
    viewed_at = now(),
    view_count = crm_recent_views.view_count + 1;

  -- Keep only last 100 records per user
  DELETE FROM crm_recent_views
  WHERE user_id = p_user_id
  AND id NOT IN (
    SELECT id FROM crm_recent_views
    WHERE user_id = p_user_id
    ORDER BY viewed_at DESC
    LIMIT 100
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_recent_views ENABLE ROW LEVEL SECURITY;

-- Sequences policies
CREATE POLICY "Users can view their org sequences"
ON email_sequences FOR SELECT
USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their org sequences"
ON email_sequences FOR ALL
USING (org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

-- Steps policies (inherit from sequence)
CREATE POLICY "Users can view sequence steps"
ON email_sequence_steps FOR SELECT
USING (sequence_id IN (
  SELECT id FROM email_sequences
  WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can manage sequence steps"
ON email_sequence_steps FOR ALL
USING (sequence_id IN (
  SELECT id FROM email_sequences
  WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
));

-- Enrollments policies
CREATE POLICY "Users can view their org enrollments"
ON email_sequence_enrollments FOR SELECT
USING (sequence_id IN (
  SELECT id FROM email_sequences
  WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can manage their org enrollments"
ON email_sequence_enrollments FOR ALL
USING (sequence_id IN (
  SELECT id FROM email_sequences
  WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
));

-- Reports policies
CREATE POLICY "Users can view their org reports"
ON crm_reports FOR SELECT
USING (
  org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  OR is_shared = true
);

CREATE POLICY "Users can manage their own reports"
ON crm_reports FOR ALL
USING (
  org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
);

-- Scheduled reports policies
CREATE POLICY "Users can view scheduled reports"
ON crm_scheduled_reports FOR SELECT
USING (report_id IN (
  SELECT id FROM crm_reports
  WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can manage scheduled reports"
ON crm_scheduled_reports FOR ALL
USING (report_id IN (
  SELECT id FROM crm_reports
  WHERE org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
));

-- Recent views policies
CREATE POLICY "Users can view their own recent views"
ON crm_recent_views FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own recent views"
ON crm_recent_views FOR ALL
USING (user_id = auth.uid());

-- Step executions policies
CREATE POLICY "Users can view step executions"
ON email_sequence_step_executions FOR SELECT
USING (enrollment_id IN (
  SELECT e.id FROM email_sequence_enrollments e
  JOIN email_sequences s ON e.sequence_id = s.id
  WHERE s.org_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
));
