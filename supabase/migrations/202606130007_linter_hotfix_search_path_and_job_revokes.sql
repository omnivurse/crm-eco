-- Hotfix: close remaining linter gaps after phased remediation
-- 1) _crm_jsonb_value_is_blank recreated without search_path (202606130002 applied after phase 1)
-- 2) get_pending_jobs / complete_job are not SECURITY DEFINER but still API-callable by anon

BEGIN;

ALTER FUNCTION public._crm_jsonb_value_is_blank(jsonb)
  SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.get_pending_jobs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_job(uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_pending_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
