/**
 * GET|POST /api/cron/reap-stalled-import-jobs
 *
 * Marks `crm_import_jobs` rows that never reached a terminal status as
 * `failed`. The SQL function (`reap_stalled_import_jobs`) is service-role
 * only and already live; this route is the missing schedule.
 *
 * Default age is 1 hour (function default) so an in-request create that
 * is still writing is not reaped mid-flight.
 *
 * Schedule: every 15 minutes (see apps/crm/vercel.json). Idempotent.
 * Auth: fail-closed CRON_SECRET via verifyCronSecret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyCronSecret } from '@/lib/security/verify-cron-secret';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function reapStalledImportJobs(request: NextRequest) {
  const unauthorized = verifyCronSecret(request);
  if (unauthorized) return unauthorized;

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

  const { data, error } = await supabase.rpc('reap_stalled_import_jobs');
  if (error) {
    console.error('[reap-stalled-import-jobs] rpc failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reaped: typeof data === 'number' ? data : 0,
    reapedAt: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return reapStalledImportJobs(request);
}

/** Vercel crons invoke GET — same handler, same secret. */
export async function GET(request: NextRequest) {
  return reapStalledImportJobs(request);
}
