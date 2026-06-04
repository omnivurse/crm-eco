-- The admin enrollment portal queries
--   .from('advisors').select('id, first_name, last_name, email,
--      enrollment_code, is_active, primary_color, logo_url')
-- but `advisors` only has `status` (pending / active / inactive / terminated)
-- — no `is_active` column. PostgREST returns 400 "column does not exist" and
-- the agents enrollment-links page fails to load.
--
-- Fix: add `is_active` as a generated column derived from status. The admin
-- code keeps working without changes, status stays the source of truth, and
-- there's no risk of the two falling out of sync.
--
-- Generated columns can't have indexes that beat a partial index on the
-- expression, so we also add a partial index on (organization_id) WHERE
-- status = 'active' for the same access pattern.

ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS is_active boolean
    GENERATED ALWAYS AS (status = 'active') STORED;

CREATE INDEX IF NOT EXISTS idx_advisors_active_org
  ON public.advisors (organization_id)
  WHERE status = 'active';

NOTIFY pgrst, 'reload schema';
