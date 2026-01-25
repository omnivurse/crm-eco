/*
  # Enhance Catalog and Knowledge Base

  ## Overview
  Add knowledge versioning system and enhance catalog with sample items

  ## 1. Knowledge Versioning

  ### New Tables
  - `knowledge_versions` - Version history for knowledge articles

  ## 2. Sample Catalog Items
  - Add diverse catalog items with rich form schemas

  ## 3. Security
  - RLS policies for knowledge versions
*/

-- =====================================================
-- KNOWLEDGE VERSIONING SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  version int NOT NULL,
  title text NOT NULL,
  content_md text NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(article_id, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_article ON knowledge_versions(article_id, version DESC);

ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;

-- Staff+ can view version history
CREATE POLICY "knowledge_versions_staff_read" ON knowledge_versions FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('staff', 'agent', 'it', 'admin', 'super_admin')
  )
);

-- System can insert versions
CREATE POLICY "knowledge_versions_system_write" ON knowledge_versions FOR INSERT TO authenticated
WITH CHECK (true);

-- =====================================================
-- KNOWLEDGE VERSION TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION bump_knowledge_version()
RETURNS TRIGGER AS $$
DECLARE
  latest_version int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO knowledge_versions(article_id, version, title, content_md, created_by)
    VALUES(NEW.id, 1, NEW.title, NEW.content_md, NEW.author_id);
  ELSIF TG_OP = 'UPDATE' AND (OLD.title IS DISTINCT FROM NEW.title OR OLD.content_md IS DISTINCT FROM NEW.content_md) THEN
    SELECT COALESCE(MAX(version), 0) INTO latest_version
    FROM knowledge_versions
    WHERE article_id = NEW.id;

    INSERT INTO knowledge_versions(article_id, version, title, content_md, created_by)
    VALUES(NEW.id, latest_version + 1, NEW.title, NEW.content_md, NEW.author_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS knowledge_version_trigger ON knowledge_articles;
CREATE TRIGGER knowledge_version_trigger
  AFTER INSERT OR UPDATE ON knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION bump_knowledge_version();

-- =====================================================
-- ENHANCED CATALOG ITEMS
-- =====================================================

-- Add icon column if not exists
DO $$ BEGIN
  ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS icon text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Insert sample catalog items with rich forms
INSERT INTO catalog_items (name, description, category_id, form_schema, estimated_delivery_days, approval_required, icon, is_active)
VALUES
(
  'Software License Request',
  'Request a license for software applications',
  (SELECT id FROM catalog_categories LIMIT 1),
  '{"fields": [
    {"key": "software_name", "label": "Software Name", "type": "text", "required": true, "placeholder": "e.g., Microsoft Office"},
    {"key": "license_type", "label": "License Type", "type": "select", "required": true, "options": ["Individual", "Team", "Enterprise"]},
    {"key": "business_justification", "label": "Business Justification", "type": "textarea", "required": true, "placeholder": "Explain why you need this software"},
    {"key": "cost_center", "label": "Cost Center", "type": "text", "required": true},
    {"key": "urgency", "label": "Urgency Level", "type": "select", "required": true, "options": ["Low", "Medium", "High", "Critical"]}
  ]}'::jsonb,
  5,
  true,
  '💿',
  true
),
(
  'Hardware Equipment Request',
  'Request laptops, monitors, keyboards, and other equipment',
  (SELECT id FROM catalog_categories LIMIT 1),
  '{"fields": [
    {"key": "equipment_type", "label": "Equipment Type", "type": "select", "required": true, "options": ["Laptop", "Desktop", "Monitor", "Keyboard", "Mouse", "Headset", "Docking Station", "Other"]},
    {"key": "specifications", "label": "Specifications", "type": "textarea", "required": false, "placeholder": "Any specific requirements?"},
    {"key": "reason", "label": "Reason for Request", "type": "textarea", "required": true},
    {"key": "ship_to_location", "label": "Shipping Address", "type": "text", "required": true},
    {"key": "replacement", "label": "Is this a replacement?", "type": "checkbox", "required": false}
  ]}'::jsonb,
  7,
  true,
  '💻',
  true
),
(
  'Access Request',
  'Request access to systems, applications, or facilities',
  (SELECT id FROM catalog_categories LIMIT 1),
  '{"fields": [
    {"key": "access_type", "label": "Access Type", "type": "select", "required": true, "options": ["Application Access", "Network Access", "Building Access", "VPN Access", "Database Access"]},
    {"key": "system_name", "label": "System/Resource Name", "type": "text", "required": true},
    {"key": "access_level", "label": "Access Level", "type": "select", "required": true, "options": ["Read Only", "Read/Write", "Admin"]},
    {"key": "justification", "label": "Business Justification", "type": "textarea", "required": true},
    {"key": "duration", "label": "Access Duration", "type": "select", "required": true, "options": ["Temporary (30 days)", "Extended (90 days)", "Permanent"]},
    {"key": "manager_email", "label": "Manager Email", "type": "email", "required": true}
  ]}'::jsonb,
  3,
  true,
  '🔑',
  true
),
(
  'Office Supplies',
  'Order office supplies and materials',
  (SELECT id FROM catalog_categories LIMIT 1),
  '{"fields": [
    {"key": "items_needed", "label": "Items Needed", "type": "textarea", "required": true, "placeholder": "List the items you need"},
    {"key": "quantity", "label": "Approximate Quantity", "type": "text", "required": true},
    {"key": "delivery_location", "label": "Delivery Location", "type": "text", "required": true},
    {"key": "urgency", "label": "When do you need this?", "type": "select", "required": true, "options": ["Next Week", "This Month", "Next Quarter"]}
  ]}'::jsonb,
  5,
  false,
  '📦',
  true
),
(
  'New Employee Onboarding',
  'Setup new employee with equipment and access',
  (SELECT id FROM catalog_categories LIMIT 1),
  '{"fields": [
    {"key": "employee_name", "label": "Employee Full Name", "type": "text", "required": true},
    {"key": "employee_email", "label": "Employee Email", "type": "email", "required": true},
    {"key": "department", "label": "Department", "type": "text", "required": true},
    {"key": "job_title", "label": "Job Title", "type": "text", "required": true},
    {"key": "start_date", "label": "Start Date", "type": "text", "required": true, "placeholder": "YYYY-MM-DD"},
    {"key": "equipment_needed", "label": "Equipment Needed", "type": "textarea", "required": true},
    {"key": "software_needed", "label": "Software/Access Needed", "type": "textarea", "required": true},
    {"key": "manager_name", "label": "Manager Name", "type": "text", "required": true}
  ]}'::jsonb,
  10,
  true,
  '👤',
  true
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ANALYTICS HELPER VIEWS
-- =====================================================

CREATE OR REPLACE VIEW workflow_execution_stats AS
SELECT
  w.id as workflow_id,
  w.name as workflow_name,
  COUNT(we.id) as total_executions,
  COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as successful_executions,
  COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_executions,
  MAX(we.started_at) as last_execution
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name;

-- Grant access to the view
GRANT SELECT ON workflow_execution_stats TO authenticated;
