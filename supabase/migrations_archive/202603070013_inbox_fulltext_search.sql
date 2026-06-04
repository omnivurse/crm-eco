-- ============================================================================
-- Inbox Full-Text Search
-- Add tsvector column to inbox_messages for fast content search
-- ============================================================================

-- Add search vector column
ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_inbox_messages_search
  ON inbox_messages USING gin(search_vector);

-- Function to auto-populate search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_inbox_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.from_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.from_address, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.body_text, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(
      regexp_replace(COALESCE(NEW.body_html, ''), '<[^>]*>', ' ', 'g'),
      ''
    )), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inbox_messages_search_vector
  BEFORE INSERT OR UPDATE OF subject, from_name, from_address, body_text, body_html
  ON inbox_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_inbox_message_search_vector();

-- Backfill existing records
UPDATE inbox_messages SET search_vector =
  setweight(to_tsvector('english', COALESCE(subject, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(from_name, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(from_address, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(body_text, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(
    regexp_replace(COALESCE(body_html, ''), '<[^>]*>', ' ', 'g'),
    ''
  )), 'D')
WHERE search_vector IS NULL;

COMMENT ON COLUMN inbox_messages.search_vector IS 'Full-text search vector: A=subject, B=from, C=body_text, D=body_html';
