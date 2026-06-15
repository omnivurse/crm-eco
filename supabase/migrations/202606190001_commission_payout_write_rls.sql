-- Wave 5 / DHH-AUDIT-008: commission payout + transaction write RLS for org staff.
-- Admin console generates payouts and updates status via PostgREST (not RPC-only).
-- ADDITIVE: INSERT/UPDATE policies only; SELECT policies unchanged.

SET lock_timeout = '5s';

-- commission_payouts
DROP POLICY IF EXISTS "Org staff can insert commission payouts" ON public.commission_payouts;
CREATE POLICY "Org staff can insert commission payouts"
  ON public.commission_payouts
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "Org staff can update commission payouts" ON public.commission_payouts;
CREATE POLICY "Org staff can update commission payouts"
  ON public.commission_payouts
  FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- commission_transactions (status updates when payout marked paid)
DROP POLICY IF EXISTS "Org staff can update commission transactions" ON public.commission_transactions;
CREATE POLICY "Org staff can update commission transactions"
  ON public.commission_transactions
  FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_user_role() IN ('owner', 'admin', 'staff')
  );

-- Rollback notes:
-- DROP POLICY "Org staff can insert commission payouts" ON public.commission_payouts;
-- DROP POLICY "Org staff can update commission payouts" ON public.commission_payouts;
-- DROP POLICY "Org staff can update commission transactions" ON public.commission_transactions;
