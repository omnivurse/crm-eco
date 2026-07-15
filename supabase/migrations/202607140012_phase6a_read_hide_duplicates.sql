-- Phase 6a of the CRM undo-delete system: hide trashed records from the
-- duplicate-detection surfaces (the last places a soft-deleted record still
-- "leaks" into the UI or an automated action).
--
-- Background: Phases 1–5 made deletes/merges soft (deleted_at IS NULL = live).
-- Reads across lists/search/detail already add `deleted_at IS NULL`, but three
-- duplicate-detection surfaces were deferred and still scan every crm_records
-- row regardless of trash state:
--
--   1. crm_probable_duplicates_all  — the view behind the /crm/duplicates review
--      queue. After a merge, the soft-deleted loser still shares the keeper's
--      name/email/phone, so it re-appears as an UNRESOLVABLE "duplicate" pair
--      (merging it now fails the Phase 5b guard). Most user-visible of the three.
--   2. check_crm_duplicate          — pre-insert warning. A trashed record would
--      warn "possible duplicate" against something the user can't even see.
--   3. bulk_auto_merge_duplicates   — the admin one-click auto-merge. Corruption
--      is already prevented by the Phase 5b merge_crm_records guard (it rejects a
--      trashed keeper/duplicate), BUT a trashed record with trashed children can
--      still win the keeper ranking (history_count counts trashed children); the
--      subsequent merge(keeper=trashed, dup=live) is rejected, so a legitimate
--      LIVE↔LIVE merge silently never runs. It also churns trashed rows into the
--      returned error counter. Filtering them out of the candidate set fixes both.
--
-- This migration ONLY adds `deleted_at IS NULL` predicates to the crm_records
-- scans in these three objects. Everything else — output columns, ranking,
-- history gates, dismissal checks, grants (CREATE OR REPLACE preserves them) —
-- is byte-for-byte identical to the baseline definitions. Deliberately NOT
-- touched: the child-history subqueries (note_count/task_count/attachment_count
-- and the NOT EXISTS "zero history" gates) still count trashed children, so the
-- auto-merge candidate set can only CONTRACT here, never expand — the safe
-- direction for a live bulk operation.

-- ---------------------------------------------------------------------------
-- 1) crm_probable_duplicates_all: exclude trashed records from the candidate set.
--    Re-emitted identically except the added `r.deleted_at IS NULL` predicate.
--    Column list is unchanged, so the dependent view crm_probable_duplicates
--    (which filters dismissals on top of this one) keeps working untouched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.crm_probable_duplicates_all WITH (security_invoker='true') AS
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
          WHERE (r.deleted_at IS NULL)
            AND ((COALESCE((r.data ->> 'first_name'::text), ''::text) <> ''::text) AND (COALESCE((r.data ->> 'last_name'::text), ''::text) <> ''::text))
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

-- ---------------------------------------------------------------------------
-- 2) check_crm_duplicate: don't warn against a trashed record on pre-insert.
--    Re-emitted identically except the added `r.deleted_at IS NULL` predicate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_crm_duplicate(p_org_id uuid, p_module_id uuid, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_exclude_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, title text, email text, phone text, status text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.title, r.email, r.phone, r.status, r.created_at
  FROM crm_records r
  WHERE r.organization_id = p_org_id
    AND r.module_id = p_module_id
    AND r.deleted_at IS NULL
    AND (p_exclude_id IS NULL OR r.id != p_exclude_id)
    AND (
      -- Primary: match by email (case-insensitive)
      (p_email IS NOT NULL AND p_email != '' AND LOWER(r.email) = LOWER(p_email))
      OR
      -- Fallback: match by phone only when no email provided
      (
        (p_email IS NULL OR p_email = '')
        AND p_phone IS NOT NULL AND p_phone != ''
        AND r.phone = p_phone
      )
    )
  LIMIT 5;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) bulk_auto_merge_duplicates: never pick a trashed record as keeper or
