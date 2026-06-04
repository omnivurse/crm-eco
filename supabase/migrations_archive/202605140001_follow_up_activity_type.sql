-- =============================================================================
-- Migration: Add 'follow_up' activity type & repeat_interval_days to crm_tasks
-- =============================================================================
--
-- Enables the Follow-Up Reminder system. Agents can schedule a follow-up
-- reminder on any Lead or Contact with a specific due date and optional
-- recurring cadence.  A cron processor generates notifications until the
-- task is marked completed.
--
-- Changes:
--   1. Widen the activity_type CHECK to include 'follow_up'
--   2. Add repeat_interval_days (nullable int) for recurring reminders
--   3. Add follow_up_note for the short reason text
--   4. Add a partial index for the cron query
-- =============================================================================

-- 1. Widen activity_type CHECK constraint
ALTER TABLE crm_tasks DROP CONSTRAINT IF EXISTS crm_tasks_activity_type_check;
ALTER TABLE crm_tasks ADD CONSTRAINT crm_tasks_activity_type_check
  CHECK (activity_type IN ('task', 'call', 'meeting', 'email', 'follow_up'));

-- 2. Add repeat_interval_days for recurring reminders
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS repeat_interval_days integer;
COMMENT ON COLUMN crm_tasks.repeat_interval_days IS
  'When set, the cron re-notifies every N days after due_at until the task is completed';

-- 3. Add follow_up_note for the short reason / context
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS follow_up_note text;
COMMENT ON COLUMN crm_tasks.follow_up_note IS
  'Short context for the follow-up (e.g. "COBRA expires, reach out about new plan")';

-- 4. Partial index for the cron processor query
CREATE INDEX IF NOT EXISTS idx_crm_tasks_follow_up_due
  ON crm_tasks(due_at)
  WHERE activity_type = 'follow_up' AND status IN ('open', 'in_progress');
