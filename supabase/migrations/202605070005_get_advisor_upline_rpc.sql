-- Recursive RPC that returns an advisor's upline chain in one call.
-- Replaces the N+1 loop in commission-service.ts that did:
--   while (level <= maxLevels) {
--     fetch current advisor's parent
--     fetch parent advisor + commission_eligible
--     fetch parent's commission tier  ← then 2 more queries inside getAdvisorTier
--   }
-- — that was 4 queries per level (~20 round-trips for a 5-level downline).
-- The RPC + a single .in() lookup for tier details brings it to 2 queries
-- regardless of depth.

-- An older signature exists; drop before recreating with the columns we want.
DROP FUNCTION IF EXISTS public.get_advisor_upline(uuid, int);
DROP FUNCTION IF EXISTS public.get_advisor_upline(uuid);

CREATE OR REPLACE FUNCTION public.get_advisor_upline(
  p_advisor_id  uuid,
  p_max_levels  int DEFAULT 5
)
RETURNS TABLE (
  level                 int,
  advisor_id            uuid,
  parent_advisor_id     uuid,
  commission_eligible   boolean,
  commission_tier_id    uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    -- Seed: the parent of the source advisor (level 1)
    SELECT
      1 AS level,
      a.id              AS advisor_id,
      a.parent_advisor_id,
      a.commission_eligible,
      a.commission_tier_id
    FROM public.advisors a
    JOIN public.advisors src ON src.id = p_advisor_id
    WHERE a.id = src.parent_advisor_id

    UNION ALL

    -- Walk up: each step grabs the parent of the previous level
    SELECT
      c.level + 1,
      a.id,
      a.parent_advisor_id,
      a.commission_eligible,
      a.commission_tier_id
    FROM chain c
    JOIN public.advisors a ON a.id = c.parent_advisor_id
    WHERE c.level < p_max_levels
      AND c.parent_advisor_id IS NOT NULL
  )
  SELECT level, advisor_id, parent_advisor_id, commission_eligible, commission_tier_id
    FROM chain
   ORDER BY level;
$$;

GRANT EXECUTE ON FUNCTION public.get_advisor_upline(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advisor_upline(uuid, int) TO service_role;

COMMENT ON FUNCTION public.get_advisor_upline(uuid, int) IS
  'Returns the upline parent chain for an advisor up to p_max_levels deep. '
  'One round-trip replaces the N+1 fetch loop in commission-service.';

NOTIFY pgrst, 'reload schema';
