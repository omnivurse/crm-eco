-- Prevent concurrent plan-scheduling requests from creating two future plans
-- for the same member. The application checks for an existing pending row, but
-- only a database constraint can make that check race-safe.
--
-- Live-state preflight on 2026-08-12 found zero members with duplicate pending
-- memberships, so this is additive and does not rewrite existing rows.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.uq_memberships_one_pending_per_member;

SET lock_timeout = '5s';

CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_one_pending_per_member
  ON public.memberships (member_id)
  WHERE status = 'pending';
