DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_org_tenant_key') THEN
    DROP TRIGGER IF EXISTS trg_email_send_outbox_tenant ON public.email_send_outbox;
    CREATE TRIGGER trg_email_send_outbox_tenant
      BEFORE INSERT OR UPDATE ON public.email_send_outbox
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();

    DROP TRIGGER IF EXISTS trg_provider_inbound_events_tenant ON public.provider_inbound_events;
    CREATE TRIGGER trg_provider_inbound_events_tenant
      BEFORE INSERT OR UPDATE ON public.provider_inbound_events
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();

    DROP TRIGGER IF EXISTS trg_communication_record_links_tenant ON public.communication_record_links;
    CREATE TRIGGER trg_communication_record_links_tenant
      BEFORE INSERT OR UPDATE ON public.communication_record_links
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();

    DROP TRIGGER IF EXISTS trg_message_participants_tenant ON public.message_participants;
    CREATE TRIGGER trg_message_participants_tenant
      BEFORE INSERT OR UPDATE ON public.message_participants
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();

    DROP TRIGGER IF EXISTS trg_comms_sync_cursors_tenant ON public.comms_sync_cursors;
    CREATE TRIGGER trg_comms_sync_cursors_tenant
      BEFORE INSERT OR UPDATE ON public.comms_sync_cursors
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();

    DROP TRIGGER IF EXISTS trg_inbox_internal_notes_tenant ON public.inbox_internal_notes;
    CREATE TRIGGER trg_inbox_internal_notes_tenant
      BEFORE INSERT OR UPDATE ON public.inbox_internal_notes
      FOR EACH ROW EXECUTE FUNCTION public.sync_org_tenant_key();
  END IF;
END $$;

ALTER TABLE public.email_send_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_record_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comms_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comms_dead_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_internal_notes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'email_send_outbox',
    'provider_inbound_events',
    'communication_record_links',
    'message_participants',
    'comms_sync_cursors',
    'comms_dead_letters',
    'inbox_internal_notes'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff_delete', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I
      FOR SELECT TO authenticated
      USING (
        public.is_staff_or_admin()
        AND (
          public.is_super_admin()
          OR organization_id = public.get_user_organization_id()
          OR org_id = public.get_user_organization_id()
        )
      )
    $p$, t || '_staff_select', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_staff_or_admin()
        AND (
          public.is_super_admin()
          OR organization_id = public.get_user_organization_id()
          OR org_id = public.get_user_organization_id()
        )
      )
    $p$, t || '_staff_insert', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I
      FOR UPDATE TO authenticated
      USING (
        public.is_staff_or_admin()
        AND (
          public.is_super_admin()
          OR organization_id = public.get_user_organization_id()
          OR org_id = public.get_user_organization_id()
        )
      )
      WITH CHECK (
        public.is_staff_or_admin()
        AND (
          public.is_super_admin()
          OR organization_id = public.get_user_organization_id()
          OR org_id = public.get_user_organization_id()
        )
      )
    $p$, t || '_staff_update', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I
      FOR DELETE TO authenticated
      USING (
        public.is_staff_or_admin()
        AND (
          public.is_super_admin()
          OR organization_id = public.get_user_organization_id()
          OR org_id = public.get_user_organization_id()
        )
      )
    $p$, t || '_staff_delete', t);
  END LOOP;
END $$;

REVOKE ALL ON public.email_send_outbox FROM anon, public;
REVOKE ALL ON public.provider_inbound_events FROM anon, public;
REVOKE ALL ON public.communication_record_links FROM anon, public;
REVOKE ALL ON public.message_participants FROM anon, public;
REVOKE ALL ON public.comms_sync_cursors FROM anon, public;
REVOKE ALL ON public.comms_dead_letters FROM anon, public;
REVOKE ALL ON public.inbox_internal_notes FROM anon, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_send_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_inbound_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_record_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_sync_cursors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_dead_letters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_internal_notes TO authenticated;

GRANT ALL ON public.email_send_outbox TO service_role;
GRANT ALL ON public.provider_inbound_events TO service_role;
GRANT ALL ON public.communication_record_links TO service_role;
GRANT ALL ON public.message_participants TO service_role;
GRANT ALL ON public.comms_sync_cursors TO service_role;
GRANT ALL ON public.comms_dead_letters TO service_role;
GRANT ALL ON public.inbox_internal_notes TO service_role;

NOTIFY pgrst, 'reload schema';;
