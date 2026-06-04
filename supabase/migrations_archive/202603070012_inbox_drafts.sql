-- ============================================================================
-- Inbox Drafts
-- Store email drafts with auto-save support and scheduled send
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES inbox_conversations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_addresses JSONB NOT NULL DEFAULT '[]',
  cc_addresses JSONB NOT NULL DEFAULT '[]',
  bcc_addresses JSONB NOT NULL DEFAULT '[]',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  signature_id UUID REFERENCES email_signatures(id) ON DELETE SET NULL,
  attachments JSONB NOT NULL DEFAULT '[]',
  scheduled_at TIMESTAMPTZ,
  is_reply BOOLEAN NOT NULL DEFAULT FALSE,
  reply_mode TEXT CHECK (reply_mode IN ('reply', 'reply_all', 'forward')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: author can access own drafts within their org
ALTER TABLE inbox_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY inbox_drafts_select ON inbox_drafts
  FOR SELECT TO authenticated
  USING (
    org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    AND author_id = (SELECT auth.uid())
  );

CREATE POLICY inbox_drafts_insert ON inbox_drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    AND author_id = (SELECT auth.uid())
  );

CREATE POLICY inbox_drafts_update ON inbox_drafts
  FOR UPDATE TO authenticated
  USING (
    org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    AND author_id = (SELECT auth.uid())
  );

CREATE POLICY inbox_drafts_delete ON inbox_drafts
  FOR DELETE TO authenticated
  USING (
    org_id = (SELECT organization_id FROM profiles WHERE id = (SELECT auth.uid()))
    AND author_id = (SELECT auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbox_drafts_author
  ON inbox_drafts(author_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_drafts_conversation
  ON inbox_drafts(conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_drafts_scheduled
  ON inbox_drafts(scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_inbox_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inbox_drafts_updated_at
  BEFORE UPDATE ON inbox_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_inbox_drafts_updated_at();

COMMENT ON TABLE inbox_drafts IS 'Email drafts with auto-save and scheduled send support';
COMMENT ON COLUMN inbox_drafts.conversation_id IS 'NULL for new compose, set for reply/forward drafts';
COMMENT ON COLUMN inbox_drafts.scheduled_at IS 'When set, draft will be sent at this time by the scheduler';
