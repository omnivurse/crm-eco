-- Restrict internal analytics projectors to trusted server-side callers.
-- Supabase grants new public functions directly to anon/authenticated by default,
-- so revoking PUBLIC alone does not remove those role-specific grants.
--
-- Rollback (security regression; emergency use only): grant EXECUTE on these
-- three signatures back to anon/authenticated.

BEGIN;

SET lock_timeout = '5s';

REVOKE EXECUTE ON FUNCTION public.emit_analytics_event(
  uuid,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  text
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.project_analytics_snapshot(uuid, date)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.project_daily_analytics_snapshots()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.emit_analytics_event(
  uuid,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.project_analytics_snapshot(uuid, date)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.project_daily_analytics_snapshots()
  TO service_role;

-- Fail the migration if direct Data API execution remains possible.
DO $verify$
DECLARE
  v_signature regprocedure;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.emit_analytics_event(uuid,text,text,uuid,jsonb,jsonb,text)'::regprocedure,
    'public.project_analytics_snapshot(uuid,date)'::regprocedure,
    'public.project_daily_analytics_snapshots()'::regprocedure
  ]
  LOOP
    IF has_function_privilege('anon', v_signature::oid, 'EXECUTE')
      OR has_function_privilege('authenticated', v_signature::oid, 'EXECUTE')
    THEN
      RAISE EXCEPTION
        'analytics function % remains executable by an API role',
        v_signature;
    END IF;

    IF NOT has_function_privilege('service_role', v_signature::oid, 'EXECUTE') THEN
      RAISE EXCEPTION
        'analytics function % is not executable by service_role',
        v_signature;
    END IF;
  END LOOP;
END;
$verify$;

COMMIT;
