-- Notification outbox for the daily activate-pending-members cron.
--
-- When a Pending contact/member auto-activates (its coverage start date has
-- arrived), the cron enqueues one row here and a second pass emails the
-- assigned rep via Resend — mirroring the age-65 cancellation outbox pattern
-- (202605060009 / 202605060010). The status flip already happens and is logged
-- to crm_stage_history; this table only governs the rep email so a send failure
-- can never block or roll back an activation.
--
-- Idempotent: one row per (record_id, activation_date). Re-runs of the cron
-- upsert with ON CONFLICT DO NOTHING, so no duplicate emails.

CREATE TABLE IF NOT EXISTS public.crm_activation_outbox (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id              uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  record_id           uuid        NOT NULL REFERENCES public.crm_records(id) ON DELETE CASCADE,
  member_name         text,
  member_email        text,
  activation_date     date        NOT NULL,
  new_status          text,
  rep_user_id         uuid,
  rep_email           text,
  rep_name            text,
  notified_at         timestamptz,
  notification_error  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_outbox_unsent
  ON public.crm_activation_outbox (created_at)
  WHERE notified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_activation_outbox_record
  ON public.crm_activation_outbox (record_id);

-- One outbox row per record per activation_date — re-runs must not enqueue
-- duplicate emails.
CREATE UNIQUE INDEX IF NOT EXISTS uq_activation_outbox_record_date
  ON public.crm_activation_outbox (record_id, activation_date);

-- RLS: service role manages everything; org admins/managers may read.
ALTER TABLE public.crm_activation_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activation_outbox_service" ON public.crm_activation_outbox;
CREATE POLICY "activation_outbox_service" ON public.crm_activation_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "activation_outbox_org_read" ON public.crm_activation_outbox;
CREATE POLICY "activation_outbox_org_read" ON public.crm_activation_outbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = crm_activation_outbox.org_id
         AND p.crm_role IN ('crm_admin', 'crm_manager')
    )
  );

COMMENT ON TABLE public.crm_activation_outbox IS
  'Rep-notification queue for auto-activated contacts/members. Drained by the activate-pending-members Vercel cron. Unique on (record_id, activation_date) for idempotency.';

NOTIFY pgrst, 'reload schema';
