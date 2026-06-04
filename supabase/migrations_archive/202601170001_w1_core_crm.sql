-- ============================================================================
-- W1 Core CRM: Deal Stages, Stage History, Record Links, Activity Types
-- Extends existing crm_records schema for full Zoho-style CRM functionality
-- ============================================================================

-- ============================================================================
-- SECTION 1: DEAL STAGES
-- Configurable pipeline stages per organization
-- ============================================================================
CREATE TABLE crm_deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key text NOT NULL,
  color text DEFAULT '#6366f1',
  probability integer DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, key),
  -- Ensure a stage can't be both won and lost
  CHECK (NOT (is_won AND is_lost))
);

CREATE INDEX idx_crm_deal_stages_org ON crm_deal_stages(org_id);
CREATE INDEX idx_crm_deal_stages_active ON crm_deal_stages(org_id, is_active, display_order);

COMMENT ON TABLE crm_deal_stages IS 'Configurable deal pipeline stages per organization';
COMMENT ON COLUMN crm_deal_stages.probability IS 'Win probability percentage (0-100)';
COMMENT ON COLUMN crm_deal_stages.is_won IS 'True if this is a closed-won stage';
COMMENT ON COLUMN crm_deal_stages.is_lost IS 'True if this is a closed-lost stage';

-- ============================================================================
-- SECTION 2: DEAL STAGE HISTORY
-- Immutable audit trail of stage transitions
-- ============================================================================
CREATE TABLE crm_deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  from_stage_id uuid REFERENCES crm_deal_stages(id) ON DELETE SET NULL,
  to_stage_id uuid REFERENCES crm_deal_stages(id) ON DELETE SET NULL,
  duration_seconds integer,  -- Time spent in previous stage
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reason text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_deal_stage_history_org ON crm_deal_stage_history(org_id);
CREATE INDEX idx_crm_deal_stage_history_record ON crm_deal_stage_history(record_id);
CREATE INDEX idx_crm_deal_stage_history_created ON crm_deal_stage_history(created_at DESC);
CREATE INDEX idx_crm_deal_stage_history_record_chrono ON crm_deal_stage_history(record_id, created_at DESC);

COMMENT ON TABLE crm_deal_stage_history IS 'Immutable audit trail of all deal stage changes';
COMMENT ON COLUMN crm_deal_stage_history.duration_seconds IS 'Time spent in the previous stage before this transition';

-- ============================================================================
-- SECTION 3: RECORD LINKS
-- Polymorphic relationships between records
-- ============================================================================
CREATE TABLE crm_record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  target_record_id uuid NOT NULL REFERENCES crm_records(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  is_primary boolean DEFAULT false,
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  -- Prevent duplicate links of the same type
  UNIQUE(source_record_id, target_record_id, link_type),
  -- Prevent self-links
  CHECK (source_record_id != target_record_id)
);

CREATE INDEX idx_crm_record_links_org ON crm_record_links(org_id);
CREATE INDEX idx_crm_record_links_source ON crm_record_links(source_record_id);
CREATE INDEX idx_crm_record_links_target ON crm_record_links(target_record_id);
CREATE INDEX idx_crm_record_links_type ON crm_record_links(link_type);
CREATE INDEX idx_crm_record_links_primary ON crm_record_links(source_record_id, is_primary) WHERE is_primary = true;

COMMENT ON TABLE crm_record_links IS 'Polymorphic relationships between CRM records';
COMMENT ON COLUMN crm_record_links.link_type IS 'Type of link: contact_to_account, deal_to_contact, deal_to_account, etc.';
COMMENT ON COLUMN crm_record_links.is_primary IS 'True if this is the primary relationship (e.g., primary contact for a deal)';

-- ============================================================================
-- SECTION 4: EXTEND CRM_TASKS WITH ACTIVITY TYPES
-- Add call/meeting specific fields
-- ============================================================================
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS activity_type text 
  DEFAULT 'task' CHECK (activity_type IN ('task', 'call', 'meeting', 'email'));

ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS call_duration integer;  -- seconds
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS call_result text 
  CHECK (call_result IS NULL OR call_result IN ('connected', 'left_voicemail', 'no_answer', 'busy', 'wrong_number'));
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS call_type text
  CHECK (call_type IS NULL OR call_type IN ('outbound', 'inbound'));
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS meeting_location text;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS meeting_type text
  CHECK (meeting_type IS NULL OR meeting_type IN ('in_person', 'video', 'phone'));
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS attendees uuid[];  -- Array of profile IDs
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS reminder_at timestamptz;
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS outcome text;  -- Post-activity notes

