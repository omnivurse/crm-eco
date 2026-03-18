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

CREATE INDEX idx_saved_views_user ON saved_views(user_id, page_key);
CREATE INDEX idx_saved_views_org ON saved_views(organization_id, page_key);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own views"
  ON saved_views
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
