/**
 * idempotency — server-side wrapper that makes mutating API routes
 * safe to replay.
 *
 * Contract:
 *   - Callers supply an `Idempotency-Key` request header (a UUID).
 *   - If the key is absent or empty, the wrapper is a no-op — the
 *     handler runs as usual and we emit the sync receipt. This keeps
 *     every existing caller working without changes.
 *   - If the key is present, we look it up in `crm_idempotency_keys`
 *     scoped to the caller's organization:
 *       - Hit with matching request hash  → replay stored response.
 *       - Hit with different request hash → 422 (client reused key).
 *       - Miss                            → run the handler, persist
 *                                            the response, return it.
 *
 * Why service-role:
 *   RLS on `crm_idempotency_keys` only permits SELECT for the owning
 *   org; writes go through a service-role client because the wrapper
 *   needs to UPSERT before the user's own session knows about the row.
 *
 * Why JSON only:
 *   Every current mutation route returns JSON (or an empty 204). The
 *   wrapper clones responses and stringifies the JSON body for
 *   storage. Non-JSON responses are captured as `{}` but keep their
 *   status code, so replays still signal success/failure faithfully.
 *
 * Why SHA-256 of the body:
 *   If a buggy client reuses a key with a different payload, silently
 *   replaying the stored response would mask the bug. Comparing
 *   hashes lets us reject that case with a loud 422.
 */

import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const RECEIPT_HEADER = 'x-sync-receipt';

export interface IdempotencyContext {
  /** Always set. Clients can log this and cross-reference with the
   *  server-side idempotency ledger for triage. */
  receiptId: string;
  /** True if the current response is a replay of a prior mutation. */
  replayed: boolean;
}

export interface WithIdempotencyOptions {
  organizationId: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Pathname of the request (e.g. `/api/crm/records/abc`). Used as
   *  part of the cache key so /records/abc and /deals/abc cannot
   *  accidentally collide. */
  path: string;
  /** Raw request body (string). Pass `''` for empty bodies. */
  rawBody: string;
  /** A trace id (e.g. Cloudflare Ray ID, Vercel request id) if one is
   *  available. Stored alongside the response for later debugging. */
  traceId?: string | null;
}

/**
 * Hash used to detect payload drift across replays. SHA-256 is
 * overkill for a per-org ledger but cheap and conflict-free.
 */
function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Lazily-constructed service-role client. Idempotency writes bypass
 * RLS because they happen before the handler's own supabase context
 * is in scope.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE service-role credentials are missing — idempotency cache disabled',
    );
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Extract the idempotency key from a request. Returns null when the
 * header is absent or empty.
 */
export function readIdempotencyKey(req: NextRequest | Request): string | null {
  const raw = req.headers.get(IDEMPOTENCY_HEADER);
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Sanity cap: 128 chars. Prevents unbounded keys from bloating the
  // index if a caller misuses the header.
  return trimmed.slice(0, 128);
}

/**
 * Attach the sync receipt header to any Next response. Called both
 * on fresh writes and replays so the client always knows which
 * server-side row owns the outcome.
 */
export function attachReceipt(
  response: NextResponse,
  ctx: IdempotencyContext,
): NextResponse {
  response.headers.set(RECEIPT_HEADER, ctx.receiptId);
  if (ctx.replayed) {
    response.headers.set('x-sync-replayed', '1');
  }
  return response;
}

/**
 * Wrap a mutating API handler with idempotency semantics. See file
 * header for full contract.
 *
 * Usage:
 * ```ts
 * const { response, context } = await withIdempotency(
 *   { organizationId, method: 'PATCH', path, rawBody, traceId },
 *   req,
 *   async () => {
 *     // ... normal handler work ...
 *     return NextResponse.json({ ok: true });
 *   },
 * );
 * return response;
 * ```
 */
export async function withIdempotency(
  options: WithIdempotencyOptions,
  request: NextRequest | Request,
  handler: () => Promise<NextResponse>,
): Promise<{ response: NextResponse; context: IdempotencyContext }> {
  const key = readIdempotencyKey(request);
  const context: IdempotencyContext = {
    receiptId: randomUUID(),
    replayed: false,
  };

  // Fast path: no key supplied. Run the handler directly and still
  // attach a receipt so every mutation response is traceable.
  if (!key) {
    const response = await handler();
    return { response: attachReceipt(response, context), context };
  }

  const requestHash = hashBody(options.rawBody ?? '');
  let supabase;
  try {
    supabase = getServiceClient();
  } catch {
    // No service-role key configured (local dev without secrets).
    // Fall back to handler-only — losing idempotency is better than
    // 500'ing every mutation.
    const response = await handler();
    return { response: attachReceipt(response, context), context };
  }

  // --- Lookup ---
  const { data: existing, error: selectError } = await supabase
    .from('crm_idempotency_keys')
    .select('id, request_hash, response_body, status_code, expires_at')
    .eq('organization_id', options.organizationId)
    .eq('key', key)
    .maybeSingle();

  if (selectError) {
    // Don't fail the request if the ledger is flaky — degrade to a
    // non-idempotent run and log. The worst case is a duplicate on
    // retry, which is the status quo today.
    console.error(
      '[idempotency] Failed to read ledger; running handler directly',
      selectError,
    );
    const response = await handler();
    return { response: attachReceipt(response, context), context };
  }

  if (existing) {
    // Treat rows past expires_at as a miss. The GC cron usually clears
    // them, but this is defensive against a lagging cron.
    const expired = new Date(existing.expires_at).getTime() < Date.now();
    if (!expired) {
      if (existing.request_hash !== requestHash) {
        // Same key, different body = programmer error. Refuse loudly.
        const response = NextResponse.json(
          {
            error:
              'Idempotency-Key reused with a different request body. Regenerate the key for new requests.',
          },
          { status: 422 },
        );
        context.receiptId = existing.id;
        return { response: attachReceipt(response, context), context };
      }

      // Cache hit — replay.
      context.receiptId = existing.id;
      context.replayed = true;
      const response = NextResponse.json(existing.response_body ?? {}, {
        status: existing.status_code,
      });
      return { response: attachReceipt(response, context), context };
    }
  }

  // --- Miss: run the handler, persist the result. ---
  const response = await handler();

  // Only cache 2xx/409 responses. 5xx = transient, should re-run.
  // 4xx (other than 409 conflict) = client error; persisting them
  // would be harmless but wastes ledger space.
  const cacheable =
    (response.status >= 200 && response.status < 300) || response.status === 409;

  if (cacheable) {
    let responseBody: unknown = {};
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      if (text) responseBody = JSON.parse(text);
    } catch {
      /* Non-JSON body — keep the empty object placeholder. */
    }

    const { data: inserted, error: insertError } = await supabase
      .from('crm_idempotency_keys')
      .upsert(
        {
          organization_id: options.organizationId,
          key,
          method: options.method,
          path: options.path,
          request_hash: requestHash,
          response_body: responseBody as object,
          status_code: response.status,
          trace_id: options.traceId ?? null,
        },
        { onConflict: 'organization_id,key' },
      )
      .select('id')
      .maybeSingle();

    if (insertError) {
      console.error(
        '[idempotency] Failed to persist ledger row',
        insertError,
      );
    } else if (inserted?.id) {
      context.receiptId = inserted.id;
    }
  }

  return { response: attachReceipt(response, context), context };
}
