-- PR 27 — Server-side idempotency for the offline mutation queue.
--
-- The client-side queue replays failed mutations with exponential
-- backoff. That's safe when the server never saw the original write,
-- but dangerous when the ack was lost in-flight: replaying a POST can
-- create duplicate records, replaying a PATCH can clobber downstream
-- edits. To make the queue "offline-correct" we need end-to-end
-- idempotency.
--
-- This migration adds `crm_idempotency_keys`: a short-lived ledger of
-- (key, method, path) → cached response. API routes wrap their mutating
-- handlers in `withIdempotency(...)`, which:
--   1. SELECTs by (org_id, key) under advisory lock
--   2. If hit → replays the stored response body + status
--   3. If miss → runs the handler, stores the final response, returns
--
-- Design notes:
--   - Scoped by `organization_id` so key collisions between tenants are
--     impossible even if a client reuses UUIDs.
--   - Keys expire after 24h. That's the window where duplicate replays
--     are realistic (tab backgrounded, device sleep, brief outage). A
--     24h cap keeps the table small enough to index-scan cheaply.
--   - `response_body` is JSONB — every API route in the app already
--     returns JSON. If a future route needs to return a binary/HTML
--     payload, the wrapper simply won't capture it (docstring covers).
--   - We store `status_code` separately so 202 / 204 / 409 replays
--     faithfully reconstruct the original response.
--   - `request_hash` is the SHA-256 of the request body. If a client
--     reuses a key but sends a different body (programmer error), we
--     refuse the replay with 422 to surface the bug loudly rather than
--     silently masking a divergence.

CREATE TABLE IF NOT EXISTS public.crm_idempotency_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    key text NOT NULL,
    method text NOT NULL CHECK (method IN ('POST', 'PUT', 'PATCH', 'DELETE')),
    path text NOT NULL,
    request_hash text NOT NULL,
    response_body jsonb NOT NULL DEFAULT '{}'::jsonb,
    status_code integer NOT NULL,
    /* Trace IDs are useful when debugging support tickets: "why did my
       second save succeed but look different?" — we can grep the log
       for the original request by trace_id. */
    trace_id text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    UNIQUE (organization_id, key)
);

COMMENT ON TABLE public.crm_idempotency_keys IS
    'Short-lived (~24h) ledger of (org, key) → cached mutation response. Drives end-to-end idempotency for the client-side offline queue.';

/* Indexes:
 *   - The unique constraint already covers (organization_id, key).
 *   - `expires_at` supports the GC cron: `DELETE WHERE expires_at < now()`.
 */
CREATE INDEX IF NOT EXISTS idx_crm_idempotency_keys_expires
    ON public.crm_idempotency_keys (expires_at);

/* RLS: only allow service role + the owning org to SELECT. Writes go
 * through the API wrapper which runs server-side with service role. */
ALTER TABLE public.crm_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_idempotency_keys_org_read" ON public.crm_idempotency_keys;
CREATE POLICY "crm_idempotency_keys_org_read"
    ON public.crm_idempotency_keys
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
        )
    );

/* No INSERT/UPDATE/DELETE policy → only service role can write, which
 * matches how the wrapper operates. */

/*
 * purge_expired_idempotency_keys() — GC helper called by the /api/cron
 * endpoint. Kept as a SECURITY DEFINER function so the cron route can
 * call it without service-role credentials.
 */
CREATE OR REPLACE FUNCTION public.purge_expired_idempotency_keys()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    WITH deleted AS (
        DELETE FROM public.crm_idempotency_keys
        WHERE expires_at < now()
        RETURNING 1
    )
    SELECT count(*) INTO deleted_count FROM deleted;
    RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_idempotency_keys() IS
    'Removes crm_idempotency_keys rows whose expires_at is in the past. Safe to call on a schedule (every 15 min).';
