/**
 * Rate limiting for API routes.
 *
 * Two tiers share one module so callers never have to pick a competing helper:
 *
 *   rateLimit()        — synchronous, per-instance, in-memory. Cheap and
 *                        dependency-free, but a serverless deployment runs many
 *                        instances and recycles them, so a determined caller can
 *                        get several times the intended budget.
 *
 *   rateLimitDurable() — asynchronous, backed by Postgres
 *                        (`consume_rate_limit`, called with the service role).
 *                        The limit holds across instances, cold starts, and
 *                        redeploys. Falls back to the in-memory tier when the
 *                        store is unreachable, so a database blip degrades the
 *                        limit instead of removing it.
 *
 * Prefer rateLimitDurable() for anything security-relevant (auth, invites,
 * password reset, outbound sends).
 */

import { createClient } from '@supabase/supabase-js';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 60_000);
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);

  if (entry.count > limit) {
    return { success: false, limit, remaining: 0, reset: entry.resetTime };
  }

  return { success: true, limit, remaining, reset: entry.resetTime };
}

/** Test helper — clears per-instance counters between cases. */
export function resetInMemoryRateLimits(): void {
  rateLimitMap.clear();
}

// ---------------------------------------------------------------------------
// Durable tier
// ---------------------------------------------------------------------------

export type RateLimitFailMode = 'open' | 'closed';

export interface DurableRateLimitResult extends RateLimitResult {
  /** True when the durable store was unreachable and the fallback decided. */
  degraded: boolean;
  retryAfterSeconds: number;
}

/** Minimal surface `rateLimitDurable` needs — lets tests inject a fake store. */
export interface RateLimitStore {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface DurableRateLimitOptions {
  limit?: number;
  windowSeconds?: number;
  /**
   * What to do when the durable store cannot be reached.
   *   'open'   (default) — trust the in-memory fallback. Correct for endpoints
   *                        on the login path, where a database blip must not
   *                        lock everyone out.
   *   'closed'           — deny. Use where an unmetered request is worse than
   *                        a rejected one.
   */
  failMode?: RateLimitFailMode;
  store?: RateLimitStore | null;
}

let cachedStore: RateLimitStore | null | undefined;

function defaultStore(): RateLimitStore | null {
  if (cachedStore !== undefined) return cachedStore;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  cachedStore =
    url && serviceRoleKey
      ? // Narrowed to the one call this module makes: the generated Database
        // types don't describe consume_rate_limit until the migration is applied
        // and types are regenerated, and supabase-js returns a query builder
        // rather than a bare Promise from rpc().
        (createClient(url, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        }) as unknown as RateLimitStore)
      : null;

  return cachedStore;
}

interface ConsumeRateLimitRow {
  allowed: boolean;
  hits: number;
  retry_after_seconds: number;
}

/**
 * Consume one unit from a durable rate-limit bucket.
 *
 * Never throws — a limiter that crashes the request it protects is worse than
 * the limit it enforces.
 */
export async function rateLimitDurable(
  key: string,
  options: DurableRateLimitOptions = {},
): Promise<DurableRateLimitResult> {
  const {
    limit = 10,
    windowSeconds = 60,
    failMode = 'open',
    store = defaultStore(),
  } = options;

  if (store) {
    try {
      const { data, error } = await store.rpc('consume_rate_limit', {
        p_key: key,
        p_max: limit,
        p_window_seconds: windowSeconds,
      });

      if (error) {
        console.warn('[rate-limit] durable store error:', error.message);
      } else {
        const row = Array.isArray(data)
          ? (data[0] as ConsumeRateLimitRow | undefined)
          : (data as ConsumeRateLimitRow | null);

        if (row && typeof row.allowed === 'boolean') {
          const hits = Number(row.hits ?? 0);
          const retryAfterSeconds = Math.max(
            0,
            Number(row.retry_after_seconds ?? windowSeconds),
          );
          return {
            success: row.allowed,
            limit,
            remaining: Math.max(0, limit - hits),
            reset: Date.now() + retryAfterSeconds * 1000,
            retryAfterSeconds,
            degraded: false,
          };
        }

        console.warn('[rate-limit] durable store returned an unexpected shape');
      }
    } catch (err) {
      console.warn(
        '[rate-limit] durable store unavailable:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Degraded path: still enforce *a* limit rather than none.
  const fallback = rateLimit(key, { limit, windowMs: windowSeconds * 1000 });
  return {
    ...fallback,
    success: failMode === 'closed' ? false : fallback.success,
    retryAfterSeconds: Math.max(0, Math.ceil((fallback.reset - Date.now()) / 1000)),
    degraded: true,
  };
}

export function getRateLimitHeaders(
  result: RateLimitResult | DurableRateLimitResult,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };

  if (!result.success && 'retryAfterSeconds' in result) {
    headers['Retry-After'] = String(Math.max(1, result.retryAfterSeconds));
  }

  return headers;
}
