import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@crm-eco/lib/supabase/server';
import { logAuthEvent } from '@crm-eco/lib/audit';

export const dynamic = 'force-dynamic';

// ── In-memory rate limiter (per-IP, 10 req/min) ──────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Periodic cleanup to prevent memory leaks (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000).unref?.();

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit by IP ───────────────────────────────────────────
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { action, email, details } = body;

    // Validate action
    const validActions = [
      'login_success',
      'login_failed',
      'logout',
      'password_reset',
      'mfa_enabled',
      'mfa_disabled',
    ];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // ── Require authentication for ALL actions ─────────────────────
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Ensure the authenticated user matches the claimed email
    if (user.email !== email) {
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 });
    }

    // Log the auth event
    const result = await logAuthEvent('admin', action, email, {
      ...details,
      source: 'admin_login_page',
    });

    if (!result.success) {
      console.error('[Auth Log] Failed to log event:', result.error);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth Log] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
