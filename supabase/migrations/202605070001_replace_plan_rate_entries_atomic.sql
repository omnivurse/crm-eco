-- Atomic replace for plan_rate_entries / plan_fees so the admin "save rate
-- config" flow can't leave a half-empty rate set on a network blip between
-- the DELETE and the INSERT.
--
-- Today's API does:
--   DELETE FROM plan_rate_entries WHERE rate_set_id = X
--   INSERT INTO plan_rate_entries (...) VALUES (...)
-- If the second statement fails, the rate set is empty in production until
-- the admin retries. These RPCs run both in a single SQL transaction so a
-- failed insert rolls back the delete.

CREATE OR REPLACE FUNCTION public.replace_plan_rate_entries(
  p_rate_set_id uuid,
  p_entries     jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  DELETE FROM public.plan_rate_entries WHERE rate_set_id = p_rate_set_id;

  IF p_entries IS NOT NULL AND jsonb_typeof(p_entries) = 'array' AND jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO public.plan_rate_entries (
      rate_set_id,
      member_count,
      tobacco_status,
      age_band_id,
      monthly_amount,
      adjustment_type,
      adjustment_value,
      meta
    )
    SELECT
      p_rate_set_id,
      (e->>'member_count')::int,
      e->>'tobacco_status',
      NULLIF(e->>'age_band_id', '')::uuid,
      (e->>'monthly_amount')::numeric,
      e->>'adjustment_type',
      NULLIF(e->>'adjustment_value', '')::numeric,
      COALESCE(e->'meta', '{}'::jsonb)
    FROM jsonb_array_elements(p_entries) AS e;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_plan_rate_entries(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_plan_rate_entries(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.replace_plan_fees(
  p_rate_set_id uuid,
  p_fees        jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  DELETE FROM public.plan_fees WHERE rate_set_id = p_rate_set_id;

  IF p_fees IS NOT NULL AND jsonb_typeof(p_fees) = 'array' AND jsonb_array_length(p_fees) > 0 THEN
    INSERT INTO public.plan_fees (
      rate_set_id,
      label,
      fee_type,
      amount,
      applies_to,
      enabled,
      sort_order
    )
    SELECT
      p_rate_set_id,
      e->>'label',
      e->>'fee_type',
      (e->>'amount')::numeric,
      COALESCE(e->>'applies_to', 'quote'),
      COALESCE((e->>'enabled')::boolean, true),
      COALESCE((e->>'sort_order')::int, 0)
    FROM jsonb_array_elements(p_fees) AS e;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_plan_fees(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_plan_fees(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.replace_plan_rate_entries(uuid, jsonb) IS
  'Atomic replace of plan_rate_entries for a rate set — delete + insert run '
  'in one transaction so a failed insert rolls back the delete. Caller maps '
  'the rate-table format into JSONB array entries with the columns this fn '
  'expects (member_count, tobacco_status, age_band_id, monthly_amount, etc.).';

COMMENT ON FUNCTION public.replace_plan_fees(uuid, jsonb) IS
  'Atomic replace of plan_fees for a rate set — same delete+insert guarantees.';

NOTIFY pgrst, 'reload schema';
