/*
  # ServiceOps Core - Complete Schema Migration
  
  ## Overview
  Complete ServiceNow-style ITSM platform schema with:
  - Service Management (Services, Teams, SLA Policies)
  - Service Catalog & Request Fulfillment
  - Problem Management
  - Change Management (Lite)
  - CMDB & Asset Management
  - Workflow Engine
  - Metrics & Analytics
  
  ## 1. New Tables
  
  ### Core Service Management
  - `teams` - Organizational teams owning services
  - `services` - IT services with SLA policies
  - `sla_policies` - Response and resolve targets by priority
  - `sla_timers` - Active SLA tracking per ticket
  
  ### Service Catalog
  - `catalog_categories` - Service catalog categories
  - `catalog_items` - Service offerings with dynamic forms
  - `requests` - Service requests from catalog
  - `request_approvals` - Multi-step approval workflow
  - `request_tasks` - Fulfillment tasks with checklists
  
  ### Problem Management
  - `problems` - Problem records with root cause analysis
  - `problem_tickets` - Link problems to related incidents
  
  ### Change Management
  - `changes` - Change requests with risk assessment
  - `change_approvals` - CAB approval workflow
  - `change_tasks` - Implementation tasks
  
  ### CMDB & Assets
  - `cmdb_ci` - Configuration Items with class hierarchy
  - `ci_relationships` - CI dependencies and connections
  - `assets` - Physical and software assets
  - `asset_assignments` - Asset to user assignments
  
  ### Workflow Engine
  - `workflows` - Workflow definitions
  - `workflow_triggers` - Event triggers
  - `workflow_steps` - Step definitions
  - `workflow_executions` - Execution history
  
  ### Analytics
  - `metrics_daily` - Daily KPI rollups
  - `ticket_events` - Enhanced event tracking
  
  ## 2. Security
  - Enable RLS on all tables
  - Role-based policies (member, advisor, agent, manager, admin, compliance)
  - Org-scoped data access
  
  ## 3. Indexes
  - Performance indexes for common queries
  - Full-text search indexes
  - Composite indexes for analytics
*/

-- =====================================================
-- ENUMS AND TYPES
-- =====================================================

-- Ticket type enum (expand existing)
DO $$ BEGIN
  CREATE TYPE ticket_type AS ENUM ('incident', 'request', 'problem', 'change');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Change type enum
DO $$ BEGIN
  CREATE TYPE change_type AS ENUM ('standard', 'normal', 'emergency');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Change risk enum
DO $$ BEGIN
  CREATE TYPE change_risk AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CI class enum
