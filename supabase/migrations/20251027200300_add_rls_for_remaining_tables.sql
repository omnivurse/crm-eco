/*
  # Add RLS Policies for Remaining Unprotected Tables (Safe Version)

  1. Purpose
    - Add Row Level Security policies to tables without proper protection
    - Only applies to tables that exist
*/

-- kb_articles RLS (only if table exists)
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kb_articles' AND table_schema = 'public') THEN
  ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
  
  DROP POLICY IF EXISTS "Anyone can view KB articles" ON kb_articles;
  CREATE POLICY "Anyone can view KB articles"
    ON kb_articles FOR SELECT TO authenticated USING (true);
  
  DROP POLICY IF EXISTS "Only staff can create KB articles" ON kb_articles;
  CREATE POLICY "Only staff can create KB articles"
    ON kb_articles FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin'))
    );
  
  DROP POLICY IF EXISTS "Only staff can update KB articles" ON kb_articles;
  CREATE POLICY "Only staff can update KB articles"
    ON kb_articles FOR UPDATE TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin'))
    );
  
  DROP POLICY IF EXISTS "Only staff can delete KB articles" ON kb_articles;
  CREATE POLICY "Only staff can delete KB articles"
    ON kb_articles FOR DELETE TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin'))
    );
    
  GRANT SELECT ON kb_articles TO authenticated;
END IF;
END $$;

-- workflows RLS (only if table exists)
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows' AND table_schema = 'public') THEN
  ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
  
  DROP POLICY IF EXISTS "Staff can view workflows" ON workflows;
  CREATE POLICY "Staff can view workflows"
    ON workflows FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin'))
    );
  
  DROP POLICY IF EXISTS "Admins can manage workflows" ON workflows;
  CREATE POLICY "Admins can manage workflows"
    ON workflows FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
    );
    
  GRANT SELECT ON workflows TO authenticated;
END IF;
END $$;

-- sla_configs RLS (only if table exists)
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sla_configs' AND table_schema = 'public') THEN
  ALTER TABLE sla_configs ENABLE ROW LEVEL SECURITY;
  
  DROP POLICY IF EXISTS "Staff can view SLA configs" ON sla_configs;
  CREATE POLICY "Staff can view SLA configs"
    ON sla_configs FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'agent', 'admin', 'super_admin'))
    );
  
  DROP POLICY IF EXISTS "Admins can manage SLA configs" ON sla_configs;
  CREATE POLICY "Admins can manage SLA configs"
    ON sla_configs FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin'))
    );
    
  GRANT SELECT ON sla_configs TO authenticated;
END IF;
END $$;

-- reminders RLS (only if table exists)
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reminders' AND table_schema = 'public') THEN
  ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
  
  DROP POLICY IF EXISTS "Users can view own reminders" ON reminders;
  CREATE POLICY "Users can view own reminders"
    ON reminders FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  
  DROP POLICY IF EXISTS "Users can create own reminders" ON reminders;
  CREATE POLICY "Users can create own reminders"
    ON reminders FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
  
  DROP POLICY IF EXISTS "Users can update own reminders" ON reminders;
  CREATE POLICY "Users can update own reminders"
    ON reminders FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  
  DROP POLICY IF EXISTS "Users can delete own reminders" ON reminders;
  CREATE POLICY "Users can delete own reminders"
    ON reminders FOR DELETE TO authenticated
    USING (user_id = auth.uid());
    
  GRANT ALL ON reminders TO authenticated;
END IF;
END $$;