CREATE INDEX idx_crm_tasks_activity_type ON crm_tasks(activity_type);
CREATE INDEX idx_crm_tasks_call_result ON crm_tasks(call_result) WHERE activity_type = 'call';
CREATE INDEX idx_crm_tasks_reminder ON crm_tasks(reminder_at) WHERE reminder_at IS NOT NULL AND status != 'completed';

COMMENT ON COLUMN crm_tasks.activity_type IS 'Type of activity: task, call, meeting, or email';
COMMENT ON COLUMN crm_tasks.call_duration IS 'Call duration in seconds';
COMMENT ON COLUMN crm_tasks.call_result IS 'Outcome of the call';
COMMENT ON COLUMN crm_tasks.attendees IS 'Array of profile IDs for meeting attendees';

-- ============================================================================
-- SECTION 5: EXTEND CRM_ATTACHMENTS WITH STORAGE BUCKET PATH
-- ============================================================================
ALTER TABLE crm_attachments ADD COLUMN IF NOT EXISTS bucket_path text;
ALTER TABLE crm_attachments ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'crm-attachments';
ALTER TABLE crm_attachments ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
ALTER TABLE crm_attachments ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX idx_crm_attachments_bucket ON crm_attachments(storage_bucket, bucket_path);

COMMENT ON COLUMN crm_attachments.bucket_path IS 'Full path within the Supabase Storage bucket';
COMMENT ON COLUMN crm_attachments.storage_bucket IS 'Name of the Supabase Storage bucket';

-- ============================================================================
-- SECTION 6: UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_crm_deal_stages_updated_at 
  BEFORE UPDATE ON crm_deal_stages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 7: STAGE CHANGE TRIGGER
-- Automatically log stage changes to history table
-- ============================================================================
CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id uuid;
  v_from_stage_id uuid;
  v_to_stage_id uuid;
  v_duration_seconds integer;
  v_last_change timestamptz;
  v_module_key text;