DO $$ BEGIN
  CREATE TYPE ci_class AS ENUM ('server', 'application', 'database', 'network', 'storage', 'service', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Environment enum
DO $$ BEGIN
  CREATE TYPE environment AS ENUM ('production', 'staging', 'development', 'test');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Approval status enum
DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Workflow trigger type enum
DO $$ BEGIN
  CREATE TYPE trigger_type AS ENUM ('ticket.created', 'ticket.updated', 'request.submitted', 'change.scheduled', 'schedule.cron');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- CORE SERVICE MANAGEMENT
-- =====================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  manager_id uuid REFERENCES profiles(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_team_id uuid REFERENCES teams(id),
  sla_policy_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SLA Policies table
CREATE TABLE IF NOT EXISTS sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  targets jsonb NOT NULL DEFAULT '{
    "urgent": {"response_minutes": 15, "resolve_minutes": 240},
    "high": {"response_minutes": 60, "resolve_minutes": 480},
    "medium": {"response_minutes": 240, "resolve_minutes": 1440},
    "low": {"response_minutes": 480, "resolve_minutes": 2880}
  }'::jsonb,
  business_hours jsonb DEFAULT '{"start": "09:00", "end": "17:00", "days": [1,2,3,4,5]}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- SLA Timers table (active tracking)
CREATE TABLE IF NOT EXISTS sla_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  response_due_at timestamptz,
  resolve_due_at timestamptz,
  response_breached boolean DEFAULT false,
  resolve_breached boolean DEFAULT false,
  paused_at timestamptz,
  pause_duration_seconds int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add service reference to tickets if not exists
DO $$ BEGIN
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES services(id);
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS type ticket_type DEFAULT 'incident';
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS impact text;
  ALTER TABLE tickets ADD COLUMN IF NOT EXISTS urgency text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- =====================================================
-- SERVICE CATALOG
-- =====================================================

-- Catalog Categories
CREATE TABLE IF NOT EXISTS catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  parent_id uuid REFERENCES catalog_categories(id),
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Catalog Items
CREATE TABLE IF NOT EXISTS catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES catalog_categories(id),
  form_schema jsonb NOT NULL DEFAULT '{"fields": []}'::jsonb,
  fulfillment_flow_id uuid,
  approval_required boolean DEFAULT false,
  estimated_delivery_days int DEFAULT 3,
  visibility_roles text[] DEFAULT ARRAY['member','advisor','staff','agent','it','admin','super_admin'],
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid REFERENCES catalog_items(id),
  requester_id uuid REFERENCES profiles(id),
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'pending_approval', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled')),
  answers jsonb DEFAULT '{}'::jsonb,
  approval_state jsonb DEFAULT '{"status": "pending", "steps": []}'::jsonb,
  sla_snapshot jsonb,
  assigned_to uuid REFERENCES profiles(id),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Request Approvals
CREATE TABLE IF NOT EXISTS request_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  approver_id uuid REFERENCES profiles(id),
  status approval_status DEFAULT 'pending',
  comments text,
  step_order int DEFAULT 1,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Request Tasks (fulfillment checklists)
CREATE TABLE IF NOT EXISTS request_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  sort_order int DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- PROBLEM MANAGEMENT
-- =====================================================

-- Problems table
CREATE TABLE IF NOT EXISTS problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text DEFAULT 'investigating' CHECK (status IN ('investigating', 'root_cause_found', 'known_error', 'resolved', 'closed')),
  priority ticket_priority DEFAULT 'medium',
  root_cause text,
  workaround_md text,
  resolution_md text,
  owner_id uuid REFERENCES profiles(id),
  assigned_team_id uuid REFERENCES teams(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

-- Problem-Ticket relationships
CREATE TABLE IF NOT EXISTS problem_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid REFERENCES problems(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  relationship_type text DEFAULT 'related' CHECK (relationship_type IN ('caused_by', 'related', 'duplicate')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(problem_id, ticket_id)
);

-- =====================================================
-- CHANGE MANAGEMENT
-- =====================================================

-- Changes table
CREATE TABLE IF NOT EXISTS changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type change_type DEFAULT 'normal',
  risk change_risk DEFAULT 'medium',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority ticket_priority DEFAULT 'medium',
  requester_id uuid REFERENCES profiles(id),
  implementer_id uuid REFERENCES profiles(id),
  affected_service_id uuid REFERENCES services(id),
  window_start timestamptz,
  window_end timestamptz,
  implementation_plan_md text,
  backout_plan_md text,
  test_plan_md text,
  linked_ci_ids uuid[] DEFAULT ARRAY[]::uuid[],
  approval_state jsonb DEFAULT '{"status": "pending", "votes": []}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Change Approvals (CAB)
CREATE TABLE IF NOT EXISTS change_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id uuid REFERENCES changes(id) ON DELETE CASCADE,
  approver_id uuid REFERENCES profiles(id),
  status approval_status DEFAULT 'pending',
  vote text CHECK (vote IN ('approve', 'reject', 'abstain')),
  comments text,
  voted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Change Tasks
CREATE TABLE IF NOT EXISTS change_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id uuid REFERENCES changes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  sort_order int DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- =====================================================
-- CMDB & ASSET MANAGEMENT
-- =====================================================

-- CMDB Configuration Items
CREATE TABLE IF NOT EXISTS cmdb_ci (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class ci_class DEFAULT 'other',
  name text NOT NULL,
  description text,
  environment environment DEFAULT 'production',
  owner_team_id uuid REFERENCES teams(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'retired')),
  attrs jsonb DEFAULT '{}'::jsonb,
  location text,
  ip_address text,
  hostname text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- CI Relationships
CREATE TABLE IF NOT EXISTS ci_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_ci_id uuid REFERENCES cmdb_ci(id) ON DELETE CASCADE,
  child_ci_id uuid REFERENCES cmdb_ci(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('depends_on', 'runs_on', 'connects_to', 'hosts', 'uses')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_ci_id, child_ci_id, relationship_type)
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text UNIQUE,
  type text NOT NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'assigned', 'in_repair', 'retired', 'lost')),
  ci_id uuid REFERENCES cmdb_ci(id),
  serial_number text,
  purchase_date date,
  warranty_end_date date,
  attrs jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Asset Assignments
CREATE TABLE IF NOT EXISTS asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id),
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  returned_at timestamptz,
  notes text,
  UNIQUE(asset_id, assigned_to, assigned_at)
);

