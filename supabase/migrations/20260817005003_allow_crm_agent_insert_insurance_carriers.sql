-- Advisors (crm_agent / staff) can add missing carriers to the org directory
-- from My Carriers. Edit/archive stay admin/manager-only.
--
-- Live policy: carriers_insert_manager
--   WITH CHECK (private.has_crm_role(organization_id, ARRAY['crm_admin','crm_manager']))
-- Staff maps to crm_agent, so those inserts were rejected by RLS even when
-- the API allowed them.
--
-- ADDITIVE / reversible: drop + recreate INSERT policy only. SELECT/UPDATE/DELETE
-- unchanged. Rollback: recreate carriers_insert_manager with admin+manager only.

SET lock_timeout = '5s';

DROP POLICY IF EXISTS carriers_insert_manager ON public.insurance_carriers;
DROP POLICY IF EXISTS carriers_insert_member ON public.insurance_carriers;

CREATE POLICY carriers_insert_member ON public.insurance_carriers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_crm_role(
      organization_id,
      ARRAY['crm_admin'::text, 'crm_manager'::text, 'crm_agent'::text]
    )
  );
