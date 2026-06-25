-- Phase 0 / Enrollment Ops (SLICE E2): partial index powering the admin
-- "Abandoned Enrollments" surface. (ADDITIVE, idempotent, CONCURRENTLY.) [E2]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: DRAFT — not applied. Lives in supabase/drafts/ so it does NOT auto-run.
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
-- RISK: TIER-1 lock-safety only (NOT money/state). enrollments is a HOT, daily-use
--        table. A plain `CREATE INDEX` takes a SHARE lock that blocks INSERT/UPDATE/
--        DELETE for the whole build — unacceptable on a live enrollment table. We
--        therefore use CREATE INDEX CONCURRENTLY, which builds without blocking
--        writes. This is purely additive: it creates ONE new index object and
--        touches NO existing policy / function / constraint / column / index.
--
-- CONCURRENTLY CONSTRAINTS (read before promoting):
--   * CREATE INDEX CONCURRENTLY CANNOT run inside a transaction block — it errors
--     25001 (active sql transaction) if wrapped. This file therefore has NO
--     BEGIN/COMMIT and the runner for this file MUST NOT auto-wrap it in a txn.
--     (Unlike the other phase-0 drafts which rely on the runner's per-file txn,
--     this one is explicitly out-of-txn.) Run it standalone, e.g.
--       psql "$DATABASE_URL" -f 202606240007_enrollments_abandoned_index.sql
--   * IF NOT EXISTS makes a re-run a no-op (skips the build) — idempotent.
--   * If a prior CONCURRENTLY build was interrupted it can leave an INVALID index
--     of the SAME name; IF NOT EXISTS will then SKIP rather than rebuild. Before
--     promoting, verify none exists invalid:
--       SELECT c.relname, i.indisvalid
--         FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
--        WHERE c.relname = 'idx_enrollments_abandoned';
--     If a row exists with indisvalid = f, DROP INDEX CONCURRENTLY IF EXISTS it
--     first, then re-run this file.
--   * SET lock_timeout is intentionally OMITTED: CONCURRENTLY needs to wait out
--     in-flight transactions to start/finish its build phases, and a short
--     lock_timeout would abort that wait spuriously on a busy table.
--
-- COLLISION CHECK: index name idx_enrollments_abandoned confirmed absent on the
--        replica (0 rows in pg_class / pg_indexes for public.enrollments). No
--        existing object is modified. Partial predicate mirrors the existing
--        partial-index house idiom (e.g. idx_enrollments_review_sla in
--        202606240001_enrollment_review_states.sql; idx_enrollment_approvals_open
--        in 202606240005_enrollment_approvals_parallel_binding.sql).
-- Refs: baseline CREATE TABLE public.enrollments L23235; status/submitted_at/
--        organization_id/updated_at columns; existing org+status+date index
--        idx_enrollments_org_status_date (full, not partial — does NOT cover the
--        submitted_at IS NULL filter, hence this dedicated partial index).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_abandoned
  ON public.enrollments (organization_id, updated_at)
  WHERE status IN ('draft', 'in_progress') AND submitted_at IS NULL;

NOTIFY pgrst, 'reload schema';

-- Rollback (E2): purely additive — safe to drop with no data impact.
--   DROP INDEX CONCURRENTLY IF EXISTS public.idx_enrollments_abandoned;
--   -- (also runs outside a txn block; same 25001 caveat as the CREATE.)
