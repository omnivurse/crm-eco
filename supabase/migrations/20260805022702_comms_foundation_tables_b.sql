CREATE TABLE IF NOT EXISTS public.communication_record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  message_id uuid,
  sent_email_id uuid,
  record_id uuid REFERENCES public.crm_records(id) ON DELETE CASCADE,
  ticket_id uuid,
  enrollment_id uuid,
  link_role text NOT NULL DEFAULT 'context',
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'system',
  confidence numeric(4,3),
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communication_record_links_role_check CHECK (
    link_role IN ('participant', 'context', 'owner', 'manual')
  ),
  CONSTRAINT communication_record_links_has_target CHECK (
    record_id IS NOT NULL OR ticket_id IS NOT NULL OR enrollment_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_record_links_conv_record
  ON public.communication_record_links (organization_id, conversation_id, record_id)
  WHERE conversation_id IS NOT NULL AND record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_record_links_record
  ON public.communication_record_links (organization_id, record_id)
  WHERE record_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.message_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  inbox_message_id uuid REFERENCES public.inbox_messages(id) ON DELETE CASCADE,
  sent_email_id uuid,
  participant_role text NOT NULL,
  address_normalized text NOT NULL,
  display_name text,
  record_id uuid REFERENCES public.crm_records(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_status text NOT NULL DEFAULT 'unresolved',
  confidence numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_participants_role_check CHECK (
    participant_role IN ('from', 'to', 'cc', 'bcc', 'reply_to')
  ),
  CONSTRAINT message_participants_resolution_check CHECK (
    resolution_status IN ('unresolved', 'matched', 'ambiguous', 'manual', 'ignored')
  )
);

CREATE INDEX IF NOT EXISTS idx_message_participants_address
  ON public.message_participants (organization_id, address_normalized);

CREATE INDEX IF NOT EXISTS idx_message_participants_message
  ON public.message_participants (inbox_message_id)
  WHERE inbox_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.comms_sync_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  connection_ref text NOT NULL,
  resource_key text NOT NULL,
  cursor_token text,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  lease_until timestamptz,
  last_success_at timestamptz,
  last_error text,
  full_resync_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comms_sync_cursors_uq UNIQUE (organization_id, provider, connection_ref, resource_key)
);

CREATE TABLE IF NOT EXISTS public.comms_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  source text NOT NULL,
  source_id uuid,
  error_category text,
  error text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comms_dead_letters_open
  ON public.comms_dead_letters (created_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inbox_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_internal_notes_conv
  ON public.inbox_internal_notes (conversation_id, created_at DESC);;
