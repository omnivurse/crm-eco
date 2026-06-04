-- ============================================================================
-- CRM duplicate dismissals + Review Duplicates support
--
-- Adds three pieces that the client-facing /crm/duplicates page relies on:
--
--   1. crm_duplicate_dismissals     — persistent "these two records are not
--                                     actually the same person" decisions.
--   2. crm_probable_duplicates      — view updated to hide dismissed pairs.
--      (crm_probable_duplicates_all kept for forensics.)
--   3. bulk_auto_merge_for_org      — tenant-generic version of the PIFH
--                                     one-shot bulk-merge; callable from the
--                                     Review Duplicates page "auto-merge
--                                     safe pairs" button for any org.
--
-- Canonical pair ordering: (LEAST(id_a, id_b), GREATEST(id_a, id_b)) so that
-- dismissing the pair (A, B) also dismisses (B, A) — same human decision.
--
-- Security model:
--   - Table: RLS; everything scoped to the caller's organization_id.
--   - View: security_invoker so base-table RLS still applies.
--   - Bulk merge RPC: SECURITY DEFINER, but explicitly re-checks that
--     p_actor_id is a crm_admin/crm_manager in p_org_id before doing any
--     work — that's the trust boundary, not the calling role.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Dismissals table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_duplicate_dismissals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Canonical order: left < right. Enforced by the dismiss RPC.
  left_record_id  uuid NOT NULL REFERENCES public.crm_records(id) ON DELETE CASCADE,
  right_record_id uuid NOT NULL REFERENCES public.crm_records(id) ON DELETE CASCADE,
  dismissed_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  dismissed_at   timestamptz NOT NULL DEFAULT now(),
  reason         text,

  CONSTRAINT crm_duplicate_dismissals_canonical_order CHECK (left_record_id < right_record_id),
  CONSTRAINT crm_duplicate_dismissals_unique_pair     UNIQUE (org_id, left_record_id, right_record_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_dup_dismissals_org
  ON public.crm_duplicate_dismissals (org_id);

CREATE INDEX IF NOT EXISTS idx_crm_dup_dismissals_left
  ON public.crm_duplicate_dismissals (left_record_id);

CREATE INDEX IF NOT EXISTS idx_crm_dup_dismissals_right
  ON public.crm_duplicate_dismissals (right_record_id);

COMMENT ON TABLE public.crm_duplicate_dismissals IS
  'Pairs of records that a user has explicitly marked "not a duplicate" from the Review Duplicates page. The probable-duplicates view filters these out so the same decision does not reappear.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_duplicate_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_dup_dismissals_select ON public.crm_duplicate_dismissals;
CREATE POLICY crm_dup_dismissals_select
  ON public.crm_duplicate_dismissals FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM public.profiles
       WHERE user_id = auth.uid() AND crm_role IS NOT NULL
    )
  );

DROP POLICY IF EXISTS crm_dup_dismissals_insert ON public.crm_duplicate_dismissals;
CREATE POLICY crm_dup_dismissals_insert
  ON public.crm_duplicate_dismissals FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.profiles
       WHERE user_id = auth.uid()
         AND crm_role IN ('crm_admin', 'crm_manager')
    )
  );

DROP POLICY IF EXISTS crm_dup_dismissals_delete ON public.crm_duplicate_dismissals;
CREATE POLICY crm_dup_dismissals_delete
  ON public.crm_duplicate_dismissals FOR DELETE
  USING (
    org_id IN (
      SELECT organization_id FROM public.profiles
       WHERE user_id = auth.uid()
         AND crm_role IN ('crm_admin', 'crm_manager')
    )
  );

GRANT SELECT, INSERT, DELETE ON public.crm_duplicate_dismissals TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Rebuild the probable-duplicates view to hide dismissed pairs
--    (and keep an "_all" variant for forensics).
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.crm_probable_duplicates;
DROP VIEW IF EXISTS public.crm_probable_duplicates_all;

CREATE VIEW public.crm_probable_duplicates_all
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
   AND a.id < b.id
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

COMMENT ON VIEW public.crm_probable_duplicates_all IS
  'All probable-duplicate pairs (including user-dismissed ones). Forensic view; most code should use crm_probable_duplicates instead.';

GRANT SELECT ON public.crm_probable_duplicates_all TO authenticated;

CREATE VIEW public.crm_probable_duplicates
  WITH (security_invoker = true)
AS
SELECT p.*
  FROM public.crm_probable_duplicates_all p
 WHERE NOT EXISTS (
   SELECT 1
     FROM public.crm_duplicate_dismissals d
    WHERE d.org_id          = p.org_id
      AND d.left_record_id  = p.left_id
      AND d.right_record_id = p.right_id
 );

