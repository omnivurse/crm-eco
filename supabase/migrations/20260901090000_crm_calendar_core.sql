-- ============================================================================
-- CRM Calendar core — native meetings with attendees and email invites (iTIP)
-- ----------------------------------------------------------------------------
-- Live state (2026-08-30, project sffisarikcreyyjzdjvb):
--   public.calendar_events EXISTS but is the external-provider sync mirror
--   (connection_id/external_id NOT NULL) — it cannot hold CRM-authored
--   meetings, hence the new crm_calendar_* names.
--   public.crm_calendar_events / public.crm_calendar_event_attendees do not exist.
--   Helpers public.is_crm_member(uuid), public.has_crm_role(uuid, text[]),
--   public.is_super_admin(), public.set_updated_at() exist.
--
-- Purpose: the single source of truth for CRM-authored meetings. Attendees
-- carry per-person RSVP state written by tokenized links today and iTIP REPLY
-- parsing later; ical_uid/ical_sequence implement RFC 5546 update semantics.
-- Recurrence columns are present but unexpanded by v1 application code
-- (invites are refused for recurring events until that ships).
--
-- Additive + idempotent. PROD WRITE RISK: YES (new tables + policies).
-- Do not apply until explicitly approved.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.crm_calendar_event_attendees;
--   DROP TABLE IF EXISTS public.crm_calendar_events;
-- ============================================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.crm_calendar_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title                text NOT NULL,
  description          text,
  location             text,
  meeting_url          text,
  start_at             timestamptz NOT NULL,
  end_at               timestamptz NOT NULL,
  all_day              boolean NOT NULL DEFAULT false,
  timezone             text NOT NULL DEFAULT 'UTC',
  status               text NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  -- iCalendar identity shared by invites, per-event .ics, and future sync
  ical_uid             text NOT NULL DEFAULT (gen_random_uuid()::text || '@crm-eco'),
  ical_sequence        integer NOT NULL DEFAULT 0,
  -- recurrence (stored, not yet expanded by application code)
  recurrence_rule      text,
  recurrence_parent_id uuid REFERENCES public.crm_calendar_events(id) ON DELETE CASCADE,
  original_start_at    timestamptz,
  -- CRM links
  record_id            uuid REFERENCES public.crm_records(id) ON DELETE SET NULL,
  conversation_id      uuid REFERENCES public.inbox_conversations(id) ON DELETE SET NULL,
  source               text NOT NULL DEFAULT 'crm'
                         CHECK (source IN ('crm', 'inbox', 'booking', 'import')),
  reminder_minutes     integer CHECK (reminder_minutes BETWEEN 0 AND 40320),
  metadata             jsonb NOT NULL DEFAULT '{}',
  cancelled_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_calendar_events_time_valid CHECK (end_at >= start_at),
  CONSTRAINT crm_calendar_events_exception_shape
    CHECK ((recurrence_parent_id IS NULL) = (original_start_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_calendar_events_org_uid_uidx
  ON public.crm_calendar_events (organization_id, ical_uid);

CREATE INDEX IF NOT EXISTS idx_crm_calendar_events_org_start
  ON public.crm_calendar_events (organization_id, start_at);

CREATE INDEX IF NOT EXISTS idx_crm_calendar_events_org_owner_start
  ON public.crm_calendar_events (organization_id, owner_id, start_at);

CREATE INDEX IF NOT EXISTS idx_crm_calendar_events_record
  ON public.crm_calendar_events (record_id) WHERE record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_calendar_events_conversation
  ON public.crm_calendar_events (conversation_id) WHERE conversation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_calendar_event_attendees (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id         uuid NOT NULL REFERENCES public.crm_calendar_events(id) ON DELETE CASCADE,
  profile_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  record_id        uuid REFERENCES public.crm_records(id) ON DELETE SET NULL,
  email            text NOT NULL,
  name             text,
  role             text NOT NULL DEFAULT 'required'
                     CHECK (role IN ('organizer', 'required', 'optional')),
  rsvp_status      text NOT NULL DEFAULT 'needs_action'
                     CHECK (rsvp_status IN ('needs_action', 'accepted', 'declined', 'tentative')),
  rsvp_at          timestamptz,
  response_source  text CHECK (response_source IN ('itip_reply', 'link', 'manual', 'provider')),
  rsvp_token       uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_sequence integer,
  invited_at       timestamptz,
  reminder_sent_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_calendar_event_attendees_email_len
    CHECK (char_length(btrim(email)) BETWEEN 3 AND 320)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_cal_attendees_event_email_uidx
  ON public.crm_calendar_event_attendees (event_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS crm_cal_attendees_token_uidx
  ON public.crm_calendar_event_attendees (rsvp_token);

CREATE INDEX IF NOT EXISTS idx_crm_cal_attendees_org_email
  ON public.crm_calendar_event_attendees (organization_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_crm_cal_attendees_record
  ON public.crm_calendar_event_attendees (record_id) WHERE record_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_crm_calendar_events ON public.crm_calendar_events;
CREATE TRIGGER set_updated_at_crm_calendar_events
  BEFORE UPDATE ON public.crm_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_crm_calendar_event_attendees ON public.crm_calendar_event_attendees;
CREATE TRIGGER set_updated_at_crm_calendar_event_attendees
  BEFORE UPDATE ON public.crm_calendar_event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.crm_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calendar_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calendar_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_calendar_event_attendees FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.crm_calendar_events FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_calendar_events FROM anon;
REVOKE ALL ON TABLE public.crm_calendar_event_attendees FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_calendar_event_attendees FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_calendar_event_attendees TO authenticated;
GRANT ALL ON TABLE public.crm_calendar_events TO service_role;
GRANT ALL ON TABLE public.crm_calendar_event_attendees TO service_role;

-- Reads: any CRM member of the org. Writes: crm agents and up (matches the
-- crm_records permission story — whoever can edit a contact can schedule).
DROP POLICY IF EXISTS "CRM members can view org calendar events" ON public.crm_calendar_events;
CREATE POLICY "CRM members can view org calendar events"
  ON public.crm_calendar_events FOR SELECT TO authenticated
  USING (public.is_crm_member(organization_id));

DROP POLICY IF EXISTS "CRM agents can add calendar events" ON public.crm_calendar_events;
CREATE POLICY "CRM agents can add calendar events"
  ON public.crm_calendar_events FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM agents can update calendar events" ON public.crm_calendar_events;
CREATE POLICY "CRM agents can update calendar events"
  ON public.crm_calendar_events FOR UPDATE TO authenticated
  USING (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']))
  WITH CHECK (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM agents can delete calendar events" ON public.crm_calendar_events;
CREATE POLICY "CRM agents can delete calendar events"
  ON public.crm_calendar_events FOR DELETE TO authenticated
  USING (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM members can view org event attendees" ON public.crm_calendar_event_attendees;
CREATE POLICY "CRM members can view org event attendees"
  ON public.crm_calendar_event_attendees FOR SELECT TO authenticated
  USING (public.is_crm_member(organization_id));

DROP POLICY IF EXISTS "CRM agents can add event attendees" ON public.crm_calendar_event_attendees;
CREATE POLICY "CRM agents can add event attendees"
  ON public.crm_calendar_event_attendees FOR INSERT TO authenticated
  WITH CHECK (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM agents can update event attendees" ON public.crm_calendar_event_attendees;
CREATE POLICY "CRM agents can update event attendees"
  ON public.crm_calendar_event_attendees FOR UPDATE TO authenticated
  USING (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']))
  WITH CHECK (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS "CRM agents can delete event attendees" ON public.crm_calendar_event_attendees;
CREATE POLICY "CRM agents can delete event attendees"
  ON public.crm_calendar_event_attendees FOR DELETE TO authenticated
  USING (public.has_crm_role(organization_id, ARRAY['crm_admin', 'crm_manager', 'crm_agent']));

DROP POLICY IF EXISTS service_role_all_crm_calendar_events ON public.crm_calendar_events;
CREATE POLICY service_role_all_crm_calendar_events
  ON public.crm_calendar_events TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_crm_calendar_event_attendees ON public.crm_calendar_event_attendees;
CREATE POLICY service_role_all_crm_calendar_event_attendees
  ON public.crm_calendar_event_attendees TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.crm_calendar_events IS
  'CRM-authored meetings (native calendar). External-provider mirrors stay in calendar_events. ical_uid + ical_sequence drive RFC 5546 invite updates.';
COMMENT ON TABLE public.crm_calendar_event_attendees IS
  'Per-attendee RSVP source of truth. rsvp_token backs one-click accept/decline links; invited_sequence records the last iTIP SEQUENCE each attendee was sent.';

NOTIFY pgrst, 'reload schema';
