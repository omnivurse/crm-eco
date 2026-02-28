-- =============================================================================
-- Performance indexes for critical query paths
-- =============================================================================

-- Critical: webhook lookups — every Resend/SendGrid webhook does
-- .eq('provider_message_id', emailId) which currently full-table-scans
CREATE INDEX IF NOT EXISTS idx_sent_emails_provider_message_id
  ON sent_emails(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Critical: CRM list view — module pages filter by org + module + status
CREATE INDEX IF NOT EXISTS idx_crm_records_org_module_status
  ON crm_records(org_id, module_id, status, created_at DESC);

-- Critical: My Tasks / Work Queue — filters by assignee + open status
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_open
  ON crm_tasks(assigned_to, due_at ASC NULLS LAST)
  WHERE status NOT IN ('completed', 'cancelled');

-- High: Activities list — ordered by created_at within an org
CREATE INDEX IF NOT EXISTS idx_crm_activities_org_created
  ON crm_activities(org_id, created_at DESC);

-- High: Email history — org-scoped status + date filtering
CREATE INDEX IF NOT EXISTS idx_sent_emails_org_status_created
  ON sent_emails(organization_id, status, created_at DESC);

-- High: Automation engine — workflow trigger lookup
CREATE INDEX IF NOT EXISTS idx_crm_workflows_trigger_lookup
  ON crm_workflows(org_id, module_id, trigger_type, is_enabled)
  WHERE is_enabled = true;

-- Medium: Notes RLS support — org_id filter
CREATE INDEX IF NOT EXISTS idx_crm_notes_org_id
  ON crm_notes(org_id);

-- Medium: Email events lookup — composite for event queries
CREATE INDEX IF NOT EXISTS idx_email_events_sent_email_event
  ON email_events(sent_email_id, event_type);

-- Medium: Queue monitoring — status + date ordering
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_created
  ON notification_queue(status, created_at DESC);

-- =============================================================================
-- Cleanup: Remove redundant single-column indexes subsumed by composites
--   idx_crm_records_status   → subsumed by idx_crm_records_status_created
--   idx_crm_records_module_id → subsumed by idx_crm_records_org_module
--   idx_crm_records_owner    → subsumed by idx_crm_records_owner_created
-- =============================================================================
DROP INDEX IF EXISTS idx_crm_records_status;
DROP INDEX IF EXISTS idx_crm_records_module_id;
DROP INDEX IF EXISTS idx_crm_records_owner;
