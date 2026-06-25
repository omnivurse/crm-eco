-- Phase 0 / Enrollment Ops (SLICE E2): partial index powering the admin
-- "Abandoned Enrollments" surface. (ADDITIVE, idempotent.) [E2]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
--
-- WHAT: a single PARTIAL btree index on public.enrollments scoped to the rows the
--        abandoned-enrollments page scans: not-yet-submitted drafts/in-progress
--        applications, ordered for the page's .order('updated_at', asc) staleness scan.
--          (organization_id, updated_at) WHERE status IN ('draft','in_progress')
--                                          AND submitted_at IS NULL
--        The page's primary query is exactly
--          .eq('organization_id', org)
--          .in('status', ['draft','in_progress'])
--          .is('submitted_at', null)
--          .order('updated_at', { ascending: true })
--        so this partial index covers BOTH the WHERE selectivity AND the sort.
--
-- LOCK SAFETY: this uses a PLAIN CREATE INDEX (deliberately NOT CONCURRENTLY) so it
--        is transaction-safe under the standard `supabase db push` runner, which
--        applies each migration inside a transaction — CREATE INDEX CONCURRENTLY would
--        error 25001 (cannot run inside a transaction block) on that path. A plain
--        build takes a brief SHARE lock that blocks writes only for the duration of the
--        build; on the PIF enrollments table (~1.1k rows per the deploy-gate floor) that
--        is sub-second, so it is safe on the live table.
--        IF this table ever grows large enough that a sub-second SHARE lock is
--        unacceptable, build the index OUT-OF-BAND instead (do NOT put CONCURRENTLY in a
--        db-push migration):
--          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_abandoned
--            ON public.enrollments (organization_id, updated_at)
--            WHERE status IN ('draft','in_progress') AND submitted_at IS NULL;
--        run standalone via psql (CONCURRENTLY cannot run inside a transaction), and
--        pre-check pg_index.indisvalid (an interrupted CONCURRENTLY build leaves an
--        INVALID index of the same name that IF NOT EXISTS would then skip).
--
-- ADDITIVE: creates ONE new index object; touches NO existing policy / function /
--        constraint / column / index. IF NOT EXISTS makes a re-run a no-op.
-- COLLISION CHECK: idx_enrollments_abandoned confirmed ABSENT on PIF prod (read-only
--        schema audit 2026-06-24) and on the local replica. Partial predicate mirrors
--        the house idiom (idx_enrollments_review_sla in 202606240001).
-- Refs: baseline public.enrollments; existing idx_enrollments_org_status_date is FULL
--        (not partial) and does NOT cover the submitted_at IS NULL filter.

CREATE INDEX IF NOT EXISTS idx_enrollments_abandoned
  ON public.enrollments (organization_id, updated_at)
  WHERE status IN ('draft', 'in_progress') AND submitted_at IS NULL;

NOTIFY pgrst, 'reload schema';

-- Rollback (E2): purely additive — safe to drop with no data impact.
--   DROP INDEX IF EXISTS public.idx_enrollments_abandoned;
