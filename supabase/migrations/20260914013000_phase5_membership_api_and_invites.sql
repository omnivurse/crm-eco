-- Phase 5 leftovers (repo only). Do not apply to PIF-ECO-V2 without explicit approval.
-- Adds last_invited_at and expands CRM key/webhook check constraints.

SET lock_timeout = '5s';

ALTER TABLE public.sponsor_admins
  ADD COLUMN IF NOT EXISTS last_invited_at timestamptz;

ALTER TABLE public.sponsor_roster
  ADD COLUMN IF NOT EXISTS last_invited_at timestamptz;

ALTER TABLE public.crm_api_keys
  DROP CONSTRAINT IF EXISTS crm_api_keys_scopes_check;
ALTER TABLE public.crm_api_keys
  ADD CONSTRAINT crm_api_keys_scopes_check CHECK (
    scopes <@ ARRAY[
      'crm.read', 'crm.write', 'crm.admin',
      'records.read', 'records.write', 'records.delete',
      'contacts.read', 'contacts.write',
      'pipelines.read', 'pipelines.write',
      'automations.read', 'automations.write',
      'analytics.read',
      'import.execute', 'export.execute',
      'webhooks.manage',
      'extensions.read', 'extensions.manage',
      'membership.read', 'membership.write', 'plans.read'
    ]::text[]
  );

ALTER TABLE public.crm_webhooks
  DROP CONSTRAINT IF EXISTS crm_webhooks_events_check;
ALTER TABLE public.crm_webhooks
  ADD CONSTRAINT crm_webhooks_events_check CHECK (
    events <@ ARRAY[
      'record.created', 'record.updated', 'record.deleted', 'record.stage_changed',
      'contact.created', 'contact.updated', 'contact.deleted',
      'deal.created', 'deal.updated', 'deal.won', 'deal.lost',
      'task.created', 'task.completed',
      'note.created',
      'import.completed', 'export.completed',
      'pipeline.stage_changed',
      'signal.fired', 'signal.resolved',
      'extension.installed', 'extension.uninstalled',
      'api_key.created', 'api_key.revoked',
      'member.created', 'membership.updated', 'invoice.paid'
    ]::text[]
  );

-- Rollback:
-- ALTER TABLE public.sponsor_admins DROP COLUMN IF EXISTS last_invited_at;
-- ALTER TABLE public.sponsor_roster DROP COLUMN IF EXISTS last_invited_at;
-- Restore the prior CHECK arrays (without membership.* / member.created / membership.updated / invoice.paid).
