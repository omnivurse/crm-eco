-- Commission → CRM sync.
--
-- When commissions are processed in the admin enrollment portal, rows land in
-- public.commission_transactions. The CRM (apps/crm) had no hook to pick that
-- up, so a rep looking at a contact saw nothing about the commissions
-- generated for them. The audit flagged this as an orphan data path.
--
-- This migration installs a trigger that maintains a `commission_summary`
-- aggregate inside the linked crm_records.data JSONB whenever a transaction
-- is inserted, updated, or deleted. The summary is small and idempotent —
-- {count, total_amount, pending_amount, paid_amount, last_transaction_at}
-- — so the CRM read path can show it without touching commission_transactions
-- on every render.
--
-- Linkage: commission_transactions.member_id → members.id ; the existing
-- sync_member_to_crm trigger stamps `data->>'linked_member_id'` on the
-- crm_records row, so we resolve from member_id back to the contact in one
-- indexed lookup.

CREATE OR REPLACE FUNCTION public.recalc_crm_commission_summary(
  p_member_id uuid,
  p_org_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id           uuid;
  v_count               int;
  v_total_amount        numeric(12,2);
  v_pending_amount      numeric(12,2);
  v_paid_amount         numeric(12,2);
  v_last_transaction_at timestamptz;
BEGIN
  IF p_member_id IS NULL OR p_org_id IS NULL THEN
    RETURN;
  END IF;

  -- Find the linked CRM contact record (created/maintained by sync_member_to_crm).
  SELECT cr.id
    INTO v_record_id
    FROM public.crm_records cr
    JOIN public.crm_modules m ON m.id = cr.module_id
   WHERE m.org_id = p_org_id
     AND m.key   = 'contacts'
     AND cr.org_id = p_org_id
     AND cr.data->>'linked_member_id' = p_member_id::text
   ORDER BY cr.updated_at DESC NULLS LAST
   LIMIT 1;

  IF v_record_id IS NULL THEN
    RETURN;  -- No CRM record to update yet; sync_member_to_crm will eventually create one.
  END IF;

  -- Aggregate every commission transaction for this member.
  SELECT
    COUNT(*),
    COALESCE(SUM(commission_amount), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status IN ('pending', 'approved', 'held')), 0),
    COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0),
    MAX(updated_at)
    INTO v_count, v_total_amount, v_pending_amount, v_paid_amount, v_last_transaction_at
    FROM public.commission_transactions
   WHERE member_id = p_member_id
     AND organization_id = p_org_id;

  UPDATE public.crm_records
     SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
       'commission_summary', jsonb_build_object(
         'count',                v_count,
         'total_amount',         v_total_amount,
         'pending_amount',       v_pending_amount,
         'paid_amount',          v_paid_amount,
         'last_transaction_at',  v_last_transaction_at
       )
     ),
     updated_at = now()
   WHERE id = v_record_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_crm_commission_summary(uuid, uuid) IS
  'Recomputes the commission_summary aggregate inside crm_records.data for a '
  'member. Called by the commission_transactions trigger on insert/update/delete.';

-- Trigger function: dispatches to the recalc helper, handling INSERT / UPDATE
-- / DELETE in one place. Updates also trigger a recalc for the OLD member if
-- the row was reassigned mid-flight (rare but worth handling).
CREATE OR REPLACE FUNCTION public.commission_to_crm_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.recalc_crm_commission_summary(NEW.member_id, NEW.organization_id);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM public.recalc_crm_commission_summary(NEW.member_id, NEW.organization_id);
    IF OLD.member_id IS DISTINCT FROM NEW.member_id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
      PERFORM public.recalc_crm_commission_summary(OLD.member_id, OLD.organization_id);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.recalc_crm_commission_summary(OLD.member_id, OLD.organization_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS commission_to_crm_sync ON public.commission_transactions;
CREATE TRIGGER commission_to_crm_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.commission_to_crm_sync_trigger();

-- Backfill: roll up existing commission_transactions into crm_records once so
-- contacts that already have transactions show the correct summary
-- immediately after this migration.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT member_id, organization_id
      FROM public.commission_transactions
     WHERE member_id IS NOT NULL
  LOOP
    PERFORM public.recalc_crm_commission_summary(r.member_id, r.organization_id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
