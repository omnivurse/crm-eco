-- ============================================================================
-- Restrict INSERT on system tables to service_role only
-- Fixes: FAILURE #13 (unified_audit_logs), #14 (email_events),
--        #15 (admin_notifications), #16 (landing_page_events)
-- ============================================================================

-- #13: unified_audit_logs — revoke INSERT from authenticated, drop permissive policy
DROP POLICY IF EXISTS "authenticated_insert_audit_logs" ON public.unified_audit_logs;
REVOKE INSERT ON public.unified_audit_logs FROM authenticated;
REVOKE INSERT ON public.unified_audit_logs FROM anon;

-- #14: email_events — drop open INSERT policy, restrict to service_role
DROP POLICY IF EXISTS "System can insert email events" ON public.email_events;
REVOKE INSERT ON public.email_events FROM authenticated;
REVOKE INSERT ON public.email_events FROM anon;

-- #15: admin_notifications — drop open INSERT policy, restrict to service_role
DROP POLICY IF EXISTS "System can insert notifications" ON public.admin_notifications;
REVOKE INSERT ON public.admin_notifications FROM authenticated;
REVOKE INSERT ON public.admin_notifications FROM anon;

-- #16: landing_page_events — remove anon INSERT, restrict to service_role
DROP POLICY IF EXISTS "Anyone can insert landing page events" ON public.landing_page_events;
REVOKE INSERT ON public.landing_page_events FROM anon;
REVOKE INSERT ON public.landing_page_events FROM authenticated;

-- service_role bypasses RLS, so no new policies are needed for it.
-- All inserts to these tables must now go through service_role clients.
