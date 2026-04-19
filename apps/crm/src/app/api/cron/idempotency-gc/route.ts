/**
 * POST /api/cron/idempotency-gc
 *
 * Purges expired rows from `crm_idempotency_keys`. Rows live for 24h
 * after their request (see migration 202604210001) — that window is
 * long enough to cover realistic retry scenarios (tab sleep, weak
 * signal) but short enough that the table stays small.
 *
 * Schedule: every 15 minutes. Idempotent — safe to invoke repeatedly
 * because the underlying SQL function only deletes rows whose
 * `expires_at < now()`.
 *
 * Auth: matches the shared CRON_SECRET pattern used by the other
 * scheduled routes (`/api/automation/cron`, `/api/comms/cron`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: 'Service-role credentials not configured' },
      { status: 500 },
    );
  }

  const supabase = createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // The SQL helper is a single `DELETE ... RETURNING 1` and returns
  // the row count, which we surface in the response so the Vercel cron
  // logs show drift at a glance.
  const { data, error } = await supabase.rpc('purge_expired_idempotency_keys');
  if (error) {
    console.error('[idempotency-gc] purge failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    purged: typeof data === 'number' ? data : 0,
    purgedAt: new Date().toISOString(),
  });
}

// GET mirrors POST so manual health checks work without crafting a
// POST request. Still requires CRON_SECRET when configured.
export async function GET(request: NextRequest) {
  return POST(request);
}
