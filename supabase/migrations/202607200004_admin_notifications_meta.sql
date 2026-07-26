-- Additive: durable deep-link / context payload for admin_notifications.
-- Bell + toast already expect href/meta; the table previously could not store them.
-- Rollback: ALTER TABLE public.admin_notifications DROP COLUMN IF EXISTS meta;

ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.admin_notifications.meta IS
  'Opaque notification context. Common keys: href, ticket_id, member_id.';
