-- Default privileges grant EXECUTE on new public functions to anon +
-- authenticated. These History helpers are SECURITY DEFINER and must not be
-- PostgREST-callable. Trigger still fires as table owner.
--
-- Rollback: GRANT EXECUTE … TO anon, authenticated (not recommended).

SET lock_timeout = '5s';

REVOKE ALL ON FUNCTION public.crm_find_person_record_in_module(uuid, uuid, uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_find_person_record_in_module(uuid, uuid, uuid, text, text, text, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_append_person_lifecycle_event(uuid, uuid, text, text, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.crm_backfill_cancelled_lifecycle_events(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.crm_history_roster_bind()
  FROM PUBLIC, anon, authenticated;
