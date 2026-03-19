-- Saved views — table already exists in production, this is a no-op reconciliation
-- The live table may have different columns than originally planned.
-- Just ensure it exists and has RLS enabled.

CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  page_key TEXT NOT NULL DEFAULT 'members',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns if table already exists (idempotent)
DO $$ BEGIN
  ALTER TABLE saved_views ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
  ALTER TABLE saved_views ADD COLUMN IF NOT EXISTS page_key TEXT NOT NULL DEFAULT 'members';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views(user_id, page_key);
CREATE INDEX IF NOT EXISTS idx_saved_views_org ON saved_views(organization_id, page_key);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own views"
    ON saved_views FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
