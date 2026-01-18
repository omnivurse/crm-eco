-- ============================================================================
-- PHASE W19: FORECASTING, PLAYBOOKS, DEAL WAR ROOM
-- Sales forecasting, playbook management, and focused deal view
-- ============================================================================

-- ============================================================================
-- FORECASTS
-- Forecast snapshots and predictions
-- ============================================================================

CREATE TABLE IF NOT EXISTS forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Period
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text DEFAULT 'month', -- week, month, quarter, year
  
  -- Forecast type
  forecast_type text DEFAULT 'pipeline', -- pipeline, committed, best_case, worst_case
  
  -- Data
  data jsonb NOT NULL,
  -- {
  --   total: 150000,
  --   by_rep: [{ rep_id, name, amount }],
  --   by_stage: [{ stage, amount, count }],
  --   by_source: [{ source, amount }]
  -- }
  
  -- Comparison
  previous_forecast_id uuid REFERENCES forecasts(id),
  actual_amount numeric,
  
  -- Notes
  notes text,
  
  -- Created by
  created_by uuid REFERENCES profiles(id),
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_forecasts_org ON forecasts(org_id);
CREATE INDEX idx_forecasts_period ON forecasts(period_start, period_end);

-- ============================================================================
-- PLAYBOOKS
-- Sales playbooks for deal stages
-- ============================================================================

CREATE TABLE IF NOT EXISTS playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Playbook info
  name text NOT NULL,
  description text,
  
  -- Content
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ section: 'Discovery', items: [{ type: 'task', title: '...', description: '...' }] }]
  
  -- Stage attachments
  stage_attachments jsonb DEFAULT '[]'::jsonb,
  -- [{ module_key: 'Deals', stage: 'Discovery', auto_show: true }]
  
  -- Target
  target_modules text[] DEFAULT '{"Deals"}',
  
  -- Status
  is_active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_playbooks_org ON playbooks(org_id);

-- ============================================================================
-- PLAYBOOK CHECKLISTS
-- Checklist items within playbooks
-- ============================================================================

CREATE TABLE IF NOT EXISTS playbook_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  playbook_id uuid NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  
  -- Checklist item
  section text NOT NULL,
  title text NOT NULL,
  description text,
  
  -- Item type
  item_type text DEFAULT 'task', -- task, question, resource, milestone
  
  -- Order
  sort_order int DEFAULT 0,
  
  -- Required
  is_required boolean DEFAULT false,
  
  -- Resource link
  resource_url text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_playbook_checklists_playbook ON playbook_checklists(playbook_id);

-- ============================================================================
-- PLAYBOOK PROGRESS
-- Track playbook completion per deal
-- ============================================================================

CREATE TABLE IF NOT EXISTS playbook_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- References
  deal_id uuid NOT NULL,
  playbook_id uuid NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
  
  -- Completed items
  completed_items uuid[] DEFAULT '{}',
  -- Array of playbook_checklists.id
  
  -- Notes per item
  item_notes jsonb DEFAULT '{}'::jsonb,
  -- { checklist_id: 'notes...' }
  
  -- Timestamps
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  UNIQUE(deal_id, playbook_id)
);

CREATE INDEX idx_playbook_progress_deal ON playbook_progress(deal_id);

-- ============================================================================
-- DEAL WAR ROOM
-- Focused deal view data
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_war_room_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL,
  
  -- Note content
  category text DEFAULT 'general', -- general, blocker, risk, action, win_theme
  content text NOT NULL,
  
  -- Visibility
  is_pinned boolean DEFAULT false,
  
  -- Author
  created_by uuid REFERENCES profiles(id),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_war_room_notes_deal ON deal_war_room_notes(deal_id);

-- ============================================================================
-- DEAL BLOCKERS
-- Track blockers for deals
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL,
  
  -- Blocker info
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium', -- low, medium, high, critical
  
  -- Status
  status text DEFAULT 'open', -- open, in_progress, resolved
  
  -- Resolution
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  
  -- Ownership
  owner_id uuid REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_deal_blockers_deal ON deal_blockers(deal_id);
CREATE INDEX idx_deal_blockers_status ON deal_blockers(status) WHERE status = 'open';

-- RLS
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_war_room_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forecasts for their org"
  ON forecasts FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage forecasts"
  ON forecasts FOR ALL USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view playbooks for their org"
  ON playbooks FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Admins can manage playbooks"
  ON playbooks FOR ALL USING (org_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view playbook checklists"
  ON playbook_checklists FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can view playbook progress"
  ON playbook_progress FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage playbook progress"
  ON playbook_progress FOR ALL USING (org_id = get_user_organization_id());

CREATE POLICY "Users can view war room notes"
  ON deal_war_room_notes FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage war room notes"
  ON deal_war_room_notes FOR ALL USING (org_id = get_user_organization_id());

CREATE POLICY "Users can view deal blockers"
  ON deal_blockers FOR SELECT USING (org_id = get_user_organization_id());

CREATE POLICY "Users can manage deal blockers"
  ON deal_blockers FOR ALL USING (org_id = get_user_organization_id());
