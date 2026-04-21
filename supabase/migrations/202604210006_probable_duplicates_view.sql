-- ============================================================================
-- Probable-duplicates view.
--
-- After the visibility sweep (202604210004) and the bulk auto-merge
-- (202604210005) run, every low-risk pair is collapsed. This view lists
-- the pairs the bulk rules *deliberately* didn't touch so the operator
-- can review them one-by-one with the Merge Duplicate dialog.
--
-- "Probable" means:
--   - same module, same org
--   - first_name + last_name match (case-insensitive)
--   - at least one strong tie-breaker is present: matching email,
--     matching phone, or matching date_of_birth
--   - BOTH sides have real history (notes, tasks, or attachments) —
--     these are the pairs the bulk migration skipped because either
--     auto-merge could lose data if Active-wins picks the wrong side
--
-- Security: security_invoker so RLS on crm_records still applies. PIFH
-- users see PIFH pairs, admins in any other tenant (future) see only
-- their own.
-- ============================================================================

BEGIN;

DROP VIEW IF EXISTS public.crm_probable_duplicates;

CREATE VIEW public.crm_probable_duplicates
  WITH (security_invoker = true)
AS
WITH candidates AS (
  SELECT
    r.id,
    r.org_id,
    r.module_id,
    r.title,
    r.email,
    r.phone,
    r.status,
    r.updated_at,
    LOWER(COALESCE(r.data->>'first_name', '')) AS first_name_lc,
    LOWER(COALESCE(r.data->>'last_name',  '')) AS last_name_lc,
    NULLIF(r.data->>'date_of_birth', '')       AS dob,
    (SELECT count(*) FROM crm_notes       n WHERE n.record_id = r.id) AS note_count,
    (SELECT count(*) FROM crm_tasks       t WHERE t.record_id = r.id) AS task_count,
    (SELECT count(*) FROM crm_attachments a WHERE a.record_id = r.id) AS attachment_count
  FROM crm_records r
  WHERE COALESCE(r.data->>'first_name','') <> ''
    AND COALESCE(r.data->>'last_name','')  <> ''
),
pairs AS (
  SELECT
    a.id   AS left_id,
    b.id   AS right_id,
    a.org_id,
    a.module_id,
    a.title            AS left_title,
    b.title            AS right_title,
    a.email            AS left_email,
    b.email            AS right_email,
    a.phone            AS left_phone,
    b.phone            AS right_phone,
    a.status           AS left_status,
    b.status           AS right_status,
    a.note_count       AS left_notes,
    b.note_count       AS right_notes,
    a.task_count       AS left_tasks,
    b.task_count       AS right_tasks,
    a.attachment_count AS left_attachments,
    b.attachment_count AS right_attachments,
    a.updated_at       AS left_updated_at,
    b.updated_at       AS right_updated_at,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN a.email IS NOT NULL AND b.email IS NOT NULL
             AND LOWER(a.email) = LOWER(b.email) THEN 'email' END,
      CASE WHEN a.phone IS NOT NULL AND b.phone IS NOT NULL
             AND a.phone = b.phone THEN 'phone' END,
      CASE WHEN a.dob IS NOT NULL AND b.dob IS NOT NULL
             AND a.dob = b.dob THEN 'dob' END
    ], NULL) AS match_signals
  FROM candidates a
  JOIN candidates b
    ON a.org_id    = b.org_id
   AND a.module_id = b.module_id
   AND a.id < b.id                               -- avoid (A,B) and (B,A)
   AND a.first_name_lc = b.first_name_lc
   AND a.last_name_lc  = b.last_name_lc
  WHERE (
       (a.email IS NOT NULL AND b.email IS NOT NULL AND LOWER(a.email) = LOWER(b.email))
    OR (a.phone IS NOT NULL AND b.phone IS NOT NULL AND a.phone = b.phone)
    OR (a.dob   IS NOT NULL AND b.dob   IS NOT NULL AND a.dob = b.dob)
  )
)
SELECT
  p.*,
  CASE
    WHEN 'email' = ANY(p.match_signals) AND 'dob'   = ANY(p.match_signals) THEN 'high'
    WHEN 'email' = ANY(p.match_signals) AND 'phone' = ANY(p.match_signals) THEN 'high'
    WHEN 'email' = ANY(p.match_signals)                                    THEN 'medium'
    WHEN 'phone' = ANY(p.match_signals) AND 'dob'   = ANY(p.match_signals) THEN 'medium'
    ELSE 'low'
  END AS confidence
FROM pairs p;

COMMENT ON VIEW public.crm_probable_duplicates IS
  'Pairs of crm_records that share a name and at least one strong tie-breaker (email/phone/DOB) but were NOT auto-merged by the bulk cleanup because both sides carry real history. Use the Merge Duplicate dialog on the record detail page to resolve.';

GRANT SELECT ON public.crm_probable_duplicates TO authenticated;

COMMIT;