BEGIN
  -- Only trigger on stage changes
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    -- Get the module key to check if this is a deals record
    SELECT key INTO v_module_key
    FROM crm_modules
    WHERE id = NEW.module_id;
    
    -- Only log for deals module
    IF v_module_key = 'deals' THEN
      -- Get actor ID
      SELECT id INTO v_actor_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
      
      -- Look up stage IDs
      SELECT id INTO v_from_stage_id 
      FROM crm_deal_stages 
      WHERE org_id = NEW.org_id AND key = OLD.stage;
      
      SELECT id INTO v_to_stage_id 
      FROM crm_deal_stages 
      WHERE org_id = NEW.org_id AND key = NEW.stage;
      
      -- Calculate duration in previous stage
      SELECT created_at INTO v_last_change
      FROM crm_deal_stage_history
      WHERE record_id = NEW.id
      ORDER BY created_at DESC
      LIMIT 1;
      
      IF v_last_change IS NOT NULL THEN
        v_duration_seconds := EXTRACT(EPOCH FROM (now() - v_last_change))::integer;
      ELSIF OLD.stage IS NOT NULL THEN
        -- If no history, use record created_at
        v_duration_seconds := EXTRACT(EPOCH FROM (now() - NEW.created_at))::integer;
      END IF;
      
      -- Insert history record
      INSERT INTO crm_deal_stage_history (
        org_id, record_id, from_stage, to_stage, 
        from_stage_id, to_stage_id, duration_seconds, changed_by
      ) VALUES (
        NEW.org_id, NEW.id, OLD.stage, NEW.stage,
        v_from_stage_id, v_to_stage_id, v_duration_seconds, v_actor_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_deal_stage_change_trigger
  AFTER UPDATE ON crm_records
  FOR EACH ROW EXECUTE FUNCTION log_deal_stage_change();

-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE crm_deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_record_links ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEAL STAGES POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view deal stages"
  ON crm_deal_stages FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM admins and managers can manage deal stages"
  ON crm_deal_stages FOR ALL
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- DEAL STAGE HISTORY POLICIES (immutable audit - insert via trigger)
-- ============================================================================
CREATE POLICY "CRM members can view stage history"
  ON crm_deal_stage_history FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can insert stage history"
  ON crm_deal_stage_history FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

-- ============================================================================
-- RECORD LINKS POLICIES
-- ============================================================================
CREATE POLICY "CRM members can view record links"
  ON crm_record_links FOR SELECT
  USING (is_crm_member(org_id));

CREATE POLICY "CRM agents can create record links"
  ON crm_record_links FOR INSERT
  WITH CHECK (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM agents can update record links"
  ON crm_record_links FOR UPDATE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

CREATE POLICY "CRM admins and managers can delete record links"
  ON crm_record_links FOR DELETE
  USING (has_crm_role(org_id, ARRAY['crm_admin', 'crm_manager']));

-- ============================================================================
-- SECTION 9: HELPER FUNCTIONS
-- ============================================================================

-- Get deal stages for an organization
CREATE OR REPLACE FUNCTION get_deal_stages(p_org_id uuid)
RETURNS SETOF crm_deal_stages AS $$
  SELECT * FROM crm_deal_stages
  WHERE org_id = p_org_id AND is_active = true
  ORDER BY display_order;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_deal_stages(uuid) TO authenticated;

-- Get stage history for a record
CREATE OR REPLACE FUNCTION get_record_stage_history(p_record_id uuid)
RETURNS TABLE (
  id uuid,
  from_stage text,
  to_stage text,
  duration_seconds integer,
  changed_by uuid,
  changed_by_name text,
  reason text,
  created_at timestamptz
) AS $$
  SELECT 
    h.id,
    h.from_stage,
    h.to_stage,
    h.duration_seconds,
    h.changed_by,
    p.full_name as changed_by_name,
    h.reason,
    h.created_at
  FROM crm_deal_stage_history h
  LEFT JOIN profiles p ON h.changed_by = p.id
  WHERE h.record_id = p_record_id
  ORDER BY h.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_record_stage_history(uuid) TO authenticated;

-- Get linked records for a record
CREATE OR REPLACE FUNCTION get_linked_records(p_record_id uuid)
RETURNS TABLE (
  link_id uuid,
  link_type text,
  is_primary boolean,
  direction text,
  record_id uuid,
  record_title text,
  record_module_key text,
  record_module_name text,
  created_at timestamptz
) AS $$
  -- Outbound links (this record -> other record)
  SELECT 
    l.id as link_id,
    l.link_type,
    l.is_primary,
    'outbound'::text as direction,
    r.id as record_id,
    r.title as record_title,
    m.key as record_module_key,
    m.name as record_module_name,
    l.created_at
  FROM crm_record_links l
  JOIN crm_records r ON l.target_record_id = r.id
  JOIN crm_modules m ON r.module_id = m.id
  WHERE l.source_record_id = p_record_id
  
  UNION ALL
  
  -- Inbound links (other record -> this record)
  SELECT 
    l.id as link_id,
    l.link_type,
    l.is_primary,
    'inbound'::text as direction,
    r.id as record_id,
    r.title as record_title,
    m.key as record_module_key,
    m.name as record_module_name,
    l.created_at
  FROM crm_record_links l
  JOIN crm_records r ON l.source_record_id = r.id
  JOIN crm_modules m ON r.module_id = m.id
  WHERE l.target_record_id = p_record_id
  
  ORDER BY created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_linked_records(uuid) TO authenticated;

-- ============================================================================
-- SECTION 10: SEED DEFAULT DEAL STAGES
-- Insert default stages for organizations that don't have any
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_default_deal_stages(p_org_id uuid)
RETURNS void AS $$
BEGIN
  -- Only seed if no stages exist for this org
  IF NOT EXISTS (SELECT 1 FROM crm_deal_stages WHERE org_id = p_org_id) THEN
    INSERT INTO crm_deal_stages (org_id, key, name, color, probability, is_won, is_lost, display_order)
    VALUES
      (p_org_id, 'qualification', 'Qualification', '#8b5cf6', 10, false, false, 1),
      (p_org_id, 'needs_analysis', 'Needs Analysis', '#6366f1', 25, false, false, 2),
      (p_org_id, 'proposal', 'Proposal', '#3b82f6', 50, false, false, 3),
      (p_org_id, 'negotiation', 'Negotiation', '#0ea5e9', 75, false, false, 4),
      (p_org_id, 'closed_won', 'Closed Won', '#22c55e', 100, true, false, 5),
      (p_org_id, 'closed_lost', 'Closed Lost', '#ef4444', 0, false, true, 6);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION seed_default_deal_stages(uuid) TO authenticated;

-- ============================================================================
-- COMPLETE
-- ============================================================================
SELECT 'W1 Core CRM Migration (Deal Stages, Stage History, Record Links, Activity Types) complete!' as status;