COMMENT ON VIEW public.crm_probable_duplicates IS
  'Probable-duplicate pairs the operator has not yet dismissed. Drives the /crm/duplicates review queue.';

GRANT SELECT ON public.crm_probable_duplicates TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dismiss / undismiss RPCs
--
-- Both enforce canonical ordering (LEAST/GREATEST) so the caller can pass
-- the two ids in either order — whichever side shows up on the left of the
-- card shouldn't affect the underlying dismissal record.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.dismiss_duplicate_pair(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.dismiss_duplicate_pair(
  p_a_id  uuid,
  p_b_id  uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid;
  v_actor_org_id     uuid;
  v_actor_role       text;
  v_left_id          uuid;
  v_right_id         uuid;
  v_a_org_id         uuid;
  v_b_org_id         uuid;
BEGIN
  IF p_a_id IS NULL OR p_b_id IS NULL OR p_a_id = p_b_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Two different record ids are required');
  END IF;

  SELECT id, organization_id, crm_role
    INTO v_actor_profile_id, v_actor_org_id, v_actor_role
    FROM public.profiles
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_actor_profile_id IS NULL OR v_actor_role NOT IN ('crm_admin', 'crm_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only CRM admins and managers can dismiss duplicate pairs');
  END IF;

  SELECT org_id INTO v_a_org_id FROM public.crm_records WHERE id = p_a_id;
  SELECT org_id INTO v_b_org_id FROM public.crm_records WHERE id = p_b_id;

  IF v_a_org_id IS NULL OR v_b_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or both records do not exist');
  END IF;

  IF v_a_org_id <> v_actor_org_id OR v_b_org_id <> v_actor_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Records must belong to your organization');
  END IF;

  IF v_a_org_id <> v_b_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Records must belong to the same organization');
  END IF;

  v_left_id  := LEAST(p_a_id, p_b_id);
  v_right_id := GREATEST(p_a_id, p_b_id);

  INSERT INTO public.crm_duplicate_dismissals (org_id, left_record_id, right_record_id, dismissed_by, reason)
  VALUES (v_actor_org_id, v_left_id, v_right_id, v_actor_profile_id, NULLIF(TRIM(p_reason), ''))
  ON CONFLICT (org_id, left_record_id, right_record_id) DO UPDATE
    SET dismissed_by = EXCLUDED.dismissed_by,
        dismissed_at = now(),
        reason       = EXCLUDED.reason;

  INSERT INTO public.crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
  VALUES (
    v_actor_org_id,
    v_actor_profile_id,
    'record',
    v_left_id,
    'duplicate_dismissed',
    jsonb_build_object(
      'left_id',  v_left_id,
      'right_id', v_right_id,
      'reason',   NULLIF(TRIM(p_reason), '')
    )
  );

  RETURN jsonb_build_object('success', true, 'left_id', v_left_id, 'right_id', v_right_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_duplicate_pair(uuid, uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.undismiss_duplicate_pair(uuid, uuid);
CREATE OR REPLACE FUNCTION public.undismiss_duplicate_pair(
  p_a_id uuid,
  p_b_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid;
  v_actor_org_id     uuid;
  v_actor_role       text;
  v_left_id          uuid;
  v_right_id         uuid;
  v_deleted          int;
BEGIN
  IF p_a_id IS NULL OR p_b_id IS NULL OR p_a_id = p_b_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Two different record ids are required');
  END IF;

  SELECT id, organization_id, crm_role
    INTO v_actor_profile_id, v_actor_org_id, v_actor_role
    FROM public.profiles
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_actor_profile_id IS NULL OR v_actor_role NOT IN ('crm_admin', 'crm_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only CRM admins and managers can undismiss duplicate pairs');
  END IF;

  v_left_id  := LEAST(p_a_id, p_b_id);
  v_right_id := GREATEST(p_a_id, p_b_id);

  DELETE FROM public.crm_duplicate_dismissals
   WHERE org_id          = v_actor_org_id
     AND left_record_id  = v_left_id
     AND right_record_id = v_right_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    INSERT INTO public.crm_audit_log (org_id, actor_id, entity, entity_id, action, diff)
    VALUES (
      v_actor_org_id,
      v_actor_profile_id,
      'record',
      v_left_id,
      'duplicate_undismissed',
      jsonb_build_object('left_id', v_left_id, 'right_id', v_right_id)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'left_id', v_left_id, 'right_id', v_right_id, 'removed', v_deleted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.undismiss_duplicate_pair(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Widen crm_audit_log_action_check to include dismissal actions.
--    The prior migration (202604210007) already added 'merge'; we append
--    the two dismissal actions so the RPCs above don't silently fail.
-- ---------------------------------------------------------------------------
ALTER TABLE public.crm_audit_log
  DROP CONSTRAINT IF EXISTS crm_audit_log_action_check;

ALTER TABLE public.crm_audit_log
  ADD CONSTRAINT crm_audit_log_action_check
  CHECK (action IN (
    'create', 'update', 'delete', 'import', 'export', 'bulk_update',
    'stage_change', 'approval_request', 'approval_action', 'approval_apply',
    'message_sent', 'rule_triggered',
    'merge',
    'duplicate_dismissed',
    'duplicate_undismissed'
  ));

-- ---------------------------------------------------------------------------
-- 5. Tenant-generic bulk auto-merge RPC.
--
-- Mirrors the logic in 202604210005_pifh_bulk_auto_merge.sql but:
--   - Accepts p_org_id so new tenants don't need another migration.
--   - Runs under SECURITY DEFINER with an explicit actor-is-admin check.
--   - Returns a summary jsonb instead of RAISE NOTICE so the API can
--     surface per-rule counts on the Review Duplicates page.
--   - Skips pairs that have been dismissed (respects operator decisions).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.bulk_auto_merge_duplicates(uuid, int);
CREATE OR REPLACE FUNCTION public.bulk_auto_merge_duplicates(
  p_org_id uuid,
  p_max_per_rule int DEFAULT 1000
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        id, org_id, module_id, status, updated_at,
        (SELECT count(*) FROM crm_notes  n WHERE n.record_id = crm_records.id) +
        (SELECT count(*) FROM crm_tasks  t WHERE t.record_id = crm_records.id) +
        (SELECT count(*) FROM crm_attachments a WHERE a.record_id = crm_records.id)
          AS history_count
      FROM crm_records
      WHERE org_id = p_org_id
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
        WHERE dd.org_id          = p_org_id
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
      SELECT id, org_id, module_id, email, phone,
             data->>'first_name' AS first_name,
             data->>'last_name'  AS last_name
        FROM crm_records
       WHERE org_id = p_org_id
         AND data->>'source' = 'enrollment_sync'
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, sync.id AS duplicate_id
      FROM sync_twins sync
      JOIN crm_records real_rec
        ON real_rec.id        <> sync.id
       AND real_rec.org_id    = sync.org_id
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
        WHERE dd.org_id          = p_org_id
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
      SELECT id, org_id, module_id, email
        FROM crm_records
       WHERE org_id = p_org_id
         AND email IS NOT NULL AND email <> ''
         AND NOT EXISTS (SELECT 1 FROM crm_notes       n WHERE n.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_tasks       t WHERE t.record_id = crm_records.id)
         AND NOT EXISTS (SELECT 1 FROM crm_attachments a WHERE a.record_id = crm_records.id)
    )
    SELECT real_rec.id AS keeper_id, empty.id AS duplicate_id
      FROM empties empty
      JOIN crm_records real_rec
        ON real_rec.id        <> empty.id
       AND real_rec.org_id    = empty.org_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.email IS NOT NULL
       AND LOWER(real_rec.email) = LOWER(empty.email)
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.org_id          = p_org_id
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
      SELECT id, org_id, module_id, phone,
             data->>'first_name' AS first_name,
             data->>'last_name'  AS last_name
        FROM crm_records
       WHERE org_id = p_org_id
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
       AND real_rec.org_id    = empty.org_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.phone = empty.phone
       AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(empty.first_name)
       AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(empty.last_name)
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.org_id          = p_org_id
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
      SELECT id, org_id, module_id,
             data->>'date_of_birth' AS dob,
             data->>'first_name'    AS first_name,
             data->>'last_name'     AS last_name
        FROM crm_records
       WHERE org_id = p_org_id
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
       AND real_rec.org_id    = empty.org_id
       AND real_rec.module_id = empty.module_id
       AND real_rec.data->>'date_of_birth' = empty.dob
       AND LOWER(COALESCE(real_rec.data->>'first_name','')) = LOWER(empty.first_name)
       AND LOWER(COALESCE(real_rec.data->>'last_name', '')) = LOWER(empty.last_name)
     WHERE NOT EXISTS (
       SELECT 1 FROM crm_duplicate_dismissals dd
        WHERE dd.org_id          = p_org_id
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

GRANT EXECUTE ON FUNCTION public.bulk_auto_merge_duplicates(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.bulk_auto_merge_duplicates(uuid, int) IS
  'Tenant-generic bulk auto-merge. Runs the same moderate rule set as 202604210005 (linked_member_id, enrollment-sync twins, email/phone/DOB with empty-side) but for any org the caller admins. Respects the crm_duplicate_dismissals table. Returns per-rule counts.';

COMMIT;
