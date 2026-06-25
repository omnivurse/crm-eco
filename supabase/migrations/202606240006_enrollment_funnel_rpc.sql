-- Phase 0 / Enrollment Ops (SLICE E3): enrollment FUNNEL analytics RPC (ADDITIVE, read-only). [E3]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: DRAFT — not applied. Lives in supabase/drafts/ so it does NOT auto-run.
--
-- PURPOSE: one own-org, admin-gated funnel RPC for apps/admin/(dashboard)/analytics/funnel.
--   Reports, for the cohort of enrollments CREATED in the last p_months:
--     * stage_reached counts (started -> submitted -> pending_review -> approved / rejected / cancelled)
--     * current_status_counts (live status breakdown of the cohort)
--     * conversion rates (submit_rate, approval_rate)
--     * time_in_stage_days (created->submitted, submitted->decision) as AVG + median.
--
-- ADDITIVE / COLLISION-CHECKED: creates exactly ONE new function
--   public.get_enrollment_funnel(uuid, integer). Verified on the replica that NO function
--   named get_enrollment_funnel exists (SELECT proname FROM pg_proc WHERE proname=... -> 0 rows).
--   Uses CREATE OR REPLACE FUNCTION; no existing function/table/policy/constraint is altered or
--   dropped. Re-runnable. Read-only: the function performs SELECT aggregation only — it NEVER
--   writes enrollments (no base_monthly_cost / status touch) or any other table.
--
-- AUTH GUARD: mirrors the LIVE public.get_actuarial_experience / public.get_group_demographics
--   idiom EXACTLY — RAISE 'Not authenticated' when auth.uid() IS NULL, then RAISE 'Access denied'
--   unless a profiles row exists with (user_id = auth.uid() AND organization_id = p_org_id).
--   SECURITY DEFINER + SET search_path = public, STABLE. GRANT EXECUTE TO authenticated.
--   This is an OPERATIONAL own-org metric (admin-gated) — NO small-group suppression is applied
--   (unlike the actuarial age-band rows); counts are returned as-is for the caller's own org.
--
-- A1 PENDING-REVIEW UNION: matches the canonical app union exactly
--   ['submitted','pending_review','more_info'] — same set used by:
--     apps/admin/src/app/(dashboard)/analytics/page.tsx (PENDING_REVIEW_STATUSES)
--     apps/admin/src/components/enrollments/EnrollmentActions.tsx (canApprove/canReject gates).
--
-- COHORT / TIMESTAMP refs (live schema confirmed on replica):
--   public.enrollments columns: organization_id, created_at, submitted_at, pending_review_at,
--     more_info_requested_at, approved_at, rejected_at, cancelled_at, last_status_change_at, status.
--   Per-status *_at columns are auto-stamped by the LIVE BEFORE-UPDATE trigger
--   public.update_enrollment_status_change() (baseline L21706; extended by draft 202606240001).
--   status CHECK vocabulary (baseline L23385 + draft 202606240001): draft / in_progress /
--     submitted / approved / rejected / cancelled / active / inactive / on_hold /
--     pending_review / more_info.
--
-- Refs (LIVE function defs copied for the auth-guard + return-jsonb style):
--   public.get_actuarial_experience(uuid,int)  — auth guard + jsonb_build_object return shape.
--   public.get_group_demographics(uuid)        — same auth guard idiom.
--   Archived source: supabase/migrations_archive/202602190002_actuarial_experience_rpc.sql
--     (GRANT EXECUTE ... TO authenticated convention).
--
-- TRANSACTION: explicit BEGIN; / COMMIT; (repo convention for non-index DDL; NO CONCURRENTLY here).
-- Rollback note at the bottom.

BEGIN;

