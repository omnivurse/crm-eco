CREATE TABLE IF NOT EXISTS public.email_send_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  correlation_id text,
  sender_address text,
  from_name text,
  reply_to text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  cc_addresses text[] NOT NULL DEFAULT '{}',
  bcc_addresses text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  body_html text,
  body_text text,
  linked_contact_id uuid,
  linked_lead_id uuid,
  linked_deal_id uuid,
  conversation_id uuid REFERENCES public.inbox_conversations(id) ON DELETE SET NULL,
  draft_message_id uuid,
  status text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  leased_until timestamptz,
  leased_by text,
  provider text,
  provider_message_id text,
  provider_accepted_at timestamptz,
  last_error text,
  error_category text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_send_outbox_status_check CHECK (
    status IN (
      'queued', 'leased', 'provider_submitting', 'provider_accepted',
      'sent', 'failed', 'cancelled', 'dead_letter'
    )
  ),
  CONSTRAINT email_send_outbox_idempotency_uq UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_email_send_outbox_claim
  ON public.email_send_outbox (status, next_attempt_at)
  WHERE status IN ('queued', 'leased', 'failed');

CREATE INDEX IF NOT EXISTS idx_email_send_outbox_org
  ON public.email_send_outbox (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.provider_inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  connection_ref text,
  provider_event_id text,
  event_hash text NOT NULL,
  event_type text NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  payload_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  processed_at timestamptz,
  conversation_id uuid REFERENCES public.inbox_conversations(id) ON DELETE SET NULL,
  message_id uuid,
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_inbound_events_status_check CHECK (
    status IN ('received', 'processing', 'processed', 'ignored', 'failed', 'dead_letter')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_inbound_events_hash
  ON public.provider_inbound_events (provider, event_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_inbound_events_provider_id
  ON public.provider_inbound_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_inbound_events_claim
  ON public.provider_inbound_events (status, received_at)
  WHERE status IN ('received', 'failed');;