--    duplicate. Re-emitted identically except `deleted_at IS NULL` added to each
--    top-level crm_records candidate scan (5 rule CTEs) and to each JOINed
--    crm_records real_rec (rules 2–5). Rule 1's self-join derives entirely from
--    the already-filtered `pairs` CTE, so it needs no extra join predicate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_auto_merge_duplicates(p_org_id uuid, p_max_per_rule integer DEFAULT 1000) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor_profile_id uuid;
  v_actor_org_id     uuid;
  v_actor_role       text;
  v_pair             RECORD;
  v_rpc_result       jsonb;

  v_rule1 int := 0;
  v_rule2 int := 0;
  v_rule3 int := 0;
  v_rule4 int := 0;
  v_rule5 int := 0;
  v_errors int := 0;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_org_id is required');
  END IF;
  IF p_max_per_rule IS NULL OR p_max_per_rule < 1 OR p_max_per_rule > 5000 THEN
    p_max_per_rule := 1000;
  END IF;

  SELECT id, organization_id, crm_role
    INTO v_actor_profile_id, v_actor_org_id, v_actor_role
    FROM public.profiles
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_actor_profile_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_actor_role NOT IN ('crm_admin', 'crm_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only CRM admins and managers can run bulk merge');
  END IF;
  IF v_actor_org_id <> p_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You can only run bulk merge for your own organization');
  END IF;

  -- Give ourselves headroom for large orgs. This is the same statement_timeout
  -- escalation the one-shot PIFH migration uses.
  PERFORM set_config('statement_timeout', '10min', true);

  -- ---- Rule 1: linked_member_id collisions -----------------------------
  FOR v_pair IN
    WITH pairs AS (
      SELECT
        (data->>'linked_member_id') AS member_id,
        id, organization_id, module_id, status, updated_at,
        (SELECT count(*) FROM crm_notes  n WHERE n.record_id = crm_records.id) +
        (SELECT count(*) FROM crm_tasks  t WHERE t.record_id = crm_records.id) +
        (SELECT count(*) FROM crm_attachments a WHERE a.record_id = crm_records.id)
          AS history_count
      FROM crm_records
      WHERE organization_id = p_org_id
        AND deleted_at IS NULL
        AND data ? 'linked_member_id'
        AND data->>'linked_member_id' <> ''
    ),
    grouped AS (
      SELECT member_id, module_id
        FROM pairs GROUP BY member_id, module_id HAVING COUNT(*) > 1
    ),
    ranked AS (
      SELECT p.*,
             ROW_NUMBER() OVER (
               PARTITION BY p.member_id, p.module_id
               ORDER BY p.history_count DESC,
                        (p.status = 'Active') DESC,
                        p.updated_at DESC NULLS LAST
             ) AS rn
        FROM pairs p
        JOIN grouped g ON g.member_id = p.member_id AND g.module_id = p.module_id
    )
    SELECT k.id AS keeper_id, d.id AS duplicate_id
      FROM ranked k
      JOIN ranked d
        ON d.member_id = k.member_id
       AND d.module_id = k.module_id
       AND k.rn = 1
       AND d.rn > 1
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.organization_id = p_org_id
          AND dd.left_record_id  = LEAST(k.id, d.id)
          AND dd.right_record_id = GREATEST(k.id, d.id)
     )
     LIMIT p_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_actor_profile_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule1 := v_rule1 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- ---- Rule 2: enrollment-sync twins (zero history) --------------------
  FOR v_pair IN
    WITH sync_twins AS (
      SELECT id, organization_id, module_id, email, phone,
             data->>'first_name' AS first_name,
             data->>'last_name'  AS last_name
        FROM crm_records
       WHERE organization_id = p_org_id
         AND deleted_at IS NULL
         AND data->>'source' = 'enrollment_sync'
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, sync.id AS duplicate_id
      FROM sync_twins sync
      JOIN crm_records real_rec
        ON real_rec.id        <> sync.id
       AND real_rec.deleted_at IS NULL
       AND real_rec.organization_id    = sync.organization_id
       AND real_rec.module_id = sync.module_id
       AND (
            (real_rec.email IS NOT NULL AND sync.email IS NOT NULL
               AND LOWER(real_rec.email) = LOWER(sync.email))
         OR (
            real_rec.phone IS NOT NULL AND sync.phone IS NOT NULL
               AND real_rec.phone = sync.phone
               AND sync.first_name IS NOT NULL AND sync.last_name IS NOT NULL
               AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(sync.first_name)
               AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(sync.last_name)
            )
       )
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.organization_id = p_org_id
          AND dd.left_record_id  = LEAST(real_rec.id, sync.id)
          AND dd.right_record_id = GREATEST(real_rec.id, sync.id)
     )
     LIMIT p_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_actor_profile_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule2 := v_rule2 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- ---- Rule 3: exact email, one side empty -----------------------------
  FOR v_pair IN
    WITH empties AS (
      SELECT id, organization_id, module_id, email
        FROM crm_records
       WHERE organization_id = p_org_id
         AND deleted_at IS NULL
         AND email IS NOT NULL AND email <> ''
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, empty.id AS duplicate_id
      FROM empties empty
      JOIN crm_records real_rec
        ON real_rec.id        <> empty.id
       AND real_rec.deleted_at IS NULL
       AND real_rec.organization_id    = empty.organization_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.email IS NOT NULL
       AND LOWER(real_rec.email) = LOWER(empty.email)
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.organization_id = p_org_id
          AND dd.left_record_id  = LEAST(real_rec.id, empty.id)
          AND dd.right_record_id = GREATEST(real_rec.id, empty.id)
     )
     LIMIT p_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_actor_profile_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule3 := v_rule3 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- ---- Rule 4: phone + first + last, one side empty --------------------
  FOR v_pair IN
    WITH empties AS (
      SELECT id, organization_id, module_id, phone,
             data->>'first_name' AS first_name,
             data->>'last_name'  AS last_name
        FROM crm_records
       WHERE organization_id = p_org_id
         AND deleted_at IS NULL
         AND phone IS NOT NULL AND phone <> ''
         AND data->>'first_name' IS NOT NULL
         AND data->>'last_name'  IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, empty.id AS duplicate_id
      FROM empties empty
      JOIN crm_records real_rec
        ON real_rec.id        <> empty.id
       AND real_rec.deleted_at IS NULL
       AND real_rec.organization_id    = empty.organization_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.phone = empty.phone
       AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(empty.first_name)
       AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(empty.last_name)
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.organization_id = p_org_id
          AND dd.left_record_id  = LEAST(real_rec.id, empty.id)
          AND dd.right_record_id = GREATEST(real_rec.id, empty.id)
     )
     LIMIT p_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_actor_profile_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule4 := v_rule4 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- ---- Rule 5: DOB + first + last, one side empty ----------------------
  FOR v_pair IN
    WITH empties AS (
      SELECT id, organization_id, module_id,
             data->>'date_of_birth' AS dob,
             data->>'first_name'    AS first_name,
             data->>'last_name'     AS last_name
        FROM crm_records
       WHERE organization_id = p_org_id
         AND deleted_at IS NULL
         AND data->>'date_of_birth' IS NOT NULL
         AND data->>'date_of_birth' <> ''
         AND data->>'first_name' IS NOT NULL
         AND data->>'last_name'  IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, empty.id AS duplicate_id
      FROM empties empty
      JOIN crm_records real_rec
        ON real_rec.id        <> empty.id
       AND real_rec.deleted_at IS NULL
       AND real_rec.organization_id    = empty.organization_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.data->>'date_of_birth' = empty.dob
       AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(empty.first_name)
       AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(empty.last_name)
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.organization_id = p_org_id
          AND dd.left_record_id  = LEAST(real_rec.id, empty.id)
          AND dd.right_record_id = GREATEST(real_rec.id, empty.id)
     )
     LIMIT p_max_per_rule
  LOOP
    BEGIN
      SELECT merge_crm_records(
        p_keeper_id    => v_pair.keeper_id,
        p_duplicate_id => v_pair.duplicate_id,
        p_user_id      => v_actor_profile_id
      ) INTO v_rpc_result;
      IF (v_rpc_result->>'success')::boolean THEN
        v_rule5 := v_rule5 + 1;
      ELSE
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rule1',   v_rule1,
    'rule2',   v_rule2,
    'rule3',   v_rule3,
    'rule4',   v_rule4,
    'rule5',   v_rule5,
    'errors',  v_errors,
    'total',   v_rule1 + v_rule2 + v_rule3 + v_rule4 + v_rule5
  );
END;
$$;
