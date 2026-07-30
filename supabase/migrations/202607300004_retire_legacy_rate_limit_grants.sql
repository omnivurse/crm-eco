-- Retire the legacy rate-limit functions by taking back public execute rights.
--
-- WHY: public.check_rate_limit() and public.cleanup_rate_limits() are both
-- SECURITY DEFINER, and the baseline schema granted EXECUTE on them to anon and
-- authenticated (see 00000000000000_baseline.sql). Nothing has ever revoked it.
-- That means any unauthenticated caller can:
--
--   * run cleanup_rate_limits() and delete every rate-limit counter, and
--   * run check_rate_limit('<any identifier>', '<any endpoint>', 1, 3600) to
--     drive another user's counter over its cap — locking that specific person
--     out of login, password reset, or invites.
--
-- Impact today is nil: public.rate_limits holds zero rows and no application
-- code calls either function, so this migration changes no working behaviour.
-- It closes the hole before anything starts relying on those counters.
--
-- RETIRED, NOT DROPPED. Keeping the objects makes this trivially reversible, and
-- a future caller then fails with a clear permission error instead of a missing
-- function. public.consume_rate_limit() (202607290003) is the supported entry
-- point: it is service-role only, returns hit count and retry-after so callers
-- can emit accurate Retry-After headers, and keeps one self-resetting row per
-- key rather than one row per key per window.
--
-- Note the REVOKE ... FROM public lines: CREATE FUNCTION grants EXECUTE to the
-- PUBLIC pseudo-role by default, and anon would inherit through it even after the
-- direct grants are removed.
--
-- ROLLBACK (restores the previous, weaker state):
--   grant execute on function public.check_rate_limit(text,text,integer,integer) to anon, authenticated;
--   grant execute on function public.cleanup_rate_limits() to anon, authenticated;

set local lock_timeout = '5s';

-- Guarded so this stays idempotent and stays applyable if either function has
-- already been dropped in some environment.
do $$
begin
  -- to_regprocedure() resolves the signature and returns null when absent.
  -- (Do not compare pg_get_function_identity_arguments here: it includes the
  -- parameter names, e.g. 'p_identifier text, ...', so a bare type-list never
  -- matches and the revoke would be silently skipped.)
  if to_regprocedure('public.check_rate_limit(text,text,integer,integer)') is not null then
    execute 'revoke all on function public.check_rate_limit(text, text, integer, integer) from public';
    execute 'revoke all on function public.check_rate_limit(text, text, integer, integer) from anon';
    execute 'revoke all on function public.check_rate_limit(text, text, integer, integer) from authenticated';
    execute $c$comment on function public.check_rate_limit(text, text, integer, integer) is
      'RETIRED. Superseded by public.consume_rate_limit(). Service-role only; EXECUTE was revoked from anon/authenticated because this is SECURITY DEFINER and any caller could inflate another identifier''s counter.'$c$;
    raise notice 'retired grants on public.check_rate_limit(text, text, integer, integer)';
  else
    raise notice 'public.check_rate_limit(text, text, integer, integer) not present; nothing to revoke';
  end if;

  if to_regprocedure('public.cleanup_rate_limits()') is not null then
    execute 'revoke all on function public.cleanup_rate_limits() from public';
    execute 'revoke all on function public.cleanup_rate_limits() from anon';
    execute 'revoke all on function public.cleanup_rate_limits() from authenticated';
    execute $c$comment on function public.cleanup_rate_limits() is
      'RETIRED. Superseded by public.gc_security_rate_limits(). Service-role only; EXECUTE was revoked from anon/authenticated because any caller could delete every rate-limit counter.'$c$;
    raise notice 'retired grants on public.cleanup_rate_limits()';
  else
    raise notice 'public.cleanup_rate_limits() not present; nothing to revoke';
  end if;
end $$;
