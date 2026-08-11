SET lock_timeout = '5s';

INSERT INTO public.crm_feature_flags (flag_key, organization_id, enabled, description)
SELECT v.flag_key, NULL, false, v.description
FROM (VALUES
  ('crm.comms.foundation', 'Canonical communications foundation (outbox, inbound envelope, adapters)'),
  ('crm.comms.outbox_send', 'Route human email sends through email_send_outbox'),
  ('crm.comms.closed_loop', 'Resend closed-loop threading / exactly-once inbound'),
  ('crm.comms.collab', 'Assignment, snooze, SLA collaboration on inbox threads'),
  ('crm.comms.calendar_sync', 'Two-way calendar sync enhancements'),
  ('crm.comms.mailbox_oauth', 'Gmail / M365 mailbox OAuth (mail scopes)'),
  ('crm.comms.automation_ai', 'Templates strangler, sequences, AI assist gates'),
  ('crm.comms.kill_switch', 'Global kill switch — blocks new outbound provider submits when enabled')
) AS v(flag_key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_feature_flags f
  WHERE f.flag_key = v.flag_key AND f.organization_id IS NULL
);

ALTER TABLE public.inbox_conversations
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS workflow_status text,
  ADD COLUMN IF NOT EXISTS internal_note_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inbox_conversations_workflow_status_check'
  ) THEN
    ALTER TABLE public.inbox_conversations
      ADD CONSTRAINT inbox_conversations_workflow_status_check
      CHECK (
        workflow_status IS NULL OR workflow_status IN (
          'open', 'pending', 'waiting_on_contact', 'waiting_on_us',
          'snoozed', 'closed', 'spam'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned_to
  ON public.inbox_conversations (org_id, assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_snoozed_until
  ON public.inbox_conversations (org_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_sla_due
  ON public.inbox_conversations (org_id, sla_due_at)
  WHERE sla_due_at IS NOT NULL AND (workflow_status IS NULL OR workflow_status <> 'closed');
;
