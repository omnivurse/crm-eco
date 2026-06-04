-- Two hardening passes in one migration:
--
-- 1. payable_line_items + payable_payments lacked their own organization_id.
--    RLS had to JOIN through payables on every read, and a future hand-rolled
--    query that forgot the join could leak rows cross-org. Adds the column,
--    backfills from the parent payable, marks NOT NULL, indexes, and adds
--    matching RLS policies.
--
-- 2. Adds composite indexes that the admin UI hits on common filter combos:
--      commission_transactions (organization_id, status, period_start DESC)
--    plus a trigram GIN index on members for the name/email lookups in
--    /members search and the AdvisorCombobox.

-- ────────────────────────────────────────────────────────────────────────────
-- 1A. payable_line_items.organization_id
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payable_line_items
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.payable_line_items pli
   SET organization_id = p.organization_id
  FROM public.payables p
 WHERE pli.payable_id = p.id
   AND pli.organization_id IS NULL;

-- Only enforce NOT NULL once every row has been backfilled. If any row is
-- still NULL it means the parent payable was deleted before backfill ran;
-- those orphans get pruned here so the constraint can land safely.
DELETE FROM public.payable_line_items WHERE organization_id IS NULL;
ALTER TABLE public.payable_line_items
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payable_line_items_org
  ON public.payable_line_items(organization_id);

-- RLS: same shape as payables — members of the org can read; admins write.
ALTER TABLE public.payable_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payable_line_items_select" ON public.payable_line_items;
CREATE POLICY "payable_line_items_select" ON public.payable_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = payable_line_items.organization_id
    )
  );

DROP POLICY IF EXISTS "payable_line_items_write" ON public.payable_line_items;
CREATE POLICY "payable_line_items_write" ON public.payable_line_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = payable_line_items.organization_id
         AND p.crm_role IN ('crm_admin', 'crm_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = payable_line_items.organization_id
         AND p.crm_role IN ('crm_admin', 'crm_manager')
    )
  );

DROP POLICY IF EXISTS "payable_line_items_service" ON public.payable_line_items;
CREATE POLICY "payable_line_items_service" ON public.payable_line_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 1B. payable_payments.organization_id
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payable_payments
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.payable_payments pp
   SET organization_id = p.organization_id
  FROM public.payables p
 WHERE pp.payable_id = p.id
   AND pp.organization_id IS NULL;

DELETE FROM public.payable_payments WHERE organization_id IS NULL;
ALTER TABLE public.payable_payments
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payable_payments_org
  ON public.payable_payments(organization_id);

ALTER TABLE public.payable_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payable_payments_select" ON public.payable_payments;
CREATE POLICY "payable_payments_select" ON public.payable_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = payable_payments.organization_id
    )
  );

DROP POLICY IF EXISTS "payable_payments_write" ON public.payable_payments;
CREATE POLICY "payable_payments_write" ON public.payable_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = payable_payments.organization_id
         AND p.crm_role IN ('crm_admin', 'crm_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.organization_id = payable_payments.organization_id
         AND p.crm_role IN ('crm_admin', 'crm_manager')
    )
  );

DROP POLICY IF EXISTS "payable_payments_service" ON public.payable_payments;
CREATE POLICY "payable_payments_service" ON public.payable_payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- A trigger on payables would be cleaner long-term to keep child rows in
-- sync as the parent's org changes, but org reassignment isn't a thing in
-- this app — payables are per-org and never move.

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Composite indexes for hot admin queries
-- ────────────────────────────────────────────────────────────────────────────

-- /commissions/transactions filters by org + status, sorted by period_start.
-- Existing single-column indexes force a sort or an index merge; this
-- composite covers the page query in one scan.
CREATE INDEX IF NOT EXISTS idx_commission_transactions_org_status_period
  ON public.commission_transactions (organization_id, status, period_start DESC);

-- Member name / email search is a substring match on a few columns. A
-- trigram GIN index makes ILIKE '%foo%' a fast index lookup instead of a
-- sequential scan. pg_trgm is enabled by Supabase out of the box, but we
-- guard it for cold-DB compatibility.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_members_name_trgm
  ON public.members USING gin (
    (
      COALESCE(first_name, '') || ' ' ||
      COALESCE(last_name,  '') || ' ' ||
      COALESCE(email,      '')
    ) gin_trgm_ops
  );

NOTIFY pgrst, 'reload schema';
