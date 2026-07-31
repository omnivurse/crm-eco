-- =============================================================================
-- Fail closed: strip anon's EXECUTE on inbox_unread_by_mailbox().
--
-- 202607300001 revoked only FROM PUBLIC, which is a no-op against Supabase's
-- pg_default_acl for schema public — that default grants EXECUTE directly to
-- anon on every newly created function, and a direct grant is not removed by
-- revoking from PUBLIC. Verified on the live database: anon could call the
-- function.
--
-- No data was exposed: the function is SECURITY INVOKER and RLS returned zero
-- rows for anon. This closes it anyway, so the function can never become a
-- cross-tenant counting oracle if a policy is ever loosened.
--
-- Matches the convention already used by 202607290003_security_hardening_zero_trust.
-- Additive + idempotent. PROD WRITE RISK: YES (privilege change only, no data).
-- =============================================================================

SET lock_timeout = '5s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'inbox_unread_by_mailbox'
  ) THEN
    RAISE NOTICE 'inbox_unread_by_mailbox() not present; nothing to revoke';
    RETURN;
  END IF;

  REVOKE ALL ON FUNCTION public.inbox_unread_by_mailbox() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.inbox_unread_by_mailbox() FROM anon;
  GRANT EXECUTE ON FUNCTION public.inbox_unread_by_mailbox() TO authenticated;

  ASSERT NOT has_function_privilege('anon', 'public.inbox_unread_by_mailbox()', 'EXECUTE'),
    'anon still holds EXECUTE after revoke';
  ASSERT has_function_privilege('authenticated', 'public.inbox_unread_by_mailbox()', 'EXECUTE'),
    'authenticated lost EXECUTE — the inbox sidebar would break';

  RAISE NOTICE 'anon revoked; authenticated retained';
END $$;

-- Rollback notes (only if the sidebar somehow needs anon access, which it does not):
--   GRANT EXECUTE ON FUNCTION public.inbox_unread_by_mailbox() TO anon;
