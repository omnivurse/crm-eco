-- Prevent authenticated users from attributing habit signals to organizations
-- where they are not active members. The API derives organization_id from the
-- authenticated profile, but RLS must also protect direct Data API writes.
SET lock_timeout = '5s';

DROP POLICY IF EXISTS crm_user_signals_insert_own
  ON public.crm_user_signals;

CREATE POLICY crm_user_signals_insert_own
  ON public.crm_user_signals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- Rollback:
-- DROP POLICY IF EXISTS crm_user_signals_insert_own ON public.crm_user_signals;
-- CREATE POLICY crm_user_signals_insert_own ON public.crm_user_signals
--   FOR INSERT TO authenticated
--   WITH CHECK (user_id = (SELECT auth.uid()));
