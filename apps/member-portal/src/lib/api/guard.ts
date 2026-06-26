import 'server-only';

import { NextResponse } from 'next/server';
import { rateLimit, getRateLimitHeaders } from '@crm-eco/lib/rate-limit';

/**
 * Member-portal API guards: per-member rate limiting and app-level idempotency.
 *
 * These are deliberately additive and self-contained (portal-only): they reuse
 * the shared in-memory `rateLimit` already used by the public enrollment route,
 * and implement double-submit protection with a short look-back query rather
 * than a schema change, so nothing in the shared CRM database is altered.
 */

export interface RateLimitOutcome {
  ok: boolean;
  headers: Record<string, string>;
  /** A ready-to-return 429 response when !ok; undefined when ok. */
  response?: NextResponse;
}

/**
 * Throttle a member action. The key is scoped per member + action so one member
 * spamming `needs` cannot exhaust another member's `comments` budget, and the
 * in-memory map never mixes endpoints.
 *
 * Limits are intentionally generous (real members click a few times, not
 * hundreds): the goal is to stop runaway loops / accidental rapid double-posts,
 * not to throttle normal use. Tune per call site.
 */
export function memberRateLimit(
  memberId: string,
  action: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitOutcome {
  const result = rateLimit(`portal:${action}:${memberId}`, { limit, windowMs });
  const headers = getRateLimitHeaders(result);
  if (result.success) {
    return { ok: true, headers };
  }
  return {
    ok: false,
    headers,
    response: NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests — please slow down and try again in a moment.' },
      { status: 429, headers: { ...headers, 'Retry-After': '60' } },
    ),
  };
}

/**
 * Best-effort idempotency for inserts that have no natural unique key.
 *
 * Returns the id of a row inserted very recently that matches every column in
 * `match` (typically member_id + the user-supplied content), or null when none
 * exists. Callers reuse the existing row instead of inserting a duplicate.
 *
 * This protects against the real-world double-submit (double-click, retry on a
 * slow network, React StrictMode double-invoke) without a DB migration. It is a
 * window, not a hard constraint — for money-critical uniqueness add a DB unique
 * index. `created_at` must exist on the table (true for all portal write tables).
 */
export async function findRecentDuplicate(
  supabase: any,
  table: string,
  match: Record<string, unknown>,
  { windowSeconds = 30, idColumn = 'id' }: { windowSeconds?: number; idColumn?: string } = {},
): Promise<string | null> {
  try {
    const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
    let query = supabase.from(table).select(idColumn).gte('created_at', since);
    for (const [col, val] of Object.entries(match)) {
      query = val === null ? query.is(col, null) : query.eq(col, val);
    }
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return (data as Record<string, unknown>)[idColumn] as string;
  } catch {
    // Idempotency is an optimization — never let a lookup failure block the write.
    return null;
  }
}
