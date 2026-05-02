-- Correct column names for replace_plan_rate_entries — the previous migration
-- assumed (member_count, tobacco_status, monthly_amount) but the actual
-- plan_rate_entries schema (202603010002) uses (coverage_tier, age_band_id,
-- person_type, rate_type, amount). Replacing the function with the right
-- column list.

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

  IF p_entries IS NOT NULL
     AND jsonb_typeof(p_entries) = 'array'
     AND jsonb_array_length(p_entries) > 0
  THEN
    INSERT INTO public.plan_rate_entries (
      rate_set_id,
      coverage_tier,
      age_band_id,
      person_type,
      rate_type,
      amount
    )
    SELECT
      p_rate_set_id,
      e->>'coverage_tier',
      COALESCE(e->>'age_band_id', '_flat'),
      COALESCE(e->>'person_type', 'primary'),
      COALESCE(e->>'rate_type', 'banded'),
      COALESCE((e->>'amount')::numeric, 0)
    FROM jsonb_array_elements(p_entries) AS e;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_plan_rate_entries(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_plan_rate_entries(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.replace_plan_rate_entries(uuid, jsonb) IS
  'Atomic replace of plan_rate_entries for a rate set — delete + insert run '
  'in one transaction so a failed insert rolls back the delete. Caller passes '
  'a JSONB array of {coverage_tier, age_band_id?, person_type?, rate_type?, amount}.';

NOTIFY pgrst, 'reload schema';
