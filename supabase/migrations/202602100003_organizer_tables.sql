-- ============================================================================
-- ORGANIZER TABLES
-- Standalone tasks and notes for personal/user-level organization
-- ============================================================================

-- ============================================================================
-- TASKS (standalone, user-level tasks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Task details
  title TEXT NOT NULL,
  description TEXT,

  -- Scheduling
  due_date TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,

  -- Status and priority
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Optional link to CRM record
  record_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  record_type TEXT, -- 'contact', 'lead', 'deal', etc.

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(organization_id, due_date) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_record ON tasks(record_id) WHERE record_id IS NOT NULL;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_org_access ON tasks;
CREATE POLICY tasks_org_access ON tasks
  FOR ALL TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================================================
-- NOTES (standalone, user-level notes/scratchpad)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Note content
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT,

  -- Optional link to CRM record
  record_id UUID REFERENCES crm_records(id) ON DELETE SET NULL,
  record_type TEXT,

  -- Organization
  folder TEXT DEFAULT 'general',
  is_pinned BOOLEAN DEFAULT FALSE,
  color TEXT,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_org ON notes(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(user_id) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_record ON notes(record_id) WHERE record_id IS NOT NULL;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_user_access ON notes;
CREATE POLICY notes_user_access ON notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- DONE
-- ============================================================================
