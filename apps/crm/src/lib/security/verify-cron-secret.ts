import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Fail-closed CRON_SECRET verification for scheduled endpoints.
 *
 * Returns `null` when the caller is authorized, or a `NextResponse` to return
 * directly from the handler.
 *
 * Extracted from `/api/automation/cron`, which was the only one of the four
 * cron routes that got this right. The other three used:
 *
 *     if (cronSecret) { ...verify... }        // "Allow if no secret configured (dev mode)"
 *
 * — so a deployment missing `CRON_SECRET` left privileged, service-role,
 * mutation-heavy endpoints publicly invokable by anyone. Absent configuration
 * must never mean absent authentication.
 *
 * Verified 2026-08-02: `GET https://crm.doublehelixhub.com/api/automation/cron`
 * returns 401 (not 500), confirming CRON_SECRET is set in production, so this is
 * a no-op for the real Vercel crons.
 */
export function verifyCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron] CRON_SECRET env var is not configured — rejecting request');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(authHeader);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