-- ===========================================================================
-- public.get_enrollment_funnel — own-org, admin-gated enrollment funnel.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_enrollment_funnel(
  p_org_id  uuid,
  p_months  integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_start     timestamptz;
  v_result    jsonb;
BEGIN
  -- Auth guard (mirrors get_actuarial_experience / get_group_demographics) --------------------
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_caller_id
      AND organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Clamp the window (mirrors get_actuarial_experience's defensive p_months clamp) ------------
  IF p_months IS NULL OR p_months < 1 OR p_months > 60 THEN
    p_months := 12;
  END IF;

  v_start := now() - make_interval(months => p_months);

  -- Single pass over the cohort (enrollments CREATED in the window) ---------------------------
  WITH cohort AS (
    SELECT
      e.status,
      e.created_at,
      e.submitted_at,
      e.pending_review_at,
      e.more_info_requested_at,
      e.approved_at,
      e.rejected_at,
      e.cancelled_at
    FROM public.enrollments e
    WHERE e.organization_id = p_org_id
      AND e.created_at >= v_start
  ),
  agg AS (
    SELECT
      count(*)::bigint AS cohort_total,
      -- stage_reached -----------------------------------------------------------------------
      count(*) FILTER (WHERE submitted_at IS NOT NULL)::bigint AS reached_submitted,
      count(*) FILTER (
        WHERE status = ANY (ARRAY['submitted','pending_review','more_info'])
      )::bigint AS reached_pending_review,
      count(*) FILTER (
        WHERE approved_at IS NOT NULL OR status = ANY (ARRAY['approved','active'])
      )::bigint AS reached_approved,
      count(*) FILTER (
        WHERE rejected_at IS NOT NULL OR status = 'rejected'
      )::bigint AS reached_rejected,
      count(*) FILTER (
        WHERE cancelled_at IS NOT NULL OR status = 'cancelled'
      )::bigint AS reached_cancelled,
      -- time created -> submitted (only rows with both ts) ----------------------------------
      avg(
        EXTRACT(epoch FROM (submitted_at - created_at)) / 86400.0
      ) FILTER (WHERE submitted_at IS NOT NULL AND created_at IS NOT NULL)
        AS c2s_avg,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(epoch FROM (submitted_at - created_at)) / 86400.0
      ) FILTER (WHERE submitted_at IS NOT NULL AND created_at IS NOT NULL)
        AS c2s_median,
      -- time submitted -> decision (approved_at or rejected_at; whichever is present) -------
      avg(
        EXTRACT(epoch FROM (COALESCE(approved_at, rejected_at) - submitted_at)) / 86400.0
      ) FILTER (
        WHERE submitted_at IS NOT NULL AND COALESCE(approved_at, rejected_at) IS NOT NULL
      ) AS s2d_avg,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(epoch FROM (COALESCE(approved_at, rejected_at) - submitted_at)) / 86400.0
      ) FILTER (
        WHERE submitted_at IS NOT NULL AND COALESCE(approved_at, rejected_at) IS NOT NULL
      ) AS s2d_median
    FROM cohort
  ),
  status_counts AS (
    SELECT COALESCE(
      jsonb_object_agg(status, n),
      '{}'::jsonb
    ) AS by_status
    FROM (
      SELECT status, count(*)::bigint AS n
      FROM cohort
      GROUP BY status
    ) s
  )
  SELECT jsonb_build_object(
    'months',        p_months,
    'cohort_total',  a.cohort_total,
    'stage_reached', jsonb_build_object(
      'started',        a.cohort_total,
      'submitted',      a.reached_submitted,
      'pending_review', a.reached_pending_review,
      'approved',       a.reached_approved,
      'rejected',       a.reached_rejected,
      'cancelled',      a.reached_cancelled
    ),
    'current_status_counts', sc.by_status,
    'conversion', jsonb_build_object(
      'submit_rate',   CASE WHEN a.cohort_total > 0
                         THEN round((a.reached_submitted::numeric / a.cohort_total::numeric), 4)
                         ELSE NULL END,
      'approval_rate', CASE WHEN a.reached_submitted > 0
                         THEN round((a.reached_approved::numeric / a.reached_submitted::numeric), 4)
                         ELSE NULL END
    ),
    'time_in_stage_days', jsonb_build_object(
      'created_to_submitted', jsonb_build_object(
        'avg',    CASE WHEN a.c2s_avg    IS NOT NULL THEN round(a.c2s_avg::numeric, 2)    ELSE NULL END,
        'median', CASE WHEN a.c2s_median IS NOT NULL THEN round(a.c2s_median::numeric, 2) ELSE NULL END
      ),
      'submitted_to_decision', jsonb_build_object(
        'avg',    CASE WHEN a.s2d_avg    IS NOT NULL THEN round(a.s2d_avg::numeric, 2)    ELSE NULL END,
        'median', CASE WHEN a.s2d_median IS NOT NULL THEN round(a.s2d_median::numeric, 2) ELSE NULL END
      )
    ),
    'generated_at', now()
  )
  INTO v_result
  FROM agg a, status_counts sc;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_enrollment_funnel(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Rollback (E3):
--   -- get_enrollment_funnel is a NET-NEW function; dropping it is fully non-destructive
--   -- (no data, no dependent objects, no policies reference it).
--   DROP FUNCTION IF EXISTS public.get_enrollment_funnel(uuid, integer);
--   NOTIFY pgrst, 'reload schema';
