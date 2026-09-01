-- =============================================================================
-- Migration: Harden crm_probable_duplicates(_all) — security_invoker + REVOKE anon
-- =============================================================================
--
-- Forward-migration record of a security fix that was applied directly to the
-- live PIFH database under PR #25 ("close anon PHI leak in duplicate views").
-- Recording it as a migration (rather than editing the already-applied squashed
-- baseline) keeps the fix auditable in history and keeps
-- 00000000000000_baseline.sql a pristine, point-in-time snapshot.
--
-- Problem: public.crm_probable_duplicates and public.crm_probable_duplicates_all
-- were created WITHOUT security_invoker — so they executed as their owner (which
-- has BYPASSRLS) — and carried GRANT ALL to anon. PostgREST therefore exposed
-- cross-tenant duplicate PHI (names / phones / enrollment status) to the public
-- anon key.
--
-- Fix (idempotent; safe to re-run):
--   1. security_invoker = true  -> the views honour the *caller's* RLS on
--      public.crm_records (is_crm_member / super-admin / service_role).
--   2. REVOKE the anon grant     -> defence in depth.
--   3. Recalibrate confidence    -> rank by corroborating identifiers beyond the
--      always-matching first/last name:
--         >= 2 of {email, phone, dob} -> high
--         email OR dob                -> medium
--         phone-only                  -> low
--
-- Effect by environment:
--   * production             -> no-op (already patched out-of-band under PR #25).
--   * fresh / preview (reset) -> the pristine baseline replays the original
--     (insecure) views + anon grant, then THIS migration hardens them, so the
--     end state matches production exactly.
--
-- Reversible: a rollback would CREATE OR REPLACE both views without
-- security_invoker and re-GRANT anon (NOT recommended — reopens the PHI leak).
-- See 00000000000000_baseline.sql for the original (pre-hardening) definitions.
-- =============================================================================

-- 1/2 — forensic view: ALL probable-duplicate pairs (including dismissed ones).
CREATE OR REPLACE VIEW public.crm_probable_duplicates_all
    WITH (security_invoker = true) AS
 WITH candidates AS (
         SELECT r.id,
            r.organization_id AS org_id,
            r.module_id,
            r.title,
            r.email,
            r.phone,
            r.status,
            r.updated_at,
            lower(COALESCE((r.data ->> 'first_name'::text), ''::text)) AS first_name_lc,
            lower(COALESCE((r.data ->> 'last_name'::text), ''::text)) AS last_name_lc,
            NULLIF((r.data ->> 'date_of_birth'::text), ''::text) AS dob,
            ( SELECT count(*) AS count
                   FROM public.crm_notes n
                  WHERE (n.record_id = r.id)) AS note_count,
            ( SELECT count(*) AS count
                   FROM public.crm_tasks t
                  WHERE (t.record_id = r.id)) AS task_count,
            ( SELECT count(*) AS count
                   FROM public.crm_attachments a
                  WHERE (a.record_id = r.id)) AS attachment_count
           FROM public.crm_records r
          WHERE ((COALESCE((r.data ->> 'first_name'::text), ''::text) <> ''::text) AND (COALESCE((r.data ->> 'last_name'::text), ''::text) <> ''::text))
        ), pairs AS (
         SELECT a.id AS left_id,
            b.id AS right_id,
            a.org_id,
            a.module_id,
            a.title AS left_title,
            b.title AS right_title,
            a.email AS left_email,
            b.email AS right_email,
            a.phone AS left_phone,
            b.phone AS right_phone,
            a.status AS left_status,
            b.status AS right_status,
            a.note_count AS left_notes,
            b.note_count AS right_notes,
            a.task_count AS left_tasks,
            b.task_count AS right_tasks,
            a.attachment_count AS left_attachments,
            b.attachment_count AS right_attachments,
            a.updated_at AS left_updated_at,
            b.updated_at AS right_updated_at,
            array_remove(ARRAY[
                CASE
                    WHEN ((a.email IS NOT NULL) AND (b.email IS NOT NULL) AND (lower(a.email) = lower(b.email))) THEN 'email'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN ((a.phone IS NOT NULL) AND (b.phone IS NOT NULL) AND (a.phone = b.phone)) THEN 'phone'::text
                    ELSE NULL::text
                END,
                CASE
                    WHEN ((a.dob IS NOT NULL) AND (b.dob IS NOT NULL) AND (a.dob = b.dob)) THEN 'dob'::text
                    ELSE NULL::text
                END], NULL::text) AS match_signals
           FROM (candidates a
             JOIN candidates b ON (((a.org_id = b.org_id) AND (a.module_id = b.module_id) AND (a.id < b.id) AND (a.first_name_lc = b.first_name_lc) AND (a.last_name_lc = b.last_name_lc))))
          WHERE (((a.email IS NOT NULL) AND (b.email IS NOT NULL) AND (lower(a.email) = lower(b.email))) OR ((a.phone IS NOT NULL) AND (b.phone IS NOT NULL) AND (a.phone = b.phone)) OR ((a.dob IS NOT NULL) AND (b.dob IS NOT NULL) AND (a.dob = b.dob)))
        )
 SELECT left_id,
    right_id,
    org_id,
    module_id,
    left_title,
    right_title,
    left_email,
    right_email,
    left_phone,
    right_phone,
    left_status,
    right_status,
    left_notes,
    right_notes,
    left_tasks,
    right_tasks,
    left_attachments,
    right_attachments,
    left_updated_at,
    right_updated_at,
    match_signals,
        CASE
            WHEN (cardinality(match_signals) >= 2) THEN 'high'::text
            WHEN (('email'::text = ANY (match_signals)) OR ('dob'::text = ANY (match_signals))) THEN 'medium'::text
            ELSE 'low'::text
        END AS confidence
   FROM pairs p;

-- 2/2 — operator queue: pairs the operator has not yet dismissed.
-- Depends on crm_probable_duplicates_all (replaced above).
CREATE OR REPLACE VIEW public.crm_probable_duplicates
    WITH (security_invoker = true) AS
 SELECT left_id,
    right_id,
    org_id,
    module_id,
    left_title,
    right_title,
    left_email,
    right_email,
    left_phone,
    right_phone,
    left_status,
    right_status,
    left_notes,
    right_notes,
    left_tasks,
    right_tasks,
    left_attachments,
    right_attachments,
    left_updated_at,
    right_updated_at,
    match_signals,
    confidence
   FROM public.crm_probable_duplicates_all p
  WHERE (NOT (EXISTS ( SELECT 1
           FROM public.crm_duplicate_dismissals d
          WHERE ((d.organization_id = p.org_id) AND (d.left_record_id = p.left_id) AND (d.right_record_id = p.right_id)))));

-- Defence in depth: the public anon role must never read duplicate PHI.
-- (No-op where the grant is already absent, e.g. already-patched production.)
REVOKE ALL ON TABLE public.crm_probable_duplicates_all FROM anon;
REVOKE ALL ON TABLE public.crm_probable_duplicates FROM anon;
