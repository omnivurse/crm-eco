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

-- Add missing columns to existing tasks table
DO $$
BEGIN
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS record_id UUID;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS record_type TEXT;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create indexes only if columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'organization_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'status') THEN
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(organization_id, status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date') THEN
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(organization_id, due_date);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'record_id') THEN
    CREATE INDEX IF NOT EXISTS idx_tasks_record ON tasks(record_id);
  END IF;
END $$;

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

-- Add missing columns to existing notes table
DO $$
BEGIN
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Untitled';
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS content TEXT;
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS record_id UUID;
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS record_type TEXT;
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'general';
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS color TEXT;
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create indexes only if columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(user_id, created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'is_pinned') THEN
      CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(user_id) WHERE is_pinned = TRUE;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'organization_id') THEN
    CREATE INDEX IF NOT EXISTS idx_notes_org ON notes(organization_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'record_id') THEN
    CREATE INDEX IF NOT EXISTS idx_notes_record ON notes(record_id);
  END IF;
END $$;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_user_access ON notes;
CREATE POLICY notes_user_access ON notes
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- DONE
-- ============================================================================
