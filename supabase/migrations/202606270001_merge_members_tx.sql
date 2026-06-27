-- merge_members_tx — atomic, transactional member merge.
--
-- Replaces the old client-side MergeMembersModal loop (which repointed only ~3
-- of the 30 tables that FK members.id, never recalculated billing, and could
-- double-bill). This runs as ONE transaction:
--   1. Validate keeper + secondary (same org, distinct, secondary not already merged).
--   2. KEEPER IS AUTHORITATIVE: terminate the secondary's ACTIVE membership +
--      cancel its ACTIVE billing schedules first, so repointing can't leave the
--      keeper double-billed.
--   3. Repoint every child row that references the secondary (dynamic over the
--      live FK graph, so new FK tables are covered automatically) to the keeper.
--   4. Soft-merge the secondary: status='inactive', merged_into_id = keeper.
-- Billing recalculation for the keeper is done by the caller after this returns
-- (recalc lives in @crm-eco/lib). SECURITY DEFINER so staff actions can invoke
-- it through the service-role conduit; callers must authorize first.

CREATE OR REPLACE FUNCTION public.merge_members_tx(
  p_org_id uuid,
  p_keeper_id uuid,
  p_secondary_id uuid,
  p_actor_profile_id uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_keeper public.members%ROWTYPE;
  v_secondary public.members%ROWTYPE;
  v_fk record;
  v_repointed jsonb := '{}'::jsonb;
  v_count bigint;
  v_terminated_memberships bigint := 0;
  v_cancelled_schedules bigint := 0;
BEGIN
  IF p_keeper_id = p_secondary_id THEN
    RAISE EXCEPTION 'Cannot merge a member into itself';
  END IF;

  SELECT * INTO v_keeper FROM public.members
    WHERE id = p_keeper_id AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keeper member % not found in organization', p_keeper_id;
  END IF;

  IF v_keeper.merged_into_id IS NOT NULL THEN
    RAISE EXCEPTION 'Keeper member % is itself already merged into another member', p_keeper_id;
  END IF;

  SELECT * INTO v_secondary FROM public.members
    WHERE id = p_secondary_id AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Secondary member % not found in organization', p_secondary_id;
  END IF;

  IF v_secondary.merged_into_id IS NOT NULL THEN
    RAISE EXCEPTION 'Secondary member % is already merged', p_secondary_id;
  END IF;

  -- (2) Keeper authoritative: retire the secondary's active financials BEFORE
  -- repointing, so the keeper keeps its own plan/billing and isn't double-billed.
  UPDATE public.memberships
     SET status = 'terminated', end_date = COALESCE(end_date, CURRENT_DATE), updated_at = now()
   WHERE member_id = p_secondary_id AND organization_id = p_org_id AND status = 'active';
  GET DIAGNOSTICS v_terminated_memberships = ROW_COUNT;

  UPDATE public.billing_schedules
     SET status = 'cancelled', updated_at = now()
   WHERE member_id = p_secondary_id AND organization_id = p_org_id AND status = 'active';
  GET DIAGNOSTICS v_cancelled_schedules = ROW_COUNT;

  -- (3) Repoint every FK column that references members.id from the secondary to
  -- the keeper, EXCEPT members itself (the merged_into_id self-ref is set below).
  FOR v_fk IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.contype = 'f'
       AND c.confrelid = 'public.members'::regclass
       AND c.conrelid <> 'public.members'::regclass
  LOOP
    EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
      USING p_keeper_id, p_secondary_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      v_repointed := v_repointed || jsonb_build_object(v_fk.tbl || '.' || v_fk.col, v_count);
    END IF;
  END LOOP;

  -- (4) Soft-merge the secondary.
  UPDATE public.members
     SET status = 'inactive', merged_into_id = p_keeper_id, updated_at = now()
   WHERE id = p_secondary_id;

  -- Best-effort audit (table may not exist in all envs).
  BEGIN
    INSERT INTO public.admin_activity_log (organization_id, action, entity_type, entity_id, metadata, created_at)
    VALUES (
      p_org_id, 'update', 'member', p_keeper_id,
      jsonb_build_object(
        'operation', 'merge',
        'secondary_id', p_secondary_id,
        'actor_profile_id', p_actor_profile_id,
        'terminated_memberships', v_terminated_memberships,
        'cancelled_schedules', v_cancelled_schedules,
        'repointed', v_repointed
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- audit is best-effort; a logging failure must never fail the merge
  END;

  RETURN jsonb_build_object(
    'keeper_id', p_keeper_id,
    'secondary_id', p_secondary_id,
    'terminated_memberships', v_terminated_memberships,
    'cancelled_schedules', v_cancelled_schedules,
    'repointed', v_repointed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_members_tx(uuid, uuid, uuid, uuid) TO service_role;
