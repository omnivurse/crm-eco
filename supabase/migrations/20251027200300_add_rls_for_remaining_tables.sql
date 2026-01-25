/*
  # Add RLS Policies for Remaining Unprotected Tables

  1. Purpose
    - Add Row Level Security policies to tables without proper protection
    - Ensure comprehensive data access control across all tables
    - Prevent unauthorized data access

  2. Tables Updated
    - kb_articles (knowledge base)
    - workflows
    - sla_configs
    - reminders

  3. Security Model
    - kb_articles: Public read, staff write
    - workflows: Staff only
    - sla_configs: Admin only
    - reminders: Users can only access their own reminders

  4. Notes
    - All policies enforce strict role-based access control
    - Maintains data privacy and security
*/

-- kb_articles RLS
ALTER TABLE IF EXISTS kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view KB articles"
  ON kb_articles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "Only staff can create KB articles"
  ON kb_articles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY IF NOT EXISTS "Only staff can update KB articles"
  ON kb_articles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY IF NOT EXISTS "Only staff can delete KB articles"
  ON kb_articles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- workflows RLS
ALTER TABLE IF EXISTS workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Staff can view workflows"
  ON workflows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can manage workflows"
  ON workflows FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- sla_configs RLS
ALTER TABLE IF EXISTS sla_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Staff can view SLA configs"
  ON sla_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY IF NOT EXISTS "Admins can manage SLA configs"
  ON sla_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- reminders RLS
ALTER TABLE IF EXISTS reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own reminders"
  ON reminders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can create own reminders"
  ON reminders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update own reminders"
  ON reminders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can delete own reminders"
  ON reminders FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Grant necessary table permissions
GRANT SELECT ON kb_articles TO authenticated;
GRANT SELECT ON workflows TO authenticated;
GRANT SELECT ON sla_configs TO authenticated;
GRANT ALL ON reminders TO authenticated;

COMMENT ON POLICY "Anyone can view KB articles" ON kb_articles IS 'Knowledge base articles are publicly readable';
COMMENT ON POLICY "Staff can view workflows" ON workflows IS 'Only staff roles can view automation workflows';
COMMENT ON POLICY "Admins can manage workflows" ON workflows IS 'Only admins can create, update, or delete workflows';
COMMENT ON POLICY "Users can view own reminders" ON reminders IS 'Users can only access their own reminders';
