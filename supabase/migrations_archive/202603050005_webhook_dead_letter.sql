-- Dead-letter table for webhook events that could not be matched
-- to a sent_email record (e.g. due to insert timing delays).
CREATE TABLE IF NOT EXISTS webhook_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  reason text,
  reconciled boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dead_letter_unreconciled
  ON webhook_dead_letter (provider, provider_message_id)
  WHERE NOT reconciled;
