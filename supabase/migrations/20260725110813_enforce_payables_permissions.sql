-- Enforce the payables permission gate at the database boundary.
-- Depends on 202607220001_has_org_permission.sql.
--
-- This replaces the legacy org-wide FOR ALL policy. Owners and admins retain
-- access through the temporary org-role bridge in has_org_permission(), while
-- staff and read-only members are limited to their declared capabilities.

SET lock_timeout = '5s';

DO $$
BEGIN
  IF to_regprocedure('public.has_org_permission(uuid,text)') IS NULL THEN
    RAISE EXCEPTION
      'has_org_permission(uuid,text) is required; apply 202607220001_has_org_permission.sql first';
  END IF;
END;
$$;

DROP POLICY IF EXISTS payables_org_access ON public.payables;
DROP POLICY IF EXISTS payables_select_by_permission ON public.payables;
DROP POLICY IF EXISTS payables_insert_by_permission ON public.payables;
DROP POLICY IF EXISTS payables_approve_by_permission ON public.payables;
DROP POLICY IF EXISTS payables_pay_by_permission ON public.payables;

CREATE POLICY payables_select_by_permission
ON public.payables
FOR SELECT
TO authenticated
USING (
  public.has_org_permission(organization_id, 'payables.read')
);

CREATE POLICY payables_insert_by_permission
ON public.payables
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND public.has_org_permission(organization_id, 'payables.create')
);

CREATE POLICY payables_approve_by_permission
ON public.payables
FOR UPDATE
TO authenticated
USING (
  status = 'pending'
  AND public.has_org_permission(organization_id, 'payables.approve')
)
WITH CHECK (
  status = 'approved'
  AND public.has_org_permission(organization_id, 'payables.approve')
);

CREATE POLICY payables_pay_by_permission
ON public.payables
FOR UPDATE
TO authenticated
USING (
  status = 'approved'
  AND public.has_org_permission(organization_id, 'payables.pay')
)
WITH CHECK (
  status = 'paid'
  AND public.has_org_permission(organization_id, 'payables.pay')
);

-- DELETE intentionally has no policy until a dedicated payables.delete
-- permission and audited deletion flow are introduced.
--
-- Rollback (restores the prior org-wide behavior):
--   DROP POLICY IF EXISTS payables_select_by_permission ON public.payables;
--   DROP POLICY IF EXISTS payables_insert_by_permission ON public.payables;
--   DROP POLICY IF EXISTS payables_approve_by_permission ON public.payables;
--   DROP POLICY IF EXISTS payables_pay_by_permission ON public.payables;
--   CREATE POLICY payables_org_access ON public.payables
--     FOR ALL TO authenticated
--     USING (
--       organization_id IN (
--         SELECT organization_id
--         FROM public.profiles
--         WHERE user_id = (SELECT auth.uid())
--       )
--     );
