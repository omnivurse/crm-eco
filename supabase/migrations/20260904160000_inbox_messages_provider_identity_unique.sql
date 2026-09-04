-- Make a provider message unique inside the inbox.
--
-- Problem: nothing stopped the same email being filed twice. A Resend webhook
-- redelivery, a scheduled-send cron retry, or an outbox row reclaimed as stale
-- all re-ran their insert and produced a second copy of one message. There was
-- no constraint to catch it, so duplicates accumulated silently.
--
-- The key is (org_id, direction, external_provider, external_id):
--   * org_id      — the same RFC-822 Message-ID can legitimately be delivered to
--                   two tenants, so uniqueness must never span orgs.
--   * direction   — inbound stores the Message-ID while outbound stores the
--                   provider's send id. Two namespaces share this one column, so
--                   scoping by direction keeps them from colliding.
--
-- Deliberately NOT a partial index. Postgres already treats NULLs as distinct in
-- a unique index, so rows with no provider identity (null external_id or
-- external_provider) coexist freely without a predicate. A predicate would also
-- make the index unusable as an ON CONFLICT target through PostgREST, whose
-- `on_conflict` parameter cannot carry one — and every writer needs to upsert
-- against this index.
--
-- Verified before writing: 0 duplicate groups at this scope on live data, so the
-- build cannot fail on existing rows.
--
-- Rollback: DROP INDEX IF EXISTS public.inbox_messages_provider_identity_key;

-- Fail fast rather than queue behind live inbox traffic.
SET LOCAL lock_timeout = '5s';

CREATE UNIQUE INDEX IF NOT EXISTS inbox_messages_provider_identity_key
  ON public.inbox_messages (org_id, direction, external_provider, external_id);

COMMENT ON INDEX public.inbox_messages_provider_identity_key IS
  'One row per provider message per direction per org. Upsert target for every '
  'inbox_messages writer so a provider redelivery or job retry cannot duplicate '
  'a message. Nulls are distinct, so rows without a provider identity are exempt.';
