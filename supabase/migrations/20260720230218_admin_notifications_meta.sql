-- Backfilled from the production migration ledger.
-- This migration was applied directly to production on 2026-07-20 23:02:18 UTC
-- (outside the repo) and was missing from version control. The SQL below is
-- reproduced verbatim from supabase_migrations.schema_migrations so that a
-- rebuild from migrations reproduces production. Already recorded as applied
-- in production -- it will not re-run there.

-- Additive: durable deep-link / context payload for admin_notifications.
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.admin_notifications.meta IS
  'Opaque notification context. Common keys: href, ticket_id, member_id.';