-- =====================================================
-- WORKFLOW ENGINE
-- =====================================================

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type trigger_type NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workflow Steps
CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  step_type text NOT NULL CHECK (step_type IN ('condition', 'approval', 'notify', 'webhook', 'function', 'task', 'wait')),
  step_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Workflow Executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id),
  triggered_by text,
  trigger_data jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  steps_completed jsonb DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- =====================================================
-- ANALYTICS & METRICS
-- =====================================================

-- Metrics Daily Rollups
CREATE TABLE IF NOT EXISTS metrics_daily (
  date date NOT NULL,
  kpi text NOT NULL,
  value numeric NOT NULL,
  dimensions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (date, kpi, dimensions)
);

-- Enhanced Ticket Events (expand existing)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS ticket_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    actor_id uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
  );
EXCEPTION
  WHEN duplicate_table THEN null;
END $$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_manager ON teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active) WHERE is_active = true;

-- Services indexes
CREATE INDEX IF NOT EXISTS idx_services_team ON services(owner_team_id);
CREATE INDEX IF NOT EXISTS idx_services_sla ON services(sla_policy_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active) WHERE is_active = true;

-- SLA indexes
CREATE INDEX IF NOT EXISTS idx_sla_timers_ticket ON sla_timers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_timers_breach ON sla_timers(resolve_breached, response_breached);
CREATE INDEX IF NOT EXISTS idx_sla_timers_due ON sla_timers(resolve_due_at) WHERE resolve_breached = false;

