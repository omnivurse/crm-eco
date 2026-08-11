-- Scheduled plan change (current + upcoming membership) — cron scan indexes.
--
-- 1. The activate-due-memberships cron scans for pending memberships whose
--    effective_date has arrived (now also driving the supersede/terminate
--    pass for scheduled plan changes).
-- 2. The apply-scheduled-plan-changes cron scans Zoho-only CRM records that
--    carry a machine-readable data.scheduled_plan_change object.
--
-- Both are additive partial indexes; rollback = DROP INDEX.

CREATE INDEX IF NOT EXISTS idx_memberships_pending_effective
  ON public.memberships (effective_date)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_crm_records_scheduled_plan_change
  ON public.crm_records (((data->'scheduled_plan_change'->>'effective_date')))
  WHERE data ? 'scheduled_plan_change';
