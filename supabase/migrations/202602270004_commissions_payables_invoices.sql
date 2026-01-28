-- Migration: Commissions, Payables, and Invoices Enhancements
-- Prompt 6: Commission management, payables tracking, invoice generation with retro support

-- ============================================================================
-- PAYABLES MODULE
-- ============================================================================

-- Payable categories for organizing payables
CREATE TABLE IF NOT EXISTS payable_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Main payables table
CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Payee information
  payee_type VARCHAR(50) NOT NULL CHECK (payee_type IN ('agent', 'vendor', 'provider', 'other')),
  payee_id UUID, -- References agents, vendors, etc. based on payee_type
  payee_name VARCHAR(255) NOT NULL,
  payee_email VARCHAR(255),

  -- Payable details
  category_id UUID REFERENCES payable_categories(id),
  reference_number VARCHAR(100),
  description TEXT,

  -- Financial
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Dates
  due_date DATE,
  paid_date DATE,
  period_start DATE,
  period_end DATE,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'partial', 'cancelled', 'on_hold')),

  -- Payment details
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  check_number VARCHAR(50),

  -- Source tracking
  source_type VARCHAR(50), -- 'commission', 'expense', 'refund', 'manual'
  source_id UUID,

  -- Approval workflow
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payable line items for detailed breakdowns
CREATE TABLE IF NOT EXISTS payable_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id UUID REFERENCES payables(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payable payments for tracking partial payments
CREATE TABLE IF NOT EXISTS payable_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id UUID REFERENCES payables(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  check_number VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INVOICE GROUPS
-- ============================================================================

-- Invoice groups for batch invoice generation
CREATE TABLE IF NOT EXISTS invoice_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Group criteria
  group_type VARCHAR(50) NOT NULL CHECK (group_type IN ('bill_group', 'plan', 'agent', 'custom')),
  criteria JSONB DEFAULT '{}', -- Flexible criteria for group membership

  -- Billing settings
  billing_frequency VARCHAR(50) DEFAULT 'monthly' CHECK (billing_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annually')),
  billing_day INTEGER, -- Day of month/week for billing

  -- Invoice template settings
  invoice_prefix VARCHAR(20),
  default_due_days INTEGER DEFAULT 30,
  auto_generate BOOLEAN DEFAULT false,
  auto_send BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,

  -- Last generation tracking
  last_generated_at TIMESTAMPTZ,
  last_generated_by UUID REFERENCES profiles(id),

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Invoice group members
CREATE TABLE IF NOT EXISTS invoice_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_group_id UUID REFERENCES invoice_groups(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES profiles(id),
  UNIQUE(invoice_group_id, member_id)
);

-- ============================================================================
-- INVOICE GENERATION JOBS
-- ============================================================================

-- Track invoice generation jobs (batch processing)
CREATE TABLE IF NOT EXISTS invoice_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Job details
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('group', 'individual', 'retro', 'recurring')),
  job_name VARCHAR(255),

  -- Generation parameters
  invoice_group_id UUID REFERENCES invoice_groups(id),
  member_ids UUID[], -- For individual generation

  -- Period
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  due_date DATE,

  -- Retro invoicing
  is_retro BOOLEAN DEFAULT false,
  retro_reason TEXT,
  original_period_start DATE,
  original_period_end DATE,

  -- Processing status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Results
  total_invoices INTEGER DEFAULT 0,
  successful_invoices INTEGER DEFAULT 0,
  failed_invoices INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,

  -- Tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  result_details JSONB DEFAULT '{}',

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Link invoices to generation jobs
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS generation_job_id UUID REFERENCES invoice_generation_jobs(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_retro BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retro_reason TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_invoice_id UUID REFERENCES invoices(id);

-- ============================================================================
-- COMMISSION ENHANCEMENTS
-- ============================================================================

-- Commission bonus types
CREATE TABLE IF NOT EXISTS commission_bonus_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  calculation_type VARCHAR(50) DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage', 'tiered')),
  default_amount DECIMAL(12,2),
  default_percentage DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Commission copy history (for copying agent commissions)
CREATE TABLE IF NOT EXISTS commission_copy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Source and target
  source_agent_id UUID NOT NULL,
  target_agent_id UUID NOT NULL,

  -- What was copied
  copy_type VARCHAR(50) NOT NULL CHECK (copy_type IN ('rates', 'structure', 'overrides', 'all')),

  -- Period (if copying transactions)
  period_start DATE,
  period_end DATE,

  -- Results
  items_copied INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add bonus tracking to commissions table
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN DEFAULT false;
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS bonus_type_id UUID REFERENCES commission_bonus_types(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS bonus_reason TEXT;

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Financial audit log for commissions, payables, invoices
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Action details
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'commission', 'payable', 'invoice', 'invoice_group'
  entity_id UUID,

  -- Actor
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT now(),

  -- Change details
  old_values JSONB,
  new_values JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,

  -- Additional metadata
  details JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_financial_audit_entity ON financial_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_action ON financial_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_financial_audit_performed_at ON financial_audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_financial_audit_performed_by ON financial_audit_log(performed_by);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Insert commission permissions
INSERT INTO permissions (key, name, description, resource, action) VALUES
  ('commissions.read', 'View Commissions', 'View commissions', 'commissions', 'read'),
  ('commissions.write', 'Edit Commissions', 'Create and edit commissions', 'commissions', 'write'),
  ('commissions.delete', 'Delete Commissions', 'Delete commissions', 'commissions', 'delete'),
  ('commissions.generate', 'Generate Commissions', 'Generate bonus commissions', 'commissions', 'generate'),
  ('commissions.copy', 'Copy Commissions', 'Copy agent commission structures', 'commissions', 'copy'),
  ('commissions.approve', 'Approve Commissions', 'Approve commission payments', 'commissions', 'approve'),
  ('commissions.export', 'Export Commissions', 'Export commission data', 'commissions', 'export')
ON CONFLICT (key) DO NOTHING;

-- Insert payables permissions
INSERT INTO permissions (key, name, description, resource, action) VALUES
  ('payables.read', 'View Payables', 'View payables', 'payables', 'read'),
  ('payables.write', 'Edit Payables', 'Create and edit payables', 'payables', 'write'),
  ('payables.delete', 'Delete Payables', 'Delete payables', 'payables', 'delete'),
  ('payables.approve', 'Approve Payables', 'Approve payables for payment', 'payables', 'approve'),
  ('payables.process', 'Process Payables', 'Process payable payments', 'payables', 'process'),
  ('payables.export', 'Export Payables', 'Export payables data', 'payables', 'export')
ON CONFLICT (key) DO NOTHING;

-- Insert invoice permissions
INSERT INTO permissions (key, name, description, resource, action) VALUES
  ('invoices.read', 'View Invoices', 'View invoices', 'invoices', 'read'),
  ('invoices.write', 'Edit Invoices', 'Create and edit invoices', 'invoices', 'write'),
  ('invoices.delete', 'Delete Invoices', 'Delete invoices', 'invoices', 'delete'),
  ('invoices.generate', 'Generate Invoices', 'Generate invoices (batch and retro)', 'invoices', 'generate'),
  ('invoices.send', 'Send Invoices', 'Send invoices to members', 'invoices', 'send'),
  ('invoices.void', 'Void Invoices', 'Void invoices', 'invoices', 'void'),
  ('invoices.export', 'Export Invoices', 'Export invoice data', 'invoices', 'export'),
  ('invoices.retro', 'Retro Invoices', 'Create retroactive invoices', 'invoices', 'retro')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Payables RLS
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payable_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payable_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payable_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payables_org_access" ON payables
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "payable_categories_org_access" ON payable_categories
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "payable_line_items_access" ON payable_line_items
  FOR ALL USING (
    payable_id IN (
      SELECT id FROM payables WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "payable_payments_access" ON payable_payments
  FOR ALL USING (
    payable_id IN (
      SELECT id FROM payables WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Invoice groups RLS
ALTER TABLE invoice_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_groups_org_access" ON invoice_groups
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_group_members_access" ON invoice_group_members
  FOR ALL USING (
    invoice_group_id IN (
      SELECT id FROM invoice_groups WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "invoice_generation_jobs_org_access" ON invoice_generation_jobs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Commission enhancements RLS
ALTER TABLE commission_bonus_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_copy_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_bonus_types_org_access" ON commission_bonus_types
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "commission_copy_history_org_access" ON commission_copy_history
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Financial audit log RLS
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_audit_log_org_access" ON financial_audit_log
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Payables indexes
CREATE INDEX IF NOT EXISTS idx_payables_org ON payables(organization_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_payee ON payables(payee_type, payee_id);
CREATE INDEX IF NOT EXISTS idx_payables_due_date ON payables(due_date);
CREATE INDEX IF NOT EXISTS idx_payables_created ON payables(created_at);

-- Invoice groups indexes
CREATE INDEX IF NOT EXISTS idx_invoice_groups_org ON invoice_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_groups_type ON invoice_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_invoice_group_members_group ON invoice_group_members(invoice_group_id);
CREATE INDEX IF NOT EXISTS idx_invoice_group_members_member ON invoice_group_members(member_id);

-- Invoice generation jobs indexes
CREATE INDEX IF NOT EXISTS idx_invoice_gen_jobs_org ON invoice_generation_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_gen_jobs_status ON invoice_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_invoice_gen_jobs_type ON invoice_generation_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_invoice_gen_jobs_group ON invoice_generation_jobs(invoice_group_id);

-- Commission enhancements indexes
CREATE INDEX IF NOT EXISTS idx_commission_bonus_types_org ON commission_bonus_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_copy_history_org ON commission_copy_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_commission_copy_history_source ON commission_copy_history(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_copy_history_target ON commission_copy_history(target_agent_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get payables summary
CREATE OR REPLACE FUNCTION get_payables_summary(p_organization_id UUID, p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL)
RETURNS TABLE (
  total_pending DECIMAL,
  total_approved DECIMAL,
  total_paid DECIMAL,
  total_overdue DECIMAL,
  count_pending INTEGER,
  count_approved INTEGER,
  count_paid INTEGER,
  count_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as total_approved,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') AND due_date < CURRENT_DATE THEN amount ELSE 0 END), 0) as total_overdue,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as count_pending,
    COUNT(CASE WHEN status = 'approved' THEN 1 END)::INTEGER as count_approved,
    COUNT(CASE WHEN status = 'paid' THEN 1 END)::INTEGER as count_paid,
    COUNT(CASE WHEN status IN ('pending', 'approved') AND due_date < CURRENT_DATE THEN 1 END)::INTEGER as count_overdue
  FROM payables
  WHERE organization_id = p_organization_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get commission summary with bonuses
CREATE OR REPLACE FUNCTION get_commission_summary(p_organization_id UUID, p_period_start DATE, p_period_end DATE)
RETURNS TABLE (
  total_earned DECIMAL,
  total_paid DECIMAL,
  total_pending DECIMAL,
  total_bonuses DECIMAL,
  count_transactions INTEGER,
  count_bonuses INTEGER,
  avg_commission DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount), 0) as total_earned,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN is_bonus = true THEN amount ELSE 0 END), 0) as total_bonuses,
    COUNT(*)::INTEGER as count_transactions,
    COUNT(CASE WHEN is_bonus = true THEN 1 END)::INTEGER as count_bonuses,
    COALESCE(AVG(amount), 0) as avg_commission
  FROM commissions
  WHERE organization_id = p_organization_id
    AND effective_date >= p_period_start
    AND effective_date <= p_period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get invoice generation summary
CREATE OR REPLACE FUNCTION get_invoice_generation_summary(p_organization_id UUID)
RETURNS TABLE (
  total_generated INTEGER,
  total_amount DECIMAL,
  retro_count INTEGER,
  retro_amount DECIMAL,
  last_generation_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(successful_invoices), 0)::INTEGER as total_generated,
    COALESCE(SUM(total_amount), 0) as total_amount,
    COUNT(CASE WHEN is_retro = true THEN 1 END)::INTEGER as retro_count,
    COALESCE(SUM(CASE WHEN is_retro = true THEN total_amount ELSE 0 END), 0) as retro_amount,
    MAX(completed_at) as last_generation_date
  FROM invoice_generation_jobs
  WHERE organization_id = p_organization_id
    AND status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Audit trigger function for financial entities
CREATE OR REPLACE FUNCTION log_financial_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_organization_id UUID;
  v_action VARCHAR(100);
  v_performed_by UUID;
BEGIN
  -- Determine organization_id based on table
  IF TG_TABLE_NAME = 'payables' THEN
    v_organization_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    v_organization_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'commissions' THEN
    v_organization_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'invoice_generation_jobs' THEN
    v_organization_id := COALESCE(NEW.organization_id, OLD.organization_id);
  END IF;

  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := TG_TABLE_NAME || '_created';
    v_performed_by := NEW.created_by;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := TG_TABLE_NAME || '_updated';
    v_performed_by := COALESCE(NEW.approved_by, NEW.created_by, OLD.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := TG_TABLE_NAME || '_deleted';
    v_performed_by := OLD.created_by;
  END IF;

  -- Insert audit record
  INSERT INTO financial_audit_log (
    organization_id,
    action,
    entity_type,
    entity_id,
    performed_by,
    old_values,
    new_values
  ) VALUES (
    v_organization_id,
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_performed_by,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers
DROP TRIGGER IF EXISTS payables_audit_trigger ON payables;
CREATE TRIGGER payables_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payables
  FOR EACH ROW EXECUTE FUNCTION log_financial_audit();

DROP TRIGGER IF EXISTS invoice_generation_jobs_audit_trigger ON invoice_generation_jobs;
CREATE TRIGGER invoice_generation_jobs_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON invoice_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION log_financial_audit();

-- ============================================================================
-- UPDATE TIMESTAMPS TRIGGERS
-- ============================================================================

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payables_updated_at ON payables;
CREATE TRIGGER payables_updated_at
  BEFORE UPDATE ON payables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS payable_categories_updated_at ON payable_categories;
CREATE TRIGGER payable_categories_updated_at
  BEFORE UPDATE ON payable_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS invoice_groups_updated_at ON invoice_groups;
CREATE TRIGGER invoice_groups_updated_at
  BEFORE UPDATE ON invoice_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS commission_bonus_types_updated_at ON commission_bonus_types;
CREATE TRIGGER commission_bonus_types_updated_at
  BEFORE UPDATE ON commission_bonus_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