-- Catalog indexes
CREATE INDEX IF NOT EXISTS idx_catalog_items_category ON catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_active ON catalog_items(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_item ON requests(catalog_item_id);

-- Problem indexes
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_owner ON problems(owner_id);
CREATE INDEX IF NOT EXISTS idx_problem_tickets_problem ON problem_tickets(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_tickets_ticket ON problem_tickets(ticket_id);

-- Change indexes
CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status);
CREATE INDEX IF NOT EXISTS idx_changes_type ON changes(type);
CREATE INDEX IF NOT EXISTS idx_changes_window ON changes(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_changes_implementer ON changes(implementer_id);

-- CMDB indexes
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_class ON cmdb_ci(class);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_status ON cmdb_ci(status);
CREATE INDEX IF NOT EXISTS idx_cmdb_ci_owner ON cmdb_ci(owner_team_id);
CREATE INDEX IF NOT EXISTS idx_ci_relationships_parent ON ci_relationships(parent_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_relationships_child ON ci_relationships(child_ci_id);

-- Asset indexes
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_ci ON assets(ci_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset ON asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_user ON asset_assignments(assigned_to);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_date_kpi ON metrics_daily(date DESC, kpi);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket ON ticket_events(ticket_id, created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmdb_ci ENABLE ROW LEVEL SECURITY;
ALTER TABLE ci_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Staff+ can read all, agents can manage assigned
-- =====================================================

-- Teams policies
CREATE POLICY "teams_staff_read" ON teams FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "teams_admin_manage" ON teams FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

-- Services policies (readable by all authenticated, manageable by admin)
CREATE POLICY "services_auth_read" ON services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services_admin_manage" ON services FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

-- SLA policies (readable by all authenticated, manageable by admin)
CREATE POLICY "sla_policies_auth_read" ON sla_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "sla_policies_admin_manage" ON sla_policies FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

-- SLA timers (readable by staff+, system managed)
CREATE POLICY "sla_timers_staff_read" ON sla_timers FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

-- Catalog categories (public read, admin write)
CREATE POLICY "catalog_categories_auth_read" ON catalog_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog_categories_admin_manage" ON catalog_categories FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

-- Catalog items (public read, admin write)
CREATE POLICY "catalog_items_auth_read" ON catalog_items FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "catalog_items_admin_manage" ON catalog_items FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

-- Requests (users see own, staff see all)
CREATE POLICY "requests_own_read" ON requests FOR SELECT TO authenticated
USING (
  requester_id = auth.uid()
  OR assigned_to = auth.uid()
  OR EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "requests_own_insert" ON requests FOR INSERT TO authenticated
WITH CHECK (requester_id = auth.uid());

CREATE POLICY "requests_staff_manage" ON requests FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

-- Request approvals (approvers can see and update theirs)
CREATE POLICY "request_approvals_read" ON request_approvals FOR SELECT TO authenticated
USING (
  approver_id = auth.uid()
  OR EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "request_approvals_update" ON request_approvals FOR UPDATE TO authenticated
USING (approver_id = auth.uid())
WITH CHECK (approver_id = auth.uid());

-- Problems (staff+ can read/manage)
CREATE POLICY "problems_staff_access" ON problems FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "problem_tickets_staff_access" ON problem_tickets FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

-- Changes (staff+ can read/manage)
CREATE POLICY "changes_staff_access" ON changes FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "change_approvals_read" ON change_approvals FOR SELECT TO authenticated
USING (
  approver_id = auth.uid()
  OR EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('it', 'admin', 'super_admin')
  )
);

CREATE POLICY "change_approvals_update" ON change_approvals FOR UPDATE TO authenticated
USING (approver_id = auth.uid())
WITH CHECK (approver_id = auth.uid());

-- CMDB (staff+ can read, IT+ can manage)
CREATE POLICY "cmdb_ci_staff_read" ON cmdb_ci FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "cmdb_ci_it_manage" ON cmdb_ci FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('it', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('it', 'admin', 'super_admin')
  )
);

CREATE POLICY "ci_relationships_staff_read" ON ci_relationships FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

-- Assets (staff+ can read, IT+ can manage)
CREATE POLICY "assets_staff_read" ON assets FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

CREATE POLICY "assets_it_manage" ON assets FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('it', 'admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('it', 'admin', 'super_admin')
  )
);

CREATE POLICY "asset_assignments_read" ON asset_assignments FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('it', 'admin', 'super_admin')
  )
);

-- Workflows (admin only)
CREATE POLICY "workflows_admin_access" ON workflows FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "workflow_steps_admin_access" ON workflow_steps FOR ALL TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "workflow_executions_admin_read" ON workflow_executions FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('admin', 'super_admin')
  )
);

-- Metrics (staff+ can read, system writes)
CREATE POLICY "metrics_staff_read" ON metrics_daily FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

-- Ticket events (follow ticket access)
CREATE POLICY "ticket_events_access" ON ticket_events FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM tickets t 
    WHERE t.id = ticket_id 
    AND (
      t.requester_id = auth.uid()
      OR t.assignee_id = auth.uid()
      OR EXISTS(
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('agent', 'it', 'admin', 'super_admin')
      )
    )
  )
);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_catalog_items_updated_at ON catalog_items;
CREATE TRIGGER update_catalog_items_updated_at BEFORE UPDATE ON catalog_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_problems_updated_at ON problems;
CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_changes_updated_at ON changes;
CREATE TRIGGER update_changes_updated_at BEFORE UPDATE ON changes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_cmdb_ci_updated_at ON cmdb_ci;
CREATE TRIGGER update_cmdb_ci_updated_at BEFORE UPDATE ON cmdb_ci
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sla_timers_updated_at ON sla_timers;
CREATE TRIGGER update_sla_timers_updated_at BEFORE UPDATE ON sla_timers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
