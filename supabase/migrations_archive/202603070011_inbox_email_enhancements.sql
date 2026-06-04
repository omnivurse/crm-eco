-- ============================================================================
-- Inbox Email Enhancements
-- Add RFC 822 email headers and CC/BCC support to inbox_messages
-- ============================================================================

-- Add email-specific columns to inbox_messages for proper threading
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS cc_addresses JSONB NOT NULL DEFAULT '[]';
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS bcc_addresses JSONB NOT NULL DEFAULT '[]';
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS reply_to_address TEXT;
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS message_id TEXT;      -- RFC 822 Message-ID header
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS in_reply_to TEXT;     -- RFC 822 In-Reply-To header
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS references_ids TEXT[];-- RFC 822 References header

-- Index for thread lookups by Message-ID
CREATE INDEX IF NOT EXISTS idx_inbox_messages_message_id
  ON inbox_messages(message_id) WHERE message_id IS NOT NULL;

-- Index for finding replies
CREATE INDEX IF NOT EXISTS idx_inbox_messages_in_reply_to
  ON inbox_messages(in_reply_to) WHERE in_reply_to IS NOT NULL;

-- Partial index for unread conversations (speeds up inbox badge counts)
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_unread
  ON inbox_conversations(org_id, status)
  WHERE unread_count > 0;

COMMENT ON COLUMN inbox_messages.message_id IS 'RFC 822 Message-ID header for email threading';
COMMENT ON COLUMN inbox_messages.in_reply_to IS 'RFC 822 In-Reply-To header for reply chain';
COMMENT ON COLUMN inbox_messages.references_ids IS 'RFC 822 References header for full thread chain';
COMMENT ON COLUMN inbox_messages.cc_addresses IS 'Array of CC recipients as [{email, name}]';
COMMENT ON COLUMN inbox_messages.bcc_addresses IS 'Array of BCC recipients as [{email, name}]';
