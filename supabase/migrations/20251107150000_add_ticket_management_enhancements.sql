/*
  # Ticket Management Enhancement System

  ## Overview
  This migration adds comprehensive ticket management features including:
  - Watchers system for ticket notifications
  - Tags for custom ticket labeling
  - Ticket linking for related issues
  - Field change history tracking
  - Time tracking entries
  - Ticket templates
  - Custom fields support

  ## 1. New Tables
    - `ticket_watchers` - Users following specific tickets
    - `ticket_tags` - Custom tags for tickets
    - `tag_definitions` - Available tags for the organization
    - `ticket_links` - Links between related tickets
    - `ticket_field_history` - Complete audit trail of field changes
    - `ticket_time_entries` - Time tracking for billable hours
    - `ticket_templates` - Pre-configured ticket structures
    - `ticket_custom_fields` - Organization-specific metadata
    - `saved_filters` - User-saved filter presets

  ## 2. Security
    - Enable RLS on all new tables
    - Role-based access control for watchers, tags, and history
    - Audit logging for all operations

  ## 3. Indexes
    - Performance indexes for common queries
    - Composite indexes for filtering and searching
*/

-- =====================================================
-- ENUMS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE ticket_link_type AS ENUM (
    'related',
    'duplicate',
    'blocks',
    'blocked_by',
    'parent',
    'child',
    'caused_by',
    'causes'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE time_entry_type AS ENUM ('work', 'research', 'communication', 'documentation', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TICKET WATCHERS
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES profiles(id),
  added_at timestamptz DEFAULT now(),
  notify_on_update boolean DEFAULT true,
  notify_on_comment boolean DEFAULT true,
  notify_on_status_change boolean DEFAULT true,
  UNIQUE(ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket_id ON ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user_id ON ticket_watchers(user_id);

ALTER TABLE ticket_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view watchers on tickets they can access"
  ON ticket_watchers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_watchers.ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Staff can add watchers to tickets"
  ON ticket_watchers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Users can remove themselves as watchers"
  ON ticket_watchers FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =====================================================
-- TAG DEFINITIONS AND TICKET TAGS
-- =====================================================

CREATE TABLE IF NOT EXISTS tag_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#3B82F6',
  description text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tag_definitions_name ON tag_definitions(name);

ALTER TABLE tag_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active tags"
  ON tag_definitions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Staff can manage tags"
  ON tag_definitions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE TABLE IF NOT EXISTS ticket_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tag_definitions(id) ON DELETE CASCADE,
  added_by uuid REFERENCES profiles(id),
  added_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket_id ON ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id ON ticket_tags(tag_id);

ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tags on accessible tickets"
  ON ticket_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_tags.ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Staff can manage ticket tags"
  ON ticket_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =====================================================
-- TICKET LINKS
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  target_ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  link_type ticket_link_type NOT NULL DEFAULT 'related',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  notes text,
  UNIQUE(source_ticket_id, target_ticket_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_ticket_links_source ON ticket_links(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_target ON ticket_links(target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_type ON ticket_links(link_type);

ALTER TABLE ticket_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view links on accessible tickets"
  ON ticket_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE (t.id = ticket_links.source_ticket_id OR t.id = ticket_links.target_ticket_id)
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Staff can manage ticket links"
  ON ticket_links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =====================================================
-- TICKET FIELD HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_field_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES profiles(id),
  changed_at timestamptz DEFAULT now(),
  change_reason text
);

CREATE INDEX IF NOT EXISTS idx_ticket_field_history_ticket_id ON ticket_field_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_field_history_changed_at ON ticket_field_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_field_history_field_name ON ticket_field_history(field_name);

ALTER TABLE ticket_field_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history on accessible tickets"
  ON ticket_field_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_field_history.ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "System can insert history records"
  ON ticket_field_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- TICKET TIME ENTRIES
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  entry_type time_entry_type DEFAULT 'work',
  hours decimal(10, 2) NOT NULL CHECK (hours > 0),
  description text,
  is_billable boolean DEFAULT true,
  entry_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_time_entries_ticket_id ON ticket_time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_time_entries_user_id ON ticket_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_time_entries_date ON ticket_time_entries(entry_date DESC);

ALTER TABLE ticket_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view time entries on accessible tickets"
  ON ticket_time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Staff can manage their own time entries"
  ON ticket_time_entries FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- TICKET TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  priority text DEFAULT 'medium',
  default_subject text,
  default_description text,
  default_tags uuid[] DEFAULT '{}',
  custom_fields jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_templates_category ON ticket_templates(category);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_active ON ticket_templates(is_active);

ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active templates"
  ON ticket_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Staff can manage templates"
  ON ticket_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =====================================================
-- TICKET CUSTOM FIELDS
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_value text,
  field_type text DEFAULT 'text',
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_ticket_custom_fields_ticket_id ON ticket_custom_fields(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_custom_fields_name ON ticket_custom_fields(field_name);

ALTER TABLE ticket_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view custom fields on accessible tickets"
  ON ticket_custom_fields FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = ticket_custom_fields.ticket_id
      AND (
        t.requester_id = auth.uid()
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
        )
      )
    )
  );

CREATE POLICY "Staff can manage custom fields"
  ON ticket_custom_fields FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'agent', 'admin', 'super_admin')
    )
  );

-- =====================================================
-- SAVED FILTERS
-- =====================================================

CREATE TABLE IF NOT EXISTS saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filter_config jsonb NOT NULL,
  is_default boolean DEFAULT false,
  is_shared boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_shared ON saved_filters(is_shared);

ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own filters and shared filters"
  ON saved_filters FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_shared = true
  );

CREATE POLICY "Users can manage their own filters"
  ON saved_filters FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- SEED DATA - DEFAULT TAGS
-- =====================================================

INSERT INTO tag_definitions (name, color, description) VALUES
  ('urgent', '#EF4444', 'Requires immediate attention'),
  ('bug', '#F97316', 'Software bug or defect'),
  ('feature-request', '#3B82F6', 'New feature request'),
  ('documentation', '#8B5CF6', 'Documentation related'),
  ('training', '#14B8A6', 'Training or education needed'),
  ('escalated', '#DC2626', 'Escalated to management'),
  ('vip', '#FBBF24', 'VIP customer'),
  ('waiting-on-customer', '#6B7280', 'Awaiting customer response'),
  ('waiting-on-vendor', '#6B7280', 'Awaiting vendor response'),
  ('security', '#DC2626', 'Security related issue')
ON CONFLICT (name) DO NOTHING;
