-- Phase 0 / Enrollment Review: allow 'enrollment_submit' approval-rule trigger (ADDITIVE, idempotent). [A4]
-- Project: sffisarikcreyyjzdjvb (PIF-ECO-V2 production)
-- Status: PROMOTED to supabase/migrations/ — applied in version order by `supabase db push` (additive + idempotent).
-- Risk: TIER-1 — step (1) replaces the crm_approval_rules_trigger_type_check CHECK constraint
--        (DROP IF EXISTS + ADD). It is a *text* CHECK array (NOT a Postgres enum), so this is a
--        metadata-only constraint swap: NO type rewrite, NO data migration, and the new array is a
--        strict SUPERSET of the old (every existing rule row still validates). Still Tier-1 because
--        a CHECK change can fail the ADD if any pre-existing row violates it — rehearse + dry-run.
-- WHY: the public enrollment-submit path (apps/portal/src/app/api/enroll/submit/route.ts, behind the
--        ENROLLMENT_APPROVAL_ENABLED flag) evaluates approval rules stored in crm_approval_rules with
--        trigger_type='enrollment_submit'. The baseline CHECK (L10141) only permits
--        field_change / stage_transition / record_delete / record_create / field_threshold, so such a
--        rule row can NEVER be inserted today and the wired feature has nothing to read. This widens
--        the allowed trigger vocabulary by exactly one value.
-- SAFETY: this migration only widens the *allowed* trigger_type vocabulary. It does NOT create any
--        rule, does NOT auto-transition any enrollment, and does NOT fire approvals. The runtime
--        auto-route to 'pending_review' stays flag-gated OFF by default; manual EnrollmentActions
--        remain the safe default. No money/state auto-fire here.
-- PRE-REQ: 202606240001_enrollment_review_states.sql (adds the 'pending_review' status the submit
--        route routes to). This A4 migration is independent of A3 at the SQL level (different table),
--        but the feature only makes sense once A3 supplies the target status.
-- Rehearsal / dry-run: confirm zero rows would violate the new CHECK before ADD CONSTRAINT, e.g.
--        SELECT trigger_type, count(*) FROM public.crm_approval_rules
--          WHERE trigger_type NOT IN ('field_change','stage_transition','record_delete',
--                                     'record_create','field_threshold','enrollment_submit')
--          GROUP BY trigger_type;   -- must return 0 rows.
-- Refs: baseline CREATE TABLE public.crm_approval_rules L10125; crm_approval_rules_trigger_type_check
--        L10141 (current allowed: field_change,stage_transition,record_delete,record_create,
--        field_threshold); adapter apps/portal/src/lib/enroll/approval-adapter.ts
--        (ENROLLMENT_SUBMIT_TRIGGER = 'enrollment_submit').
-- NOTE: no explicit BEGIN/COMMIT — the Supabase migration runner wraps each file in one
--        transaction (matches existing phase-0 drafts which use only SET lock_timeout).

SET lock_timeout = '5s';

-- (1) EXTEND the trigger_type CHECK to add 'enrollment_submit'. text CHECK array (no enum / no
--     rewrite). DROP IF EXISTS + ADD makes this idempotent and the new array is a superset of the old.
ALTER TABLE public.crm_approval_rules DROP CONSTRAINT IF EXISTS crm_approval_rules_trigger_type_check;
ALTER TABLE public.crm_approval_rules
  ADD CONSTRAINT crm_approval_rules_trigger_type_check
  CHECK ((trigger_type = ANY (ARRAY[
    'field_change'::text,
    'stage_transition'::text,
    'record_delete'::text,
    'record_create'::text,
    'field_threshold'::text,
    'enrollment_submit'::text
  ])));

-- (1b) EXTEND the PROCESS trigger_type CHECK to match — a coherent enrollment_submit approval
--      process backs the rules (crm_approval_rules.process_id -> crm_approval_processes). Same
--      superset swap (text CHECK, no enum/rewrite); the original 4 values are preserved.
ALTER TABLE public.crm_approval_processes DROP CONSTRAINT IF EXISTS crm_approval_processes_trigger_type_check;
ALTER TABLE public.crm_approval_processes
  ADD CONSTRAINT crm_approval_processes_trigger_type_check
  CHECK ((trigger_type = ANY (ARRAY[
    'stage_transition'::text,
    'field_change'::text,
    'record_create'::text,
    'manual'::text,
    'enrollment_submit'::text
  ])));

-- (2) PARTIAL INDEX for the enrollment-submit rule lookup the adapter performs on every gated
--     submit: (org_id) filtered to enabled enrollment_submit rules, ordered by priority. Keeps the
--     index small (only the enrollment-submit rules) and matches the read in
--     checkEnrollmentApprovalRequired (eq org_id + eq trigger_type + eq is_enabled, order priority).
CREATE INDEX IF NOT EXISTS idx_crm_approval_rules_enrollment_submit
  ON public.crm_approval_rules USING btree (org_id, priority)
  WHERE (trigger_type = 'enrollment_submit'::text AND is_enabled = true);

NOTIFY pgrst, 'reload schema';

-- Rollback (A4): only safe once NO crm_approval_rules row uses trigger_type='enrollment_submit'.
--   DROP INDEX IF EXISTS public.idx_crm_approval_rules_enrollment_submit;
--   ALTER TABLE public.crm_approval_rules DROP CONSTRAINT IF EXISTS crm_approval_rules_trigger_type_check;
--   ALTER TABLE public.crm_approval_rules
--     ADD CONSTRAINT crm_approval_rules_trigger_type_check
--     CHECK ((trigger_type = ANY (ARRAY['field_change'::text,'stage_transition'::text,
--       'record_delete'::text,'record_create'::text,'field_threshold'::text])));
